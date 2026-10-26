const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');
const { runMigrations } = require('../src/db/migrate');
const { calculateExpiresAt, maskPhoneNumber } = require('../src/services/bloodRequestService');

describe('Blood Requests API and Service (Phase 4)', () => {
  let requesterToken;
  let requesterId;
  let otherUserToken;
  let otherUserId;
  let donorUserToken;
  let donorUserId;
  let adminToken;
  let adminId;

  beforeAll(async () => {
    await runMigrations();

    // Clean up test data
    await db.query(`
      DELETE FROM audit_logs;
      DELETE FROM donations;
      DELETE FROM request_matches;
      DELETE FROM blood_requests;
      DELETE FROM refresh_tokens;
      DELETE FROM donor_profiles;
      DELETE FROM users;
    `);

    // Create Requester
    const reqRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Requester User',
        email: 'requester@test.com',
        phone: '+8801711000001',
        password: 'Password123!',
      });
    requesterToken = reqRes.body.data.accessToken;
    requesterId = reqRes.body.data.user.id;

    // Create Other User
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Other User',
        email: 'other@test.com',
        phone: '+8801711000002',
        password: 'Password123!',
      });
    otherUserToken = otherRes.body.data.accessToken;
    otherUserId = otherRes.body.data.user.id;

    // Create Donor User
    const donorRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Donor User',
        email: 'donor@test.com',
        phone: '+8801711000003',
        password: 'Password123!',
      });
    donorUserToken = donorRes.body.data.accessToken;
    donorUserId = donorRes.body.data.user.id;

    // Create Admin User
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@test.com',
        phone: '+8801711000004',
        password: 'Password123!',
      });
    adminToken = adminRes.body.data.accessToken;
    adminId = adminRes.body.data.user.id;
    await db.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [adminId]);
  });

  afterAll(async () => {
    await db.pool.end();
    await redis.quit();
  });

  describe('Pure Helpers (calculateExpiresAt & maskPhoneNumber)', () => {
    const fixedNow = new Date('2026-10-26T12:00:00Z');

    test('calculates CRITICAL expires_at (max 12h)', () => {
      // needed_by in 24 hours -> capped at 12 hours
      const neededByFuture = new Date('2026-10-27T12:00:00Z');
      const expiry = calculateExpiresAt('CRITICAL', neededByFuture, fixedNow);
      expect(expiry.toISOString()).toBe('2026-10-27T00:00:00.000Z'); // exactly +12h

      // needed_by in 3 hours -> capped at needed_by
      const neededBySoon = new Date('2026-10-26T15:00:00Z');
      const expirySoon = calculateExpiresAt('CRITICAL', neededBySoon, fixedNow);
      expect(expirySoon.toISOString()).toBe('2026-10-26T15:00:00.000Z');
    });

    test('calculates URGENT expires_at (max 24h)', () => {
      const neededBy48h = new Date('2026-10-28T12:00:00Z');
      const expiry = calculateExpiresAt('URGENT', neededBy48h, fixedNow);
      expect(expiry.toISOString()).toBe('2026-10-27T12:00:00.000Z'); // +24h
    });

    test('calculates NORMAL expires_at (max 48h)', () => {
      const neededBy72h = new Date('2026-10-29T12:00:00Z');
      const expiry = calculateExpiresAt('NORMAL', neededBy72h, fixedNow);
      expect(expiry.toISOString()).toBe('2026-10-28T12:00:00.000Z'); // +48h
    });

    test('masks phone numbers appropriately', () => {
      expect(maskPhoneNumber('+8801712345678')).toBe('+8801****678');
      expect(maskPhoneNumber('01812345678')).toBe('01812****678');
      expect(maskPhoneNumber('123')).toBe('******');
      expect(maskPhoneNumber(null)).toBe('');
    });
  });

  describe('Validation on POST /api/requests', () => {
    test('rejects request with invalid blood group', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Karim',
          blood_group: 'Z+',
          units_needed: 2,
          hospital_name: 'Dhaka Medical College',
          latitude: 23.7259,
          longitude: 90.3973,
          urgency: 'URGENT',
          needed_by: new Date(Date.now() + 86400000).toISOString(),
          contact_phone: '+8801712345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details[0].message).toMatch(/Invalid blood group/);
    });

    test('rejects request with units out of range (0 or > 10)', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Karim',
          blood_group: 'B+',
          units_needed: 15,
          hospital_name: 'Dhaka Medical College',
          latitude: 23.7259,
          longitude: 90.3973,
          urgency: 'URGENT',
          needed_by: new Date(Date.now() + 86400000).toISOString(),
          contact_phone: '+8801712345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toMatch(/Units needed cannot exceed 10/);
    });

    test('rejects request with needed_by in the past', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Karim',
          blood_group: 'B+',
          units_needed: 2,
          hospital_name: 'Dhaka Medical College',
          latitude: 23.7259,
          longitude: 90.3973,
          urgency: 'URGENT',
          needed_by: new Date(Date.now() - 3600000).toISOString(),
          contact_phone: '+8801712345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toMatch(/needed_by must be a future date/);
    });

    test('rejects request with invalid phone number', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Karim',
          blood_group: 'B+',
          units_needed: 2,
          hospital_name: 'Dhaka Medical College',
          latitude: 23.7259,
          longitude: 90.3973,
          urgency: 'URGENT',
          needed_by: new Date(Date.now() + 86400000).toISOString(),
          contact_phone: '12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toMatch(/Bangladeshi mobile number/);
    });
  });

  describe('Blood Request Lifecycle & Contact Hiding', () => {
    let createdRequestId;

    test('successfully creates a blood request (201)', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Rahim Uddin',
          blood_group: 'A+',
          units_needed: 2,
          hospital_name: 'Square Hospital, Dhaka',
          latitude: 23.7533,
          longitude: 90.3814,
          city: 'Dhaka',
          urgency: 'CRITICAL',
          needed_by: new Date(Date.now() + 24 * 3600000).toISOString(),
          contact_phone: '+8801711223344',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request).toBeDefined();
      expect(res.body.data.request.status).toBe('OPEN');
      expect(res.body.data.request.units_needed).toBe(2);
      expect(res.body.data.request.blood_group).toBe('A+');
      expect(res.body.data.request.latitude).toBeCloseTo(23.7533, 4);
      expect(res.body.data.request.longitude).toBeCloseTo(90.3814, 4);
      expect(new Date(res.body.data.request.expires_at).getTime()).toBeGreaterThan(Date.now());

      createdRequestId = res.body.data.request.id;

      // Verify audit log
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity = 'blood_requests' AND entity_id = $1`,
        [createdRequestId]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].action).toBe('REQUEST_CREATED');
    });

    test('requester can view their own request with full contact details and matches', async () => {
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.is_contact_revealed).toBe(true);
      expect(res.body.data.request.contact_phone).toBe('+8801711223344');
      expect(Array.isArray(res.body.data.request.matches)).toBe(true);
    });

    test('admin can view any request with full contact details', async () => {
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.is_contact_revealed).toBe(true);
      expect(res.body.data.request.contact_phone).toBe('+8801711223344');
    });

    test('unrelated/unaccepted user sees masked contact details', async () => {
      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.is_contact_revealed).toBe(false);
      expect(res.body.data.request.contact_phone).toMatch(/\*\*\*\*/);
      expect(res.body.data.request.contact_phone).not.toBe('+8801711223344');
      expect(res.body.data.request.matches).toBeUndefined(); // internal matches hidden
    });

    test('donor with ACCEPTED match sees revealed contact details', async () => {
      // Simulate donor match with ACCEPTED status
      await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km)
         VALUES ($1, $2, 'ACCEPTED', 3.5)`,
        [createdRequestId, donorUserId]
      );

      const res = await request(app)
        .get(`/api/requests/${createdRequestId}`)
        .set('Authorization', `Bearer ${donorUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.is_contact_revealed).toBe(true);
      expect(res.body.data.request.contact_phone).toBe('+8801711223344');
      expect(res.body.data.request.my_match).toBeDefined();
      expect(res.body.data.request.my_match.status).toBe('ACCEPTED');
    });

    test('GET /api/requests/mine lists user requests', async () => {
      const res = await request(app)
        .get('/api/requests/mine')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.requests)).toBe(true);
      expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.requests[0].id).toBe(createdRequestId);
      expect(res.body.data.requests[0].accepted_count).toBe(1); // 1 donor accepted
    });

    test('unauthorized user cannot cancel another user request (403)', async () => {
      const res = await request(app)
        .post(`/api/requests/${createdRequestId}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Forbidden/);
    });

    test('requester can cancel their request', async () => {
      // Add a NOTIFIED match to verify it transitions to EXPIRED
      await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km)
         VALUES ($1, $2, 'NOTIFIED', 4.2)`,
        [createdRequestId, otherUserId]
      );

      const res = await request(app)
        .post(`/api/requests/${createdRequestId}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.status).toBe('CANCELLED');

      // Verify NOTIFIED match was expired
      const matchRes = await db.query(
        `SELECT status FROM request_matches WHERE request_id = $1 AND donor_id = $2`,
        [createdRequestId, otherUserId]
      );
      expect(matchRes.rows[0].status).toBe('EXPIRED');

      // Verify audit log
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity = 'blood_requests' AND entity_id = $1 AND action = 'REQUEST_CANCELLED'`,
        [createdRequestId]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    test('cancelling an already cancelled request returns 400', async () => {
      const res = await request(app)
        .post(`/api/requests/${createdRequestId}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Cannot cancel request in status "CANCELLED"/);
    });
  });

  describe('Rate Limiting & Safety Checks', () => {
    test('enforces rate limit of 3 requests per 24 hours', async () => {
      // Create user for rate limit test
      const rateUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rate Limit User',
          email: 'ratelimit@test.com',
          phone: '+8801711000099',
          password: 'Password123!',
        });
      const token = rateUserRes.body.data.accessToken;

      const payload = {
        patient_name: 'Patient Test',
        blood_group: 'O+',
        units_needed: 1,
        hospital_name: 'Apollo Hospital',
        latitude: 23.8103,
        longitude: 90.4125,
        urgency: 'NORMAL',
        needed_by: new Date(Date.now() + 48 * 3600000).toISOString(),
        contact_phone: '+8801711000099',
      };

      // 1st request -> ok
      const r1 = await request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send(payload);
      expect(r1.status).toBe(201);

      // 2nd request -> ok
      const r2 = await request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send(payload);
      expect(r2.status).toBe(201);

      // 3rd request -> ok
      const r3 = await request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send(payload);
      expect(r3.status).toBe(201);

      // 4th request -> 429 rate limit exceeded
      const r4 = await request(app).post('/api/requests').set('Authorization', `Bearer ${token}`).send(payload);
      expect(r4.status).toBe(429);
      expect(r4.body.error.message).toMatch(/Rate limit exceeded/);
    });

    test('blocked user cannot create blood requests (403)', async () => {
      // Create blocked user
      const blockedRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Blocked User',
          email: 'blocked@test.com',
          phone: '+8801711000088',
          password: 'Password123!',
        });
      const token = blockedRes.body.data.accessToken;
      const blockedId = blockedRes.body.data.user.id;
      await db.query(`UPDATE users SET is_blocked = TRUE WHERE id = $1`, [blockedId]);

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patient_name: 'Test',
          blood_group: 'O+',
          units_needed: 1,
          hospital_name: 'Hospital',
          latitude: 23.8103,
          longitude: 90.4125,
          urgency: 'NORMAL',
          needed_by: new Date(Date.now() + 48 * 3600000).toISOString(),
          contact_phone: '+8801711000088',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/blocked/);
    });
  });
});
