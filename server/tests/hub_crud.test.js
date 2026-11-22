const request = require('supertest');
const app = require('../src/app');
const Hub = require('../src/models/Hub');
const Vehicle = require('../src/models/Vehicle');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const { seedHubs, DEFAULT_HUBS } = require('../src/seed/seedHubs');
const { purgeAllOperationalData } = require('../src/services/devPurgeService');
const { createTestUser, createTestVehicle } = require('./helpers/testUtils');

describe('Hub Management & Multi-Depot Operations (server/tests/hub_crud.test.js)', () => {
  let adminToken;
  let adminUser;
  let managerToken;
  let driverToken;

  beforeEach(async () => {
    await Vehicle.deleteMany({});
    await DeliveryBatch.deleteMany({});
    await Hub.deleteMany({});

    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const driver = await createTestUser('DRIVER');
    driverToken = driver.token;
  });

  describe('Hub Tracer', () => {
    test('authenticated GET /api/v1/hubs returns 200 with seeded Bhubaneswar hubs', async () => {
      await seedHubs();

      const res = await request(app)
        .get('/api/v1/hubs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.hubs)).toBe(true);
      expect(res.body.data.total).toBe(3);

      const codes = res.body.data.hubs.map((h) => h.code);
      expect(codes).toContain('HUB-RASULGARH');
      expect(codes).toContain('HUB-PATIA');
      expect(codes).toContain('HUB-KHANDAGIRI');

      const canonical = res.body.data.hubs.find((h) => h.isCanonical);
      expect(canonical).toBeDefined();
      expect(canonical.code).toBe('HUB-RASULGARH');
      expect(canonical.location.lat).toBeCloseTo(20.2961, 4);
      expect(canonical.location.lng).toBeCloseTo(85.8645, 4);
    });

    test('POST /api/v1/hubs creates and persists a new hub', async () => {
      const newHubPayload = {
        name: 'Saheed Nagar Dispatch Post',
        code: 'HUB-SAHEED',
        address: 'Plot 45, Saheed Nagar, Bhubaneswar',
        location: {
          lat: 20.2882,
          lng: 85.8436,
        },
        contactPhone: '+91 674 2548900',
        operatingHours: { open: '07:30', close: '21:00' },
        isActive: true,
      };

      const res = await request(app)
        .post('/api/v1/hubs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newHubPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hub).toBeDefined();
      expect(res.body.data.hub.code).toBe('HUB-SAHEED');
      expect(res.body.data.hub.name).toBe('Saheed Nagar Dispatch Post');
      expect(res.body.data.hub.id).toBeDefined();

      const dbHub = await Hub.findOne({ code: 'HUB-SAHEED' });
      expect(dbHub).not.toBeNull();
      expect(dbHub.name).toBe('Saheed Nagar Dispatch Post');
      expect(dbHub.location.lat).toBeCloseTo(20.2882, 4);
    });
  });

  describe('Authentication & Role Authorization', () => {
    test('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/hubs');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects driver users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/hubs')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('allows FLEET_MANAGER role to view and create hubs', async () => {
      const res = await request(app)
        .post('/api/v1/hubs')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Nayapalli Parcel Depot',
          code: 'HUB-NAYAPALLI',
          address: 'Nayapalli, Bhubaneswar',
          location: { lat: 20.3012, lng: 85.8192 },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hub.code).toBe('HUB-NAYAPALLI');
    });
  });

  describe('Full Hub CRUD & Parameter Validations', () => {
    let seededHubs;

    beforeEach(async () => {
      seededHubs = await seedHubs();
    });

    test('GET /api/v1/hubs/:id returns single hub and handles 404', async () => {
      const targetHub = seededHubs[0];
      const res = await request(app)
        .get(`/api/v1/hubs/${targetHub._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hub.code).toBe(targetHub.code);

      const fakeId = '507f1f77bcf86cd799439011';
      const notFoundRes = await request(app)
        .get(`/api/v1/hubs/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('HUB_NOT_FOUND');
    });

    test('PUT /api/v1/hubs/:id updates hub fields and rejects duplicate code', async () => {
      const targetHub = seededHubs.find((h) => !h.isCanonical);

      const updateRes = await request(app)
        .put(`/api/v1/hubs/${targetHub._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Patia Infocity Super-Hub',
          contactPhone: '+91 99999 88888',
          operatingHours: { open: '06:00', close: '22:00' },
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.hub.name).toBe('Patia Infocity Super-Hub');
      expect(updateRes.body.data.hub.contactPhone).toBe('+91 99999 88888');

      // Attempt duplicate code update
      const dupRes = await request(app)
        .put(`/api/v1/hubs/${targetHub._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'HUB-RASULGARH', // Already used by canonical hub
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('DUPLICATE_HUB_CODE');
    });

    test('PATCH /api/v1/hubs/:id/toggle-active toggles status but guards canonical hub', async () => {
      const nonCanonical = seededHubs.find((h) => !h.isCanonical);
      const canonical = seededHubs.find((h) => h.isCanonical);

      // Toggle non-canonical hub
      const toggleRes = await request(app)
        .patch(`/api/v1/hubs/${nonCanonical._id}/toggle-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.hub.isActive).toBe(false);

      // Attempt to deactivate canonical hub
      const canonToggleRes = await request(app)
        .patch(`/api/v1/hubs/${canonical._id}/toggle-active`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(canonToggleRes.status).toBe(400);
      expect(canonToggleRes.body.error.code).toBe('CANNOT_DEACTIVATE_CANONICAL_HUB');
    });

    test('filter GET /api/v1/hubs?isActive=true returns only active hubs', async () => {
      const nonCanonical = seededHubs.find((h) => !h.isCanonical);
      await Hub.updateOne({ _id: nonCanonical._id }, { isActive: false });

      const res = await request(app)
        .get('/api/v1/hubs?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hubs.length).toBe(2);
      expect(res.body.data.hubs.every((h) => h.isActive)).toBe(true);
    });
  });

  describe('Cascade Deletion Guards', () => {
    let seededHubs;

    beforeEach(async () => {
      seededHubs = await seedHubs();
    });

    test('rejects deleting the canonical primary hub with 400', async () => {
      const canonical = seededHubs.find((h) => h.isCanonical);

      const res = await request(app)
        .delete(`/api/v1/hubs/${canonical._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DELETE_CANONICAL_HUB');
    });

    test('rejects deleting hub assigned to active vehicle with 409', async () => {
      const patiaHub = seededHubs.find((h) => h.code === 'HUB-PATIA');

      // Create vehicle assigned to patiaHub
      await createTestVehicle({
        vehicleId: 'OD-02-PATIA-01',
        homeHubId: patiaHub._id,
        availability: 'AVAILABLE',
      });

      const res = await request(app)
        .delete(`/api/v1/hubs/${patiaHub._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HUB_IN_ACTIVE_USE');
      expect(res.body.error.message).toContain('active use by 1 vehicle(s)');
    });

    test('rejects deleting hub referenced in active delivery batch with 409', async () => {
      const khandagiriHub = seededHubs.find((h) => h.code === 'HUB-KHANDAGIRI');

      await DeliveryBatch.create({
        code: `BATCH-KG-${Date.now()}`,
        name: 'Khandagiri Batch',
        date: '2026-11-23',
        status: 'READY',
        hubId: khandagiriHub._id,
      });

      const res = await request(app)
        .delete(`/api/v1/hubs/${khandagiriHub._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('HUB_IN_ACTIVE_USE');
    });

    test('allows deleting non-canonical hub with no active assignments', async () => {
      const nonCanonical = seededHubs.find((h) => !h.isCanonical);

      const res = await request(app)
        .delete(`/api/v1/hubs/${nonCanonical._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkDb = await Hub.findById(nonCanonical._id);
      expect(checkDb).toBeNull();
    });
  });

  describe('Vehicle homeHubId Schema & Canonical Defaulting', () => {
    let canonicalHub;
    let secondaryHub;

    beforeEach(async () => {
      const hubs = await seedHubs();
      canonicalHub = hubs.find((h) => h.isCanonical);
      secondaryHub = hubs.find((h) => !h.isCanonical);
    });

    test('defaults vehicle homeHubId to canonical hub when omitted', async () => {
      const vehicle = await createTestVehicle({
        vehicleId: 'OD-02-DEF-HUB-01',
      });

      expect(vehicle.homeHubId).toBeDefined();
      expect(vehicle.homeHubId.toString()).toBe(canonicalHub._id.toString());
    });

    test('persists custom assigned homeHubId when provided', async () => {
      const vehicle = await createTestVehicle({
        vehicleId: 'OD-02-CUST-HUB-01',
        homeHubId: secondaryHub._id,
      });

      expect(vehicle.homeHubId.toString()).toBe(secondaryHub._id.toString());
    });
  });

  describe('devPurgeService Resilience & Hub Re-seeding', () => {
    test('purgeAllOperationalData re-seeds Bhubaneswar hubs post-purge', async () => {
      // Create a temporary hub that should be removed
      await Hub.create({
        name: 'Temporary Old Hub',
        code: 'HUB-TEMP-OLD',
        address: 'Temp Address',
        location: { lat: 20.25, lng: 85.80 },
      });

      const purgeResult = await purgeAllOperationalData(adminUser._id);
      expect(purgeResult.deletedCount).toBeGreaterThanOrEqual(0);

      // Verify default hubs exist
      const hubsAfterPurge = await Hub.find().sort({ code: 1 });
      expect(hubsAfterPurge.length).toBe(3);

      const codes = hubsAfterPurge.map((h) => h.code);
      expect(codes).toEqual(['HUB-KHANDAGIRI', 'HUB-PATIA', 'HUB-RASULGARH']);
      expect(codes).not.toContain('HUB-TEMP-OLD');
    });
  });
});
