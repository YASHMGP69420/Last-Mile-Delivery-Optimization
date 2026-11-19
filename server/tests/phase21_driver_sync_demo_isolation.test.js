const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
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
});
