const {
  calculateReliabilityScore,
  isDonorInAvailabilityWindow,
} = require('../../src/domain/reliabilityScore');
const { rankCandidatesV2 } = require('../../src/domain/matchingV2');

describe('Phase 18 Domain Logic: Reliability Score & Matching v2', () => {
  describe('calculateReliabilityScore', () => {
    it('gives default 85 for a brand new donor with 0 notifications', () => {
      const score = calculateReliabilityScore({
        notifiedCount: 0,
        acceptedCount: 0,
        donatedCount: 0,
      });
      expect(score).toBe(85);
    });

    it('calculates high score for responsive donor with fast completion', () => {
      const score = calculateReliabilityScore({
        notifiedCount: 10,
        acceptedCount: 8,
        donatedCount: 8,
        noShowCount: 0,
        avgResponseSeconds: 120, // 2 minutes
      });
      // 0.35 * 80 + 0.45 * 100 + 0.20 * 100 = 28 + 45 + 20 = 93
      expect(score).toBe(93);
    });

    it('heavily penalizes no-shows', () => {
      const scoreWithoutNoShows = calculateReliabilityScore({
        notifiedCount: 5,
        acceptedCount: 4,
        donatedCount: 3,
        noShowCount: 0,
        avgResponseSeconds: 500,
      });

      const scoreWithNoShows = calculateReliabilityScore({
        notifiedCount: 5,
        acceptedCount: 4,
        donatedCount: 3,
        noShowCount: 2, // -30 penalty
        avgResponseSeconds: 500,
      });

      expect(scoreWithNoShows).toBe(Math.max(10, scoreWithoutNoShows - 30));
    });

    it('clamps minimum score to 10', () => {
      const score = calculateReliabilityScore({
        notifiedCount: 20,
        acceptedCount: 1,
        donatedCount: 0,
        noShowCount: 10,
      });
      expect(score).toBe(10);
    });
  });

  describe('isDonorInAvailabilityWindow', () => {
    it('returns true if donor has no windows (available 24/7)', () => {
      expect(isDonorInAvailabilityWindow([], new Date())).toBe(true);
      expect(isDonorInAvailabilityWindow(null, new Date())).toBe(true);
    });

    it('returns true when current time is inside defined window', () => {
      // Mock Monday 19:30
      const testDate = new Date('2026-11-02T19:30:00'); // 2026-11-02 is Monday
      const windows = [
        { day: 'monday', start: '18:00', end: '22:00' },
        { day: 'friday', start: '09:00', end: '17:00' },
      ];
      expect(isDonorInAvailabilityWindow(windows, testDate)).toBe(true);
    });

    it('returns false when current time is outside defined window', () => {
      // Mock Monday 14:00 (outside 18:00-22:00)
      const testDate = new Date('2026-11-02T14:00:00');
      const windows = [{ day: 'monday', start: '18:00', end: '22:00' }];
      expect(isDonorInAvailabilityWindow(windows, testDate)).toBe(false);
    });
  });

  describe('rankCandidatesV2', () => {
    it('ranks highly reliable and available donor higher than closer but unreliable donor', () => {
      const testDate = new Date('2026-11-02T19:00:00'); // Monday 19:00

      const donorA = {
        id: 'donor-A',
        name: 'Close but Unreliable & Offline',
        distance_km: 2.0, // closer
        reliability_score: 30, // unreliable
        avg_response_seconds: 4000,
        availability_windows: [{ day: 'friday', start: '10:00', end: '12:00' }], // not available now
      };

      const donorB = {
        id: 'donor-B',
        name: 'Slightly further but highly reliable & Available',
        distance_km: 5.0, // 5km away
        reliability_score: 95, // very reliable
        avg_response_seconds: 150, // 2.5 mins
        availability_windows: [{ day: 'monday', start: '18:00', end: '22:00' }], // available right now!
      };

      const ranked = rankCandidatesV2({
        candidates: [donorA, donorB],
        maxRadiusKm: 15,
        referenceDate: testDate,
      });

      expect(ranked[0].id).toBe('donor-B');
      expect(ranked[0].v2Ranking.compositeScore).toBeGreaterThan(ranked[1].v2Ranking.compositeScore);
    });
  });
});
