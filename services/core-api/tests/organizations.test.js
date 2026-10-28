const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 17: Organizations, Blood Bank Inventory & Drives', () => {
  let adminUser, orgUser, donorUser;
  let adminToken, orgToken, donorToken;
  let organizationId, driveId;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email LIKE '%@roktobondhu.org'");

    // 1. Create Admin User
    const adminRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Admin Officer', 'orgadmin@roktobondhu.org', '+8801700999001', 'hash', 'ADMIN', true)
       RETURNING id, name, email, role;`
    );
    adminUser = adminRes.rows[0];
    adminToken = generateAccessToken(adminUser);

    // 2. Create Org User
    const orgRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Red Crescent Dhaka', 'redcrescent@roktobondhu.org', '+8801700999002', 'hash', 'ORG', true)
       RETURNING id, name, email, role;`
    );
    orgUser = orgRes.rows[0];
    orgToken = generateAccessToken(orgUser);

    // 3. Create Donor User
    const donorRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
       VALUES ('Drive Volunteer', 'volunteer@roktobondhu.org', '+8801700999003', 'hash', 'USER', true)
       RETURNING id, name, email, role;`
    );
    donorUser = donorRes.rows[0];
    donorToken = generateAccessToken(donorUser);

    // Donor profile
    await pool.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, available, location, city)
       VALUES ($1, 'O+', '1995-01-01', true, ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326)::geography, 'Dhaka')`,
      [donorUser.id]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [
      adminUser.id,
      orgUser.id,
      donorUser.id,
    ]);
  });

  describe('Organization Registration & Admin Verification', () => {
    it('allows ORG user to register an organization profile', async () => {
      const res = await request(app)
        .post('/api/organizations/register')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          orgName: 'Bangladesh Red Crescent Society',
          registrationNumber: 'BRCS-2026-DHAKA',
          contactEmail: 'bloodbank@bdrcs.org',
          contactPhone: '+8801700999002',
          address: '684-686 Bara Moghbazar, Dhaka',
          latitude: 23.7505,
          longitude: 90.4035,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.org_name).toBe('Bangladesh Red Crescent Society');
      expect(res.body.data.is_verified).toBe(false);
      organizationId = res.body.data.id;
    });

    it('allows Admin to verify the organization', async () => {
      const res = await request(app)
        .patch(`/api/admin/organizations/${organizationId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isVerified: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.is_verified).toBe(true);
    });

    it('retrieves my organization profile with verified badge', async () => {
      const res = await request(app)
        .get('/api/organizations/me')
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_verified).toBe(true);
      expect(res.body.data.registration_number).toBe('BRCS-2026-DHAKA');
    });
  });

  describe('Blood Bank Inventory CRUD & Low-Stock Alerts', () => {
    it('updates blood inventory units and triggers low stock alert when below threshold', async () => {
      const res = await request(app)
        .put('/api/organizations/inventory')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          bloodGroup: 'O+',
          unitsAvailable: 3,
          lowStockThreshold: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.units_available).toBe(3);
      expect(res.body.data.blood_group).toBe('O+');
    });

    it('adds normal inventory for other groups', async () => {
      await request(app)
        .put('/api/organizations/inventory')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          bloodGroup: 'A+',
          unitsAvailable: 15,
          lowStockThreshold: 5,
        });

      const res = await request(app).get(`/api/organizations/${organizationId}/inventory`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      const oPlus = res.body.data.find((item) => item.blood_group === 'O+');
      expect(oPlus.is_low_stock).toBe(true);
      const aPlus = res.body.data.find((item) => item.blood_group === 'A+');
      expect(aPlus.is_low_stock).toBe(false);
    });

    it('searches nearby blood banks via PostGIS and includes live inventory', async () => {
      const res = await request(app)
        .get('/api/organizations/nearby')
        .query({
          latitude: 23.7505,
          longitude: 90.4035,
          radiusKm: 10,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const bank = res.body.data.find((b) => b.id === organizationId);
      expect(bank).toBeDefined();
      expect(bank.is_verified).toBe(true);
      expect(bank.inventory.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Blood Drives with Capacity-Safe RSVP and Attendance', () => {
    it('creates an upcoming blood drive with limited capacity', async () => {
      const startTime = new Date(Date.now() + 3600000 * 24).toISOString();
      const endTime = new Date(Date.now() + 3600000 * 30).toISOString();

      const res = await request(app)
        .post('/api/organizations/drives')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          title: 'Dhanmondi Youth Blood Drive 2026',
          description: 'Emergency blood reserve drive organized with BDRCS',
          venueName: 'Dhanmondi Lake Amphitheatre',
          address: 'Road 8A, Dhanmondi, Dhaka',
          latitude: 23.7465,
          longitude: 90.3765,
          startTime,
          endTime,
          capacity: 1, // capacity set to 1 for capacity limit test
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.capacity).toBe(1);
      expect(res.body.data.rsvp_count).toBe(0);
      driveId = res.body.data.id;
    });

    it('allows a volunteer donor to RSVP to the blood drive', async () => {
      const res = await request(app)
        .post(`/api/organizations/drives/${driveId}/rsvp`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rsvp.status).toBe('CONFIRMED');
    });

    it('rejects another RSVP when capacity limit has been reached (concurrency safe)', async () => {
      // Create second donor
      const donor2Res = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
         VALUES ('Donor Overflow', 'donor2@roktobondhu.org', '+8801700999004', 'hash', 'USER', true)
         RETURNING id, name, email, role;`
      );
      const donor2Token = generateAccessToken(donor2Res.rows[0]);

      const res = await request(app)
        .post(`/api/organizations/drives/${driveId}/rsvp`)
        .set('Authorization', `Bearer ${donor2Token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('capacity has been reached');

      await pool.query(`DELETE FROM users WHERE id = $1`, [donor2Res.rows[0].id]);
    });

    it('lists nearby blood drives', async () => {
      const res = await request(app)
        .get('/api/organizations/drives/nearby')
        .query({
          latitude: 23.7465,
          longitude: 90.3765,
          radiusKm: 15,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const d = res.body.data.find((item) => item.id === driveId);
      expect(d).toBeDefined();
      expect(d.rsvp_count).toBe(1);
    });

    it('marks attendance and feeds into donations history and donor stats (Phase 14)', async () => {
      const res = await request(app)
        .patch(`/api/organizations/drives/${driveId}/attendees/${donorUser.id}/attend`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendance.status).toBe('ATTENDED');
      expect(res.body.data.donationId).toBeDefined();

      // Check stats updated for donor
      const statsRes = await pool.query(
        `SELECT donated_count FROM donor_stats WHERE user_id = $1`,
        [donorUser.id]
      );
      expect(statsRes.rows[0]).toBeDefined();
      expect(statsRes.rows[0].donated_count).toBeGreaterThanOrEqual(1);
    });

    it('triggers upcoming drive reminders', async () => {
      const res = await request(app)
        .post('/api/organizations/drives/reminders/trigger')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifiedCount).toBeDefined();
    });
  });
});
