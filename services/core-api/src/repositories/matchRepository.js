const db = require('../config/db');

class MatchRepository {
  /**
   * Retrieves a match with a row-level lock for transactional state updates.
   */
  async findMatchByIdForUpdate(matchId, client) {
    const text = `
      SELECT *
      FROM request_matches
      WHERE id = $1
      FOR UPDATE
    `;
    const res = await client.query(text, [matchId]);
    return res.rows[0] || null;
  }

  /**
   * Retrieves a match by ID.
   */
  async findById(matchId, client = db) {
    const text = `
      SELECT *
      FROM request_matches
      WHERE id = $1
    `;
    const res = await client.query(text, [matchId]);
    return res.rows[0] || null;
  }

  /**
   * Counts currently accepted matches for a blood request.
   */
  async countAcceptedMatches(requestId, client = db) {
    const text = `
      SELECT COUNT(*)::int AS count
      FROM request_matches
      WHERE request_id = $1 AND status = 'ACCEPTED'
    `;
    const res = await client.query(text, [requestId]);
    return res.rows[0].count;
  }

  /**
   * Checks whether a donor currently has another active accepted donation.
   */
  async hasActiveAcceptedDonation(donorId, excludeMatchId = null, client = db) {
    const text = `
      SELECT 1
      FROM request_matches rm
      JOIN blood_requests br ON br.id = rm.request_id
      WHERE rm.donor_id = $1
        AND ($2::uuid IS NULL OR rm.id != $2)
        AND rm.status = 'ACCEPTED'
        AND br.status IN ('OPEN', 'PARTIALLY_FULFILLED')
      LIMIT 1
    `;
    const res = await client.query(text, [donorId, excludeMatchId]);
    return res.rows.length > 0;
  }

  /**
   * Updates match status and sets responded_at timestamp.
   */
  async updateMatchStatus(matchId, status, client = db) {
    const text = `
      UPDATE request_matches
      SET status = $2,
          responded_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await client.query(text, [matchId, status]);
    return res.rows[0] || null;
  }

  /**
   * Expires all remaining NOTIFIED matches for a request when fulfilled.
   */
  async expireLeftoverNotifiedMatches(requestId, client = db) {
    const text = `
      UPDATE request_matches
      SET status = 'EXPIRED'
      WHERE request_id = $1 AND status = 'NOTIFIED'
      RETURNING *
    `;
    const res = await client.query(text, [requestId]);
    return res.rows;
  }

  /**
   * Retrieves all accepted matches for a request.
   */
  async findAcceptedMatchesByRequestId(requestId, client = db) {
    const text = `
      SELECT rm.*, u.name AS donor_name, u.phone AS donor_phone, u.email AS donor_email
      FROM request_matches rm
      JOIN users u ON u.id = rm.donor_id
      WHERE rm.request_id = $1 AND rm.status = 'ACCEPTED'
    `;
    const res = await client.query(text, [requestId]);
    return res.rows;
  }

  /**
   * Retrieves all matches for a specific donor, with blood request details.
   */
  async findMatchesByDonorId(donorId, { limit = 20, offset = 0 } = {}) {
    const text = `
      SELECT
        m.id AS match_id,
        m.status AS match_status,
        m.distance_km,
        m.wave_number,
        m.notified_at,
        m.responded_at,
        r.id AS request_id,
        r.patient_name,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        r.city,
        r.urgency,
        r.needed_by,
        r.status AS request_status,
        r.contact_phone,
        r.expires_at,
        ST_Y(r.location::geometry) AS latitude,
        ST_X(r.location::geometry) AS longitude
      FROM request_matches m
      JOIN blood_requests r ON r.id = m.request_id
      WHERE m.donor_id = $1
      ORDER BY m.notified_at DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await db.query(text, [donorId, limit, offset]);
    return res.rows;
  }
}

module.exports = new MatchRepository();
