const { v4: uuidv4 } = require('uuid');

function correlationIdMiddleware(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    uuidv4();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  next();
}

module.exports = correlationIdMiddleware;
