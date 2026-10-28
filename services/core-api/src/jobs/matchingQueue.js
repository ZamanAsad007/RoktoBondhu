const { Queue, Worker } = require('bullmq');
const config = require('../config');
const matchingConfig = require('../config/matching.config');
const bloodRequestRepository = require('../repositories/bloodRequestRepository');
const matchingRepository = require('../repositories/matchingRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const notificationQueue = require('./notificationQueue');
const sseService = require('../services/sseService');
const { REQUEST_STATUSES } = require('../domain/requestStateMachine');
const { rankCandidatesV2 } = require('../domain/matchingV2');

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const MATCHING_QUEUE_NAME = 'matching-waves';

let matchingQueue = null;
let matchingWorker = null;

function getMatchingQueue() {
  if (!matchingQueue) {
    matchingQueue = new Queue(MATCHING_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return matchingQueue;
}

/**
 * Executes a matching wave for a blood request.
 * Finds eligible donors within the current radius, creates NOTIFIED match records,
 * and schedules the subsequent radius expansion job.
 */
async function processRunWave(requestId) {
  const request = await bloodRequestRepository.findById(requestId);
  if (!request) {
    return { status: 'NOT_FOUND' };
  }

  // If already terminal or cancelled/fulfilled, do nothing
  if (
    request.status === REQUEST_STATUSES.FULFILLED ||
    request.status === REQUEST_STATUSES.CANCELLED ||
    request.status === REQUEST_STATUSES.EXPIRED
  ) {
    return { status: 'COMPLETED_OR_TERMINAL', requestStatus: request.status };
  }

  // Check if expired by time
  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await processExpireRequest(requestId);
    return { status: 'EXPIRED' };
  }

  const acceptedCount = request.accepted_count || 0;
  const unitsRemaining = request.units_needed - acceptedCount;
  if (unitsRemaining <= 0) {
    return { status: 'ALREADY_FULFILLED' };
  }

  // Calculate target batch size
  const targetBatchSize = Math.max(
    matchingConfig.minDonorsPerWave,
    Math.min(unitsRemaining * matchingConfig.donorsPerUnit, matchingConfig.maxDonorsPerWave)
  );

  const eligibleDonors = await matchingRepository.findEligibleDonorsForRequest({
    requestId,
    radiusKm: request.current_radius_km,
    limit: targetBatchSize * 2, // Fetch larger candidate pool for v2 ranking
  });

  const rankedDonors = rankCandidatesV2({
    candidates: eligibleDonors,
    maxRadiusKm: request.current_radius_km,
  }).slice(0, targetBatchSize);

  let createdMatches = [];
  if (rankedDonors.length > 0) {
    const matchPayloads = rankedDonors.map((donor) => ({
      requestId,
      donorId: donor.donor_id,
      distanceKm: donor.distance_km,
      waveNumber: request.wave_number,
    }));

    createdMatches = await matchingRepository.createMatchesBatch(matchPayloads);

    // Real-time SSE event for matched donors (match.new)
    for (const match of createdMatches) {
      sseService
        .publishEvent(
          'match.new',
          {
            matchId: match.id,
            requestId: request.id,
            bloodGroup: request.blood_group,
            unitsNeeded: request.units_needed,
            hospitalName: request.hospital_name,
            urgency: request.urgency,
            neededBy: request.needed_by,
            distanceKm: match.distance_km,
          },
          {
            targetUserIds: [match.donor_id],
            targetRequestId: request.id,
          }
        )
        .catch((err) => console.error('[Matching Queue] SSE publish match.new error:', err.message));
    }

    // Enqueue notifications for matched donors
    for (const donor of eligibleDonors) {
      try {
        await notificationQueue.enqueueNotification({
          type: 'request.nearby',
          userId: donor.donor_id,
          recipient: {
            id: donor.donor_id,
            name: donor.donor_name || 'Donor',
            phone: donor.donor_phone,
            email: donor.donor_email,
          },
          payload: {
            requestId: request.id,
            patientName: request.patient_name,
            bloodGroup: request.blood_group,
            unitsNeeded: request.units_needed,
            hospitalName: request.hospital_name,
            urgency: request.urgency,
            neededBy: request.needed_by,
            distanceKm: donor.distance_km,
          },
          channels: ['in_app', 'sms', 'email'],
        });
      } catch (err) {
        console.error('[Matching Queue] Error enqueuing notification for donor:', err.message);
      }
    }

    await auditLogRepository.log({
      actorId: null,
      action: 'WAVE_DISPATCHED',
      entity: 'blood_requests',
      entityId: requestId,
      metadata: {
        wave_number: request.wave_number,
        radius_km: request.current_radius_km,
        donors_found: eligibleDonors.length,
        matches_created: createdMatches.length,
      },
    });
  }

  // Schedule delayed wave expansion if not fulfilled
  const queue = getMatchingQueue();
  const timeoutMs =
    matchingConfig.waveTimeoutsMs[request.urgency] || matchingConfig.waveTimeoutsMs.NORMAL;

  await queue.add(
    'expand-wave',
    { requestId },
    {
      delay: timeoutMs,
      jobId: `expand-wave-${requestId}-${request.wave_number}`,
    }
  );

  return {
    status: 'WAVE_PROCESSED',
    waveNumber: request.wave_number,
    radiusKm: request.current_radius_km,
    matchesCreated: createdMatches.length,
  };
}

/**
 * Checks if request needs more donors and expands the radius ring to the next tier.
 */
async function processExpandWave(requestId) {
  const request = await bloodRequestRepository.findById(requestId);
  if (!request) {
    return { status: 'NOT_FOUND' };
  }

  // Check if still active
  if (
    request.status !== REQUEST_STATUSES.OPEN &&
    request.status !== REQUEST_STATUSES.PARTIALLY_FULFILLED
  ) {
    return { status: 'TERMINATED', requestStatus: request.status };
  }

  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await processExpireRequest(requestId);
    return { status: 'EXPIRED' };
  }

  const acceptedCount = request.accepted_count || 0;
  if (acceptedCount >= request.units_needed) {
    return { status: 'FULFILLED' };
  }

  const rings = matchingConfig.radiusRingsKm;
  const currentRingIdx = rings.indexOf(request.current_radius_km);

  if (currentRingIdx !== -1 && currentRingIdx < rings.length - 1) {
    const nextRadiusKm = rings[currentRingIdx + 1];
    const nextWaveNumber = request.wave_number + 1;

    await matchingRepository.updateWaveProgress(requestId, {
      currentRadiusKm: nextRadiusKm,
      waveNumber: nextWaveNumber,
    });

    await auditLogRepository.log({
      actorId: null,
      action: 'RADIUS_EXPANDED',
      entity: 'blood_requests',
      entityId: requestId,
      metadata: {
        previous_radius_km: request.current_radius_km,
        new_radius_km: nextRadiusKm,
        wave_number: nextWaveNumber,
      },
    });

    return processRunWave(requestId);
  }

  // Already at max radius ring; run one more wave check in case new donors became available
  return processRunWave(requestId);
}

/**
 * Handles request expiration and auto-expires remaining NOTIFIED matches.
 */
async function processExpireRequest(requestId) {
  const request = await bloodRequestRepository.findById(requestId);
  if (!request) {
    return { status: 'NOT_FOUND' };
  }

  if (
    request.status === REQUEST_STATUSES.OPEN ||
    request.status === REQUEST_STATUSES.PARTIALLY_FULFILLED
  ) {
    await bloodRequestRepository.updateStatus(requestId, REQUEST_STATUSES.EXPIRED);
    await matchingRepository.expirePendingMatches(requestId);

    // Real-time SSE event for requester (request.expired)
    sseService
      .publishEvent(
        'request.expired',
        {
          requestId: request.id,
          patientName: request.patient_name,
          bloodGroup: request.blood_group,
          hospitalName: request.hospital_name,
          status: 'EXPIRED',
        },
        {
          targetUserIds: [request.requester_id],
          targetRequestId: request.id,
        }
      )
      .catch((err) => console.error('[Matching Queue] SSE publish request.expired error:', err.message));

    await auditLogRepository.log({
      actorId: null,
      action: 'REQUEST_EXPIRED',
      entity: 'blood_requests',
      entityId: requestId,
      metadata: { expires_at: request.expires_at },
    });

    try {
      await notificationQueue.enqueueNotification({
        type: 'request.expired',
        userId: request.requester_id,
        payload: {
          requestId: request.id,
          patientName: request.patient_name,
          bloodGroup: request.blood_group,
          hospitalName: request.hospital_name,
          expiresAt: request.expires_at,
        },
        channels: ['in_app', 'email'],
      });
    } catch (err) {
      console.error('[Matching Queue] Error enqueuing expiry notification:', err.message);
    }

    return { status: 'EXPIRED' };
  }

  return { status: 'ALREADY_TERMINATED', currentStatus: request.status };
}

/**
 * Schedules expiration job at the calculated expires_at date.
 */
async function scheduleRequestExpiry(requestId, expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();
  const delay = Math.max(0, expiresAtMs - Date.now());
  const queue = getMatchingQueue();
  return queue.add(
    'expire-request',
    { requestId },
    {
      delay,
      jobId: `expire-request-${requestId}`,
    }
  );
}

/**
 * Starts the BullMQ worker for the matching-waves queue.
 */
function startMatchingWorker() {
  if (matchingWorker) {
    return matchingWorker;
  }

  matchingWorker = new Worker(
    MATCHING_QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'run-wave':
          return processRunWave(job.data.requestId);
        case 'expand-wave':
          return processExpandWave(job.data.requestId);
        case 'expire-request':
          return processExpireRequest(job.data.requestId);
        default:
          throw new Error(`Unknown matching job name: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  matchingWorker.on('failed', (job, err) => {
    console.error(`[Matching Worker] Job ${job?.id} failed:`, err.message);
  });

  return matchingWorker;
}

/**
 * Gracefully shuts down matching queue and worker.
 */
async function closeMatchingQueue() {
  if (matchingWorker) {
    await matchingWorker.close();
    matchingWorker = null;
  }
  if (matchingQueue) {
    await matchingQueue.close();
    matchingQueue = null;
  }
  await notificationQueue.closeNotificationQueue();
}

/**
 * Escalates a request to SOS: widens radius immediately to 25km+ and dispatches matching wave.
 */
async function processEscalateRequest(requestId) {
  const request = await bloodRequestRepository.findById(requestId);
  if (!request) {
    return { status: 'NOT_FOUND' };
  }

  const sosRadius = Math.max(request.current_radius_km || 5, 25);
  const nextWave = (request.wave_number || 1) + 1;

  await matchingRepository.updateWaveProgress(requestId, {
    currentRadiusKm: sosRadius,
    waveNumber: nextWave,
  });

  return await processRunWave(requestId);
}

module.exports = {
  MATCHING_QUEUE_NAME,
  getMatchingQueue,
  startMatchingWorker,
  closeMatchingQueue,
  processRunWave,
  processExpandWave,
  processExpireRequest,
  processEscalateRequest,
  scheduleRequestExpiry,
};
