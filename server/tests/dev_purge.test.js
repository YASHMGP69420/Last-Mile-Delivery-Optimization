const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const DriverIncident = require('../src/models/DriverIncident');
const TelemetryPing = require('../src/models/TelemetryPing');
const TelemetryAlert = require('../src/models/TelemetryAlert');
const AuditEvent = require('../src/models/AuditEvent');
const socketService = require('../src/services/socketService');
const { createTestUser, createTestVehicle, createTestDriver, createTestDelivery } = require('./helpers/testUtils');
const { ROLES } = require('../src/config/constants');

describe('Developer & Admin Hard Reset / Database Purge (DELETE /api/v1/admin/dev-purge)', () => {
  let adminToken;
  let adminUser;
  let managerToken;
  let driverToken;

  beforeEach(async () => {
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
      .delete('/api/v1/admin/dev-purge')
      .send({ confirmPurge: true });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Test 2: Rejects non-admin users (FLEET_MANAGER, DRIVER) with 403 Forbidden', async () => {
    const managerRes = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ confirmPurge: true });

    expect(managerRes.status).toBe(403);
    expect(managerRes.body.success).toBe(false);

    const driverRes = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ confirmPurge: true });

    expect(driverRes.status).toBe(403);
    expect(driverRes.body.success).toBe(false);
  });

  test('Test 3: Rejects admin request when confirmPurge payload is omitted or false with 400 Bad Request', async () => {
    const omittedRes = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(omittedRes.status).toBe(400);
    expect(omittedRes.body.success).toBe(false);
    expect(omittedRes.body.error.code).toBe('CONFIRMATION_REQUIRED');

    const falseRes = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmPurge: false });

    expect(falseRes.status).toBe(400);
    expect(falseRes.body.success).toBe(false);
    expect(falseRes.body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  test('Test 4: When authorized admin submits { confirmPurge: true }, wipes all operational records while strictly preserving ADMIN accounts', async () => {
    // Seed operational data
    const vehicle = await createTestVehicle();
    const driverUser = await createTestUser('DRIVER');
    const driverProfile = await createTestDriver(driverUser.user, {
      assignedVehicleId: vehicle._id,
    });

    const batch = await DeliveryBatch.create({
      code: `BATCH-P-${Date.now()}`,
      name: 'Batch Purge Test',
      date: '2026-11-23',
      status: 'DRAFT',
      totalDeliveries: 1,
    });

    const delivery = await createTestDelivery({
      batchId: batch._id,
    });

    const route = await Route.create({
      routeCode: `RT-PURGE-${Date.now()}`,
      batchId: batch._id,
      driverId: driverProfile._id,
      vehicleId: vehicle._id,
      status: 'DISPATCHED',
      stops: [],
    });

    await DriverShift.create({
      driverId: driverProfile._id,
      vehicleId: vehicle._id,
      status: 'IN_PROGRESS',
      date: new Date(),
      startTime: '08:00',
      endTime: '17:00',
    });

    await DriverIncident.create({
      driverId: driverProfile._id,
      routeId: route._id,
      deliveryId: delivery._id,
      category: 'DELIVERY_ISSUE',
      description: 'Customer gate locked',
      status: 'OPEN',
    });

    await TelemetryPing.create({
      vehicleId: vehicle._id,
      driverId: driverProfile._id,
      location: {
        type: 'Point',
        coordinates: [85.82, 20.35],
      },
      speedKmh: 30,
      timestamp: new Date(),
    });

    await TelemetryAlert.create({
      vehicleId: vehicle._id,
      driverId: driverProfile._id,
      alertType: 'OVERSPEED',
      severity: 'WARNING',
      message: 'Vehicle exceeded 60km/h limit',
      timestamp: new Date(),
    });

    // Verify operational records exist before purge
    expect(await Delivery.countDocuments()).toBeGreaterThan(0);
    expect(await DeliveryBatch.countDocuments()).toBeGreaterThan(0);
    expect(await Vehicle.countDocuments()).toBeGreaterThan(0);
    expect(await Driver.countDocuments()).toBeGreaterThan(0);
    expect(await Route.countDocuments()).toBeGreaterThan(0);
    expect(await DriverShift.countDocuments()).toBeGreaterThan(0);
    expect(await DriverIncident.countDocuments()).toBeGreaterThan(0);
    expect(await TelemetryPing.countDocuments()).toBeGreaterThan(0);
    expect(await TelemetryAlert.countDocuments()).toBeGreaterThan(0);
    expect(await User.countDocuments({ role: ROLES.DRIVER })).toBeGreaterThan(0);

    const adminCountBefore = await User.countDocuments({ role: ROLES.ADMIN });
    expect(adminCountBefore).toBeGreaterThan(0);

    // Execute purge
    const res = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmPurge: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('All operational data successfully purged. Administrator accounts preserved.');
    expect(res.body.data.deletedCount).toBeGreaterThan(0);
    expect(res.body.data.deletedCounts.deliveries).toBeGreaterThanOrEqual(1);
    expect(res.body.data.deletedCounts.vehicles).toBeGreaterThanOrEqual(1);
    expect(res.body.data.deletedCounts.drivers).toBeGreaterThanOrEqual(1);

    // Verify all operational records are 0
    expect(await Delivery.countDocuments()).toBe(0);
    expect(await DeliveryBatch.countDocuments()).toBe(0);
    expect(await Vehicle.countDocuments()).toBe(0);
    expect(await Driver.countDocuments()).toBe(0);
    expect(await Route.countDocuments()).toBe(0);
    expect(await DriverShift.countDocuments()).toBe(0);
    expect(await DriverIncident.countDocuments()).toBe(0);
    expect(await TelemetryPing.countDocuments()).toBe(0);
    expect(await TelemetryAlert.countDocuments()).toBe(0);
    expect(await User.countDocuments({ role: ROLES.DRIVER })).toBe(0);

    // Verify ADMIN accounts are strictly preserved
    const adminCountAfter = await User.countDocuments({ role: ROLES.ADMIN });
    expect(adminCountAfter).toBe(adminCountBefore);
    const preservedAdmin = await User.findById(adminUser._id);
    expect(preservedAdmin).not.toBeNull();
    expect(preservedAdmin.role).toBe(ROLES.ADMIN);

    // Verify AuditEvent recorded for the purge
    const purgeAudit = await AuditEvent.findOne({ action: '[ADMIN] OPERATIONAL_DATABASE_PURGE' });
    expect(purgeAudit).not.toBeNull();
    expect(purgeAudit.actorRole).toBe('ADMIN');
  });

  test('Test 5: Verifies socketService.emitSystemPurged was invoked upon successful purge', async () => {
    const spy = jest.spyOn(socketService, 'emitSystemPurged');

    const res = await request(app)
      .delete('/api/v1/admin/dev-purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirmPurge: true });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      deletedCount: expect.any(Number),
      deletedCounts: expect.any(Object),
    }));
  });
});
