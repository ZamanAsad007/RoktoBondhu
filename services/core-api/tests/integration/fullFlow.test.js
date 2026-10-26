const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { runMigrations } = require('../../src/db/migrate');
const { closeMatchingQueue } = require('../../src/jobs/matchingQueue');
const { closeNotificationQueue } = require('../../src/jobs/notificationQueue');
const matchingRepository = require('../../src/repositories/matchingRepository');

describe('End-to-End Integration: Request to Fulfillment Flow (Phase 11)', () => {
  let requesterToken, requesterId;
  let donor1Token, donor1Id, donor1MatchId;
  let donor2Token, donor2Id, donor2MatchId;
  let donor3Token, donor3Id;
  let requestId;

  beforeAll(async () => {
    await runMigrations();

    // Clean test data
    await db.query(`
      DELETE FROM audit_logs;
      DELETE FROM reports;
      DELETE FROM notifications;
      DELETE FROM donations;
      DELETE FROM request_matches;
      DELETE FROM blood_requests;
      DELETE FROM refresh_tokens;
      DELETE FROM donor_profiles;
      DELETE FROM users;
    `);

    // 1. Register Requester
    const reqRes = await request(app).post('/api/auth/register').send({
      name: 'Emergency Requester',
      phone: '+8801711000100',
      email: 'requester_flow@test.com',
      password: 'Password123!',
    });
    requesterToken = reqRes.body.data.accessToken;
    requesterId = reqRes.body.data.user.id;

    // 2. Register Donor 1 (Close: ~3 km away)
    const d1Res = await request(app).post('/api/auth/register').send({
      name: 'Donor Close One',
      phone: '+8801711000101',
      email: 'donor1_flow@test.com',
      password: 'Password123!',
    });
    donor1Token = d1Res.body.data.accessToken;
    donor1Id = d1Res.body.data.user.id;
    await db.query(`UPDATE users SET phone_verified = true WHERE id = $1`, [donor1Id]);
    await db.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, available, location, city)
       VALUES ($1, 'O+', '1995-01-01', true, ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'Dhaka')`,
      [donor1Id]
    );

    // 3. Register Donor 2 (Medium: ~4 km away)
    const d2Res = await request(app).post('/api/auth/register').send({
      name: 'Donor Close Two',
      phone: '+8801711000102',
      email: 'donor2_flow@test.com',
      password: 'Password123!',
    });
    donor2Token = d2Res.body.data.accessToken;
    donor2Id = d2Res.body.data.user.id;
    await db.query(`UPDATE users SET phone_verified = true WHERE id = $1`, [donor2Id]);
    await db.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, available, location, city)
       VALUES ($1, 'O+', '1996-02-02', true, ST_SetSRID(ST_MakePoint(90.4200, 23.8200), 4326), 'Dhaka')`,
      [donor2Id]
    );

    // 4. Register Donor 3 (Further: ~9 km away)
    const d3Res = await request(app).post('/api/auth/register').send({
      name: 'Donor Far Three',
      phone: '+8801711000103',
      email: 'donor3_flow@test.com',
      password: 'Password123!',
    });
    donor3Token = d3Res.body.data.accessToken;
    donor3Id = d3Res.body.data.user.id;
    await db.query(`UPDATE users SET phone_verified = true WHERE id = $1`, [donor3Id]);
    await db.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, available, location, city)
       VALUES ($1, 'O+', '1994-03-03', true, ST_SetSRID(ST_MakePoint(90.4800, 23.8800), 4326), 'Dhaka')`,
      [donor3Id]
    );
  });

  afterAll(async () => {
    await closeMatchingQueue();
    await closeNotificationQueue();
    await db.query(`
      DELETE FROM audit_logs;
      DELETE FROM donations;
      DELETE FROM request_matches;
      DELETE FROM blood_requests;
      DELETE FROM refresh_tokens;
      DELETE FROM donor_profiles;
      DELETE FROM users;
    `);
  });

  it('Step 1: Requester creates a 2-unit CRITICAL blood request', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        patient_name: 'Anika Tabassum',
        blood_group: 'O+',
        units_needed: 2,
        hospital_name: 'Dhaka Medical College Hospital',
        city: 'Dhaka',
        latitude: 23.8103,
        longitude: 90.4125,
        urgency: 'CRITICAL',
        needed_by: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        contact_phone: '+8801711000100',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    requestId = res.body.data.request.id;
    expect(res.body.data.request.status).toBe('OPEN');
    expect(res.body.data.request.units_needed).toBe(2);
    expect(res.body.data.request.wave_number).toBe(1);
    expect(res.body.data.request.current_radius_km).toBe(5);
  });

  it('Step 2: Wave 1 matching notifies closest compatible donors within 5 km', async () => {
    // Find created matches for the request
    const matchesRes = await db.query(
      `SELECT * FROM request_matches WHERE request_id = $1 ORDER BY distance_km ASC`,
      [requestId]
    );

    expect(matchesRes.rows.length).toBeGreaterThanOrEqual(2);
    const donor1Match = matchesRes.rows.find((m) => m.donor_id === donor1Id);
    const donor2Match = matchesRes.rows.find((m) => m.donor_id === donor2Id);

    expect(donor1Match).toBeDefined();
    expect(donor2Match).toBeDefined();
    expect(donor1Match.status).toBe('NOTIFIED');
    expect(donor2Match.status).toBe('NOTIFIED');

    donor1MatchId = donor1Match.id;
    donor2MatchId = donor2Match.id;
  });

  it('Step 3: Donor 1 accepts invitation -> request transitions to PARTIALLY_FULFILLED', async () => {
    const res = await request(app)
      .post(`/api/matches/${donor1MatchId}/accept`)
      .set('Authorization', `Bearer ${donor1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.match.status).toBe('ACCEPTED');
    expect(res.body.data.request.status).toBe('PARTIALLY_FULFILLED');

    // Verify contact revelation: Donor 1 can now view requester contact phone
    const feedRes = await request(app)
      .get('/api/matches/mine')
      .set('Authorization', `Bearer ${donor1Token}`);

    const matches = feedRes.body.data.matches || feedRes.body.data;
    const myMatch = matches.find((m) => m.match_id === donor1MatchId);
    expect(myMatch.is_contact_revealed).toBe(true);
    expect(myMatch.contact_phone).toBe('+8801711000100');
  });

  it('Step 4: Donor 2 accepts invitation -> request transitions to FULFILLED', async () => {
    const res = await request(app)
      .post(`/api/matches/${donor2MatchId}/accept`)
      .set('Authorization', `Bearer ${donor2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.match.status).toBe('ACCEPTED');
    expect(res.body.data.request.status).toBe('FULFILLED');

    // Requester verifies both donors appear in request detail with contact phones
    const reqDetail = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(reqDetail.status).toBe(200);
    expect(reqDetail.body.data.request.status).toBe('FULFILLED');
    const accepted = reqDetail.body.data.request.matches.filter((m) => m.status === 'ACCEPTED');
    expect(accepted.length).toBe(2);
    expect(accepted.some((m) => m.donor_phone === '+8801711000101')).toBe(true);
    expect(accepted.some((m) => m.donor_phone === '+8801711000102')).toBe(true);
  });

  it('Step 5: Over-subscription is prevented with 409 Conflict once request is FULFILLED', async () => {
    // If a late match existed or was attempted
    const fakeLateMatch = await db.query(
      `INSERT INTO request_matches (request_id, donor_id, status, wave_number)
       VALUES ($1, $2, 'NOTIFIED', 2)
       RETURNING id`,
      [requestId, donor3Id]
    );

    const res = await request(app)
      .post(`/api/matches/${fakeLateMatch.rows[0].id}/accept`)
      .set('Authorization', `Bearer ${donor3Token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Conflict: Blood request has already been fulfilled');
  });

  it('Step 6: Requester confirms donation -> records in donations table & updates last_donated_at', async () => {
    const res = await request(app)
      .post(`/api/requests/${requestId}/matches/${donor1MatchId}/confirm-donation`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.donation.confirmed_by_requester).toBe(true);
    expect(res.body.data.donation.donor_id).toBe(donor1Id);

    // Verify donor profile last_donated_at was updated
    const profileRes = await db.query(
      `SELECT last_donated_at FROM donor_profiles WHERE user_id = $1`,
      [donor1Id]
    );
    expect(profileRes.rows[0].last_donated_at).not.toBeNull();

    // Verify match status is DONATED
    const matchRes = await db.query(`SELECT status FROM request_matches WHERE id = $1`, [
      donor1MatchId,
    ]);
    expect(matchRes.rows[0].status).toBe('DONATED');
  });
});
