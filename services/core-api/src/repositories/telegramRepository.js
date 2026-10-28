const crypto = require('crypto');
const db = require('../config/db');

class TelegramRepository {
  /**
   * Generates a 6-digit one-time linking code valid for 15 minutes
   */
  async generateLinkCode(userId) {
    const code = crypto.randomInt(100000, 999999).toString();
    const query = `
      INSERT INTO telegram_links (user_id, link_code, code_expires_at, is_active, updated_at)
      VALUES ($1, $2, NOW() + INTERVAL '15 minutes', TRUE, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        link_code = EXCLUDED.link_code,
        code_expires_at = EXCLUDED.code_expires_at,
        updated_at = NOW()
      RETURNING link_code, code_expires_at;
    `;
    const res = await db.query(query, [userId, code]);
    return res.rows[0];
  }

  /**
   * Finds link record by active code
   */
  async findLinkByCode(linkCode) {
    const query = `
      SELECT tl.*, u.name, u.email, u.phone
      FROM telegram_links tl
      JOIN users u ON tl.user_id = u.id
      WHERE tl.link_code = $1 AND tl.code_expires_at > NOW();
    `;
    const res = await db.query(query, [linkCode]);
    return res.rows[0] || null;
  }

  /**
   * Completes account linking with Telegram chat_id and username
   */
  async linkTelegramAccount({ linkCode, chatId, username }) {
    const linkRecord = await this.findLinkByCode(linkCode);
    if (!linkRecord) {
      throw new Error('Invalid or expired linking code. Please request a new code from your RoktoBondhu app.');
    }

    const query = `
      UPDATE telegram_links
      SET telegram_chat_id = $1,
          telegram_username = $2,
          is_active = TRUE,
          link_code = NULL,
          code_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const res = await db.query(query, [chatId, username, linkRecord.id]);
    return {
      ...res.rows[0],
      userName: linkRecord.name,
      userPhone: linkRecord.phone,
    };
  }

  /**
   * Get link status by user ID
   */
  async getLinkByUserId(userId) {
    const query = `
      SELECT id, user_id, telegram_chat_id, telegram_username, is_active, created_at, updated_at
      FROM telegram_links
      WHERE user_id = $1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Get user and link by Telegram Chat ID
   */
  async getLinkByChatId(chatId) {
    const query = `
      SELECT tl.*, u.id as user_id, u.name, u.email, u.phone, u.role
      FROM telegram_links tl
      JOIN users u ON tl.user_id = u.id
      WHERE tl.telegram_chat_id = $1;
    `;
    const res = await db.query(query, [chatId]);
    return res.rows[0] || null;
  }

  /**
   * Toggle Telegram alerts active / paused status
   */
  async setChatActive(chatId, isActive) {
    const query = `
      UPDATE telegram_links
      SET is_active = $1, updated_at = NOW()
      WHERE telegram_chat_id = $2
      RETURNING *;
    `;
    const res = await db.query(query, [isActive, chatId]);
    return res.rows[0] || null;
  }

  /**
   * Unlink Telegram account for user
   */
  async unlinkAccount(userId) {
    const query = `
      DELETE FROM telegram_links
      WHERE user_id = $1
      RETURNING *;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }
}

module.exports = new TelegramRepository();
