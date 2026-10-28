/**
 * Matching Algorithm v2: Trust, Reliability & Availability-Aware Weighted Ranking (Phase 18)
 */

const { isDonorInAvailabilityWindow } = require('./reliabilityScore');

const DEFAULT_WEIGHTS = {
  distance: 0.35,
  reliability: 0.30,
  recentResponse: 0.15,
  availability: 0.20,
};

/**
 * Pure function: Rank candidates using v2 multi-factor weighted scoring
 *
 * @param {Array} candidates - Candidate donor records
 * @param {number} maxRadiusKm - Maximum radius for wave (e.g. 10 or 25 km)
 * @param {Object} weights - Normalized weighting factors
 * @param {Date} referenceDate - Evaluation timestamp
 * @returns {Array} Candidates sorted with ranking scores
 */
function rankCandidatesV2({
  candidates = [],
  maxRadiusKm = 20,
  weights = DEFAULT_WEIGHTS,
  referenceDate = new Date(),
} = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  const scored = candidates.map((c) => {
    // 1. Distance factor (0 to 1, closer = higher score)
    const distanceKm = typeof c.distance_km === 'number' ? c.distance_km : parseFloat(c.distance_km) || 0;
    const distanceScore = Math.max(0, 1 - distanceKm / Math.max(1, maxRadiusKm));

    // 2. Reliability factor (0 to 1, derived from reliability_score [10-100])
    const reliability = typeof c.reliability_score === 'number' ? c.reliability_score : 85;
    const reliabilityScore = Math.max(0, Math.min(1, reliability / 100));

    // 3. Recent response factor (0 to 1)
    let recentResponseScore = 0.5; // neutral baseline
    if (c.avg_response_seconds !== null && c.avg_response_seconds !== undefined) {
      if (c.avg_response_seconds <= 300) recentResponseScore = 1.0;
      else if (c.avg_response_seconds <= 900) recentResponseScore = 0.8;
      else if (c.avg_response_seconds <= 3600) recentResponseScore = 0.5;
      else recentResponseScore = 0.2;
    }

    // 4. Availability window factor (1.0 if currently in window, 0.25 if outside)
    const inWindow = isDonorInAvailabilityWindow(c.availability_windows, referenceDate);
    const availabilityScore = inWindow ? 1.0 : 0.25;

    // Composite weighted score
    const compositeScore =
      w.distance * distanceScore +
      w.reliability * reliabilityScore +
      w.recentResponse * recentResponseScore +
      w.availability * availabilityScore;

    return {
      ...c,
      v2Ranking: {
        distanceKm,
        distanceScore: Math.round(distanceScore * 1000) / 1000,
        reliabilityScore: Math.round(reliabilityScore * 1000) / 1000,
        recentResponseScore: Math.round(recentResponseScore * 1000) / 1000,
        availabilityScore,
        compositeScore: Math.round(compositeScore * 1000) / 1000,
      },
    };
  });

  // Sort candidates by highest composite score first
  return scored.sort((a, b) => b.v2Ranking.compositeScore - a.v2Ranking.compositeScore);
}

module.exports = {
  DEFAULT_WEIGHTS,
  rankCandidatesV2,
};
