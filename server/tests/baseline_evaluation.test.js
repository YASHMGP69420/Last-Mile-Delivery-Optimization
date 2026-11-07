const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Route = require('../src/models/Route');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Delivery = require('../src/models/Delivery');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');
const {
  CANONICAL_DEPOT,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
} = require('../src/config/constants');

describe('Current Route Metrics & Baseline Evaluation Test Suite (server/tests/baseline_evaluation.test.js)', () => {
  let managerToken;
  let driverUser;
  let driverToken;
  let testDriver;
  let testDieselVehicle;
  let testEvVehicle;
  let testBatch;
  let testDeliveries;

  beforeEach(async () => {
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const dData = await createTestUser('DRIVER');
    driverUser = dData.user;
    driverToken = dData.token;

    testDieselVehicle = await createTestVehicle({
      vehicleId: `VAN-DSL-${Date.now()}`,
      capacityKg: 1000,
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    testEvVehicle = await createTestVehicle({
      vehicleId: `VAN-EV-${Date.now()}`,
      capacityKg: 800,
      fuelType: 'Electric',
      energyKWhPerKm: 0.18,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    testDriver = await createTestDriver(driverUser, {
      assignedVehicleId: testDieselVehicle._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
    });

    const batchId = new mongoose.Types.ObjectId();

    testDeliveries = await Delivery.create([
      {
        orderReference: `#BL-DEL-1-${Date.now()}`,
        batchId,
        customer: { name: 'Amiya Pattnaik', phone: '+91 98610 11111' },
        address: { street: 'Bhawani Mall', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.852, 20.288], geocoded: true },
        weightKg: 25.0,
        priority: 'Urgent',
        timeWindow: { start: '09:00', end: '11:00' },
        serviceDurationMinutes: 10,
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#BL-DEL-2-${Date.now()}`,
        batchId,
        customer: { name: 'Priyanka Das', phone: '+91 98610 22222' },
        address: { street: 'Mayfair Lagoon Area', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.823, 20.301], geocoded: true },
        weightKg: 40.0,
        priority: 'Standard',
        timeWindow: { start: '10:00', end: '13:00' },
        serviceDurationMinutes: 15,
        status: DELIVERY_STATUS.READY,
      },
      {
        orderReference: `#BL-DEL-3-${Date.now()}`,
        batchId,
        customer: { name: 'Rajesh Sahoo', phone: '+91 98610 33333' },
        address: { street: 'KIIT Square', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354], geocoded: true },
        weightKg: 35.0,
        priority: 'Cold Chain',
        timeWindow: { start: '11:00', end: '14:00' },
        serviceDurationMinutes: 10,
        status: DELIVERY_STATUS.READY,
      },
    ]);

    testBatch = await DeliveryBatch.create({
      _id: batchId,
      code: `BATCH-BL-${Date.now()}`,
      name: 'Baseline Pre-Optimization Batch',
      date: '2026-11-05',
      shift: 'Morning',
      vehicleIds: [testDieselVehicle._id],
      driverIds: [testDriver._id],
      status: 'READY',
      depot: CANONICAL_DEPOT,
      deliveryCount: testDeliveries.length,
      metrics: {
        totalDeliveries: testDeliveries.length,
        totalWeightKg: 100.0,
        assignedDeliveries: 0,
      },
    });
  });

  // TEST 1: POST /api/v1/routes/evaluate-baseline calculates road distance, travel duration, service time, and ETAs
  test('Test 1: Automatically calculates baseline route metrics before optimization', async () => {
    const res = await request(app)
      .post('/api/v1/routes/evaluate-baseline')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleId: testDieselVehicle._id.toString(),
        departureTime: '09:00',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    const metrics = data.metrics;

    // Road distance and durations
    expect(metrics.totalDistanceKm).toBeGreaterThan(0);
    expect(metrics.drivingTimeMin).toBeGreaterThan(0);
    expect(metrics.serviceDurationMin).toBe(35); // 10 + 15 + 10 mins
    expect(metrics.totalDurationMin).toBe(
      parseFloat((metrics.drivingTimeMin + metrics.serviceDurationMin).toFixed(1))
    );

    // Departure and arrival ETAs
    expect(metrics.departureTime).toBe('9:00 AM');
    expect(metrics.estimatedArrival).toBeDefined();

    // Stops count and payload
    expect(metrics.stopsCount).toBe(3);
    expect(metrics.totalPayloadKg).toBe(100.0);

    // Starting and ending depot locations
    expect(metrics.startingLocation.name).toBe(CANONICAL_DEPOT.name);
    expect(metrics.endingLocation.name).toBe(CANONICAL_DEPOT.name);

    // Diesel fuel metrics
    expect(metrics.fuelConsumed).toBeGreaterThan(0);
    expect(metrics.fuelUnit).toBe('L');
    expect(metrics.costInr).toBeGreaterThan(0);
    expect(metrics.co2Kg).toBeGreaterThan(0);
    expect(metrics.isElectric).toBe(false);

    // Individual stop ETAs
    expect(data.stops.length).toBe(3);
    expect(data.stops[0].eta).toBeDefined();
    expect(data.stops[1].eta).toBeDefined();
    expect(data.stops[2].eta).toBeDefined();
  });

  // TEST 2: Electric Vehicle energy consumption in kWh and electricity cost
  test('Test 2: Evaluates EV battery energy consumption in kWh and electricity cost', async () => {
    const res = await request(app)
      .post('/api/v1/routes/evaluate-baseline')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleId: testEvVehicle._id.toString(),
        departureTime: '08:30',
      });

    expect(res.status).toBe(200);
    const metrics = res.body.data.metrics;

    expect(metrics.isElectric).toBe(true);
    expect(metrics.fuelUnit).toBe('kWh');
    expect(metrics.fuelConsumed).toBeGreaterThan(0); // kWh
    expect(metrics.costInr).toBeGreaterThan(0); // ₹ electricity cost
    expect(metrics.co2Kg).toBe(0.0); // 0g direct tailpipe CO2
  });

  // TEST 3: Strict preservation of custom sequence order
  test('Test 3: Recalculates metrics for explicit delivery order', async () => {
    // Deliveries passed in reverse order: Stop 3, Stop 2, Stop 1
    const reversedIds = [
      testDeliveries[2]._id.toString(),
      testDeliveries[1]._id.toString(),
      testDeliveries[0]._id.toString(),
    ];

    const res = await request(app)
      .post('/api/v1/routes/evaluate-baseline')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        deliveryIds: reversedIds,
        vehicleId: testDieselVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.stops[0].deliveryId).toBe(reversedIds[0]);
    expect(data.stops[1].deliveryId).toBe(reversedIds[1]);
    expect(data.stops[2].deliveryId).toBe(reversedIds[2]);
    expect(data.stops[0].sequenceOrder).toBe(1);
    expect(data.stops[1].sequenceOrder).toBe(2);
    expect(data.stops[2].sequenceOrder).toBe(3);
  });

  // TEST 4: Generates road polyline and Google Maps navigation link
  test('Test 4: Generates road polyline coordinates and Google Maps directions URL', async () => {
    const res = await request(app)
      .post('/api/v1/routes/evaluate-baseline')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        batchId: testBatch._id.toString(),
        vehicleId: testDieselVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    const data = res.body.data;

    // Polyline coordinates array with start and end at depot
    expect(Array.isArray(data.polylineCoords)).toBe(true);
    expect(data.polylineCoords.length).toBeGreaterThanOrEqual(4); // Depot + 3 stops + Depot
    expect(data.polylineCoords[0][0]).toBeCloseTo(CANONICAL_DEPOT.geo.lng, 2);
    expect(data.polylineCoords[0][1]).toBeCloseTo(CANONICAL_DEPOT.geo.lat, 2);

    // Google Maps URL
    expect(data.googleMapsUrls.currentRoute).toBeDefined();
    expect(data.googleMapsUrls.currentRoute).toContain('https://www.google.com/maps/dir/');
  });

  // TEST 5: Gracefully handles empty delivery list
  test('Test 5: Returns safe zero metrics when no deliveries exist', async () => {
    const res = await request(app)
      .post('/api/v1/routes/evaluate-baseline')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        deliveryIds: [],
        vehicleId: testDieselVehicle._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.metrics.totalDistanceKm).toBe(0);
    expect(res.body.data.metrics.totalDurationMin).toBe(0);
    expect(res.body.data.metrics.costInr).toBe(0);
    expect(res.body.data.metrics.stopsCount).toBe(0);
  });
});
