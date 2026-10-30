const outboxRepository = require('../repositories/outboxRepository');
const notificationQueue = require('./notificationQueue');
const { getMatchingQueue } = require('./matchingQueue');

let publisherTimer = null;
let isProcessing = false;

/**
 * Process a batch of pending outbox jobs and dispatch them to BullMQ
 */
async function processOutboxBatch(batchSize = 25) {
  if (isProcessing) return 0;
  isProcessing = true;

  try {
    const pendingJobs = await outboxRepository.getPendingJobs(batchSize);
    if (!pendingJobs || pendingJobs.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const job of pendingJobs) {
      try {
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

        if (job.queue_name === 'matching-waves') {
          const queue = getMatchingQueue();
          await queue.add(job.event_type, payload, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });
        } else if (job.queue_name === 'notifications') {
          await notificationQueue.enqueueNotification({
            type: job.event_type,
            userId: payload.requesterId || payload.userId,
            payload,
          });
        }

        await outboxRepository.markPublished(job.id);
        processedCount++;
      } catch (err) {
        console.error(`[OutboxPublisher] Error publishing outbox job ${job.id}:`, err.message);
        await outboxRepository.markFailed(job.id, err.message);
      }
    }

    return processedCount;
  } catch (err) {
    console.error('[OutboxPublisher] Error fetching pending outbox jobs:', err.message);
    return 0;
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts background outbox publisher loop
 */
function startOutboxPublisher(intervalMs = 1000) {
  if (publisherTimer) return;
  publisherTimer = setInterval(async () => {
    try {
      await processOutboxBatch();
    } catch (err) {
      console.error('[OutboxPublisher] Uncaught poll error:', err.message);
    }
  }, intervalMs);
}

/**
 * Stops background outbox publisher
 */
function stopOutboxPublisher() {
  if (publisherTimer) {
    clearInterval(publisherTimer);
    publisherTimer = null;
  }
}

module.exports = {
  processOutboxBatch,
  startOutboxPublisher,
  stopOutboxPublisher,
};
