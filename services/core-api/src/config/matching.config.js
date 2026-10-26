/**
 * Configuration for matching waves, radius expansion, and timeouts.
 */
module.exports = {
  // Radius rings in kilometers for successive waves
  radiusRingsKm: [5, 10, 25, 50],

  // Wave timeouts in milliseconds based on urgency level
  waveTimeoutsMs: {
    CRITICAL: 10 * 60 * 1000, // 10 minutes
    URGENT: 30 * 60 * 1000,   // 30 minutes
    NORMAL: 60 * 60 * 1000,   // 60 minutes
  },

  // Number of donors to notify per unit needed
  donorsPerUnit: 5,

  // Maximum donors notified per single wave
  maxDonorsPerWave: 20,

  // Minimum donors notified per wave (if available)
  minDonorsPerWave: 5,
};
