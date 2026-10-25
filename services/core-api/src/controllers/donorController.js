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
}

module.exports = new DonorController();
