const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 18: Trust, Reliability Score & Smarter Matching', () => {
  let adminUser, requesterUser, donorUser;
  let adminToken, requesterToken, donorToken;
  let bloodRequestId;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@phase18.roktobondhu.org'");

    // 1. Admin
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Admin Reviewer', 'admin@phase18.roktobondhu.org', '+8801700980001', 'hash', 'ADMIN', true)
       RETURNING id, name, email, role;`
    );
    adminUser = adminRes.rows[0];
    adminToken = generateAccessToken(adminUser);

    // 2. Requester
    const reqRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Hospital Attendant', 'requester@phase18.roktobondhu.org', '+8801700980002', 'hash', 'USER', true)
       RETURNING id, name, email, role;`
    );
    requesterUser = reqRes.rows[0];
    requesterToken = generateAccessToken(requesterUser);

    // 3. Donor
    const donorRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Reliable Donor', 'donor@phase18.roktobondhu.org', '+8801700980003', 'hash', 'USER', true)
       RETURNING id, name, email, role;`
    );
    donorUser = donorRes.rows[0];
    donorToken = generateAccessToken(donorUser);

    await pool.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, available, location, city)
       VALUES ($1, 'A+', '1996-05-10', true, ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326)::geography, 'Dhaka')`,
      [donorUser.id]
    );

    // Create Blood Request
    const brRes = await pool.query(
      `INSERT INTO blood_requests (
         requester_id, patient_name, blood_group, units_needed,
         hospital_name, city, location, urgency, needed_by, expires_at, contact_phone, status
       )
       VALUES (
         $1, 'Patient Phase 18', 'A+', 1, 'Square Hospital', 'Dhaka',
         ST_SetSRID(ST_MakePoint(90.3800, 23.7500), 4326)::geography,
         'URGENT', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day', '+8801700980002', 'OPEN'
       )
       RETURNING id;`,
      [requesterUser.id]
    );
    bloodRequestId = brRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@phase18.roktobondhu.org'");
  });

  describe('Donor Availability Windows', () => {
    it('saves weekly availability windows for donor profile', async () => {
      const windows = [
        { day: 'monday', start: '18:00', end: '22:00' },
        { day: 'friday', start: '09:00', end: '18:00' },
      ];

      const res = await request(app)
        .put('/api/donors/me/availability-windows')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ windows });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availability_windows).toEqual(windows);
    });

    it('returns availability windows when retrieving donor profile', async () => {
      const res = await request(app)
        .get('/api/donors/me')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profile.availability_windows).toBeDefined();
      expect(res.body.data.profile.availability_windows.length).toBe(2);
    });
  });

  describe('Document Upload & Admin Verification for Blood Requests', () => {
    it('uploads a prescription/hospital slip verification document', async () => {
      // Create a temporary mock file
      const tempFilePath = path.join(__dirname, 'mock_slip.png');
      fs.writeFileSync(tempFilePath, 'fake image data for medical slip verification');

      try {
        const res = await request(app)
          .post(`/api/requests/${bloodRequestId}/verification-document`)
          .set('Authorization', `Bearer ${requesterToken}`)
          .attach('document', tempFilePath);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.request.verification_document_url).toContain('/uploads/verifications/');
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('allows Admin to approve verification for the request', async () => {
      const res = await request(app)
        .patch(`/api/admin/requests/${bloodRequestId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isVerified: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request.is_verified_request).toBe(true);
      expect(res.body.data.request.verified_at).toBeDefined();
    });

    it('displays verified request badge in request details', async () => {
      const res = await request(app)
        .get(`/api/requests/${bloodRequestId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.request.is_verified_request).toBe(true);
    });

    it('bypasses daily rate limit when requester has verified request', async () => {
      // Create 3 additional requests to hit rate limit
      for (let i = 1; i <= 3; i++) {
        await pool.query(
          `INSERT INTO blood_requests (
             requester_id, patient_name, blood_group, units_needed,
             hospital_name, city, location, urgency, needed_by, expires_at, contact_phone, status
           )
           VALUES (
             $1, $2, 'A+', 1, 'Hospital', 'Dhaka',
             ST_SetSRID(ST_MakePoint(90.3800, 23.7500), 4326)::geography,
             'NORMAL', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day', '+8801700980002', 'OPEN'
           );`,
          [requesterUser.id, `Rate Limit Test ${i}`]
        );
      }

      // Now create a 5th request: since requester has verified request, it succeeds!
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Rate Limit Bypassed Patient',
          blood_group: 'A+',
          units_needed: 1,
          hospital_name: 'Apollo Hospital',
          city: 'Dhaka',
          latitude: 23.8103,
          longitude: 90.4125,
          urgency: 'URGENT',
          needed_by: new Date(Date.now() + 86400000).toISOString(),
          contact_phone: '+8801700980002',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
