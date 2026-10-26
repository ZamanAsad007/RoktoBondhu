const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');
const { runMigrations } = require('../src/db/migrate');
const bloodRequestRepository = require('../src/repositories/bloodRequestRepository');
const { generateAccessToken } = require('../src/utils/token');
const { hashPassword } = require('../src/utils/password');
const { closeMatchingQueue } = require('../src/jobs/matchingQueue');

describe('Accept / Decline Flow & Concurrency Protection (Phase 6)', () => {
  let requesterToken;
  let requesterId;
  let donor1, donor2, donor3;
  let dummyPasswordHash;

  beforeAll(async () => {
    await runMigrations();

    await db.query(`
      DELETE FROM audit_logs;
      DELETE FROM donations;
      DELETE FROM request_matches;
      DELETE FROM blood_requests;
      DELETE FROM refresh_tokens;
      DELETE FROM donor_profiles;
      DELETE FROM users;
    `);

    dummyPasswordHash = await hashPassword('Password123!');

    // 1. Create Requester
    const reqRes = await request(app).post('/api/auth/register').send({
      name: 'Requester Main',
      email: 'req_accept@test.com',
      phone: '+8801700000100',
      password: 'Password123!',
    });
    requesterToken = reqRes.body.data.accessToken;
    requesterId = reqRes.body.data.user.id;

    // Helper to create donor
    async function setupDonor(name, email, phone) {
      const uRes = await db.query(
        `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
         VALUES ($1, $2, $3, $4, 'USER', TRUE)
         RETURNING id, name, email, phone, role`,
        [name, email, phone, dummyPasswordHash]
      );
      const user = uRes.rows[0];
      const token = generateAccessToken(user);

      await db.query(
        `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, location, city, available)
         VALUES ($1, 'O+', '1995-05-15', ST_SetSRID(ST_MakePoint(90.3780, 23.7508), 4326)::geography, 'Dhaka', TRUE)`,
        [user.id]
      );

      return { userId: user.id, token };
    }

    donor1 = await setupDonor('Donor 1', 'd1_acc@test.com', '+8801700000101');
    donor2 = await setupDonor('Donor 2', 'd2_acc@test.com', '+8801700000102');
    donor3 = await setupDonor('Donor 3', 'd3_acc@test.com', '+8801700000103');
  });

  afterAll(async () => {
    await closeMatchingQueue();
    await db.pool.end();
    await redis.quit();
  });

  describe('Transactional Accept and Decline Flow', () => {
    let bloodRequest;
    let match1Id, match2Id, match3Id;

    beforeEach(async () => {
      // Clean request and matches between tests
      await db.query(`DELETE FROM audit_logs; DELETE FROM request_matches; DELETE FROM blood_requests;`);

      // Create a 2-unit request
      bloodRequest = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Accept Test Patient',
        bloodGroup: 'O+',
        unitsNeeded: 2,
        hospitalName: 'Dhaka Medical College Hospital',
        latitude: 23.7259,
        longitude: 90.3973,
        city: 'Dhaka',
        urgency: 'URGENT',
        neededBy: new Date(Date.now() + 24 * 3600000).toISOString(),
        contactPhone: '+8801700000100',
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      });

      // Insert NOTIFIED matches for donor1, donor2, donor3
      const m1 = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
         VALUES ($1, $2, 'NOTIFIED', 1.5, 1) RETURNING id`,
        [bloodRequest.id, donor1.userId]
      );
      match1Id = m1.rows[0].id;

      const m2 = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
         VALUES ($1, $2, 'NOTIFIED', 2.1, 1) RETURNING id`,
        [bloodRequest.id, donor2.userId]
      );
      match2Id = m2.rows[0].id;

      const m3 = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
         VALUES ($1, $2, 'NOTIFIED', 3.0, 1) RETURNING id`,
        [bloodRequest.id, donor3.userId]
      );
      match3Id = m3.rows[0].id;
    });

    test('donor can accept match; request transitions to PARTIALLY_FULFILLED on first accept', async () => {
      const res = await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.match.status).toBe('ACCEPTED');
      expect(res.body.data.match.responded_at).toBeDefined();
      expect(res.body.data.request.status).toBe('PARTIALLY_FULFILLED');

      // Check audit log
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'MATCH_ACCEPTED'`,
        [match1Id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.is_fulfilled).toBe(false);
    });

    test('accepting second unit transitions request to FULFILLED and auto-expires leftover NOTIFIED matches', async () => {
      // First accept (1 of 2)
      await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      // Second accept (2 of 2) -> fulfills request!
      const res = await request(app)
        .post(`/api/matches/${match2Id}/accept`)
        .set('Authorization', `Bearer ${donor2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.match.status).toBe('ACCEPTED');
      expect(res.body.data.request.status).toBe('FULFILLED');

      // Leftover match (donor3) must have been auto-expired
      const leftoverRes = await db.query(
        `SELECT status FROM request_matches WHERE id = $1`,
        [match3Id]
      );
      expect(leftoverRes.rows[0].status).toBe('EXPIRED');
    });

    test('donor attempting to accept when request is already fulfilled receives 409 Conflict', async () => {
      // Accept both needed units
      await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);
      await request(app)
        .post(`/api/matches/${match2Id}/accept`)
        .set('Authorization', `Bearer ${donor2.token}`);

      // Now donor 3 tries to accept
      const res = await request(app)
        .post(`/api/matches/${match3Id}/accept`)
        .set('Authorization', `Bearer ${donor3.token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Conflict/);
    });

    test('donor cannot accept someone else match (403)', async () => {
      const res = await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor2.token}`); // donor2 trying to accept match1

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Forbidden/);
    });

    test('donor cannot accept the same match twice (400)', async () => {
      await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      const res = await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/already accepted/);
    });

    test('donor with active accepted request elsewhere is blocked from accepting another request (409)', async () => {
      // donor1 accepts match1
      await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      // Create another open request
      const secondReq = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Another Patient',
        bloodGroup: 'O+',
        unitsNeeded: 1,
        hospitalName: 'Another Hospital',
        latitude: 23.7508,
        longitude: 90.3780,
        city: 'Dhaka',
        urgency: 'NORMAL',
        neededBy: new Date(Date.now() + 24 * 3600000).toISOString(),
        contactPhone: '+8801700000100',
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      });

      const mOther = await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
         VALUES ($1, $2, 'NOTIFIED', 1.0, 1) RETURNING id`,
        [secondReq.id, donor1.userId]
      );
      const otherMatchId = mOther.rows[0].id;

      // Donor 1 attempts to accept second request while first is still in progress
      const res = await request(app)
        .post(`/api/matches/${otherMatchId}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/active accepted blood donation in progress/);
    });

    test('donor can decline match; audit log recorded and status set to DECLINED', async () => {
      const res = await request(app)
        .post(`/api/matches/${match1Id}/decline`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.match.status).toBe('DECLINED');

      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'MATCH_DECLINED'`,
        [match1Id]
      );
      expect(auditRes.rows.length).toBe(1);

      // Declining again -> 400
      const declineAgainRes = await request(app)
        .post(`/api/matches/${match1Id}/decline`)
        .set('Authorization', `Bearer ${donor1.token}`);
      expect(declineAgainRes.status).toBe(400);
    });

    test('GET /api/matches/mine returns donor matches with appropriate privacy masking', async () => {
      // donor1 accepts match1
      await request(app)
        .post(`/api/matches/${match1Id}/accept`)
        .set('Authorization', `Bearer ${donor1.token}`);

      const res = await request(app)
        .get('/api/matches/mine')
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.matches)).toBe(true);
      expect(res.body.data.matches.length).toBe(1);

      const m = res.body.data.matches[0];
      expect(m.match_status).toBe('ACCEPTED');
      expect(m.is_contact_revealed).toBe(true);
      expect(m.contact_phone).toBe('+8801700000100'); // Revealed!

      // Donor 2 has NOT accepted yet; contact must be masked
      const res2 = await request(app)
        .get('/api/matches/mine')
        .set('Authorization', `Bearer ${donor2.token}`);

      expect(res2.status).toBe(200);
      const m2 = res2.body.data.matches[0];
      expect(m2.is_contact_revealed).toBe(false);
      expect(m2.contact_phone).toMatch(/\*\*\*\*/); // Masked!
    });
  });

  describe('Concurrency Stress Test: 20 Parallel Accepts for a 2-Unit Request', () => {
    test(
      'exactly 2 parallel accepts succeed with 200, exactly 18 return 409 Conflict',
      async () => {
        await db.query(`DELETE FROM audit_logs; DELETE FROM request_matches; DELETE FROM blood_requests;`);

        // 1. Create a 2-unit request
        const urgentRequest = await bloodRequestRepository.createRequest({
          requesterId,
          patientName: 'Concurrency Test Patient',
          bloodGroup: 'O+',
          unitsNeeded: 2,
          hospitalName: 'Apollo Hospital Dhaka',
          latitude: 23.8103,
          longitude: 90.4125,
          city: 'Dhaka',
          urgency: 'CRITICAL',
          neededBy: new Date(Date.now() + 12 * 3600000).toISOString(),
          contactPhone: '+8801700000100',
          expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        });

        // 2. Batch provision 20 distinct verified donors and NOTIFIED matches directly in DB
        const donorCount = 20;
        const donors = [];

        for (let i = 1; i <= donorCount; i++) {
          const phone = `+88018${String(i).padStart(8, '0')}`;
          const email = `conc_donor_${i}@test.com`;

          const uRes = await db.query(
            `INSERT INTO users (name, email, phone, password_hash, role, phone_verified)
             VALUES ($1, $2, $3, $4, 'USER', TRUE)
             ON CONFLICT (email) DO UPDATE SET phone_verified = TRUE
             RETURNING id, role`,
            [`Concurrent Donor ${i}`, email, phone, dummyPasswordHash]
          );
          const userId = uRes.rows[0].id;
          const token = generateAccessToken({ id: userId, role: 'USER' });

          await db.query(
            `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, location, city, available)
             VALUES ($1, 'O+', '1995-05-15', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326)::geography, 'Dhaka', TRUE)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
          );

          const matchRes = await db.query(
            `INSERT INTO request_matches (request_id, donor_id, status, distance_km, wave_number)
             VALUES ($1, $2, 'NOTIFIED', $3, 1) RETURNING id`,
            [urgentRequest.id, userId, (i * 0.1).toFixed(2)]
          );

          donors.push({
            userId,
            token,
            matchId: matchRes.rows[0].id,
          });
        }

        expect(donors).toHaveLength(20);

        // 3. Fire all 20 accepts at the exact same moment via Promise.all
        const responses = await Promise.all(
          donors.map((d) =>
            request(app)
              .post(`/api/matches/${d.matchId}/accept`)
              .set('Authorization', `Bearer ${d.token}`)
          )
        );

        // 4. Assert response statuses
        const successResponses = responses.filter((r) => r.status === 200);
        const conflictResponses = responses.filter((r) => r.status === 409);

        // EXACTLY 2 must succeed!
        expect(successResponses.length).toBe(2);

        // EXACTLY 18 must receive 409 Conflict!
        expect(conflictResponses.length).toBe(18);

        conflictResponses.forEach((r) => {
          expect(r.body.error.message).toMatch(/Conflict/);
        });

        // 5. Database invariants check: exactly 2 matches have status ACCEPTED
        const acceptedMatchesRes = await db.query(
          `SELECT * FROM request_matches WHERE request_id = $1 AND status = 'ACCEPTED'`,
          [urgentRequest.id]
        );
        expect(acceptedMatchesRes.rows.length).toBe(2);

        // Blood request is FULFILLED
        const requestRes = await bloodRequestRepository.findById(urgentRequest.id);
        expect(requestRes.status).toBe('FULFILLED');
        expect(requestRes.accepted_count).toBe(2);

        // The remaining 18 matches are EXPIRED (auto-expired on fulfillment)
        const nonAcceptedMatchesRes = await db.query(
          `SELECT status, COUNT(*)::int AS count
           FROM request_matches
           WHERE request_id = $1 AND status != 'ACCEPTED'
           GROUP BY status`,
          [urgentRequest.id]
        );
        const expiredCount =
          nonAcceptedMatchesRes.rows.find((r) => r.status === 'EXPIRED')?.count || 0;
        expect(expiredCount).toBe(18);
      },
      30000
    );
  });
});
