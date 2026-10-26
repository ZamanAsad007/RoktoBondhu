const db = require('../config/db');

class AdminRepository {
  async getStats() {
    // 1. Overall counts
    const countsQuery = `
      SELECT
        (SELECT COUNT(*)::int FROM blood_requests) AS total_requests,
        (SELECT COUNT(*)::int FROM blood_requests WHERE status = 'FULFILLED') AS fulfilled_requests,
        (SELECT COUNT(*)::int FROM donor_profiles) AS total_donors,
        (SELECT COUNT(*)::int FROM donor_profiles WHERE available = TRUE) AS available_donors,
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE is_blocked = TRUE) AS blocked_users,
        (SELECT COUNT(*)::int FROM reports WHERE status = 'PENDING') AS pending_reports
    `;
    const countsRes = await db.query(countsQuery);
    const counts = countsRes.rows[0];

    // 2. Fulfillment rate
    const totalReq = counts.total_requests;
    const fulfilledReq = counts.fulfilled_requests;
    const fulfillmentRate = totalReq > 0 ? Math.round((fulfilledReq / totalReq) * 100) : 0;

    // 3. Average time to first accept (minutes)
    const avgTimeQuery = `
      SELECT ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (first_accept - created_at)) / 60), 0)::numeric, 1) AS avg_minutes
      FROM (
        SELECT r.created_at, MIN(m.responded_at) AS first_accept
        FROM blood_requests r
        JOIN request_matches m ON m.request_id = r.id AND m.status = 'ACCEPTED'
        GROUP BY r.id, r.created_at
      ) sub
    `;
    const avgTimeRes = await db.query(avgTimeQuery);
    const avgTimeToFirstAcceptMinutes = parseFloat(avgTimeRes.rows[0].avg_minutes) || 0;

    // 4. Requests per day for the last 7 days
    const dailyQuery = `
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM blood_requests
      WHERE created_at >= NOW() - interval '7 days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY date ASC
    `;
    const dailyRes = await db.query(dailyQuery);

    return {
      totalRequests: counts.total_requests,
      fulfilledRequests: counts.fulfilled_requests,
      fulfillmentRate,
      avgTimeToFirstAcceptMinutes,
      totalDonors: counts.total_donors,
      availableDonors: counts.available_donors,
      totalUsers: counts.total_users,
      blockedUsers: counts.blocked_users,
      pendingReports: counts.pending_reports,
      requestsPerDay: dailyRes.rows,
    };
  }

  async getAllRequests({ status = null, limit = 50, offset = 0 } = {}) {
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        r.id,
        r.patient_name,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        r.city,
        r.urgency,
        r.status,
        r.current_radius_km,
        r.wave_number,
        r.created_at,
        r.expires_at,
        r.needed_by,
        r.contact_phone,
        u.id AS requester_id,
        u.name AS requester_name,
        u.phone AS requester_phone,
        COALESCE(SUM(CASE WHEN m.status = 'ACCEPTED' THEN 1 ELSE 0 END), 0)::int AS accepted_count
      FROM blood_requests r
      JOIN users u ON u.id = r.requester_id
      LEFT JOIN request_matches m ON m.request_id = r.id
      ${whereClause}
      GROUP BY r.id, u.id
      ORDER BY r.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const res = await db.query(query, [...values, limit, offset]);
    return res.rows;
  }

  async searchUsers(searchQuery, limit = 20) {
    const text = `
      SELECT id, name, phone, email, role, is_blocked, phone_verified, created_at
      FROM users
      WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const res = await db.query(text, [`%${searchQuery}%`, limit]);
    return res.rows;
  }
}

module.exports = new AdminRepository();
