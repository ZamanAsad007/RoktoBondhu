const adminService = require('../services/adminService');
const { sendSuccess } = require('../utils/response');

class AdminController {
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getDashboardStats();
      return sendSuccess(res, { stats });
    } catch (err) {
      next(err);
    }
  }

  async getRequests(req, res, next) {
    try {
      const requests = await adminService.listAllRequests(req.query);
      return sendSuccess(res, { requests });
    } catch (err) {
      next(err);
    }
  }

  async getReports(req, res, next) {
    try {
      const reports = await adminService.listReports(req.query);
      return sendSuccess(res, { reports });
    } catch (err) {
      next(err);
    }
  }

  async updateReport(req, res, next) {
    try {
      const { status, resolutionNotes } = req.body;
      const report = await adminService.updateReport(
        req.params.id,
        { status, resolutionNotes },
        req.user
      );
      return sendSuccess(res, { report });
    } catch (err) {
      next(err);
    }
  }

  async blockUser(req, res, next) {
    try {
      const { isBlocked } = req.body;
      const shouldBlock = isBlocked !== undefined ? Boolean(isBlocked) : true;
      const user = await adminService.setBlockUser(req.params.id, shouldBlock, req.user);
      return sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async createReport(req, res, next) {
    try {
      const { requestId, userId, reason, details } = req.body;
      const report = await adminService.createReport(req.user, {
        requestId,
        userId,
        reason,
        details,
      });
      return sendSuccess(res, { report }, 201);
    } catch (err) {
      next(err);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const users = await adminService.searchUsers(req.query.q);
      return sendSuccess(res, { users });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
