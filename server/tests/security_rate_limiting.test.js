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

const app = require('../src/app');
const env = require('../src/config/env');
const { ROLES } = require('../src/config/constants');

describe('Rate Limiting Tracer: End-to-end Tier 1 Telemetry Ingestion Throttling', () => {
  const createDriverToken = (driverUserId) => {
    return jwt.sign(
      {
        sub: driverUserId,
        id: driverUserId,
        role: ROLES.DRIVER,
        email: `driver_${driverUserId}@smartroute.test`,
      },
      env.JWT_SECRET || 'test_jwt_secret_smartroute_bhubaneswar_2026',
      { expiresIn: '1h' }
    );
  };

  test('enforces 120 pings/min threshold on telemetry ingestion with HTTP 429 and standard RateLimit headers', async () => {
    // Ensure test rate limiting is active for this test
    const originalEnv = process.env.ENABLE_TEST_RATE_LIMIT;
    process.env.ENABLE_TEST_RATE_LIMIT = 'true';

    try {
      const driverId = new mongoose.Types.ObjectId().toString();
      const token = createDriverToken(driverId);

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
      const separateToken = createDriverToken(separateDriverId);

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
      const token = createDriverToken(driverId);

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
