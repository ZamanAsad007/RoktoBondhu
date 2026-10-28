const db = require('../config/db');
const { compatibleDonorGroups, compatibleRecipientGroups } = require('../domain/compatibility');
const eligibilityConfig = require('../config/eligibility.config');

class MatchingRepository {
  /**
   * Finds eligible, compatible, and available donors within a radius around the blood request location,
   * ordered by geographic distance (closest first), excluding already-notified donors.
   *
   * @param {Object} params
   * @param {string} params.requestId
   * @param {number} params.radiusKm
   * @param {number} [params.limit=10]
   * @param {Object} [params.overrides={}]
   * @param {Object} [client=db]
   * @returns {Promise<Array>}
   */
  async findEligibleDonorsForRequest(
    { requestId, radiusKm, limit = 10, overrides = {} },
    client = db
  ) {
    const config = { ...eligibilityConfig, ...overrides };
    const radiusMeters = radiusKm * 1000;

    // First retrieve request blood group
    const reqQuery = `SELECT id, blood_group FROM blood_requests WHERE id = $1`;
    const reqRes = await client.query(reqQuery, [requestId]);
    if (!reqRes.rows[0]) {
      return [];
    }
    const compatibleGroups = compatibleDonorGroups(reqRes.rows[0].blood_group);

    const query = `
      SELECT
        dp.user_id AS donor_id,
        dp.blood_group,
        dp.city,
        to_char(dp.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        to_char(dp.last_donated_at, 'YYYY-MM-DD') AS last_donated_at,
        ST_Y(dp.location::geometry) AS latitude,
        ST_X(dp.location::geometry) AS longitude,
        u.name AS donor_name,
        u.phone AS donor_phone,
        u.email AS donor_email,
        dp.availability_windows,
        COALESCE(ds.reliability_score, 85) AS reliability_score,
        ds.avg_response_seconds,
        ROUND((ST_Distance(dp.location, r.location) / 1000.0)::numeric, 2) AS distance_km
      FROM blood_requests r
      CROSS JOIN donor_profiles dp
      JOIN users u ON u.id = dp.user_id
      LEFT JOIN donor_stats ds ON ds.user_id = dp.user_id
      WHERE
        r.id = $1
        -- 1. Blood compatibility
        AND dp.blood_group = ANY($2::text[])
        -- 2. Availability & verification flags
        AND ($3::boolean = FALSE OR dp.available = TRUE)
        AND ($4::boolean = FALSE OR u.phone_verified = TRUE)
        AND u.is_blocked = FALSE
        -- 3. Requester cannot donate to their own request
        AND dp.user_id != r.requester_id
        -- 4. Age range criteria (18-60 default)
        AND dp.date_of_birth <= (NOW() - ($5 || ' years')::interval)
        AND dp.date_of_birth >= (NOW() - ($6 || ' years')::interval)
        -- 5. Cooldown gap since last donation (90 days default)
        AND (dp.last_donated_at IS NULL OR dp.last_donated_at <= (NOW() - ($7 || ' days')::interval))
        -- 6. Must not have an active accepted donation in progress
        AND NOT EXISTS (
          SELECT 1
          FROM request_matches rm
          JOIN blood_requests br ON br.id = rm.request_id
          WHERE rm.donor_id = dp.user_id
            AND rm.status = 'ACCEPTED'
            AND br.status IN ('OPEN', 'PARTIALLY_FULFILLED')
        )
        -- 7. Must not have already been notified for this request
        AND NOT EXISTS (
          SELECT 1
          FROM request_matches rm_existing
          WHERE rm_existing.request_id = r.id
            AND rm_existing.donor_id = dp.user_id
        )
        -- 8. Spatial proximity ring
        AND ST_DWithin(dp.location, r.location, $8)
      ORDER BY ST_Distance(dp.location, r.location) ASC
      LIMIT $9
    `;

    const values = [
      requestId,
      compatibleGroups,
      config.requireAvailable,
      config.requirePhoneVerified,
      config.minAge,
      config.maxAge,
      config.cooldownDays,
      radiusMeters,
      limit,
    ];

    const res = await client.query(query, values);
    return res.rows;
  }

  /**
   * Batch creates matches with status 'NOTIFIED'.
   */
  async createMatchesBatch(matches = [], client = db) {
    if (!matches || matches.length === 0) {
      return [];
    }

    const insertedRows = [];
    for (const match of matches) {
      const query = `
        INSERT INTO request_matches (
          request_id,
          donor_id,
          status,
          distance_km,
          wave_number,
          notified_at
        ) VALUES ($1, $2, 'NOTIFIED', $3, $4, NOW())
        ON CONFLICT (request_id, donor_id) DO NOTHING
        RETURNING *
      `;
      const res = await client.query(query, [
        match.requestId,
        match.donorId,
        match.distanceKm,
        match.waveNumber,
      ]);
      if (res.rows[0]) {
        insertedRows.push(res.rows[0]);
      }
    }

    return insertedRows;
  }

  /**
   * Finds open requests nearby for an authenticated donor that match their blood group.
   */
  async findNearbyOpenRequestsForDonor({ donorUserId, radiusKm = 10, limit = 20 }) {
    // Get donor profile
    const donorQuery = `SELECT blood_group, location FROM donor_profiles WHERE user_id = $1`;
    const donorRes = await db.query(donorQuery, [donorUserId]);
    if (!donorRes.rows[0] || !donorRes.rows[0].location) {
      return [];
    }

    const donor = donorRes.rows[0];
    const compatibleRecipients = compatibleRecipientGroups(donor.blood_group);
    const radiusMeters = radiusKm * 1000;

    const query = `
      SELECT
        r.id,
        r.patient_name,
        r.blood_group,
        r.units_needed,
        r.hospital_name,
        ST_Y(r.location::geometry) AS latitude,
        ST_X(r.location::geometry) AS longitude,
        r.city,
        r.urgency,
        r.needed_by,
        r.status,
        r.created_at,
        r.expires_at,
        ROUND((ST_Distance(r.location, $2) / 1000.0)::numeric, 2) AS distance_km
      FROM blood_requests r
      WHERE
        r.status IN ('OPEN', 'PARTIALLY_FULFILLED')
        AND r.expires_at > NOW()
        AND r.requester_id != $1
        AND r.blood_group = ANY($3::text[])
        AND ST_DWithin(r.location, $2, $4)
      ORDER BY ST_Distance(r.location, $2) ASC
      LIMIT $5
    `;

    const values = [donorUserId, donor.location, compatibleRecipients, radiusMeters, limit];
    const res = await db.query(query, values);
    return res.rows;
  }

  /**
   * Updates request wave progress.
   */
  async updateWaveProgress(requestId, { currentRadiusKm, waveNumber }, client = db) {
    const query = `
      UPDATE blood_requests
      SET
        current_radius_km = $2,
        wave_number = $3
      WHERE id = $1
      RETURNING *
    `;
    const res = await client.query(query, [requestId, currentRadiusKm, waveNumber]);
    return res.rows[0] || null;
  }

  /**
   * Marks leftover NOTIFIED matches as EXPIRED for a given request.
   */
  async expirePendingMatches(requestId, client = db) {
    const query = `
      UPDATE request_matches
      SET status = 'EXPIRED'
      WHERE request_id = $1 AND status = 'NOTIFIED'
      RETURNING *
    `;
    const res = await client.query(query, [requestId]);
    return res.rows;
  }
}

module.exports = new MatchingRepository();
