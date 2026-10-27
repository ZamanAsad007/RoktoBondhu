const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 15: Shareable Emergency Pages & SOS Escalation', () => {
  let requesterUser;
  let requesterToken;
  let otherUser;
  let otherToken;
  let testRequest;

  beforeAll(async () => {
    await runMigrations();

    await db.query(
      `DELETE FROM users WHERE email IN ('sos.requester@test.com', 'sos.stranger@test.com')`
    );

    const rRes = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('Emergency Requester', '+8801811223344', 'sos.requester@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    requesterUser = rRes.rows[0];
    requesterToken = generateAccessToken(requesterUser);

    const sRes = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('Unrelated Stranger', '+8801899001122', 'sos.stranger@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    otherUser = sRes.rows[0];
    otherToken = generateAccessToken(otherUser);
  });

  afterAll(async () => {
    if (requesterUser) {
      await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [requesterUser.id, otherUser.id]);
    }
  });

  it('creates blood request with generated share_token and default is_sos = false', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        patient_name: 'Confidential Patient',
        blood_group: 'B+',
        units_needed: 2,
        hospital_name: 'Dhaka Community Hospital',
        latitude: 23.8103,
        longitude: 90.4125,
        city: 'Dhaka',
        urgency: 'NORMAL',
        needed_by: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        contact_phone: '+8801811223344',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testRequest = res.body.data.request;
    expect(testRequest.share_token).toBeDefined();
    expect(testRequest.share_token.length).toBeGreaterThanOrEqual(8);
    expect(testRequest.is_sos).toBe(false);
  });

  it('GET /api/requests/share/:shareToken returns only safe info without private data', async () => {
    const res = await request(app).get(`/api/requests/share/${testRequest.share_token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const safeData = res.body.data.request;

    // Safe public fields
    expect(safeData.blood_group).toBe('B+');
    expect(safeData.units_needed).toBe(2);
    expect(safeData.hospital_name).toBe('Dhaka Community Hospital');
    expect(safeData.city).toBe('Dhaka');

    // Private fields MUST NOT be present
    expect(safeData.patient_name).toBeUndefined();
    expect(safeData.contact_phone).toBeUndefined();
    expect(safeData.latitude).toBeUndefined();
    expect(safeData.longitude).toBeUndefined();
  });

  it('GET /s/:shareToken returns server-rendered HTML with Open Graph tags', async () => {
    const res = await request(app).get(`/s/${testRequest.share_token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<meta property="og:title"');
    expect(res.text).toContain('<meta property="og:description"');
    expect(res.text).toContain('<meta property="og:url"');
    expect(res.text).toContain('B+');
    expect(res.text).toContain('Dhaka Community Hospital');
    // Ensure patient name and contact phone are NOT leaked in HTML
    expect(res.text).not.toContain('Confidential Patient');
    expect(res.text).not.toContain('+8801811223344');
  });

  it('POST /api/requests/:id/escalate sets is_sos, updates urgency, and records audit log', async () => {
    const res = await request(app)
      .post(`/api/requests/${testRequest.id}/escalate`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.request.is_sos).toBe(true);
    expect(res.body.data.request.urgency).toBe('CRITICAL');
    expect(res.body.data.request.escalated_at).toBeDefined();

    // Verify audit log entry
    const auditRes = await db.query(
      `SELECT * FROM audit_logs WHERE entity = 'blood_requests' AND entity_id = $1 AND action = 'REQUEST_ESCALATED'`,
      [testRequest.id]
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);
  });

  it('POST /api/requests/:id/escalate enforces rate-limiting on immediate re-escalation', async () => {
    const res = await request(app)
      .post(`/api/requests/${testRequest.id}/escalate`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(429);
    expect(res.body.error.message).toContain('rate-limited');
  });

  it('POST /api/requests/:id/escalate denies unauthorized stranger', async () => {
    const res = await request(app)
      .post(`/api/requests/${testRequest.id}/escalate`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
