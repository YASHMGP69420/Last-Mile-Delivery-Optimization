const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const { ROLES } = require('../src/config/constants');
const { createTestUser } = require('./helpers/testUtils');

describe('Admin Demo Dataset Import / Delete & Production Isolation Test Suite', () => {
  let adminToken;
  let adminUser;
  let managerToken;
  let driverToken;
  let driverUser;

  beforeEach(async () => {
    const adminRes = await createTestUser(ROLES.ADMIN, 'real-admin@smartroute.test');
    adminUser = adminRes.user;
    adminToken = adminRes.token;

    const mgrRes = await createTestUser(ROLES.FLEET_MANAGER, 'real-manager@smartroute.test');
    managerToken = mgrRes.token;

    const drvRes = await createTestUser(ROLES.DRIVER, 'real-driver@smartroute.test');
    driverUser = drvRes.user;
    driverToken = drvRes.token;
  });

  test('TC-DEMO-1: Demo dataset endpoints strictly allow ADMIN and reject FLEET_MANAGER / DRIVER with 403', async () => {
    for (const token of [managerToken, driverToken]) {
      const statusRes = await request(app)
        .get('/api/v1/admin/demo-data/status')
        .set('Authorization', `Bearer ${token}`);
      expect(statusRes.status).toBe(403);

      const importRes = await request(app)
        .post('/api/v1/admin/demo-data/import')
        .set('Authorization', `Bearer ${token}`);
      expect(importRes.status).toBe(403);

      const delRes = await request(app)
        .delete('/api/v1/admin/demo-data')
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(403);
    }

    const adminStatus = await request(app)
      .get('/api/v1/admin/demo-data/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminStatus.status).toBe(200);
    expect(adminStatus.body.data.hasDemoData).toBe(false);
    expect(adminStatus.body.data.counts.total).toBe(0);
  });

  test('TC-DEMO-2: Import creates tagged demo data, blocks duplicate import (409), and Delete removes ONLY demo data while preserving real records', async () => {
    // Seed real production entities (isDemoData: false)
    const realDriver = await Driver.create({
      userId: driverUser._id,
      licenseNumber: 'OD02-REAL-9001',
      phone: '+919999900001',
    });
    const realVehicle = await Vehicle.create({
      vehicleId: 'OD02-REAL-VAN1',
      makeModel: 'Real Production Van',
      type: 'Van',
      capacityKg: 900,
      fuelType: 'Diesel',
      kmPerLitre: 15,
    });
    const realDelivery = await Delivery.create({
      orderReference: 'REAL-PROD-001',
      customer: { name: 'Real Customer', phone: '+919888877777' },
      address: { street: 'Real Street', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
      weightKg: 10,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '18:00' },
      status: 'READY',
    });

    // Import prebuilt demo data
    const importRes = await request(app)
      .post('/api/v1/admin/demo-data/import')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.hasDemoData).toBe(true);
    expect(importRes.body.data.counts.deliveries).toBe(10);
    expect(importRes.body.data.counts.vehicles).toBe(4);
    expect(importRes.body.data.counts.drivers).toBe(3);
    expect(importRes.body.data.counts.batches).toBe(1);

    // Duplicate import is blocked cleanly with 409
    const dupRes = await request(app)
      .post('/api/v1/admin/demo-data/import')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('DEMO_DATA_ALREADY_LOADED');

    // Delete demo data
    const delRes = await request(app)
      .delete('/api/v1/admin/demo-data')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deletedCount).toBeGreaterThan(0);
    expect(delRes.body.data.status.hasDemoData).toBe(false);
    expect(delRes.body.data.status.counts.total).toBe(0);

    // Real production entities MUST remain completely intact
    expect(await User.findById(adminUser._id)).toBeTruthy();
    expect(await User.findById(driverUser._id)).toBeTruthy();
    expect(await Driver.findById(realDriver._id)).toBeTruthy();
    expect(await Vehicle.findById(realVehicle._id)).toBeTruthy();
    expect(await Delivery.findById(realDelivery._id)).toBeTruthy();
    expect(await DeliveryBatch.countDocuments({})).toBe(0);
  });
});
