const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');
const { runMigrations } = require('../src/db/migrate');
const matchingRepository = require('../src/repositories/matchingRepository');
const bloodRequestRepository = require('../src/repositories/bloodRequestRepository');
const {
  processRunWave,
  processExpandWave,
  processExpireRequest,
  closeMatchingQueue,
} = require('../src/jobs/matchingQueue');

describe('Matching Query & Wave Jobs (Phase 5)', () => {
  let requesterToken;
  let requesterId;
  let eligibleDonor1Token;
  let eligibleDonor1Id;
  let eligibleDonor2Id;
  let farDonorId;
  let incompatibleDonorId;
  let unavailableDonorId;
  let unverifiedDonorId;
  let blockedDonorId;
  let cooldownDonorId;
  let busyDonorId;

  // Center point: Dhanmondi 32, Dhaka (23.7508, 90.3780)
  const centerLat = 23.7508;
  const centerLng = 90.3780;

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

    // 1. Requester (needs A+ blood)
    const reqRes = await request(app).post('/api/auth/register').send({
      name: 'Requester',
      email: 'req_match@test.com',
      phone: '+8801700000001',
      password: 'Password123!',
    });
    requesterToken = reqRes.body.data.accessToken;
    requesterId = reqRes.body.data.user.id;

    // Helper to create donor
    async function createDonorUser({ name, email, phone, bloodGroup, lat, lng, available = true, phoneVerified = true, isBlocked = false, lastDonatedAt = null, dob = '1995-01-01' }) {
      const uRes = await request(app).post('/api/auth/register').send({
        name,
        email,
        phone,
        password: 'Password123!',
      });
      const userId = uRes.body.data.user.id;
      const token = uRes.body.data.accessToken;

      await db.query(`UPDATE users SET phone_verified = $2 WHERE id = $1`, [
        userId,
        Boolean(phoneVerified),
      ]);
      if (isBlocked) {
        await db.query(`UPDATE users SET is_blocked = TRUE WHERE id = $1`, [userId]);
      }

      await request(app)
        .put('/api/donors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          blood_group: bloodGroup,
          date_of_birth: dob,
          latitude: lat,
          longitude: lng,
          city: 'Dhaka',
          last_donated_at: lastDonatedAt,
        });

      if (!available) {
        await request(app)
          .patch('/api/donors/me/availability')
          .set('Authorization', `Bearer ${token}`)
          .send({ available: false });
      }

      return { userId, token };
    }

    // 2. Eligible Donor 1: Close (~1 km away), blood A+, available, verified
    const d1 = await createDonorUser({
      name: 'Eligible Donor 1',
      email: 'd1@test.com',
      phone: '+8801700000002',
      bloodGroup: 'A+',
      lat: 23.7540,
      lng: 90.3800,
    });
    eligibleDonor1Id = d1.userId;
    eligibleDonor1Token = d1.token;

    // 3. Eligible Donor 2: Medium distance (~3.5 km away), blood O- (universal donor), available
    const d2 = await createDonorUser({
      name: 'Eligible Donor 2 (O-)',
      email: 'd2@test.com',
      phone: '+8801700000003',
      bloodGroup: 'O-',
      lat: 23.7300,
      lng: 90.3900,
    });
    eligibleDonor2Id = d2.userId;

    // 4. Far Donor: Outside 5 km ring, inside 10 km ring (~8 km away, Uttara-bound)
    const dFar = await createDonorUser({
      name: 'Far Donor (8km)',
      email: 'dfar@test.com',
      phone: '+8801700000004',
      bloodGroup: 'A-',
      lat: 23.8200,
      lng: 90.4100,
    });
    farDonorId = dFar.userId;

    // 5. Incompatible Blood Group Donor: B+ (incompatible for A+ recipient)
    const dIncomp = await createDonorUser({
      name: 'Incompatible Donor (B+)',
      email: 'dincomp@test.com',
      phone: '+8801700000005',
      bloodGroup: 'B+',
      lat: 23.7520,
      lng: 90.3790,
    });
    incompatibleDonorId = dIncomp.userId;

    // 6. Unavailable Donor
    const dUnavail = await createDonorUser({
      name: 'Unavailable Donor',
      email: 'dunavail@test.com',
      phone: '+8801700000006',
      bloodGroup: 'A+',
      lat: 23.7510,
      lng: 90.3785,
      available: false,
    });
    unavailableDonorId = dUnavail.userId;

    // 7. Unverified Phone Donor
    const dUnver = await createDonorUser({
      name: 'Unverified Donor',
      email: 'dunver@test.com',
      phone: '+8801700000007',
      bloodGroup: 'A+',
      lat: 23.7515,
      lng: 90.3782,
      phoneVerified: false,
    });
    unverifiedDonorId = dUnver.userId;

    // 8. Blocked Donor
    const dBlock = await createDonorUser({
      name: 'Blocked Donor',
      email: 'dblock@test.com',
      phone: '+8801700000008',
      bloodGroup: 'A+',
      lat: 23.7512,
      lng: 90.3781,
      isBlocked: true,
    });
    blockedDonorId = dBlock.userId;

    // 9. Cooldown Donor: donated 20 days ago (< 90 days)
    const recentDate = new Date(Date.now() - 20 * 24 * 3600000).toISOString().slice(0, 10);
    const dCool = await createDonorUser({
      name: 'Cooldown Donor',
      email: 'dcool@test.com',
      phone: '+8801700000009',
      bloodGroup: 'A+',
      lat: 23.7518,
      lng: 90.3784,
      lastDonatedAt: recentDate,
    });
    cooldownDonorId = dCool.userId;

    // 10. Busy Donor: will have an active ACCEPTED match on another open request
    const dBusy = await createDonorUser({
      name: 'Busy Donor',
      email: 'dbusy@test.com',
      phone: '+8801700000010',
      bloodGroup: 'A+',
      lat: 23.7519,
      lng: 90.3783,
    });
    busyDonorId = dBusy.userId;
  });

  afterAll(async () => {
    await closeMatchingQueue();
    await db.pool.end();
    await redis.quit();
  });

  describe('PostGIS Geolocation Matching Query', () => {
    let testRequestId;

    beforeAll(async () => {
      // Create request needing A+ blood
      const req = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Test Patient',
        bloodGroup: 'A+',
        unitsNeeded: 2,
        hospital_name: 'Labaid Hospital Dhanmondi',
        latitude: centerLat,
        longitude: centerLng,
        city: 'Dhaka',
        urgency: 'CRITICAL',
        neededBy: new Date(Date.now() + 12 * 3600000).toISOString(),
        contactPhone: '+8801700000001',
        expiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
      });
      testRequestId = req.id;

      // Create an open request elsewhere and mark busyDonor as ACCEPTED on it
      const otherReq = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Other Patient',
        bloodGroup: 'A+',
        unitsNeeded: 1,
        hospital_name: 'Other Hospital',
        latitude: centerLat,
        longitude: centerLng,
        city: 'Dhaka',
        urgency: 'NORMAL',
        neededBy: new Date(Date.now() + 24 * 3600000).toISOString(),
        contactPhone: '+8801700000001',
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      });
      await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km)
         VALUES ($1, $2, 'ACCEPTED', 1.0)`,
        [otherReq.id, busyDonorId]
      );
    });

    test('finds only compatible and eligible donors within 5 km ring ordered by distance', async () => {
      const donors = await matchingRepository.findEligibleDonorsForRequest({
        requestId: testRequestId,
        radiusKm: 5,
        limit: 10,
      });

      const donorIds = donors.map((d) => d.donor_id);

      // Should include d1 and d2 (O- is compatible with A+)
      expect(donorIds).toContain(eligibleDonor1Id);
      expect(donorIds).toContain(eligibleDonor2Id);

      // Closest donor must be first (d1 ~0.4 km, d2 ~3.5 km)
      expect(donors[0].donor_id).toBe(eligibleDonor1Id);
      expect(parseFloat(donors[0].distance_km)).toBeLessThan(parseFloat(donors[1].distance_km));

      // Should EXCLUDE:
      expect(donorIds).not.toContain(farDonorId);            // > 5km
      expect(donorIds).not.toContain(incompatibleDonorId);   // B+ incompatible with A+
      expect(donorIds).not.toContain(unavailableDonorId);    // available = false
      expect(donorIds).not.toContain(unverifiedDonorId);     // phone not verified
      expect(donorIds).not.toContain(blockedDonorId);        // user blocked
      expect(donorIds).not.toContain(cooldownDonorId);       // last donated < 90 days ago
      expect(donorIds).not.toContain(busyDonorId);           // has active accepted match
      expect(donorIds).not.toContain(requesterId);           // requester cannot donate to self
    });

    test('expanding radius to 10 km includes farther donors', async () => {
      const donors = await matchingRepository.findEligibleDonorsForRequest({
        requestId: testRequestId,
        radiusKm: 10,
        limit: 10,
      });

      const donorIds = donors.map((d) => d.donor_id);
      expect(donorIds).toContain(farDonorId); // ~8km away now included
    });
  });

  describe('Wave Processing and Radius Expansion Jobs', () => {
    let waveRequestId;

    beforeEach(async () => {
      // Clear matches for wave test
      await db.query(`DELETE FROM request_matches; DELETE FROM blood_requests;`);

      // Ensure busyDonor has an active accepted match on a separate open request
      const busyReq = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Busy Check Request',
        bloodGroup: 'A+',
        unitsNeeded: 1,
        hospitalName: 'Busy Hospital',
        latitude: centerLat,
        longitude: centerLng,
        urgency: 'NORMAL',
        neededBy: new Date(Date.now() + 24 * 3600000).toISOString(),
        contactPhone: '+8801700000001',
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      });
      await db.query(
        `INSERT INTO request_matches (request_id, donor_id, status, distance_km)
         VALUES ($1, $2, 'ACCEPTED', 1.0)`,
        [busyReq.id, busyDonorId]
      );

      const req = await bloodRequestRepository.createRequest({
        requesterId,
        patientName: 'Wave Patient',
        bloodGroup: 'A+',
        unitsNeeded: 3,
        hospitalName: 'Ibn Sina Hospital',
        latitude: centerLat,
        longitude: centerLng,
        city: 'Dhaka',
        urgency: 'URGENT',
        neededBy: new Date(Date.now() + 24 * 3600000).toISOString(),
        contactPhone: '+8801700000001',
        expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      });
      waveRequestId = req.id;
    });

    test('processRunWave creates NOTIFIED matches and logs WAVE_DISPATCHED audit log', async () => {
      const result = await processRunWave(waveRequestId);

      expect(result.status).toBe('WAVE_PROCESSED');
      expect(result.waveNumber).toBe(1);
      expect(result.matchesCreated).toBe(2); // d1 and d2 inside 5 km

      // Verify matches in DB
      const matchesRes = await db.query(
        `SELECT * FROM request_matches WHERE request_id = $1 ORDER BY distance_km ASC`,
        [waveRequestId]
      );
      expect(matchesRes.rows.length).toBe(2);
      expect(matchesRes.rows[0].status).toBe('NOTIFIED');
      expect(matchesRes.rows[0].donor_id).toBe(eligibleDonor1Id);
      expect(matchesRes.rows[1].donor_id).toBe(eligibleDonor2Id);

      // Verify audit log
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'WAVE_DISPATCHED'`,
        [waveRequestId]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.wave_number).toBe(1);
    });

    test('processExpandWave advances radius ring and notifies additional donors', async () => {
      // First wave (5 km ring) -> notifies d1 and d2
      await processRunWave(waveRequestId);

      // Trigger expand-wave -> should advance radius from 5 km to 10 km, increment wave_number to 2
      const expandResult = await processExpandWave(waveRequestId);

      expect(expandResult.status).toBe('WAVE_PROCESSED');
      expect(expandResult.waveNumber).toBe(2);
      expect(expandResult.radiusKm).toBe(10);
      expect(expandResult.matchesCreated).toBe(1); // Far donor (farDonorId) now notified

      // Check request state updated
      const updatedReq = await bloodRequestRepository.findById(waveRequestId);
      expect(updatedReq.current_radius_km).toBe(10);
      expect(updatedReq.wave_number).toBe(2);

      // Total matches should now be 3 (d1, d2, and farDonor)
      const allMatches = await db.query(
        `SELECT * FROM request_matches WHERE request_id = $1`,
        [waveRequestId]
      );
      expect(allMatches.rows.length).toBe(3);

      // Check audit log for RADIUS_EXPANDED
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'RADIUS_EXPANDED'`,
        [waveRequestId]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.new_radius_km).toBe(10);
    });

    test('processExpireRequest marks request EXPIRED and expires pending NOTIFIED matches', async () => {
      await processRunWave(waveRequestId);

      const expireResult = await processExpireRequest(waveRequestId);
      expect(expireResult.status).toBe('EXPIRED');

      // Request status is EXPIRED
      const req = await bloodRequestRepository.findById(waveRequestId);
      expect(req.status).toBe('EXPIRED');

      // Pending NOTIFIED matches are now EXPIRED
      const matchesRes = await db.query(
        `SELECT status FROM request_matches WHERE request_id = $1`,
        [waveRequestId]
      );
      expect(matchesRes.rows.length).toBe(2);
      matchesRes.rows.forEach((m) => expect(m.status).toBe('EXPIRED'));

      // Check audit log
      const auditRes = await db.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'REQUEST_EXPIRED'`,
        [waveRequestId]
      );
      expect(auditRes.rows.length).toBe(1);
    });
  });

  describe('Integration: Request Creation First Wave & GET /api/requests/nearby', () => {
    test('POST /api/requests automatically runs first matching wave', async () => {
      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          patient_name: 'Auto Wave Patient',
          blood_group: 'A+',
          units_needed: 2,
          hospital_name: 'Square Hospital',
          latitude: centerLat,
          longitude: centerLng,
          urgency: 'CRITICAL',
          needed_by: new Date(Date.now() + 6 * 3600000).toISOString(),
          contact_phone: '+8801700000001',
        });

      expect(res.status).toBe(201);
      const reqId = res.body.data.request.id;

      // Verify matches were immediately created for wave 1
      const matchesRes = await db.query(
        `SELECT * FROM request_matches WHERE request_id = $1`,
        [reqId]
      );
      expect(matchesRes.rows.length).toBeGreaterThanOrEqual(2);
    });

    test('GET /api/requests/nearby returns nearby open compatible requests for donor', async () => {
      // Eligible Donor 1 (A+) calls /api/requests/nearby
      const res = await request(app)
        .get('/api/requests/nearby?radius_km=10')
        .set('Authorization', `Bearer ${eligibleDonor1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.requests)).toBe(true);
      expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);

      const firstReq = res.body.data.requests[0];
      expect(firstReq.distance_km).toBeDefined();
      expect(parseFloat(firstReq.distance_km)).toBeLessThanOrEqual(10);
      expect(['A+', 'AB+']).toContain(firstReq.blood_group); // A+ donor can donate to A+ or AB+
    });
  });
});
