const inAppProvider = require('../src/providers/inAppProvider');
const smsProvider = require('../src/providers/smsProvider');
const emailProvider = require('../src/providers/emailProvider');
const db = require('../src/config/db');

describe('Notification Channel Providers', () => {
  let testUserId;

  beforeAll(async () => {
    // Insert a dummy user for provider tests
    const userRes = await db.query(`
      INSERT INTO users (name, phone, email, password_hash, role)
      VALUES ('Provider Tester', '+8801999888777', 'providertest@example.com', 'dummyhash', 'USER')
      RETURNING id
    `);
    testUserId = userRes.rows[0].id;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.query('DELETE FROM notifications WHERE user_id = $1', [testUserId]);
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    await db.pool.end();
  });

  describe('InAppProvider', () => {
    it('should insert a notification record into PostgreSQL', async () => {
      const result = await inAppProvider.send({
        userId: testUserId,
        type: 'request.nearby',
        payload: {
          requestId: 'test-req',
          hospitalName: 'Apollo Hospital',
          bloodGroup: 'AB+',
        },
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.channel).toBe('in_app');
      expect(result.type).toBe('request.nearby');
      expect(result.status).toBe('sent');
      expect(result.payload.hospitalName).toBe('Apollo Hospital');
      expect(result.payload.title).toBeDefined();
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        inAppProvider.send({
          type: 'request.nearby',
          payload: {},
        })
      ).rejects.toThrow('userId is required');
    });
  });

  describe('SmsProvider (Mock)', () => {
    beforeEach(() => {
      smsProvider.clearHistory();
    });

    it('should log mock SMS and record in history', async () => {
      const result = await smsProvider.send({
        to: '+8801700000000',
        message: 'Test SMS from RoktoBondhu',
      });

      expect(result.success).toBe(true);
      expect(result.to).toBe('+8801700000000');
      expect(smsProvider.getSentMessages().length).toBe(1);
    });

    it('should dispatch SMS based on notification event', async () => {
      const result = await smsProvider.dispatch({
        userId: testUserId,
        type: 'donation.reminder',
        recipient: { phone: '+8801999888777' },
        payload: {
          hospitalName: 'Birdem General Hospital',
          patientName: 'Tareq',
        },
      });

      expect(result.success).toBe(true);
      expect(result.to).toBe('+8801999888777');
      expect(result.message).toContain('Birdem General Hospital');
    });
  });

  describe('EmailProvider', () => {
    it('should successfully deliver email to Mailpit', async () => {
      const result = await emailProvider.send({
        userId: testUserId,
        type: 'request.nearby',
        recipient: {
          name: 'Provider Tester',
          email: 'providertest@example.com',
        },
        payload: {
          bloodGroup: 'O-',
          hospitalName: 'Square Hospital',
          patientName: 'Tahmid',
          distanceKm: 2.1,
        },
      });

      expect(result.messageId).toBeDefined();
      expect(result.accepted).toContain('providertest@example.com');
      expect(result.subject).toContain('Square Hospital');
    });

    it('should skip gracefully if recipient has no email', async () => {
      const result = await emailProvider.send({
        type: 'request.nearby',
        payload: {},
      });

      expect(result.skipped).toBe(true);
    });
  });
});
