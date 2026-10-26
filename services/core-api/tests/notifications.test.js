const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { closeNotificationQueue } = require('../src/jobs/notificationQueue');
const notificationRepository = require('../src/repositories/notificationRepository');

describe('Notifications API Endpoints', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeAll(async () => {
    await runMigrations();

    const ts = Date.now();
    // Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'Notification Tester 1',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `notif1_${ts}@example.com`,
      password: 'Password123!',
    });
    user1Token = res1.body.data.accessToken;
    user1Id = res1.body.data.user.id;

    // Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'Notification Tester 2',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `notif2_${ts}@example.com`,
      password: 'Password123!',
    });
    user2Token = res2.body.data.accessToken;
    user2Id = res2.body.data.user.id;
  });

  afterAll(async () => {
    // Clean up notifications created by tests
    if (user1Id || user2Id) {
      await db.query('DELETE FROM notifications WHERE user_id IN ($1, $2)', [user1Id, user2Id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2)', [user1Id, user2Id]);
    }
    await closeNotificationQueue();
  });

  it('should return empty notifications list for new user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toEqual([]);
    expect(res.body.data.unread_count).toBe(0);
  });

  it('should return paginated notifications and accurate unread count', async () => {
    // Seed 3 notifications for user1
    await notificationRepository.create({
      userId: user1Id,
      channel: 'in_app',
      type: 'request.nearby',
      payload: { hospitalName: 'Hospital A', bloodGroup: 'O+' },
    });
    await notificationRepository.create({
      userId: user1Id,
      channel: 'in_app',
      type: 'donation.reminder',
      payload: { hospitalName: 'Hospital B', bloodGroup: 'O+' },
    });
    const readNotification = await notificationRepository.create({
      userId: user1Id,
      channel: 'in_app',
      type: 'request.fulfilled',
      payload: { hospitalName: 'Hospital C', bloodGroup: 'O+' },
    });
    // Mark one as read
    await db.query('UPDATE notifications SET read_at = NOW() WHERE id = $1', [readNotification.id]);

    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBe(3);
    expect(res.body.data.unread_count).toBe(2);
  });

  it('should filter unread notifications when unread_only=true', async () => {
    const res = await request(app)
      .get('/api/notifications?unread_only=true')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notifications.length).toBe(2);
    expect(res.body.data.notifications.every((n) => n.read_at === null)).toBe(true);
  });

  it('should mark a specific notification as read', async () => {
    const notif = await notificationRepository.create({
      userId: user1Id,
      channel: 'in_app',
      type: 'request.nearby',
      payload: { hospitalName: 'Test Hospital' },
    });

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.notification.read_at).not.toBeNull();
  });

  it('should deny marking another user notification as read with 403', async () => {
    const user2Notif = await notificationRepository.create({
      userId: user2Id,
      channel: 'in_app',
      type: 'request.nearby',
      payload: { hospitalName: 'User2 Hospital' },
    });

    const res = await request(app)
      .patch(`/api/notifications/${user2Notif.id}/read`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(403);
  });

  it('should mark all notifications as read', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.updated_count).toBeGreaterThan(0);

    const checkRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(checkRes.body.data.unread_count).toBe(0);
  });
});
