const db = require('../config/db');
const crypto = require('crypto');

class BloodRequestRepository {
  /**
   * Creates a new blood request.
   */
  async createRequest(params) {
    const requesterId = params.requesterId || params.requester_id;
    const patientName = params.patientName || params.patient_name;
    const bloodGroup = params.bloodGroup || params.blood_group;
    const unitsNeeded = params.unitsNeeded || params.units_needed;
    const hospitalName = params.hospitalName || params.hospital_name;
    const latitude = params.latitude;
    const longitude = params.longitude;
    const city = params.city;
    const urgency = params.urgency;
    const neededBy = params.neededBy || params.needed_by;
    const contactPhone = params.contactPhone || params.contact_phone;
    const expiresAt = params.expiresAt || params.expires_at;
    const shareToken = params.shareToken || params.share_token || crypto.randomBytes(6).toString('hex');

    const text = `
      INSERT INTO blood_requests (
        requester_id,
        patient_name,
        blood_group,
        units_needed,
        hospital_name,
        location,
        city,
        urgency,
        needed_by,
        contact_phone,
        status,
        expires_at,
        share_token
      ) VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
        $8, $9, $10, $11, 'OPEN', $12, $13
      )
      RETURNING
        id,
        requester_id,
        patient_name,
        blood_group,
        units_needed,
        hospital_name,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        city,
        urgency,
        needed_by,
        contact_phone,
        status,
        current_radius_km,
        wave_number,
        created_at,
        expires_at,
        share_token,
        is_sos,
        escalated_at
    `;

    const values = [
      requesterId,
      patientName,
      bloodGroup,
      unitsNeeded,
      hospitalName,
      latitude,
      longitude,
      city || null,
      urgency,
      neededBy,
      contactPhone,
      expiresAt,
      shareToken,
    ];

    const res = await db.query(text, values);
    return res.rows[0];
  }

  /**
   * Retrieves a request by ID, including accepted donor count and requester info.
   */
  async findById(id) {
    const text = `
      SELECT
        r.id,
        r.requester_id,
        r.patient_name,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        ST_Y(r.location::geometry) AS latitude,
        ST_X(r.location::geometry) AS longitude,
        r.city,
        r.urgency,
        r.needed_by,
        r.contact_phone,
        r.status,
        r.current_radius_km,
        r.wave_number,
        r.created_at,
        r.expires_at,
        r.share_token,
        r.is_sos,
        r.escalated_at,
        u.name AS requester_name,
        u.phone AS requester_phone,
        COALESCE(SUM(CASE WHEN m.status = 'ACCEPTED' THEN 1 ELSE 0 END), 0)::int AS accepted_count,
        COALESCE(COUNT(m.id), 0)::int AS total_matches_count
      FROM blood_requests r
      JOIN users u ON u.id = r.requester_id
      LEFT JOIN request_matches m ON m.request_id = r.id
      WHERE r.id = $1
      GROUP BY r.id, u.id
    `;
    const res = await db.query(text, [id]);
    return res.rows[0] || null;
  }

  /**
   * Counts requests created by a specific user within the last 24 hours.
   */
  async countRecentRequestsByUser(userId, hours = 24) {
    const text = `
      SELECT COUNT(*)::int AS count
      FROM blood_requests
      WHERE requester_id = $1
        AND created_at >= NOW() - ($2 || ' hours')::interval
    `;
    const res = await db.query(text, [userId, hours]);
    return res.rows[0].count;
  }

  /**
   * Lists blood requests created by a specific user.
   */
  async findByRequesterId(requesterId, { limit = 20, offset = 0 } = {}) {
    const text = `
      SELECT
        r.id,
        r.requester_id,
        r.patient_name,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        ST_Y(r.location::geometry) AS latitude,
        ST_X(r.location::geometry) AS longitude,
        r.city,
        r.urgency,
        r.needed_by,
        r.contact_phone,
        r.status,
        r.current_radius_km,
        r.wave_number,
        r.created_at,
        r.expires_at,
        COALESCE(SUM(CASE WHEN m.status = 'ACCEPTED' THEN 1 ELSE 0 END), 0)::int AS accepted_count,
        COALESCE(COUNT(m.id), 0)::int AS total_matches_count
      FROM blood_requests r
      LEFT JOIN request_matches m ON m.request_id = r.id
      WHERE r.requester_id = $1
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await db.query(text, [requesterId, limit, offset]);
    return res.rows;
  }

  /**
   * Updates request status.
   */
  async updateStatus(id, newStatus, client = db) {
    const text = `
      UPDATE blood_requests
      SET status = $2
      WHERE id = $1
      RETURNING
        id,
        requester_id,
        patient_name,
        blood_group,
        units_needed,
        hospital_name,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        city,
        urgency,
        needed_by,
        contact_phone,
        status,
        current_radius_km,
        wave_number,
        created_at,
        expires_at
    `;
    const res = await client.query(text, [id, newStatus]);
    return res.rows[0] || null;
  }

  /**
   * Checks if a user has a match row on a request.
   */
  async findMatchForUser(requestId, userId) {
    const text = `
      SELECT *
      FROM request_matches
      WHERE request_id = $1 AND donor_id = $2
    `;
    const res = await db.query(text, [requestId, userId]);
    return res.rows[0] || null;
  }

  /**
   * Lists matches with donor details for a given request (for requester/admin).
   */
  async listMatches(requestId) {
    const text = `
      SELECT
        m.id,
        m.request_id,
        m.donor_id,
        m.status,
        m.distance_km,
        m.wave_number,
        m.notified_at,
        m.responded_at,
        u.name AS donor_name,
        u.phone AS donor_phone,
        dp.blood_group AS donor_blood_group
      FROM request_matches m
      JOIN users u ON u.id = m.donor_id
      LEFT JOIN donor_profiles dp ON dp.user_id = m.donor_id
      WHERE m.request_id = $1
      ORDER BY m.wave_number ASC, m.distance_km ASC
    `;
    const res = await db.query(text, [requestId]);
    return res.rows;
  }

  /**
   * Retrieves safe public details for a request by share token.
   * EXCLUDES patient name, contact phone, and exact coordinates.
   */
  async findByShareToken(shareToken) {
    const text = `
      SELECT
        r.id,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        r.city,
        r.urgency,
        r.status,
        r.is_sos,
        r.escalated_at,
        r.share_token,
        r.needed_by,
        r.expires_at,
        r.created_at,
        COALESCE(SUM(CASE WHEN m.status = 'ACCEPTED' THEN 1 ELSE 0 END), 0)::int AS accepted_count
      FROM blood_requests r
      LEFT JOIN request_matches m ON m.request_id = r.id
      WHERE r.share_token = $1
      GROUP BY r.id
    `;
    const res = await db.query(text, [shareToken]);
    return res.rows[0] || null;
  }

  /**
   * Mark a request as escalated to SOS emergency.
   */
  async escalateToSos(requestId, client = null) {
    const dbClient = client || db;
    const text = `
      UPDATE blood_requests
      SET 
        is_sos = TRUE,
        urgency = 'CRITICAL',
        escalated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(text, [requestId]);
    return res.rows[0] || null;
  }
}

module.exports = new BloodRequestRepository();
