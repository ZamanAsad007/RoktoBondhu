const donorRepository = require('../repositories/donorRepository');

class DonorService {
  async upsertProfile(userId, data) {
    const profile = await donorRepository.upsertProfile({
      userId,
      bloodGroup: data.blood_group,
      dateOfBirth: data.date_of_birth,
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      lastDonatedAt: data.last_donated_at,
      available: data.available,
    });

    return profile;
  }

  async getProfile(userId) {
    const profile = await donorRepository.findByUserId(userId);
    if (!profile) {
      const err = new Error('Donor profile not found');
      err.statusCode = 404;
      throw err;
    }
    return profile;
  }

  async updateAvailability(userId, available) {
    const profile = await donorRepository.updateAvailability(userId, available);
    if (!profile) {
      const err = new Error('Donor profile not found. Please create a profile first.');
      err.statusCode = 404;
      throw err;
    }
    return profile;
  }

  async getHistory(userId) {
    return donorRepository.getHistory(userId);
  }

  async updateAvailabilityWindows(userId, windows = []) {
    const updated = await donorRepository.updateAvailabilityWindows(userId, windows);
    if (!updated) {
      const err = new Error('Donor profile not found. Please create a profile first.');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  }
}

module.exports = new DonorService();
