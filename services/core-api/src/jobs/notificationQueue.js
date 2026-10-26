const { Queue } = require('bullmq');
const config = require('../config');

const NOTIFICATION_QUEUE_NAME = 'notifications';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

let notificationQueue = null;

function getNotificationQueue() {
  if (!notificationQueue) {
    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return notificationQueue;
}

/**
 * Enqueues a notification job for the notification service to consume and dispatch.
 */
async function enqueueNotification({ type, userId, recipient = {}, payload = {}, channels = null, options = {} }) {
  const queue = getNotificationQueue();
  const job = await queue.add(
    type,
    {
      type,
      userId,
      recipient,
      payload,
      channels,
    },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      ...options,
    }
  );
  return job;
}

/**
 * Schedules a donation reminder job before needed_by.
 */
async function scheduleDonationReminder({ donorId, recipient = {}, request, reminderLeadMs = 2 * 60 * 60 * 1000 }) {
  const neededByMs = new Date(request.needed_by).getTime();
  const now = Date.now();
  let targetTimeMs = neededByMs - reminderLeadMs;

  // If already past the 2h lead mark, schedule 15m before needed_by or immediately
  if (targetTimeMs <= now) {
    targetTimeMs = Math.max(now, neededByMs - 15 * 60 * 1000);
  }

  const delay = Math.max(0, targetTimeMs - now);

  return enqueueNotification({
    type: 'donation.reminder',
    userId: donorId,
    recipient,
    payload: {
      requestId: request.id,
      patientName: request.patient_name,
      bloodGroup: request.blood_group,
      hospitalName: request.hospital_name,
      neededBy: request.needed_by,
    },
    channels: ['in_app', 'sms'],
    options: {
      delay,
      jobId: `donation-reminder-${request.id}-${donorId}`,
    },
  });
}

/**
 * Gracefully closes the notification queue.
 */
async function closeNotificationQueue() {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}

module.exports = {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  scheduleDonationReminder,
  closeNotificationQueue,
};
