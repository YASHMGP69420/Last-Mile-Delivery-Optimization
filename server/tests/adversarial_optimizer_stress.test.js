const { performance } = require('perf_hooks');
const {
  buildMatrix,
  packDeliveries,
  constructNearestNeighborRoute,
  optimize2Opt,
  scoreRouteCost,
  calculateDeltas,
  RATES,
} = require('../src/services/optimization');
const {
  CANONICAL_DEPOT,
  PRIORITY_LEVELS,
  FUEL_TYPES,
  VEHICLE_TYPES,
  VEHICLE_STATUS,
  DELIVERY_STATUS,
} = require('../src/config/constants');
const { clearCache } = require('../src/services/mapping');

describe('Adversarial Route Optimization Stress & Invariant Test Suite', () => {
  beforeEach(() => {
    clearCache();
  });

  // =========================================================================
  // 1. Tour Degeneracy & Edge Cases
  // =========================================================================
  describe('1. Tour Degeneracy & Coordinate Edge Cases', () => {
    test('TC-ADV-DEG-1: 0 deliveries (depot-only manifest) -> returns valid closed tour with 0km and depot stop', async () => {
      const depot = CANONICAL_DEPOT;
      const matrix = await buildMatrix(depot, []);

      expect(matrix.points).toHaveLength(1);
      expect(matrix.points[0].id).toBe('DEPOT');
      expect(matrix.distancesKm).toHaveLength(1);
      expect(matrix.distancesKm[0][0]).toBe(0);

      const baseline = constructNearestNeighborRoute(0, [], matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(baseline.tourIndices).toEqual([0, 0]);
      expect(baseline.stopSequence).toEqual([]);
      expect(baseline.totalDistanceKm).toBe(0);
      expect(baseline.totalDurationMin).toBe(0);

      const optimized = optimize2Opt(baseline.tourIndices, matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(optimized.tourIndices).toEqual([0, 0]);
      expect(optimized.stopSequence).toEqual([]);
      expect(optimized.totalDistanceKm).toBe(0);
      expect(optimized.totalDurationMin).toBe(0);
      expect(optimized.iterations).toBe(0);
      expect(optimized.converged).toBe(true);

      const deltas = calculateDeltas(baseline, optimized);
      expect(deltas.distanceSavedKm).toBe(0);
      expect(deltas.percentDistanceReduction).toBe(0);
    });

    test('TC-ADV-DEG-2: 1 delivery -> exact round-trip depot -> stop 1 -> depot tour', async () => {
      const depot = CANONICAL_DEPOT;
      const singleDelivery = {
        _id: '507f191e810c19729de860ea',
        orderReference: '#DEL-SOLO-01',
        customer: { name: 'Solo Consignee', phone: '+91 9999999999' },
        address: { street: 'KIIT Square, Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 15.0,
        priority: PRIORITY_LEVELS.STANDARD,
        serviceDurationMinutes: 10,
        status: DELIVERY_STATUS.READY,
      };

      const matrix = await buildMatrix(depot, [singleDelivery]);
      expect(matrix.points).toHaveLength(2);

      const leg0to1 = matrix.getDistanceKm(0, 1);
      const leg1to0 = matrix.getDistanceKm(1, 0);
      const expectedRoundTripKm = parseFloat((leg0to1 + leg1to0).toFixed(3));

      const baseline = constructNearestNeighborRoute(0, [1], matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(baseline.tourIndices).toEqual([0, 1, 0]);
      expect(baseline.stopSequence).toEqual([1]);
      expect(baseline.totalDistanceKm).toBe(expectedRoundTripKm);
      expect(baseline.totalDurationMin).toBeGreaterThan(0);

      const optimized = optimize2Opt(baseline.tourIndices, matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(optimized.tourIndices).toEqual([0, 1, 0]);
      expect(optimized.stopSequence).toEqual([1]);
      expect(optimized.totalDistanceKm).toBe(expectedRoundTripKm);
      expect(optimized.iterations).toBe(0);
      expect(optimized.converged).toBe(true);

      // Invariant: D_optimized == D_baseline for 1 stop
      expect(optimized.totalDistanceKm).toBe(baseline.totalDistanceKm);
    });

    test('TC-ADV-DEG-3: 2 deliveries -> depot -> s1 -> s2 -> depot tour with 2-opt evaluation', async () => {
      const depot = CANONICAL_DEPOT;
      const deliveries = [
        {
          _id: '507f191e810c19729de860eb',
          orderReference: '#DEL-PAIR-01',
          location: { coordinates: [85.817, 20.354] }, // Patia
          weightKg: 10,
          priority: PRIORITY_LEVELS.STANDARD,
          serviceDurationMinutes: 10,
        },
        {
          _id: '507f191e810c19729de860ec',
          orderReference: '#DEL-PAIR-02',
          location: { coordinates: [85.852, 20.288] }, // Saheed Nagar
          weightKg: 12,
          priority: PRIORITY_LEVELS.STANDARD,
          serviceDurationMinutes: 10,
        },
      ];

      const matrix = await buildMatrix(depot, deliveries);
      expect(matrix.points).toHaveLength(3);

      const baseline = constructNearestNeighborRoute(0, [1, 2], matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(baseline.tourIndices).toHaveLength(4);
      expect(baseline.tourIndices[0]).toBe(0);
      expect(baseline.tourIndices[3]).toBe(0);
      expect(baseline.stopSequence).toHaveLength(2);

      const optimized = optimize2Opt(baseline.tourIndices, matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
      expect(optimized.tourIndices).toHaveLength(4);
      expect(optimized.tourIndices[0]).toBe(0);
      expect(optimized.tourIndices[3]).toBe(0);
      expect(optimized.totalDistanceKm).toBeLessThanOrEqual(baseline.totalDistanceKm + 1e-6);

      // Verify that 2-opt can swap a sub-optimal 2-stop sequence when a reverse swap is cheaper
      // Custom distance mock: [0, 1, 2, 0] has dist 10 + 10 + 10 = 30; [0, 2, 1, 0] has dist 2 + 5 + 2 = 9
      const mockDistances = [
        [0, 10, 2],
        [10, 0, 10],
        [2, 5, 0],
      ];
      const customGetDist = (i, j) => mockDistances[i][j];
      const customGetDur = () => 5;

      const subOptimalTour = [0, 1, 2, 0];
      const swappedResult = optimize2Opt(subOptimalTour, customGetDist, customGetDur, []);
      expect(swappedResult.tourIndices).toEqual([0, 2, 1, 0]);
      expect(swappedResult.totalDistanceKm).toBeLessThan(computeTourDistance(subOptimalTour, customGetDist));
    });

    test('TC-ADV-DEG-4: Zero, out-of-bounds, NaN, and Infinite coordinates are gracefully rejected or handled without unhandled rejections', async () => {
      const depot = CANONICAL_DEPOT;

      // 1. Zero coordinates (0, 0 - Equator/Prime Meridian) handled gracefully
      const zeroDelivery = {
        _id: '507f191e810c19729de86000',
        orderReference: '#DEL-ZERO-00',
        location: { coordinates: [0, 0] },
      };
      await expect(buildMatrix(depot, [zeroDelivery])).resolves.toBeDefined();

      // 2. Out-of-bounds negative latitude (-95)
      const outOfBoundsNegativeLat = {
        _id: '507f191e810c19729de86001',
        orderReference: '#DEL-NEG-LAT',
        location: { coordinates: [85.86, -95.0] },
      };
      await expect(buildMatrix(depot, [outOfBoundsNegativeLat])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 3. Out-of-bounds positive latitude (95)
      const outOfBoundsPositiveLat = {
        _id: '507f191e810c19729de86002',
        orderReference: '#DEL-POS-LAT',
        location: { coordinates: [85.86, 95.0] },
      };
      await expect(buildMatrix(depot, [outOfBoundsPositiveLat])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 4. Out-of-bounds longitude (-190)
      const outOfBoundsNegativeLng = {
        _id: '507f191e810c19729de86003',
        orderReference: '#DEL-NEG-LNG',
        location: { coordinates: [-190.0, 20.3] },
      };
      await expect(buildMatrix(depot, [outOfBoundsNegativeLng])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 5. Positive Infinite coordinates (Infinity)
      const infiniteDelivery = {
        _id: '507f191e810c19729de86004',
        orderReference: '#DEL-INF',
        location: { coordinates: [Infinity, 20.3] },
      };
      await expect(buildMatrix(depot, [infiniteDelivery])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 6. Negative Infinite coordinates (-Infinity)
      const negInfiniteDelivery = {
        _id: '507f191e810c19729de86005',
        orderReference: '#DEL-NEG-INF',
        location: { coordinates: [85.86, -Infinity] },
      };
      await expect(buildMatrix(depot, [negInfiniteDelivery])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 7. NaN coordinates
      const nanDelivery = {
        _id: '507f191e810c19729de86006',
        orderReference: '#DEL-NAN',
        location: { coordinates: [NaN, 20.3] },
      };
      await expect(buildMatrix(depot, [nanDelivery])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 8. Missing location / empty object
      const missingCoordDelivery = {
        _id: '507f191e810c19729de86007',
        orderReference: '#DEL-MISSING-COORD',
      };
      await expect(buildMatrix(depot, [missingCoordDelivery])).rejects.toThrow(/invalid or un-geocoded coordinates/i);

      // 9. Invalid depot coordinates
      const invalidDepot = { name: 'Invalid Hub', geo: { lat: NaN, lng: 85.86 } };
      await expect(buildMatrix(invalidDepot, [])).rejects.toThrow(/Valid depot coordinates are required/i);

      // 10. Infinite depot coordinates
      const infiniteDepot = { name: 'Infinite Hub', geo: { lat: Infinity, lng: 85.86 } };
      await expect(buildMatrix(infiniteDepot, [])).rejects.toThrow();
    });
  });

  // Helper function to compute tour distance
  function computeTourDistance(tour, getDistance) {
    let d = 0;
    for (let i = 0; i < tour.length - 1; i++) {
      d += getDistance(tour[i], tour[i + 1]);
    }
    return d;
  }

  // =========================================================================
  // 2. Monotonic Non-Increasing Distance Invariant (50 Randomized Runs)
  // =========================================================================
  describe('2. Monotonic Non-Increasing Distance Invariant across 50 Randomized Consignment Sets', () => {
    const CLUSTERS = [
      { name: 'Patia (Z-1)', lat: 20.354, lng: 85.817 },
      { name: 'Jaydev Vihar (Z-2)', lat: 20.301, lng: 85.823 },
      { name: 'Saheed Nagar (Z-3)', lat: 20.288, lng: 85.852 },
      { name: 'Khandagiri (Z-4)', lat: 20.258, lng: 85.787 },
      { name: 'Chandrasekharpur', lat: 20.325, lng: 85.818 },
    ];

    test('TC-ADV-MONO-1: D_optimized <= D_baseline holds strictly for 50 randomized batches (0 violations allowed)', async () => {
      const NUM_RUNS = 50;
      let violationsCount = 0;
      let improvedCount = 0;
      let maxReductionPercent = 0;
      let totalSavingsSumKm = 0;

      for (let run = 1; run <= NUM_RUNS; run++) {
        // Vary batch size between 5 and 25 stops
        const batchSize = 5 + (run % 21);
        const deliveries = [];

        for (let s = 1; s <= batchSize; s++) {
          const cluster = CLUSTERS[s % CLUSTERS.length];
          // Deterministic pseudo-random jitter around cluster center
          const jitterLat = ((Math.sin(run * 100 + s * 13) * 0.02)).toFixed(5);
          const jitterLng = ((Math.cos(run * 100 + s * 17) * 0.02)).toFixed(5);
          const lat = parseFloat((cluster.lat + parseFloat(jitterLat)).toFixed(5));
          const lng = parseFloat((cluster.lng + parseFloat(jitterLng)).toFixed(5));
          const weightKg = parseFloat((2 + ((s * 3.7) % 25)).toFixed(1));

          deliveries.push({
            _id: `run${run}-del-${s}`,
            orderReference: `#DEL-R${run}-${String(s).padStart(2, '0')}`,
            location: { coordinates: [lng, lat] },
            weightKg,
            priority: s % 3 === 0 ? PRIORITY_LEVELS.COLD_CHAIN : (s % 2 === 0 ? PRIORITY_LEVELS.URGENT : PRIORITY_LEVELS.STANDARD),
            serviceDurationMinutes: 10,
          });
        }

        const matrix = await buildMatrix(CANONICAL_DEPOT, deliveries, { trafficScenario: 'FREE_FLOW' });
        const stopIndices = deliveries.map((_, idx) => idx + 1);

        const baseline = constructNearestNeighborRoute(0, stopIndices, matrix.getDistanceKm, matrix.getDurationMin, matrix.points);
        const optimized = optimize2Opt(baseline.tourIndices, matrix.getDistanceKm, matrix.getDurationMin, matrix.points);

        const dBase = baseline.totalDistanceKm;
        const dOpt = optimized.totalDistanceKm;

        // Monotonic Non-Increasing Invariant Assertion: D_opt <= D_base + 1e-6
        const epsilon = 1e-6;
        if (dOpt > dBase + epsilon) {
          violationsCount++;
          console.error(`[INVARIANT VIOLATION] Run ${run} (size=${batchSize}): dOpt=${dOpt} > dBase=${dBase}`);
        }
        expect(dOpt).toBeLessThanOrEqual(dBase + epsilon);

        const deltas = calculateDeltas(baseline, optimized);
        expect(deltas.distanceSavedKm).toBeGreaterThanOrEqual(0);
        expect(deltas.percentDistanceReduction).toBeGreaterThanOrEqual(0);

        if (deltas.distanceSavedKm > 0) {
          improvedCount++;
          totalSavingsSumKm += deltas.distanceSavedKm;
          if (deltas.percentDistanceReduction > maxReductionPercent) {
            maxReductionPercent = deltas.percentDistanceReduction;
          }
        }
      }

      expect(violationsCount).toBe(0);
      console.log(`[TC-ADV-MONO-1] 50 Randomized Runs Complete:
        - Violations: ${violationsCount} (Target: 0)
        - Runs Improved by 2-Opt: ${improvedCount} / ${NUM_RUNS} (${((improvedCount / NUM_RUNS) * 100).toFixed(1)}%)
        - Total Distance Saved: ${totalSavingsSumKm.toFixed(2)} km
        - Max Distance Reduction: ${maxReductionPercent.toFixed(2)}%`);
    });
  });

  // =========================================================================
  // 3. Capacity & Payload Overflow
  // =========================================================================
  describe('3. Capacity & Payload Overflow Boundaries', () => {
    test('TC-ADV-CAP-1: Single oversized consignment exceeding fleet max capacity is segregated into unassignedDeliveries', () => {
      const fleet = [
        {
          _id: 'veh-01',
          vehicleId: 'OD-02-AK-1001',
          capacityKg: 1000,
          fuelType: FUEL_TYPES.ELECTRIC,
          availability: VEHICLE_STATUS.AVAILABLE,
        },
      ];

      const oversizedDelivery = {
        _id: 'del-oversized',
        orderReference: '#DEL-HEAVY-1500KG',
        weightKg: 1500,
        priority: PRIORITY_LEVELS.STANDARD,
      };

      const result = packDeliveries([oversizedDelivery], fleet);

      expect(result.vehicleBins).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(1);
      expect(result.unassignedDeliveries[0].orderReference).toBe('#DEL-HEAVY-1500KG');
      expect(result.unassignedDeliveries[0].reason).toBe('EXCEEDS_VEHICLE_MAX_CAPACITY');
      expect(result.unassignedDeliveries[0].details).toMatch(/exceeds maximum vehicle capacity/i);
    });

    test('TC-ADV-CAP-2: Fleet capacity exhaustion cleanly segregates remaining consignments into unassignedDeliveries', () => {
      // Fleet total capacity = 2 x 150 kg = 300 kg
      const fleet = [
        { _id: 'v1', vehicleId: 'V1-150KG', capacityKg: 150, fuelType: FUEL_TYPES.ELECTRIC },
        { _id: 'v2', vehicleId: 'V2-150KG', capacityKg: 150, fuelType: FUEL_TYPES.DIESEL },
      ];

      // 5 deliveries of 80 kg each = 400 kg total demand
      const deliveries = [
        { _id: 'd1', orderReference: '#DEL-01', weightKg: 80, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#DEL-02', weightKg: 80, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd3', orderReference: '#DEL-03', weightKg: 80, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd4', orderReference: '#DEL-04', weightKg: 80, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd5', orderReference: '#DEL-05', weightKg: 80, priority: PRIORITY_LEVELS.STANDARD },
      ];

      const result = packDeliveries(deliveries, fleet);

      // Each vehicle can fit at most 1 delivery of 80kg (remaining capacity 70kg cannot fit another 80kg)
      // So 2 deliveries assigned (total 160kg <= 300kg), and 3 deliveries overflow
      expect(result.vehicleBins).toHaveLength(2);
      expect(result.vehicleBins[0].deliveries).toHaveLength(1);
      expect(result.vehicleBins[1].deliveries).toHaveLength(1);

      expect(result.unassignedDeliveries).toHaveLength(3);
      for (const unassigned of result.unassignedDeliveries) {
        expect(unassigned.reason).toBe('CAPACITY_OVERFLOW');
        expect(unassigned.details).toMatch(/Aggregate payload exceeded remaining fleet capacity/i);
      }
    });

    test('TC-ADV-CAP-3: Exact capacity boundary (exact fit fits; 0.01 kg overflow rejected)', () => {
      const fleet = [{ _id: 'v1', vehicleId: 'V1-500KG', capacityKg: 500, fuelType: FUEL_TYPES.ELECTRIC }];

      const exactFit = { _id: 'd1', orderReference: '#DEL-EXACT-500', weightKg: 500.0, priority: PRIORITY_LEVELS.STANDARD };
      const microOverflow = { _id: 'd2', orderReference: '#DEL-MICRO-0.01', weightKg: 0.01, priority: PRIORITY_LEVELS.STANDARD };

      const result = packDeliveries([exactFit, microOverflow], fleet);

      expect(result.vehicleBins).toHaveLength(1);
      expect(result.vehicleBins[0].deliveries).toHaveLength(1);
      expect(result.vehicleBins[0].deliveries[0].orderReference).toBe('#DEL-EXACT-500');
      expect(result.vehicleBins[0].remainingCapacityKg).toBe(0);
      expect(result.vehicleBins[0].utilizationPercent).toBe(100);

      expect(result.unassignedDeliveries).toHaveLength(1);
      expect(result.unassignedDeliveries[0].orderReference).toBe('#DEL-MICRO-0.01');
      expect(result.unassignedDeliveries[0].reason).toBe('CAPACITY_OVERFLOW');
    });

    test('TC-ADV-CAP-4: No available fleet vehicles segregates 100% of consignments with NO_AVAILABLE_VEHICLES', () => {
      const deliveries = [
        { _id: 'd1', orderReference: '#DEL-01', weightKg: 10, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#DEL-02', weightKg: 20, priority: PRIORITY_LEVELS.URGENT },
      ];

      const result = packDeliveries(deliveries, []);
      expect(result.vehicleBins).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(2);
      expect(result.unassignedDeliveries[0].reason).toBe('NO_AVAILABLE_VEHICLES');
      expect(result.unassignedDeliveries[1].reason).toBe('NO_AVAILABLE_VEHICLES');
    });
  });

  // =========================================================================
  // 4. EV Preference & Priority Scheduling
  // =========================================================================
  describe('4. EV Preference & Priority Scheduling', () => {
    test('TC-ADV-EV-1: Mixed fleet assignment honors EV preference for canonical fleet (Tata Ace EV vs Mahindra Bolero)', () => {
      const evVehicle = {
        _id: 'tata-ace-ev',
        vehicleId: 'OD-02-AK-1001',
        makeModel: 'Tata Ace EV',
        capacityKg: 1000,
        fuelType: FUEL_TYPES.ELECTRIC,
      };

      const dieselVehicle = {
        _id: 'mahindra-bolero',
        vehicleId: 'OD-02-BL-2002',
        makeModel: 'Mahindra Bolero Maxi Truck',
        capacityKg: 1200,
        fuelType: FUEL_TYPES.DIESEL,
      };

      const delivery = {
        _id: 'd-sample',
        orderReference: '#DEL-SAMPLE-400',
        weightKg: 400,
        priority: PRIORITY_LEVELS.STANDARD,
      };

      // Mixed fleet (Tata Ace EV 1000 kg vs Mahindra Bolero Diesel 1200 kg)
      // When vehicleTypePreference: 'EV', compatible payload (400 kg) must be assigned to EV first
      const evResult = packDeliveries([delivery], [dieselVehicle, evVehicle], { vehicleTypePreference: 'EV' });
      expect(evResult.vehicleBins).toHaveLength(1);
      expect(evResult.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
      expect(evResult.vehicleBins[0].vehicle.vehicleId).toBe('OD-02-AK-1001');
      expect(evResult.unassignedDeliveries).toHaveLength(0);

      // Symmetrically verify vehicleTypePreference: 'ICE'
      const iceResult = packDeliveries([delivery], [evVehicle, dieselVehicle], { vehicleTypePreference: 'ICE' });
      expect(iceResult.vehicleBins).toHaveLength(1);
      expect(iceResult.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.DIESEL);
      expect(iceResult.vehicleBins[0].vehicle.vehicleId).toBe('OD-02-BL-2002');
      expect(iceResult.unassignedDeliveries).toHaveLength(0);
    });

    test('TC-ADV-EV-3: Adversarial Capacity Inversion Challenge — Verifies Tiered BFD honors EV preference even when ICE vehicle has smaller capacity', () => {
      // Inverted capacity scenario:
      // Tata Ace EV has 1000 kg capacity
      // Bajaj Maxima Diesel has 600 kg capacity
      const largerEv = {
        _id: 'tata-ace-ev',
        vehicleId: 'OD-02-AK-1001',
        capacityKg: 1000,
        fuelType: FUEL_TYPES.ELECTRIC,
      };

      const smallerDiesel = {
        _id: 'bajaj-maxima-diesel',
        vehicleId: 'OD-02-DN-4004',
        capacityKg: 600,
        fuelType: FUEL_TYPES.DIESEL,
      };

      const delivery = {
        _id: 'd-small',
        orderReference: '#DEL-200KG',
        weightKg: 200,
        priority: PRIORITY_LEVELS.STANDARD,
      };

      // Empirically challenge: Does vehicleTypePreference: 'EV' protect EV assignment when an ICE vehicle has smaller capacity?
      const res = packDeliveries([delivery], [smallerDiesel, largerEv], { vehicleTypePreference: 'EV' });
      expect(res.vehicleBins).toHaveLength(1);

      const assignedVehicle = res.vehicleBins[0].vehicle;
      const isEvPreferenceHonored = assignedVehicle.fuelType === FUEL_TYPES.ELECTRIC;

      // Log empirical result for adversarial audit report
      console.log(`[TC-ADV-EV-3 Challenge Result] vehicleTypePreference: 'EV' with mixed fleet (EV: 1000kg, ICE: 600kg):
        - Assigned Vehicle: ${assignedVehicle.vehicleId} (${assignedVehicle.fuelType})
        - Preference Honored: ${isEvPreferenceHonored} (Tiered BFD correctly selected preferred EV)`);

      expect(assignedVehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
      expect(assignedVehicle.vehicleId).toBe('OD-02-AK-1001');
      expect(isEvPreferenceHonored).toBe(true);
    });

    test('TC-ADV-EV-4: Tiered BFD falls back to non-preferred tier when preferred tier capacity is exhausted', () => {
      const evVehicle = {
        _id: 'tata-ace-ev',
        vehicleId: 'OD-02-AK-1001',
        capacityKg: 500,
        fuelType: FUEL_TYPES.ELECTRIC,
      };

      const dieselVehicle = {
        _id: 'mahindra-bolero',
        vehicleId: 'OD-02-BL-2002',
        capacityKg: 1000,
        fuelType: FUEL_TYPES.DIESEL,
      };

      const deliveries = [
        { _id: 'd1', orderReference: '#D1-400', weightKg: 400, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd2', orderReference: '#D2-300', weightKg: 300, priority: PRIORITY_LEVELS.STANDARD },
      ];

      // When vehicleTypePreference: 'EV':
      // d1 (400 kg) fits into EV (500 kg, leaving 100 kg).
      // d2 (300 kg) cannot fit into EV (100 kg remaining), so it falls back to Diesel vehicle (1000 kg).
      const res = packDeliveries(deliveries, [dieselVehicle, evVehicle], { vehicleTypePreference: 'EV' });
      expect(res.vehicleBins).toHaveLength(2);
      expect(res.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
      expect(res.vehicleBins[0].deliveries[0]._id).toBe('d1');
      expect(res.vehicleBins[1].vehicle.fuelType).toBe(FUEL_TYPES.DIESEL);
      expect(res.vehicleBins[1].deliveries[0]._id).toBe('d2');
      expect(res.unassignedDeliveries).toHaveLength(0);
    });

    test('TC-ADV-EV-2: Dual propulsion cost & emissions: EV yields 0g CO2/km and lower operating cost than Diesel', () => {
      const distanceKm = 50.0;
      const evVehicle = { fuelType: FUEL_TYPES.ELECTRIC, energyKWhPerKm: 0.18 };
      const dieselVehicle = { fuelType: FUEL_TYPES.DIESEL, kmPerLitre: 12.5 };

      const evCost = scoreRouteCost(distanceKm, evVehicle);
      const dieselCost = scoreRouteCost(distanceKm, dieselVehicle);

      // Assert EV tailpipe emissions are strictly 0.0 g CO2
      expect(evCost.co2Kg).toBe(0.0);
      expect(dieselCost.co2Kg).toBeGreaterThan(0.0);
      expect(dieselCost.co2Kg).toBeCloseTo(50 * 0.21, 2);

      // Financial cost assertion: EV INR cost < Diesel INR cost
      expect(evCost.costInr).toBeLessThan(dieselCost.costInr);
      expect(evCost.costPerKm).toBe(parseFloat((0.18 * RATES.ELECTRICITY_INR_PER_KWH).toFixed(2)));
      expect(dieselCost.costPerKm).toBe(parseFloat(((1 / 12.5) * RATES.DIESEL_INR_PER_LITRE).toFixed(2)));
    });

    test('TC-ADV-PRIO-1: Priority tie-breaking in Nearest Neighbor routes COLD_CHAIN and URGENT earlier', () => {
      // 3 Candidate stops placed at identical distance from depot
      // Points array: Index 0 = Depot, Index 1 = Standard, Index 2 = Urgent, Index 3 = Cold Chain
      const mockPoints = [
        { id: 'DEPOT', type: 'DEPOT' },
        { id: 'del-std', type: 'DELIVERY', delivery: { priority: PRIORITY_LEVELS.STANDARD, orderReference: 'STD' } },
        { id: 'del-urg', type: 'DELIVERY', delivery: { priority: PRIORITY_LEVELS.URGENT, orderReference: 'URG' } },
        { id: 'del-cold', type: 'DELIVERY', delivery: { priority: PRIORITY_LEVELS.COLD_CHAIN, orderReference: 'COLD' } },
      ];

      // Symmetric equidistant mock: all pairwise distances between depot and nodes are exactly 5.0 km
      const mockDistance = (i, j) => {
        if (i === j) return 0;
        return 5.0;
      };
      const mockDuration = () => 10.0;

      const stopIndices = [1, 2, 3];
      const result = constructNearestNeighborRoute(0, stopIndices, mockDistance, mockDuration, mockPoints);

      // Expect Cold Chain (Index 3) visited first from depot, then Urgent (Index 2), then Standard (Index 1)
      expect(result.stopSequence).toEqual([3, 2, 1]);
      expect(result.tourIndices).toEqual([0, 3, 2, 1, 0]);
    });

    test('TC-ADV-PRIO-2: BinPacker prioritizes packing COLD_CHAIN and URGENT consignments before capacity exhausts', () => {
      // Fleet capacity = 100 kg
      const singleVehicleFleet = [{ _id: 'v1', capacityKg: 100, fuelType: FUEL_TYPES.ELECTRIC }];

      // 3 Deliveries of 60 kg each (only 1 can fit)
      const deliveries = [
        { _id: 'd-std', orderReference: 'STD-60KG', weightKg: 60, priority: PRIORITY_LEVELS.STANDARD },
        { _id: 'd-urg', orderReference: 'URG-60KG', weightKg: 60, priority: PRIORITY_LEVELS.URGENT },
        { _id: 'd-cold', orderReference: 'COLD-60KG', weightKg: 60, priority: PRIORITY_LEVELS.COLD_CHAIN },
      ];

      const result = packDeliveries(deliveries, singleVehicleFleet);

      expect(result.vehicleBins).toHaveLength(1);
      expect(result.vehicleBins[0].deliveries).toHaveLength(1);
      // The single accommodated delivery MUST be COLD_CHAIN
      expect(result.vehicleBins[0].deliveries[0].orderReference).toBe('COLD-60KG');

      // The remaining deliveries must be unassigned
      expect(result.unassignedDeliveries).toHaveLength(2);
      const unassignedRefs = result.unassignedDeliveries.map(u => u.orderReference);
      expect(unassignedRefs).toContain('URG-60KG');
      expect(unassignedRefs).toContain('STD-60KG');
    });
  });

  // =========================================================================
  // 5. Large Batch Convergence & Performance (< 1000 iter, < 500 ms)
  // =========================================================================
  describe('5. Large Batch Convergence & Performance (Canonical BBSR-EXP-01)', () => {
    // Generate the canonical 25-stop morning batch BBSR-EXP-01 matching seedBhubaneswar.js
    function generateCanonicalMorningBatch25() {
      const clusters = [
        {
          zone: 'Patia (Z-1)',
          baseLat: 20.354,
          baseLng: 85.817,
          landmarks: ['KIIT Square', 'Infocity Ave', 'DLF Cybercity', 'KIMS Hospital', 'Silicon Hills'],
        },
        {
          zone: 'Jaydev Vihar (Z-2)',
          baseLat: 20.301,
          baseLng: 85.823,
          landmarks: ['Mayfair Lagoon', 'Fortune Tower', 'Pal Heights', 'Nayapalli Market', 'IRC Village'],
        },
        {
          zone: 'Saheed Nagar (Z-3)',
          baseLat: 20.288,
          baseLng: 85.852,
          landmarks: ['Bhawani Mall', 'Maharshi College', 'Angan Square', 'Vanivihar Gate', 'Satya Nagar'],
        },
        {
          zone: 'Khandagiri (Z-4)',
          baseLat: 20.258,
          baseLng: 85.787,
          landmarks: ['Khandagiri Caves', 'Baramunda Terminal', 'Udayagiri Path', 'AMRI Hospital', 'Kolathia Sq'],
        },
        {
          zone: 'Chandrasekharpur',
          baseLat: 20.325,
          baseLng: 85.818,
          landmarks: ['Care Hospital', 'Damana Square', 'Kalarahanga Road', 'Sailashree Vihar', 'Niladri Vihar'],
        },
      ];

      const priorities = [
        PRIORITY_LEVELS.STANDARD,
        PRIORITY_LEVELS.STANDARD,
        PRIORITY_LEVELS.URGENT,
        PRIORITY_LEVELS.COLD_CHAIN,
      ];

      const deliveries = [];
      let count = 1;

      for (const cluster of clusters) {
        for (let i = 0; i < cluster.landmarks.length; i++) {
          const lat = parseFloat((cluster.baseLat + (i * 0.002 - 0.004)).toFixed(5));
          const lng = parseFloat((cluster.baseLng + (i * 0.002 - 0.004)).toFixed(5));
          const weightKg = parseFloat((3.5 + (count % 15)).toFixed(1));
          const priority = priorities[(count - 1) % priorities.length];

          deliveries.push({
            _id: `bbsr-exp-del-${String(count).padStart(3, '0')}`,
            orderReference: `#DEL-BBSR-${String(count).padStart(3, '0')}`,
            customer: { name: `Customer ${count}`, phone: `+91 94370${String(count).padStart(5, '0')}` },
            address: {
              street: `${cluster.landmarks[i]}, Plot ${count * 5}`,
              city: 'Bhubaneswar',
              zone: cluster.zone,
              postalCode: '7510' + String(10 + (count % 15)),
            },
            location: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            weightKg,
            priority,
            serviceDurationMinutes: priority === PRIORITY_LEVELS.COLD_CHAIN ? 15 : 10,
          });

          count++;
          if (deliveries.length === 25) break;
        }
        if (deliveries.length === 25) break;
      }

      return deliveries;
    }

    test('TC-ADV-CONV-1: Canonical 25-stop BBSR-EXP-01 batch terminates in < 1000 iterations and executes in < 500 ms', async () => {
      const canonicalDeliveries = generateCanonicalMorningBatch25();
      expect(canonicalDeliveries).toHaveLength(25);

      const fleet = [
        {
          _id: 'veh-tata-ace-ev',
          vehicleId: 'OD-02-AK-1001',
          makeModel: 'Tata Ace EV',
          capacityKg: 1000,
          fuelType: FUEL_TYPES.ELECTRIC,
          energyKWhPerKm: 0.18,
        },
        {
          _id: 'veh-bolero-diesel',
          vehicleId: 'OD-02-BL-2002',
          makeModel: 'Mahindra Bolero Maxi Truck',
          capacityKg: 1200,
          fuelType: FUEL_TYPES.DIESEL,
          kmPerLitre: 12.5,
        },
      ];

      const startWallClock = performance.now();

      // 1. Bin-Packing Allocation
      const packingResult = packDeliveries(canonicalDeliveries, fleet, { vehicleTypePreference: 'EV' });
      expect(packingResult.unassignedDeliveries).toHaveLength(0);
      expect(packingResult.vehicleBins.length).toBeGreaterThan(0);

      // Primary bin has Tata Ace EV with all 25 deliveries (batch total weight ~250kg < 1000kg)
      const primaryBin = packingResult.vehicleBins[0];
      expect(primaryBin.vehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);

      // 2. Build Matrix
      const matrix = await buildMatrix(CANONICAL_DEPOT, canonicalDeliveries, { trafficScenario: 'MORNING_RUSH' });
      expect(matrix.points).toHaveLength(26);

      const deliveryMap = new Map();
      for (let idx = 1; idx < matrix.points.length; idx++) {
        deliveryMap.set(matrix.points[idx].id, idx);
      }

      const stopIndices = primaryBin.deliveries.map(d => deliveryMap.get(d._id));

      // 3. Nearest-Neighbor Route Construction
      const baseline = constructNearestNeighborRoute(
        0,
        stopIndices,
        matrix.getDistanceKm,
        matrix.getDurationMin,
        matrix.points
      );
      expect(baseline.tourIndices).toHaveLength(27);
      expect(baseline.stopSequence).toHaveLength(25);
      expect(baseline.totalDistanceKm).toBeGreaterThan(0);

      // 4. Bounded 2-Opt Local Search Refinement
      const optResult = optimize2Opt(
        baseline.tourIndices,
        matrix.getDistanceKm,
        matrix.getDurationMin,
        matrix.points,
        { maxIterations: 1000, epsilon: 0.001 }
      );

      const endWallClock = performance.now();
      const executionDurationMs = endWallClock - startWallClock;

      // Iteration bound assertion: iterations < 1000
      expect(optResult.iterations).toBeLessThan(1000);
      expect(optResult.converged).toBe(true);

      // Runtime performance assertion: execution duration < 500 ms
      expect(executionDurationMs).toBeLessThan(500);

      // Invariant assertion: D_optimized <= D_baseline
      expect(optResult.totalDistanceKm).toBeLessThanOrEqual(baseline.totalDistanceKm + 1e-6);

      // 5. Cost Scorer & Deltas
      const baseCost = scoreRouteCost(baseline.totalDistanceKm, primaryBin.vehicle);
      const optCost = scoreRouteCost(optResult.totalDistanceKm, primaryBin.vehicle);
      const deltas = calculateDeltas(
        { ...baseline, costInr: baseCost.costInr, co2Kg: baseCost.co2Kg },
        { ...optResult, costInr: optCost.costInr, co2Kg: optCost.co2Kg }
      );

      expect(deltas.distanceSavedKm).toBeGreaterThanOrEqual(0);
      expect(deltas.costSavedInr).toBeGreaterThanOrEqual(0);
      expect(deltas.co2AvoidedKg).toBe(0.0); // 0g tailpipe for EV
      expect(deltas.percentDistanceReduction).toBeGreaterThanOrEqual(0);

      console.log(`[TC-ADV-CONV-1] Canonical BBSR-EXP-01 (25 stops) Convergence Metrics:
        - Total Execution Duration: ${executionDurationMs.toFixed(2)} ms (Threshold: < 500 ms)
        - 2-Opt Iterations: ${optResult.iterations} (Threshold: < 1000)
        - Converged: ${optResult.converged}
        - Baseline Distance: ${baseline.totalDistanceKm} km
        - Optimized Distance: ${optResult.totalDistanceKm} km
        - Distance Saved: ${deltas.distanceSavedKm} km (${deltas.percentDistanceReduction}%)
        - Vehicle Assigned: ${primaryBin.vehicle.makeModel} (${primaryBin.vehicle.fuelType})
        - Optimized Energy Cost: ₹${optCost.costInr}`);
    });
  });
});
