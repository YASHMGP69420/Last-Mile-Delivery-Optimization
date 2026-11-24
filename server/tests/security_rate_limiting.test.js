const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Mock telemetryService before requiring app
jest.mock('../src/services/telemetryService', () => ({
  recordTelemetry: jest.fn().mockResolvedValue({
    _id: 'mock-ping-id',
    driverId: 'driver-test-tracer',
    timestamp: new Date().toISOString(),
  }),
  getLiveFleetStatus: jest.fn().mockResolvedValue([]),
  getVehicleHistory: jest.fn().mockResolvedValue([]),
  getAlerts: jest.fn().mockResolvedValue([]),
  acknowledgeAlert: jest.fn().mockResolvedValue({}),
}));

// Mock devPurgeService for heavyOps testing
jest.mock('../src/services/devPurgeService', () => ({
  purgeAllOperationalData: jest.fn().mockResolvedValue({
    collectionsPurged: 0,
    timestamp: new Date().toISOString(),
  }),
}));

const app = require('../src/app');
const env = require('../src/config/env');
const { ROLES } = require('../src/config/constants');
const Hub = require('../src/models/Hub');

describe('Tiered Rate Limiting Security Hardening (D-03 / SEC-DOS-03)', () => {
  let hubFindSpy;

  beforeAll(() => {
    hubFindSpy = jest.spyOn(Hub, 'find').mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
  });

  afterAll(() => {
    if (hubFindSpy) {
      hubFindSpy.mockRestore();
    }
  });

  const createAuthToken = (userId, role = ROLES.DRIVER) => {
    return jwt.sign(
      {
        sub: userId,
        id: userId,
        role,
        email: `${role.toLowerCase()}_${userId}@smartroute.test`,
      },
      env.JWT_SECRET || 'test_jwt_secret_smartroute_bhubaneswar_2026',
      { expiresIn: '1h' }
    );
  };

  describe('Rate Limiting Tracer: End-to-end Tier 1 Telemetry Ingestion Throttling', () => {
    test('enforces 120 pings/min threshold on telemetry ingestion with HTTP 429 and standard RateLimit headers', async () => {
      const originalEnv = process.env.ENABLE_TEST_RATE_LIMIT;
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';

      try {
        const driverId = new mongoose.Types.ObjectId().toString();
        const token = createAuthToken(driverId, ROLES.DRIVER);

        // Send 120 legitimate telemetry pings
        for (let i = 0; i < 120; i += 1) {
          const res = await request(app)
            .post('/api/v1/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
              location: {
                type: 'Point',
                coordinates: [85.8245, 20.2961],
              },
              speed: 35,
            });

          expect(res.status).toBe(201);
        }

        // The 121st request within the 1-minute window must be throttled
        const throttledRes = await request(app)
          .post('/api/v1/telemetry')
          .set('Authorization', `Bearer ${token}`)
          .send({
            location: {
              type: 'Point',
              coordinates: [85.8245, 20.2961],
            },
            speed: 35,
          });

        expect(throttledRes.status).toBe(429);
        expect(throttledRes.body.success).toBe(false);
        expect(throttledRes.body.error.code).toBe('TELEMETRY_RATE_LIMIT_EXCEEDED');
        expect(throttledRes.body.message).toMatch(/max 120 pings\/min/i);

        // Standard IETF RateLimit-* headers must be present
        expect(
          throttledRes.headers['ratelimit-limit'] || throttledRes.headers['ratelimit-policy']
        ).toBeDefined();
        expect(throttledRes.headers['ratelimit-remaining']).toBe('0');

        // Legacy X-RateLimit-* headers must be disabled
        expect(throttledRes.headers['x-ratelimit-limit']).toBeUndefined();
        expect(throttledRes.headers['x-ratelimit-remaining']).toBeUndefined();

        // Separate driver user must NOT be throttled by previous driver's bucket
        const separateDriverId = new mongoose.Types.ObjectId().toString();
        const separateToken = createAuthToken(separateDriverId, ROLES.DRIVER);

        const unblockedRes = await request(app)
          .post('/api/v1/telemetry')
          .set('Authorization', `Bearer ${separateToken}`)
          .send({
            location: {
              type: 'Point',
              coordinates: [85.8245, 20.2961],
            },
            speed: 40,
          });

        expect(unblockedRes.status).toBe(201);
      } finally {
        process.env.ENABLE_TEST_RATE_LIMIT = originalEnv;
      }
    });

    test('bypasses rate limiting when ENABLE_TEST_RATE_LIMIT is unset or false in test environment', async () => {
      const originalEnv = process.env.ENABLE_TEST_RATE_LIMIT;
      delete process.env.ENABLE_TEST_RATE_LIMIT;

      try {
        const driverId = new mongoose.Types.ObjectId().toString();
        const token = createAuthToken(driverId, ROLES.DRIVER);

        // Send 5 quick requests - in test bypass mode, skip is triggered
        for (let i = 0; i < 5; i += 1) {
          const res = await request(app)
            .post('/api/v1/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
              location: {
                type: 'Point',
                coordinates: [85.8245, 20.2961],
              },
              speed: 25,
            });

          expect(res.status).toBe(201);
        }
      } finally {
        process.env.ENABLE_TEST_RATE_LIMIT = originalEnv;
      }
    });
  });

  describe('Tier 2: Operational CRUD Rate Limiter (100 req/min per user)', () => {
    test('enforces 100 req/min limit on operational CRUD routes with CRUD_RATE_LIMIT_EXCEEDED', async () => {
      const originalEnv = process.env.ENABLE_TEST_RATE_LIMIT;
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';

      try {
        const adminId = new mongoose.Types.ObjectId().toString();
        const token = createAuthToken(adminId, ROLES.ADMIN);

        // Send 100 operational requests
        for (let i = 0; i < 100; i += 1) {
          const res = await request(app)
            .get('/api/v1/hubs')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(200);
        }

        // The 101st request within the 1-minute window must return 429
        const throttledRes = await request(app)
          .get('/api/v1/hubs')
          .set('Authorization', `Bearer ${token}`);

        expect(throttledRes.status).toBe(429);
        expect(throttledRes.body.success).toBe(false);
        expect(throttledRes.body.error.code).toBe('CRUD_RATE_LIMIT_EXCEEDED');
        expect(throttledRes.body.message).toMatch(/max 100 req\/min/i);
        expect(throttledRes.headers['ratelimit-remaining']).toBe('0');

        // Distinct user is isolated and unaffected
        const otherAdminId = new mongoose.Types.ObjectId().toString();
        const otherToken = createAuthToken(otherAdminId, ROLES.ADMIN);

        const okRes = await request(app)
          .get('/api/v1/hubs')
          .set('Authorization', `Bearer ${otherToken}`);

        expect(okRes.status).toBe(200);
      } finally {
        process.env.ENABLE_TEST_RATE_LIMIT = originalEnv;
      }
    });
  });

  describe('Tier 3: Heavy Operations Rate Limiter (15 req / 15 min per user)', () => {
    test('enforces 15 req/15min limit on heavy endpoints with HEAVY_OPS_RATE_LIMIT_EXCEEDED', async () => {
      const originalEnv = process.env.ENABLE_TEST_RATE_LIMIT;
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';

      try {
        const adminId = new mongoose.Types.ObjectId().toString();
        const token = createAuthToken(adminId, ROLES.ADMIN);

        // Send 15 heavy operational requests
        for (let i = 0; i < 15; i += 1) {
          const res = await request(app)
            .delete('/api/v1/admin/dev-purge')
            .set('Authorization', `Bearer ${token}`)
            .send({ confirmPurge: true });

          expect(res.status).toBe(200);
        }

        // The 16th request must be throttled
        const throttledRes = await request(app)
          .delete('/api/v1/admin/dev-purge')
          .set('Authorization', `Bearer ${token}`)
          .send({ confirmPurge: true });

        expect(throttledRes.status).toBe(429);
        expect(throttledRes.body.success).toBe(false);
        expect(throttledRes.body.error.code).toBe('HEAVY_OPS_RATE_LIMIT_EXCEEDED');
        expect(throttledRes.body.message).toMatch(/15 minutes before retrying/i);
        expect(throttledRes.headers['ratelimit-remaining']).toBe('0');
      } finally {
        process.env.ENABLE_TEST_RATE_LIMIT = originalEnv;
      }
    });
  });
});
