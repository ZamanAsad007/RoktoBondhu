const request = require('supertest');
const app = require('../src/app');
const { runMigrations } = require('../src/db/migrate');
const { pool } = require('../src/config/db');
const redis = require('../src/config/redis');

describe('Roles, Middleware & Mock Phone OTP (Phase 1)', () => {
  let regularUserToken;
  let regularUserId;
  let regularUserPhone;

  let adminUserToken;
  let adminUserId;

  beforeAll(async () => {
    await runMigrations();

    // Create a regular user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular Donor',
        email: `donor_${Date.now()}@example.com`,
        phone: `+88015${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
        role: 'USER',
      });
    regularUserToken = userRes.body.data.accessToken;
    regularUserId = userRes.body.data.user.id;
    regularUserPhone = userRes.body.data.user.phone;

    // Create an admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Super Admin',
        email: `admin_${Date.now()}@example.com`,
        phone: `+88014${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'AdminPassword123!',
        role: 'ADMIN',
      });
    adminUserToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.user.id;
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('Mock Phone OTP Flow', () => {
    it('should generate an OTP stored with TTL in Redis and log it', async () => {
      const sendOtpRes = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: regularUserPhone });

      expect(sendOtpRes.status).toBe(200);
      expect(sendOtpRes.body.success).toBe(true);
      expect(sendOtpRes.body.data.expiresIn).toBe(300);

      // Verify OTP key exists in Redis with TTL
      const key = `otp:${regularUserPhone.replace(/[^0-9+]/g, '')}`;
      const storedOtp = await redis.get(key);
      const ttl = await redis.ttl(key);

      expect(storedOtp).toBeDefined();
      expect(storedOtp.length).toBe(6);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should fail verification with incorrect OTP (400)', async () => {
      const res = await request(app)
        .post('/api/auth/verify-phone')
        .send({
          phone: regularUserPhone,
          otp: '000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid otp/i);
    });

    it('should verify OTP and update phone_verified to true', async () => {
      const key = `otp:${regularUserPhone.replace(/[^0-9+]/g, '')}`;
      const validOtp = await redis.get(key);

      const res = await request(app)
        .post('/api/auth/verify-phone')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          phone: regularUserPhone,
          otp: validOtp,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.user.phone_verified).toBe(true);

      // Verify OTP is removed from Redis after consumption
      const redisCheck = await redis.get(key);
      expect(redisCheck).toBeNull();
    });

    it('should fail verification if OTP has expired or was not requested', async () => {
      const res = await request(app)
        .post('/api/auth/verify-phone')
        .send({
          phone: '+8801999999999',
          otp: '123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/expired or was not requested/i);
    });
  });

  describe('requireAuth and requireRole Middleware', () => {
    it('should reject unauthenticated request to /api/auth/me (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should accept valid access token for /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(regularUserId);
    });

    it('should forbid regular USER from accessing ADMIN routes (403)', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${regularUserId}/block`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ isBlocked: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/insufficient permissions/i);
    });

    it('should allow ADMIN to block a user and prevent blocked user from accessing API', async () => {
      // Admin blocks regular user
      const blockRes = await request(app)
        .patch(`/api/admin/users/${regularUserId}/block`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ isBlocked: true });

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.success).toBe(true);
      expect(blockRes.body.data.user.is_blocked).toBe(true);

      // Blocked user tries to access /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(meRes.status).toBe(403);
      expect(meRes.body.success).toBe(false);
      expect(meRes.body.error.message).toMatch(/blocked/i);
    });
  });
});
