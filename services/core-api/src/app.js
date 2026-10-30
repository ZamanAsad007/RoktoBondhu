const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const bloodRequestRoutes = require('./routes/bloodRequestRoutes');
const matchRoutes = require('./routes/matchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const donorStatsController = require('./controllers/donorStatsController');
const bloodRequestController = require('./controllers/bloodRequestController');
const sseController = require('./controllers/sseController');
const { requireAuth, requireRole } = require('./middleware/auth');
const userRepository = require('./repositories/userRepository');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/response');
const correlationIdMiddleware = require('./middleware/correlationId');
const { metricsMiddleware, register } = require('./metrics/prometheus');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors());
app.use(correlationIdMiddleware);
app.use(metricsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
  app.use(rateLimiter({ windowMs: 60000, max: 200 }));
}

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Health check endpoint
app.get('/health', (req, res) => {
  return sendSuccess(res, {
    status: 'UP',
    service: 'core-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount Routes
app.get('/s/:shareToken', bloodRequestController.renderSharePage);
app.get('/api/leaderboard', donorStatsController.getLeaderboard);
app.get('/api/donations/:id/certificate', requireAuth, donorStatsController.downloadCertificate);
app.get('/api/stream', requireAuth, sseController.stream);

app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', bloodRequestRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/telegram', telegramRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
