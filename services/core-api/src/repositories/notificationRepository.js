const db = require('../config/db');

class NotificationRepository {
  async create({ id, userId, channel, type, payload = {}, status = 'sent', error = null }, client = null) {
    const query = `
      INSERT INTO notifications (id, user_id, channel, type, payload, status, error, created_at)
      VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [id || null, userId, channel, type, JSON.stringify(payload), status, error];
    const res = client ? await client.query(query, values) : await db.query(query, values);
    return res.rows[0];
  }

  async findById(id) {
    const query = `SELECT * FROM notifications WHERE id = $1`;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }

  async findByUserId(userId, { page = 1, limit = 20, unreadOnly = false, channel = null } = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (unreadOnly) {
      conditions.push('read_at IS NULL');
    }

    if (channel) {
      values.push(channel);
      conditions.push(`channel = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `SELECT COUNT(*) FROM notifications WHERE ${whereClause}`;
    const countRes = await db.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const dataQuery = `
      SELECT * FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const dataValues = [...values, limit, offset];
    const dataRes = await db.query(dataQuery, dataValues);

    return {
      notifications: dataRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async countUnreadByUserId(userId, channel = null) {
    let query = `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`;
    const values = [userId];

    if (channel) {
      query += ` AND channel = $2`;
      values.push(channel);
    }

    const res = await db.query(query, values);
    return parseInt(res.rows[0].count, 10);
  }

  async markAsRead(id, userId) {
    const query = `
      UPDATE notifications
      SET read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const res = await db.query(query, [id, userId]);
    return res.rows[0] || null;
  }

  async markAllAsRead(userId) {
    const query = `
      UPDATE notifications
      SET read_at = NOW()
      WHERE user_id = $1 AND read_at IS NULL
      RETURNING id
    `;
    const res = await db.query(query, [userId]);
    return res.rowCount;
  }
}

module.exports = new NotificationRepository();
