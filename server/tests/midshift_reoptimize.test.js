const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Route = require('../src/models/Route');
const TelemetryPing = require('../src/models/TelemetryPing');
const SystemNotification = require('../src/models/SystemNotification');
const socketService = require('../src/services/socketService');
const { reoptimizeActiveRoute } = require('../src/services/optimization/activeRouteReoptimizer');
const { calculateDuration } = require('../src/services/mapping/simulatedTrafficService');
const {
  CANONICAL_DEPOT,
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  DRIVER_AVAILABILITY,
} = require('../src/config/constants');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

function buildRouteStop(delivery, sequence, status = 'PENDING') {
  const [lng, lat] = delivery.location.coordinates;
  return {
    sequence,
    deliveryId: delivery._id,
    orderReference: delivery.orderReference,
    customer: {
      name: delivery.customer.name,
      phone: delivery.customer.phone,
    },
    address: {
      street: delivery.address.street,
      zone: delivery.address.zone,
      city: delivery.address.city || 'Bhubaneswar',
      postalCode: delivery.address.postalCode,
    },
    location: { lat, lng },
    weightKg: delivery.weightKg,
    priority: delivery.priority,
    timeWindow: delivery.timeWindow,
    eta: '09:00',
    distanceFromPrevKm: 2.5,
    durationFromPrevMin: 8.0,
    status,
  };
}

describe('Mid-Shift Route Re-Optimization & Incident Auto-Trigger (server/tests/midshift_reoptimize.test.js)', () => {
  let adminToken;
  let managerToken;
  let driverUser;
  let driverToken;
  let driverDoc;
  let otherDriverUser;
  let otherDriverDoc;
  let testVehicle;
  let otherVehicle;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const primaryD = await createTestUser('DRIVER');
    driverUser = primaryD.user;
    driverToken = primaryD.token;

    const secondaryD = await createTestUser('DRIVER');
    otherDriverUser = secondaryD.user;

    testVehicle = await createTestVehicle({
      capacityKg: 1000,
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
    });

    otherVehicle = await createTestVehicle({
      capacityKg: 1000,
      fuelType: 'Diesel',
      kmPerLitre: 12.5,
    });

    driverDoc = await createTestDriver(driverUser, {
      assignedVehicleId: testVehicle._id,
      availability: DRIVER_AVAILABILITY.IN_TRANSIT,
    });

    otherDriverDoc = await createTestDriver(otherDriverUser, {
      assignedVehicleId: otherVehicle._id,
      availability: DRIVER_AVAILABILITY.IN_TRANSIT,
    });
  });

  test('TC-REOPT-1: HEAVY_TRAFFIC 2.0x multiplier, terminal-stop locking, TelemetryPing anchor, and dual Socket.IO broadcast', async () => {
    // 1. Verify HEAVY_TRAFFIC constant & simulatedTrafficService scaling
    expect(TRAFFIC_SCENARIOS.HEAVY_TRAFFIC).toBe('HEAVY_TRAFFIC');
    expect(TRAFFIC_MULTIPLIERS.HEAVY_TRAFFIC).toBe(2.0);
    const freeFlow = calculateDuration(10, TRAFFIC_SCENARIOS.FREE_FLOW).durationMinutes;
    const heavyFlow = calculateDuration(10, TRAFFIC_SCENARIOS.HEAVY_TRAFFIC).durationMinutes;
    expect(heavyFlow).toBe(freeFlow * 2);

    // 2. Seed 4 deliveries: Stop 1 (COMPLETED), Stop 2 (FAILED), Stop 3 (far North), Stop 4 (near live TelemetryPing)
    const del1 = await createTestDelivery({
      orderReference: '#REOPT-1',
      location: { coordinates: [85.8600, 20.2950] },
    });
    const del2 = await createTestDelivery({
      orderReference: '#REOPT-2',
      location: { coordinates: [85.8500, 20.2900] },
    });
    const del3 = await createTestDelivery({
      orderReference: '#REOPT-3-NORTH',
      location: { coordinates: [85.8170, 20.3540] }, // Patia North (~9.5 km away from ping)
    });
    const del4 = await createTestDelivery({
      orderReference: '#REOPT-4-SOUTH',
      location: { coordinates: [85.8390, 20.2590] }, // Old Town / Khandagiri South (~0.2 km from ping)
    });

    const route = await Route.create({
      routeCode: `RT-REOPT1-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: testVehicle._id,
      driverId: driverDoc._id,
      status: 'DISPATCHED',
      depot: CANONICAL_DEPOT,
      version: 1,
      stops: [
        buildRouteStop(del1, 1, 'COMPLETED'),
        buildRouteStop(del2, 2, 'FAILED'),
        buildRouteStop(del3, 3, 'PENDING'),
        buildRouteStop(del4, 4, 'PENDING'),
      ],
    });

    // Place live TelemetryPing right beside del4
    await TelemetryPing.create({
      driverId: driverDoc._id,
      vehicleId: testVehicle._id,
      routeId: route._id,
      location: {
        type: 'Point',
        coordinates: [85.8395, 20.2595],
      },
      speedKmh: 18,
      timestamp: new Date(),
    });

    // Mock Socket.IO server to verify both 'route:reordered' and 'route:updated' are emitted
    const emittedEvents = [];
    const prevIo = socketService.getIo();
    const mockIo = {
      to: jest.fn((room) => ({
        emit: jest.fn((event, payload) => {
          emittedEvents.push({ room, event, payload });
        }),
      })),
    };
    socketService.setIo(mockIo);
    const emitSpy = jest.spyOn(socketService, 'emitRouteReordered');

    try {
      const result = await reoptimizeActiveRoute({
        route,
        trafficScenario: TRAFFIC_SCENARIOS.HEAVY_TRAFFIC,
      });

      expect(result.reoptimized).toBe(true);
      expect(result.version).toBe(2);
      expect(result.trafficScenario).toBe('HEAVY_TRAFFIC');
      expect(result.pendingStopsCount).toBe(2);

      const reloaded = await Route.findById(route._id);
      expect(reloaded.version).toBe(2);
      expect(reloaded.optimizationMetadata.trafficScenario).toBe('HEAVY_TRAFFIC');
      expect(reloaded.stops).toHaveLength(4);

      // Terminal stops 1 & 2 locked at front in exact sequence
      expect(reloaded.stops[0].sequence).toBe(1);
      expect(reloaded.stops[0].deliveryId.toString()).toBe(del1._id.toString());
      expect(reloaded.stops[0].status).toBe('COMPLETED');

      expect(reloaded.stops[1].sequence).toBe(2);
      expect(reloaded.stops[1].deliveryId.toString()).toBe(del2._id.toString());
      expect(reloaded.stops[1].status).toBe('FAILED');

      // Pending stop 4 (closest to TelemetryPing) is re-ordered ahead of stop 3
      expect(reloaded.stops[2].sequence).toBe(3);
      expect(reloaded.stops[2].deliveryId.toString()).toBe(del4._id.toString());
      expect(reloaded.stops[3].sequence).toBe(4);
      expect(reloaded.stops[3].deliveryId.toString()).toBe(del3._id.toString());

      // Verify dual socket emission
      expect(emitSpy).toHaveBeenCalledTimes(1);
      const eventNames = emittedEvents.map((e) => e.event);
      expect(eventNames).toContain('route:reordered');
      expect(eventNames).toContain('route:updated');
      expect(emittedEvents.some((e) => e.room === 'management' && e.event === 'route:updated')).toBe(true);
      expect(
        emittedEvents.some(
          (e) => e.room === `driver:${driverDoc._id.toString()}` && e.event === 'route:reordered'
        )
      ).toBe(true);
      expect(
        emittedEvents.some(
          (e) => e.room === `route:${route._id.toString()}` && e.event === 'route:updated'
        )
      ).toBe(true);
    } finally {
      emitSpy.mockRestore();
      socketService.setIo(prevIo);
    }
  });

  test('TC-REOPT-2: reportIncident auto-triggers reoptimizeActiveRoute on ROUTE_OBSTRUCTION and enforces BOLA guard', async () => {
    const p1 = await createTestDelivery({
      orderReference: '#INC-1',
      location: { coordinates: [85.8170, 20.3540] }, // Far north
    });
    const p2 = await createTestDelivery({
      orderReference: '#INC-2',
      location: { coordinates: [85.8400, 20.2600] }, // South
    });
    const p3 = await createTestDelivery({
      orderReference: '#INC-3',
      location: { coordinates: [85.8450, 20.2650] }, // Near incident
    });

    const driverRoute = await Route.create({
      routeCode: `RT-INC-DRV-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: testVehicle._id,
      driverId: driverDoc._id,
      status: 'IN_PROGRESS',
      depot: CANONICAL_DEPOT,
      version: 1,
      stops: [
        buildRouteStop(p1, 1, 'PENDING'),
        buildRouteStop(p2, 2, 'PENDING'),
        buildRouteStop(p3, 3, 'PENDING'),
      ],
    });
    driverDoc.currentRouteId = driverRoute._id;
    await driverDoc.save();

    // Seed another driver's route to verify BOLA protection
    const otherDel1 = await createTestDelivery({ orderReference: '#OTHER-1' });
    const otherDel2 = await createTestDelivery({ orderReference: '#OTHER-2' });
    const otherRoute = await Route.create({
      routeCode: `RT-INC-OTHER-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: otherVehicle._id,
      driverId: otherDriverDoc._id,
      status: 'IN_PROGRESS',
      depot: CANONICAL_DEPOT,
      version: 1,
      stops: [
        buildRouteStop(otherDel1, 1, 'PENDING'),
        buildRouteStop(otherDel2, 2, 'PENDING'),
      ],
    });

    // 1. ROUTE_OBSTRUCTION with 3 pending stops triggers auto-reoptimization
    const res1 = await request(app)
      .post('/api/v1/driver-hud/incidents')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        category: 'ROUTE_OBSTRUCTION',
        severity: 'HIGH',
        description: 'NH-16 flyover closure near Rasulgarh.',
        locationCoordinates: { lat: 20.2645, lng: 85.8445 },
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.reoptimization).toMatchObject({
      triggered: true,
      routeId: driverRoute._id.toString(),
      pendingStopsCount: 3,
      trafficScenario: 'HEAVY_TRAFFIC',
      version: 2,
    });

    const updatedDriverRoute = await Route.findById(driverRoute._id);
    expect(updatedDriverRoute.version).toBe(2);
    expect(updatedDriverRoute.optimizationMetadata.trafficScenario).toBe('HEAVY_TRAFFIC');

    const fleetAlert = await SystemNotification.findOne({
      targetRole: 'FLEET_MANAGER',
      category: 'ROUTE',
      'metadata.routeId': driverRoute._id.toString(),
    });
    expect(fleetAlert).not.toBeNull();

    // 2. BOLA check: driver passing another driver's routeId in req.body must NOT mutate other driver's route
    const resBola = await request(app)
      .post('/api/v1/driver-hud/incidents')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        category: 'ROUTE_OBSTRUCTION',
        severity: 'MEDIUM',
        description: 'Attempting cross-driver routeId injection.',
        routeId: otherRoute._id.toString(),
        locationCoordinates: { lat: 20.2700, lng: 85.8400 },
      });

    expect(resBola.status).toBe(201);
    const untouchedOtherRoute = await Route.findById(otherRoute._id);
    expect(untouchedOtherRoute.version).toBe(1);
    expect(untouchedOtherRoute.optimizationMetadata.trafficScenario).toBe('FREE_FLOW');

    // 3. Non-obstruction incident (VEHICLE_PROBLEM) does NOT trigger reoptimization
    const resNonObs = await request(app)
      .post('/api/v1/driver-hud/incidents')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        category: 'VEHICLE_PROBLEM',
        severity: 'MEDIUM',
        description: 'Minor tire pressure warning.',
      });

    expect(resNonObs.status).toBe(201);
    expect(resNonObs.body.data.reoptimization.triggered).toBe(false);
    expect(resNonObs.body.data.reoptimization.reason).toBe('NOT_ROUTE_OBSTRUCTION');

    // 4. ROUTE_OBSTRUCTION with < 2 pending stops does NOT trigger reoptimization
    const routeOnePending = await Route.findById(driverRoute._id);
    routeOnePending.stops[0].status = 'COMPLETED';
    routeOnePending.stops[1].status = 'FAILED';
    await routeOnePending.save();

    const resFewStops = await request(app)
      .post('/api/v1/driver-hud/incidents')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        category: 'ROUTE_OBSTRUCTION',
        severity: 'MEDIUM',
        description: 'Single stop remaining detour check.',
      });

    expect(resFewStops.status).toBe(201);
    expect(resFewStops.body.data.reoptimization.triggered).toBe(false);
    expect(resFewStops.body.data.reoptimization.reason).toBe('INSUFFICIENT_PENDING_STOPS');
    expect(resFewStops.body.data.reoptimization.pendingStopsCount).toBe(1);
  });

  test('TC-REOPT-3: POST /api/v1/routes/:id/reoptimize RBAC, trafficScenario validation, ObjectId & immutable status guards', async () => {
    const s1 = await createTestDelivery({ orderReference: '#DISP-1' });
    const s2 = await createTestDelivery({ orderReference: '#DISP-2' });

    const activeRoute = await Route.create({
      routeCode: `RT-MANUAL-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: testVehicle._id,
      driverId: driverDoc._id,
      status: 'DISPATCHED',
      depot: CANONICAL_DEPOT,
      version: 1,
      stops: [
        buildRouteStop(s1, 1, 'PENDING'),
        buildRouteStop(s2, 2, 'PENDING'),
      ],
    });

    // 1. DRIVER -> 403 INSUFFICIENT_PERMISSIONS
    const driverRes = await request(app)
      .post(`/api/v1/routes/${activeRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ trafficScenario: 'HEAVY_TRAFFIC' });

    expect(driverRes.status).toBe(403);
    expect(driverRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

    // 2. FLEET_MANAGER -> 200 OK
    const managerRes = await request(app)
      .post(`/api/v1/routes/${activeRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ trafficScenario: 'HEAVY_TRAFFIC' });

    expect(managerRes.status).toBe(200);
    expect(managerRes.body.success).toBe(true);
    expect(managerRes.body.data.version).toBe(2);
    expect(managerRes.body.data.trafficScenario).toBe('HEAVY_TRAFFIC');

    // 3. ADMIN -> 200 OK
    const adminRes = await request(app)
      .post(`/api/v1/routes/${activeRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trafficScenario: 'EVENING_PEAK' });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.version).toBe(3);
    expect(adminRes.body.data.trafficScenario).toBe('EVENING_PEAK');

    // 4. Invalid trafficScenario -> 400 INVALID_TRAFFIC_SCENARIO
    const badScenarioRes = await request(app)
      .post(`/api/v1/routes/${activeRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trafficScenario: 'GRIDLOCK_999' });

    expect(badScenarioRes.status).toBe(400);
    expect(badScenarioRes.body.error.code).toBe('INVALID_TRAFFIC_SCENARIO');

    // 5. Invalid ObjectId -> 400 INVALID_ROUTE_ID
    const badIdRes = await request(app)
      .post('/api/v1/routes/not-an-object-id/reoptimize')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trafficScenario: 'HEAVY_TRAFFIC' });

    expect(badIdRes.status).toBe(400);
    expect(badIdRes.body.error.code).toBe('INVALID_ROUTE_ID');

    // 6. COMPLETED and CANCELLED routes -> 400 IMMUTABLE_ROUTE_STATUS
    const completedRoute = await Route.create({
      routeCode: `RT-DONE-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: testVehicle._id,
      driverId: driverDoc._id,
      status: 'COMPLETED',
      depot: CANONICAL_DEPOT,
      stops: [buildRouteStop(s1, 1, 'COMPLETED')],
    });

    const completedRes = await request(app)
      .post(`/api/v1/routes/${completedRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ trafficScenario: 'HEAVY_TRAFFIC' });

    expect(completedRes.status).toBe(400);
    expect(completedRes.body.error.code).toBe('IMMUTABLE_ROUTE_STATUS');

    const cancelledRoute = await Route.create({
      routeCode: `RT-CANC-${Date.now()}`,
      batchId: new mongoose.Types.ObjectId(),
      vehicleId: testVehicle._id,
      driverId: driverDoc._id,
      status: 'CANCELLED',
      depot: CANONICAL_DEPOT,
      stops: [buildRouteStop(s2, 1, 'PENDING')],
    });

    const cancelledRes = await request(app)
      .post(`/api/v1/routes/${cancelledRoute._id}/reoptimize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trafficScenario: 'HEAVY_TRAFFIC' });

    expect(cancelledRes.status).toBe(400);
    expect(cancelledRes.body.error.code).toBe('IMMUTABLE_ROUTE_STATUS');
  });
});
