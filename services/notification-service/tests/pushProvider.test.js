const pushProvider = require('../src/providers/pushProvider');
const notificationDispatcher = require('../src/services/notificationDispatcher');
const db = require('../src/config/db');

describe('Phase 20: Notification Service Push Provider & Preferences', () => {
  let testUserId;

  beforeAll(async () => {
    await db.query(`DELETE FROM users WHERE email = 'notif_push@test.com'`);
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Notif Push User', 'notif_push@test.com', 'hash', '01712000111', 'USER')
       RETURNING id;`
    );
    testUserId = res.rows[0].id;

    // Set notification preferences: in_app = true, push = false, email = false
    await db.query(
      `INSERT INTO notification_preferences (user_id, in_app, email, sms, push)
       VALUES ($1, TRUE, FALSE, FALSE, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET in_app = TRUE, email = FALSE, sms = FALSE, push = FALSE;`,
      [testUserId]
    );
  });

  afterAll(async () => {
    if (testUserId) {
      await db.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [testUserId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    }
  });

  it('formatPayload produces valid push notification object with action buttons', () => {
    const formatted = pushProvider.formatPayload('request.nearby', {
      bloodGroup: 'B+',
      hospitalName: 'Dhaka Medical College',
      unitsNeeded: 2,
      matchId: 'match-123',
    });

    expect(formatted.title).toContain('B+');
    expect(formatted.body).toContain('Dhaka Medical College');
    expect(formatted.actions).toHaveLength(2);
    expect(formatted.actions[0].action).toBe('accept');
    expect(formatted.actions[1].action).toBe('decline');
  });

  it('filters out disabled channels (push, email, sms) based on user notification preferences', async () => {
    const result = await notificationDispatcher.dispatch({
      type: 'request.nearby',
      userId: testUserId,
      payload: { bloodGroup: 'B+', hospitalName: 'Dhaka Medical' },
      channels: ['in_app', 'sms', 'email', 'push'],
    });

    // Should only have 'in_app' since email, sms, and push are disabled in preferences
    expect(result.channels).toEqual(['in_app']);
    expect(result.results.in_app).toBeDefined();
    expect(result.results.push).toBeUndefined();
    expect(result.results.email).toBeUndefined();
  });
});
