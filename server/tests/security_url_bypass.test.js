const request = require('supertest');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const Route = require('../src/models/Route');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const { createTestUser } = require('./helpers/testUtils');
const { ROLES } = require('../src/config/constants');

describe('Security: Forced Browsing & Direct URL Bypass Prevention', () => {
  let adminToken;
  let managerToken;
  let driverAToken;
  let driverAUser;
  let driverADoc;
  let driverBToken;
  let driverBUser;
  let driverBDoc;
  let testVehicle;
  let testBatch;

  beforeEach(async () => {
    // 1. Create Admin
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    // 2. Create Fleet Manager
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    // 3. Create Driver A
    const driverA = await createTestUser('DRIVER');
    driverAToken = driverA.token;
    driverAUser = driverA.user;
    driverADoc = await Driver.create({
      userId: driverAUser._id,
      licenseNumber: `DL-TEST-${Date.now()}-A`,
      phone: '+919999900011',
      availability: 'AVAILABLE',
    });

    // 4. Create Driver B
    const driverB = await createTestUser('DRIVER');
    driverBToken = driverB.token;
    driverBUser = driverB.user;
    driverBDoc = await Driver.create({
      userId: driverBUser._id,
      licenseNumber: `DL-TEST-${Date.now()}-B`,
      phone: '+919999900022',
      availability: 'AVAILABLE',
    });

    // 5. Create Test Vehicle
    testVehicle = await Vehicle.create({
      vehicleId: `OD-02-SEC-${Date.now()}`,
      makeModel: 'Tata Ace Electric',
      type: 'Van',
      fuelType: 'Electric',
      energyKWhPerKm: 0.2,
      capacityKg: 1000,
      capacityM3: 3.5,
    });

    // 6. Create Test Batch
    testBatch = await DeliveryBatch.create({
      name: 'Security Test Batch',
      code: `BATCH-SEC-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Suite 1: Unauthenticated Direct URL Ingress (Public Protection)', () => {
    const protectedUrls = [
      { method: 'get', url: '/api/v1/admin/overview' },
      { method: 'get', url: '/api/v1/admin/users' },
      { method: 'delete', url: '/api/v1/admin/dev-purge' },
      { method: 'get', url: '/api/v1/deliveries' },
      { method: 'get', url: '/api/v1/batches' },
      { method: 'get', url: '/api/v1/vehicles' },
      { method: 'get', url: '/api/v1/hubs' },
      { method: 'get', url: '/api/v1/routes' },
      { method: 'get', url: '/api/v1/telemetry/live' },
      { method: 'get', url: '/api/v1/driver-hud/dashboard' },
    ];

    protectedUrls.forEach(({ method, url }) => {
      it(`Rejects unauthenticated direct request to ${method.toUpperCase()} ${url} with 401`, async () => {
        const res = await request(app)[method](url);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('Suite 2: Role Escalation via URL (Driver -> Admin/Manager Restricted URLs)', () => {
    const adminOnlyUrls = [
      { method: 'get', url: '/api/v1/admin/overview' },
      { method: 'get', url: '/api/v1/admin/users' },
      { method: 'get', url: '/api/v1/admin/audit-logs' },
      { method: 'get', url: '/api/v1/vehicles' },
      { method: 'get', url: '/api/v1/hubs' },
      { method: 'get', url: '/api/v1/batches' },
      { method: 'post', url: '/api/v1/routes/optimize' },
      { method: 'delete', url: '/api/v1/admin/dev-purge' },
    ];

    adminOnlyUrls.forEach(({ method, url }) => {
      it(`Rejects Driver accessing restricted URL ${method.toUpperCase()} ${url} with 403 Forbidden`, async () => {
        const res = await request(app)[method](url)
          .set('Authorization', `Bearer ${driverAToken}`);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('Suite 3: Role Escalation via URL (Fleet Manager -> Super Admin Restricted URLs)', () => {
    it('Rejects Fleet Manager attempting GET /api/v1/admin/users with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Fleet Manager attempting GET /api/v1/admin/audit-logs with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Fleet Manager attempting DELETE /api/v1/admin/dev-purge with 403', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/dev-purge')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ confirmPurge: true });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Fleet Manager attempting DELETE /api/v1/vehicles/:id (permanent delete) with 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Fleet Manager attempting PUT /api/v1/drivers/:id (driver profile edit) with 403', async () => {
      const res = await request(app)
        .put(`/api/v1/drivers/${driverADoc._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Tampered Name', phone: '+919876543210' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Rejects Fleet Manager attempting DELETE /api/v1/drivers/:id (driver deletion) with 403', async () => {
      const res = await request(app)
        .delete(`/api/v1/drivers/${driverADoc._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Suite 4: Horizontal URL IDOR Prevention Across Drivers', () => {
    it('Rejects Driver A attempting to view Driver B route directly by URL with 403 FORBIDDEN_ROUTE_ACCESS', async () => {
      // Create Route for Driver B
      const routeB = await Route.create({
        routeCode: `RT-B-${Date.now()}`,
        driverId: driverBDoc._id,
        vehicleId: testVehicle._id,
        batchId: testBatch._id,
        status: 'DISPATCHED',
        stops: [],
      });

      // Driver A accesses Route B by ID in URL
      const res = await request(app)
        .get(`/api/v1/routes/${routeB._id}`)
        .set('Authorization', `Bearer ${driverAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN_ROUTE_ACCESS');
    });

    it('Rejects Driver A attempting to complete Driver B delivery directly by URL with 403 FORBIDDEN', async () => {
      // Create Delivery for Driver B
      const deliveryB = await Delivery.create({
        orderReference: `ORD-SEC-B-${Date.now()}`,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driverBDoc._id,
        customer: {
          name: 'Customer B',
          phone: '+919999900099',
        },
        address: {
          street: 'Khandagiri Chowk',
          city: 'Bhubaneswar',
          zone: 'Other',
          postalCode: '751030',
        },
        weightKg: 4.5,
        timeWindow: {
          start: '09:00',
          end: '18:00',
        },
      });

      // Driver A attempts to complete Driver B's delivery
      const res = await request(app)
        .post(`/api/v1/deliveries/${deliveryB._id}/complete`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          signatureSvg: '<svg>signature</svg>',
          notes: 'Unauthorized handover attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('Rejects Driver A submitting telemetry with spoofed Driver B ID in URL/body with 403 UNAUTHORIZED_TELEMETRY_SOURCE', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          driverId: driverBDoc._id,
          vehicleId: testVehicle._id,
          coordinates: [85.8178, 20.3533],
          speedKmh: 42,
          headingDegrees: 180,
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('UNAUTHORIZED_TELEMETRY_SOURCE');
    });
  });
});
