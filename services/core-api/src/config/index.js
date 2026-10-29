const path = require('path');
const dotenv = require('dotenv');

// Load .env from root or core-api directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5433,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'roktobondhu',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6380,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'blood_donation_access_secret_key_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'blood_donation_refresh_secret_key_change_in_production',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  otp: {
    ttlSeconds: 300, // 5 minutes
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:support@roktobondhu.org',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'mock_telegram_bot_token',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'RoktoBondhuBot',
  },
};

module.exports = config;
