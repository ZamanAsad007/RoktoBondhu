const donorStatsRepository = require('../repositories/donorStatsRepository');
const donorRepository = require('../repositories/donorRepository');
const { BADGE_DEFINITIONS } = require('../domain/badgeEngine');
const { generateCertificatePdf, generateCertificateNumber } = require('../utils/certificateGenerator');
const db = require('../config/db');

class DonorStatsController {
  /**
   * GET /api/donors/me/stats
   */
  async getMyStats(req, res, next) {
    try {
      const userId = req.user.id;
      const stats = (await donorStatsRepository.getStats(userId)) || {
        donated_count: 0,
        accepted_count: 0,
        notified_count: 0,
        current_streak: 0,
        longest_streak: 0,
        reliability_score: 100,
      };

      const earnedBadges = await donorStatsRepository.getBadges(userId);
      const earnedCodeSet = new Set(earnedBadges.map((b) => b.badge_code));

      // Map all badge definitions with earned status and timestamp
      const allBadgesWithStatus = Object.values(BADGE_DEFINITIONS).map((badge) => {
        const earned = earnedBadges.find((b) => b.badge_code === badge.code);
        return {
          ...badge,
          isEarned: earnedCodeSet.has(badge.code),
          earnedAt: earned ? earned.earned_at : null,
        };
      });

      const profile = await donorRepository.findByUserId(userId);
      const recentDonations = await donorStatsRepository.getRecentDonations(userId);

      // Calculate countdown to next eligible donation
      let nextEligibleAt = profile?.next_eligible_at || null;
      if (!nextEligibleAt && profile?.last_donated_at) {
        const lastDonated = new Date(profile.last_donated_at);
        nextEligibleAt = new Date(lastDonated.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      }

      let daysUntilEligible = 0;
      let isEligibleNow = true;

      if (nextEligibleAt) {
        const target = new Date(nextEligibleAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffMs = target.getTime() - today.getTime();
        daysUntilEligible = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        isEligibleNow = daysUntilEligible === 0;
      }

      return res.status(200).json({
        success: true,
        data: {
          donatedCount: Number(stats.donated_count || 0),
          currentStreak: Number(stats.current_streak || 0),
          longestStreak: Number(stats.longest_streak || 0),
          reliabilityScore: Number(stats.reliability_score || 100),
          nextEligibleAt,
          daysUntilEligible,
          isEligibleNow,
          showOnLeaderboard: Boolean(profile?.show_on_leaderboard),
          badges: allBadgesWithStatus,
          recentDonations,
        },
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PUT /api/donors/me/leaderboard-opt-in
   */
  async setLeaderboardOptIn(req, res, next) {
    try {
      const { showOnLeaderboard } = req.body;
      if (typeof showOnLeaderboard !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { message: 'showOnLeaderboard must be a boolean' },
        });
      }

      const result = await donorStatsRepository.setLeaderboardOptIn(
        req.user.id,
        showOnLeaderboard
      );

      return res.status(200).json({
        success: true,
        data: {
          showOnLeaderboard: result.show_on_leaderboard,
        },
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /api/leaderboard (Public)
   */
  async getLeaderboard(req, res, next) {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const leaderboard = await donorStatsRepository.getLeaderboard(limit);

      return res.status(200).json({
        success: true,
        data: leaderboard,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /api/donations/:id/certificate
   */
  async downloadCertificate(req, res, next) {
    try {
      const donationId = req.params.id;
      const donation = await donorStatsRepository.getDonationById(donationId);

      if (!donation) {
        return res.status(404).json({
          success: false,
          error: { message: 'Donation record not found' },
        });
      }

      // Authorization: Only the donor, or admin can download
      if (req.user.id !== donation.donor_id && req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: { message: 'You are not authorized to download this certificate' },
        });
      }

      // Generate certificate number if none exists
      if (!donation.certificate_no) {
        donation.certificate_no = generateCertificateNumber(new Date(donation.donated_at));
        await db.query(
          `UPDATE donations SET certificate_no = $1 WHERE id = $2`,
          [donation.certificate_no, donation.id]
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="RoktoBondhu-Certificate-${donation.certificate_no}.pdf"`
      );

      await generateCertificatePdf(donation, res);
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new DonorStatsController();
