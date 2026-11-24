const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const Delivery = require('../src/models/Delivery');
const Route = require('../src/models/Route');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');
const { DELIVERY_STATUS } = require('../src/config/constants');

describe('Security Tampering Hardening: Telemetry & POD Hardening', () => {
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

  describe('5-Attempt OTP Lockout State Machine (D-02 / SEC-TAMPER-02)', () => {
    test('Locks OTP verification channel after 5 consecutive incorrect attempts with 423 OTP_LOCKED', async () => {
      const delivery = await createTestDelivery({
        assignedDriverId: driver1Doc._id,
        status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
        customer: {
          name: 'Priya Nayak',
          phone: '+919988776655',
        },
        proofOfDelivery: {
          otp: '654321',
          otpFailedAttempts: 0,
          otpLocked: false,
        },
      });

      // Submit 4 incorrect attempts (each returns 400 INVALID_OTP with remaining attempts)
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await request(app)
          .post(`/api/v1/deliveries/${delivery._id}/verify-pod-otp`)
          .set('Authorization', `Bearer ${driver1Auth.token}`)
          .send({ otp: '000000' });

        expect(res.status).toBe(400);
        expect(res.body.error?.code).toBe('INVALID_OTP');
        expect(res.body.error?.message).toContain(`${5 - attempt} attempts remaining`);
      }

      // 5th incorrect attempt trips the lockout
      const fifthRes = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/verify-pod-otp`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({ otp: '000000' });

      expect(fifthRes.status).toBe(423);
      expect(fifthRes.body.error?.code).toBe('OTP_LOCKED');
      expect(fifthRes.body.error?.message).toMatch(/Maximum OTP attempts exceeded/i);

      // Verify DB delivery record transitioned to locked state
      const lockedDelivery = await Delivery.findById(delivery._id);
      expect(lockedDelivery.proofOfDelivery.otpLocked).toBe(true);
      expect(lockedDelivery.proofOfDelivery.otpFailedAttempts).toBe(5);
      expect(lockedDelivery.proofOfDelivery.otpLockedAt).not.toBeNull();

      // Subsequent attempt (even with valid dev OTP) is immediately refused with 423 OTP_LOCKED
      const subsequentRes = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/verify-pod-otp`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({ otp: '123456' });

      expect(subsequentRes.status).toBe(423);
      expect(subsequentRes.body.error?.code).toBe('OTP_LOCKED');
    });

    test('Resets failed attempt counter upon successful OTP verification', async () => {
      const delivery = await createTestDelivery({
        assignedDriverId: driver1Doc._id,
        status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
        customer: {
          name: 'Priya Nayak',
          phone: '+919988776655',
        },
        proofOfDelivery: {
          otp: '654321',
          otpFailedAttempts: 2,
          otpLocked: false,
        },
      });

      // Valid OTP submission (using 123456 bypass)
      const res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/verify-pod-otp`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({ otp: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Delivery.findById(delivery._id);
      expect(updated.proofOfDelivery.otpVerified).toBe(true);
      expect(updated.proofOfDelivery.otpFailedAttempts).toBe(0);
    });
  });

  describe('POD Completion Chronology Validation (D-02 / SEC-TAMPER-02)', () => {
    test('Rejects delivery completion timestamp > 5 minutes in the future with 400 INVALID_DELIVERY_TIMESTAMP', async () => {
      const delivery = await createTestDelivery({
        assignedDriverId: driver1Doc._id,
        status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
      });

      const futureTimestamp = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins in future

      const res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({
          signatureSvg: '<svg>sig</svg>',
          completedAt: futureTimestamp,
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('INVALID_DELIVERY_TIMESTAMP');
      expect(res.body.error?.message).toMatch(/future/i);
    });

    test('Rejects delivery completion timestamp before route dispatch time with 400 INVALID_DELIVERY_TIMESTAMP', async () => {
      const dispatchTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      const route = new Route({
        routeCode: `ROUTE-CHRONO-${Math.floor(Math.random() * 90000 + 10000)}`,
        batchId: new mongoose.Types.ObjectId(),
        driverId: driver1Doc._id,
        vehicleId: vehicle1._id,
        status: 'DISPATCHED',
        dispatchedAt: dispatchTime,
        stops: [],
      });
      await route.save();

      const delivery = await createTestDelivery({
        assignedDriverId: driver1Doc._id,
        routeId: route._id,
        status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
      });

      const beforeDispatchTime = new Date(dispatchTime.getTime() - 10 * 60 * 1000).toISOString(); // 10 mins before dispatch

      const res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({
          signatureSvg: '<svg>sig</svg>',
          completedAt: beforeDispatchTime,
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('INVALID_DELIVERY_TIMESTAMP');
      expect(res.body.error?.message).toMatch(/dispatch/i);
    });

    test('Accepts delivery completion timestamp within +5 min tolerance and after route dispatch', async () => {
      const dispatchTime = new Date(Date.now() - 30 * 60 * 1000);
      const route = new Route({
        routeCode: `ROUTE-CHRONO-${Math.floor(Math.random() * 90000 + 10000)}`,
        batchId: new mongoose.Types.ObjectId(),
        driverId: driver1Doc._id,
        vehicleId: vehicle1._id,
        status: 'DISPATCHED',
        dispatchedAt: dispatchTime,
        stops: [],
      });
      await route.save();

      const delivery = await createTestDelivery({
        assignedDriverId: driver1Doc._id,
        routeId: route._id,
        status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
      });

      // +2 minutes ahead of server clock (within 5-min tolerance)
      const validToleratedTimestamp = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set('Authorization', `Bearer ${driver1Auth.token}`)
        .send({
          signatureSvg: '<svg>sig</svg>',
          completedAt: validToleratedTimestamp,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const completedDelivery = await Delivery.findById(delivery._id);
      expect(completedDelivery.status).toBe(DELIVERY_STATUS.COMPLETED);
    });
  });
});
