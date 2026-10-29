const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.NOTIFICATION_PORT, 10) || 5001,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5433,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'roktobondhu',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6380,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  mailpit: {
    host: process.env.MAILPIT_HOST || 'localhost',
    port: parseInt(process.env.MAILPIT_SMTP_PORT, 10) || 1025,
    from: process.env.EMAIL_FROM || 'RoktoBondhu Alerts <alerts@roktobondhu.org>',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:support@roktobondhu.org',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'mock_telegram_bot_token',
  },
  queueName: 'notifications',
};
