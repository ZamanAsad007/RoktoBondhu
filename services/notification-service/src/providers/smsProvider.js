const db = require('../config/db');
const { renderSms } = require('../templates/notificationTemplates');

class SmsProvider {
  constructor() {
    this.sentMessages = [];
  }

  /**
   * Mock SMS provider interface as specified in Section 7.
   * Can be swapped for Twilio, Infobip, or local SMS gateway later.
   */
  async send({ to, message }) {
    const record = {
      to,
      message,
      sentAt: new Date().toISOString(),
    };

    console.log(`[MOCK SMS] To: ${to} | Message: "${message}"`);
    this.sentMessages.push(record);

    return {
      success: true,
      to,
      message,
      provider: 'mock',
    };
  }

  /**
   * Helper that dispatches an SMS for a notification event.
   */
  async dispatch({ userId, type, payload = {}, recipient = {} }) {
    let phone = recipient.phone;

    if (!phone && userId) {
      const userRes = await db.query('SELECT phone FROM users WHERE id = $1', [userId]);
      if (userRes.rows[0]) {
        phone = userRes.rows[0].phone;
      }
    }

    if (!phone) {
      return { skipped: true, reason: 'No phone number available' };
    }

    const { message } = renderSms(type, payload);
    const result = await this.send({ to: phone, message });

    if (userId) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, channel, type, payload, status, created_at)
           VALUES ($1, 'sms', $2, $3, 'sent', NOW())`,
          [userId, type, JSON.stringify({ to: phone, message })]
        );
      } catch (err) {
        console.error('[SmsProvider] Failed to log sms delivery:', err.message);
      }
    }

    return result;
  }

  getSentMessages() {
    return [...this.sentMessages];
  }

  clearHistory() {
    this.sentMessages = [];
  }
}

module.exports = new SmsProvider();
