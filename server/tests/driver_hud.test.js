const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const Route = require('../src/models/Route');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

describe('Driver HUD & Driver Cockpit Test Suite (server/tests/driver_hud.test.js)', () => {
  let driverUser;
  let driverToken;
  let driverDoc;
  let vehicleDoc;

  let otherDriverUser;
  let otherDriverToken;
  let otherDriverDoc;

  beforeEach(async () => {
    // Primary driver
    const driverAuth = await createTestUser('DRIVER');
    driverUser = driverAuth.user;
    driverToken = driverAuth.token;

    vehicleDoc = await createTestVehicle({ vehicleId: `OD-02-HUD-${Math.floor(Math.random() * 9000 + 1000)}` });
    driverDoc = await createTestDriver(driverUser, { assignedVehicleId: vehicleDoc._id });

    // Secondary driver (for BOLA tests)
    const otherAuth = await createTestUser('DRIVER');
    otherDriverUser = otherAuth.user;
    otherDriverToken = otherAuth.token;
    otherDriverDoc = await createTestDriver(otherDriverUser);
  });

  describe('1. Driver Cockpit Dashboard', () => {
    test('TC-HUD-DASH-1: Driver retrieves live dashboard metrics', async () => {
      const res = await request(app)
        .get('/api/v1/driver-hud/dashboard')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.id).toBe(driverDoc._id.toString());
      expect(res.body.data.vehicle).toBeDefined();
      expect(res.body.data.metrics).toBeDefined();
    });
  });

  describe('2. Shift Management & Attendance Tools', () => {
    test('TC-HUD-SHIFT-1: Start shift transitions driver availability to ON_DUTY', async () => {
      const res = await request(app)
        .post('/api/v1/driver-hud/shifts/start')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shift.status).toBe('IN_PROGRESS');

      const updatedDriver = await Driver.findById(driverDoc._id);
      expect(updatedDriver.availability).toBe('ON_DUTY');
    });

    test('TC-HUD-SHIFT-2: Toggle break updates driver status', async () => {
      // Must start shift first
      await request(app)
        .post('/api/v1/driver-hud/shifts/start')
        .set('Authorization', `Bearer ${driverToken}`);

      const breakRes = await request(app)
        .post('/api/v1/driver-hud/shifts/break')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ onBreak: true });

      expect(breakRes.status).toBe(200);
      expect(breakRes.body.data.availability).toBe('ON_BREAK');
    });

    test('TC-HUD-SHIFT-3: Ending shift with incomplete route deliveries requires handover notes', async () => {
      // Start shift
      await request(app)
        .post('/api/v1/driver-hud/shifts/start')
        .set('Authorization', `Bearer ${driverToken}`);

      // Create an active route with an incomplete stop
      const del = await Delivery.create({
        orderReference: `HUD-SHIFT-${Date.now()}`,
        customer: { name: 'Sanjib Mohanty', phone: '+91 99999 11111' },
        address: { street: 'Nayapalli', city: 'Bhubaneswar', zone: 'Jaydev Vihar (Z-2)', postalCode: '751012' },
        location: { coordinates: [85.82, 20.29] },
        weightKg: 2.5,
        timeWindow: { start: '09:00', end: '11:00' },
        status: 'ASSIGNED',
        assignedDriverId: driverDoc._id,
      });

      await Route.create({
        routeCode: `RT-SHIFT-${Date.now()}`,
        batchId: new mongoose.Types.ObjectId(),
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: del._id,
            orderReference: del.orderReference,
            customer: del.customer,
            address: del.address,
            location: { lat: 20.29, lng: 85.82 },
            weightKg: 2.5,
            priority: 'Standard',
            timeWindow: { start: '09:00', end: '11:00' },
            status: 'PENDING',
          },
        ],
      });

      // Attempt end shift without handover notes -> 400
      const badEndRes = await request(app)
        .post('/api/v1/driver-hud/shifts/end')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ handoverNotes: '' });

      expect(badEndRes.status).toBe(400);
      expect(badEndRes.body.error.code).toBe('INCOMPLETE_DELIVERIES_HANDOVER_REQUIRED');

      // Valid end shift with handover notes -> 200
      const goodEndRes = await request(app)
        .post('/api/v1/driver-hud/shifts/end')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ handoverNotes: 'Remaining stops handed over to relief driver at depot hub' });

      expect(goodEndRes.status).toBe(200);
      expect(goodEndRes.body.success).toBe(true);

      const refreshedDriver = await Driver.findById(driverDoc._id);
      expect(refreshedDriver.availability).toBe('OFF_DUTY');
    });
  });

  describe('3. Vehicle Pre-Trip Checklist & Critical Failure Safety Guard', () => {
    test('TC-HUD-CHECK-1: Clean checklist passes inspection', async () => {
      const payload = {
        odometerReadingKm: 12450,
        fuelOrBatteryLevelPercent: 92,
        items: {
          brakes: { status: 'PASS' },
          tyres: { status: 'PASS' },
          lights: { status: 'PASS' },
          indicators: { status: 'PASS' },
          mirrors: { status: 'PASS' },
          horn: { status: 'PASS' },
          bodyCondition: { status: 'PASS' },
          documents: { status: 'PASS' },
        },
        overallNotes: 'Vehicle in prime condition, clean windshield',
      };

      const res = await request(app)
        .post('/api/v1/driver-hud/vehicle-check')
        .set('Authorization', `Bearer ${driverToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.checklist.status).toBe('PASSED');
      expect(res.body.data.checklist.hasCriticalFailure).toBe(false);
    });

    test('TC-HUD-CHECK-2: Critical safety item failure automatically suspends vehicle to MAINTENANCE', async () => {
      const payload = {
        odometerReadingKm: 12450,
        fuelOrBatteryLevelPercent: 88,
        items: {
          brakes: { status: 'NEEDS_ATTENTION', notes: 'Severe grinding noise and spongy pedal' },
          tyres: { status: 'PASS' },
          lights: { status: 'PASS' },
        },
        overallNotes: 'Do not dispatch until brake pads inspected',
      };

      const res = await request(app)
        .post('/api/v1/driver-hud/vehicle-check')
        .set('Authorization', `Bearer ${driverToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.checklist.status).toBe('FAILED_CRITICAL');
      expect(res.body.data.checklist.hasCriticalFailure).toBe(true);
      expect(res.body.data.vehicleStatus).toBe('MAINTENANCE');

      // Verify vehicle in DB is now MAINTENANCE
      const vehicleInDb = await Vehicle.findById(vehicleDoc._id);
      expect(vehicleInDb.status).toBe('MAINTENANCE');
    });
  });

  describe('4. Delivery Execution, POD & Failure Reporting', () => {
    let testDelivery;

    beforeEach(async () => {
      testDelivery = await Delivery.create({
        orderReference: `HUD-DEL-${Date.now()}`,
        customer: { name: 'Manoj Kumar', phone: '+91 94370 12345' },
        address: { street: 'Saheed Nagar, Plot 52', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { coordinates: [85.85, 20.29] },
        weightKg: 3.2,
        timeWindow: { start: '10:00', end: '12:00' },
        status: 'ASSIGNED',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
      });

      await Route.create({
        routeCode: `RT-HUD-${Date.now()}`,
        batchId: new mongoose.Types.ObjectId(),
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: testDelivery._id,
            orderReference: testDelivery.orderReference,
            customer: testDelivery.customer,
            address: testDelivery.address,
            location: { lat: 20.29, lng: 85.85 },
            weightKg: 3.2,
            priority: 'Standard',
            timeWindow: { start: '10:00', end: '12:00' },
            status: 'PENDING',
          },
        ],
      });
    });

    test('TC-HUD-DEL-1: Mark arrived transitions delivery to OUT_FOR_DELIVERY', async () => {
      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${testDelivery._id}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.delivery.status).toBe('OUT_FOR_DELIVERY');
    });

    test('TC-HUD-DEL-2: Complete delivery with Proof of Delivery (POD)', async () => {
      const podPayload = {
        recipientName: 'Manoj Kumar',
        signatureSvg: '<svg>signature_sample</svg>',
        photoUrl: 'https://smartroute.test/pod/photo1.jpg',
        handoverNotes: 'Handed directly to recipient at front desk',
      };

      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${testDelivery._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send(podPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.delivery.status).toBe('COMPLETED');
      expect(res.body.data.delivery.proofOfDelivery.handoverNotes).toBe(podPayload.handoverNotes);
    });

    test('TC-HUD-DEL-3: Fail delivery requires mandatory failure reason', async () => {
      // Missing reason -> 400
      const badRes = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${testDelivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ failureReason: 'INVALID_REASON_CODE' });

      expect(badRes.status).toBe(400);

      // Valid failure reason
      const goodRes = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${testDelivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          failureReason: 'CUSTOMER_UNAVAILABLE',
          failureNotes: 'Attempted delivery twice; door locked and phone switched off',
        });

      expect(goodRes.status).toBe(200);
      expect(goodRes.body.data.delivery.status).toBe('FAILED');
      expect(goodRes.body.data.delivery.failureReason).toBe('CUSTOMER_UNAVAILABLE');
    });

    test('TC-HUD-BOLA-1: Secondary driver receives 403 Forbidden on primary driver delivery', async () => {
      const res = await request(app)
        .get(`/api/v1/driver-hud/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${otherDriverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BOLA_VIOLATION');
    });
  });

  describe('5. Driver Incident Reporting & Profile', () => {
    test('TC-HUD-INC-1: Report route obstruction incident', async () => {
      const res = await request(app)
        .post('/api/v1/driver-hud/incidents')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          category: 'ROUTE_OBSTRUCTION',
          severity: 'HIGH',
          description: 'Waterlogging on Rasulgarh underpass due to heavy rains. Need route detour.',
          locationCoordinates: { lat: 20.296, lng: 85.864 },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.incident.category).toBe('ROUTE_OBSTRUCTION');
      expect(res.body.data.incident.status).toBe('OPEN');
    });

    test('TC-HUD-PROF-1: Driver retrieves lifetime performance statistics', async () => {
      const res = await request(app)
        .get('/api/v1/driver-hud/profile')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.driver.licenseNumber).toBe(driverDoc.licenseNumber);
      expect(res.body.data.performance.onTimeDeliveryPercentage).toBeDefined();
    });
  });
});
