const inAppProvider = require('../providers/inAppProvider');
const emailProvider = require('../providers/emailProvider');
const smsProvider = require('../providers/smsProvider');

const DEFAULT_CHANNELS = {
  'request.nearby': ['in_app', 'sms', 'email'],
  'donor.accepted': ['in_app', 'email'],
  'request.fulfilled': ['in_app', 'email'],
  'request.expired': ['in_app', 'email'],
  'request.cancelled': ['in_app'],
  'donation.reminder': ['in_app', 'sms'],
};

class NotificationDispatcher {
  /**
   * Dispatches a notification across all designated channels.
   */
  async dispatch({ type, userId, recipient = {}, payload = {}, channels = null }) {
    const targetChannels = channels || DEFAULT_CHANNELS[type] || ['in_app'];
    const results = {};

    for (const channel of targetChannels) {
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

        default:
          console.warn(`[NotificationDispatcher] Unknown channel: ${channel}`);
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
