/**
 * Pure Badge Engine for RoktoBondhu Gamification
 * Evaluates donor actions and determines newly unlocked badges.
 */

const BADGE_DEFINITIONS = Object.freeze({
  FIRST_DONATION: {
    code: 'FIRST_DONATION',
    name: 'First Donation',
    description: 'Donated blood for the first time and saved a life.',
    icon: '🩸',
  },
  DONOR_BRONZE: {
    code: 'DONOR_BRONZE',
    name: 'Bronze Life Saver',
    description: 'Completed 3 successful blood donations.',
    icon: '🥉',
  },
  DONOR_SILVER: {
    code: 'DONOR_SILVER',
    name: 'Silver Life Saver',
    description: 'Completed 5 successful blood donations.',
    icon: '🥈',
  },
  DONOR_GOLD: {
    code: 'DONOR_GOLD',
    name: 'Gold Life Saver',
    description: 'Completed 10 successful blood donations.',
    icon: '🥇',
  },
  RAPID_RESPONDER: {
    code: 'RAPID_RESPONDER',
    name: 'Rapid Responder',
    description: 'Accepted an emergency match request within 10 minutes.',
    icon: '⚡',
  },
  LIFE_SAVER: {
    code: 'LIFE_SAVER',
    name: 'Critical Life Saver',
    description: 'Fulfilled a high-priority CRITICAL emergency blood request.',
    icon: '❤️‍🩹',
  },
});

/**
 * Pure function to evaluate newly unlocked badges
 * @param {Object} params
 * @param {number} params.totalDonations - Total confirmed donations including current
 * @param {number|null} [params.responseTimeSeconds] - Response time in seconds for the match
 * @param {string} [params.urgency] - Urgency of the request ('CRITICAL' or 'NORMAL')
 * @param {string[]} [params.existingBadgeCodes=[]] - Already earned badge codes
 * @returns {Array<{ code: string, name: string, description: string, icon: string }>} Newly earned badges
 */
function evaluateBadges({
  totalDonations = 0,
  responseTimeSeconds = null,
  urgency = 'NORMAL',
  existingBadgeCodes = [],
}) {
  const earnedSet = new Set(existingBadgeCodes);
  const newBadges = [];

  // 1. First Donation
  if (totalDonations >= 1 && !earnedSet.has(BADGE_DEFINITIONS.FIRST_DONATION.code)) {
    newBadges.push(BADGE_DEFINITIONS.FIRST_DONATION);
    earnedSet.add(BADGE_DEFINITIONS.FIRST_DONATION.code);
  }

  // 2. 3 Donations (Bronze)
  if (totalDonations >= 3 && !earnedSet.has(BADGE_DEFINITIONS.DONOR_BRONZE.code)) {
    newBadges.push(BADGE_DEFINITIONS.DONOR_BRONZE);
    earnedSet.add(BADGE_DEFINITIONS.DONOR_BRONZE.code);
  }

  // 3. 5 Donations (Silver)
  if (totalDonations >= 5 && !earnedSet.has(BADGE_DEFINITIONS.DONOR_SILVER.code)) {
    newBadges.push(BADGE_DEFINITIONS.DONOR_SILVER);
    earnedSet.add(BADGE_DEFINITIONS.DONOR_SILVER.code);
  }

  // 4. 10 Donations (Gold)
  if (totalDonations >= 10 && !earnedSet.has(BADGE_DEFINITIONS.DONOR_GOLD.code)) {
    newBadges.push(BADGE_DEFINITIONS.DONOR_GOLD);
    earnedSet.add(BADGE_DEFINITIONS.DONOR_GOLD.code);
  }

  // 5. Rapid Responder (accepted within 10 min = 600 seconds)
  if (
    responseTimeSeconds !== null &&
    responseTimeSeconds !== undefined &&
    responseTimeSeconds <= 600 &&
    !earnedSet.has(BADGE_DEFINITIONS.RAPID_RESPONDER.code)
  ) {
    newBadges.push(BADGE_DEFINITIONS.RAPID_RESPONDER);
    earnedSet.add(BADGE_DEFINITIONS.RAPID_RESPONDER.code);
  }

  // 6. Life Saver (critical request)
  if (urgency === 'CRITICAL' && !earnedSet.has(BADGE_DEFINITIONS.LIFE_SAVER.code)) {
    newBadges.push(BADGE_DEFINITIONS.LIFE_SAVER);
    earnedSet.add(BADGE_DEFINITIONS.LIFE_SAVER.code);
  }

  return newBadges;
}

module.exports = {
  BADGE_DEFINITIONS,
  evaluateBadges,
};
