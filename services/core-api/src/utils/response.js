/**
 * Standard API response envelope helpers
 * Format: { "success": true/false, "data": ... , "error": ... }
 */

function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
}

function sendError(res, message = 'Internal server error', statusCode = 500, details = null) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
      ...(details ? { details } : {}),
    },
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
