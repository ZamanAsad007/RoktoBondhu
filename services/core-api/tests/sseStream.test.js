const http = require('http');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { generateAccessToken } = require('../src/utils/token');
const sseService = require('../src/services/sseService');

describe('Phase 16: Real-Time Updates (SSE & Redis Pub/Sub)', () => {
  let server;
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  beforeAll(async () => {
    await runMigrations();

    await db.query(`DELETE FROM users WHERE email IN ('sse.userA@test.com', 'sse.userB@test.com')`);

    const resA = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('SSE Requester', '+8801911223301', 'sse.userA@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    userA = resA.rows[0];
    tokenA = generateAccessToken(userA);

    const resB = await db.query(
      `INSERT INTO users (name, phone, email, password_hash, role, phone_verified)
       VALUES ('SSE Donor', '+8801911223302', 'sse.userB@test.com', '$2a$10$dummyhash', 'USER', true)
       RETURNING *`
    );
    userB = resB.rows[0];
    tokenB = generateAccessToken(userB);

    // Start ephemeral HTTP server for streaming tests
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
  });

  afterAll(async () => {
    await sseService.cleanup();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (userA) {
      await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userA.id, userB.id]);
    }
  });

  function openStream(path) {
    return new Promise((resolve, reject) => {
      const port = server.address().port;
      const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        resolve({ req, res });
      });
      req.on('error', reject);
    });
  }

  it('rejects unauthenticated stream connection with 401', async () => {
    const { req, res } = await openStream('/api/stream');
    expect(res.statusCode).toBe(401);
    req.destroy();
  });

  it('connects successfully via query token and returns SSE headers & connected event', async () => {
    const { req, res } = await openStream(`/api/stream?token=${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['x-accel-buffering']).toBe('no');

    const firstChunk = await new Promise((resolve) => {
      res.once('data', (chunk) => resolve(chunk.toString()));
    });

    expect(firstChunk).toContain('event: connected');
    expect(firstChunk).toContain(userA.id);

    req.destroy();
  });

  it('sends heartbeat comment to active clients', async () => {
    const { req, res } = await openStream(`/api/stream?token=${tokenA}`);

    // Skip connected handshake
    await new Promise((resolve) => res.once('data', () => resolve()));

    const heartbeatPromise = new Promise((resolve) => {
      res.once('data', (chunk) => resolve(chunk.toString()));
    });

    sseService.sendHeartbeat();
    const heartbeatData = await heartbeatPromise;
    expect(heartbeatData).toBe(':heartbeat\n\n');

    req.destroy();
  });

  it('dispatches targeted events to appropriate user and request subscribers', async () => {
    const targetRequestId = '11111111-2222-3333-4444-555555555555';

    // Client A: User A watching targetRequestId
    const { req: reqA, res: resA } = await openStream(
      `/api/stream?token=${tokenA}&requestId=${targetRequestId}`
    );
    // Client B: User B with no specific request
    const { req: reqB, res: resB } = await openStream(`/api/stream?token=${tokenB}`);

    // Wait for both connected events
    await new Promise((resolve) => resA.once('data', () => resolve()));
    await new Promise((resolve) => resB.once('data', () => resolve()));

    // 1. Publish match.accepted targeted only to userA and targetRequestId
    const clientAPromise = new Promise((resolve) => {
      resA.once('data', (chunk) => resolve(chunk.toString()));
    });

    let clientBReceived = false;
    resB.once('data', () => {
      clientBReceived = true;
    });

    await sseService.publishEvent(
      'match.accepted',
      {
        requestId: targetRequestId,
        donorName: 'Test Hero',
        unitsNeeded: 2,
        acceptedCount: 1,
      },
      {
        targetUserIds: [userA.id],
        targetRequestId,
      }
    );

    const receivedA = await clientAPromise;
    expect(receivedA).toContain('event: match.accepted');
    expect(receivedA).toContain('Test Hero');
    expect(clientBReceived).toBe(false);

    // 2. Publish match.new targeted to userB
    const clientBPromise = new Promise((resolve) => {
      resB.once('data', (chunk) => resolve(chunk.toString()));
    });

    await sseService.publishEvent(
      'match.new',
      {
        requestId: targetRequestId,
        bloodGroup: 'O+',
        distanceKm: 3.2,
      },
      {
        targetUserIds: [userB.id],
      }
    );

    const receivedB = await clientBPromise;
    expect(receivedB).toContain('event: match.new');
    expect(receivedB).toContain('3.2');

    reqA.destroy();
    reqB.destroy();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('cleans up client registry when connection closes', async () => {
    const initialCount = sseService.getClientsCount();
    const { req, res } = await openStream(`/api/stream?token=${tokenA}`);

    await new Promise((resolve) => res.once('data', () => resolve()));
    expect(sseService.getClientsCount()).toBe(initialCount + 1);

    req.destroy();
    // Allow brief tick for 'close' event
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sseService.getClientsCount()).toBe(initialCount);
  });
});
