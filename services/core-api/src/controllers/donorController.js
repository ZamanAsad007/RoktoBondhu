const donorService = require('../services/donorService');
const { sendSuccess } = require('../utils/response');

class DonorController {
  async upsertMe(req, res, next) {
    try {
      const profile = await donorService.upsertProfile(req.user.id, req.body);
      return sendSuccess(res, { profile }, 200);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const profile = await donorService.getProfile(req.user.id);
      return sendSuccess(res, { profile }, 200);
    } catch (err) {
      next(err);
    }
  }

  async updateAvailability(req, res, next) {
    try {
      const { available } = req.body;
      const profile = await donorService.updateAvailability(req.user.id, available);
      return sendSuccess(res, { profile }, 200);
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req, res, next) {
    try {
      const history = await donorService.getHistory(req.user.id);
      return sendSuccess(res, history, 200);
    } catch (err) {
      next(err);
    }
  }

  async updateAvailabilityWindows(req, res, next) {
    try {
      const { windows } = req.body;
      const result = await donorService.updateAvailabilityWindows(req.user.id, windows || []);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async getRecruitNudges(req, res, next) {
    try {
      const analyticsService = require('../services/analyticsService');
      const profile = await donorService.getProfile(req.user.id);
      const bloodGroup = profile ? profile.blood_group : null;
      const city = profile ? profile.city : null;
      const nudges = await analyticsService.getRecruitNudges(bloodGroup, city);
      return sendSuccess(res, { nudges }, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DonorController();
