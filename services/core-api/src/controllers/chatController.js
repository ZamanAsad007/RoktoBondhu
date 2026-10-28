const chatService = require('../services/chatService');
const { sendSuccess, sendError } = require('../utils/response');

class ChatController {
  async getThreadForMatch(req, res, next) {
    try {
      const { matchId } = req.params;
      const thread = await chatService.getThreadForMatch(matchId, req.user);
      return sendSuccess(res, thread);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  async getThreadById(req, res, next) {
    try {
      const { threadId } = req.params;
      const thread = await chatService.getThreadById(threadId, req.user);
      return sendSuccess(res, thread);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  async getMessages(req, res, next) {
    try {
      const { threadId } = req.params;
      const limit = parseInt(req.query.limit, 10) || 100;
      const messages = await chatService.getMessages(threadId, req.user, limit);
      return sendSuccess(res, messages);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { threadId } = req.params;
      const { content } = req.body;
      const message = await chatService.sendMessage({
        threadId,
        currentUser: req.user,
        content,
      });
      return sendSuccess(res, message, 201);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  async sharePhone(req, res, next) {
    try {
      const { threadId } = req.params;
      const result = await chatService.sharePhone({
        threadId,
        currentUser: req.user,
      });
      return sendSuccess(res, result);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  async blockUser(req, res, next) {
    try {
      const { threadId } = req.params;
      const { reason } = req.body;
      const result = await chatService.blockUser({
        threadId,
        currentUser: req.user,
        reason,
      });
      return sendSuccess(res, {
        message: 'User blocked and chat thread closed successfully',
        thread: result,
      });
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode);
      }
      next(err);
    }
  }
}

module.exports = new ChatController();
