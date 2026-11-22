const request = require('supertest');
const app = require('../src/app');
const Hub = require('../src/models/Hub');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Route = require('../src/models/Route');
const { seedHubs } = require('../src/seed/seedHubs');
const {
  findNearestHub,
  clusterConsignmentsByHub,
  haversineDistanceKm,
  isValidCoordinate,
} = require('../src/services/hubClusteringService');
const {
  createTestUser,
  createTestDelivery,
  createTestVehicle,
  createTestDriver,
} = require('./helpers/testUtils');

describe('Multi-Depot Vehicle Routing & Nearest-Hub Clustering (server/tests/mdvrp_routing.test.js)', () => {
  let adminToken;
  let managerToken;
  let seededHubs;
  let rasulgarhHub;
  let patiaHub;
  let khandagiriHub;

  beforeEach(async () => {
    await Route.deleteMany({});
    await DeliveryBatch.deleteMany({});
    await Delivery.deleteMany({});
    await Vehicle.deleteMany({});
    await Driver.deleteMany({});
    await Hub.deleteMany({});

    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    // Seed Bhubaneswar standard hubs
    seededHubs = await seedHubs();
    rasulgarhHub = seededHubs.find((h) => h.code === 'HUB-RASULGARH');
    patiaHub = seededHubs.find((h) => h.code === 'HUB-PATIA');
    khandagiriHub = seededHubs.find((h) => h.code === 'HUB-KHANDAGIRI');
  });

  describe('Hub Clustering', () => {
    test('Haversine distance accurately measures distance and handles coordinate boundary validation', () => {
      // Coordinate validity
      expect(isValidCoordinate(20.2961, 85.8645)).toBe(true);
      expect(isValidCoordinate(95, 85)).toBe(false); // Lat > 90
      expect(isValidCoordinate(20, 190)).toBe(false); // Lng > 180
      expect(isValidCoordinate(NaN, 85)).toBe(false);
      expect(isValidCoordinate(null, undefined)).toBe(false);

      // Distance between Rasulgarh and Patia Hub (~8-10 km)
      const dist = haversineDistanceKm(
        rasulgarhHub.location.lat,
        rasulgarhHub.location.lng,
        patiaHub.location.lat,
        patiaHub.location.lng
      );
      expect(dist).toBeGreaterThan(6);
      expect(dist).toBeLessThan(12);

      // Zero distance for identical points
      expect(haversineDistanceKm(20.2961, 85.8645, 20.2961, 85.8645)).toBe(0);
    });

    test('findNearestHub matches delivery coordinates to the geographically closest active hub', () => {
      const activeHubs = [rasulgarhHub, patiaHub, khandagiriHub];

      // Point near KIIT / Patia Infocity: 20.3550 N, 85.8150 E
      const patiaDeliveryPoint = { lat: 20.355, lng: 85.815 };
      const nearestPatia = findNearestHub(patiaDeliveryPoint, activeHubs);
      expect(nearestPatia).toBeDefined();
      expect(nearestPatia.hub.code).toBe('HUB-PATIA');
      expect(nearestPatia.distanceKm).toBeLessThan(2);

      // Point near Rasulgarh Square: 20.2970 N, 85.8650 E
      const rasulgarhDeliveryPoint = { lat: 20.297, lng: 85.865 };
      const nearestRasulgarh = findNearestHub(rasulgarhDeliveryPoint, activeHubs);
      expect(nearestRasulgarh).toBeDefined();
      expect(nearestRasulgarh.hub.code).toBe('HUB-RASULGARH');
      expect(nearestRasulgarh.distanceKm).toBeLessThan(1);

      // Point near Khandagiri Caves: 20.2600 N, 85.7850 E
      const khandagiriDeliveryPoint = { lat: 20.26, lng: 85.785 };
      const nearestKhandagiri = findNearestHub(khandagiriDeliveryPoint, activeHubs);
      expect(nearestKhandagiri).toBeDefined();
      expect(nearestKhandagiri.hub.code).toBe('HUB-KHANDAGIRI');
      expect(nearestKhandagiri.distanceKm).toBeLessThan(1);
    });

    test('clusterConsignmentsByHub partitions deliveries across hubs with calculated centroids', async () => {
      // 2 Patia deliveries
      const dPatia1 = await createTestDelivery({
        orderReference: '#DEL-PATIA-1',
        location: { type: 'Point', coordinates: [85.816, 20.354] },
        weightKg: 4.5,
      });
      const dPatia2 = await createTestDelivery({
        orderReference: '#DEL-PATIA-2',
        location: { type: 'Point', coordinates: [85.818, 20.356] },
        weightKg: 5.5,
      });

      // 1 Rasulgarh delivery
      const dRasulgarh1 = await createTestDelivery({
        orderReference: '#DEL-RASULGARH-1',
        location: { type: 'Point', coordinates: [85.864, 20.296] },
        weightKg: 10.0,
      });

      const deliveries = [dPatia1, dPatia2, dRasulgarh1];
      const activeHubs = [rasulgarhHub, patiaHub, khandagiriHub];

      const clusters = clusterConsignmentsByHub(deliveries, activeHubs);

      expect(clusters.length).toBe(2);

      const patiaCluster = clusters.find((c) => c.hubCode === 'HUB-PATIA');
      expect(patiaCluster).toBeDefined();
      expect(patiaCluster.stopsCount).toBe(2);
      expect(patiaCluster.totalWeightKg).toBe(10.0);
      expect(patiaCluster.centroid.lat).toBeCloseTo(20.355, 3);
      expect(patiaCluster.centroid.lng).toBeCloseTo(85.817, 3);
      expect(patiaCluster.recommendedBatchName).toContain('Patia Infocity Hub Batch');

      const rasulgarhCluster = clusters.find((c) => c.hubCode === 'HUB-RASULGARH');
      expect(rasulgarhCluster).toBeDefined();
      expect(rasulgarhCluster.stopsCount).toBe(1);
      expect(rasulgarhCluster.totalWeightKg).toBe(10.0);
    });

    test('POST /api/v1/batches/cluster-preview generates preview groups for unassigned deliveries', async () => {
      const d1 = await createTestDelivery({
        location: { type: 'Point', coordinates: [85.815, 20.353] }, // Patia
      });
      const d2 = await createTestDelivery({
        location: { type: 'Point', coordinates: [85.865, 20.297] }, // Rasulgarh
      });

      const res = await request(app)
        .post('/api/v1/batches/cluster-preview')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ deliveryIds: [d1._id.toString(), d2._id.toString()] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalDeliveries).toBe(2);
      expect(Array.isArray(res.body.data.clusters)).toBe(true);
      expect(res.body.data.clusters.length).toBe(2);
    });

    test('POST /api/v1/batches auto-associates batch with nearest active hub to delivery centroid', async () => {
      // 2 Patia deliveries
      const d1 = await createTestDelivery({
        location: { type: 'Point', coordinates: [85.815, 20.353] },
      });
      const d2 = await createTestDelivery({
        location: { type: 'Point', coordinates: [85.818, 20.356] },
      });

      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'North Cluster Auto Batch',
          deliveryIds: [d1._id.toString(), d2._id.toString()],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const batch = res.body.data.batch;
      expect(batch.hubId).toBeDefined();
      const batchHubId = (batch.hubId && (batch.hubId.id || batch.hubId._id)) ? (batch.hubId.id || batch.hubId._id).toString() : String(batch.hubId);
      expect(batchHubId).toBe(patiaHub._id.toString());
      expect(batch.depot.name).toBe(patiaHub.name);
      expect(batch.depot.geo.lat).toBeCloseTo(patiaHub.location.lat, 4);
      expect(batch.depot.geo.lng).toBeCloseTo(patiaHub.location.lng, 4);
    });

    test('POST /api/v1/batches supports dispatcher manual hub override per D-02', async () => {
      // Deliveries in Patia area, but dispatcher explicitly overrides origin to Khandagiri Terminal
      const d1 = await createTestDelivery({
        location: { type: 'Point', coordinates: [85.815, 20.353] },
      });

      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manual Override Batch',
          hubId: khandagiriHub._id.toString(),
          deliveryIds: [d1._id.toString()],
        });

      expect(res.status).toBe(201);
      const batch = res.body.data.batch;
      const batchHubId = (batch.hubId && (batch.hubId.id || batch.hubId._id)) ? (batch.hubId.id || batch.hubId._id).toString() : String(batch.hubId);
      expect(batchHubId).toBe(khandagiriHub._id.toString());
      expect(batch.depot.name).toBe(khandagiriHub.name);
      expect(batch.depot.geo.lat).toBeCloseTo(khandagiriHub.location.lat, 4);
    });

    test('GET /api/v1/batches supports filtering by hubId query parameter', async () => {
      await DeliveryBatch.create({
        code: 'BATCH-PATIA-01',
        name: 'Patia Operations',
        date: '2026-11-23',
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
      });

      await DeliveryBatch.create({
        code: 'BATCH-KHAND-01',
        name: 'Khandagiri Operations',
        date: '2026-11-23',
        hubId: khandagiriHub._id,
        depot: {
          name: khandagiriHub.name,
          address: khandagiriHub.address,
          geo: { lat: khandagiriHub.location.lat, lng: khandagiriHub.location.lng },
        },
      });

      const res = await request(app)
        .get(`/api/v1/batches?hubId=${patiaHub._id.toString()}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.batches[0].code).toBe('BATCH-PATIA-01');
    });
  });

  describe('Closed-Loop Multi-Depot Routing & Dispatch', () => {
    let patiaVehicle;
    let patiaDriverUser;
    let patiaDriver;
    let patiaDeliveries;

    beforeEach(async () => {
      patiaVehicle = await createTestVehicle({
        vehicleId: 'OD-02-PATIA-01',
        homeHubId: patiaHub._id,
        capacityKg: 1000,
        fuelType: 'Diesel',
      });

      patiaDriverUser = await createTestUser('DRIVER');
      patiaDriver = await createTestDriver(patiaDriverUser.user, {
        licenseNumber: 'OD-02-PATIA-DRV-01',
        assignedVehicleId: patiaVehicle._id,
      });

      patiaDeliveries = [
        await createTestDelivery({
          orderReference: '#DEL-PATIA-A',
          location: { type: 'Point', coordinates: [85.815, 20.352] },
          weightKg: 10,
        }),
        await createTestDelivery({
          orderReference: '#DEL-PATIA-B',
          location: { type: 'Point', coordinates: [85.819, 20.358] },
          weightKg: 15,
        }),
      ];
    });

    test('evaluateBaseline enforces closed-loop tour topology starting and returning to origin hub', async () => {
      const batch = await DeliveryBatch.create({
        code: 'BATCH-PATIA-BASE-01',
        name: 'Patia Baseline Batch',
        date: '2026-11-23',
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
        deliveryIds: patiaDeliveries.map((d) => d._id),
      });

      const res = await request(app)
        .post('/api/v1/routes/evaluate-baseline')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: batch._id.toString(),
          vehicleId: patiaVehicle._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { metrics, polylineCoords, stops } = res.body.data;

      expect(stops.length).toBe(2);
      expect(metrics.startingLocation.name).toBe(patiaHub.name);
      expect(metrics.startingLocation.lat).toBeCloseTo(patiaHub.location.lat, 4);
      expect(metrics.endingLocation.name).toBe(patiaHub.name);
      expect(metrics.endingLocation.lat).toBeCloseTo(patiaHub.location.lat, 4);

      // Strict closed-loop assertion: starts and ends at Patia Hub
      const firstCoord = polylineCoords[0];
      const lastCoord = polylineCoords[polylineCoords.length - 1];
      expect(firstCoord[0]).toBeCloseTo(patiaHub.location.lng, 4);
      expect(firstCoord[1]).toBeCloseTo(patiaHub.location.lat, 4);
      expect(lastCoord[0]).toBeCloseTo(patiaHub.location.lng, 4);
      expect(lastCoord[1]).toBeCloseTo(patiaHub.location.lat, 4);

      // Total distance includes return leg back to Patia
      expect(metrics.totalDistanceKm).toBeGreaterThan(0);
      expect(metrics.drivingTimeMin).toBeGreaterThan(0);
    });

    test('POST /api/v1/routes/optimize generates closed-loop TSP tour with assigned hubId and depot', async () => {
      const batch = await DeliveryBatch.create({
        code: 'BATCH-PATIA-OPT-01',
        name: 'Patia Optimization Batch',
        date: '2026-11-23',
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
        deliveryIds: patiaDeliveries.map((d) => d._id),
        vehicleIds: [patiaVehicle._id],
        driverIds: [patiaDriver._id],
      });

      const res = await request(app)
        .post('/api/v1/routes/optimize')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          batchId: batch._id.toString(),
          vehicleIds: [patiaVehicle._id.toString()],
          driverId: patiaDriver._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const routes = await Route.find({ batchId: batch._id });
      expect(routes.length).toBe(1);
      const route = routes[0];

      // Route persistence verifies assigned hubId and closed loop depot
      expect(route.hubId).toBeDefined();
      expect(route.hubId.toString()).toBe(patiaHub._id.toString());
      expect(route.depot.name).toBe(patiaHub.name);
      expect(route.depot.geo.lat).toBeCloseTo(patiaHub.location.lat, 4);
      expect(route.depot.geo.lng).toBeCloseTo(patiaHub.location.lng, 4);
      expect(route.metrics.totalDistanceKm).toBeGreaterThan(0);
    });

    test('validateDispatchEligibility attaches informational warning when vehicle homeHubId differs from route origin hub', async () => {
      const { validateDispatchEligibility } = require('../src/services/dispatchEligibilityService');

      // Vehicle is assigned to Khandagiri Hub
      const mismatchedVehicle = await createTestVehicle({
        vehicleId: 'OD-02-KHAND-VEH',
        homeHubId: khandagiriHub._id,
      });

      // Route is stationed at Patia Hub
      const patiaRoute = await Route.create({
        routeCode: 'RT-PATIA-TEST-01',
        batchId: new DeliveryBatch()._id,
        vehicleId: mismatchedVehicle._id,
        driverId: patiaDriver._id,
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
        stops: [
          {
            sequence: 1,
            deliveryId: patiaDeliveries[0]._id,
            orderReference: '#DEL-PATIA-A',
            customer: { name: 'Test', phone: '9999999999' },
            address: { street: 'Street', zone: 'Patia', postalCode: '751024' },
            location: { lat: 20.352, lng: 85.815 },
            weightKg: 10,
            priority: 'STANDARD',
            timeWindow: { start: '09:00', end: '18:00' },
          },
        ],
      });

      const validation = await validateDispatchEligibility({
        routeId: patiaRoute._id.toString(),
        vehicleId: mismatchedVehicle._id.toString(),
        driverId: patiaDriver._id.toString(),
      });

      // Dispatch must NOT fail, but warning must be present
      expect(validation.canDispatch).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('differs from route origin hub');
    });

    test('dispatchRoute transitions route and persists multi-depot origin hub metadata', async () => {
      const batch = await DeliveryBatch.create({
        code: 'BATCH-PATIA-DISP-01',
        name: 'Patia Dispatch Batch',
        date: '2026-11-23',
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
        deliveryIds: patiaDeliveries.map((d) => d._id),
      });

      // Link deliveries to batch
      await Delivery.updateMany(
        { _id: { $in: patiaDeliveries.map((d) => d._id) } },
        { batchId: batch._id }
      );

      const route = await Route.create({
        routeCode: 'RT-PATIA-DISPATCH-01',
        batchId: batch._id,
        vehicleId: patiaVehicle._id,
        driverId: patiaDriver._id,
        hubId: patiaHub._id,
        depot: {
          name: patiaHub.name,
          address: patiaHub.address,
          geo: { lat: patiaHub.location.lat, lng: patiaHub.location.lng },
        },
        stops: patiaDeliveries.map((d, idx) => ({
          sequence: idx + 1,
          deliveryId: d._id,
          orderReference: d.orderReference,
          customer: { name: d.customer.name, phone: d.customer.phone },
          address: { street: d.address.street, zone: d.address.zone, postalCode: d.address.postalCode },
          location: { lat: d.location.coordinates[1], lng: d.location.coordinates[0] },
          weightKg: d.weightKg,
          priority: d.priority,
          timeWindow: d.timeWindow,
        })),
        metrics: { totalStops: 2, totalDistanceKm: 12.5, totalDurationMin: 45 },
      });

      const res = await request(app)
        .post(`/api/v1/routes/${route._id.toString()}/dispatch`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          vehicleId: patiaVehicle._id.toString(),
          driverId: patiaDriver._id.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute.status).toBe('DISPATCHED');
      expect(updatedRoute.hubId.toString()).toBe(patiaHub._id.toString());
      expect(updatedRoute.depot.name).toBe(patiaHub.name);
    });

    test('Backward compatibility: legacy route without hubId defaults smoothly to CANONICAL_DEPOT', async () => {
      const { calculateStopSequenceMetrics } = require('../src/services/dispatchEligibilityService');
      const { CANONICAL_DEPOT } = require('../src/config/constants');

      // Call metrics without specifying depot
      const result = await calculateStopSequenceMetrics(patiaDeliveries, null, patiaVehicle);

      expect(result).toBeDefined();
      expect(result.stops.length).toBe(2);
      expect(result.polylineCoords.length).toBeGreaterThan(2);

      // Verify start and end coordinates fall back to CANONICAL_DEPOT
      const start = result.polylineCoords[0];
      const end = result.polylineCoords[result.polylineCoords.length - 1];
      expect(start[0]).toBeCloseTo(CANONICAL_DEPOT.geo.lng, 4);
      expect(start[1]).toBeCloseTo(CANONICAL_DEPOT.geo.lat, 4);
      expect(end[0]).toBeCloseTo(CANONICAL_DEPOT.geo.lng, 4);
      expect(end[1]).toBeCloseTo(CANONICAL_DEPOT.geo.lat, 4);
    });
  });
});
