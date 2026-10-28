const db = require('../config/db');
const config = require('../config');

class TelegramProvider {
  constructor() {
    this.botToken = config.telegram?.botToken || 'mock_telegram_bot_token';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Dispatches Telegram notification with inline action buttons
   */
  async send({ userId, type, payload = {} }) {
    if (!userId) {
      return { skipped: true, reason: 'No userId provided' };
    }

    // 1. Fetch active linked telegram chat for user
    const linkRes = await db.query(
      `SELECT telegram_chat_id, telegram_username 
       FROM telegram_links 
       WHERE user_id = $1 AND is_active = TRUE AND telegram_chat_id IS NOT NULL`,
      [userId]
    );

    if (linkRes.rows.length === 0) {
      return { skipped: true, reason: 'No active Telegram link for user' };
    }

    const { telegram_chat_id: chatId } = linkRes.rows[0];

    // 2. Format message and inline buttons
    let text = `🚨 *RoktoBondhu Notification*\n\n${payload.message || 'You have an emergency update.'}`;
    let replyMarkup = undefined;

    if (type === 'request.nearby') {
      text = `🩸 *EMERGENCY BLOOD REQUEST*\n\n` +
             `Patient: *${payload.patientName || 'Patient'}*\n` +
             `Blood Group: *${payload.bloodGroup || 'Urgent'}*\n` +
             `Units: *${payload.unitsNeeded || 1} Bag(s)*\n` +
             `Hospital: *${payload.hospitalName || 'Hospital'}*\n` +
             `Distance: ~${payload.distanceKm || '?'} km away\n\n` +
             `Can you donate to save this life?`;

      if (payload.matchId) {
        replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Accept', callback_data: `accept:${payload.matchId}` },
              { text: '❌ Decline', callback_data: `decline:${payload.matchId}` },
            ],
          ],
        };
      }
    } else if (type === 'donor.accepted') {
      text = `🎉 *Donor Found!*\n\nA volunteer donor (*${payload.donorName || 'Volunteer'}*) has accepted the request for ${payload.patientName || 'your patient'}!`;
    } else if (type === 'request.fulfilled') {
      text = `✅ *Blood Request Fulfilled*\n\nAll units have been successfully matched. Thank you!`;
    }

    // 3. Send message via Telegram API (or mock in test/dev mode)
    if (!this.botToken || this.botToken.startsWith('mock_') || process.env.NODE_ENV === 'test') {
      return {
        sent: true,
        mock: true,
        chatId,
        text,
        replyMarkup,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
        }),
      });
      const data = await response.json();
      return {
        sent: data.ok,
        chatId,
        messageId: data.result?.message_id,
      };
    } catch (err) {
      console.error('[TelegramProvider] Send error:', err.message);
      return { sent: false, error: err.message };
    }
  }
}

module.exports = new TelegramProvider();
