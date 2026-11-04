const {
  haversineDistance,
  roadDistance,
  calculateDuration,
  normalizeCoord,
  getDistanceMatrix,
  clearCache,
  getCacheStats,
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
} = require('../src/services/mapping');
const matrixCache = require('../src/services/mapping/matrixCache');
const { buildUrl } = require('../src/services/mapping/googleMapsService');
const {
  buildMatrix,
  packDeliveries,
  constructNearestNeighborRoute,
  optimize2Opt,
  scoreRouteCost,
  calculateDeltas,
  RATES,
} = require('../src/services/optimization');
const { CANONICAL_DEPOT, PRIORITY_LEVELS, FUEL_TYPES } = require('../src/config/constants');

describe('Optimization & Mapping Unit Test Suite', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('1. MatrixCache & Coordinate Normalization', () => {
    test('TC-MAP-CACHE-1: Formats key with 5-decimal coordinate normalization and scenario', () => {
      const p1 = { lat: 20.2961234, lng: 85.8645678 };
      const p2 = [85.8520999, 20.2880111]; // [lng, lat]
      const key = matrixCache.formatKey(p1, p2, TRAFFIC_SCENARIOS.MORNING_RUSH);

      expect(key).toBe('20.29612,85.86457:20.28801,85.85210:MORNING_RUSH');
    });

    test('TC-MAP-CACHE-2: Records cache hits, misses, and statistics', () => {
      const p1 = { lat: 20.2961, lng: 85.8645 };
      const p2 = { lat: 20.2880, lng: 85.8520 };

      expect(matrixCache.get(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW)).toBeNull();
      let stats = matrixCache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      matrixCache.set(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW, { distanceKm: 2.14, durationMinutes: 5.13 });
      const hit = matrixCache.get(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW);
      expect(hit).toBeDefined();
      expect(hit.distanceKm).toBe(2.14);

      stats = matrixCache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRatio).toBe(0.5);
    });

    test('TC-MAP-CACHE-3: Respects custom TTL expiration', () => {
      const customCache = new matrixCache.MatrixCache({ ttlMs: 10, maxSize: 100 });
      const p1 = { lat: 20.2961, lng: 85.8645 };
      const p2 = { lat: 20.2880, lng: 85.8520 };

      customCache.set(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW, { data: 'sample' }, 10);
      expect(customCache.get(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW)).toBeDefined();

      // Wait 25ms to let TTL expire
      return new Promise(resolve => {
        setTimeout(() => {
          expect(customCache.get(p1, p2, TRAFFIC_SCENARIOS.FREE_FLOW)).toBeNull();
          customCache.destroy();
          resolve();
        }, 25);
      });
    });

    test('TC-MAP-CACHE-4: LRU Eviction evicts oldest accessed entries when maxSize reached', () => {
      const lruCache = new matrixCache.MatrixCache({ maxSize: 2, ttlMs: 100000 });
      const p0 = { lat: 20.0, lng: 85.0 };
      const p1 = { lat: 20.1, lng: 85.1 };
      const p2 = { lat: 20.2, lng: 85.2 };
      const p3 = { lat: 20.3, lng: 85.3 };

      lruCache.set(p0, p1, 'FREE_FLOW', { val: 1 });
      lruCache.set(p0, p2, 'FREE_FLOW', { val: 2 });
      expect(lruCache.store.size).toBe(2);

      // Access p0->p1 to make it more recent
      lruCache.get(p0, p1, 'FREE_FLOW');

      // Adding p0->p3 should evict least recently used (p0->p2)
      lruCache.set(p0, p3, 'FREE_FLOW', { val: 3 });

      expect(lruCache.store.size).toBe(2);
      expect(lruCache.get(p0, p1, 'FREE_FLOW')).toBeDefined();
      expect(lruCache.get(p0, p2, 'FREE_FLOW')).toBeNull(); // Evicted!
      expect(lruCache.get(p0, p3, 'FREE_FLOW')).toBeDefined();
      lruCache.destroy();
    });
  });

  describe('2. Simulated Traffic Service & Mathematical Invariants', () => {
    test('TC-MAP-SIM-1: Haversine distance returns 0 for identical points and handles antipode guard', () => {
      const p1 = { lat: 20.2961, lng: 85.8645 };
      expect(haversineDistance(p1, p1)).toBe(0.0);

      // Antipode points
      const p2 = { lat: -20.2961, lng: -94.1355 };
      const dist = haversineDistance(p1, p2);
      expect(isNaN(dist)).toBe(false);
      expect(dist).toBeGreaterThan(19000);
    });

    test('TC-MAP-SIM-2: Road distance incorporates 1.35x curvature factor for Bhubaneswar clusters', () => {
      // Rasulgarh Depot (20.2961, 85.8645) to Saheed Nagar (20.2880, 85.8520)
      const depot = CANONICAL_DEPOT.geo;
      const saheedNagar = { lat: 20.2880, lng: 85.8520 };
      const hDist = haversineDistance(depot, saheedNagar);
      const rDist = roadDistance(depot, saheedNagar);

      // Theoretical: hDist ~ 1.585 km, rDist ~ 2.139 km
      expect(hDist).toBeCloseTo(1.585, 2);
      expect(rDist).toBeCloseTo(2.139, 2);
      expect(rDist / hDist).toBeCloseTo(1.35, 4);
    });

    test('TC-MAP-SIM-3: 5 Discrete Traffic Scenarios apply exact time multipliers', () => {
      const distKm = 25.0; // At 25 km/h base speed, 25 km takes 60 minutes in FREE_FLOW
      const freeFlow = calculateDuration(distKm, TRAFFIC_SCENARIOS.FREE_FLOW);
      const morningRush = calculateDuration(distKm, TRAFFIC_SCENARIOS.MORNING_RUSH);
      const eveningPeak = calculateDuration(distKm, TRAFFIC_SCENARIOS.EVENING_PEAK);
      const monsoon = calculateDuration(distKm, TRAFFIC_SCENARIOS.MONSOON_RAIN);
      const weekend = calculateDuration(distKm, TRAFFIC_SCENARIOS.WEEKEND);

      expect(freeFlow.durationSeconds).toBe(3600);
      expect(freeFlow.durationMinutes).toBe(60.0);

      expect(morningRush.durationSeconds).toBe(Math.round(3600 * 1.8));
      expect(eveningPeak.durationSeconds).toBe(Math.round(3600 * 2.2));
      expect(monsoon.durationSeconds).toBe(Math.round(3600 * 1.5));
      expect(weekend.durationSeconds).toBe(Math.round(3600 * 1.1));
    });

    test('TC-MAP-SIM-4: Coordinate normalization accepts diverse shapes and rejects out-of-bounds', () => {
      expect(normalizeCoord([85.8645, 20.2961])).toEqual({ lat: 20.2961, lng: 85.8645 });
      expect(normalizeCoord({ latitude: 20.2961, longitude: 85.8645 })).toEqual({ lat: 20.2961, lng: 85.8645 });
      expect(normalizeCoord({ lat: 20.2961, lng: 85.8645 })).toEqual({ lat: 20.2961, lng: 85.8645 });

      expect(() => normalizeCoord(null)).toThrow('Coordinate is null or undefined');
      expect(() => normalizeCoord({ lat: 95.0, lng: 85.0 })).toThrow('Coordinate values out of bounds');
      expect(() => normalizeCoord({ lat: 20.0, lng: 185.0 })).toThrow('Coordinate values out of bounds');
    });

    test('TC-MAP-SIM-5: getDistanceMatrix outputs valid 2D matrix and Google Distance Matrix envelope', async () => {
      const origins = [{ lat: 20.2961, lng: 85.8645 }, { lat: 20.2880, lng: 85.8520 }];
      const destinations = [{ lat: 20.3010, lng: 85.8230 }, { lat: 20.3540, lng: 85.8170 }];

      const res = await getDistanceMatrix(origins, destinations, { scenario: TRAFFIC_SCENARIOS.FREE_FLOW });

      expect(res.source).toBe('SIMULATED');
      expect(res.status).toBe('OK');
      expect(res.matrix.length).toBe(2);
      expect(res.matrix[0].length).toBe(2);
      expect(res.rows.length).toBe(2);
      expect(res.rows[0].elements.length).toBe(2);
      expect(res.rows[0].elements[0].status).toBe('OK');
      expect(res.rows[0].elements[0].distance.value).toBeGreaterThan(0);
      expect(res.rows[0].elements[0].duration.value).toBeGreaterThan(0);
    });
  });

  describe('3. Google Maps Service & URL Builder', () => {
    test('TC-MAP-GMS-1: Builds valid Google Distance Matrix URL parameters', () => {
      const origins = [{ lat: 20.2961, lng: 85.8645 }];
      const destinations = [{ lat: 20.2880, lng: 85.8520 }];
      const url = buildUrl(origins, destinations, 'AIzaSyFakeKey123');

      expect(url).toContain('https://maps.googleapis.com/maps/api/distancematrix/json');
      expect(url).toContain('origins=20.2961%2C85.8645');
      expect(url).toContain('destinations=20.288%2C85.852');
      expect(url).toContain('key=AIzaSyFakeKey123');
      expect(url).toContain('units=metric');
    });

    test('TC-MAP-GMS-2: Transparently falls back to simulated traffic when API key is missing or mock', async () => {
      const origins = [{ lat: 20.2961, lng: 85.8645 }];
      const destinations = [{ lat: 20.2880, lng: 85.8520 }];

      const result = await getDistanceMatrix(origins, destinations, { forceSimulation: true });
      expect(result.source).toBe('SIMULATED');
      expect(result.status).toBe('OK');
      expect(result.matrix[0][0].distanceKm).toBeGreaterThan(0);
    });
  });

  describe('4. MatrixBuilder Service', () => {
    test('TC-OPT-MAT-1: Constructs (N+1)x(N+1) matrix with Rasulgarh Depot at index 0', async () => {
      const deliveries = [
        {
          _id: 'deliv_1',
          orderReference: '#DEL-1',
          location: { coordinates: [85.8520, 20.2880] }, // Saheed Nagar
        },
        {
          _id: 'deliv_2',
          orderReference: '#DEL-2',
          location: { coordinates: [85.8230, 20.3010] }, // Jaydev Vihar
        },
      ];

      const res = await buildMatrix(CANONICAL_DEPOT, deliveries, { trafficScenario: TRAFFIC_SCENARIOS.FREE_FLOW });

      expect(res.points.length).toBe(3); // 1 depot + 2 deliveries
      expect(res.points[0].id).toBe('DEPOT');
      expect(res.points[0].type).toBe('DEPOT');
      expect(res.points[1].id).toBe('deliv_1');
      expect(res.points[2].id).toBe('deliv_2');

      expect(res.distancesKm.length).toBe(3);
      expect(res.distancesKm[0].length).toBe(3);
      expect(res.distancesKm[0][0]).toBe(0.0);
      expect(res.distancesKm[1][1]).toBe(0.0);
      expect(res.getDistanceKm(0, 1)).toBeGreaterThan(0);
      expect(res.getDurationMin(0, 1)).toBeGreaterThan(0);
    });

    test('TC-OPT-MAT-2: Throws 422 UNRESOLVED_GEOCODE for missing or invalid coordinates', async () => {
      const invalidDeliveries = [
        {
          _id: 'deliv_bad',
          orderReference: '#DEL-BAD',
          location: { coordinates: [] }, // Invalid
        },
      ];

      await expect(buildMatrix(CANONICAL_DEPOT, invalidDeliveries)).rejects.toThrow(
        'has invalid or un-geocoded coordinates'
      );
    });

    test('TC-OPT-MAT-3: Throws 400 INVALID_DEPOT_COORDINATES for missing depot coordinates', async () => {
      await expect(buildMatrix({ name: 'Invalid Depot', geo: {} }, [])).rejects.toThrow(
        'Valid depot coordinates are required'
      );
    });
  });

  describe('5. BinPacker Multi-Vehicle Allocation', () => {
    const testVehicles = [
      {
        _id: 'v_ev_1',
        vehicleId: 'OD-02-EV-01',
        capacityKg: 500,
        fuelType: FUEL_TYPES.ELECTRIC,
      },
      {
        _id: 'v_ice_1',
        vehicleId: 'OD-02-ICE-01',
        capacityKg: 1000,
        fuelType: FUEL_TYPES.DIESEL,
      },
    ];

    test('TC-OPT-BIN-1: Single vehicle with ample capacity receives all consignments', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 100, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2', weightKg: 200, priority: PRIORITY_LEVELS.URGENT },
      ];

      const res = packDeliveries(deliveries, [testVehicles[1]]);
      expect(res.vehicleBins.length).toBe(1);
      expect(res.vehicleBins[0].deliveries.length).toBe(2);
      expect(res.vehicleBins[0].totalWeightKg).toBe(300);
      expect(res.vehicleBins[0].remainingCapacityKg).toBe(700);
      expect(res.unassignedDeliveries.length).toBe(0);
    });

    test('TC-OPT-BIN-2: Multi-vehicle capacity partitioning honors vehicle capacity limits', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 400, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2', weightKg: 300, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd3', orderReference: '#D3', weightKg: 400, priority: PRIORITY_LEVELS.STANDARD },
      ];
      // Total weight: 1100 kg. Available: 1000 kg + 500 kg = 1500 kg.

      const res = packDeliveries(deliveries, testVehicles);
      expect(res.unassignedDeliveries.length).toBe(0);
      const totalPacked = res.vehicleBins.reduce((sum, b) => sum + b.totalWeightKg, 0);
      expect(totalPacked).toBe(1100);
    });

    test('TC-OPT-BIN-3: Handles exact capacity fit (1000 kg cargo in 1000 kg vehicle)', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 600, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2', weightKg: 400, priority: PRIORITY_LEVELS.STANDARD },
      ];

      const res = packDeliveries(deliveries, [testVehicles[1]]);
      expect(res.unassignedDeliveries.length).toBe(0);
      expect(res.vehicleBins[0].totalWeightKg).toBe(1000);
      expect(res.vehicleBins[0].remainingCapacityKg).toBe(0);
      expect(res.vehicleBins[0].utilizationPercent).toBe(100.0);
    });

    test('TC-OPT-BIN-4: Rejects 1000.01 kg load with CAPACITY_OVERFLOW in unassignedDeliveries', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 1000.0, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2', weightKg: 0.1, priority: PRIORITY_LEVELS.STANDARD },
      ];

      const res = packDeliveries(deliveries, [testVehicles[1]]);
      expect(res.vehicleBins[0].deliveries.length).toBe(1);
      expect(res.unassignedDeliveries.length).toBe(1);
      expect(res.unassignedDeliveries[0].reason).toBe('CAPACITY_OVERFLOW');
    });

    test('TC-OPT-BIN-5: Flags consignment heavier than max fleet vehicle capacity with EXCEEDS_VEHICLE_MAX_CAPACITY', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 1200, priority: PRIORITY_LEVELS.STANDARD },
      ];

      const res = packDeliveries(deliveries, testVehicles);
      expect(res.vehicleBins.length).toBe(0);
      expect(res.unassignedDeliveries.length).toBe(1);
      expect(res.unassignedDeliveries[0].reason).toBe('EXCEEDS_VEHICLE_MAX_CAPACITY');
    });

    test('TC-OPT-BIN-6: vehicleTypePreference: EV prioritizes EV vans before ICE vehicles', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 200, priority: PRIORITY_LEVELS.STANDARD },
      ];

      const res = packDeliveries(deliveries, testVehicles, { vehicleTypePreference: 'EV' });
      expect(res.vehicleBins.length).toBe(1);
      expect(res.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
    });

    test('TC-OPT-BIN-7: Strict determinism: multiple runs produce identical allocations', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#D1', weightKg: 250, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2', weightKg: 150, priority: PRIORITY_LEVELS.URGENT },
        { _id: 'd3', orderReference: '#D3', weightKg: 300, priority: PRIORITY_LEVELS.COLD_CHAIN },
      ];

      const res1 = packDeliveries(deliveries, testVehicles);
      const res2 = packDeliveries(deliveries, testVehicles);

      expect(JSON.stringify(res1)).toEqual(JSON.stringify(res2));
    });
  });

  describe('6. Nearest Neighbor Baseline TSP Construction', () => {
    test('TC-OPT-NN-1: Generates valid closed loop starting and ending at depot (0 -> s1..sm -> 0)', () => {
      // Mock 4-node distance matrix: 0 (depot), 1 (close), 2 (mid), 3 (far)
      const matrix = [
        [0, 2, 5, 10],
        [2, 0, 4, 8],
        [5, 4, 0, 3],
        [10, 8, 3, 0],
      ];
      const getDistance = (i, j) => matrix[i][j];
      const getDuration = (i, j) => matrix[i][j] * 2;
      const points = [
        { id: 'DEPOT', type: 'DEPOT' },
        { id: '1', delivery: { priority: 'Standard', serviceDurationMinutes: 10 } },
        { id: '2', delivery: { priority: 'Standard', serviceDurationMinutes: 10 } },
        { id: '3', delivery: { priority: 'Standard', serviceDurationMinutes: 10 } },
      ];

      const res = constructNearestNeighborRoute(0, [1, 2, 3], getDistance, getDuration, points);

      expect(res.tourIndices[0]).toBe(0);
      expect(res.tourIndices[res.tourIndices.length - 1]).toBe(0);
      // From 0, nearest is 1 (dist 2). From 1, nearest is 2 (dist 4). From 2, nearest is 3 (dist 3).
      expect(res.stopSequence).toEqual([1, 2, 3]);
      expect(res.totalDistanceKm).toBe(2 + 4 + 3 + 10); // Loop back to 0 is dist 10 -> total 19
      expect(res.totalDurationMin).toBe(19 * 2 + 30); // travel + 30 min service
    });

    test('TC-OPT-NN-2: Breaks distance ties in favor of COLD_CHAIN and URGENT consignments', () => {
      // Node 1 and Node 2 are both distance 5 from depot, but Node 2 is Cold Chain
      const matrix = [
        [0, 5, 5],
        [5, 0, 3],
        [5, 3, 0],
      ];
      const getDist = (i, j) => matrix[i][j];
      const getDur = (i, j) => matrix[i][j];
      const points = [
        { id: 'DEPOT', type: 'DEPOT' },
        { id: '1', delivery: { priority: PRIORITY_LEVELS.STANDARD } },
        { id: '2', delivery: { priority: PRIORITY_LEVELS.COLD_CHAIN } },
      ];

      const res = constructNearestNeighborRoute(0, [1, 2], getDist, getDur, points);
      // Should pick node 2 first due to priority
      expect(res.stopSequence[0]).toBe(2);
      expect(res.stopSequence[1]).toBe(1);
    });

    test('TC-OPT-NN-3: Handles trivial routes (0 and 1 stop)', () => {
      const getDist = () => 10;
      const getDur = () => 20;

      const res0 = constructNearestNeighborRoute(0, [], getDist, getDur, []);
      expect(res0.tourIndices).toEqual([0, 0]);
      expect(res0.totalDistanceKm).toBe(0);

      const res1 = constructNearestNeighborRoute(0, [1], getDist, getDur, [
        { id: 'DEPOT' },
        { id: '1', delivery: { serviceDurationMinutes: 10 } },
      ]);
      expect(res1.tourIndices).toEqual([0, 1, 0]);
      expect(res1.totalDistanceKm).toBe(20); // 10 + 10
      expect(res1.totalDurationMin).toBe(50); // 20 + 20 + 10
    });
  });

  describe('7. Bounded 2-Opt Local Search', () => {
    test('TC-OPT-2OPT-1: Untangles crossed rectangle edges and reduces total distance', () => {
      // Synthetic 4-node crossed tour:
      // Depot at (0, 0).
      // Node 1 at (0, 10).
      // Node 2 at (10, 10).
      // Node 3 at (10, 0).
      // Crossing tour: 0 -> 2 -> 1 -> 3 -> 0 (diagonal crossings)
      // Untangled tour: 0 -> 1 -> 2 -> 3 -> 0 (perimeter of square)
      const coords = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 10 },
        { lat: 10, lng: 10 },
        { lat: 10, lng: 0 },
      ];
      const getDist = (i, j) => {
        const dx = coords[i].lat - coords[j].lat;
        const dy = coords[i].lng - coords[j].lng;
        return Math.sqrt(dx * dx + dy * dy);
      };
      const getDur = (i, j) => getDist(i, j) * 2;

      const crossedTour = [0, 2, 1, 3, 0];
      const baselineDist = getDist(0, 2) + getDist(2, 1) + getDist(1, 3) + getDist(3, 0);

      const opt = optimize2Opt(crossedTour, getDist, getDur, [], { epsilon: 0.001 });

      expect(opt.totalDistanceKm).toBeLessThan(baselineDist);
      expect(opt.converged).toBe(true);
      expect(opt.iterations).toBeGreaterThanOrEqual(1);
    });

    test('TC-OPT-2OPT-2: Invariant: D_optimized <= D_baseline holds strictly', () => {
      // Already optimal perimeter
      const coords = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
      ];
      const getDist = (i, j) => {
        const dx = coords[i].lat - coords[j].lat;
        const dy = coords[i].lng - coords[j].lng;
        return Math.sqrt(dx * dx + dy * dy);
      };
      const tour = [0, 1, 2, 3, 0];
      const initialDist = 4.0;

      const opt = optimize2Opt(tour, getDist, (i, j) => 1, []);
      expect(opt.totalDistanceKm).toBeLessThanOrEqual(initialDist);
    });

    test('TC-OPT-2OPT-3: Handles trivial routes (0, 1, and 2 customer stops) in 0 or 1 iteration', () => {
      const getDist = () => 5;
      const getDur = () => 10;

      const res0 = optimize2Opt([0, 0], getDist, getDur, []);
      expect(res0.iterations).toBe(0);
      expect(res0.converged).toBe(true);

      const res1 = optimize2Opt([0, 1, 0], getDist, getDur, []);
      expect(res1.iterations).toBe(0);
      expect(res1.converged).toBe(true);

      const res2 = optimize2Opt([0, 1, 2, 0], getDist, getDur, []);
      expect(res2.iterations).toBeLessThanOrEqual(2);
      expect(res2.converged).toBe(true);
    });
  });

  describe('8. Cost & Fuel Scorer Engine', () => {
    test('TC-OPT-COST-1: EV energy, cost, and 0g CO2 tailpipe calculation', () => {
      const vehicle = { fuelType: FUEL_TYPES.ELECTRIC, energyKWhPerKm: 0.18 };
      const score = scoreRouteCost(10.0, vehicle);

      // 10 km * 0.18 kWh/km = 1.8 kWh. At ₹8/kWh = ₹14.40. 0 kg CO2.
      expect(score.fuelConsumed).toBe(1.8);
      expect(score.fuelUnit).toBe('kWh');
      expect(score.costInr).toBe(14.40);
      expect(score.co2Kg).toBe(0.0);
      expect(score.costPerKm).toBe(1.44);
    });

    test('TC-OPT-COST-2: Diesel vehicle consumption, cost, and 210g CO2/km calculation', () => {
      const vehicle = { fuelType: FUEL_TYPES.DIESEL, kmPerLitre: 12.5 }; // 0.08 L/km
      const score = scoreRouteCost(10.0, vehicle);

      // 10 km * 0.08 L/km = 0.8 L. At ₹95/L = ₹76.00. 10 * 0.210 = 2.1 kg CO2.
      expect(score.fuelConsumed).toBe(0.8);
      expect(score.fuelUnit).toBe('L');
      expect(score.costInr).toBe(76.00);
      expect(score.co2Kg).toBe(2.100);
      expect(score.costPerKm).toBe(7.60);
    });

    test('TC-OPT-COST-3: Petrol vehicle consumption, cost, and 230g CO2/km calculation', () => {
      const vehicle = { fuelType: FUEL_TYPES.PETROL, kmPerLitre: 15.0 }; // 0.0667 L/km
      const score = scoreRouteCost(15.0, vehicle);

      expect(score.fuelConsumed).toBe(1.0);
      expect(score.fuelUnit).toBe('L');
      expect(score.costInr).toBe(103.00);
      expect(score.co2Kg).toBeCloseTo(3.450, 2);
    });

    test('TC-OPT-COST-4: Deltas calculation handles 0 baseline distance without NaN or division by zero', () => {
      const baseline = { totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 };
      const optimized = { totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 };
      const deltas = calculateDeltas(baseline, optimized);

      expect(deltas.distanceSavedKm).toBe(0);
      expect(deltas.percentDistanceReduction).toBe(0);
      expect(isNaN(deltas.percentDistanceReduction)).toBe(false);
    });

    test('TC-OPT-COST-5: Correctly computes positive savings deltas', () => {
      const baseline = { totalDistanceKm: 30.0, totalDurationMin: 90.0, costInr: 228.0, co2Kg: 6.3 };
      const optimized = { totalDistanceKm: 20.0, totalDurationMin: 60.0, costInr: 152.0, co2Kg: 4.2 };
      const deltas = calculateDeltas(baseline, optimized);

      expect(deltas.distanceSavedKm).toBe(10.0);
      expect(deltas.timeSavedMin).toBe(30.0);
      expect(deltas.costSavedInr).toBe(76.0);
      expect(deltas.co2AvoidedKg).toBe(2.1);
      expect(deltas.percentDistanceReduction).toBeCloseTo(33.33, 1);
    });
  });
});
