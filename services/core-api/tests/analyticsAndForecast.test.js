const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { closeNotificationQueue } = require('../src/jobs/notificationQueue');

describe('Phase 22: Demand Heatmap & Shortage Forecast', () => {
  let adminToken;
  let adminId;
  let donorToken;
  let donorId;
  let regularUserToken;

  beforeAll(async () => {
    await runMigrations();

    const ts = Date.now();

    // 1. Create Admin User
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Analytics Admin',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `analytics_admin_${ts}@example.com`,
      password: 'AdminPassword123!',
    });
    adminId = adminRes.body.data.user.id;
    await db.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [adminId]);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: `analytics_admin_${ts}@example.com`,
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // 2. Create Donor User
    const donorRes = await request(app).post('/api/auth/register').send({
      name: 'Eligible Donor',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `donor_p22_${ts}@example.com`,
      password: 'DonorPassword123!',
    });
    donorToken = donorRes.body.data.accessToken;
    donorId = donorRes.body.data.user.id;

    // Set up donor profile (O- in Dhaka)
    await request(app)
      .put('/api/donors/me')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        blood_group: 'O-',
        date_of_birth: '1995-05-15',
        latitude: 23.8103,
        longitude: 90.4125,
        city: 'Dhaka',
        available: true,
      });

    // 3. Create Regular User
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Regular Requester',
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `reg_p22_${ts}@example.com`,
      password: 'RegPassword123!',
    });
    regularUserToken = regRes.body.data.accessToken;

    // 4. Create sample blood request (O- in Dhaka)
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({
        patient_name: 'Anonymous Patient A',
        blood_group: 'O-',
        units_needed: 2,
        hospital_name: 'Dhaka Medical College',
        city: 'Dhaka',
        latitude: 23.8103,
        longitude: 90.4125,
        urgency: 'CRITICAL',
        needed_by: new Date(Date.now() + 24 * 3600000).toISOString(),
        contact_phone: '+8801811223344',
      });
  });

  afterAll(async () => {
    await closeNotificationQueue();
  });

  it('allows admin to get demand and supply analytics overview', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analytics).toBeDefined();

    const { breakdown, totalRequests, fulfillmentRatePct } = res.body.data.analytics;
    expect(typeof totalRequests).toBe('number');
    expect(typeof fulfillmentRatePct).toBe('number');
    expect(Array.isArray(breakdown)).toBe(true);

    const dhakaO = breakdown.find((b) => b.area === 'Dhaka' && b.bloodGroup === 'O-');
    expect(dhakaO).toBeDefined();
    expect(dhakaO.totalRequests).toBeGreaterThanOrEqual(1);
    expect(dhakaO.eligibleDonors).toBeGreaterThanOrEqual(1);
    expect(typeof dhakaO.supplyDemandRatio).toBe('number');
  });

  it('allows admin to get geo heatmap grid with PostGIS aggregation', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/heatmap?resolution=0.05')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.grid)).toBe(true);
    expect(res.body.data.grid.length).toBeGreaterThan(0);

    const cell = res.body.data.grid[0];
    expect(cell).toHaveProperty('lat');
    expect(cell).toHaveProperty('lng');
    expect(cell).toHaveProperty('requestCount');
    expect(cell).toHaveProperty('donorCount');
    expect(cell).toHaveProperty('intensity');
    expect(typeof cell.shortageRisk).toBe('boolean');
  });

  it('allows admin to get shortage forecast with moving average', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/forecast')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.forecast)).toBe(true);

    const forecast = res.body.data.forecast.find((f) => f.bloodGroup === 'O-');
    expect(forecast).toBeDefined();
    expect(forecast).toHaveProperty('movingAvgWeeklyDemand');
    expect(forecast).toHaveProperty('forecastedDemandNextWeek');
    expect(forecast).toHaveProperty('riskLevel');
    expect(['HIGH', 'MODERATE', 'LOW']).toContain(forecast.riskLevel);
  });

  it('exports analytics strictly as anonymous aggregated CSV (no personal info)', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const csvText = res.text;
    expect(csvText).toContain('Area,Blood Group,Total Requests,Fulfilled Requests');
    expect(csvText).toContain('Dhaka');

    // Rule: only aggregated, anonymous data (no personal info)
    expect(csvText).not.toContain('Anonymous Patient A');
    expect(csvText).not.toContain('+8801811223344');
    expect(csvText).not.toContain('donor_p22_');
  });

  it('rejects regular user from accessing admin analytics endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/analytics/overview')
      .set('Authorization', `Bearer ${regularUserToken}`);

    expect(res.status).toBe(403);
  });

  it('provides recruit nudges for eligible donors in matching shortage areas', async () => {
    const res = await request(app)
      .get('/api/donors/me/recruit-nudges')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.nudges)).toBe(true);
  });
});
