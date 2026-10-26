const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Error Handler]', {
      path: req.originalUrl,
      method: req.method,
      message: err.message,
      stack: err.stack,
    });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    let message = 'A record with this value already exists';
    if (err.detail && err.detail.includes('email')) {
      message = 'An account with this email already exists';
    } else if (err.detail && err.detail.includes('phone')) {
      message = 'An account with this phone number already exists';
    }
    return sendError(res, message, 409);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return sendError(res, 'Referenced resource does not exist', 400);
  }

  // Custom application error with statusCode or status
  const statusCode = err.statusCode || err.status;
  if (statusCode) {
    return sendError(res, err.message, statusCode, err.details);
  }

  // Fallback 500
  return sendError(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    500
  );
}

function notFoundHandler(req, res) {
  return sendError(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
