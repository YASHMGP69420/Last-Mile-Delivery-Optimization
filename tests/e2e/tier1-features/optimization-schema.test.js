/**
 * Tier 1 Feature Suite: Route Optimization Engine & Contract Schemas
 * Validates Features 18, 19, 20, 21, 22, 23.
 */

const { constructNearestNeighborRoute } = require('../../../server/src/services/optimization/nearestNeighbor');
const { optimize2Opt } = require('../../../server/src/services/optimization/twoOpt');
const { estimateFuel } = require('../../../server/src/services/optimization/fuelModel');

module.exports = {
  name: 'Route Optimization Engine & API Contracts Feature Suite',
  tier: 1,
  file: 'optimization-schema.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    const points = [
      { id: 'depot', lat: 20.297, lng: 85.863 },
      { id: 'stop-1', lat: 20.354, lng: 85.817, delivery: { priority: 'Standard', serviceDurationMinutes: 10 } },
      { id: 'stop-2', lat: 20.301, lng: 85.823, delivery: { priority: 'Urgent', serviceDurationMinutes: 10 } },
      { id: 'stop-3', lat: 20.288, lng: 85.852, delivery: { priority: 'Cold Chain', serviceDurationMinutes: 15 } },
      { id: 'stop-4', lat: 20.258, lng: 85.787, delivery: { priority: 'Standard', serviceDurationMinutes: 10 } },
    ];

    function getDistance(i, j) {
      const dx = points[i].lat - points[j].lat;
      const dy = points[i].lng - points[j].lng;
      return Math.sqrt(dx * dx + dy * dy) * 111;
    }

    function getDuration(i, j) {
      return getDistance(i, j) * 2.5; // Average speed ~24 km/h -> 2.5 min/km
    }

    it('TC-T1-OPT-1: Nearest-Neighbor heuristic constructs valid complete stop sequence from depot', async () => {
      const stopIndices = [1, 2, 3, 4];
      const result = constructNearestNeighborRoute(0, stopIndices, getDistance, getDuration, points);

      assert.ok(result.tourIndices);
      assert.strictEqual(result.tourIndices[0], 0, 'Tour must start at depot (index 0)');
      assert.strictEqual(result.tourIndices[result.tourIndices.length - 1], 0, 'Tour must end at depot (index 0)');
      assert.strictEqual(result.stopSequence.length, stopIndices.length, 'Every stop must be visited once');
      assert.ok(result.totalDistanceKm > 0);
    });

    it('TC-T1-OPT-2: Bounded 2-Opt local search preserves or improves tour distance', async () => {
      const stopIndices = [1, 2, 3, 4];
      const nnResult = constructNearestNeighborRoute(0, stopIndices, getDistance, getDuration, points);

      const optResult = optimize2Opt(nnResult.tourIndices, getDistance, getDuration, points, { maxIterations: 100 });

      assert.ok(
        optResult.totalDistanceKm <= nnResult.totalDistanceKm + 1e-4,
        `2-Opt distance (${optResult.totalDistanceKm}) must not exceed NN baseline (${nnResult.totalDistanceKm})`
      );
      assert.strictEqual(optResult.stopSequence.length, stopIndices.length);
    });

    it('TC-T1-OPT-3: EV and ICE fuel/energy consumption calculations match physical formulas', async () => {
      // 1. Diesel vehicle
      const iceVehicle = { fuelType: 'ICE', fuelEfficiency: 12.5 }; // 12.5 km/L
      const iceResult = estimateFuel(iceVehicle, 50.0); // 50 km
      assert.strictEqual(iceResult.unit, 'L');
      assert.strictEqual(Number(iceResult.fuelConsumed.toFixed(2)), 4.0); // 50 / 12.5 = 4.0 L

      // 2. Electric vehicle
      const evVehicle = { fuelType: 'EV', energyEfficiency: 0.18 }; // 0.18 kWh/km
      const evResult = estimateFuel(evVehicle, 50.0);
      assert.strictEqual(evResult.unit, 'kWh');
      assert.strictEqual(Number(evResult.fuelConsumed.toFixed(2)), 9.0); // 50 * 0.18 = 9.0 kWh
    });

    it('TC-T1-OPT-4: Route optimization API endpoint contract validation (POST /api/v1/routes/optimize)', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Create a real batch with 2 deliveries and 1 vehicle
      const v = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      const d1 = await harness.models.Delivery.create({
        orderReference: '#DEL-OPT-API-1',
        customer: { name: 'Customer Opt 1', phone: '+91 99370 11111' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 5.0,
        status: 'READY',
        timeWindow: { start: '09:00', end: '12:00' },
      });
      const d2 = await harness.models.Delivery.create({
        orderReference: '#DEL-OPT-API-2',
        customer: { name: 'Customer Opt 2', phone: '+91 99370 22222' },
        address: { street: 'Jaydev Vihar', city: 'Bhubaneswar', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.823, 20.301] },
        weightKg: 7.0,
        status: 'READY',
        timeWindow: { start: '10:00', end: '13:00' },
      });

      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-OPT-BATCH',
        name: 'Optimization Test Batch',
        date: '2026-11-04',
        depot: fixtures.CANONICAL_DEPOT,
        deliveryIds: [d1._id, d2._id],
        vehicleIds: [v._id],
      });
      await harness.models.Delivery.updateMany({ _id: { $in: [d1._id, d2._id] } }, { batchId: batch._id });

      const res = await harness.request
        .post('/api/v1/routes/optimize')
        .set(headers)
        .send({
          batchId: batch._id.toString(),
          vehicleIds: [v._id.toString()],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.baseline);
      assert.ok(res.body.data.optimized);
      assert.ok(Array.isArray(res.body.data.unassignedDeliveries));
      assert.ok(Array.isArray(res.body.data.routes));
    });
  },
};
