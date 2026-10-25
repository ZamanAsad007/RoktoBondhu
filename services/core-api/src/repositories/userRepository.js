const { query } = require('../config/db');

class UserRepository {
  async createUser({ name, email, phone, passwordHash, role = 'USER' }) {
    const text = `
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, phone, role, phone_verified, is_blocked, created_at;
    `;
    const values = [name, email, phone, passwordHash, role];
    const { rows } = await query(text, values);
    return rows[0];
  }

  async findById(id) {
    const text = `
      SELECT id, name, email, phone, role, phone_verified, is_blocked, created_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await query(text, [id]);
    return rows[0] || null;
  }

  async findByIdWithPassword(id) {
    const text = `
      SELECT id, name, email, phone, password_hash, role, phone_verified, is_blocked, created_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await query(text, [id]);
    return rows[0] || null;
  }

  async findByEmail(email) {
    const text = `
      SELECT id, name, email, phone, password_hash, role, phone_verified, is_blocked, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1);
    `;
    const { rows } = await query(text, [email]);
    return rows[0] || null;
  }

  async findByPhone(phone) {
    const text = `
      SELECT id, name, email, phone, password_hash, role, phone_verified, is_blocked, created_at
      FROM users
      WHERE phone = $1;
    `;
    const { rows } = await query(text, [phone]);
    return rows[0] || null;
  }

  async findByIdentifier(identifier) {
    const text = `
      SELECT id, name, email, phone, password_hash, role, phone_verified, is_blocked, created_at
      FROM users
      WHERE LOWER(email) = LOWER($1) OR phone = $1;
    `;
    const { rows } = await query(text, [identifier]);
    return rows[0] || null;
  }

  async updatePhoneVerified(userId, verified = true) {
    const text = `
      UPDATE users
      SET phone_verified = $2
      WHERE id = $1
      RETURNING id, name, email, phone, role, phone_verified, is_blocked, created_at;
    `;
    const { rows } = await query(text, [userId, verified]);
    return rows[0] || null;
  }

  async updatePhoneVerifiedByPhone(phone, verified = true) {
    const text = `
      UPDATE users
      SET phone_verified = $2
      WHERE phone = $1
      RETURNING id, name, email, phone, role, phone_verified, is_blocked, created_at;
    `;
    const { rows } = await query(text, [phone, verified]);
    return rows[0] || null;
  }

  async setBlocked(userId, isBlocked = true) {
    const text = `
      UPDATE users
      SET is_blocked = $2
      WHERE id = $1
      RETURNING id, name, email, phone, role, phone_verified, is_blocked, created_at;
    `;
    const { rows } = await query(text, [userId, isBlocked]);
    return rows[0] || null;
  }
}

module.exports = new UserRepository();
