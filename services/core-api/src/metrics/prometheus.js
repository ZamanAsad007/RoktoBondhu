const client = require('prom-client');

// Initialize Prometheus registry
const register = new client.Registry();

// Enable standard default system metrics (CPU, memory, event loop)
client.collectDefaultMetrics({
  register,
  prefix: 'roktobondhu_',
});

// Custom Application Metrics
const wavesSentCounter = new client.Counter({
  name: 'roktobondhu_matching_waves_total',
  help: 'Total matching waves initiated for blood requests',
  labelNames: ['wave_number', 'blood_group'],
  registers: [register],
});

const acceptsCounter = new client.Counter({
  name: 'roktobondhu_matches_accepted_total',
  help: 'Total successful donor match acceptances',
  labelNames: ['blood_group', 'urgency'],
  registers: [register],
});

const timeToFirstAcceptHistogram = new client.Histogram({
  name: 'roktobondhu_time_to_first_accept_seconds',
  help: 'Duration in seconds from blood request creation to first donor acceptance',
  buckets: [30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'roktobondhu_http_requests_total',
  help: 'Total HTTP requests handled by core API',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'roktobondhu_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const queueDepthGauge = new client.Gauge({
  name: 'roktobondhu_queue_depth',
  help: 'Current active job count across BullMQ queues',
  labelNames: ['queue_name'],
  registers: [register],
});

/**
 * Express middleware to record HTTP metrics
 */
function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/health') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.baseUrl || req.path;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );
  });

  next();
}

module.exports = {
  register,
  wavesSentCounter,
  acceptsCounter,
  timeToFirstAcceptHistogram,
  httpRequestsTotal,
  httpRequestDuration,
  queueDepthGauge,
  metricsMiddleware,
};
