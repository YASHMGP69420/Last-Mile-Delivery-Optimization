const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const AuditEvent = require('../src/models/AuditEvent');
const DeliveryEvent = require('../src/models/DeliveryEvent');
const RouteAssignment = require('../src/models/RouteAssignment');
const VehicleAssignment = require('../src/models/VehicleAssignment');
const DriverShift = require('../src/models/DriverShift');
const DriverIncident = require('../src/models/DriverIncident');
const TelemetryPing = require('../src/models/TelemetryPing');
const TelemetryAlert = require('../src/models/TelemetryAlert');
const VehicleChecklist = require('../src/models/VehicleChecklist');
const MaintenanceRecord = require('../src/models/MaintenanceRecord');
const SystemNotification = require('../src/models/SystemNotification');
const {
  ROLES,
  CANONICAL_DEPOT,
  AUDIT_EVENT_TYPES,
  INCIDENT_CATEGORIES,
} = require('../src/config/constants');
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

  test('TC-DEMO-3: End-to-end import -> optimize -> dispatch -> secondary logs -> delete leaves zero orphan demo records while preserving real data', async () => {
    // 1. Seed real production User, Driver, Vehicle, Delivery, Batch, Route, and AuditEvent (isDemoData: false)
    const realDriver = await Driver.create({
      userId: driverUser._id,
      licenseNumber: 'OD02-REAL-9002',
      phone: '+919999900002',
    });
    const realVehicle = await Vehicle.create({
      vehicleId: 'OD02-REAL-VAN2',
      makeModel: 'Real Production Van 2',
      type: 'Van',
      capacityKg: 950,
      fuelType: 'Diesel',
      kmPerLitre: 14,
    });
    const realBatch = await DeliveryBatch.create({
      code: 'BATCH-REAL-PROD-01',
      name: 'Real Production Wave',
      date: '2026-11-10',
      shift: 'Shift A (08:00 - 17:00)',
      depot: CANONICAL_DEPOT,
      status: 'PLANNED',
    });
    const realDelivery = await Delivery.create({
      orderReference: 'REAL-PROD-002',
      batchId: realBatch._id,
      customer: { name: 'Real Production Customer', phone: '+919888877778' },
      address: { street: 'Real Janpath Rd', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 12,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '18:00' },
      status: 'ASSIGNED',
    });
    const realRoute = await Route.create({
      routeCode: 'RT-REAL-PROD-01',
      batchId: realBatch._id,
      vehicleId: realVehicle._id,
      driverId: realDriver._id,
      status: 'DISPATCHED',
      stops: [
        {
          sequence: 1,
          deliveryId: realDelivery._id,
          orderReference: realDelivery.orderReference,
          customer: { name: 'Real Production Customer', phone: '+919888877778' },
          address: { street: 'Real Janpath Rd', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          location: { lat: 20.2895, lng: 85.8442 },
          weightKg: 12,
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '18:00' },
        },
      ],
    });
    const realAuditEvent = await AuditEvent.create({
      deliveryId: realDelivery._id,
      batchId: realBatch._id,
      routeId: realRoute._id,
      type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
      actorId: adminUser._id,
      actorRole: ROLES.ADMIN,
      action: 'Real production route dispatched',
    });
    const realNotification = await SystemNotification.create({
      title: 'Real Fleet Notice',
      message: 'Real system notification must remain intact',
      targetRole: 'ADMIN',
      targetUserId: adminUser._id,
      metadata: { routeId: realRoute._id.toString() },
    });

    // 2. Import demo dataset
    const importRes = await request(app)
      .post('/api/v1/admin/demo-data/import')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(importRes.status).toBe(201);

    const demoBatch = await DeliveryBatch.findOne({ code: 'BATCH-DEMO-BBSR-01', isDemoData: true });
    expect(demoBatch).toBeTruthy();

    // 3. Optimize routes for BATCH-DEMO-BBSR-01
    const optimizeRes = await request(app)
      .post('/api/v1/routes/optimize')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        batchId: demoBatch._id.toString(),
        options: { trafficScenario: 'MORNING_RUSH', maxIterations: 300 },
      });
    expect(optimizeRes.status).toBe(200);
    expect(optimizeRes.body.data.routes.length).toBeGreaterThan(0);

    const optimizedRoute = optimizeRes.body.data.routes[0];
    const routeVehicleId = optimizedRoute.vehicleId.id || optimizedRoute.vehicleId._id || optimizedRoute.vehicleId;
    const assignedDemoDriver = await Driver.findOne({
      assignedVehicleId: routeVehicleId,
      isDemoData: true,
    });
    const fallbackDemoDriver = assignedDemoDriver || (await Driver.findOne({ isDemoData: true }));
    expect(fallbackDemoDriver).toBeTruthy();

    // 4. Dispatch the optimized demo route
    const dispatchRes = await request(app)
      .post(`/api/v1/routes/${optimizedRoute.id}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        driverId: fallbackDemoDriver._id.toString(),
        vehicleId: routeVehicleId.toString(),
      });
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe('DISPATCHED');

    const demoRouteId = optimizedRoute.id;
    const demoDriverIds = await Driver.find({ isDemoData: true }).distinct('_id');
    const demoVehicleIds = await Vehicle.find({ isDemoData: true }).distinct('_id');
    const demoUserIds = await User.find({ isDemoData: true }).distinct('_id');
    const demoDeliveryIds = await Delivery.find({ isDemoData: true }).distinct('_id');

    // 5. Create secondary demo operational records (simulating Driver HUD activity)
    await DriverShift.create({
      driverId: fallbackDemoDriver._id,
      vehicleId: routeVehicleId,
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '08:00',
      endTime: '17:00',
      status: 'IN_PROGRESS',
      startOdometerKm: 1200,
      startFuelOrCharge: 85,
      telemetryCapturedAtStart: true,
    });

    await DriverIncident.create({
      driverId: fallbackDemoDriver._id,
      routeId: demoRouteId,
      deliveryId: demoDeliveryIds[0],
      category: INCIDENT_CATEGORIES.ROUTE_OBSTRUCTION,
      severity: 'MEDIUM',
      description: 'Demo road closure near Patia Square',
      locationCoordinates: { lat: 20.3533, lng: 85.8266 },
    });

    await TelemetryPing.create({
      driverId: fallbackDemoDriver._id,
      vehicleId: routeVehicleId,
      routeId: demoRouteId,
      location: { type: 'Point', coordinates: [85.8266, 20.3533] },
      speedKmh: 34,
    });

    await TelemetryAlert.create({
      driverId: fallbackDemoDriver._id,
      vehicleId: routeVehicleId,
      routeId: demoRouteId,
      alertType: 'OVERSPEED',
      severity: 'WARNING',
      message: 'Demo vehicle overspeed alert',
    });

    await VehicleChecklist.create({
      vehicleId: routeVehicleId,
      driverId: fallbackDemoDriver._id,
      routeId: demoRouteId,
      odometerReadingKm: 1200,
      fuelOrBatteryLevelPercent: 85,
      fuelUnit: '%',
      status: 'PASSED',
    });

    await MaintenanceRecord.create({
      vehicleId: routeVehicleId,
      serviceDate: new Date('2026-11-01T00:00:00.000Z'),
      type: 'Battery Diagnostic (Demo)',
      cost: 500,
      notes: 'Demo maintenance record',
    });

    await SystemNotification.create({
      title: 'Demo Driver Incident Alert',
      message: 'Simulated driver incident notification for demo driver',
      severity: 'WARNING',
      category: 'SAFETY',
      targetRole: 'FLEET_MANAGER',
      metadata: {
        driverId: fallbackDemoDriver._id.toString(),
        vehicleId: routeVehicleId.toString(),
        routeId: demoRouteId.toString(),
      },
    });

    await SystemNotification.create({
      title: 'Demo Driver Target Notice',
      message: 'Direct notification targeted to demo user ID',
      severity: 'INFO',
      category: 'ROUTE',
      targetRole: 'DRIVER',
      targetUserId: demoUserIds[0],
      metadata: {},
    });

    // 6. Delete demo dataset via API
    const delRes = await request(app)
      .delete('/api/v1/admin/demo-data')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.status.hasDemoData).toBe(false);
    expect(delRes.body.data.status.counts.total).toBe(0);

    // 7. Assert ZERO orphan demo records remain across core & secondary collections
    expect(await Route.countDocuments({ _id: { $ne: realRoute._id } })).toBe(0);
    expect(await DeliveryBatch.countDocuments({ _id: { $ne: realBatch._id } })).toBe(0);
    expect(await Delivery.countDocuments({ _id: { $ne: realDelivery._id } })).toBe(0);
    expect(await Driver.countDocuments({ _id: { $ne: realDriver._id } })).toBe(0);
    expect(await Vehicle.countDocuments({ _id: { $ne: realVehicle._id } })).toBe(0);
    expect(await User.countDocuments({ isDemoData: true })).toBe(0);

    expect(await AuditEvent.countDocuments({ _id: { $ne: realAuditEvent._id } })).toBe(0);
    expect(await DeliveryEvent.countDocuments({ _id: { $ne: realAuditEvent._id } })).toBe(0);
    expect(await RouteAssignment.countDocuments({
      $or: [
        { isDemoData: true },
        { routeId: demoRouteId },
        { driverId: { $in: demoDriverIds } },
        { vehicleId: { $in: demoVehicleIds } },
      ],
    })).toBe(0);
    expect(await VehicleAssignment.countDocuments({
      $or: [
        { isDemoData: true },
        { routeId: demoRouteId },
        { driverId: { $in: demoDriverIds } },
        { vehicleId: { $in: demoVehicleIds } },
      ],
    })).toBe(0);
    expect(await DriverShift.countDocuments({
      $or: [{ isDemoData: true }, { driverId: { $in: demoDriverIds } }, { vehicleId: { $in: demoVehicleIds } }],
    })).toBe(0);
    expect(await DriverIncident.countDocuments({
      $or: [{ isDemoData: true }, { driverId: { $in: demoDriverIds } }, { routeId: demoRouteId }],
    })).toBe(0);
    expect(await TelemetryPing.countDocuments({
      $or: [{ isDemoData: true }, { driverId: { $in: demoDriverIds } }, { routeId: demoRouteId }],
    })).toBe(0);
    expect(await TelemetryAlert.countDocuments({
      $or: [{ isDemoData: true }, { driverId: { $in: demoDriverIds } }, { routeId: demoRouteId }],
    })).toBe(0);
    expect(await VehicleChecklist.countDocuments({
      $or: [{ isDemoData: true }, { driverId: { $in: demoDriverIds } }, { routeId: demoRouteId }],
    })).toBe(0);
    expect(await MaintenanceRecord.countDocuments({
      $or: [{ isDemoData: true }, { vehicleId: { $in: demoVehicleIds } }],
    })).toBe(0);
    expect(await SystemNotification.countDocuments({
      $or: [
        { isDemoData: true },
        { 'metadata.isDemoData': true },
        { targetUserId: { $in: demoUserIds } },
        { 'metadata.driverId': { $in: demoDriverIds.map((id) => id.toString()) } },
        { 'metadata.vehicleId': { $in: demoVehicleIds.map((id) => id.toString()) } },
        { 'metadata.routeId': demoRouteId.toString() },
      ],
    })).toBe(0);

    // 8. Assert ALL real production entities remain 100% intact
    expect(await User.findById(adminUser._id)).toBeTruthy();
    expect(await User.findById(driverUser._id)).toBeTruthy();
    expect(await Driver.findById(realDriver._id)).toBeTruthy();
    expect(await Vehicle.findById(realVehicle._id)).toBeTruthy();
    expect(await DeliveryBatch.findById(realBatch._id)).toBeTruthy();
    expect(await Delivery.findById(realDelivery._id)).toBeTruthy();
    expect(await Route.findById(realRoute._id)).toBeTruthy();
    expect(await AuditEvent.findById(realAuditEvent._id)).toBeTruthy();
    expect(await SystemNotification.findById(realNotification._id)).toBeTruthy();
  });

  test('TC-DEMO-4: Demo driver credentials lifecycle (encrypted persistence, admin status/import retrieval, real /auth/login, non-demo isolation, and delete cleanup)', async () => {
    // 1. Clean baseline returns empty driverCredentials
    const initialStatus = await request(app)
      .get('/api/v1/admin/demo-data/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(initialStatus.status).toBe(200);
    expect(initialStatus.body.data.hasDemoData).toBe(false);
    expect(initialStatus.body.data.driverCredentials).toEqual([]);

    // 2. Import returns 3 demo driver credentials with unique high-entropy passwords
    const importRes = await request(app)
      .post('/api/v1/admin/demo-data/import')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(importRes.status).toBe(201);

    const importCreds = importRes.body.data.driverCredentials;
    expect(Array.isArray(importCreds)).toBe(true);
    expect(importCreds).toHaveLength(3);

    const emails = importCreds.map((c) => c.email).sort();
    expect(emails).toEqual([
      'demo.driver1@smartroute.local',
      'demo.driver2@smartroute.local',
      'demo.driver3@smartroute.local',
    ]);

    // Subsequent GET /status returns the exact same decrypted credentials
    const reloadedStatus = await request(app)
      .get('/api/v1/admin/demo-data/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reloadedStatus.status).toBe(200);
    expect(reloadedStatus.body.data.driverCredentials).toEqual(importCreds);

    const passwordSet = new Set();
    const vehicleByEmail = {};
    for (const cred of importCreds) {
      expect(typeof cred.id).toBe('string');
      expect(typeof cred.name).toBe('string');
      expect(cred.name.length).toBeGreaterThan(0);
      expect(typeof cred.password).toBe('string');
      expect(cred.password.length).toBeGreaterThanOrEqual(12);
      expect(cred.password).not.toMatch(/^(password|123456|demo123|admin)$/i);
      passwordSet.add(cred.password);
      expect(typeof cred.licenseNumber).toBe('string');
      expect(cred.licenseNumber).toMatch(/^OD02-DEMO-10[123]$/);
      vehicleByEmail[cred.email] = cred.vehicleId;
    }
    expect(passwordSet.size).toBe(3);
    expect(vehicleByEmail).toEqual({
      'demo.driver1@smartroute.local': 'DEMO-EV-101',
      'demo.driver2@smartroute.local': 'DEMO-VAN-102',
      'demo.driver3@smartroute.local': 'DEMO-VAN-103',
    });

    // 3. Each demo driver credential authenticates cleanly via POST /api/v1/auth/login
    for (const cred of importCreds) {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: cred.email, password: cred.password });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeTruthy();
      expect(loginRes.body.data.user.role).toBe(ROLES.DRIVER);
      expect(loginRes.body.data.user.email).toBe(cred.email);
    }

    // 4. Demo manager & real users are excluded, and User.toJSON() never leaks demoCredentialEnc
    expect(importCreds.some((c) => c.email === 'demo.manager@smartroute.local')).toBe(false);
    expect(importCreds.some((c) => c.email === driverUser.email)).toBe(false);

    const demoManagerDoc = await User.findOne({ email: 'demo.manager@smartroute.local' }).select('+demoCredentialEnc');
    expect(demoManagerDoc).toBeTruthy();
    expect(demoManagerDoc.demoCredentialEnc).toBeNull();

    const demoDriverDoc = await User.findOne({ email: 'demo.driver1@smartroute.local' }).select('+demoCredentialEnc');
    expect(demoDriverDoc).toBeTruthy();
    expect(typeof demoDriverDoc.demoCredentialEnc).toBe('string');
    const serialized = demoDriverDoc.toJSON();
    expect(serialized.demoCredentialEnc).toBeUndefined();
    expect(serialized.passwordHash).toBeUndefined();

    const defaultQueryDoc = await User.findOne({ email: 'demo.driver1@smartroute.local' });
    expect(defaultQueryDoc.demoCredentialEnc).toBeUndefined();

    // Non-admin callers remain blocked
    const driverStatusRes = await request(app)
      .get('/api/v1/admin/demo-data/status')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(driverStatusRes.status).toBe(403);

    // 5. Deleting demo data resets driverCredentials back to []
    const delRes = await request(app)
      .delete('/api/v1/admin/demo-data')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.status.driverCredentials).toEqual([]);

    const afterDeleteStatus = await request(app)
      .get('/api/v1/admin/demo-data/status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterDeleteStatus.status).toBe(200);
    expect(afterDeleteStatus.body.data.driverCredentials).toEqual([]);
  });
});

