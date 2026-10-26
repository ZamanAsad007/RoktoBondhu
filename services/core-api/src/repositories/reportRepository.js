const db = require('../config/db');

class ReportRepository {
  async create({ reporterId, requestId = null, userId = null, reason, details = null }) {
    const query = `
      INSERT INTO reports (reporter_id, request_id, user_id, reason, details, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())
      RETURNING *
    `;
    const res = await db.query(query, [reporterId, requestId, userId, reason, details]);
    return res.rows[0];
  }

  async findById(id) {
    const query = `
      SELECT r.*,
        u_reporter.name AS reporter_name, u_reporter.phone AS reporter_phone,
        u_reported.name AS reported_user_name, u_reported.phone AS reported_user_phone,
        br.patient_name, br.hospital_name
      FROM reports r
      LEFT JOIN users u_reporter ON u_reporter.id = r.reporter_id
      LEFT JOIN users u_reported ON u_reported.id = r.user_id
      LEFT JOIN blood_requests br ON br.id = r.request_id
      WHERE r.id = $1
    `;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }

  async findAll({ status = null, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT r.*,
        u_reporter.name AS reporter_name, u_reporter.phone AS reporter_phone,
        u_reported.name AS reported_user_name, u_reported.phone AS reported_user_phone,
        br.patient_name, br.hospital_name
      FROM reports r
      LEFT JOIN users u_reporter ON u_reporter.id = r.reporter_id
      LEFT JOIN users u_reported ON u_reported.id = r.user_id
      LEFT JOIN blood_requests br ON br.id = r.request_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const res = await db.query(query, [...values, limit, offset]);
    return res.rows;
  }

  async updateStatus(id, { status, resolutionNotes = null }) {
    const query = `
      UPDATE reports
      SET status = $2,
          resolution_notes = COALESCE($3, resolution_notes),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(query, [id, status, resolutionNotes]);
    return res.rows[0] || null;
  }

  async countPending() {
    const query = `SELECT COUNT(*)::int AS count FROM reports WHERE status = 'PENDING'`;
    const res = await db.query(query);
    return res.rows[0].count;
  }
}

module.exports = new ReportRepository();
