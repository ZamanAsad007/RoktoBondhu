const matchService = require('../services/matchService');
const { sendSuccess } = require('../utils/response');

class MatchController {
  async acceptMatch(req, res, next) {
    try {
      const result = await matchService.acceptMatch(req.params.id, req.user);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async declineMatch(req, res, next) {
    try {
      const result = await matchService.declineMatch(req.params.id, req.user);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async getMyMatches(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;
      const matches = await matchService.listMyMatches(req.user, { limit, offset });
      return sendSuccess(res, { matches }, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MatchController();
