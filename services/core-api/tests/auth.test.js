const request = require('supertest');
const app = require('../src/app');
const { runMigrations } = require('../src/db/migrate');
const { pool } = require('../src/config/db');
const redis = require('../src/config/redis');

describe('Auth Endpoints (Phase 1)', () => {
  const timestamp = Date.now();
  const testUser = {
    name: 'Rahim Uddin',
    email: `rahim_${timestamp}@example.com`,
    phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
  };

  let registeredTokens = {};

  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return tokens', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.user.phone).toBe(testUser.phone);
      expect(res.body.data.user.role).toBe('USER');
      expect(res.body.data.user.phone_verified).toBe(false);
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      registeredTokens = {
        accessToken: res.body.data.accessToken,
        refreshToken: res.body.data.refreshToken,
      };
    });

    it('should return 409 conflict when registering with same email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: testUser.email,
          phone: `+88018${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('should return 409 conflict when registering with same phone', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: `unique_${Date.now()}@example.com`,
          phone: testUser.phone,
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('should fail validation with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Email',
          email: 'not-an-email',
          phone: '+8801912345678',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toBeDefined();
    });

    it('should fail validation with password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password',
          email: `short_${Date.now()}@example.com`,
          phone: `+88016${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with email and correct password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should login with phone number as identifier', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.phone,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should fail login with incorrect password (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid credentials/i);
    });

    it('should fail login with non-existent user (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh & /api/auth/logout', () => {
    let currentRefreshToken;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      currentRefreshToken = loginRes.body.data.refreshToken;
    });

    it('should rotate refresh token and issue new access token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(currentRefreshToken);

      // Old token should now be revoked
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.success).toBe(false);
    });

    it('should logout and revoke refresh token', async () => {
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: currentRefreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Now trying to refresh with logged-out token must fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });
});
