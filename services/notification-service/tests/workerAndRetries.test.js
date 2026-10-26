const { Queue, QueueEvents } = require('bullmq');
const {
  startNotificationWorker,
  closeNotificationWorker,
  handleDeadLetter,
} = require('../src/workers/notificationWorker');
const { redisConnection } = require('../src/config/redis');
const db = require('../src/config/db');
const smsProvider = require('../src/providers/smsProvider');

describe('Worker, Retries, and Dead-Letter Handling', () => {
  let testQueue;
  let queueEvents;
  let testUserId;

  beforeAll(async () => {
    testQueue = new Queue('notifications', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    queueEvents = new QueueEvents('notifications', {
      connection: redisConnection,
    });

    const userRes = await db.query(`
      INSERT INTO users (name, phone, email, password_hash, role)
      VALUES ('Worker Tester', '+8801555444333', 'workertest@example.com', 'dummyhash', 'USER')
      RETURNING id
    `);
    testUserId = userRes.rows[0].id;
  });

  afterAll(async () => {
    await closeNotificationWorker();
    if (queueEvents) {
      await queueEvents.close();
    }
    if (testQueue) {
      await testQueue.close();
    }
    if (testUserId) {
      await db.query('DELETE FROM notifications WHERE user_id = $1', [testUserId]);
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await db.pool.end();
  });

  it('should process a job from notifications queue and invoke providers', async () => {
    startNotificationWorker();
    smsProvider.clearHistory();

    const job = await testQueue.add('test-notif', {
      type: 'request.nearby',
      userId: testUserId,
      recipient: {
        name: 'Worker Tester',
        email: 'workertest@example.com',
        phone: '+8801555444333',
      },
      payload: {
        requestId: 'req-worker-test',
        hospitalName: 'Kurmitola General Hospital',
        patientName: 'Sufian',
        bloodGroup: 'A+',
        unitsNeeded: 1,
        distanceKm: 4.2,
      },
    });

    // Wait for job completion via QueueEvents
    const completedJob = await job.waitUntilFinished(queueEvents, 10000);
    expect(completedJob).toBeDefined();
    expect(completedJob.type).toBe('request.nearby');
    expect(completedJob.results.in_app).toBeDefined();
    expect(completedJob.results.email).toBeDefined();
    expect(completedJob.results.sms).toBeDefined();

    // Verify in-app record in database
    const notifRes = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'request.nearby' AND channel = 'in_app'`,
      [testUserId]
    );
    expect(notifRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(notifRes.rows[0].status).toBe('sent');
  });

  it('should record dead-letter in DB when job permanently fails', async () => {
    const mockFailedJob = {
      id: 'job-failed-test-999',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        userId: testUserId,
        type: 'donation.reminder',
        payload: { hospitalName: 'DeadLetter Hospital' },
        channels: ['in_app'],
      },
    };

    const mockError = new Error('SMTP connection timed out after 3 retries');
    await handleDeadLetter(mockFailedJob, mockError);

    const deadLetterRes = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND status = 'failed' AND error LIKE '%SMTP%'`,
      [testUserId]
    );

    expect(deadLetterRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(deadLetterRes.rows[0].error).toContain('SMTP connection timed out');
    expect(deadLetterRes.rows[0].status).toBe('failed');
  });
});
