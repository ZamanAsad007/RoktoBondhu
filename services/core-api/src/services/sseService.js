const crypto = require('crypto');
const redis = require('../config/redis');

const CHANNEL_NAME = 'roktobondhu:realtime_events';
const HEARTBEAT_INTERVAL_MS = 20000; // 20s heartbeat to satisfy Nginx/proxies

class SSEService {
  constructor() {
    this.clients = new Map(); // clientId -> { id, userId, requestId, res, req }
    this.subscriberClient = null;
    this.heartbeatTimer = null;
    this.startHeartbeat();
  }

  /**
   * Initializes Redis pub/sub subscriber if available.
   */
  initSubscriber() {
    if (this.subscriberClient) {
      return this.subscriberClient;
    }

    try {
      if (redis && typeof redis.duplicate === 'function') {
        this.subscriberClient = redis.duplicate();

        this.subscriberClient.on('error', (err) => {
          if (process.env.NODE_ENV !== 'test') {
            console.warn('[SSE Redis Subscriber] Error:', err.message);
          }
        });

        this.subscriberClient.subscribe(CHANNEL_NAME, (err) => {
          if (err && process.env.NODE_ENV !== 'test') {
            console.warn('[SSE Redis Subscriber] Subscribe error:', err.message);
          }
        });

        this.subscriberClient.on('message', (channel, message) => {
          if (channel === CHANNEL_NAME) {
            try {
              const eventPayload = JSON.parse(message);
              this.dispatchToLocalClients(eventPayload);
            } catch (parseErr) {
              console.warn('[SSE] Failed to parse Redis message:', parseErr.message);
            }
          }
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[SSE] Redis subscriber skipped:', e.message);
      }
    }

    return this.subscriberClient;
  }

  /**
   * Starts periodic keep-alive heartbeat comment (:heartbeat\n\n) every 20 seconds.
   */
  startHeartbeat(intervalMs = HEARTBEAT_INTERVAL_MS) {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    // Prevent heartbeat timer from keeping Node process alive in tests
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  /**
   * Stops heartbeat timer.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Sends heartbeat comment to all connected SSE clients.
   */
  sendHeartbeat() {
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.write(':heartbeat\n\n');
      } catch (err) {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Handles incoming SSE connection for authenticated user.
   */
  handleStreamConnection(req, res) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }

    const clientId = crypto.randomUUID();
    const requestId = req.query.requestId || null;

    // Set SSE response headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const client = {
      id: clientId,
      userId: user.id,
      requestId,
      res,
      req,
    };

    this.clients.set(clientId, client);

    // Send connected handshake event
    const connectPayload = {
      status: 'connected',
      userId: user.id,
      requestId,
      timestamp: new Date().toISOString(),
    };
    res.write(`event: connected\ndata: ${JSON.stringify(connectPayload)}\n\n`);

    // Clean up on connection close
    req.on('close', () => {
      this.clients.delete(clientId);
      try {
        res.end();
      } catch (e) {
        // already closed
      }
    });

    return client;
  }

  /**
   * Publishes an event to Redis pub/sub and dispatches locally.
   *
   * @param {string} event - Event name (e.g. 'match.accepted', 'request.fulfilled', 'match.new')
   * @param {object} data - Payload data
   * @param {object} [options]
   * @param {string|string[]} [options.targetUserIds] - Specific user(s) to target
   * @param {string} [options.targetRequestId] - Specific request to target
   * @param {boolean} [options.broadcast] - True to send to all connected clients
   */
  async publishEvent(event, data = {}, options = {}) {
    const payload = {
      event,
      data,
      targetUserIds: options.targetUserIds
        ? Array.isArray(options.targetUserIds)
          ? options.targetUserIds
          : [options.targetUserIds]
        : null,
      targetRequestId: options.targetRequestId || null,
      broadcast: Boolean(options.broadcast),
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(payload);
    let publishedToRedis = false;

    try {
      if (redis && redis.status === 'ready') {
        await redis.publish(CHANNEL_NAME, message);
        publishedToRedis = true;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[SSE] Redis publish error, using local fallback:', err.message);
      }
    }

    // Always deliver to local in-memory clients if Redis is disabled or in tests,
    // or when Redis publisher is on the same node without a separate subscriber loop
    if (!publishedToRedis || process.env.NODE_ENV === 'test') {
      this.dispatchToLocalClients(payload);
    }
  }

  /**
   * Dispatches an event to connected local clients matching filter criteria.
   */
  dispatchToLocalClients(payload) {
    const { event, data, targetUserIds, targetRequestId, broadcast } = payload;
    const sseFormatted = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const [clientId, client] of this.clients.entries()) {
      let isTarget = false;

      if (broadcast) {
        isTarget = true;
      } else if (!targetUserIds && !targetRequestId) {
        isTarget = true;
      } else {
        if (targetUserIds && targetUserIds.includes(client.userId)) {
          isTarget = true;
        }
        if (targetRequestId && client.requestId === targetRequestId) {
          isTarget = true;
        }
      }

      if (isTarget) {
        try {
          client.res.write(sseFormatted);
        } catch (err) {
          this.clients.delete(clientId);
        }
      }
    }
  }

  /**
   * Returns current count of connected clients.
   */
  getClientsCount() {
    return this.clients.size;
  }

  /**
   * Cleans up all connections and subscriber.
   */
  async cleanup() {
    this.stopHeartbeat();
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch (e) {
        // ignore
      }
    }
    this.clients.clear();

    if (this.subscriberClient) {
      try {
        await this.subscriberClient.unsubscribe(CHANNEL_NAME);
        await this.subscriberClient.quit();
      } catch (e) {
        // ignore
      }
      this.subscriberClient = null;
    }
  }
}

const sseService = new SSEService();

module.exports = sseService;
