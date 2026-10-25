const userRepository = require('../repositories/userRepository');
const tokenRepository = require('../repositories/tokenRepository');
const otpService = require('./otpService');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiresAt,
} = require('../utils/token');

class AuthService {
  async register({ name, email, phone, password, role = 'USER' }) {
    // Check existing email
    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 409;
      throw err;
    }

    // Check existing phone
    const existingPhone = await userRepository.findByPhone(phone);
    if (existingPhone) {
      const err = new Error('An account with this phone number already exists');
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await hashPassword(password);
    const user = await userRepository.createUser({
      name,
      email,
      phone,
      passwordHash,
      role,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await tokenRepository.storeRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Auto-generate OTP for phone verification
    const otpResult = await otpService.generateAndSendOtp(user.phone);

    return {
      user,
      accessToken,
      refreshToken,
      otp: otpResult,
    };
  }

  async login({ identifier, email, password }) {
    const targetIdentifier = identifier || email;
    const user = await userRepository.findByIdentifier(targetIdentifier);

    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    if (user.is_blocked) {
      const err = new Error('Account is blocked. Contact support.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const tokenHash = hashToken(refreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await tokenRepository.storeRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Don't leak password hash
    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  }

  async refresh(rawRefreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await tokenRepository.findByHash(tokenHash);

    if (!storedToken || storedToken.revoked_at !== null) {
      const error = new Error('Refresh token has been revoked or does not exist');
      error.statusCode = 401;
      throw error;
    }

    if (new Date(storedToken.expires_at) <= new Date()) {
      const error = new Error('Refresh token has expired');
      error.statusCode = 401;
      throw error;
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      throw error;
    }

    if (user.is_blocked) {
      const error = new Error('Account is blocked');
      error.statusCode = 403;
      throw error;
    }

    // Token rotation: Revoke old token
    await tokenRepository.revokeByHash(tokenHash);

    // Issue new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = getRefreshTokenExpiresAt();

    await tokenRepository.storeRefreshToken({
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout({ refreshToken, userId }) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await tokenRepository.revokeByHash(tokenHash);
    } else if (userId) {
      await tokenRepository.revokeAllForUser(userId);
    }
    return true;
  }

  async sendOtp({ phone, user }) {
    const targetPhone = phone || (user && user.phone);
    if (!targetPhone) {
      const err = new Error('Phone number is required');
      err.statusCode = 400;
      throw err;
    }

    return otpService.generateAndSendOtp(targetPhone);
  }

  async verifyPhone({ phone, otp, user }) {
    const targetPhone = phone || (user && user.phone);
    if (!targetPhone) {
      const err = new Error('Phone number is required');
      err.statusCode = 400;
      throw err;
    }

    const result = await otpService.verifyOtp(targetPhone, otp);
    if (!result.valid) {
      const err = new Error(result.message);
      err.statusCode = 400;
      throw err;
    }

    let updatedUser;
    if (user && user.id) {
      updatedUser = await userRepository.updatePhoneVerified(user.id, true);
    } else {
      updatedUser = await userRepository.updatePhoneVerifiedByPhone(targetPhone, true);
    }

    return {
      verified: true,
      user: updatedUser,
    };
  }
}

module.exports = new AuthService();
