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
});
