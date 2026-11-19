const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
const VehicleAssignment = require('../src/models/VehicleAssignment');
const RouteAssignment = require('../src/models/RouteAssignment');
const socketService = require('../src/services/socketService');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 21: Driver Handheld Delivery Sync & Demo Account Isolation', () => {
  let driverUser, driverDoc, vehicleDoc, driverToken;
  let adminUser, adminToken;
  let mockIo, emittedEvents, prevIo;

  beforeEach(async () => {
    // Setup Admin
    const admin = await createTestUser('ADMIN');
    adminUser = admin.user;
    adminToken = admin.token;

    // Setup Driver and Vehicle
    const driverAuth = await createTestUser('DRIVER');
    driverUser = driverAuth.user;
    driverToken = driverAuth.token;

    vehicleDoc = await createTestVehicle({ availability: 'IN_TRANSIT' });
    driverDoc = await createTestDriver(driverUser, {
      assignedVehicleId: vehicleDoc._id,
      availability: 'IN_TRANSIT',
    });

    // Setup Socket.IO Mock
    emittedEvents = [];
    prevIo = socketService.getIo();
    mockIo = {
      to: jest.fn((room) => ({
        emit: jest.fn((event, payload) => {
          emittedEvents.push({ room, event, payload });
        }),
      })),
    };
    socketService.setIo(mockIo);
  });

  afterEach(() => {
    socketService.setIo(prevIo);
    jest.restoreAllMocks();
  });

  describe('DRIVER-SYNC-02: markDeliveryArrived', () => {
    test('markDeliveryArrived updates Delivery status to OUT_FOR_DELIVERY and Route.stops[i].status to ARRIVED within withTransaction', async () => {
      const batch = await DeliveryBatch.create({
        code: `BATCH-P21-${Date.now()}`,
        name: 'Batch P21 Sync',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#P21-SYNC-ARR-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
      });

      const route = await Route.create({
        routeCode: `RT-P21-ARR-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${delivery._id}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.delivery.status).toBe('OUT_FOR_DELIVERY');

      // Check DB persistence
      const updatedDelivery = await Delivery.findById(delivery._id);
      expect(updatedDelivery.status).toBe('OUT_FOR_DELIVERY');

      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute.status).toBe('IN_PROGRESS');
      expect(updatedRoute.stops[0].status).toBe('ARRIVED');
    });

    test('socketService.emitDeliveryUpdated broadcasts delivery:updated, delivery:status_changed, route:updated, and driver:stop_progressed to management room, driver room, and route room', async () => {
      const batch = await DeliveryBatch.create({
        code: `BATCH-P21-SOCK-${Date.now()}`,
        name: 'Batch P21 Socket',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#P21-SOCK-ARR-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
      });

      const route = await Route.create({
        routeCode: `RT-P21-SOCK-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      await request(app)
        .post(`/api/v1/driver-hud/deliveries/${delivery._id}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);

      // Verify emitted events to management room
      const mgmtEvents = emittedEvents.filter((e) => e.room === 'management');
      const mgmtEventNames = mgmtEvents.map((e) => e.event);
      expect(mgmtEventNames).toContain('delivery:updated');
      expect(mgmtEventNames).toContain('delivery:status_changed');
      expect(mgmtEventNames).toContain('route:updated');
      expect(mgmtEventNames).toContain('driver:stop_progressed');

      // Verify emitted events to driver room
      const driverEvents = emittedEvents.filter((e) => e.room === `driver:${driverDoc._id}`);
      const driverEventNames = driverEvents.map((e) => e.event);
      expect(driverEventNames).toContain('delivery:updated');
      expect(driverEventNames).toContain('delivery:status_changed');
      expect(driverEventNames).toContain('route:updated');
      expect(driverEventNames).toContain('driver:stop_progressed');

      // Verify emitted events to route room
      const routeEvents = emittedEvents.filter((e) => e.room === `route:${route._id}`);
      const routeEventNames = routeEvents.map((e) => e.event);
      expect(routeEventNames).toContain('delivery:updated');
      expect(routeEventNames).toContain('delivery:status_changed');
      expect(routeEventNames).toContain('route:updated');
      expect(routeEventNames).toContain('route:progress');
      expect(routeEventNames).toContain('driver:stop_progressed');

      // Check payload fields
      const samplePayload = mgmtEvents.find((e) => e.event === 'driver:stop_progressed').payload;
      expect(samplePayload.deliveryId).toBe(delivery._id.toString());
      expect(samplePayload.routeId).toBe(route._id.toString());
      expect(samplePayload.driverId).toBe(driverDoc._id.toString());
      expect(samplePayload.stopStatus).toBe('ARRIVED');
    });

    test('If Route or Delivery update fails midway inside withTransaction, error is propagated and no partial state corruption occurs', async () => {
      const batch = await DeliveryBatch.create({
        code: `BATCH-P21-ROLL-${Date.now()}`,
        name: 'Batch P21 Rollback',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#P21-ROLL-ARR-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
      });

      const route = await Route.create({
        routeCode: `RT-P21-ROLL-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      // Mock Route.updateOne to fail midway
      jest.spyOn(Route, 'updateOne').mockImplementationOnce(() => {
        throw new Error('Database transaction connection error');
      });

      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${delivery._id}/arrived`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(500);

      // Verify delivery:updated was not emitted
      expect(emittedEvents.filter((e) => e.event === 'driver:stop_progressed')).toHaveLength(0);
    });
  });

  describe('DRIVER-SYNC-02: completeDelivery, failDelivery and Route Finalization', () => {
    test('completeDelivery atomically updates Delivery.status to COMPLETED, saves POD/OTP, updates Route stop status to COMPLETED, and finalizes route on final stop', async () => {
      const batch = await DeliveryBatch.create({
        code: `BATCH-P21-CMP-${Date.now()}`,
        name: 'Batch P21 Complete',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#P21-CMP-DEL-${Date.now()}`,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
        proofOfDelivery: {
          otp: '4829',
          otpVerified: false,
        },
      });

      const route = await Route.create({
        routeCode: `RT-P21-CMP-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'ARRIVED',
          },
        ],
      });

      const vehicleAssignment = await VehicleAssignment.create({
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        routeId: route._id,
        status: 'ACTIVE',
        startTime: new Date(),
        endTime: new Date(Date.now() + 8 * 3600 * 1000),
      });

      const routeAssignment = await RouteAssignment.create({
        routeId: route._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'IN_PROGRESS',
        startTime: new Date(),
        expectedEndTime: new Date(Date.now() + 8 * 3600 * 1000),
      });

      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${delivery._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          otp: '4829',
          signatureSvg: '<svg>sig</svg>',
          photoUrl: 'https://example.com/pod.jpg',
          recipientName: 'Jane Customer',
          notes: 'Delivered at porch',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify delivery updated in DB
      const updatedDel = await Delivery.findById(delivery._id);
      expect(updatedDel.status).toBe('COMPLETED');
      expect(updatedDel.proofOfDelivery.otpVerified).toBe(true);
      expect(updatedDel.proofOfDelivery.signatureSvg).toBe('<svg>sig</svg>');
      expect(updatedDel.proofOfDelivery.photoUrl).toBe('https://example.com/pod.jpg');

      // Verify route stop updated to COMPLETED and route finalized
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute.stops[0].status).toBe('COMPLETED');
      expect(updatedRoute.status).toBe('COMPLETED');

      // Verify driver and vehicle released
      const updatedDriver = await Driver.findById(driverDoc._id);
      expect(updatedDriver.availability).toBe('AVAILABLE');

      const updatedVehicle = await Vehicle.findById(vehicleDoc._id);
      expect(updatedVehicle.availability).toBe('AVAILABLE');

      // Verify assignments completed
      const updatedVA = await VehicleAssignment.findById(vehicleAssignment._id);
      expect(updatedVA.status).toBe('COMPLETED');

      const updatedRA = await RouteAssignment.findById(routeAssignment._id);
      expect(updatedRA.status).toBe('COMPLETED');

      // Verify batch closed
      const updatedBatch = await DeliveryBatch.findById(batch._id);
      expect(updatedBatch.status).toBe('CLOSED');

      // Verify socket emissions
      const compEvents = emittedEvents.filter((e) => e.event === 'driver:stop_progressed');
      expect(compEvents.length).toBeGreaterThanOrEqual(1);
      const payload = compEvents[0].payload;
      expect(payload.stopStatus).toBe('COMPLETED');
      expect(payload.deliveryId).toBe(delivery._id.toString());
    });

    test('failDelivery atomically updates Delivery.status to FAILED, saves failureReason and notes, updates Route stop status to FAILED, and checks route finalization', async () => {
      const batch = await DeliveryBatch.create({
        code: `BATCH-P21-FAIL-${Date.now()}`,
        name: 'Batch P21 Fail',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#P21-FAIL-DEL-${Date.now()}`,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driverDoc._id,
        assignedVehicleId: vehicleDoc._id,
      });

      const route = await Route.create({
        routeCode: `RT-P21-FAIL-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicleDoc._id,
        driverId: driverDoc._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'ARRIVED',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${delivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          failureReason: 'CUSTOMER_UNAVAILABLE',
          failureNotes: 'Customer not answering doorbell or phone',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify Delivery in DB
      const updatedDel = await Delivery.findById(delivery._id);
      expect(updatedDel.status).toBe('FAILED');
      expect(updatedDel.failureReason).toBe('CUSTOMER_UNAVAILABLE');
      expect(updatedDel.failureNotes).toContain('doorbell');

      // Verify Route stop status in DB
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute.stops[0].status).toBe('FAILED');
      // All stops terminal -> route completed
      expect(updatedRoute.status).toBe('COMPLETED');

      // Verify socket emissions
      const failEvents = emittedEvents.filter((e) => e.event === 'driver:stop_progressed');
      expect(failEvents.length).toBeGreaterThanOrEqual(1);
      const payload = failEvents[0].payload;
      expect(payload.stopStatus).toBe('FAILED');
      expect(payload.failureReason).toBe('CUSTOMER_UNAVAILABLE');
    });
  });
});
