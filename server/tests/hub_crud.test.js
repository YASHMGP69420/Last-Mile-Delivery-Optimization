const request = require('supertest');
const app = require('../src/app');
const Hub = require('../src/models/Hub');
const { seedHubs } = require('../src/seed/seedHubs');
const { createTestUser } = require('./helpers/testUtils');

describe('Hub Management & Multi-Depot Operations (server/tests/hub_crud.test.js)', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    await Hub.deleteMany({});
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;
  });

  describe('Hub Tracer', () => {
    test('authenticated GET /api/v1/hubs returns 200 with seeded Bhubaneswar hubs', async () => {
      // Seed hubs
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

      // Verify in DB
      const dbHub = await Hub.findOne({ code: 'HUB-SAHEED' });
      expect(dbHub).not.toBeNull();
      expect(dbHub.name).toBe('Saheed Nagar Dispatch Post');
      expect(dbHub.location.lat).toBeCloseTo(20.2882, 4);
    });
  });
});
