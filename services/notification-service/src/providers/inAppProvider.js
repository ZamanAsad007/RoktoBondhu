const db = require('../config/db');
const { renderInApp } = require('../templates/notificationTemplates');

class InAppProvider {
  /**
   * Persists an in-app notification in the PostgreSQL database.
   */
  async send({ userId, type, payload = {} }) {
    if (!userId) {
      throw new Error('InAppProvider: userId is required');
    }

    const template = renderInApp(type, payload);
    const enrichedPayload = {
      ...payload,
      title: template.title,
      message: template.message,
      actionUrl: template.actionUrl,
    };

    const query = `
      INSERT INTO notifications (user_id, channel, type, payload, status, created_at)
      VALUES ($1, 'in_app', $2, $3, 'sent', NOW())
      RETURNING *
    `;
    const res = await db.query(query, [userId, type, JSON.stringify(enrichedPayload)]);
    return res.rows[0];
  }
}

module.exports = new InAppProvider();
