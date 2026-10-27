const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 14: Donor Stats, Badges & Certificates', () => {
  let donorUser;
  let donorToken;
  let requesterUser;
  let requesterToken;
  let requestId;
  let matchId;
  let donationId;

  beforeAll(async () => {
    await runMigrations();

    await db.query(
      `DELETE FROM users WHERE email IN ('rafiq.stats@test.com', 'hospital.requester@test.com', 'stranger@test.com')`
    );

    // 1. Create a donor user & profile
    const donorRes = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('Mohammad Rafiq', '+8801722334455', 'rafiq.stats@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    donorUser = donorRes.rows[0];
    donorToken = generateAccessToken(donorUser);

    await db.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, city, location, available)
       VALUES ($1, 'O+', '1995-05-15', 'Dhaka', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), true)`,
      [donorUser.id]
    );

    // 2. Create a requester user
    const reqRes = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('Hospital Requester', '+8801733445566', 'hospital.requester@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    requesterUser = reqRes.rows[0];
    requesterToken = generateAccessToken(requesterUser);

    // 3. Create a blood request & match
    const bloodReq = await db.query(
      `INSERT INTO blood_requests (requester_id, patient_name, blood_group, units_needed, hospital_name, city, location, urgency, status, contact_phone, needed_by, expires_at)
       VALUES ($1, 'Patient Jamal', 'O+', 1, 'Square Hospital', 'Dhaka', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'CRITICAL', 'OPEN', '+8801733445566', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day')
       RETURNING *`,
      [requesterUser.id]
    );
    requestId = bloodReq.rows[0].id;

    const matchRes = await db.query(
      `INSERT INTO request_matches (request_id, donor_id, status, wave_number, responded_at)
       VALUES ($1, $2, 'ACCEPTED', 1, NOW() - INTERVAL '5 minutes')
       RETURNING *`,
      [requestId, donorUser.id]
    );
    matchId = matchRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    if (donorUser) {
      await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [donorUser.id, requesterUser.id]);
    }
  });

  it('GET /api/donors/me/stats returns initial empty stats and unearned badges', async () => {
    const res = await request(app)
      .get('/api/donors/me/stats')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donatedCount).toBe(0);
    expect(res.body.data.currentStreak).toBe(0);
    expect(res.body.data.badges).toBeInstanceOf(Array);
    expect(res.body.data.badges.length).toBeGreaterThan(0);
    expect(res.body.data.isEligibleNow).toBe(true);
  });

  it('PUT /api/donors/me/leaderboard-opt-in updates leaderboard visibility', async () => {
    const res = await request(app)
      .put('/api/donors/me/leaderboard-opt-in')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ showOnLeaderboard: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.showOnLeaderboard).toBe(true);
  });

  it('POST /api/requests/:id/matches/:matchId/confirm-donation updates stats, awards badges and issues certificate', async () => {
    const res = await request(app)
      .post(`/api/requests/${requestId}/matches/${matchId}/confirm-donation`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donation.confirmed_by_requester).toBe(true);
    expect(res.body.data.donation.certificate_no).toBeDefined();
    expect(res.body.data.donation.certificate_no).toMatch(/^RB-\d{8}-[A-Z0-9]+$/);
    donationId = res.body.data.donation.id;

    // Verify stats were updated
    const statsRes = await request(app)
      .get('/api/donors/me/stats')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.donatedCount).toBe(1);
    expect(statsRes.body.data.currentStreak).toBe(1);
    expect(statsRes.body.data.daysUntilEligible).toBeGreaterThan(0);
    expect(statsRes.body.data.isEligibleNow).toBe(false);

    // Verify badges earned: FIRST_DONATION and LIFE_SAVER (since request was CRITICAL)
    const earned = statsRes.body.data.badges.filter((b) => b.isEarned);
    const earnedCodes = earned.map((b) => b.code);
    expect(earnedCodes).toContain('FIRST_DONATION');
    expect(earnedCodes).toContain('LIFE_SAVER');
  });

  it('GET /api/leaderboard includes opted-in donor with anonymized name', async () => {
    const res = await request(app).get('/api/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);

    const found = res.body.data.find((d) => d.displayName.startsWith('Mohammad'));
    expect(found).toBeDefined();
    expect(found.displayName).toBe('Mohammad R.');
    expect(found.city).toBe('Dhaka');
    expect(found.donatedCount).toBe(1);
  });

  it('GET /api/donations/:id/certificate streams PDF certificate to authorized donor', async () => {
    const res = await request(app)
      .get(`/api/donations/${donationId}/certificate`)
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('RoktoBondhu-Certificate-');
    expect(res.body).toBeDefined();
  });

  it('GET /api/donations/:id/certificate denies unauthorized users', async () => {
    // Create random stranger user
    const strangerRes = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('Stranger Danger', '+8801799887766', 'stranger@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    const strangerToken = generateAccessToken(strangerRes.rows[0]);

    const res = await request(app)
      .get(`/api/donations/${donationId}/certificate`)
      .set('Authorization', `Bearer ${strangerToken}`);

    expect(res.status).toBe(403);
    await db.query(`DELETE FROM users WHERE id = $1`, [strangerRes.rows[0].id]);
  });
});
