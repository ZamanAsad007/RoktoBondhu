const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const config = require('../config');
const db = require('../config/db');
const notificationDispatcher = require('../services/notificationDispatcher');

let worker = null;

/**
 * Handles job failure after all retries have been exhausted (dead-letter handling).
 */
async function handleDeadLetter(job, err) {
  const { userId, type, payload, channels } = job.data || {};
  console.error(`[Notification Dead-Letter] Job ${job.id} (${type}) failed permanently: ${err.message}`);

  try {
    if (userId) {
      await db.query(
        `INSERT INTO notifications (user_id, channel, type, payload, status, error, created_at)
         VALUES ($1, $2, $3, $4, 'failed', $5, NOW())`,
        [
          userId,
          (channels && channels[0]) || 'system',
          type || 'unknown',
          JSON.stringify({ ...payload, failedJobId: job.id, attemptsMade: job.attemptsMade }),
          err.message,
        ]
      );
    }
  } catch (dbErr) {
    console.error('[Notification Dead-Letter] Failed to record dead-letter in DB:', dbErr.message);
  }
}

/**
 * Starts the BullMQ notification worker.
 */
function startNotificationWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    config.queueName,
    async (job) => {
      const { type, userId, recipient, payload, channels } = job.data;
      return notificationDispatcher.dispatch({
        type: type || job.name,
        userId,
        recipient,
        payload,
        channels,
      });
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    // console.log(`[Notification Worker] Job ${job.id} (${job.name}) completed successfully.`);
  });

  worker.on('failed', async (job, err) => {
    const attemptsMade = job ? job.attemptsMade : 0;
    const maxAttempts = job && job.opts ? job.opts.attempts || 3 : 3;

    if (attemptsMade >= maxAttempts) {
      await handleDeadLetter(job, err);
    } else {
      console.warn(
        `[Notification Worker] Job ${job?.id} attempt ${attemptsMade}/${maxAttempts} failed: ${err.message}. Retrying...`
      );
    }
  });

  return worker;
}

/**
 * Gracefully shuts down the worker.
 */
async function closeNotificationWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

module.exports = {
  startNotificationWorker,
  closeNotificationWorker,
  handleDeadLetter,
};
