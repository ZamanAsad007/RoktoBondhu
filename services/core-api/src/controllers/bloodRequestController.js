const { bloodRequestService } = require('../services/bloodRequestService');
const { sendSuccess } = require('../utils/response');

class BloodRequestController {
  async createRequest(req, res, next) {
    try {
      const request = await bloodRequestService.createRequest(req.user, req.body);
      return sendSuccess(res, { request }, 201);
    } catch (err) {
      next(err);
    }
  }

  async getMyRequests(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;
      const requests = await bloodRequestService.listMyRequests(req.user, { limit, offset });
      return sendSuccess(res, { requests });
    } catch (err) {
      next(err);
    }
  }

  async getNearbyRequests(req, res, next) {
    try {
      const requests = await bloodRequestService.getNearbyRequestsForDonor(req.user, req.query);
      return sendSuccess(res, { requests });
    } catch (err) {
      next(err);
    }
  }

  async getRequestById(req, res, next) {
    try {
      const request = await bloodRequestService.getRequestById(req.params.id, req.user);
      return sendSuccess(res, { request });
    } catch (err) {
      next(err);
    }
  }

  async cancelRequest(req, res, next) {
    try {
      const request = await bloodRequestService.cancelRequest(req.params.id, req.user);
      return sendSuccess(res, { request }, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BloodRequestController();
