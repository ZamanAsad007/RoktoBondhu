const app = require('./app');
const config = require('./config');
const { runMigrations } = require('./db/migrate');
const { pool } = require('./config/db');
const redis = require('./config/redis');
const sseService = require('./services/sseService');
const { initChatWebSocket, closeChatWebSocket } = require('./services/chatWebSocket');
const { startMatchingWorker, closeMatchingQueue } = require('./jobs/matchingQueue');
const { startOutboxPublisher, stopOutboxPublisher } = require('./jobs/outboxPublisher');

async function startServer() {
  try {
    console.log('[Server] Running database migrations...');
    await runMigrations();

    console.log('[Server] Checking Redis connection...');
    await redis.ping();
    console.log('[Server] Redis connected.');

    // Initialize Redis pub/sub subscriber for SSE fan-out
    sseService.initSubscriber();

    // Start background matching worker and transactional outbox publisher (Phase 23)
    startMatchingWorker();
    startOutboxPublisher();

    const server = app.listen(config.port, () => {
      console.log(`[Server] Core API service listening on port ${config.port} (${config.env})`);
    });

    // Initialize Chat WebSocket Gateway (Phase 19)
    initChatWebSocket(server);

    const shutdown = async () => {
      console.log('[Server] Shutting down gracefully...');
      stopOutboxPublisher();
      closeChatWebSocket();
      await closeMatchingQueue();
      server.close(async () => {
        try {
          await sseService.cleanup();
          await pool.end();
          await redis.quit();
          console.log('[Server] Database and Redis connections closed.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[Server] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
