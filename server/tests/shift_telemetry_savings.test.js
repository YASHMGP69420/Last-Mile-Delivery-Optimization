const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const Delivery = require('../src/models/Delivery');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

describe('Driver Shift Odometer & Fuel/Charge Telemetry + Savings Attribution', () => {
  test('TC-SHIFT-TEL-1: Diesel vehicle captures start/end odometer & fuel in L, calculates usage, and rejects lower closing odometer', async () => {
    const { user: driverUser, token: driverToken } = await createTestUser('DRIVER');
    const vehicle = await createTestVehicle({
      vehicleId: 'OD02-DSL-501',
      fuelType: 'Diesel',
      kmPerLitre: 15,
    });
    const driver = await createTestDriver(driverUser, { assignedVehicleId: vehicle._id });

    // Missing required telemetry when requireTelemetry=true -> 400
    const missingRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ requireTelemetry: true });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error.code).toBe('INVALID_SHIFT_TELEMETRY');

    // Valid start shift with odometer & litres
    const startRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 12500, remainingFuelOrCharge: 38.5, requireTelemetry: true });

    expect(startRes.status).toBe(201);
    expect(startRes.body.data.shift.startOdometerKm).toBe(12500);
    expect(startRes.body.data.shift.startFuelOrCharge).toBe(38.5);
    expect(startRes.body.data.shift.fuelUnit).toBe('L');

    // Closing odometer lower than starting odometer -> 400
    const badEndRes = await request(app)
      .post('/api/v1/driver-hud/shifts/end')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 12490, remainingFuelOrCharge: 32, requireTelemetry: true });
    expect(badEndRes.status).toBe(400);
    expect(badEndRes.body.error.code).toBe('INVALID_ODOMETER_READING');

    // Valid end shift -> calculates exact distance & litres used
    const endRes = await request(app)
      .post('/api/v1/driver-hud/shifts/end')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 12564.5, remainingFuelOrCharge: 34.0, requireTelemetry: true });

    expect(endRes.status).toBe(200);
    expect(endRes.body.data.shift.actualDistanceKm).toBe(64.5);
    expect(endRes.body.data.shift.actualFuelOrChargeUsed).toBe(4.5);
    expect(endRes.body.data.shift.telemetryCapturedAtEnd).toBe(true);

    const savedShift = await DriverShift.findOne({ driverId: driver._id });
    expect(savedShift.actualDistanceKm).toBe(64.5);
    expect(savedShift.actualFuelOrChargeUsed).toBe(4.5);
  });

  test('TC-SHIFT-TEL-2: Electric vehicle validates % range (0-100%), updates Vehicle.batterySoC, and surfaces savings across Admin & Driver APIs', async () => {
    const { token: adminToken } = await createTestUser('ADMIN');
    const { user: driverUser, token: driverToken } = await createTestUser('DRIVER');

    const ev = await createTestVehicle({
      vehicleId: 'OD02-EV-502',
      fuelType: 'Electric',
      energyKWhPerKm: 0.25,
      batterySoC: 90,
    });
    const driver = await createTestDriver(driverUser, { assignedVehicleId: ev._id });

    // >100% charge rejected
    const badStart = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 3200, remainingFuelOrCharge: 120, requireTelemetry: true });
    expect(badStart.status).toBe(400);
    expect(badStart.body.error.code).toBe('INVALID_FUEL_LEVEL');

    // Valid EV shift start & end
    const startRes = await request(app)
      .post('/api/v1/driver-hud/shifts/start')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 3200, remainingFuelOrCharge: 88, requireTelemetry: true });
    expect(startRes.status).toBe(201);
    expect(startRes.body.data.shift.fuelUnit).toBe('%');

    const endRes = await request(app)
      .post('/api/v1/driver-hud/shifts/end')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ odometerKm: 3240, remainingFuelOrCharge: 64, requireTelemetry: true });
    expect(endRes.status).toBe(200);
    expect(endRes.body.data.shift.actualDistanceKm).toBe(40);
    expect(endRes.body.data.shift.actualFuelOrChargeUsed).toBe(24);

    // Vehicle batterySoC updated to closing reading
    const refreshedEv = await Vehicle.findById(ev._id);
    expect(refreshedEv.batterySoC).toBe(64);

    // Completed deliveries + completed optimized route attribution
    await Delivery.create({
      orderReference: `DEL-SAV-${Date.now()}`,
      customer: { name: 'Saved Customer', phone: '+919800011111' },
      address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
      weightKg: 8,
      timeWindow: { start: '09:00', end: '18:00' },
      status: 'COMPLETED',
      assignedDriverId: driver._id,
      assignedVehicleId: ev._id,
    });

    await Route.create({
      routeCode: `RT-SAV-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: ev._id,
      driverId: driver._id,
      status: 'COMPLETED',
      deltas: {
        distanceSavedKm: 12.0,
        costSavedInr: 24.0,
      },
      metrics: {
        totalDistanceKm: 20,
        fuelConsumed: 5,
        fuelUnit: 'kWh',
      },
    });

    // Check Driver Profile HUD
    const profileRes = await request(app)
      .get('/api/v1/driver-hud/profile')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.performance).toMatchObject({
      totalCompletedDeliveries: 1,
      kmSaved: 12,
      energySavedKwh: 3, // 12 km * 0.25 kWh/km
      costSavedInr: 24,
      actualDistanceKm: 40,
      actualChargeUsedPct: 24,
    });
    expect(profileRes.body.data.performance.recentShifts).toHaveLength(1);

    // Check Admin Overview
    const overviewRes = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.metrics.totalDistanceSavedKm).toBe(12);
    expect(overviewRes.body.data.metrics.fuelSavedInr).toBe(24);
    expect(overviewRes.body.data.operational.energySavedKwh).toBe(3);
    expect(overviewRes.body.data.operational.actualDistanceDrivenKm).toBe(40);

    // Check Admin Drivers Accounts endpoint
    const driversRes = await request(app)
      .get('/api/v1/drivers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(driversRes.status).toBe(200);
    const driverEntry = driversRes.body.data.drivers.find(
      (d) => d.id === driver._id.toString()
    );
    expect(driverEntry.stats).toMatchObject({
      deliveriesCompleted: 1,
      kmSaved: 12,
      energySavedKwh: 3,
      actualDistanceKm: 40,
      actualChargeUsedPct: 24,
    });
  });
});
