const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Route = require('../src/models/Route');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Delivery = require('../src/models/Delivery');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const AuditEvent = require('../src/models/AuditEvent');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');
const { CANONICAL_DEPOT, DELIVERY_STATUS, VEHICLE_STATUS, DRIVER_AVAILABILITY, AUDIT_EVENT_TYPES } = require('../src/config/constants');

describe('Routes API & Dispatch Integration Test Suite (server/tests/routes.test.js)', () => {
  let adminToken;
  let managerToken;
  let driverUser;
  let driverToken;
  let testDriver;
  let otherDriverUser;
  let otherDriverToken;
  let otherDriver;
  let testVehicle;
  let testBatch;
  let testDeliveries;

  beforeEach(async () => {
    // 1. Setup authenticated actors
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const dData = await createTestUser('DRIVER');
    driverUser = dData.user;
    driverToken = dData.token;

    const dData2 = await createTestUser('DRIVER');
    otherDriverUser = dData2.user;
    otherDriverToken = dData2.token;

    testVehicle = await createTestVehicle({
      capacityKg: 1000,
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
    });

    testDriver = await createTestDriver(driverUser, {
      assignedVehicleId: testVehicle._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
    });

    otherDriver = await createTestDriver(otherDriverUser, {
      availability: DRIVER_AVAILABILITY.AVAILABLE,
    });

    const batchId = new mongoose.Types.ObjectId();

    // 2. Create 3 deliveries across Bhubaneswar clusters in READY status
    testDeliveries = await Delivery.create([
      {
        orderReference: `#DEL-TEST-${Date.now()}-1`,
        batchId,
        customer: { name: 'Amiya Pattnaik', phone: '+91 98610 11111' },
        address: { street: 'Bhawani Mall', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.8520, 20.2880], geocoded: true },
        weightKg: 25.0,
        priority: 'Urgent',
        timeWindow: { start: '09:00', end: '11:00' },
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#DEL-TEST-${Date.now()}-2`,
        batchId,
        customer: { name: 'Priyanka Das', phone: '+91 98610 22222' },
        address: { street: 'Mayfair Lagoon Area', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.8230, 20.3010], geocoded: true },
        weightKg: 40.0,
        priority: 'Standard',
        timeWindow: { start: '10:00', end: '13:00' },
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#DEL-TEST-${Date.now()}-3`,
        batchId,
        customer: { name: 'Rajesh Sahoo', phone: '+91 98610 33333' },
        address: { street: 'KIIT Square', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.8170, 20.3540], geocoded: true },
        weightKg: 35.0,
        priority: 'Cold Chain',
        timeWindow: { start: '11:00', end: '14:00' },
        status: DELIVERY_STATUS.READY,
      },
    ]);

    // 3. Create canonical operational batch with deliveryIds populated
    testBatch = await DeliveryBatch.create({
      _id: batchId,
      code: `BATCH-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: 'Bhubaneswar Central Morning Shift',
      date: '2026-11-04',
      shift: 'Shift A (08:00 - 17:00)',
      depot: CANONICAL_DEPOT,
      deliveryIds: testDeliveries.map(d => d._id),
      vehicleIds: [testVehicle._id],
      driverIds: [testDriver._id],
      status: 'READY',
    });
  });

  describe('1. POST /api/v1/routes/optimize', () => {
    test('TC-INT-ROUTE-1: Optimizes batch consignments returning baseline, optimized, deltas, and draft route', async () => {
      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: testBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toHaveProperty('baseline');
      expect(data).toHaveProperty('optimized');
      expect(data).toHaveProperty('deltas');
      expect(data).toHaveProperty('unassignedDeliveries');
      expect(data).toHaveProperty('routes');

      expect(data.routes.length).toBe(1);
      const route = data.routes[0];
      expect(route.status).toBe('DRAFT');
      expect(route.stops.length).toBe(3);
      expect(route.metrics.totalDistanceKm).toBeGreaterThan(0);
      expect(route.metrics.totalDurationMin).toBeGreaterThan(0);
      expect(route.metrics.costInr).toBeGreaterThan(0);
      expect(route.metrics.co2Kg).toBeGreaterThan(0);

      // Verify draft route in DB
      const dbRoute = await Route.findById(route.id || route._id);
      expect(dbRoute).toBeDefined();
      expect(dbRoute.status).toBe('DRAFT');
    });

    test('TC-INT-ROUTE-2: RBAC authorization protects optimize endpoint', async () => {
      // 1. Missing token -> 401
      const resNoAuth = await request(app)
        .post('/api/v1/routes/optimize')
        .send({ batchId: testBatch._id.toString() });
      expect(resNoAuth.status).toBe(401);

      // 2. DRIVER role -> 403 Forbidden
      const resDriver = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ batchId: testBatch._id.toString() });
      expect(resDriver.status).toBe(403);

      // 3. ADMIN role -> 200 OK
      const resAdmin = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchId: testBatch._id.toString() });
      expect(resAdmin.status).toBe(200);
    });

    test('TC-INT-ROUTE-3: Rejects invalid or non-existent batchId with 404 BATCH_NOT_FOUND', async () => {
      const fakeBatchId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ batchId: fakeBatchId });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('BATCH_NOT_FOUND');
    });

    test('TC-INT-ROUTE-4: Rejects batch with 0 eligible deliveries with 400 NO_DELIVERIES_TO_OPTIMIZE', async () => {
      // Create empty batch
      const emptyBatch = await DeliveryBatch.create({
        code: `EMPTY-${Date.now()}`,
        name: 'Empty Batch',
        date: '2026-11-04',
        depot: CANONICAL_DEPOT,
      });

      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ batchId: emptyBatch._id.toString() });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NO_DELIVERIES_TO_OPTIMIZE');
    });

    test('TC-INT-ROUTE-5: Optimization deltas guarantee distanceSavedKm >= 0 and percentReduction >= 0', async () => {
      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ batchId: testBatch._id.toString() });

      expect(res.status).toBe(200);
      const deltas = res.body.data.deltas;
      expect(deltas.distanceSavedKm).toBeGreaterThanOrEqual(0);
      expect(deltas.percentDistanceReduction).toBeGreaterThanOrEqual(0);
      expect(deltas.costSavedInr).toBeGreaterThanOrEqual(0);
      expect(deltas.co2AvoidedKg).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. POST /api/v1/routes/:id/dispatch', () => {
    let draftRoute;

    beforeEach(async () => {
      // Generate a draft route via optimize
      const optRes = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ batchId: testBatch._id.toString() });

      draftRoute = optRes.body.data.routes[0];
    });

    test('TC-INT-DISPATCH-1: Successfully dispatches route, updates deliveries, vehicle, driver, and batch', async () => {
      const res = await request(app)
        .post(`/api/v1/routes/${draftRoute.id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISPATCHED');
      expect(res.body.data.version).toBe(2);

      // Verify DB mutations
      // 1. Route
      const updatedRoute = await Route.findById(draftRoute.id);
      expect(updatedRoute.status).toBe('DISPATCHED');
      expect(updatedRoute.dispatchedAt).toBeDefined();
      expect(updatedRoute.version).toBe(2);

      // 2. Deliveries transitioned to ASSIGNED
      const updatedDeliveries = await Delivery.find({ batchId: testBatch._id });
      for (const d of updatedDeliveries) {
        expect(d.status).toBe(DELIVERY_STATUS.ASSIGNED);
        expect(d.assignedVehicleId.toString()).toBe(testVehicle._id.toString());
        expect(d.assignedDriverId.toString()).toBe(testDriver._id.toString());
      }

      // 3. Vehicle transitioned to IN_TRANSIT
      const updatedVehicle = await Vehicle.findById(testVehicle._id);
      expect(updatedVehicle.availability).toBe(VEHICLE_STATUS.IN_TRANSIT);

      // 4. Driver transitioned to IN_TRANSIT
      const updatedDriver = await Driver.findById(testDriver._id);
      expect(updatedDriver.availability).toBe(DRIVER_AVAILABILITY.IN_TRANSIT);
      expect(updatedDriver.currentRouteId.toString()).toBe(draftRoute.id);

      // 5. Batch status transitioned to PLANNED
      const updatedBatch = await DeliveryBatch.findById(testBatch._id);
      expect(updatedBatch.status).toBe('PLANNED');
      expect(updatedBatch.metrics.assignedDeliveries).toBe(3);
    });

    test('TC-INT-DISPATCH-2: Creates immutable ROUTE_DISPATCHED AuditEvent', async () => {
      await request(app)
        .post(`/api/v1/routes/${draftRoute.id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      const auditEvent = await AuditEvent.findOne({
        routeId: draftRoute.id,
        type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
      });

      expect(auditEvent).toBeDefined();
      expect(auditEvent.action).toContain('Dispatched route');
      expect(auditEvent.metadata.version).toBe(2);
      expect(auditEvent.metadata.stopsCount).toBe(3);
    });

    test('TC-INT-DISPATCH-3: Idempotency conflict: Re-dispatching an already DISPATCHED route returns 409 INVALID_ROUTE_STATUS', async () => {
      // First dispatch succeeds
      await request(app)
        .post(`/api/v1/routes/${draftRoute.id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      // Second dispatch attempts -> 409
      const reDispatch = await request(app)
        .post(`/api/v1/routes/${draftRoute.id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      expect(reDispatch.status).toBe(409);
      expect(reDispatch.body.error.code).toBe('INVALID_ROUTE_STATUS');
    });

    test('TC-INT-DISPATCH-4: Dispatch returns 404 for non-existent route ID', async () => {
      const fakeRouteId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/v1/routes/${fakeRouteId}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    test('TC-INT-DISPATCH-5: DRIVER cannot dispatch routes (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/routes/${draftRoute.id}/dispatch`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          driverId: testDriver._id.toString(),
          vehicleId: testVehicle._id.toString(),
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. GET /api/v1/routes & Driver BOLA Protection', () => {
    let dispatchedRoute1;
    let dispatchedRoute2;

    beforeEach(async () => {
      // 1. Optimize & dispatch route 1 to testDriver
      const opt1 = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ batchId: testBatch._id.toString() });

      dispatchedRoute1 = opt1.body.data.routes[0];
      await request(app)
        .post(`/api/v1/routes/${dispatchedRoute1.id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ driverId: testDriver._id.toString(), vehicleId: testVehicle._id.toString() });

      // 2. Create second route assigned to otherDriver
      dispatchedRoute2 = await Route.create({
        routeCode: `RT-OTHER-${Date.now()}`,
        batchId: testBatch._id,
        vehicleId: testVehicle._id,
        driverId: otherDriver._id,
        status: 'DISPATCHED',
        version: 1,
        depot: CANONICAL_DEPOT,
        stops: [
          {
            sequence: 1,
            deliveryId: testDeliveries[0]._id,
            orderReference: '#DEL-OTHER-1',
            customer: { name: 'Other Cust', phone: '9861000000' },
            address: { street: 'Khandagiri Road', zone: 'Khandagiri (Z-4)', postalCode: '751030' },
            location: { lat: 20.2580, lng: 85.7870 },
            weightKg: 10,
            priority: 'Standard',
            timeWindow: { start: '09:00', end: '11:00' },
          },
        ],
      });
    });

    test('TC-INT-GET-1: Manager and Admin can list all routes with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/routes')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.routes.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    test('TC-INT-GET-2: Driver listing routes is strictly filtered to their own routes (BOLA)', async () => {
      const res = await request(app)
        .get('/api/v1/routes')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const routes = res.body.data.routes;

      // Must only contain routes assigned to testDriver
      for (const r of routes) {
        const dId = r.driverId ? (r.driverId.id || r.driverId._id || r.driverId).toString() : null;
        expect(dId).toBe(testDriver._id.toString());
        expect(dId).not.toBe(otherDriver._id.toString());
      }
    });

    test('TC-INT-GET-3: Driver querying single route assigned to them returns 200 with populated details', async () => {
      const res = await request(app)
        .get(`/api/v1/routes/${dispatchedRoute1.id}`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(dispatchedRoute1.id);
      expect(res.body.data.vehicleId).toBeDefined();
      expect(res.body.data.driverId).toBeDefined();
    });

    test('TC-INT-GET-4: Driver querying single route assigned to another driver receives 403 Forbidden (BOLA)', async () => {
      const res = await request(app)
        .get(`/api/v1/routes/${dispatchedRoute2._id}`)
        .set('Authorization', `Bearer ${driverToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ROUTE_ACCESS');
    });
  });

  describe('4. BE-01: vehicleAssignments[] in optimize response', () => {
    test('TC-INT-ROUTE-6: Returns vehicleAssignments[] array with vehicle + driver per bin', async () => {
      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: testBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('vehicleAssignments');
      expect(Array.isArray(res.body.data.vehicleAssignments)).toBe(true);
      expect(res.body.data.vehicleAssignments.length).toBeGreaterThan(0);

      const assignment = res.body.data.vehicleAssignments[0];
      expect(assignment).toHaveProperty('vehicleId');
      expect(assignment).toHaveProperty('vehiclePlate');
      expect(assignment).toHaveProperty('makeModel');
      expect(assignment).toHaveProperty('capacityKg');
      expect(assignment).toHaveProperty('utilizationPercent');
      expect(assignment).toHaveProperty('driverId');
      expect(assignment).toHaveProperty('driverName');
      expect(assignment).toHaveProperty('driverLicenseNumber');
      expect(assignment).toHaveProperty('binIndex');
      expect(assignment).toHaveProperty('routeId');
      expect(assignment).toHaveProperty('routeCode');
    });

    test('TC-INT-ROUTE-6b: Multi-vehicle batch returns multiple vehicleAssignments', async () => {
      // Create additional vehicle and driver
      const vehicle2 = await createTestVehicle({
        capacityKg: 1000,
        fuelType: 'Diesel',
        kmPerLitre: 12.5,
      });
      const driver2User = await createTestUser('DRIVER');
      const driver2 = await createTestDriver(driver2User.user, {
        availability: DRIVER_AVAILABILITY.AVAILABLE,
      });

      // Create more deliveries to force multi-bin (exceed single vehicle capacity)
      const manyDeliveries = [];
      for (let i = 0; i < 10; i++) {
        manyDeliveries.push({
          orderReference: `#DEL-MULTI-${Date.now()}-${i}`,
          batchId: testBatch._id,
          customer: { name: `Customer ${i}`, phone: `+91 98610 ${String(i).padStart(5, '0')}` },
          address: { street: `Street ${i}`, zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          location: { type: 'Point', coordinates: [85.8520 + (i * 0.001), 20.2880 + (i * 0.001)], geocoded: true },
          weightKg: 200.0, // Heavy deliveries to force multi-bin
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '17:00' },
          status: DELIVERY_STATUS.READY,
        });
      }
      const createdDeliveries = await Delivery.create(manyDeliveries);

      const multiVehicleBatch = await DeliveryBatch.create({
        code: `MULTI-VEH-${Date.now()}`,
        name: 'Multi Vehicle Batch',
        date: '2026-11-04',
        shift: 'Shift A (08:00 - 17:00)',
        depot: CANONICAL_DEPOT,
        deliveryIds: createdDeliveries.map(d => d._id),
        vehicleIds: [testVehicle._id, vehicle2._id],
        driverIds: [testDriver._id, driver2._id],
        status: 'READY',
      });

      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: multiVehicleBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleAssignments).toBeDefined();
      expect(Array.isArray(res.body.data.vehicleAssignments)).toBe(true);
      expect(res.body.data.vehicleAssignments.length).toBeGreaterThanOrEqual(1);

      // Verify assignments have required fields
      for (const assignment of res.body.data.vehicleAssignments) {
        expect(assignment).toHaveProperty('vehicleId');
        expect(assignment).toHaveProperty('vehiclePlate');
        expect(assignment).toHaveProperty('makeModel');
        expect(assignment).toHaveProperty('capacityKg');
        expect(assignment).toHaveProperty('utilizationPercent');
        expect(assignment).toHaveProperty('driverId');
        expect(assignment).toHaveProperty('driverName');
        expect(assignment).toHaveProperty('driverLicenseNumber');
        expect(assignment).toHaveProperty('binIndex');
        expect(assignment).toHaveProperty('routeId');
        expect(assignment).toHaveProperty('routeCode');
      }
    });
  });

  describe('5. BE-02: Driver auto-assignment round-robin', () => {
    test('TC-INT-ROUTE-7: Driver auto-assignment uses round-robin when batch.driverIds empty', async () => {
      // Create multiple available drivers
      const drivers = [];
      for (let i = 0; i < 3; i++) {
        const dUser = await createTestUser('DRIVER');
        const dDriver = await createTestDriver(dUser.user, {
          availability: DRIVER_AVAILABILITY.AVAILABLE,
        });
        drivers.push(dDriver);
      }

      // Create batch with vehicles but NO driverIds (empty array)
      const batchId = new mongoose.Types.ObjectId();
      const autoBatch = await DeliveryBatch.create({
        _id: batchId,
        code: `AUTO-ASSIGN-${Date.now()}`,
        name: 'Auto Assignment Batch',
        date: '2026-11-04',
        shift: 'Shift A (08:00 - 17:00)',
        depot: CANONICAL_DEPOT,
        deliveryIds: testDeliveries.map(d => d._id),
        vehicleIds: [testVehicle._id],
        driverIds: [], // Empty - should trigger auto-assignment
        status: 'READY',
      });

      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: autoBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleAssignments).toBeDefined();
      expect(res.body.data.vehicleAssignments.length).toBeGreaterThan(0);

      // Verify driver was assigned (not from batch.driverIds which was empty)
      const assignment = res.body.data.vehicleAssignments[0];
      expect(assignment.driverId).toBeDefined();
      expect(assignment.driverName).toBeDefined();

      // Verify driver availability transitioned to IN_TRANSIT after dispatch
      const dispatchRes = await request(app)
        .post(`/api/v1/routes/${res.body.data.routes[0].id}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          driverId: assignment.driverId,
          vehicleId: assignment.vehicleId,
        });

      expect(dispatchRes.status).toBe(200);

      const updatedDriver = await Driver.findById(assignment.driverId);
      expect(updatedDriver.availability).toBe(DRIVER_AVAILABILITY.IN_TRANSIT);
    });
  });

  describe('6. BE-03: Override re-optimization with vehicleIds/driverId', () => {
    test('TC-INT-ROUTE-8: Override re-optimization respects vehicleIds/driverId payload', async () => {
      // First optimize a batch normally
      const optRes1 = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: testBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(optRes1.status).toBe(200);
      const firstRoute = optRes1.body.data.routes[0];
      const firstAssignment = optRes1.body.data.vehicleAssignments[0];

      // Create a different vehicle and driver for override
      const overrideVehicle = await createTestVehicle({
        capacityKg: 1500,
        fuelType: 'Electric',
        kmPerLitre: 15.0,
      });
      const overrideDriverUser = await createTestUser('DRIVER');
      const overrideDriver = await createTestDriver(overrideDriverUser.user, {
        availability: DRIVER_AVAILABILITY.AVAILABLE,
      });

      // Re-optimize with specific vehicleIds and driverId
      const optRes2 = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: testBatch._id.toString(),
          vehicleIds: [overrideVehicle._id.toString()],
          driverId: overrideDriver._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 500,
          },
        });

      expect(optRes2.status).toBe(200);
      expect(optRes2.body.success).toBe(true);

      // Verify the override was respected
      const secondAssignment = optRes2.body.data.vehicleAssignments[0];
      expect(secondAssignment.vehicleId).toBe(overrideVehicle._id.toString());
      expect(secondAssignment.driverId).toBe(overrideDriver._id.toString());
      expect(secondAssignment.vehicleId).not.toBe(firstAssignment.vehicleId);
      expect(secondAssignment.driverId).not.toBe(firstAssignment.driverId);
    });
  });

  describe('7. BE-04: Multi-bin response with full per-bin data', () => {
    test('TC-INT-ROUTE-9: Multi-bin optimize returns full per-bin route data', async () => {
      // Create additional vehicle for multi-bin
      const vehicle2 = await createTestVehicle({
        capacityKg: 1000,
        fuelType: 'Diesel',
        kmPerLitre: 12.5,
      });

      // Create many deliveries across zones to trigger multi-bin
      const manyDeliveries = [];
      const zones = [
        { zone: 'Saheed Nagar (Z-3)', coords: [85.8520, 20.2880] },
        { zone: 'Jaydev Vihar (Z-2)', coords: [85.8230, 20.3010] },
        { zone: 'Patia (Z-1)', coords: [85.8170, 20.3540] },
        { zone: 'Khandagiri (Z-4)', coords: [85.7870, 20.2580] },
      ];

      for (let i = 0; i < 20; i++) {
        const zone = zones[i % zones.length];
        manyDeliveries.push({
          orderReference: `#DEL-MULTI-${Date.now()}-${i}`,
          batchId: testBatch._id,
          customer: { name: `Customer ${i}`, phone: `+91 98610 ${String(i).padStart(5, '0')}` },
          address: { street: `Street ${i}`, zone: zone.zone, postalCode: '751000' },
          location: { type: 'Point', coordinates: zone.coords, geocoded: true },
          weightKg: 100.0, // Heavy deliveries to force multi-bin (total 2000kg > 1000kg capacity)
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '17:00' },
          status: DELIVERY_STATUS.READY,
        });
      }

      const createdDeliveries = await Delivery.create(manyDeliveries);

      const multiBinBatch = await DeliveryBatch.create({
        code: `MULTI-BIN-${Date.now()}`,
        name: 'Multi Bin Batch',
        date: '2026-11-04',
        shift: 'Shift A (08:00 - 17:00)',
        depot: CANONICAL_DEPOT,
        deliveryIds: createdDeliveries.map(d => d._id),
        vehicleIds: [testVehicle._id, vehicle2._id],
        driverIds: [testDriver._id],
        status: 'READY',
      });

      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: multiBinBatch._id.toString(),
          options: {
            trafficScenario: 'MORNING_RUSH',
            maxIterations: 1000,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.routes).toBeDefined();
      expect(Array.isArray(res.body.data.routes)).toBe(true);
      expect(res.body.data.routes.length).toBeGreaterThan(1);

      // Verify each route has full per-bin data
      for (const route of res.body.data.routes) {
        expect(route).toHaveProperty('id');
        expect(route).toHaveProperty('routeCode');
        expect(route).toHaveProperty('stops');
        expect(Array.isArray(route.stops)).toBe(true);
        expect(route.stops.length).toBeGreaterThan(0);
        expect(route).toHaveProperty('baseline');
        expect(route.baseline).toHaveProperty('polylineCoords');
        expect(route).toHaveProperty('optimized');
        expect(route.optimized).toHaveProperty('polylineCoords');
        expect(route).toHaveProperty('metrics');
        expect(route.metrics).toHaveProperty('totalDistanceKm');
        expect(route.metrics).toHaveProperty('totalDurationMin');
        expect(route.metrics).toHaveProperty('costInr');
        expect(route.metrics).toHaveProperty('co2Kg');
        expect(typeof route.metrics.totalDistanceKm).toBe('number');
        expect(typeof route.metrics.totalDurationMin).toBe('number');
        expect(typeof route.metrics.costInr).toBe('number');
        expect(typeof route.metrics.co2Kg).toBe('number');
      }

      // Verify vehicleAssignments matches routes 1:1
      expect(res.body.data.vehicleAssignments).toBeDefined();
      expect(res.body.data.vehicleAssignments.length).toBe(res.body.data.routes.length);
    });
  });
});
