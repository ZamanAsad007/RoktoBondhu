/**
 * Domain Logic: Donor Reliability Score & Weekly Availability Windows (Phase 18)
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Pure function: Calculate donor reliability score (10 to 100)
 *
 * Formula:
 * - Base score for new donors with 0 notifications = 85
 * - Response Rate (35% weight): (acceptedCount / max(1, notifiedCount)) * 100
 * - Completion / Fulfillment Rate (45% weight): (donatedCount / max(1, acceptedCount)) * 100
 * - Fast Response Bonus / Penalty (20% weight):
 *     <= 300s (5m): 100
 *     <= 900s (15m): 85
 *     <= 3600s (1h): 60
 *     > 3600s: 30
 * - No-show penalty: -15 points per recorded no-show
 * Result clamped to [10, 100]
 */
function calculateReliabilityScore({
  notifiedCount = 0,
  acceptedCount = 0,
  donatedCount = 0,
  noShowCount = 0,
  avgResponseSeconds = null,
} = {}) {
  // Brand new donor with no activity yet
  if (notifiedCount === 0 && acceptedCount === 0 && donatedCount === 0) {
    const penalty = (noShowCount || 0) * 15;
    return Math.max(10, Math.min(100, 85 - penalty));
  }

  const responseRate = (acceptedCount / Math.max(1, notifiedCount)) * 100;
  const fulfillmentRate = (donatedCount / Math.max(1, acceptedCount)) * 100;

  let speedScore = 70;
  if (avgResponseSeconds !== null && avgResponseSeconds !== undefined) {
    if (avgResponseSeconds <= 300) {
      speedScore = 100;
    } else if (avgResponseSeconds <= 900) {
      speedScore = 85;
    } else if (avgResponseSeconds <= 3600) {
      speedScore = 60;
    } else {
      speedScore = 30;
    }
  }

  const weightedBase =
    0.35 * Math.min(100, responseRate) +
    0.45 * Math.min(100, fulfillmentRate) +
    0.20 * speedScore;

  const noShowPenalty = (noShowCount || 0) * 15;
  const rawScore = weightedBase - noShowPenalty;

  return Math.round(Math.max(10, Math.min(100, rawScore)) * 10) / 10;
}

/**
 * Pure function: Check if current date/time falls within donor's weekly availability windows
 *
 * Windows structure example:
 * [
 *   { "day": "monday", "start": "17:00", "end": "22:00" },
 *   { "day": "friday", "start": "09:00", "end": "20:00" }
 * ]
 */
function isDonorInAvailabilityWindow(windows = [], date = new Date()) {
  if (!Array.isArray(windows) || windows.length === 0) {
    // If no windows configured, donor is considered available 24/7
    return true;
  }

  const dayOfWeek = DAYS[date.getDay()];
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  for (const win of windows) {
    if (!win.day || win.day.toLowerCase() !== dayOfWeek) {
      continue;
    }

    if (!win.start || !win.end) {
      // Entire day available
      return true;
    }

    const [startH, startM] = win.start.split(':').map((n) => parseInt(n, 10));
    const [endH, endM] = win.end.split(':').map((n) => parseInt(n, 10));
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return true;
    }
  }

  return false;
}

module.exports = {
  calculateReliabilityScore,
  isDonorInAvailabilityWindow,
};
