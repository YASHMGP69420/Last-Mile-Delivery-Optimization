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
const {
  CANONICAL_DEPOT,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  AUDIT_EVENT_TYPES,
} = require('../src/config/constants');

describe('Master Dispatch Workflow & Unoptimized Routing Test Suite (server/tests/dispatch_workflow.test.js)', () => {
  let adminToken;
  let managerToken;
  let driverUser;
  let driverToken;
  let testDriver;
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

    testVehicle = await createTestVehicle({
      capacityKg: 1000,
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    testDriver = await createTestDriver(driverUser, {
      assignedVehicleId: testVehicle._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
    });

    const batchId = new mongoose.Types.ObjectId();

    // 2. Create sample deliveries in Bhubaneswar
    testDeliveries = await Delivery.create([
      {
        orderReference: `#DW-DEL-1-${Date.now()}`,
        batchId,
        customer: { name: 'Amiya Pattnaik', phone: '+91 98610 11111' },
        address: { street: 'Bhawani Mall', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.852, 20.288], geocoded: true },
        weightKg: 25.0,
        priority: 'Urgent',
        timeWindow: { start: '09:00', end: '11:00' },
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#DW-DEL-2-${Date.now()}`,
        batchId,
        customer: { name: 'Priyanka Das', phone: '+91 98610 22222' },
        address: { street: 'Mayfair Lagoon Area', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.823, 20.301], geocoded: true },
        weightKg: 40.0,
        priority: 'Standard',
        timeWindow: { start: '10:00', end: '13:00' },
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#DW-DEL-3-${Date.now()}`,
        batchId,
        customer: { name: 'Rajesh Sahoo', phone: '+91 98610 33333' },
        address: { street: 'KIIT Square', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354], geocoded: true },
        weightKg: 35.0,
        priority: 'Cold Chain',
        timeWindow: { start: '11:00', end: '14:00' },
        status: DELIVERY_STATUS.READY,
      },
    ]);

    testBatch = await DeliveryBatch.create({
      _id: batchId,
      code: `BATCH-DW-${Date.now()}`,
      name: 'Dispatch Workflow Test Batch',
      date: '2026-11-05',
      shift: 'Morning',
      vehicleIds: [testVehicle._id],
      driverIds: [testDriver._id],
      status: 'READY',
      depot: {
        name: CANONICAL_DEPOT.name,
        address: CANONICAL_DEPOT.address,
        geo: { lat: CANONICAL_DEPOT.geo.lat, lng: CANONICAL_DEPOT.geo.lng },
      },
      deliveryCount: testDeliveries.length,
      metrics: {
        totalDeliveries: testDeliveries.length,
        totalWeightKg: 100.0,
        assignedDeliveries: 0,
      },
    });
  });

  // TEST 1: Valid route with optimization improvements can be dispatched
  test('Test 1: Valid route with optimization improvements can be dispatched', async () => {
    // 1. Optimize batch
    const optRes = await request(app)
      .post('/api/v1/routes/optimize')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleIds: [testVehicle._id.toString()],
        options: {
          trafficScenario: 'FREE_FLOW',
          maxIterations: 500,
        },
      });

    expect(optRes.status).toBe(200);
    const routeId = optRes.body.data.routeId;
    expect(routeId).toBeDefined();

    // 2. Dispatch the optimized route
    const dispatchRes = await request(app)
      .post(`/api/v1/routes/${routeId}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe('DISPATCHED');

    // Verify DB states
    const updatedRoute = await Route.findById(routeId);
    expect(updatedRoute.status).toBe('DISPATCHED');
    expect(updatedRoute.driverId.toString()).toBe(testDriver._id.toString());
    expect(updatedRoute.vehicleId.toString()).toBe(testVehicle._id.toString());

    const updatedVehicle = await Vehicle.findById(testVehicle._id);
    expect(updatedVehicle.availability).toBe(VEHICLE_STATUS.IN_TRANSIT);

    const updatedDriver = await Driver.findById(testDriver._id);
    expect(updatedDriver.availability).toBe(DRIVER_AVAILABILITY.IN_TRANSIT);
    expect(updatedDriver.currentRouteId.toString()).toBe(routeId.toString());

    // Deliveries marked ASSIGNED
    const updatedDeliveries = await Delivery.find({ batchId: testBatch._id });
    expect(updatedDeliveries.every((d) => d.status === DELIVERY_STATUS.ASSIGNED)).toBe(true);
  });

  // TEST 2: Valid route with zero optimization improvements can be dispatched
  test('Test 2: Valid route with zero optimization improvements can be dispatched', async () => {
    // Create an already-optimal Route document with deltas.isImproved = false
    const route = await Route.create({
      routeCode: `RT-ZERO-OPT-${Date.now()}`,
      batchId: testBatch._id,
      vehicleId: testVehicle._id,
      driverId: testDriver._id,
      status: 'DRAFT',
      stops: testDeliveries.map((d, idx) => ({
        sequence: idx + 1,
        deliveryId: d._id,
        orderReference: d.orderReference,
        customer: d.customer,
        address: {
          street: d.address.street,
          zone: d.address.zone,
          postalCode: d.address.postalCode,
        },
        location: { lat: d.location.coordinates[1], lng: d.location.coordinates[0] },
        weightKg: d.weightKg,
        priority: d.priority,
        timeWindow: d.timeWindow,
      })),
      metrics: {
        totalStops: testDeliveries.length,
        totalDistanceKm: 18.5,
        totalDurationMin: 45,
        totalWeightKg: 100.0,
      },
      baseline: { totalDistanceKm: 18.5, totalDurationMin: 45 },
      deltas: {
        distanceSavedKm: 0.0,
        percentDistanceReduction: 0.0,
        timeSavedMin: 0.0,
        isImproved: false,
        message: 'No measurable improvement found. The current route is already optimal.',
      },
    });

    // Dispatching zero-improvement route MUST succeed
    const res = await request(app)
      .post(`/api/v1/routes/${route._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('DISPATCHED');

    const dispatchedRoute = await Route.findById(route._id);
    expect(dispatchedRoute.status).toBe('DISPATCHED');
  });

  // TEST 3: Already-efficient route dispatches cleanly with original sequence preserved
  test('Test 3: Already-efficient route dispatches cleanly with original sequence preserved', async () => {
    const originalDeliveryIds = testDeliveries.map((d) => d._id.toString());

    // Dispatch using original batch sequence
    const res = await request(app)
      .post('/api/v1/routes/dispatch')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleId: testVehicle._id.toString(),
        driverId: testDriver._id.toString(),
        confirmedStopSequence: originalDeliveryIds,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dispatchedRoute = res.body.data.route;
    const dispatchedOrder = dispatchedRoute.stops.map((s) => s.deliveryId.toString());
    expect(dispatchedOrder).toEqual(originalDeliveryIds);
  });

  // TEST 4: Dispatch without running optimization creates route and transitions statuses correctly
  test('Test 4: Dispatch without running optimization creates route and transitions statuses correctly', async () => {
    // Dispatch directly referencing batchId without ever calling /routes/optimize
    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const route = res.body.data.route;
    expect(route).toBeDefined();
    expect(route.status).toBe('DISPATCHED');
    expect(route.stops.length).toBe(testDeliveries.length);
    expect(route.optimizationMetadata.algorithm).toBe('ORIGINAL_MANIFEST');

    // Check Audit Event created with dispatch mode info
    const audit = await AuditEvent.findOne({ routeId: route.id || route._id });
    expect(audit).toBeDefined();
    expect(audit.type).toBe(AUDIT_EVENT_TYPES.ROUTE_DISPATCHED);
    expect(audit.action).toContain('dispatched without optimization');
  });

  // TEST 5: Optimization API failure does not block dispatch of original route
  test('Test 5: Optimization API failure does not block dispatch of original route', async () => {
    // 1. Simulate optimization failure by passing invalid options or parameters
    const optFailure = await request(app)
      .post('/api/v1/routes/optimize')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: '000000000000000000000000', // Invalid batch
      });

    expect(optFailure.status).toBe(404);

    // 2. Dispatch original batch cleanly despite optimization failure
    const dispatchRes = await request(app)
      .post('/api/v1/routes/dispatch')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleId: testVehicle._id.toString(),
        driverId: testDriver._id.toString(),
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe('DISPATCHED');
  });

  // TEST 6: Attempting to dispatch completed or cancelled deliveries returns specific ineligibility reasons
  test('Test 6: Attempting to dispatch completed or cancelled deliveries returns specific ineligibility reasons', async () => {
    // Mark one delivery completed and two failed/cancelled
    await Delivery.findByIdAndUpdate(testDeliveries[0]._id, { status: DELIVERY_STATUS.COMPLETED });
    await Delivery.findByIdAndUpdate(testDeliveries[1]._id, { status: DELIVERY_STATUS.FAILED });
    await Delivery.findByIdAndUpdate(testDeliveries[2]._id, { status: DELIVERY_STATUS.FAILED });

    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_ELIGIBLE_DELIVERIES');
    expect(res.body.error.message).toContain('Cannot dispatch due to no eligible deliveries');
    expect(res.body.error.details.ineligibilityReasons.length).toBeGreaterThan(0);
    expect(
      res.body.error.details.ineligibilityReasons.some((r) => r.includes('already delivered'))
    ).toBe(true);
    expect(
      res.body.error.details.ineligibilityReasons.some((r) => r.includes('cancelled'))
    ).toBe(true);
  });

  // TEST 7: Attempting to dispatch with unavailable vehicle returns appropriate error
  test('Test 7: Attempting to dispatch with unavailable vehicle returns appropriate error', async () => {
    await Vehicle.findByIdAndUpdate(testVehicle._id, { availability: VEHICLE_STATUS.MAINTENANCE });

    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VEHICLE_UNAVAILABLE');
    expect(res.body.error.message).toContain('unavailable');
  });

  // TEST 8: Attempting to dispatch with unavailable driver returns appropriate error
  test('Test 8: Attempting to dispatch with unavailable driver returns appropriate error', async () => {
    // Put driver in active transit on another route with another vehicle
    const anotherVehicle = await createTestVehicle({ availability: VEHICLE_STATUS.IN_TRANSIT });
    const anotherRoute = await Route.create({
      routeCode: `RT-ANOTHER-${Date.now()}`,
      batchId: testBatch._id,
      vehicleId: anotherVehicle._id,
      driverId: testDriver._id,
      status: 'DISPATCHED',
    });

    await Driver.findByIdAndUpdate(testDriver._id, {
      availability: DRIVER_AVAILABILITY.IN_TRANSIT,
      currentRouteId: anotherRoute._id,
    });

    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DRIVER_UNAVAILABLE');
    expect(res.body.error.message).toContain('Driver is currently on another active route');
  });

  // TEST 9: Attempting to dispatch exceeding vehicle capacity returns capacity error
  test('Test 9: Attempting to dispatch exceeding vehicle capacity returns capacity error', async () => {
    // Lower vehicle capacity to 50 kg while total payload is 100 kg
    await Vehicle.findByIdAndUpdate(testVehicle._id, { capacityKg: 50 });

    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
    expect(res.body.error.message).toContain('Vehicle exceeds weight capacity by');
  });

  // TEST 10: Duplicate dispatch prevention (cannot dispatch an already dispatched route)
  test('Test 10: Duplicate dispatch prevention (cannot dispatch an already dispatched route)', async () => {
    // 1. First dispatch succeeds
    const firstRes = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(firstRes.status).toBe(200);
    const routeId = firstRes.body.data.route._id || firstRes.body.data.route.id;

    // 2. Second dispatch attempt on the same route returns 409 INVALID_ROUTE_STATUS
    const dupRes = await request(app)
      .post(`/api/v1/routes/${routeId}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('INVALID_ROUTE_STATUS');
    expect(dupRes.body.error.message).toContain('already in status \'DISPATCHED\'');
  });

  // TEST 11: Batch with mix of eligible and ineligible deliveries dispatches only eligible ones or warns operator
  test('Test 11: Batch with mix of eligible and ineligible deliveries dispatches only eligible ones and reports warnings', async () => {
    // Mark only 1 delivery as completed, leaving 2 eligible
    await Delivery.findByIdAndUpdate(testDeliveries[0]._id, { status: DELIVERY_STATUS.COMPLETED });

    const res = await request(app)
      .post(`/api/v1/routes/${testBatch._id}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Dispatched stops should be 2 (the eligible ones)
    expect(res.body.data.dispatchedStopsCount).toBe(2);
    expect(res.body.data.ineligibleDeliveries.length).toBe(1);
    expect(res.body.data.ineligibleDeliveries[0].reason).toContain('already delivered');

    // Verify completed delivery remained completed and unassigned to this route
    const compDeliv = await Delivery.findById(testDeliveries[0]._id);
    expect(compDeliv.status).toBe(DELIVERY_STATUS.COMPLETED);

    // Eligible deliveries transitioned to ASSIGNED
    const deliv2 = await Delivery.findById(testDeliveries[1]._id);
    const deliv3 = await Delivery.findById(testDeliveries[2]._id);
    expect(deliv2.status).toBe(DELIVERY_STATUS.ASSIGNED);
    expect(deliv3.status).toBe(DELIVERY_STATUS.ASSIGNED);
  });

  // TEST 12: End-to-end: create batch -> add deliveries -> select vehicle/driver -> dispatch without optimization -> verify driver HUD shows route
  test('Test 12: End-to-end: create batch -> add deliveries -> select vehicle/driver -> dispatch without optimization -> verify driver HUD shows route', async () => {
    // Step 1: Create a brand new batch via API
    const batchCreateRes = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        code: `E2E-BATCH-${Date.now()}`,
        name: 'End-to-End Handheld Verification Batch',
        date: '2026-11-05',
        shift: 'Afternoon',
        depot: CANONICAL_DEPOT,
      });

    expect(batchCreateRes.status).toBe(201);
    const newBatch = batchCreateRes.body.data.batch || batchCreateRes.body.data;
    const newBatchId = newBatch._id || newBatch.id;

    // Step 2: Create 2 fresh deliveries assigned to this new batch
    const d1 = await Delivery.create({
      orderReference: `#E2E-DEL-1-${Date.now()}`,
      batchId: newBatchId,
      customer: { name: 'Sunil Jena', phone: '+91 94370 12345' },
      address: { street: 'Unit 4 Market', zone: 'Saheed Nagar (Z-3)', postalCode: '751012' },
      location: { type: 'Point', coordinates: [85.819, 20.298], geocoded: true },
      weightKg: 15.0,
      priority: 'Standard',
      timeWindow: { start: '14:00', end: '16:00' },
      status: DELIVERY_STATUS.READY,
    });

    const d2 = await Delivery.create({
      orderReference: `#E2E-DEL-2-${Date.now()}`,
      batchId: newBatchId,
      customer: { name: 'Kavita Mishra', phone: '+91 94370 67890' },
      address: { street: 'KIIT Campus 6', zone: 'Patia (Z-1)', postalCode: '751024' },
      location: { type: 'Point', coordinates: [85.815, 20.305], geocoded: true },
      weightKg: 18.0,
      priority: 'Urgent',
      timeWindow: { start: '15:00', end: '17:00' },
      status: DELIVERY_STATUS.READY,
    });

    // Step 3: Dispatch without optimization directly
    const dispatchRes = await request(app)
      .post(`/api/v1/routes/${newBatchId}/dispatch`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        driverId: testDriver._id.toString(),
        vehicleId: testVehicle._id.toString(),
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);
    const dispatchedRouteId = dispatchRes.body.data.route._id || dispatchRes.body.data.route.id;

    // Step 4: Call Driver HUD endpoint as the authenticated Driver
    const hudRes = await request(app)
      .get('/api/v1/driver-hud/route')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(hudRes.status).toBe(200);
    expect(hudRes.body.success).toBe(true);
    const activeHudRoute = hudRes.body.data.route;
    expect(activeHudRoute).toBeDefined();
    const hudRouteId = activeHudRoute._id || activeHudRoute.id;
    expect(hudRouteId.toString()).toBe(dispatchedRouteId.toString());
    expect(activeHudRoute.status).toBe('DISPATCHED');
    expect(activeHudRoute.stops.length).toBe(2);

    // Verify stops enriched with delivery data
    const stops = activeHudRoute.stops;
    expect(stops[0].delivery.orderReference).toBe(d1.orderReference);
    expect(stops[1].delivery.orderReference).toBe(d2.orderReference);
  });
});
