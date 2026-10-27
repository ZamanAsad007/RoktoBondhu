const db = require('../config/db');
const { evaluateBadges } = require('../domain/badgeEngine');
const { generateCertificateNumber } = require('../utils/certificateGenerator');

class DonorStatsRepository {
  /**
   * Get stats for a donor
   */
  async getStats(userId) {
    const res = await db.query(
      `SELECT * FROM donor_stats WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  /**
   * Get all badges earned by a donor
   */
  async getBadges(userId) {
    const res = await db.query(
      `SELECT badge_code, earned_at FROM badges WHERE user_id = $1 ORDER BY earned_at ASC`,
      [userId]
    );
    return res.rows;
  }

  /**
   * Get donor recent donations with certificate number and hospital
   */
  async getRecentDonations(userId) {
    const query = `
      SELECT 
        d.id,
        d.donated_at,
        d.certificate_no,
        d.confirmed_by_requester,
        br.patient_name,
        br.hospital_name,
        br.city,
        br.blood_group,
        br.urgency
      FROM donations d
      LEFT JOIN blood_requests br ON d.request_id = br.id
      WHERE d.donor_id = $1
      ORDER BY d.donated_at DESC
      LIMIT 20
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  }

  /**
   * Find donation with details by ID
   */
  async getDonationById(donationId) {
    const query = `
      SELECT 
        d.*,
        u.name AS donor_name,
        dp.blood_group,
        br.hospital_name,
        br.city,
        br.patient_name,
        br.urgency
      FROM donations d
      JOIN users u ON d.donor_id = u.id
      LEFT JOIN donor_profiles dp ON d.donor_id = dp.user_id
      LEFT JOIN blood_requests br ON d.request_id = br.id
      WHERE d.id = $1
    `;
    const res = await db.query(query, [donationId]);
    return res.rows[0] || null;
  }

  /**
   * Update donor stats and award badges on confirmed donation
   */
  async recordDonationConfirmed({ userId, donationId, requestId, match, client = null }) {
    const dbClient = client || db;

    // 1. Generate certificate number and update donation
    const certNo = generateCertificateNumber();
    await dbClient.query(
      `UPDATE donations SET certificate_no = $1 WHERE id = $2`,
      [certNo, donationId]
    );

    // 2. Set next_eligible_at = CURRENT_DATE + 90 days on donor profile
    await dbClient.query(
      `UPDATE donor_profiles 
       SET next_eligible_at = (CURRENT_DATE + INTERVAL '90 days')::DATE 
       WHERE user_id = $1`,
      [userId]
    );

    // 3. Upsert donor_stats
    const currentStatsRes = await dbClient.query(
      `SELECT * FROM donor_stats WHERE user_id = $1`,
      [userId]
    );
    const existing = currentStatsRes.rows[0];

    let donatedCount = 1;
    let currentStreak = 1;
    let longestStreak = 1;

    if (existing) {
      donatedCount = existing.donated_count + 1;
      currentStreak = (existing.current_streak || 0) + 1;
      longestStreak = Math.max(existing.longest_streak || 0, currentStreak);
      await dbClient.query(
        `UPDATE donor_stats 
         SET donated_count = $1, current_streak = $2, longest_streak = $3, updated_at = NOW()
         WHERE user_id = $4`,
        [donatedCount, currentStreak, longestStreak, userId]
      );
    } else {
      await dbClient.query(
        `INSERT INTO donor_stats (user_id, donated_count, current_streak, longest_streak)
         VALUES ($1, 1, 1, 1)`,
        [userId]
      );
    }

    // 4. Calculate response time if match details available
    let responseTimeSeconds = null;
    if (match && match.created_at && match.responded_at) {
      responseTimeSeconds = Math.max(
        0,
        Math.round((new Date(match.responded_at) - new Date(match.created_at)) / 1000)
      );
    }

    // 5. Get existing badges and evaluate new ones
    const badgeRes = await dbClient.query(
      `SELECT badge_code FROM badges WHERE user_id = $1`,
      [userId]
    );
    const existingBadges = badgeRes.rows.map((r) => r.badge_code);

    const urgency = match?.request_urgency || 'NORMAL';
    const newBadges = evaluateBadges({
      totalDonations: donatedCount,
      responseTimeSeconds,
      urgency,
      existingBadgeCodes: existingBadges,
    });

    for (const badge of newBadges) {
      await dbClient.query(
        `INSERT INTO badges (user_id, badge_code, earned_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, badge_code) DO NOTHING`,
        [userId, badge.code]
      );
    }

    return {
      certificateNo: certNo,
      donatedCount,
      currentStreak,
      newBadges,
    };
  }

  /**
   * Toggle leaderboard opt-in
   */
  async setLeaderboardOptIn(userId, optIn) {
    const res = await db.query(
      `UPDATE donor_profiles 
       SET show_on_leaderboard = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING show_on_leaderboard`,
      [optIn, userId]
    );
    return res.rows[0];
  }

  /**
   * Public Leaderboard: Top donors who opted in
   * Privacy: First name + initial of last name, and city only.
   */
  async getLeaderboard(limit = 50) {
    const query = `
      SELECT 
        u.id AS user_id,
        u.name,
        dp.city,
        dp.blood_group,
        COALESCE(ds.donated_count, 0) AS donated_count,
        COALESCE(ds.current_streak, 0) AS current_streak,
        COALESCE(ds.longest_streak, 0) AS longest_streak,
        (SELECT COUNT(*) FROM badges b WHERE b.user_id = u.id) AS badges_count
      FROM donor_profiles dp
      JOIN users u ON dp.user_id = u.id
      LEFT JOIN donor_stats ds ON dp.user_id = ds.user_id
      WHERE dp.show_on_leaderboard = TRUE
        AND u.is_blocked = FALSE
      ORDER BY donated_count DESC, current_streak DESC, u.created_at ASC
      LIMIT $1
    `;
    const res = await db.query(query, [limit]);

    // Anonymize names: e.g. "Tanvir Ahmed" -> "Tanvir A."
    return res.rows.map((row, index) => {
      const parts = (row.name || '').trim().split(/\s+/);
      let displayName = parts[0] || 'Anonymous';
      if (parts.length > 1) {
        displayName += ` ${parts[parts.length - 1][0].toUpperCase()}.`;
      }
      return {
        rank: index + 1,
        displayName,
        city: row.city || 'Unknown',
        bloodGroup: row.blood_group,
        donatedCount: Number(row.donated_count),
        currentStreak: Number(row.current_streak),
        longestStreak: Number(row.longest_streak),
        badgesCount: Number(row.badges_count),
      };
    });
  }
}

module.exports = new DonorStatsRepository();
