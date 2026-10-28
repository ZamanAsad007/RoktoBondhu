const db = require('../config/db');

class PushRepository {
  /**
   * Save or update browser push subscription
   */
  async saveSubscription({ userId, endpoint, p256dh, auth }) {
    const query = `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        created_at = NOW()
      RETURNING *;
    `;
    const res = await db.query(query, [userId, endpoint, p256dh, auth]);
    return res.rows[0];
  }

  /**
   * Remove browser push subscription
   */
  async removeSubscription({ userId, endpoint }) {
    const query = `
      DELETE FROM push_subscriptions
      WHERE user_id = $1 AND endpoint = $2
      RETURNING *;
    `;
    const res = await db.query(query, [userId, endpoint]);
    return res.rows[0] || null;
  }

  /**
   * Get all active push subscriptions for a user
   */
  async getSubscriptionsByUserId(userId) {
    const query = `
      SELECT id, user_id, endpoint, p256dh, auth, created_at
      FROM push_subscriptions
      WHERE user_id = $1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  }
}

module.exports = new PushRepository();
