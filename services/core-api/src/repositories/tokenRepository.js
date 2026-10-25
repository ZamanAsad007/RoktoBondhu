const { query } = require('../config/db');

class TokenRepository {
  async storeRefreshToken({ userId, tokenHash, expiresAt }) {
    const text = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at;
    `;
    const { rows } = await query(text, [userId, tokenHash, expiresAt]);
    return rows[0];
  }

  async findByHash(tokenHash) {
    const text = `
      SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
      FROM refresh_tokens
      WHERE token_hash = $1;
    `;
    const { rows } = await query(text, [tokenHash]);
    return rows[0] || null;
  }

  async revokeByHash(tokenHash) {
    const text = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING id, user_id, token_hash, expires_at, revoked_at;
    `;
    const { rows } = await query(text, [tokenHash]);
    return rows[0] || null;
  }

  async revokeAllForUser(userId) {
    const text = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL;
    `;
    const { rowCount } = await query(text, [userId]);
    return rowCount;
  }
}

module.exports = new TokenRepository();
