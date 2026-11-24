const request = require('supertest');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
} = require('./helpers/testUtils');

describe('Security Tampering Hardening: Telemetry & Ingress', () => {
  let driver1Auth;
  let driver2Auth;
  let vehicle1;
  let vehicle2;
  let driver1Doc;
  let driver2Doc;

  beforeEach(async () => {
    driver1Auth = await createTestUser('DRIVER');
    driver2Auth = await createTestUser('DRIVER');

    vehicle1 = await createTestVehicle({
      vehicleId: `OD-01-SEC-${Math.floor(Math.random() * 9000 + 1000)}`,
    });
    vehicle2 = await createTestVehicle({
      vehicleId: `OD-02-SEC-${Math.floor(Math.random() * 9000 + 1000)}`,
    });

    driver1Doc = await createTestDriver(driver1Auth.user, {
      assignedVehicleId: vehicle1._id,
    });
    driver2Doc = await createTestDriver(driver2Auth.user, {
      assignedVehicleId: vehicle2._id,
    });
  });

  describe('Driver Telemetry Source Hard-Lock (D-02 / SEC-TAMPER-02)', () => {
    test('Rejects driver attempt to post telemetry with another driver ID with 403 UNAUTHORIZED_TELEMETRY_SOURCE', async () => {
      const spoofPayload = {
        driverId: driver2Doc._id.toString(),
        coordinates: [85.8245, 20.2961],
        speedKmh: 42.0,
      };

      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send(spoofPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('UNAUTHORIZED_TELEMETRY_SOURCE');
      expect(res.body.error?.message).toMatch(/driver identity mismatch/i);
    });

    test('Rejects driver attempt to post telemetry with another vehicle ID with 403 UNAUTHORIZED_TELEMETRY_SOURCE', async () => {
      const spoofPayload = {
        vehicleId: vehicle2._id.toString(),
        coordinates: [85.8245, 20.2961],
        speedKmh: 35.0,
      };

      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send(spoofPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('UNAUTHORIZED_TELEMETRY_SOURCE');
      expect(res.body.error?.message).toMatch(/vehicle identity mismatch/i);
    });

    test('Authoritatively binds driverId and vehicleId to authenticated driver session when omitted', async () => {
      const validPayload = {
        coordinates: [85.8245, 20.2961],
        speedKmh: 30.0,
      };

      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ping.driverId).toBe(driver1Doc._id.toString());
      expect(res.body.data.ping.vehicleId).toBe(vehicle1._id.toString());
    });

    test('Rejects telemetry coordinates out of geographic bounds with 400', async () => {
      const invalidPayload = {
        coordinates: [200.0, 95.0], // lng > 180, lat > 90
        speedKmh: 20.0,
      };

      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
