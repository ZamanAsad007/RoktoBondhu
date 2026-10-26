const db = require('../config/db');

class AuditLogRepository {
  /**
   * Records an audit log entry.
   * @param {Object} params
   * @param {string | null} params.actorId
   * @param {string} params.action
   * @param {string} params.entity
   * @param {string | null} params.entityId
   * @param {Object} [params.metadata]
   * @param {Object} [client=db]
   * @returns {Promise<Object>}
   */
  async log({ actorId = null, action, entity, entityId = null, metadata = {} }, client = db) {
    const query = `
      INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await client.query(query, [
      actorId,
      action,
      entity,
      entityId,
      JSON.stringify(metadata),
    ]);
    return res.rows[0];
  }
}

module.exports = new AuditLogRepository();
