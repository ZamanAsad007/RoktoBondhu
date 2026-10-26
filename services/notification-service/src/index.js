const { startNotificationWorker, closeNotificationWorker } = require('./workers/notificationWorker');
const { pool } = require('./config/db');

async function start() {
  try {
    console.log('[Notification Service] Initializing database connection...');
    await pool.query('SELECT 1');
    console.log('[Notification Service] Database connected.');

    const worker = startNotificationWorker();
    console.log('[Notification Service] BullMQ notification worker listening on queue: notifications');

    async function shutdown(signal) {
      console.log(`[Notification Service] Received ${signal}. Shutting down gracefully...`);
      await closeNotificationWorker();
      await pool.end();
      console.log('[Notification Service] Shutdown complete.');
      process.exit(0);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[Notification Service] Fatal startup error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
