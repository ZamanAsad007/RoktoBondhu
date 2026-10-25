const request = require('supertest');
const app = require('../src/app');
const { runMigrations } = require('../src/db/migrate');
const { pool } = require('../src/config/db');
const redis = require('../src/config/redis');
const { seedDonors } = require('../src/scripts/seedDonors');

describe('Donor Profiles Endpoints & Seed (Phase 2)', () => {
  let userToken;
  let userId;
  let userWithoutProfileToken;

  beforeAll(async () => {
    await runMigrations();

    // Register user 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Donor Tester',
        email: `donortest_${Date.now()}@example.com`,
        phone: `+88018${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
      });
    userToken = res1.body.data.accessToken;
    userId = res1.body.data.user.id;

    // Register user 2 (has no profile yet)
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'No Profile User',
        email: `noprofile_${Date.now()}@example.com`,
        phone: `+88019${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'Password123!',
      });
    userWithoutProfileToken = res2.body.data.accessToken;
  });

  afterAll(async () => {
    await pool.end();
    await redis.quit();
  });

  describe('PUT /api/donors/me', () => {
    it('should create a donor profile with valid blood group, DOB, and coordinates', async () => {
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'O+',
          date_of_birth: '1998-05-15',
          latitude: 23.7461,
          longitude: 90.3742,
          city: 'Dhaka',
          last_donated_at: '2024-01-10',
          available: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.profile.blood_group).toBe('O+');
      expect(res.body.data.profile.date_of_birth).toBe('1998-05-15');
      expect(parseFloat(res.body.data.profile.latitude)).toBeCloseTo(23.7461, 4);
      expect(parseFloat(res.body.data.profile.longitude)).toBeCloseTo(90.3742, 4);
      expect(res.body.data.profile.city).toBe('Dhaka');
      expect(res.body.data.profile.available).toBe(true);
    });

    it('should update existing profile (upsert behavior) without duplicating records', async () => {
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'O+',
          date_of_birth: '1998-05-15',
          latitude: 23.7925,
          longitude: 90.4078,
          city: 'Gulshan',
          last_donated_at: '2024-03-20',
          available: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.city).toBe('Gulshan');
      expect(res.body.data.profile.available).toBe(false);
      expect(parseFloat(res.body.data.profile.latitude)).toBeCloseTo(23.7925, 4);
    });

    it('should reject invalid blood group (400)', async () => {
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'INVALID',
          date_of_birth: '1998-05-15',
          latitude: 23.7461,
          longitude: 90.3742,
          city: 'Dhaka',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toBeDefined();
    });

    it('should reject under-age donor (<18 years old)', async () => {
      const today = new Date();
      const underAgeYear = today.getFullYear() - 16;
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'A+',
          date_of_birth: `${underAgeYear}-01-01`,
          latitude: 23.7461,
          longitude: 90.3742,
          city: 'Dhaka',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details[0].message).toMatch(/between 18 and 60/i);
    });

    it('should reject over-age donor (>60 years old)', async () => {
      const today = new Date();
      const overAgeYear = today.getFullYear() - 65;
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'B+',
          date_of_birth: `${overAgeYear}-01-01`,
          latitude: 23.7461,
          longitude: 90.3742,
          city: 'Dhaka',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid coordinates (e.g. latitude > 90)', async () => {
      const res = await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          blood_group: 'AB+',
          date_of_birth: '1995-01-01',
          latitude: 120.0,
          longitude: 90.3742,
          city: 'Dhaka',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/donors/me', () => {
    it('should return 404 if profile does not exist yet', async () => {
      const res = await request(app)
        .get('/api/donors/me')
        .set('Authorization', `Bearer ${userWithoutProfileToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return profile with user info for existing donor', async () => {
      const res = await request(app)
        .get('/api/donors/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.user_id).toBe(userId);
      expect(res.body.data.profile.blood_group).toBe('O+');
      expect(res.body.data.profile.latitude).toBeDefined();
      expect(res.body.data.profile.longitude).toBeDefined();
    });
  });

  describe('PATCH /api/donors/me/availability', () => {
    it('should toggle availability when body is empty', async () => {
      // Current availability was false from previous update
      const toggleRes = await request(app)
        .patch('/api/donors/me/availability')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.success).toBe(true);
      expect(toggleRes.body.data.profile.available).toBe(true);

      // Toggle again -> false
      const toggleRes2 = await request(app)
        .patch('/api/donors/me/availability')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(toggleRes2.status).toBe(200);
      expect(toggleRes2.body.data.profile.available).toBe(false);
    });

    it('should explicitly set availability when provided in body', async () => {
      const setRes = await request(app)
        .patch('/api/donors/me/availability')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ available: true });

      expect(setRes.status).toBe(200);
      expect(setRes.body.data.profile.available).toBe(true);
    });
  });

  describe('GET /api/donors/me/history', () => {
    it('should return history with donations and responses arrays', async () => {
      const res = await request(app)
        .get('/api/donors/me/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.donations)).toBe(true);
      expect(Array.isArray(res.body.data.responses)).toBe(true);
    });
  });

  describe('Donor Seed Script', () => {
    it('should run seedDonors and populate database with fake donors', async () => {
      const seedResult = await seedDonors(15);
      expect(seedResult.createdCount).toBe(15);

      // Verify donors are in database and queryable with PostGIS distance
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM donor_profiles WHERE city IN ('Dhanmondi', 'Gulshan', 'Banani', 'Uttara', 'Mirpur', 'Motijheel', 'Mohammadpur', 'Badda', 'Bashundhara', 'Old Dhaka');`
      );
      expect(parseInt(rows[0].count, 10)).toBeGreaterThanOrEqual(15);
    });
  });
});
