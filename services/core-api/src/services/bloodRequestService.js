const bloodRequestRepository = require('../repositories/bloodRequestRepository');
const matchingRepository = require('../repositories/matchingRepository');
const matchRepository = require('../repositories/matchRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const userRepository = require('../repositories/userRepository');
const donorStatsRepository = require('../repositories/donorStatsRepository');
const notificationQueue = require('../jobs/notificationQueue');
const db = require('../config/db');
const {
  canTransitionRequest,
  transitionRequest,
  REQUEST_STATUSES,
} = require('../domain/requestStateMachine');
const {
  getMatchingQueue,
  processRunWave,
  scheduleRequestExpiry,
} = require('../jobs/matchingQueue');

const MAX_DAILY_REQUESTS = 3;

/**
 * Derives the request expiration time based on urgency and target needed_by timestamp.
 * Request will expire either when the urgency TTL elapses or at needed_by, whichever is earlier.
 *
 * @param {string} urgency - 'NORMAL' | 'URGENT' | 'CRITICAL'
 * @param {string | Date} neededBy
 * @param {Date} [referenceDate=new Date()]
 * @returns {Date}
 */
function calculateExpiresAt(urgency, neededBy, referenceDate = new Date()) {
  const neededByDate = neededBy instanceof Date ? neededBy : new Date(neededBy);
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  let defaultTtlHours;
  switch (urgency) {
    case 'CRITICAL':
      defaultTtlHours = 12;
      break;
    case 'URGENT':
      defaultTtlHours = 24;
      break;
    case 'NORMAL':
    default:
      defaultTtlHours = 48;
      break;
  }

  const urgencyTtlDate = new Date(now.getTime() + defaultTtlHours * 60 * 60 * 1000);

  // Return the earlier of needed_by or urgency default expiry
  return neededByDate < urgencyTtlDate ? neededByDate : urgencyTtlDate;
}

/**
 * Masks phone numbers to protect patient/requester privacy until match acceptance.
 * Example: "+8801712345678" -> "+88017****678"
 * @param {string} phone
 * @returns {string}
 */
function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '******';
  const prefix = trimmed.slice(0, Math.min(5, Math.floor(trimmed.length / 2)));
  const suffix = trimmed.slice(-3);
  return `${prefix}****${suffix}`;
}

class BloodRequestService {
  /**
   * Creates a blood request with rate limiting and urgency-based expiry.
   */
  async createRequest(currentUser, requestData) {
    // 1. Check user block status
    const user = await userRepository.findById(currentUser.id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    if (user.is_blocked) {
      const err = new Error('Your account is blocked from creating blood requests');
      err.status = 403;
      throw err;
    }

    // 2. Enforce daily rate limit (max 3 per 24 hours)
    const recentCount = await bloodRequestRepository.countRecentRequestsByUser(currentUser.id, 24);
    if (recentCount >= MAX_DAILY_REQUESTS) {
      const err = new Error(
        `Rate limit exceeded: You may only create up to ${MAX_DAILY_REQUESTS} blood requests per 24 hours`
      );
      err.status = 429;
      throw err;
    }

    // 3. Calculate expires_at
    const expiresAt = calculateExpiresAt(requestData.urgency, requestData.needed_by);

    // 4. Insert request
    const newRequest = await bloodRequestRepository.createRequest({
      requesterId: currentUser.id,
      patientName: requestData.patient_name,
      bloodGroup: requestData.blood_group,
      unitsNeeded: requestData.units_needed,
      hospitalName: requestData.hospital_name,
      latitude: requestData.latitude,
      longitude: requestData.longitude,
      city: requestData.city,
      urgency: requestData.urgency,
      neededBy: requestData.needed_by,
      contactPhone: requestData.contact_phone,
      expiresAt: expiresAt.toISOString(),
    });

    // 5. Audit log
    await auditLogRepository.log({
      actorId: currentUser.id,
      action: 'REQUEST_CREATED',
      entity: 'blood_requests',
      entityId: newRequest.id,
      metadata: {
        blood_group: newRequest.blood_group,
        units_needed: newRequest.units_needed,
        urgency: newRequest.urgency,
      },
    });

    // 6. Trigger first wave and schedule expiration
    try {
      const queue = getMatchingQueue();
      await queue.add('run-wave', { requestId: newRequest.id });
      await scheduleRequestExpiry(newRequest.id, expiresAt);

      // In test mode, process first wave immediately for synchronous assertions
      if (process.env.NODE_ENV === 'test') {
        await processRunWave(newRequest.id);
      }
    } catch (queueErr) {
      console.error('[MatchingQueue] Failed to enqueue wave job:', queueErr.message);
    }

    return newRequest;
  }

  /**
   * Finds open compatible blood requests nearby for an authenticated donor.
   */
  async getNearbyRequestsForDonor(currentUser, { radiusKm = 10, limit = 20 } = {}) {
    const parsedRadius = parseFloat(radiusKm) || 10;
    const parsedLimit = parseInt(limit, 10) || 20;
    return matchingRepository.findNearbyOpenRequestsForDonor({
      donorUserId: currentUser.id,
      radiusKm: parsedRadius,
      limit: parsedLimit,
    });
  }

  /**
   * Retrieves a request by ID, applying privacy masking to contact details
   * unless the viewer is the requester, an admin, or an ACCEPTED donor.
   */
  async getRequestById(requestId, currentUser) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) {
      const err = new Error('Blood request not found');
      err.status = 404;
      throw err;
    }

    const isRequester = currentUser && currentUser.id === request.requester_id;
    const isAdmin = currentUser && currentUser.role === 'ADMIN';

    let isAcceptedDonor = false;
    let userMatch = null;
    if (currentUser) {
      userMatch = await bloodRequestRepository.findMatchForUser(requestId, currentUser.id);
      if (userMatch && userMatch.status === 'ACCEPTED') {
        isAcceptedDonor = true;
      }
    }

    const isAuthorized = isRequester || isAdmin || isAcceptedDonor;

    // Contact info hiding
    const responseData = {
      ...request,
      is_contact_revealed: isAuthorized,
      contact_phone: isAuthorized ? request.contact_phone : maskPhoneNumber(request.contact_phone),
      requester_phone: isAuthorized ? request.requester_phone : maskPhoneNumber(request.requester_phone),
    };

    // If requester or admin, include matches list
    if (isRequester || isAdmin) {
      responseData.matches = await bloodRequestRepository.listMatches(requestId);
    } else if (userMatch) {
      responseData.my_match = {
        id: userMatch.id,
        status: userMatch.status,
        wave_number: userMatch.wave_number,
        distance_km: userMatch.distance_km,
        notified_at: userMatch.notified_at,
        responded_at: userMatch.responded_at,
      };
    }

    return responseData;
  }

  /**
   * Lists requests created by the current user.
   */
  async listMyRequests(currentUser, pagination = {}) {
    return bloodRequestRepository.findByRequesterId(currentUser.id, pagination);
  }

  /**
   * Cancels a blood request and marks pending notified matches as EXPIRED.
   */
  async cancelRequest(requestId, currentUser) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) {
      const err = new Error('Blood request not found');
      err.status = 404;
      throw err;
    }

    const isRequester = currentUser.id === request.requester_id;
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isRequester && !isAdmin) {
      const err = new Error('Forbidden: You do not have permission to cancel this request');
      err.status = 403;
      throw err;
    }

    if (!canTransitionRequest(request.status, REQUEST_STATUSES.CANCELLED)) {
      const err = new Error(
        `Cannot cancel request in status "${request.status}". Only open or partially fulfilled requests can be cancelled.`
      );
      err.status = 400;
      throw err;
    }

    // Execute cancellation in transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const updatedRequest = await bloodRequestRepository.updateStatus(
        requestId,
        REQUEST_STATUSES.CANCELLED,
        client
      );

      // Expire remaining NOTIFIED matches
      await client.query(
        `UPDATE request_matches SET status = 'EXPIRED' WHERE request_id = $1 AND status = 'NOTIFIED'`,
        [requestId]
      );

      await auditLogRepository.log(
        {
          actorId: currentUser.id,
          action: 'REQUEST_CANCELLED',
          entity: 'blood_requests',
          entityId: requestId,
          metadata: { previous_status: request.status },
        },
        client
      );

      // Fetch accepted donors before committing
      const acceptedMatches = await matchRepository.findAcceptedMatchesByRequestId(requestId, client);

      await client.query('COMMIT');

      // Post-commit notify accepted donors
      for (const m of acceptedMatches) {
        try {
          await notificationQueue.enqueueNotification({
            type: 'request.cancelled',
            userId: m.donor_id,
            payload: {
              requestId: request.id,
              patientName: request.patient_name,
              bloodGroup: request.blood_group,
              hospitalName: request.hospital_name,
            },
            channels: ['in_app'],
          });
        } catch (notifyErr) {
          console.error('[BloodRequestService] Error notifying donor of cancellation:', notifyErr.message);
        }
      }

      return updatedRequest;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Requester confirms that a donation occurred.
   */
  async confirmDonation(requestId, matchId, currentUser) {
    const request = await bloodRequestRepository.findById(requestId);
    if (!request) {
      const err = new Error('Blood request not found');
      err.status = 404;
      throw err;
    }

    const isRequester = currentUser && currentUser.id === request.requester_id;
    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    if (!isRequester && !isAdmin) {
      const err = new Error('Forbidden: Only the requester can confirm donations');
      err.status = 403;
      throw err;
    }

    const match = await matchRepository.findById(matchId);
    if (!match || match.request_id !== requestId) {
      const err = new Error('Match invitation not found for this request');
      err.status = 404;
      throw err;
    }

    if (match.status !== 'ACCEPTED') {
      const err = new Error(
        `Cannot confirm donation for match in status "${match.status}". Only accepted donors can be confirmed.`
      );
      err.status = 400;
      throw err;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update match status to DONATED
      await matchRepository.updateMatchStatus(matchId, 'DONATED', client);

      // Record donation row
      const insDonationQuery = `
        INSERT INTO donations (request_id, donor_id, donated_at, confirmed_by_requester)
        VALUES ($1, $2, NOW(), TRUE)
        RETURNING *
      `;
      const donationRes = await client.query(insDonationQuery, [requestId, match.donor_id]);
      const donation = donationRes.rows[0];

      // Update donor profile's last_donated_at
      await client.query(
        `UPDATE donor_profiles SET last_donated_at = NOW() WHERE user_id = $1`,
        [match.donor_id]
      );

      // Update donor stats, streaks, next eligible date, and award badges
      const statsUpdate = await donorStatsRepository.recordDonationConfirmed({
        userId: match.donor_id,
        donationId: donation.id,
        requestId,
        match: {
          ...match,
          request_urgency: request.urgency,
        },
        client,
      });
      donation.certificate_no = statsUpdate.certificateNo;

      // Record audit log
      await auditLogRepository.log(
        {
          actorId: currentUser.id,
          action: 'DONATION_CONFIRMED',
          entity: 'donations',
          entityId: donation.id,
          metadata: { 
            request_id: requestId, 
            donor_id: match.donor_id,
            certificate_no: statsUpdate.certificateNo,
            badges_awarded: statsUpdate.newBadges?.map(b => b.code) || []
          },
        },
        client
      );

      await client.query('COMMIT');
      return donation;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = {
  BloodRequestService,
  calculateExpiresAt,
  maskPhoneNumber,
  bloodRequestService: new BloodRequestService(),
};
