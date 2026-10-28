const telegramRepository = require('../repositories/telegramRepository');
const donorRepository = require('../repositories/donorRepository');
const matchService = require('./matchService');
const bloodRequestRepository = require('../repositories/bloodRequestRepository');
const matchRepository = require('../repositories/matchRepository');
const config = require('../config');

class TelegramBotService {
  constructor() {
    this.botToken = config.telegram.botToken;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Send a message to Telegram Chat (calls Telegram API or logs in test mode)
   */
  async sendMessage(chatId, text, options = {}) {
    if (!this.botToken || this.botToken.startsWith('mock_') || process.env.NODE_ENV === 'test') {
      // In test/mock mode, return success payload without network call
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 100000),
          chat: { id: chatId },
          text,
          ...options,
        },
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          ...options,
        }),
      });
      return await response.json();
    } catch (err) {
      console.error('[TelegramBotService] Error calling Telegram sendMessage:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Answer callback queries from inline buttons
   */
  async answerCallbackQuery(callbackQueryId, text = '') {
    if (!this.botToken || this.botToken.startsWith('mock_') || process.env.NODE_ENV === 'test') {
      return { ok: true };
    }
    try {
      await fetch(`${this.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: true,
        }),
      });
    } catch (err) {
      console.error('[TelegramBotService] Error answering callback query:', err.message);
    }
  }

  /**
   * Main router for incoming Telegram updates (Webhook / Long-polling)
   */
  async handleUpdate(update) {
    if (!update) return { ok: false };

    // 1. Handle Inline Keyboard Callback Queries (Accept / Decline)
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    // 2. Handle Text Messages and Commands
    if (update.message && update.message.text) {
      return this.handleTextMessage(update.message);
    }

    return { ok: true, status: 'IGNORED' };
  }

  /**
   * Handles text messages & slash commands
   */
  async handleTextMessage(message) {
    const chatId = message.chat.id;
    const username = message.from?.username || message.from?.first_name || 'user';
    const rawText = message.text.trim();

    // Command: /start <code>
    if (rawText.startsWith('/start')) {
      const parts = rawText.split(/\s+/);
      const code = parts[1];

      if (!code) {
        return this.sendMessage(
          chatId,
          '👋 *Welcome to RoktoBondhu Bot!*\n\nTo link your account, visit your RoktoBondhu web profile, click *Connect Telegram*, and send `/start <code>` here.'
        );
      }

      try {
        const link = await telegramRepository.linkTelegramAccount({
          linkCode: code,
          chatId,
          username,
        });

        return this.sendMessage(
          chatId,
          `🎉 *Account Connected!*\n\nWelcome *${link.userName}*! Your Telegram account is now securely linked to RoktoBondhu.\n\nYou will receive emergency blood match alerts directly in this chat with instant *Accept* and *Decline* buttons.\n\nAvailable commands:\n• \`/status\` - View active donation invitations\n• \`/pause\` - Temporarily pause alerts\n• \`/resume\` - Reactivate alerts`
        );
      } catch (err) {
        return this.sendMessage(chatId, `⚠️ ${err.message}`);
      }
    }

    // Check if chat is linked
    const linkedUser = await telegramRepository.getLinkByChatId(chatId);
    if (!linkedUser) {
      return this.sendMessage(
        chatId,
        '⚠️ *Your Telegram account is not linked to RoktoBondhu.*\n\nPlease log in to the web app, generate a link code in Profile, and send `/start <code>`.'
      );
    }

    // Command: /status
    if (rawText === '/status') {
      const activeMatches = await matchRepository.findAcceptedMatchesByDonorId
        ? await matchRepository.findAcceptedMatchesByDonorId(linkedUser.user_id)
        : [];

      return this.sendMessage(
        chatId,
        `📋 *RoktoBondhu Status Summary*\n\nUser: *${linkedUser.name}*\nAvailability: *${linkedUser.is_active ? 'Active (Alerts Enabled)' : 'Paused'}*\nActive Donations: *${activeMatches.length}*\n\nThank you for being a registered volunteer donor!`
      );
    }

    // Command: /pause
    if (rawText === '/pause') {
      await telegramRepository.setChatActive(chatId, false);
      try {
        await donorRepository.updateAvailability(linkedUser.user_id, false);
      } catch (e) {
        console.error('[TelegramBotService] Error updating availability on pause:', e.message);
      }

      return this.sendMessage(
        chatId,
        '⏸️ *Alerts Paused*\n\nYour donor availability has been paused. You will not receive emergency alerts until you type `/resume`.'
      );
    }

    // Command: /resume
    if (rawText === '/resume') {
      await telegramRepository.setChatActive(chatId, true);
      try {
        await donorRepository.updateAvailability(linkedUser.user_id, true);
      } catch (e) {
        console.error('[TelegramBotService] Error updating availability on resume:', e.message);
      }

      return this.sendMessage(
        chatId,
        '▶️ *Alerts Resumed!*\n\nYou are now active and available for emergency donor matches in your area.'
      );
    }

    // Default response for unhandled text
    return this.sendMessage(
      chatId,
      'ℹ️ Type `/status` to check your invitations, `/pause` to pause alerts, or `/resume` to reactivate availability.'
    );
  }

  /**
   * Handles inline buttons callbacks (Accept / Decline)
   */
  async handleCallbackQuery(callbackQuery) {
    const callbackId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data || '';

    const linkedUser = await telegramRepository.getLinkByChatId(chatId);
    if (!linkedUser) {
      await this.answerCallbackQuery(callbackId, 'Account not linked to RoktoBondhu.');
      return { ok: false, error: 'Unlinked account' };
    }

    const [action, matchId] = data.split(':');

    if (action === 'accept' && matchId) {
      try {
        const result = await matchService.acceptMatch(matchId, {
          id: linkedUser.user_id,
          name: linkedUser.name,
          role: linkedUser.role,
        });

        await this.answerCallbackQuery(callbackId, '✅ Invitation Accepted! Thank you!');
        return this.sendMessage(
          chatId,
          `🩸 *Donation Confirmed!*\n\nThank you *${linkedUser.name}* for agreeing to donate!\nRequester Contact Phone: *${result.requesterPhone || 'Revealed in app'}*\nHospital: *${result.request?.hospital_name || 'Hospital'}*\n\nPlease proceed to the hospital as soon as possible.`
        );
      } catch (err) {
        await this.answerCallbackQuery(callbackId, `⚠️ ${err.message}`);
        return this.sendMessage(chatId, `⚠️ Could not accept invitation: ${err.message}`);
      }
    }

    if (action === 'decline' && matchId) {
      try {
        await matchService.declineMatch(matchId, {
          id: linkedUser.user_id,
          name: linkedUser.name,
        });

        await this.answerCallbackQuery(callbackId, 'Invitation declined.');
        return this.sendMessage(
          chatId,
          '❌ *Invitation Declined*\n\nThank you for letting us know. We will alert the next wave of eligible donors.'
        );
      } catch (err) {
        await this.answerCallbackQuery(callbackId, `⚠️ ${err.message}`);
        return this.sendMessage(chatId, `⚠️ Could not decline: ${err.message}`);
      }
    }

    return { ok: true };
  }
}

module.exports = new TelegramBotService();
