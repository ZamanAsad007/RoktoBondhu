const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { closeNotificationQueue } = require('../src/jobs/notificationQueue');
const outboxRepository = require('../src/repositories/outboxRepository');
const { processOutboxBatch } = require('../src/jobs/outboxPublisher');
const matchingQueue = require('../src/jobs/matchingQueue');

describe('Phase 23: Reliability Pack & Chaos Scenarios', () => {
  let userToken;
  let userId;
  let donorToken;
  let donorId;

  beforeAll(async () => {
    await runMigrations();

    const ts = Date.now();

    // 1. Create Requester User
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Reliability Requester',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `rel_req_${ts}@example.com`,
      password: 'UserPassword123!',
    });
    userToken = userRes.body.data.accessToken;
    userId = userRes.body.data.user.id;

    // 2. Create Donor User
    const donorRes = await request(app).post('/api/auth/register').send({
      name: 'Reliability Donor',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `rel_donor_${ts}@example.com`,
      password: 'DonorPassword123!',
    });
    donorToken = donorRes.body.data.accessToken;
    donorId = donorRes.body.data.user.id;

    // Set up donor profile
    await request(app)
      .put('/api/donors/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        blood_group: 'B+',
        date_of_birth: '1992-04-10',
        latitude: 23.8103,
        longitude: 90.4125,
        city: 'Dhaka',
        available: true,
      });
  });

  afterAll(async () => {
    await closeNotificationQueue();
  });

  describe('1. Transactional Outbox & Chaos Recovery', () => {
    it('writes jobs to outbox table and publisher successfully dispatches them', async () => {
      const ts = Date.now();
      const testJob = await outboxRepository.insertJob(null, {
        queueName: 'matching-waves',
        eventType: 'run-wave',
        payload: { testId: `outbox-test-${ts}` },
      });

      expect(testJob).toBeDefined();
      expect(testJob.status).toBe('PENDING');

      // Process batch
      const processed = await processOutboxBatch();
      expect(processed).toBeGreaterThanOrEqual(1);

      // Verify status updated in DB
      const res = await db.query('SELECT * FROM outbox WHERE id = $1', [testJob.id]);
      expect(res.rows[0].status).toBe('PUBLISHED');
      expect(res.rows[0].processed_at).not.toBeNull();
    });

    it('chaos scenario: handles broker outage gracefully mid-wave and recovers without losing jobs', async () => {
      const ts = Date.now();
      const testJob = await outboxRepository.insertJob(null, {
        queueName: 'matching-waves',
        eventType: 'run-wave',
        payload: { testId: `chaos-job-${ts}` },
      });

      // 1. Simulate Redis / Broker outage by breaking queue.add
      const queue = matchingQueue.getMatchingQueue();
      const originalAdd = queue.add;
      queue.add = jest.fn().mockRejectedValueOnce(new Error('Connection lost to Redis broker (Chaos Test)'));

      // 2. Run publisher during outage
      await processOutboxBatch();

      // Verify job remained in retry state and error was recorded
      const failedRes = await db.query('SELECT * FROM outbox WHERE id = $1', [testJob.id]);
      expect(failedRes.rows[0].attempts).toBe(1);
      expect(failedRes.rows[0].error_message).toContain('Chaos Test');
      expect(failedRes.rows[0].status).toBe('PENDING'); // Still pending retry

      // 3. Restore broker
      queue.add = originalAdd;

      // 4. Run publisher again
      const recoveredCount = await processOutboxBatch();
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      // Verify successfully published after recovery
      const finalRes = await db.query('SELECT * FROM outbox WHERE id = $1', [testJob.id]);
      expect(finalRes.rows[0].status).toBe('PUBLISHED');
      expect(finalRes.rows[0].processed_at).not.toBeNull();
    });
  });

  describe('2. Idempotency Keys', () => {
    it('replays identical response for duplicate POST /requests with same Idempotency-Key', async () => {
      const idempotencyKey = `req-idemp-${Date.now()}`;
      const payload = {
        patient_name: 'Idempotent Patient',
        blood_group: 'B+',
        units_needed: 1,
        hospital_name: 'Square Hospital',
        city: 'Dhaka',
        latitude: 23.8103,
        longitude: 90.4125,
        urgency: 'NORMAL',
        needed_by: new Date(Date.now() + 24 * 3600000).toISOString(),
        contact_phone: '+8801700112233',
      };

      // First Request -> MISS
      const res1 = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.headers['x-cache-lookup']).toBe('MISS');
      const requestId = res1.body.data.request.id;

      // Second Request with identical Idempotency-Key -> HIT
      const res2 = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.headers['x-cache-lookup']).toBe('HIT');
      expect(res2.headers['idempotent-replayed']).toBe('true');
      expect(res2.body.data.request.id).toBe(requestId);

      // Verify in DB that only 1 request was created
      const countRes = await db.query(
        `SELECT COUNT(*)::int AS count FROM blood_requests WHERE patient_name = 'Idempotent Patient'`
      );
      expect(countRes.rows[0].count).toBe(1);
    });

    it('replays response on duplicate POST /matches/:id/accept with same Idempotency-Key', async () => {
      // Create request and invite donor
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          patient_name: 'Accept Test Patient',
          blood_group: 'B+',
          units_needed: 1,
          hospital_name: 'LabAid Hospital',
          city: 'Dhaka',
          latitude: 23.8103,
          longitude: 90.4125,
          urgency: 'NORMAL',
          needed_by: new Date(Date.now() + 24 * 3600000).toISOString(),
          contact_phone: '+8801700112244',
        });

      const reqId = reqRes.body.data.request.id;

      // Insert NOTIFIED match record for donor
      const matchRes = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
         VALUES ($1, $2, 'NOTIFIED', 2.5, 1)
         RETURNING id`,
        [reqId, donorId]
      );
      const matchId = matchRes.rows[0].id;

      const acceptKey = `accept-idemp-${Date.now()}`;

      // First Accept -> 200 OK (MISS)
      const accept1 = await request(app)
        .post(`/api/matches/${matchId}/accept`)
        .set('Authorization', `Bearer ${donorToken}`)
        .set('Idempotency-Key', acceptKey);

      expect(accept1.status).toBe(200);
      expect(accept1.headers['x-cache-lookup']).toBe('MISS');

      // Second Accept with same Idempotency-Key -> Replayed 200 OK (HIT) without conflict error
      const accept2 = await request(app)
        .post(`/api/matches/${matchId}/accept`)
        .set('Authorization', `Bearer ${donorToken}`)
        .set('Idempotency-Key', acceptKey);

      expect(accept2.status).toBe(200);
      expect(accept2.headers['x-cache-lookup']).toBe('HIT');
      expect(accept2.headers['idempotent-replayed']).toBe('true');
    });
  });

  describe('3. Rate Limiting & Login Brute Force Protection', () => {
    it('blocks rapid brute force login attempts with 429 Too Many Requests', async () => {
      const email = `brute_test_${Date.now()}@example.com`;

      // 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send({
          email,
          password: 'WrongPassword!',
        });
      }

      // 6th attempt should be blocked
      const blockedRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'WrongPassword!',
      });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error).toContain('Too many failed login attempts');
      expect(blockedRes.headers).toHaveProperty('retry-after');
    });
  });

  describe('4. Observability: Correlation IDs & Prometheus Metrics', () => {
    it('propagates custom X-Correlation-Id header', async () => {
      const customId = `corr-${Date.now()}`;
      const res = await request(app).get('/health').set('X-Correlation-Id', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).toBe(customId);
    });

    it('generates new X-Correlation-Id when not provided', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id'].length).toBeGreaterThan(10);
    });

    it('exposes Prometheus metrics on /metrics endpoint', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');

      const metricsText = res.text;
      expect(metricsText).toContain('roktobondhu_matching_waves_total');
      expect(metricsText).toContain('roktobondhu_matches_accepted_total');
      expect(metricsText).toContain('roktobondhu_http_requests_total');
    });
  });
});
