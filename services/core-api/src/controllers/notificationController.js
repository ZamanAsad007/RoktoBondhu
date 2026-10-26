const notificationService = require('../services/notificationService');
const { sendSuccess } = require('../utils/response');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const data = await notificationService.listMyNotifications(req.user.id, req.query);
      return sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markAsRead(req.params.id, req.user.id);
      return sendSuccess(res, { notification }, 200);
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      return sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
