const notificationRepository = require('../repositories/notificationRepository');

class NotificationService {
  async listMyNotifications(userId, query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
    const unreadOnly = query.unread_only === 'true' || query.unread_only === true;
    const channel = query.channel || 'in_app';

    const result = await notificationRepository.findByUserId(userId, {
      page,
      limit,
      unreadOnly,
      channel: query.channel === 'all' ? null : channel,
    });

    const unreadCount = await notificationRepository.countUnreadByUserId(
      userId,
      query.channel === 'all' ? null : channel
    );

    return {
      notifications: result.notifications,
      unread_count: unreadCount,
      pagination: result.pagination,
    };
  }

  async markAsRead(id, userId) {
    const notification = await notificationRepository.findById(id);
    if (!notification) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }

    if (notification.user_id !== userId) {
      const err = new Error('Forbidden: You do not have access to this notification');
      err.statusCode = 403;
      throw err;
    }

    return notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId) {
    const updatedCount = await notificationRepository.markAllAsRead(userId);
    return { updated_count: updatedCount };
  }
}

module.exports = new NotificationService();
