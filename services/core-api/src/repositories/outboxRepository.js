const db = require('../config/db');

class OutboxRepository {
  /**
   * Insert job into outbox table, optionally within a provided transaction client
   */
  async insertJob(clientOrPool, { queueName, eventType, payload }) {
    const executor = clientOrPool || db;
    const query = `
      INSERT INTO outbox (queue_name, event_type, payload)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await executor.query(query, [queueName, eventType, JSON.stringify(payload)]);
    return res.rows[0];
  }

  /**
   * Fetch pending outbox jobs with row-level lock (FOR UPDATE SKIP LOCKED)
   */
  async getPendingJobs(limit = 50) {
    const query = `
      SELECT * FROM outbox
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `;
    const res = await db.query(query, [limit]);
    return res.rows;
  }

  /**
   * Mark outbox entry as published
   */
  async markPublished(id) {
    const query = `
      UPDATE outbox
      SET status = 'PUBLISHED', processed_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(query, [id]);
    return res.rows[0];
  }

  /**
   * Mark outbox entry as failed with retry attempt count increment
   */
  async markFailed(id, errorMessage) {
    const query = `
      UPDATE outbox
      SET status = CASE WHEN attempts + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END,
          error_message = $2,
          attempts = attempts + 1
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(query, [id, String(errorMessage)]);
    return res.rows[0];
  }
}

module.exports = new OutboxRepository();
