const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const { createTestUser, createTestVehicle } = require('./helpers/testUtils');

describe('Admin Control Center & Exclusive Privileges Test Suite (server/tests/admin_control.test.js)', () => {
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

  describe('1. RBAC & Exclusive Admin Route Protection', () => {
    test('TC-ADMIN-RBAC-1: Super Admin can access /api/v1/admin/overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toBeDefined();
      expect(res.body.data.systemHealth).toBeDefined();
    });

    test('TC-ADMIN-RBAC-2: Fleet Manager receives 403 Forbidden on /api/v1/admin/overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('TC-ADMIN-RBAC-3: Driver receives 403 Forbidden on /api/v1/admin/overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('2. User and Access Management', () => {
    test('TC-ADMIN-USER-1: Admin creates new user account with role FLEET_MANAGER', async () => {
      const payload = {
        name: 'Operations Dispatcher',
        email: `dispatcher_${Date.now()}@smartroute.test`,
        password: 'Password123!',
        role: 'FLEET_MANAGER',
        department: 'Bhubaneswar Hub Dispatch',
      };

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(payload.email.toLowerCase());
      expect(res.body.data.user.role).toBe('FLEET_MANAGER');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // never expose password
    });

    test('TC-ADMIN-USER-2: Suspend user account and prevent self-suspension', async () => {
      // 1. Create target user
      const target = await createTestUser('DRIVER');

      // 2. Suspend target user
      const res = await request(app)
        .patch(`/api/v1/admin/users/${target.user._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Audit compliance review' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.accountStatus).toBe('SUSPENDED');
      expect(res.body.data.user.active).toBe(false);

      // 3. Attempt self-suspension by Admin -> 403 Forbidden
      const selfRes = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Accidental lockout' });

      expect(selfRes.status).toBe(403);
      expect(selfRes.body.error.code).toBe('SELF_LOCKOUT_PREVENTED');
    });

    test('TC-ADMIN-USER-3: Admin resets user credentials securely', async () => {
      const target = await createTestUser('DRIVER');

      const res = await request(app)
        .post(`/api/v1/admin/users/${target.user._id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'NewSecurePassword2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.temporaryPassword).toBe('NewSecurePassword2026!');
    });
  });

  describe('3. Organization & Multi-Depot Management', () => {
    test('TC-ADMIN-ORG-1: Retrieve and update organization settings', async () => {
      const getRes = await request(app)
        .get('/api/v1/admin/organization')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.organization.organizationName).toBeDefined();

      const updateRes = await request(app)
        .put('/api/v1/admin/organization')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ organizationName: 'SmartRoute Express Logistics Odisha' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.organization.organizationName).toBe('SmartRoute Express Logistics Odisha');
    });

    test('TC-ADMIN-ORG-2: Register new operational depot and update its parameters', async () => {
      const depotPayload = {
        name: 'Khandagiri South Cross-Dock',
        address: 'National Highway 16, Khandagiri, Bhubaneswar',
        location: { lat: 20.2612, lng: 85.7891 },
        operatingHours: { start: '06:00', end: '23:00' },
        serviceRegion: 'Khandagiri & South Bhubaneswar',
      };

      const addRes = await request(app)
        .post('/api/v1/admin/depots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(depotPayload);

      expect(addRes.status).toBe(201);
      const depots = addRes.body.data.depots;
      const created = depots.find((d) => d.name === depotPayload.name);
      expect(created).toBeDefined();
      expect(created.location.lat).toBe(20.2612);

      // Update depot active status
      const updateRes = await request(app)
        .put(`/api/v1/admin/depots/${created.depotId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false });

      expect(updateRes.status).toBe(200);
      const updatedDepot = updateRes.body.data.depots.find((d) => d.depotId === created.depotId);
      expect(updatedDepot.active).toBe(false);
    });
  });

  describe('4. Fleet-Wide Oversight & Mandatory Reason Overrides', () => {
    test('TC-ADMIN-FLEET-1: Override vehicle to MAINTENANCE with mandatory reason', async () => {
      const vehicle = await createTestVehicle({ vehicleId: 'OD-02-OVERRIDE-01' });

      // Attempt override without reason -> 400 Bad Request
      const badRes = await request(app)
        .post('/api/v1/admin/fleet-control/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'VEHICLE',
          resourceId: vehicle._id,
          action: 'SUSPEND_MAINTENANCE',
          reason: '',
        });

      expect(badRes.status).toBe(400);
      expect(badRes.body.error.code).toBe('REASON_REQUIRED');

      // Valid override with reason
      const goodRes = await request(app)
        .post('/api/v1/admin/fleet-control/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'VEHICLE',
          resourceId: vehicle._id,
          action: 'SUSPEND_MAINTENANCE',
          reason: 'Brake fluid leakage reported by depot mechanic',
        });

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.data.vehicle.status || goodRes.body.data.vehicle.availability).toBe('MAINTENANCE');
    });
  });

  describe('5. Route & Delivery Operations Overrides', () => {
    test('TC-ADMIN-OPS-1: Admin reopens failed consignment for re-dispatch with audit note', async () => {
      const failedDelivery = await Delivery.create({
        orderReference: `FAIL-${Date.now()}`,
        customer: { name: 'Priya Sharma', phone: '+91 99999 88888' },
        address: { street: 'Janpath Road', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { coordinates: [85.845, 20.292] },
        weightKg: 4.5,
        timeWindow: { start: '09:00', end: '12:00' },
        status: 'FAILED',
        failureReason: 'CUSTOMER_UNAVAILABLE',
        failureNotes: 'Customer not reachable on phone',
      });

      const res = await request(app)
        .post('/api/v1/admin/operations/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetType: 'DELIVERY',
          targetId: failedDelivery._id,
          action: 'REOPEN_FAILED',
          reason: 'Customer requested evening re-attempt via call center',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.delivery.status).toBe('READY');
      expect(res.body.data.delivery.failureReason).toBeNull();
      expect(res.body.data.delivery.failureNotes).toContain('Customer requested evening re-attempt');
    });
  });

  describe('6. Optimization & Fuel Tariff Settings', () => {
    test('TC-ADMIN-SETTINGS-1: Update optimization weights and algorithm profile', async () => {
      const res = await request(app)
        .put('/api/v1/admin/optimization-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distanceWeight: 0.5,
          timeWeight: 0.25,
          fuelCostWeight: 0.25,
          defaultProfile: 'Distance Optimized',
          reason: 'Prioritizing minimal fleet distance for monsoon operations',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.optimizationSettings.defaultProfile).toBe('Distance Optimized');
      expect(res.body.data.optimizationSettings.distanceWeight).toBe(0.5);
    });

    test('TC-ADMIN-SETTINGS-2: Update fuel tariffs and emission coefficients', async () => {
      const res = await request(app)
        .put('/api/v1/admin/fuel-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dieselPricePerLiter: 96.5,
          electricityTariffPerKwh: 7.5,
          reason: 'State regulatory tariff revision',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fuelSettings.dieselPricePerLiter).toBe(96.5);
      expect(res.body.data.fuelSettings.electricityTariffPerKwh).toBe(7.5);
    });
  });

  describe('7. Integrations & Live Health Diagnostics', () => {
    test('TC-ADMIN-INT-1: Retrieve integrations status and test Geoapify connection', async () => {
      const getRes = await request(app)
        .get('/api/v1/admin/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.integrations.mongoDb.status).toBe('CONNECTED');

      const testRes = await request(app)
        .post('/api/v1/admin/integrations/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ service: 'GEOAPIFY' });

      expect(testRes.status).toBe(200);
      expect(testRes.body.data.service).toBe('Geoapify Routing API');
    });
  });

  describe('8. Audit Trail & Data Export', () => {
    test('TC-ADMIN-AUDIT-1: Verify append-only audit trail records admin actions', async () => {
      // First perform an administrative action to generate an audit log
      await request(app)
        .put('/api/v1/admin/fuel-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dieselPricePerLiter: 98.0, reason: 'Test audit log generation' });

      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.logs).toBeInstanceOf(Array);
      expect(res.body.data.total).toBeGreaterThan(0);
    });

    test('TC-ADMIN-EXPORT-1: Export operational datasets (deliveries, fleets, drivers)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/data-export?dataset=fleets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dataset).toBe('fleets');
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });
});
