const inAppProvider = require('../providers/inAppProvider');
const emailProvider = require('../providers/emailProvider');
const smsProvider = require('../providers/smsProvider');
const pushProvider = require('../providers/pushProvider');
const telegramProvider = require('../providers/telegramProvider');
const db = require('../config/db');

const DEFAULT_CHANNELS = {
  'request.nearby': ['in_app', 'sms', 'email', 'push', 'telegram'],
  'donor.accepted': ['in_app', 'email', 'push', 'telegram'],
  'request.fulfilled': ['in_app', 'email', 'push'],
  'request.expired': ['in_app', 'email'],
  'request.cancelled': ['in_app'],
  'donation.reminder': ['in_app', 'sms'],
};

class NotificationDispatcher {
  /**
   * Helper to retrieve user's notification channel preferences
   */
  async getUserPreferences(userId) {
    if (!userId) return null;
    try {
      const res = await db.query(
        `SELECT in_app, email, sms, push FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn('[NotificationDispatcher] Could not fetch preferences, using defaults:', err.message);
      return null;
    }
  }

  /**
   * Dispatches a notification across all designated channels, respecting user preferences.
   */
  async dispatch({ type, userId, recipient = {}, payload = {}, channels = null }) {
    const rawChannels = channels || DEFAULT_CHANNELS[type] || ['in_app'];
    const prefs = await this.getUserPreferences(userId);

    // Filter channels based on user preferences
    const targetChannels = rawChannels.filter((ch) => {
      if (!prefs) return true;
      if (ch === 'in_app' && prefs.in_app === false) return false;
      if (ch === 'email' && prefs.email === false) return false;
      if (ch === 'sms' && prefs.sms === false) return false;
      if (ch === 'push' && prefs.push === false) return false;
      return true;
    });

    const results = {};

    for (const channel of targetChannels) {
      try {
        switch (channel) {
          case 'in_app':
            results.in_app = await inAppProvider.send({ userId, type, payload });
            break;

          case 'email':
            results.email = await emailProvider.send({ userId, type, payload, recipient });
            break;

          case 'sms':
            results.sms = await smsProvider.dispatch({ userId, type, payload, recipient });
            break;

          case 'push':
            results.push = await pushProvider.send({ userId, type, payload });
            break;

          case 'telegram':
            results.telegram = await telegramProvider.send({ userId, type, payload });
            break;

          default:
            console.warn(`[NotificationDispatcher] Unknown channel: ${channel}`);
        }
      } catch (err) {
        console.error(`[NotificationDispatcher] Channel ${channel} delivery error:`, err.message);
        results[channel] = { error: err.message };
      }
    }

    return {
      type,
      userId,
      channels: targetChannels,
      results,
    };
  }
}

module.exports = new NotificationDispatcher();
