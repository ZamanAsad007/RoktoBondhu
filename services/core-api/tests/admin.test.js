const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { closeNotificationQueue } = require('../src/jobs/notificationQueue');

describe('Admin & Safety Endpoints (Phase 10)', () => {
  let adminToken;
  let adminId;
  let normalUserToken;
  let normalUserId;
  let targetUserToken;
  let targetUserId;
  let testRequestId;

  beforeAll(async () => {
    await runMigrations();

    const ts = Date.now();

    // 1. Register Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'System Admin',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `admin_${ts}@example.com`,
      password: 'AdminPassword123!',
    });
    adminId = adminRes.body.data.user.id;
    // Elevate to ADMIN in database
    await db.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [adminId]);
    // Log back in to get token with ADMIN role
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: `admin_${ts}@example.com`,
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Register Normal User
    const userRes = await request(app).post('/api/auth/register').send({
      name: 'Regular Reporter',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `user_${ts}@example.com`,
      password: 'UserPassword123!',
    });
    normalUserToken = userRes.body.data.accessToken;
    normalUserId = userRes.body.data.user.id;

    // 3. Register Target User (to be blocked)
    const targetRes = await request(app).post('/api/auth/register').send({
      name: 'Spam Requester',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `target_${ts}@example.com`,
      password: 'TargetPassword123!',
    });
    targetUserToken = targetRes.body.data.accessToken;
    targetUserId = targetRes.body.data.user.id;

    // 4. Create a test request from normal user
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${normalUserToken}`)
      .send({
        patient_name: 'Test Patient',
        blood_group: 'O+',
        units_needed: 1,
        hospital_name: 'Dhaka Central Hospital',
        city: 'Dhaka',
        latitude: 23.8103,
        longitude: 90.4125,
        urgency: 'NORMAL',
        needed_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        contact_phone: '+8801712345678',
      });
    testRequestId = reqRes.body.data.request.id;
  });

  afterAll(async () => {
    await closeNotificationQueue();
    if (adminId || normalUserId || targetUserId) {
      await db.query('DELETE FROM reports WHERE reporter_id = $1 OR user_id = $2', [
        normalUserId,
        targetUserId,
      ]);
      await db.query('DELETE FROM blood_requests WHERE requester_id = $1', [normalUserId]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
        adminId,
        normalUserId,
        targetUserId,
      ]);
    }
  });

  describe('Admin Authorization Checks', () => {
    it('should deny non-admin users access to admin stats with 403', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should grant admin user access to admin stats with 200', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalRequests).toBeGreaterThanOrEqual(1);
      expect(res.body.data.stats.requestsPerDay).toBeDefined();
      expect(typeof res.body.data.stats.fulfillmentRate).toBe('number');
      expect(typeof res.body.data.stats.avgTimeToFirstAcceptMinutes).toBe('number');
    });

    it('should return all requests for admin with 200', async () => {
      const res = await request(app)
        .get('/api/admin/requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.requests)).toBe(true);
      expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Report Flow (POST /api/reports & Admin Review)', () => {
    let createdReportId;

    it('should allow a regular user to report a suspicious blood request', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          requestId: testRequestId,
          userId: targetUserId,
          reason: 'Suspected fake patient and spam phone number',
          details: 'User posted multiple conflicting hospital locations.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report).toBeDefined();
      expect(res.body.data.report.status).toBe('PENDING');
      createdReportId = res.body.data.report.id;
    });

    it('should allow admin to list all reports', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.reports)).toBe(true);
      const found = res.body.data.reports.find((r) => r.id === createdReportId);
      expect(found).toBeDefined();
      expect(found.reason).toContain('Suspected fake patient');
    });

    it('should allow admin to update report status to RESOLVED', async () => {
      const res = await request(app)
        .patch(`/api/admin/reports/${createdReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          resolutionNotes: 'Investigated. User verified fraudulent and blocked.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.report.status).toBe('RESOLVED');
      expect(res.body.data.report.resolution_notes).toContain('User verified fraudulent');
    });
  });

  describe('User Blocking & Enforcement', () => {
    it('should allow admin to block a abusive user', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUserId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isBlocked: true });

      expect(res.status).toBe(200);
      expect(res.body.data.user.is_blocked).toBe(true);
    });

    it('should block the user from making authenticated requests with 403', async () => {
      const res = await request(app)
        .get('/api/requests/mine')
        .set('Authorization', `Bearer ${targetUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Account is blocked');
    });

    it('should allow admin to unblock the user', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${targetUserId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isBlocked: false });

      expect(res.status).toBe(200);
      expect(res.body.data.user.is_blocked).toBe(false);

      // Verify unblocked user can now access API
      const checkRes = await request(app)
        .get('/api/requests/mine')
        .set('Authorization', `Bearer ${targetUserToken}`);

      expect(checkRes.status).toBe(200);
    });
  });
});
