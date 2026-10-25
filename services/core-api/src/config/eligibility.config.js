/**
 * Configurable donor eligibility criteria.
 * Default values can be altered to comply with local healthcare directives.
 */
module.exports = {
  // Minimum days required between consecutive whole blood donations
  cooldownDays: 90,

  // Allowed donor age range
  minAge: 18,
  maxAge: 60,

  // Verification requirements
  requirePhoneVerified: true,
  requireAvailable: true,
};
