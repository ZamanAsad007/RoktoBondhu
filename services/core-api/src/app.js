const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const bloodRequestRoutes = require('./routes/bloodRequestRoutes');
const matchRoutes = require('./routes/matchRoutes');
const { requireAuth, requireRole } = require('./middleware/auth');
const userRepository = require('./repositories/userRepository');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/response');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

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
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', bloodRequestRoutes);
app.use('/api/matches', matchRoutes);

// Admin-protected route for role verification and user blocking (Phase 1 / Admin requirement)
app.patch('/api/admin/users/:id/block', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    const blockedStatus = isBlocked !== undefined ? Boolean(isBlocked) : true;
    const user = await userRepository.setBlocked(req.params.id, blockedStatus);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
