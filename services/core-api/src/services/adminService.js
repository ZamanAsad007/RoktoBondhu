const adminRepository = require('../repositories/adminRepository');
const reportRepository = require('../repositories/reportRepository');
const userRepository = require('../repositories/userRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

class AdminService {
  async getDashboardStats() {
    return adminRepository.getStats();
  }

  async listAllRequests(query = {}) {
    const limit = Math.min(parseInt(query.limit, 10) || 50, 100);
    const offset = parseInt(query.offset, 10) || 0;
    const status = query.status || null;

    return adminRepository.getAllRequests({ status, limit, offset });
  }

  async listReports(query = {}) {
    const limit = Math.min(parseInt(query.limit, 10) || 50, 100);
    const offset = parseInt(query.offset, 10) || 0;
    const status = query.status || null;

    return reportRepository.findAll({ status, limit, offset });
  }

  async updateReport(reportId, { status, resolutionNotes }, adminUser) {
    const existing = await reportRepository.findById(reportId);
    if (!existing) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await reportRepository.updateStatus(reportId, {
      status,
      resolutionNotes,
    });

    await auditLogRepository.log({
      actorId: adminUser.id,
      action: 'REPORT_UPDATED',
      entity: 'reports',
      entityId: reportId,
      metadata: { previous_status: existing.status, new_status: status },
    });

    return updated;
  }

  async setBlockUser(userId, isBlocked, adminUser) {
    const targetUser = await userRepository.findById(userId);
    if (!targetUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (targetUser.role === 'ADMIN') {
      const err = new Error('Cannot block another admin user');
      err.statusCode = 400;
      throw err;
    }

    const updated = await userRepository.setBlocked(userId, isBlocked);

    await auditLogRepository.log({
      actorId: adminUser.id,
      action: isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
      entity: 'users',
      entityId: userId,
      metadata: { is_blocked: isBlocked },
    });

    return updated;
  }

  async createReport(reporterUser, { requestId = null, userId = null, reason, details = null }) {
    if (!reason || reason.trim().length === 0) {
      const err = new Error('Report reason is required');
      err.statusCode = 400;
      throw err;
    }

    if (!requestId && !userId) {
      const err = new Error('Must provide either a requestId or userId to report');
      err.statusCode = 400;
      throw err;
    }

    const report = await reportRepository.create({
      reporterId: reporterUser.id,
      requestId,
      userId,
      reason,
      details,
    });

    await auditLogRepository.log({
      actorId: reporterUser.id,
      action: 'REPORT_CREATED',
      entity: 'reports',
      entityId: report.id,
      metadata: { request_id: requestId, user_id: userId, reason },
    });

    return report;
  }

  async searchUsers(query) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return adminRepository.searchUsers(query.trim());
  }
}

module.exports = new AdminService();
