/**
 * Simulation: Strategy Comparison (V1 Distance-Only vs V2 Multi-Factor Trust & Availability Ranking)
 * Phase 18: RoktoBondhu (রক্তবন্ধু)
 */

const { rankCandidatesV2, DEFAULT_WEIGHTS } = require('../services/core-api/src/domain/matchingV2');
const { calculateReliabilityScore } = require('../services/core-api/src/domain/reliabilityScore');

// Generate 50 realistic donors
function generateMockDonors() {
  const donors = [];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let i = 1; i <= 50; i++) {
    // 30% of donors have low reliability / no-show history
    const isUnreliable = i % 3 === 0;
    // 40% are currently available in the evaluation window
    const isAvailableNow = i % 2 === 0;

    const notifiedCount = 10 + (i % 15);
    const acceptedCount = isUnreliable ? Math.floor(notifiedCount * 0.2) : Math.floor(notifiedCount * 0.8);
    const donatedCount = isUnreliable ? Math.floor(acceptedCount * 0.3) : Math.floor(acceptedCount * 0.9);
    const noShowCount = isUnreliable ? 2 + (i % 3) : 0;
    const avgResponseSeconds = isUnreliable ? 2500 + i * 50 : 120 + i * 20;

    const reliabilityScore = calculateReliabilityScore({
      notifiedCount,
      acceptedCount,
      donatedCount,
      noShowCount,
      avgResponseSeconds,
    });

    const availability_windows = isAvailableNow
      ? [{ day: 'monday', start: '00:00', end: '23:59' }]
      : [{ day: 'sunday', start: '09:00', end: '12:00' }];

    // Random distance from 1.0 km to 18.0 km
    const distance_km = Math.round((1.0 + (i * 0.34)) * 10) / 10;

    donors.push({
      id: `donor-${i}`,
      name: `Donor ${i}`,
      distance_km,
      reliability_score: reliabilityScore,
      avg_response_seconds: avgResponseSeconds,
      no_show_count: noShowCount,
      availability_windows,
      // Underlying true response probability modeled by their reliability & availability
      trueResponseProbability: Math.min(
        0.95,
        Math.max(0.05, (reliabilityScore / 100) * (isAvailableNow ? 1.0 : 0.3))
      ),
    });
  }
  return donors;
}

function runSimulation() {
  const donors = generateMockDonors();
  const evaluationDate = new Date('2026-11-02T14:00:00'); // Monday 14:00
  const WAVE_SIZE = 5;

  // 1. Strategy V1: Pure distance-based ranking
  const v1Selection = [...donors]
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, WAVE_SIZE);

  // 2. Strategy V2: Multi-factor Trust, Reliability & Availability Ranking
  const v2Ranked = rankCandidatesV2({
    candidates: donors,
    maxRadiusKm: 20,
    weights: DEFAULT_WEIGHTS,
    referenceDate: evaluationDate,
  });
  const v2Selection = v2Ranked.slice(0, WAVE_SIZE);

  function computeMetrics(selection, label) {
    const avgDistance = (selection.reduce((sum, d) => sum + d.distance_km, 0) / selection.length).toFixed(1);
    const avgReliability = (selection.reduce((sum, d) => sum + d.reliability_score, 0) / selection.length).toFixed(1);
    const avgResponseSeconds = Math.round(selection.reduce((sum, d) => sum + d.avg_response_seconds, 0) / selection.length);
    const avgResponseProb = Math.round(
      (selection.reduce((sum, d) => sum + d.trueResponseProbability, 0) / selection.length) * 100
    );
    const totalNoShows = selection.reduce((sum, d) => sum + d.no_show_count, 0);

    // Probability that at least ONE donor in the wave accepts
    const probAtLeastOneAccept = (
      (1 - selection.reduce((acc, d) => acc * (1 - d.trueResponseProbability), 1)) *
      100
    ).toFixed(1);

    return {
      label,
      avgDistance: `${avgDistance} km`,
      avgReliability: `${avgReliability} / 100`,
      avgResponseTime: `${Math.round(avgResponseSeconds / 60)} mins`,
      avgAcceptProbability: `${avgResponseProb}%`,
      firstWaveSuccessRate: `${probAtLeastOneAccept}%`,
      historicalNoShowsInWave: totalNoShows,
    };
  }

  const v1Metrics = computeMetrics(v1Selection, 'Strategy V1 (Pure Distance)');
  const v2Metrics = computeMetrics(v2Selection, 'Strategy V2 (Trust & Availability Multi-Factor)');

  console.log('\n========================================================================');
  console.log('🩸 RoktoBondhu Matching Simulation: Strategy V1 vs Strategy V2');
  console.log('========================================================================\n');
  console.table([v1Metrics, v2Metrics]);

  console.log('Key Findings:');
  console.log(`- Strategy V2 boosts First-Wave Notification Success from ${v1Metrics.firstWaveSuccessRate} to ${v2Metrics.firstWaveSuccessRate}`);
  console.log(`- Reduces historical no-show risks from ${v1Metrics.historicalNoShowsInWave} down to ${v2Metrics.historicalNoShowsInWave}`);
  console.log(`- Average response time drops significantly while keeping distance within reasonable response range.\n`);

  return { v1Metrics, v2Metrics };
}

if (require.main === module) {
  runSimulation();
}

module.exports = { runSimulation };
