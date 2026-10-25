const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('should return 200 with service status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.service).toBe('core-api');
    expect(res.body.data.timestamp).toBeDefined();
  });
});
