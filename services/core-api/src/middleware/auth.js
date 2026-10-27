const { verifyAccessToken } = require('../utils/token');
const userRepository = require('../repositories/userRepository');
const { sendError } = require('../utils/response');

async function requireAuth(req, res, next) {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return sendError(res, 'Authentication required', 401);
    }
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token has expired', 401);
      }
      return sendError(res, 'Invalid token', 401);
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    if (user.is_blocked) {
      return sendError(res, 'Account is blocked. Contact support.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Forbidden: insufficient permissions', 403);
    }

    next();
  };
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyAccessToken(token);
        const user = await userRepository.findById(decoded.id);
        if (user && !user.is_blocked) {
          req.user = user;
        }
      } catch (err) {
        // Ignore token errors for optional auth
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
  requireRole,
  optionalAuth,
};
