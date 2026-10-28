const telegramRepository = require('../repositories/telegramRepository');
const telegramBotService = require('../services/telegramBotService');
const config = require('../config');
const { sendSuccess, sendError } = require('../utils/response');

class TelegramController {
  async generateLinkCode(req, res, next) {
    try {
      const result = await telegramRepository.generateLinkCode(req.user.id);
      return sendSuccess(res, {
        linkCode: result.link_code,
        expiresAt: result.code_expires_at,
        botUsername: config.telegram.botUsername,
        instructions: `Send /start ${result.link_code} to @${config.telegram.botUsername} on Telegram`,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req, res, next) {
    try {
      const link = await telegramRepository.getLinkByUserId(req.user.id);
      return sendSuccess(res, {
        isLinked: Boolean(link && link.telegram_chat_id),
        telegramUsername: link?.telegram_username || null,
        isActive: link?.is_active ?? false,
        botUsername: config.telegram.botUsername,
      });
    } catch (err) {
      next(err);
    }
  }

  async unlinkAccount(req, res, next) {
    try {
      await telegramRepository.unlinkAccount(req.user.id);
      return sendSuccess(res, { message: 'Telegram account unlinked successfully' });
    } catch (err) {
      next(err);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      await telegramBotService.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[TelegramController] Webhook handling error:', err.message);
      return res.status(200).json({ ok: false, error: err.message });
    }
  }
}

module.exports = new TelegramController();
