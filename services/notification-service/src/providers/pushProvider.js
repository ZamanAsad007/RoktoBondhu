const webpush = require('web-push');
const db = require('../config/db');
const config = require('../config');

// Initialize VAPID details if configured
if (config.vapid?.publicKey && config.vapid?.privateKey) {
  try {
    webpush.setVapidDetails(
      config.vapid.subject || 'mailto:support@roktobondhu.org',
      config.vapid.publicKey,
      config.vapid.privateKey
    );
  } catch (err) {
    console.warn('[PushProvider] VAPID configuration error:', err.message);
  }
}

class PushProvider {
  /**
   * Formats push notification payload based on type
   */
  formatPayload(type, payload = {}) {
    let title = '🚨 Emergency Blood Alert | রক্তবন্ধু';
    let body = 'A patient urgently needs blood near you.';
    let actions = undefined;

    switch (type) {
      case 'request.nearby':
        title = `🩸 Emergency ${payload.bloodGroup || 'Blood'} Needed!`;
        body = `Hospital: ${payload.hospitalName || 'Nearby Hospital'} • Needed: ${payload.unitsNeeded || 1} Bag(s)`;
        actions = [
          { action: 'accept', title: '✅ Accept' },
          { action: 'decline', title: '❌ Decline' },
        ];
        break;

      case 'donor.accepted':
        title = '🎉 Donor Accepted Your Request!';
        body = `${payload.donorName || 'A volunteer donor'} has agreed to donate blood for ${payload.patientName || 'your patient'}.`;
        break;

      case 'request.fulfilled':
        title = '✅ Blood Request Fulfilled';
        body = `All required units have been matched for ${payload.patientName || 'patient'}. Thank you!`;
        break;

      case 'request.cancelled':
        title = '⚠️ Blood Request Cancelled';
        body = `The blood request for ${payload.patientName || 'patient'} has been cancelled.`;
        break;

      default:
        body = payload.message || body;
    }

    return {
      title,
      body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      actions,
      url: payload.actionUrl || '/donor',
      matchId: payload.matchId,
      requestId: payload.requestId,
      timestamp: Date.now(),
    };
  }

  /**
   * Dispatches web push notifications to all user subscriptions
   */
  async send({ userId, type, payload = {} }) {
    if (!userId) {
      return { skipped: true, reason: 'No userId provided' };
    }

    // 1. Fetch user subscriptions
    const subRes = await db.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (subRes.rows.length === 0) {
      return { sent: 0, total: 0 };
    }

    const pushData = JSON.stringify(this.formatPayload(type, payload));
    let sentCount = 0;

    for (const sub of subRes.rows) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushData);
        sentCount++;
      } catch (err) {
        console.warn(`[PushProvider] Push send failed (${err.statusCode || err.message}) for subscription ${sub.id}`);
        // If expired or unsubscribed, prune subscription
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
        }
      }
    }

    return {
      sent: sentCount,
      total: subRes.rows.length,
    };
  }
}

module.exports = new PushProvider();
