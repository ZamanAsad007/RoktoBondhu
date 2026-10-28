const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const preferenceRepository = require('../src/repositories/preferenceRepository');
const pushRepository = require('../src/repositories/pushRepository');
const { generateAccessToken } = require('../src/utils/token');

describe('Phase 20: Web Push & Notification Preferences API', () => {
  let user;
  let token;

  beforeAll(async () => {
    await db.query(`DELETE FROM users WHERE email = 'push_user@test.com'`);
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Push User', 'push_user@test.com', 'hash', '01712999888', 'USER')
       RETURNING id, name, email, phone, role;`
    );
    user = res.rows[0];
    token = generateAccessToken(user);
  });

  afterAll(async () => {
    if (user?.id) {
      await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [user.id]);
      await db.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [user.id]);
      await db.query(`DELETE FROM users WHERE id = $1`, [user.id]);
    }
  });

  it('GET /api/notifications/vapid-public-key returns configured VAPID key', async () => {
    const res = await request(app)
      .get('/api/notifications/vapid-public-key')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.publicKey).toBeDefined();
    expect(typeof res.body.data.publicKey).toBe('string');
  });

  it('POST /api/notifications/push/subscribe stores subscription', async () => {
    const subscriptionPayload = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-token',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0P43CXHgJa2keW60RBLScGO8VD2fsqY',
        auth: 'tBHItJI5svbpLvNuhStggA',
      },
    };

    const res = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send(subscriptionPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscription.endpoint).toBe(subscriptionPayload.endpoint);

    // Verify in db
    const subs = await pushRepository.getSubscriptionsByUserId(user.id);
    expect(subs.length).toBe(1);
    expect(subs[0].endpoint).toBe(subscriptionPayload.endpoint);
  });

  it('POST /api/notifications/push/unsubscribe removes subscription', async () => {
    const res = await request(app)
      .post('/api/notifications/push/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const subs = await pushRepository.getSubscriptionsByUserId(user.id);
    expect(subs.length).toBe(0);
  });

  it('GET /api/notifications/preferences returns defaults when no row exists', async () => {
    const res = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.in_app).toBe(true);
    expect(res.body.data.email).toBe(true);
    expect(res.body.data.sms).toBe(false);
    expect(res.body.data.push).toBe(true);
  });

  it('PUT /api/notifications/preferences updates channel preferences', async () => {
    const res = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        in_app: true,
        email: false,
        sms: true,
        push: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(false);
    expect(res.body.data.sms).toBe(true);
    expect(res.body.data.push).toBe(false);

    // Verify via GET
    const getRes = await request(app)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.data.email).toBe(false);
    expect(getRes.body.data.sms).toBe(true);
    expect(getRes.body.data.push).toBe(false);
  });
});
