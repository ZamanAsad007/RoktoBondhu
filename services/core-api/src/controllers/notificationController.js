const notificationService = require('../services/notificationService');
const pushRepository = require('../repositories/pushRepository');
const preferenceRepository = require('../repositories/preferenceRepository');
const config = require('../config');
const { sendSuccess, sendError } = require('../utils/response');

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

  async getVapidPublicKey(req, res, next) {
    try {
      return sendSuccess(res, { publicKey: config.vapid.publicKey });
    } catch (err) {
      next(err);
    }
  }

  async subscribePush(req, res, next) {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return sendError(res, 'Invalid subscription payload: endpoint and keys required', 400);
      }
      const subscription = await pushRepository.saveSubscription({
        userId: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      return sendSuccess(res, { message: 'Push subscription registered', subscription }, 201);
    } catch (err) {
      next(err);
    }
  }

  async unsubscribePush(req, res, next) {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return sendError(res, 'Endpoint required to unsubscribe', 400);
      }
      await pushRepository.removeSubscription({
        userId: req.user.id,
        endpoint,
      });
      return sendSuccess(res, { message: 'Push subscription removed' });
    } catch (err) {
      next(err);
    }
  }

  async getPreferences(req, res, next) {
    try {
      const preferences = await preferenceRepository.getPreferences(req.user.id);
      return sendSuccess(res, preferences);
    } catch (err) {
      next(err);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const preferences = await preferenceRepository.updatePreferences(req.user.id, req.body);
      return sendSuccess(res, preferences);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
