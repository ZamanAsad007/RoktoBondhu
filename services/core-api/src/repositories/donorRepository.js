const { query } = require('../config/db');

class DonorRepository {
  async upsertProfile({
    userId,
    bloodGroup,
    dateOfBirth,
    latitude,
    longitude,
    city,
    lastDonatedAt = null,
    available = true,
  }) {
    const text = `
      INSERT INTO donor_profiles (
        user_id,
        blood_group,
        date_of_birth,
        location,
        city,
        last_donated_at,
        available,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
        $6,
        $7,
        $8,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        blood_group = EXCLUDED.blood_group,
        date_of_birth = EXCLUDED.date_of_birth,
        location = EXCLUDED.location,
        city = EXCLUDED.city,
        last_donated_at = EXCLUDED.last_donated_at,
        available = EXCLUDED.available,
        updated_at = NOW()
      RETURNING
        user_id,
        blood_group,
        to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        city,
        to_char(last_donated_at, 'YYYY-MM-DD') AS last_donated_at,
        available,
        created_at,
        updated_at;
    `;

    const values = [
      userId,
      bloodGroup,
      dateOfBirth,
      latitude,
      longitude,
      city,
      lastDonatedAt || null,
      available !== undefined ? available : true,
    ];

    const { rows } = await query(text, values);
    return rows[0];
  }

  async findByUserId(userId) {
    const text = `
      SELECT
        dp.user_id,
        u.name,
        u.phone,
        u.email,
        u.phone_verified,
        dp.blood_group,
        to_char(dp.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        ST_Y(dp.location::geometry) AS latitude,
        ST_X(dp.location::geometry) AS longitude,
        dp.city,
        to_char(dp.last_donated_at, 'YYYY-MM-DD') AS last_donated_at,
        dp.available,
        dp.availability_windows,
        dp.created_at,
        dp.updated_at
      FROM donor_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.user_id = $1;
    `;
    const { rows } = await query(text, [userId]);
    return rows[0] || null;
  }

  async updateAvailability(userId, available) {
    let text;
    let values;

    if (available === undefined || available === null) {
      // Toggle
      text = `
        UPDATE donor_profiles
        SET available = NOT available, updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          user_id,
          blood_group,
          to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          city,
          to_char(last_donated_at, 'YYYY-MM-DD') AS last_donated_at,
          available,
          created_at,
          updated_at;
      `;
      values = [userId];
    } else {
      text = `
        UPDATE donor_profiles
        SET available = $2, updated_at = NOW()
        WHERE user_id = $1
        RETURNING
          user_id,
          blood_group,
          to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          city,
          to_char(last_donated_at, 'YYYY-MM-DD') AS last_donated_at,
          available,
          created_at,
          updated_at;
      `;
      values = [userId, Boolean(available)];
    }

    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  async getHistory(userId) {
    // Check if donations table exists
    const checkDonationsTable = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'donations'
      );
    `;
    const checkMatchesTable = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'request_matches'
      );
    `;

    const [hasDonations, hasMatches] = await Promise.all([
      query(checkDonationsTable).then((res) => res.rows[0].exists),
      query(checkMatchesTable).then((res) => res.rows[0].exists),
    ]);

    let donations = [];
    let responses = [];

    if (hasDonations) {
      const donationQuery = `
        SELECT id, request_id, donated_at, confirmed_by_requester
        FROM donations
        WHERE donor_id = $1
        ORDER BY donated_at DESC;
      `;
      const donationRes = await query(donationQuery, [userId]);
      donations = donationRes.rows;
    }

    if (hasMatches) {
      const matchQuery = `
        SELECT id, request_id, status, distance_km, wave_number, notified_at, responded_at
        FROM request_matches
        WHERE donor_id = $1
        ORDER BY notified_at DESC;
      `;
      const matchRes = await query(matchQuery, [userId]);
      responses = matchRes.rows;
    }

    return {
      donations,
      responses,
    };
  }
  async updateAvailabilityWindows(userId, windows = []) {
    const text = `
      UPDATE donor_profiles
      SET availability_windows = $1::jsonb, updated_at = NOW()
      WHERE user_id = $2
      RETURNING user_id, availability_windows, updated_at;
    `;
    const { rows } = await query(text, [JSON.stringify(windows), userId]);
    return rows[0] || null;
  }
}

module.exports = new DonorRepository();
