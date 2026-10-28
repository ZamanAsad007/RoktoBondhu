const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const telegramRepository = require('../src/repositories/telegramRepository');
const telegramBotService = require('../src/services/telegramBotService');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 21: Telegram Bot Channel & Interactive Commands', () => {
  let user, donor;
  let userToken, donorToken;
  let bloodRequest, match;
  const mockChatId = 987654321;

  beforeAll(async () => {
    await db.query(`DELETE FROM users WHERE email IN ('tg_user@test.com', 'tg_donor@test.com')`);

    // Create requester
    const uRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Telegram Requester', 'tg_user@test.com', 'hash', '01719999000', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    user = uRes.rows[0];
    userToken = generateAccessToken(user);

    // Create donor
    const dRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Telegram Donor', 'tg_donor@test.com', 'hash', '01819999111', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    donor = dRes.rows[0];
    donorToken = generateAccessToken(donor);

    await db.query(
      `INSERT INTO donor_profiles (user_id, blood_group, date_of_birth, city, location, available)
       VALUES ($1, 'A+', '1995-05-15', 'Dhaka', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), TRUE)
       ON CONFLICT (user_id) DO UPDATE SET available = TRUE;`,
      [donor.id]
    );

    // Create blood request
    const bRes = await db.query(
      `INSERT INTO blood_requests 
       (requester_id, patient_name, blood_group, units_needed, hospital_name, location, city, urgency, needed_by, expires_at, contact_phone, status)
       VALUES ($1, 'Patient Telegram', 'A+', 1, 'Kurmitola General Hospital', ST_SetSRID(ST_MakePoint(90.4125, 23.8103), 4326), 'Dhaka', 'URGENT', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '1 day', '01719999000', 'OPEN')
       RETURNING id;`,
      [user.id]
    );
    bloodRequest = bRes.rows[0];

    // Create match in NOTIFIED status
    const mRes = await db.query(
      `INSERT INTO request_matches (request_id, donor_id, status, wave_number, distance_km)
       VALUES ($1, $2, 'NOTIFIED', 1, 2.0)
       RETURNING id;`,
      [bloodRequest.id, donor.id]
    );
    match = mRes.rows[0];
  });

  afterAll(async () => {
    if (bloodRequest?.id) {
      await db.query(`DELETE FROM request_matches WHERE request_id = $1`, [bloodRequest.id]);
      await db.query(`DELETE FROM blood_requests WHERE id = $1`, [bloodRequest.id]);
    }
    if (donor?.id) {
      await db.query(`DELETE FROM telegram_links WHERE user_id = $1`, [donor.id]);
      await db.query(`DELETE FROM donor_profiles WHERE user_id = $1`, [donor.id]);
      await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [user.id, donor.id]);
    }
  });

  it('1. GET /api/telegram/status initially returns unlinked', async () => {
    const res = await request(app)
      .get('/api/telegram/status')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isLinked).toBe(false);
  });

  it('2. POST /api/telegram/link-code generates a 6-digit one-time code', async () => {
    const res = await request(app)
      .post('/api/telegram/link-code')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.linkCode).toBeDefined();
    expect(res.body.data.linkCode).toMatch(/^\d{6}$/);
    expect(res.body.data.botUsername).toBeDefined();
  });

  it('3. Webhook /start <code> links Telegram account to donor', async () => {
    // Generate fresh code
    const codeRecord = await telegramRepository.generateLinkCode(donor.id);

    const update = {
      update_id: 1001,
      message: {
        message_id: 1,
        chat: { id: mockChatId, type: 'private' },
        from: { id: mockChatId, first_name: 'Telegram', username: 'tg_donor_user' },
        text: `/start ${codeRecord.link_code}`,
      },
    };

    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(update);

    expect(res.status).toBe(200);

    // Verify in db
    const link = await telegramRepository.getLinkByUserId(donor.id);
    expect(link).toBeDefined();
    expect(Number(link.telegram_chat_id)).toBe(mockChatId);
    expect(link.telegram_username).toBe('tg_donor_user');
    expect(link.is_active).toBe(true);

    // Verify GET /api/telegram/status
    const statusRes = await request(app)
      .get('/api/telegram/status')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(statusRes.body.data.isLinked).toBe(true);
    expect(statusRes.body.data.telegramUsername).toBe('tg_donor_user');
  });

  it('4. Webhook /status returns active status summary', async () => {
    const update = {
      update_id: 1002,
      message: {
        message_id: 2,
        chat: { id: mockChatId, type: 'private' },
        from: { id: mockChatId, username: 'tg_donor_user' },
        text: '/status',
      },
    };

    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(update);

    expect(res.status).toBe(200);
  });

  it('5. Webhook /pause pauses alerts and sets donor availability to false', async () => {
    const update = {
      update_id: 1003,
      message: {
        message_id: 3,
        chat: { id: mockChatId, type: 'private' },
        text: '/pause',
      },
    };

    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(update);

    expect(res.status).toBe(200);

    const link = await telegramRepository.getLinkByChatId(mockChatId);
    expect(link.is_active).toBe(false);

    const profile = await db.query(`SELECT available FROM donor_profiles WHERE user_id = $1`, [donor.id]);
    expect(profile.rows[0].available).toBe(false);
  });

  it('6. Webhook /resume reactivates alerts and sets donor availability to true', async () => {
    const update = {
      update_id: 1004,
      message: {
        message_id: 4,
        chat: { id: mockChatId, type: 'private' },
        text: '/resume',
      },
    };

    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(update);

    expect(res.status).toBe(200);

    const link = await telegramRepository.getLinkByChatId(mockChatId);
    expect(link.is_active).toBe(true);

    const profile = await db.query(`SELECT available FROM donor_profiles WHERE user_id = $1`, [donor.id]);
    expect(profile.rows[0].available).toBe(true);
  });

  it('7. Webhook callback query accept:<matchId> executes match acceptance', async () => {
    const update = {
      update_id: 1005,
      callback_query: {
        id: 'cb-12345',
        message: {
          message_id: 5,
          chat: { id: mockChatId },
        },
        from: { id: mockChatId },
        data: `accept:${match.id}`,
      },
    };

    const res = await request(app)
      .post('/api/telegram/webhook')
      .send(update);

    expect(res.status).toBe(200);

    // Verify match status in db transitioned to ACCEPTED
    const mCheck = await db.query(`SELECT status FROM request_matches WHERE id = $1`, [match.id]);
    expect(mCheck.rows[0].status).toBe('ACCEPTED');

    // Verify blood request status updated
    const reqCheck = await db.query(`SELECT status FROM blood_requests WHERE id = $1`, [bloodRequest.id]);
    expect(reqCheck.rows[0].status).toBe('FULFILLED');
  });

  it('8. POST /api/telegram/unlink removes Telegram connection', async () => {
    const res = await request(app)
      .post('/api/telegram/unlink')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const link = await telegramRepository.getLinkByUserId(donor.id);
    expect(link).toBeNull();
  });
});
