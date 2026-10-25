const redis = require('../config/redis');
const config = require('../config');

class OtpService {
  getRedisKey(phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    return `otp:${cleanPhone}`;
  }

  async generateAndSendOtp(phone) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const key = this.getRedisKey(cleanPhone);

    await redis.set(key, otpCode, 'EX', config.otp.ttlSeconds);

    // Mock OTP delivery: output to console
    console.log(`[MOCK OTP] Phone: ${cleanPhone}, OTP: ${otpCode} (Expires in ${config.otp.ttlSeconds}s)`);

    return {
      phone: cleanPhone,
      expiresIn: config.otp.ttlSeconds,
      // Include mockOtp in test environment for deterministic assertions
      mockOtp: process.env.NODE_ENV === 'test' ? otpCode : undefined,
    };
  }

  async verifyOtp(phone, inputOtp) {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const key = this.getRedisKey(cleanPhone);
    const storedOtp = await redis.get(key);

    if (!storedOtp) {
      return {
        valid: false,
        message: 'OTP has expired or was not requested',
      };
    }

    if (storedOtp !== inputOtp.toString().trim()) {
      return {
        valid: false,
        message: 'Invalid OTP code',
      };
    }

    // OTP verified successfully, clear it
    await redis.del(key);
    return {
      valid: true,
      message: 'OTP verified successfully',
    };
  }
}

module.exports = new OtpService();
