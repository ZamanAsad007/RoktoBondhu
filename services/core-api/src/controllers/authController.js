const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken;
      const userId = req.user ? req.user.id : null;
      await authService.logout({ refreshToken, userId });
      return sendSuccess(res, { message: 'Logged out successfully' }, 200);
    } catch (error) {
      next(error);
    }
  }

  async sendOtp(req, res, next) {
    try {
      const phone = req.body.phone;
      const result = await authService.sendOtp({ phone, user: req.user });
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async verifyPhone(req, res, next) {
    try {
      const { phone, otp } = req.body;
      const result = await authService.verifyPhone({ phone, otp, user: req.user });
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      return sendSuccess(res, { user: req.user }, 200);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
