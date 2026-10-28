const db = require('../config/db');

class PreferenceRepository {
  /**
   * Get notification preferences for user (falls back to defaults)
   */
  async getPreferences(userId) {
    const query = `
      SELECT in_app, email, sms, push, updated_at
      FROM notification_preferences
      WHERE user_id = $1;
    `;
    const res = await db.query(query, [userId]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }
    // Defaults: in_app and email enabled, sms disabled, push enabled
    return {
      in_app: true,
      email: true,
      sms: false,
      push: true,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Update or create notification preferences for user
   */
  async updatePreferences(userId, { in_app = true, email = true, sms = false, push = true }) {
    const query = `
      INSERT INTO notification_preferences (user_id, in_app, email, sms, push, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        in_app = EXCLUDED.in_app,
        email = EXCLUDED.email,
        sms = EXCLUDED.sms,
        push = EXCLUDED.push,
        updated_at = NOW()
      RETURNING in_app, email, sms, push, updated_at;
    `;
    const res = await db.query(query, [userId, in_app, email, sms, push]);
    return res.rows[0];
  }
}

module.exports = new PreferenceRepository();
