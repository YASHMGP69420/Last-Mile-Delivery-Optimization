const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('PRD Analytics & Synchronized Fleet Savings (server/tests/analytics_prd.test.js)', () => {
  test('TC-ANALYTICS-PRD-1: RBAC allows ADMIN and FLEET_MANAGER on /admin/analytics, rejects DRIVER, and keeps /admin/overview ADMIN-only', async () => {
    const { token: adminToken } = await createTestUser('ADMIN');
    const { token: managerToken } = await createTestUser('FLEET_MANAGER');
    const { token: driverToken } = await createTestUser('DRIVER');

    const adminAnalyticsRes = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAnalyticsRes.status).toBe(200);
    expect(adminAnalyticsRes.body.success).toBe(true);

    const managerAnalyticsRes = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(managerAnalyticsRes.status).toBe(200);
    expect(managerAnalyticsRes.body.success).toBe(true);

    const driverAnalyticsRes = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(driverAnalyticsRes.status).toBe(403);
    expect(driverAnalyticsRes.body.success).toBe(false);
    expect(driverAnalyticsRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    const managerOverviewRes = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(managerOverviewRes.status).toBe(403);
    expect(managerOverviewRes.body.success).toBe(false);
    expect(managerOverviewRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  test('TC-ANALYTICS-PRD-2: Empty DB returns clean 0/null fallbacks and DRAFT routes are excluded from all totals', async () => {
    const { token: managerToken } = await createTestUser('FLEET_MANAGER');

    const emptyRes = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.success).toBe(true);
    expect(emptyRes.body.data).toMatchObject({
      averageDeliveryTimeMin: null,
      fuelCostPerDeliveryInr: 0,
      routeEfficiencyScorePct: 0,
      vehicleUtilizationRatePct: 0,
      onTimeDeliveryRatePct: 0,
      hasResolvedDeliveries: false,
      totalDistanceSavedKm: 0,
      plannedVsActual: {
        actualDistanceKm: 0,
        plannedOptimizedDistanceKm: 0,
      },
    });

    const draftVehicle = await createTestVehicle({
      vehicleId: 'OD02-DRAFT-99',
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
      availability: 'AVAILABLE',
    });

    await Route.create({
      routeCode: `RT-DRAFT-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: draftVehicle._id,
      status: 'DRAFT',
      baseline: {
        totalDistanceKm: 149,
        totalDurationMin: 200,
        costInr: 1500,
        co2Kg: 30,
      },
      metrics: {
        totalStops: 3,
        totalDistanceKm: 50,
        totalDurationMin: 90,
        totalWeightKg: 25,
        costInr: 9999,
        co2Kg: 10,
        fuelConsumed: 4,
        fuelUnit: 'L',
      },
      deltas: {
        distanceSavedKm: 99,
        costSavedInr: 500,
        co2AvoidedKg: 20,
        percentDistanceReduction: 66.4,
      },
    });

    const afterDraftRes = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(afterDraftRes.status).toBe(200);
    expect(afterDraftRes.body.data.totalDistanceSavedKm).toBe(0);
    expect(afterDraftRes.body.data.fuelCostPerDeliveryInr).toBe(0);
    expect(afterDraftRes.body.data.plannedVsActual.plannedOptimizedDistanceKm).toBe(0);
    expect(afterDraftRes.body.data.routeEfficiencyScorePct).toBe(0);
    expect(afterDraftRes.body.data.counts.nonDraftRoutesCount).toBe(0);
  });

  test('TC-ANALYTICS-PRD-3: Computes real PRD KPIs, fleet savings, and Planned vs Actual Route vs DriverShift telemetry', async () => {
    const { token: adminToken } = await createTestUser('ADMIN');
    const { user: driverUser } = await createTestUser('DRIVER');

    const dieselVehicle = await createTestVehicle({
      vehicleId: 'OD02-PRD-DSL-1',
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
      availability: 'IN_TRANSIT',
    });

    await createTestVehicle({
      vehicleId: 'OD02-PRD-EV-2',
      fuelType: 'Electric',
      energyKWhPerKm: 0.2,
      availability: 'AVAILABLE',
    });

    const driver = await createTestDriver(driverUser, {
      assignedVehicleId: dieselVehicle._id,
    });

    const batch = await DeliveryBatch.create({
      code: `BATCH-PRD-${Date.now()}`,
      name: 'PRD Analytics Test Batch',
      date: new Date().toISOString().slice(0, 10),
      status: 'IN_PROGRESS',
    });

    const completedDelivery = await createTestDelivery({
      orderReference: `DEL-PRD-COMP-${Date.now()}`,
      status: 'COMPLETED',
      batchId: batch._id,
      assignedDriverId: driver._id,
      assignedVehicleId: dieselVehicle._id,
      weightKg: 10,
    });

    await createTestDelivery({
      orderReference: `DEL-PRD-ASSGN-${Date.now()}`,
      status: 'ASSIGNED',
      batchId: batch._id,
      assignedDriverId: driver._id,
      assignedVehicleId: dieselVehicle._id,
      weightKg: 5,
    });

    const dispatchedAt = new Date(Date.now() - 30 * 60 * 1000);

    await Route.create({
      routeCode: `RT-PRD-${Date.now()}`,
      batchId: batch._id,
      vehicleId: dieselVehicle._id,
      driverId: driver._id,
      status: 'DISPATCHED',
      dispatchedAt,
      stops: [
        {
          sequence: 1,
          deliveryId: completedDelivery._id,
          orderReference: completedDelivery.orderReference,
          customer: {
            name: completedDelivery.customer.name,
            phone: completedDelivery.customer.phone,
          },
          address: {
            street: completedDelivery.address.street,
            zone: completedDelivery.address.zone,
            city: completedDelivery.address.city,
            postalCode: completedDelivery.address.postalCode,
          },
          location: {
            lat: completedDelivery.location.coordinates[1],
            lng: completedDelivery.location.coordinates[0],
          },
          weightKg: completedDelivery.weightKg,
          priority: completedDelivery.priority,
          timeWindow: completedDelivery.timeWindow,
          status: 'COMPLETED',
        },
      ],
      baseline: {
        totalDistanceKm: 40,
        totalDurationMin: 80,
        costInr: 300,
        co2Kg: 8.4,
      },
      metrics: {
        totalStops: 1,
        totalDistanceKm: 30,
        totalDurationMin: 60,
        totalWeightKg: 10,
        costInr: 200,
        co2Kg: 6.3,
        fuelConsumed: 2.4,
        fuelUnit: 'L',
      },
      deltas: {
        distanceSavedKm: 10,
        timeSavedMin: 20,
        costSavedInr: 100,
        co2AvoidedKg: 2.1,
        percentDistanceReduction: 25,
      },
    });

    await DriverShift.create({
      driverId: driver._id,
      vehicleId: dieselVehicle._id,
      date: new Date(),
      startTime: '08:00',
      endTime: '17:00',
      status: 'COMPLETED',
      fuelUnit: 'L',
      startOdometerKm: 1000,
      endOdometerKm: 1032,
      startFuelOrCharge: 20,
      endFuelOrCharge: 17.5,
      actualDistanceKm: 32,
      actualFuelOrChargeUsed: 2.5,
      telemetryCapturedAtStart: true,
      telemetryCapturedAtEnd: true,
    });

    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.averageDeliveryTimeMin).toBeGreaterThan(0);
    expect(data.fuelCostPerDeliveryInr).toBe(200);
    expect(data.routeEfficiencyScorePct).toBe(25);
    expect(data.vehicleUtilizationRatePct).toBe(50);
    expect(data.totalCo2AvoidedKg).toBe(2.1);
    expect(data.totalDistanceSavedKm).toBe(10);

    expect(data.plannedVsActual).toMatchObject({
      plannedBaselineDistanceKm: 40,
      plannedOptimizedDistanceKm: 30,
      actualDistanceKm: 32,
      actualFuelLitres: 2.5,
      distanceVarianceKm: 2,
      completedShiftsCount: 1,
      executedRoutesCount: 1,
    });
    expect(data.fleetSavings.fuelSavedLitres).toBeGreaterThan(0);
    expect(data.fleetSavings.totalDistanceSavedKm).toBe(10);
  });
});
