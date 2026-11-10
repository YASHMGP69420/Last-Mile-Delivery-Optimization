const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const VehicleChecklist = require('../src/models/VehicleChecklist');
const MaintenanceRecord = require('../src/models/MaintenanceRecord');
const Delivery = require('../src/models/Delivery');
const Route = require('../src/models/Route');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 09 Operational Guards & Telemetry Continuity (server/tests/phase09_guards.test.js)', () => {
  test('D-01/D-02: Odometer continuity enforced across startShift, endShift, and submitVehicleCheck', async () => {
    const { user: driverUser, token: driverToken } = await createTestUser('DRIVER');
    const vehicle = await createTestVehicle({
      vehicleId: 'OD02-ODO-901',
      type: 'Van',
      fuelType: 'Diesel',
      kmPerLitre: 14,
      lastOdometerKm: 1200,
      lastFuelLitres: 45,
      tankCapacityLitres: 70,
    });
    await createTestDriver(driverUser, { assignedVehicleId: vehicle._id });

    // Dashboard exposes baseline telemetry fields without prefilling inputs
    const dashRes = await request(app)
      .get('/api/v1/driver-hud/dashboard')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.vehicle.lastOdometerKm).toBe(1200);
    expect(dashRes.body.data.vehicle.lastFuelLitres).toBe(45);
    expect(dashRes.body.data.vehicle.tankCapacityLitres).toBe(70);
    expect(dashRes.body.data.vehicle.fuelRemainingLitres).toBe(45);

    // 1. startShift lower than baseline 1200 -> 400 INVALID_ODOMETER_READING
    const badStartRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 1150, remainingFuelOrCharge: 40, requireTelemetry: true });
    expect(badStartRes.status).toBe(400);
    expect(badStartRes.body.error.code).toBe('INVALID_ODOMETER_READING');

    // 2. startShift >= baseline succeeds and advances Vehicle.lastOdometerKm to 1250
    const goodStartRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 1250, remainingFuelOrCharge: 40, requireTelemetry: true });
    expect(goodStartRes.status).toBe(201);

    let refreshed = await Vehicle.findById(vehicle._id);
    expect(refreshed.lastOdometerKm).toBe(1250);
    expect(refreshed.lastFuelLitres).toBe(40);

    // 3. endShift advances Vehicle.lastOdometerKm to 1310
    const goodEndRes = await request(app)
      .post('/api/v1/driver-hud/shifts/end')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 1310, remainingFuelOrCharge: 34, requireTelemetry: true });
    expect(goodEndRes.status).toBe(200);

    refreshed = await Vehicle.findById(vehicle._id);
    expect(refreshed.lastOdometerKm).toBe(1310);
    expect(refreshed.lastFuelLitres).toBe(34);

    // 4. Next shift startShift with 1300 (< 1310) -> 400 INVALID_ODOMETER_READING
    const nextBadStart = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 1300, remainingFuelOrCharge: 34, requireTelemetry: true });
    expect(nextBadStart.status).toBe(400);
    expect(nextBadStart.body.error.code).toBe('INVALID_ODOMETER_READING');

    // 5. submitVehicleCheck with 1290 (< 1310) -> 400 INVALID_ODOMETER_READING
    const badCheckRes = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerReadingKm: 1290, remainingFuelOrCharge: 34 });
    expect(badCheckRes.status).toBe(400);
    expect(badCheckRes.body.error.code).toBe('INVALID_ODOMETER_READING');

    // 6. submitVehicleCheck with 1320 succeeds and advances Vehicle.lastOdometerKm to 1320
    const goodCheckRes = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerReadingKm: 1320, remainingFuelOrCharge: 33 });
    expect(goodCheckRes.status).toBe(201);
    expect(goodCheckRes.body.data.checklist.fuelUnit).toBe('L');

    refreshed = await Vehicle.findById(vehicle._id);
    expect(refreshed.lastOdometerKm).toBe(1320);
    expect(refreshed.lastFuelLitres).toBe(33);
  });

  test('D-05/D-06/D-07/D-08: Tank capacity caps, Truck 500 L inspection, EV 100% cap, and mid-shift refuel persistence', async () => {
    // Case A: Custom tankCapacityLitres = 80 L on Diesel Van rejects 90 L
    const { user: u1, token: t1 } = await createTestUser('DRIVER');
    const customVan = await createTestVehicle({
      vehicleId: 'OD02-CAP-80',
      type: 'Van',
      fuelType: 'Diesel',
      tankCapacityLitres: 80,
    });
    await createTestDriver(u1, { assignedVehicleId: customVan._id });

    const overCustomCap = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${t1}`)
      .send({ odometerKm: 500, remainingFuelOrCharge: 90, requireTelemetry: true });
    expect(overCustomCap.status).toBe(400);
    expect(overCustomCap.body.error.code).toBe('INVALID_FUEL_LEVEL');

    // Case B: Default Van (no tankCapacityLitres -> 200 L cap) rejects 250 L, allows mid-shift refuel on endShift
    const { user: u2, token: t2 } = await createTestUser('DRIVER');
    const defaultVan = await createTestVehicle({
      vehicleId: 'OD02-CAP-200',
      type: 'Van',
      fuelType: 'Petrol',
    });
    await createTestDriver(u2, { assignedVehicleId: defaultVan._id });

    const overDefaultCap = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${t2}`)
      .send({ odometerKm: 100, remainingFuelOrCharge: 250, requireTelemetry: true });
    expect(overDefaultCap.status).toBe(400);
    expect(overDefaultCap.body.error.code).toBe('INVALID_FUEL_LEVEL');

    const startOk = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${t2}`)
      .send({ odometerKm: 100, remainingFuelOrCharge: 20, requireTelemetry: true });
    expect(startOk.status).toBe(201);

    // Mid-shift refuel: endFuel (55 L) > startFuel (20 L) is allowed per D-05 and updates lastFuelLitres
    const endRefuelOk = await request(app)
      .post('/api/v1/driver-hud/shifts/end')
      .set('Authorization', `Bearer ${t2}`)
      .send({ odometerKm: 160, remainingFuelOrCharge: 55, requireTelemetry: true });
    expect(endRefuelOk.status).toBe(200);
    expect(endRefuelOk.body.data.shift.actualFuelOrChargeUsed).toBe(0);

    const refreshedVan = await Vehicle.findById(defaultVan._id);
    expect(refreshedVan.lastFuelLitres).toBe(55);

    // Case C: Truck defaults to 500 L cap and accepts 150 L on submitVehicleCheck (fuelUnit: 'L')
    const { user: u3, token: t3 } = await createTestUser('DRIVER');
    const truck = await createTestVehicle({
      vehicleId: 'OD02-TRK-500',
      type: 'Truck',
      fuelType: 'Diesel',
    });
    await createTestDriver(u3, { assignedVehicleId: truck._id });

    const truckCheckOk = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${t3}`)
      .send({ odometerReadingKm: 4000, remainingFuelOrCharge: 150 });
    expect(truckCheckOk.status).toBe(201);
    expect(truckCheckOk.body.data.checklist.fuelUnit).toBe('L');
    expect(truckCheckOk.body.data.checklist.fuelOrBatteryLevelPercent).toBe(150);

    const savedTruck = await Vehicle.findById(truck._id);
    expect(savedTruck.lastFuelLitres).toBe(150);

    const truckOverCap = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${t3}`)
      .send({ odometerReadingKm: 4010, remainingFuelOrCharge: 550 });
    expect(truckOverCap.status).toBe(400);
    expect(truckOverCap.body.error.code).toBe('INVALID_FUEL_LEVEL');

    // Case D: EV rejects 105% on vehicle check
    const { user: u4, token: t4 } = await createTestUser('DRIVER');
    const ev = await createTestVehicle({
      vehicleId: 'OD02-EV-100',
      type: 'Van',
      fuelType: 'Electric',
      energyKWhPerKm: 0.2,
    });
    await createTestDriver(u4, { assignedVehicleId: ev._id });

    const evOver = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${t4}`)
      .send({ odometerReadingKm: 500, remainingFuelOrCharge: 105 });
    expect(evOver.status).toBe(400);
    expect(evOver.body.error.code).toBe('INVALID_FUEL_LEVEL');

    const evOk = await request(app)
      .post('/api/v1/driver-hud/vehicle-check')
      .set('Authorization', `Bearer ${t4}`)
      .send({ odometerReadingKm: 500, remainingFuelOrCharge: 84 });
    expect(evOk.status).toBe(201);
    expect(evOk.body.data.checklist.fuelUnit).toBe('%');
    const refreshedEv = await Vehicle.findById(ev._id);
    expect(refreshedEv.batterySoC).toBe(84);
  });

  test('D-11: startShift rejects vehicles in MAINTENANCE or RETIRED availability', async () => {
    const { user: mUser, token: mToken } = await createTestUser('DRIVER');
    const maintVehicle = await createTestVehicle({
      vehicleId: 'OD02-MAINT-1',
      availability: 'MAINTENANCE',
    });
    await createTestDriver(mUser, { assignedVehicleId: maintVehicle._id });

    const maintRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${mToken}`)
      .send({ odometerKm: 100, remainingFuelOrCharge: 20, requireTelemetry: true });
    expect(maintRes.status).toBe(400);
    expect(maintRes.body.error.code).toBe('VEHICLE_UNAVAILABLE_FOR_SHIFT');

    const { user: rUser, token: rToken } = await createTestUser('DRIVER');
    const retiredVehicle = await createTestVehicle({
      vehicleId: 'OD02-RET-1',
      availability: 'RETIRED',
    });
    await createTestDriver(rUser, { assignedVehicleId: retiredVehicle._id });

    const retiredRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${rToken}`)
      .send({ odometerKm: 100, remainingFuelOrCharge: 20, requireTelemetry: true });
    expect(retiredRes.status).toBe(400);
    expect(retiredRes.body.error.code).toBe('VEHICLE_UNAVAILABLE_FOR_SHIFT');
  });

  test('D-13: Delivery execution endpoints enforce BOLA ownership and lock terminal COMPLETED/FAILED states', async () => {
    const { user: ownerUser, token: ownerToken } = await createTestUser('DRIVER');
    const { user: intruderUser, token: intruderToken } = await createTestUser('DRIVER');

    const vehicle = await createTestVehicle({ vehicleId: 'OD02-DEL-LOCK1' });
    const ownerDriver = await createTestDriver(ownerUser, { assignedVehicleId: vehicle._id });
    await createTestDriver(intruderUser);

    const completedTarget = await createTestDelivery({
      orderReference: `DEL-LOCK-COMP-${Date.now()}`,
      status: 'OUT_FOR_DELIVERY',
      assignedDriverId: ownerDriver._id,
      assignedVehicleId: vehicle._id,
    });

    const failedTarget = await createTestDelivery({
      orderReference: `DEL-LOCK-FAIL-${Date.now()}`,
      status: 'ASSIGNED',
      assignedDriverId: ownerDriver._id,
      assignedVehicleId: vehicle._id,
    });

    await Route.create({
      routeCode: `RT-LOCK-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: vehicle._id,
      driverId: ownerDriver._id,
      status: 'IN_PROGRESS',
      stops: [
        {
          sequence: 1,
          deliveryId: completedTarget._id,
          orderReference: completedTarget.orderReference,
          customer: completedTarget.customer,
          address: completedTarget.address,
          location: { lat: 20.2961, lng: 85.8645 },
          weightKg: 5,
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '18:00' },
          status: 'ARRIVED',
        },
        {
          sequence: 2,
          deliveryId: failedTarget._id,
          orderReference: failedTarget.orderReference,
          customer: failedTarget.customer,
          address: failedTarget.address,
          location: { lat: 20.2961, lng: 85.8645 },
          weightKg: 5,
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '18:00' },
          status: 'PENDING',
        },
      ],
    });

    // Intruder BOLA checks across all three mutation endpoints
    const bolaArrived = await request(app)
      .post(`/api/v1/driver-hud/deliveries/${completedTarget._id}/arrived`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(bolaArrived.status).toBe(403);
    expect(bolaArrived.body.error.code).toBe('BOLA_VIOLATION');

    const bolaComplete = await request(app)
      .post(`/api/v1/driver-hud/deliveries/${completedTarget._id}/complete`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ recipientName: 'Intruder' });
    expect(bolaComplete.status).toBe(403);
    expect(bolaComplete.body.error.code).toBe('BOLA_VIOLATION');

    const bolaFail = await request(app)
      .post(`/api/v1/driver-hud/deliveries/${failedTarget._id}/fail`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ failureReason: 'CUSTOMER_UNAVAILABLE' });
    expect(bolaFail.status).toBe(403);
    expect(bolaFail.body.error.code).toBe('BOLA_VIOLATION');

    // Owner completes first stop -> becomes terminal COMPLETED
    const compRes = await request(app)
      .post(`/api/v1/driver-hud/deliveries/${completedTarget._id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ recipientName: 'Verified Receiver' });
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.delivery.status).toBe('COMPLETED');

    // Terminal COMPLETED blocks arrived, complete, fail
    for (const [endpoint, body] of [
      ['arrived', {}],
      ['complete', { recipientName: 'Replay' }],
      ['fail', { failureReason: 'CUSTOMER_UNAVAILABLE' }],
    ]) {
      const replayRes = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${completedTarget._id}/${endpoint}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);
      expect(replayRes.status).toBe(400);
      expect(replayRes.body.error.code).toBe('DELIVERY_TERMINAL');
    }

    // Owner fails second stop -> becomes terminal FAILED
    const failRes = await request(app)
      .post(`/api/v1/driver-hud/deliveries/${failedTarget._id}/fail`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ failureReason: 'WRONG_ADDRESS' });
    expect(failRes.status).toBe(200);
    expect(failRes.body.data.delivery.status).toBe('FAILED');

    // Terminal FAILED blocks arrived, complete, fail
    for (const [endpoint, body] of [
      ['arrived', {}],
      ['complete', { recipientName: 'Override' }],
      ['fail', { failureReason: 'OTHER' }],
    ]) {
      const replayRes = await request(app)
        .post(`/api/v1/driver-hud/deliveries/${failedTarget._id}/${endpoint}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);
      expect(replayRes.status).toBe(400);
      expect(replayRes.body.error.code).toBe('DELIVERY_TERMINAL');
    }
  });

  test('D-12: MaintenanceRecord schema enforces non-negative cost and nextServiceDate >= serviceDate', async () => {
    const vehicle = await createTestVehicle({ vehicleId: 'OD02-MNT-MOD' });

    const invalidDateRecord = new MaintenanceRecord({
      vehicleId: vehicle._id,
      serviceDate: new Date('2026-11-10T00:00:00Z'),
      type: 'Oil Change',
      cost: 1200,
      nextServiceDate: new Date('2026-11-01T00:00:00Z'),
    });
    await expect(invalidDateRecord.validate()).rejects.toThrow(/Next service date/i);

    const negativeCostRecord = new MaintenanceRecord({
      vehicleId: vehicle._id,
      serviceDate: new Date('2026-11-10T00:00:00Z'),
      type: 'Oil Change',
      cost: -50,
    });
    await expect(negativeCostRecord.validate()).rejects.toThrow(/cost|negative|min/i);

    const validRecord = new MaintenanceRecord({
      vehicleId: vehicle._id,
      serviceDate: new Date('2026-11-10T00:00:00Z'),
      type: 'Oil Change',
      cost: 1200,
      nextServiceDate: new Date('2027-02-10T00:00:00Z'),
    });
    await expect(validRecord.validate()).resolves.toBeUndefined();
  });
});
