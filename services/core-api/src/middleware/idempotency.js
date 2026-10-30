const db = require('../config/db');

/**
 * Idempotency middleware for POST operations.
 * Checks for Idempotency-Key (or X-Idempotency-Key) header.
 * If a valid previous response exists for this key, replays it immediately.
 * Otherwise, captures the response and saves it for subsequent retries.
 */
function idempotencyMiddleware(options = {}) {
  return async function (req, res, next) {
    if (req.method !== 'POST') {
      return next();
    }

    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return next();
    }

    const key = idempotencyKey.trim();

    try {
      // 1. Check if key already exists
      const existing = await db.query(
        `SELECT status_code, response_body FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()`,
        [key]
      );

      if (existing.rows.length > 0) {
        const record = existing.rows[0];
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.setHeader('Idempotent-Replayed', 'true');
        return res.status(record.status_code).json(record.response_body);
      }

      // 2. Intercept response to store it
      res.setHeader('X-Cache-Lookup', 'MISS');

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function (body) {
        res.json = originalJson;

        // Persist response asynchronously
        const userId = req.user?.id || null;
        const statusCode = res.statusCode || 200;
        const endpoint = req.originalUrl || req.path;

        db.query(
          `INSERT INTO idempotency_keys (key, user_id, endpoint, status_code, response_body)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO NOTHING`,
          [key, userId, endpoint, statusCode, JSON.stringify(body)]
        ).catch((err) => {
          console.error('[Idempotency] Error saving response:', err.message);
        });

        return originalJson(body);
      };

      res.send = function (body) {
        res.send = originalSend;
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            const userId = req.user?.id || null;
            const statusCode = res.statusCode || 200;
            const endpoint = req.originalUrl || req.path;

            db.query(
              `INSERT INTO idempotency_keys (key, user_id, endpoint, status_code, response_body)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (key) DO NOTHING`,
              [key, userId, endpoint, statusCode, JSON.stringify(parsed)]
            ).catch((err) => {
              console.error('[Idempotency] Error saving response:', err.message);
            });
          } catch (e) {
            // Non-JSON response, don't store
          }
        }
        return originalSend(body);
      };

      next();
    } catch (err) {
      console.error('[Idempotency] Middleware check failed:', err.message);
      next();
    }
  };
}

module.exports = idempotencyMiddleware;
