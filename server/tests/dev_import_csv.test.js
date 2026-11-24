const request = require('supertest');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const devPurgeService = require('../src/services/devPurgeService');
const { createTestUser } = require('./helpers/testUtils');

describe('Developer Danger Zone: Bulk Import Sample CSVs (POST /api/v1/admin/dev-import-sample-csvs)', () => {
  let adminToken;
  let adminUser;
  let managerToken;
  let driverToken;

  beforeEach(async () => {
    // Purge operational data before each test for clean slate
    await devPurgeService.purgeAllOperationalData();

    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const driver = await createTestUser('DRIVER');
    driverToken = driver.token;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Test 1: Rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Test 2: Rejects non-admin users (FLEET_MANAGER, DRIVER) with 403 Forbidden', async () => {
    const managerRes = await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(managerRes.status).toBe(403);
    expect(managerRes.body.success).toBe(false);

    const driverRes = await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({});

    expect(driverRes.status).toBe(403);
    expect(driverRes.body.success).toBe(false);
  });

  test('Test 3: Admin successfully bulk imports vehicles, drivers, and orders CSVs', async () => {
    const res = await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehiclesCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.driversCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.deliveriesCount).toBeGreaterThanOrEqual(1);

    // Verify DB state
    const vehicleCount = await Vehicle.countDocuments({ availability: { $ne: 'RETIRED' } });
    const driverCount = await Driver.countDocuments();
    const deliveryCount = await Delivery.countDocuments();

    expect(vehicleCount).toBe(res.body.data.vehiclesCount);
    expect(driverCount).toBe(res.body.data.driversCount);
    expect(deliveryCount).toBe(res.body.data.deliveriesCount);
  }, 30000);

  test('Test 4: Subsequent bulk import skips existing records idempotently without throwing error', async () => {
    // First import
    await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Second import on existing dataset
    const res = await request(app)
      .post('/api/v1/admin/dev-import-sample-csvs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehiclesCount).toBe(0);
    expect(res.body.data.driversCount).toBe(0);
    expect(res.body.data.deliveriesCount).toBe(0);
    expect(res.body.data.totalSkipped).toBeGreaterThan(0);
  }, 30000);
});
