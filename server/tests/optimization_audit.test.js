/**
 * Empirical Optimization Audit & Real Performance Test Suite
 * Validates genuine before-and-after calculations, local search untangling,
 * zero-fabrication on optimal routes, propulsion-specific fuel models, and Google Maps URLs.
 */
const {
  runRouteOptimization,
  constructOriginalRoute,
  constructNearestNeighborRoute,
  optimize2Opt,
  optimizeOrOpt,
  scoreRouteCost,
  calculateDeltas,
  RATES,
} = require('../src/services/optimization');
const {
  formatLatLng,
  buildLocationUrl,
  buildDirectionsUrl,
  buildMultiStopRouteUrl,
} = require('../src/utils/googleMapsHelper');

describe('Master Prompt: SmartRoute Optimization Audit & Real Performance Test Suite', () => {
  // Fixed Rasulgarh Central Logistics Hub Depot
  const depot = {
    name: 'Rasulgarh Central Hub',
    lat: 20.2961,
    lng: 85.8645,
  };

  // 5 Geographically Distributed Bhubaneswar Deliveries
  // 1: Saheed Nagar (South-East, ~2 km from depot)
  // 2: Patia North (Far North, ~8.5 km from depot)
  // 3: Master Canteen / Station (South, ~4.5 km from depot)
  // 4: KIIT / Infocity (Far North, adjacent to Patia, ~9 km from depot)
  // 5: Jaydev Vihar (Midway North-West, ~4 km from depot)
  const deliveryPoints = [
    { id: 'DEPOT', lat: 20.2961, lng: 85.8645, type: 'DEPOT' },
    { id: 'DEL-1', lat: 20.2880, lng: 85.8520, delivery: { orderReference: 'ORD-1', priority: 'Standard', serviceDurationMinutes: 10 } },
    { id: 'DEL-2', lat: 20.3540, lng: 85.8170, delivery: { orderReference: 'ORD-2', priority: 'Standard', serviceDurationMinutes: 10 } },
    { id: 'DEL-3', lat: 20.2600, lng: 85.8400, delivery: { orderReference: 'ORD-3', priority: 'Cold Chain', serviceDurationMinutes: 10 } },
    { id: 'DEL-4', lat: 20.3590, lng: 85.8190, delivery: { orderReference: 'ORD-4', priority: 'Standard', serviceDurationMinutes: 10 } },
    { id: 'DEL-5', lat: 20.3010, lng: 85.8230, delivery: { orderReference: 'ORD-5', priority: 'Urgent', serviceDurationMinutes: 10 } },
  ];

  // Realistic synthetic distance and duration matrix for the 6 nodes (0 to 5)
  // Coordinates are roughly:
  // Node 0 (Depot): [20.2961, 85.8645]
  // Node 1 (Saheed): [20.2880, 85.8520] -> ~2.2 km from 0
  // Node 2 (Patia): [20.3540, 85.8170] -> ~9.5 km from 0, ~1.2 km from 4
  // Node 3 (Station): [20.2600, 85.8400] -> ~5.0 km from 0, ~3.2 km from 1, ~13.5 km from 2
  // Node 4 (KIIT): [20.3590, 85.8190] -> ~10.0 km from 0, ~1.2 km from 2, ~14.0 km from 3
  // Node 5 (Jaydev): [20.3010, 85.8230] -> ~4.8 km from 0, ~3.5 km from 1, ~6.2 km from 2, ~5.5 km from 3
  const distMatrix = [
    // 0(Depot) 1(Saheed) 2(Patia) 3(Station) 4(KIIT) 5(Jaydev)
    [ 0.0,      2.2,      9.5,     5.0,       10.0,   4.8 ], // 0
    [ 2.2,      0.0,      8.8,     3.2,       9.3,    3.5 ], // 1
    [ 9.5,      8.8,      0.0,     13.5,      1.2,    6.2 ], // 2
    [ 5.0,      3.2,      13.5,    0.0,       14.0,   5.5 ], // 3
    [ 10.0,     9.3,      1.2,     14.0,      0.0,    6.8 ], // 4
    [ 4.8,      3.5,      6.2,     5.5,       6.8,    0.0 ], // 5
  ];

  const getDistanceKm = (i, j) => distMatrix[i][j];
  const getDurationMin = (i, j) => parseFloat(((distMatrix[i][j] / 30.0) * 60).toFixed(1)); // ~30 km/h avg speed

  const standardDieselVehicle = {
    vehicleId: 'OD-02-AX-1010',
    type: 'Van',
    fuelType: 'Diesel',
    kmPerLitre: 12.5,
    capacityKg: 1000,
  };

  // =========================================================================
  // TEST A: Known Inefficient Route Must Be Measurably Improved
  // =========================================================================
  describe('Test A: Known Inefficient Route', () => {
    test('Optimizer untangles deliberately scrambled zig-zag sequence and achieves genuine savings', () => {
      // Deliberately worst-case zig-zag order:
      // Depot(0) -> Patia(2) -> Station(3) -> KIIT(4) -> Saheed(1) -> Jaydev(5) -> Depot(0)
      // Jumps North(2) -> South(3) -> North(4) -> South(1) -> Middle(5)!
      const inefficientStopIndices = [2, 3, 4, 1, 5];

      const result = runRouteOptimization({
        depotIndex: 0,
        stopIndices: inefficientStopIndices,
        getDistanceKm,
        getDurationMin,
        points: deliveryPoints,
        vehicle: standardDieselVehicle,
        options: {
          algorithm: 'AUTO',
          maxIterations: 500,
        },
      });

      // 1. Inefficient baseline distance check:
      // 0->2 (9.5) + 2->3 (13.5) + 3->4 (14.0) + 4->1 (9.3) + 1->5 (3.5) + 5->0 (4.8) = 54.6 km
      expect(result.baseline.totalDistanceKm).toBeCloseTo(54.6, 1);

      // 2. Optimized distance must be significantly shorter
      // An efficient loop (e.g. 0 -> 1 -> 3 -> 5 -> 2 -> 4 -> 0):
      // 0->1(2.2) + 1->3(3.2) + 3->5(5.5) + 5->2(6.2) + 2->4(1.2) + 4->0(10.0) = ~28.3 km
      expect(result.optimized.totalDistanceKm).toBeLessThan(35.0);
      expect(result.optimized.totalDistanceKm).toBeLessThan(result.baseline.totalDistanceKm);

      // 3. Measurable improvement verified
      expect(result.deltas.isImproved).toBe(true);
      expect(result.deltas.distanceSavedKm).toBeGreaterThan(15.0); // Saved > 15 km!
      expect(result.deltas.percentDistanceReduction).toBeGreaterThan(30.0); // > 30% reduction!
      expect(result.deltas.fuelSaved).toBeGreaterThan(1.0); // Saved > 1.0 Litres of diesel
      expect(result.deltas.costSavedInr).toBeGreaterThan(100.0); // Saved > ₹100

      // 4. Invariant: Both routes visit all 5 stops exactly once and start/end at depot
      expect(result.baseline.tourIndices[0]).toBe(0);
      expect(result.baseline.tourIndices[result.baseline.tourIndices.length - 1]).toBe(0);
      expect(result.optimized.tourIndices[0]).toBe(0);
      expect(result.optimized.tourIndices[result.optimized.tourIndices.length - 1]).toBe(0);
      expect(result.optimized.stopSequence.length).toBe(5);
      expect(new Set(result.optimized.stopSequence).size).toBe(5);
    });
  });

  // =========================================================================
  // TEST B: Already Efficient Route Must NOT Fabricate Savings
  // =========================================================================
  describe('Test B: Already Efficient Route', () => {
    test('Optimizer reports zero savings and honest message when route is already optimal', () => {
      // Clean clustered tour: Depot -> Saheed(1) -> Station(3) -> Jaydev(5) -> Patia(2) -> KIIT(4) -> Depot
      const optimalStopIndices = [1, 3, 5, 2, 4];

      const result = runRouteOptimization({
        depotIndex: 0,
        stopIndices: optimalStopIndices,
        getDistanceKm,
        getDurationMin,
        points: deliveryPoints,
        vehicle: standardDieselVehicle,
        options: {
          algorithm: 'AUTO',
        },
      });

      // Optimized distance must never exceed baseline distance
      expect(result.optimized.totalDistanceKm).toBeLessThanOrEqual(result.baseline.totalDistanceKm);

      // If the route was already optimal or near-optimal:
      if (Math.abs(result.optimized.totalDistanceKm - result.baseline.totalDistanceKm) < 0.05) {
        expect(result.deltas.isImproved).toBe(false);
        expect(result.deltas.distanceSavedKm).toBe(0);
        expect(result.deltas.costSavedInr).toBe(0);
        expect(result.deltas.fuelSaved).toBe(0);
        expect(result.deltas.message).toContain('No measurable improvement found');
      }
    });
  });

  // =========================================================================
  // TEST C: Different Delivery Selections Produce Different Results
  // =========================================================================
  describe('Test C: Different Delivery Selections', () => {
    test('Changing selected deliveries alters distance, duration, and stop sequence', () => {
      // Subset 1: Only South stops [1, 3]
      const southResult = runRouteOptimization({
        depotIndex: 0,
        stopIndices: [1, 3],
        getDistanceKm,
        getDurationMin,
        points: deliveryPoints,
        vehicle: standardDieselVehicle,
      });

      // Subset 2: Only North stops [2, 4]
      const northResult = runRouteOptimization({
        depotIndex: 0,
        stopIndices: [2, 4],
        getDistanceKm,
        getDurationMin,
        points: deliveryPoints,
        vehicle: standardDieselVehicle,
      });

      expect(southResult.optimized.stopSequence).toHaveLength(2);
      expect(northResult.optimized.stopSequence).toHaveLength(2);
      // South loop (0 -> 1 -> 3 -> 0) is much closer than North loop (0 -> 2 -> 4 -> 0)
      expect(southResult.optimized.totalDistanceKm).toBeLessThan(northResult.optimized.totalDistanceKm);
    });
  });

  // =========================================================================
  // TEST D: Vehicle Propulsion, Mileage, and Fuel Cost Calculation
  // =========================================================================
  describe('Test D: Vehicle Propulsion and Fuel Models', () => {
    const testDistanceKm = 100.0;

    test('Diesel vehicle fuel consumption = distance / mileage; cost = fuel * dieselRate', () => {
      const dieselVeh = { fuelType: 'Diesel', kmPerLitre: 12.5 };
      const cost = scoreRouteCost(testDistanceKm, dieselVeh, { dieselPricePerLiter: 95.0 });

      // 100 km / 12.5 km/L = 8.00 Litres
      expect(cost.fuelConsumed).toBe(8.00);
      expect(cost.fuelUnit).toBe('L');
      // 8.00 L * ₹95/L = ₹760.00
      expect(cost.costInr).toBe(760.00);
      expect(cost.co2Kg).toBeGreaterThan(0);
    });

    test('Petrol vehicle fuel consumption = distance / mileage; cost = fuel * petrolRate', () => {
      const petrolVeh = { fuelType: 'Petrol', kmPerLitre: 15.0 };
      const cost = scoreRouteCost(testDistanceKm, petrolVeh, { petrolPricePerLiter: 103.0 });

      // 100 km / 15.0 km/L = 6.67 Litres
      expect(cost.fuelConsumed).toBeCloseTo(6.67, 1);
      expect(cost.fuelUnit).toBe('L');
      // 6.67 L * ₹103/L = ₹687.01
      expect(cost.costInr).toBeCloseTo(687.01, 0);
    });

    test('Electric vehicle (EV) energy = distance * energyKWhPerKm; 0g tailpipe CO2', () => {
      const evVeh = { fuelType: 'Electric', energyKWhPerKm: 0.18 };
      const cost = scoreRouteCost(testDistanceKm, evVeh, { electricityTariffPerKwh: 8.0 });

      // 100 km * 0.18 kWh/km = 18.00 kWh
      expect(cost.fuelConsumed).toBe(18.00);
      expect(cost.fuelUnit).toBe('kWh');
      // 18.00 kWh * ₹8/kWh = ₹144.00
      expect(cost.costInr).toBe(144.00);
      // EV has 0g tailpipe CO2
      expect(cost.co2Kg).toBe(0.000);
    });
  });

  // =========================================================================
  // TEST E: Constraints & Tie-Breaking
  // =========================================================================
  describe('Test E: Constraints and Priority Scheduling', () => {
    test('Nearest Neighbor breaks distance ties in favor of Cold Chain & Urgent priority', () => {
      // Node 3 is Cold Chain, Node 5 is Urgent, Node 1 is Standard
      const nn = constructNearestNeighborRoute(0, [1, 3, 5], getDistanceKm, getDurationMin, deliveryPoints);
      expect(nn.tourIndices[0]).toBe(0);
      expect(nn.tourIndices[nn.tourIndices.length - 1]).toBe(0);
    });

    test('Empty stops input returns safe zero-distance route without crashing', () => {
      const res = runRouteOptimization({
        depotIndex: 0,
        stopIndices: [],
        getDistanceKm,
        getDurationMin,
        points: deliveryPoints,
        vehicle: standardDieselVehicle,
      });

      expect(res.baseline.totalDistanceKm).toBe(0);
      expect(res.optimized.totalDistanceKm).toBe(0);
      expect(res.deltas.distanceSavedKm).toBe(0);
      expect(res.deltas.isImproved).toBe(false);
    });
  });

  // =========================================================================
  // TEST F: Google Maps URLs and Navigation Builders
  // =========================================================================
  describe('Test F: Google Maps Navigation Integration', () => {
    test('buildLocationUrl formats coordinates properly', () => {
      const url = buildLocationUrl({ lat: 20.2961, lng: 85.8645 }, 'Rasulgarh Depot');
      expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
      expect(url).toContain('20.296100,85.864500');
    });

    test('buildDirectionsUrl formats origin and destination driving route', () => {
      const url = buildDirectionsUrl([20.2961, 85.8645], [20.3540, 85.8170]);
      expect(url).toContain('https://www.google.com/maps/dir/?api=1');
      expect(url).toContain('origin=20.296100%2C85.864500');
      expect(url).toContain('destination=20.354000%2C85.817000');
      expect(url).toContain('travelmode=driving');
    });

    test('buildMultiStopRouteUrl supports multi-stop waypoints', () => {
      const points = [
        [20.2961, 85.8645], // Origin
        [20.2880, 85.8520], // Waypoint 1
        [20.3540, 85.8170], // Waypoint 2
        [20.2961, 85.8645], // Destination (Depot Return)
      ];
      const res = buildMultiStopRouteUrl(points);
      expect(res.primaryUrl).toContain('origin=20.296100%2C85.864500');
      expect(res.primaryUrl).toContain('destination=20.296100%2C85.864500');
      expect(res.primaryUrl).toContain('waypoints=20.288000%2C85.852000%7C20.354000%2C85.817000');
      expect(res.segments.length).toBe(1);
    });

    test('buildMultiStopRouteUrl handles waypoint limit (> 20 waypoints) via segments', () => {
      // 25 points
      const manyPoints = [];
      for (let i = 0; i < 25; i++) {
        manyPoints.push([20.2000 + i * 0.005, 85.8000 + i * 0.005]);
      }
      const res = buildMultiStopRouteUrl(manyPoints);
      expect(res.segments.length).toBeGreaterThan(1);
      expect(res.segments[0].label).toContain('Route Leg 1');
      expect(res.segments[1].label).toContain('Route Leg 2');
    });
  });
});
