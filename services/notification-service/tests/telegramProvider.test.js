const telegramProvider = require('../src/providers/telegramProvider');
const notificationDispatcher = require('../src/services/notificationDispatcher');
const db = require('../src/config/db');

describe('Phase 21: Notification Service Telegram Provider', () => {
  let testUser;

  beforeAll(async () => {
    await db.query(`DELETE FROM users WHERE email = 'tg_notif_test@test.com'`);
    const uRes = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ('Telegram Notif User', 'tg_notif_test@test.com', 'hash', '01712999777', 'USER')
       RETURNING id;`
    );
    testUser = uRes.rows[0];

    // Link telegram
    await db.query(
      `INSERT INTO telegram_links (user_id, telegram_chat_id, telegram_username, is_active)
       VALUES ($1, 777888999, 'tg_notif_user', TRUE)
       ON CONFLICT (user_id) DO UPDATE SET telegram_chat_id = 777888999, is_active = TRUE;`,
      [testUser.id]
    );
  });

  afterAll(async () => {
    if (testUser?.id) {
      await db.query(`DELETE FROM telegram_links WHERE user_id = $1`, [testUser.id]);
      await db.query(`DELETE FROM users WHERE id = $1`, [testUser.id]);
    }
  });

  it('telegramProvider.send sends formatted markdown with inline keyboard buttons', async () => {
    const res = await telegramProvider.send({
      userId: testUser.id,
      type: 'request.nearby',
      payload: {
        bloodGroup: 'O-',
        patientName: 'Sakib',
        hospitalName: 'Square Hospital',
        unitsNeeded: 1,
        distanceKm: 3.5,
        matchId: 'match-xyz',
      },
    });

    expect(res.sent).toBe(true);
    expect(Number(res.chatId)).toBe(777888999);
    expect(res.text).toContain('EMERGENCY BLOOD REQUEST');
    expect(res.text).toContain('Square Hospital');
    expect(res.replyMarkup.inline_keyboard[0]).toHaveLength(2);
    expect(res.replyMarkup.inline_keyboard[0][0].callback_data).toBe('accept:match-xyz');
    expect(res.replyMarkup.inline_keyboard[0][1].callback_data).toBe('decline:match-xyz');
  });

  it('notificationDispatcher dispatches to telegram channel when designated', async () => {
    const result = await notificationDispatcher.dispatch({
      type: 'request.nearby',
      userId: testUser.id,
      channels: ['telegram'],
      payload: {
        bloodGroup: 'A+',
        hospitalName: 'United Hospital',
        matchId: 'match-abc',
      },
    });

    expect(result.channels).toContain('telegram');
    expect(result.results.telegram.sent).toBe(true);
  });
});
