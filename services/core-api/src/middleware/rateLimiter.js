const redis = require('../config/redis');

// In-memory fallback if Redis is unavailable
const memoryStore = new Map();

async function incrementKey(key, windowSeconds) {
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      const ttl = await redis.ttl(key);
      return { count: current, ttl: Math.max(ttl, 1) };
    }
  } catch (err) {
    // Fall back to memoryStore
  }

  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { count: 1, ttl: windowSeconds };
  }

  entry.count++;
  const remainingSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
  return { count: entry.count, ttl: remainingSeconds };
}

/**
 * General rate limiter per IP and per authenticated user
 */
function rateLimiter({ windowMs = 60000, max = 120, message = 'Too many requests, please try again later.' } = {}) {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async function (req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userId = req.user?.id || 'anon';
    const key = `rl:general:${ip}:${userId}`;

    const { count, ttl } = await incrementKey(key, windowSeconds);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    res.setHeader('X-RateLimit-Reset', ttl);

    if (count > max) {
      res.setHeader('Retry-After', ttl);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: ttl,
      });
    }

    next();
  };
}

/**
 * Login brute-force limiter (protects POST /api/auth/login)
 */
function loginBruteForceLimiter({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async function (req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : 'no-email';
    const key = `rl:login:${ip}:${email}`;

    const { count, ttl } = await incrementKey(key, windowSeconds);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

    if (count > max) {
      res.setHeader('Retry-After', ttl);
      return res.status(429).json({
        success: false,
        error: 'Too many failed login attempts. Please try again later.',
        retryAfter: ttl,
      });
    }

    next();
  };
}

module.exports = {
  rateLimiter,
  loginBruteForceLimiter,
};
