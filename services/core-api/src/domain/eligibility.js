/**
 * Donor Eligibility Business Rules
 *
 * Checks:
 * - Available status (requireAvailable)
 * - Phone verification (requirePhoneVerified)
 * - User blocked status (must not be blocked)
 * - Age range (minAge <= age <= maxAge)
 * - Cooldown period between donations (cooldownDays)
 * - No active accepted unfulfilled request
 */

const defaultConfig = require('../config/eligibility.config');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates a person's age in full years given their date of birth.
 * @param {string | Date} dateOfBirth
 * @param {Date} [referenceDate=new Date()]
 * @returns {number}
 */
function calculateAge(dateOfBirth, referenceDate = new Date()) {
  if (!dateOfBirth) {
    return NaN;
  }
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    return NaN;
  }

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Checks whether the minimum cooldown gap (in days) has elapsed since the donor's last donation.
 * If lastDonatedAt is null or undefined, the cooldown is satisfied by default.
 * @param {string | Date | null} lastDonatedAt
 * @param {number} [cooldownDays=90]
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ satisfied: boolean, daysElapsed: number | null }}
 */
function isCooldownSatisfied(lastDonatedAt, cooldownDays = defaultConfig.cooldownDays, referenceDate = new Date()) {
  if (!lastDonatedAt) {
    return { satisfied: true, daysElapsed: null };
  }

  const lastDate = lastDonatedAt instanceof Date ? lastDonatedAt : new Date(lastDonatedAt);
  if (isNaN(lastDate.getTime())) {
    return { satisfied: false, daysElapsed: null };
  }

  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const diffMs = ref.getTime() - lastDate.getTime();
  const daysElapsed = Math.floor(diffMs / MS_PER_DAY);

  return {
    satisfied: daysElapsed >= cooldownDays,
    daysElapsed,
  };
}

/**
 * Evaluates full donor eligibility based on donor profile, user flags, and configurable limits.
 *
 * @param {Object} donor - Donor data
 * @param {boolean} [donor.available]
 * @param {boolean} [donor.phone_verified]
 * @param {boolean} [donor.phoneVerified]
 * @param {boolean} [donor.is_blocked]
 * @param {boolean} [donor.isBlocked]
 * @param {string | Date} [donor.date_of_birth]
 * @param {string | Date} [donor.dateOfBirth]
 * @param {string | Date | null} [donor.last_donated_at]
 * @param {string | Date | null} [donor.lastDonatedAt]
 * @param {boolean} [donor.hasActiveAcceptedRequest]
 * @param {Object} [configOverrides={}]
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ eligible: boolean, reasons: string[] }}
 */
function isDonorEligible(donor = {}, configOverrides = {}, referenceDate = new Date()) {
  const config = { ...defaultConfig, ...configOverrides };
  const reasons = [];

  // 1. Availability check
  const isAvailable = donor.available !== undefined ? Boolean(donor.available) : false;
  if (config.requireAvailable && !isAvailable) {
    reasons.push('Donor has set their status to unavailable');
  }

  // 2. Phone verification check
  const isPhoneVerified =
    donor.phone_verified !== undefined
      ? Boolean(donor.phone_verified)
      : donor.phoneVerified !== undefined
      ? Boolean(donor.phoneVerified)
      : false;
  if (config.requirePhoneVerified && !isPhoneVerified) {
    reasons.push('Donor phone number is not verified');
  }

  // 3. Blocked status check
  const isBlocked =
    donor.is_blocked !== undefined
      ? Boolean(donor.is_blocked)
      : donor.isBlocked !== undefined
      ? Boolean(donor.isBlocked)
      : false;
  if (isBlocked) {
    reasons.push('Donor account is suspended or blocked');
  }

  // 4. Age range check
  const dob = donor.date_of_birth || donor.dateOfBirth;
  const age = calculateAge(dob, referenceDate);
  if (isNaN(age)) {
    reasons.push('Donor date of birth is missing or invalid');
  } else if (age < config.minAge) {
    reasons.push(`Donor age (${age}) is below minimum required age of ${config.minAge}`);
  } else if (age > config.maxAge) {
    reasons.push(`Donor age (${age}) exceeds maximum allowed age of ${config.maxAge}`);
  }

  // 5. Cooldown check
  const lastDonated = donor.last_donated_at !== undefined ? donor.last_donated_at : donor.lastDonatedAt;
  if (lastDonated) {
    const cooldownResult = isCooldownSatisfied(lastDonated, config.cooldownDays, referenceDate);
    if (!cooldownResult.satisfied) {
      const daysText = cooldownResult.daysElapsed !== null ? `${cooldownResult.daysElapsed} days` : 'recent';
      reasons.push(
        `Minimum cooldown of ${config.cooldownDays} days between donations has not elapsed (last donated: ${daysText} ago)`
      );
    }
  }

  // 6. Active accepted request check
  if (donor.hasActiveAcceptedRequest) {
    reasons.push('Donor currently has an active accepted blood request in progress');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

module.exports = {
  calculateAge,
  isCooldownSatisfied,
  isDonorEligible,
};
