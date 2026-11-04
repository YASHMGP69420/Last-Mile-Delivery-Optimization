/**
 * Tier 3 Pairwise Suite: Delivery Batch + Route Optimization Engine
 * Validates cross-feature interactions between Features 11, 18, 20, 21, 23.
 */

const { constructNearestNeighborRoute } = require('../../../server/src/services/optimization/nearestNeighbor');
const { optimize2Opt } = require('../../../server/src/services/optimization/twoOpt');
const { estimateFuel } = require('../../../server/src/services/optimization/fuelModel');

module.exports = {
  name: 'Batch + Route Optimizer Pairwise Suite',
  tier: 3,
  file: 'batch-optimization-pairwise.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T3-BO-1: Batch stops processed through complete optimization heuristic pipeline', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Create 6 deliveries across Bhubaneswar
      const clusterStops = [
        { ref: '#DEL-PW-O1', lat: 20.354, lng: 85.817, wt: 12.0 },
        { ref: '#DEL-PW-O2', lat: 20.358, lng: 85.819, wt: 8.5 },
        { ref: '#DEL-PW-O3', lat: 20.301, lng: 85.823, wt: 15.0 },
        { ref: '#DEL-PW-O4', lat: 20.305, lng: 85.825, wt: 6.0 },
        { ref: '#DEL-PW-O5', lat: 20.288, lng: 85.852, wt: 14.0 },
        { ref: '#DEL-PW-O6', lat: 20.285, lng: 85.850, wt: 9.0 },
      ];

      const deliveryDocs = [];
      for (const s of clusterStops) {
        const d = await harness.models.Delivery.create({
          orderReference: s.ref,
          customer: { name: 'Customer Opt', phone: '+91 99370 12345' },
          address: { street: 'Bhubaneswar St', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          location: { type: 'Point', coordinates: [s.lng, s.lat] },
          weightKg: s.wt,
          timeWindow: { start: '09:00', end: '13:00' },
        });
        deliveryDocs.push(d);
      }

      const depot = { lat: fixtures.CANONICAL_DEPOT.location.coordinates[1], lng: fixtures.CANONICAL_DEPOT.location.coordinates[0] };
      const points = [
        { id: 'depot', lat: depot.lat, lng: depot.lng },
        ...deliveryDocs.map((d) => ({
          id: d._id.toString(),
          lat: d.location.coordinates[1],
          lng: d.location.coordinates[0],
          delivery: d,
        })),
      ];

      function getDistance(i, j) {
        const dx = points[i].lat - points[j].lat;
        const dy = points[i].lng - points[j].lng;
        return Math.sqrt(dx * dx + dy * dy) * 111;
      }

      function getDuration(i, j) {
        return getDistance(i, j) * 2.5;
      }

      const stopIndices = [1, 2, 3, 4, 5, 6];

      // 1. Run Nearest-Neighbor baseline
      const nnResult = constructNearestNeighborRoute(0, stopIndices, getDistance, getDuration, points);
      assert.strictEqual(nnResult.stopSequence.length, 6);

      // 2. Run 2-Opt optimization
      const optResult = optimize2Opt(nnResult.tourIndices, getDistance, getDuration, points);
      assert.strictEqual(optResult.stopSequence.length, 6);

      assert.ok(
        optResult.totalDistanceKm <= nnResult.totalDistanceKm + 1e-4,
        'Optimized distance must be <= baseline'
      );

      // 3. Calculate energy for Tata Ace EV vs Mahindra Bolero Diesel
      const evFuel = estimateFuel({ fuelType: 'EV', energyEfficiency: 0.18 }, optResult.totalDistanceKm);
      const iceFuel = estimateFuel({ fuelType: 'ICE', fuelEfficiency: 12.5 }, optResult.totalDistanceKm);

      assert.strictEqual(evFuel.unit, 'kWh');
      assert.strictEqual(iceFuel.unit, 'L');
      assert.ok(evFuel.fuelConsumed > 0);
      assert.ok(iceFuel.fuelConsumed > 0);
    });

    it('TC-T3-BO-2: POST /api/v1/routes/optimize returns valid route optimization response', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const v = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      const d = await harness.models.Delivery.create({
        orderReference: '#DEL-PW-OPT-2',
        customer: { name: 'Customer Opt 2', phone: '+91 99370 12345' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 5.0,
        status: 'READY',
        timeWindow: { start: '09:00', end: '12:00' },
      });

      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-PW-OPT-B',
        name: 'Batch Opt Test',
        date: '2026-11-04',
        depot: fixtures.CANONICAL_DEPOT,
        deliveryIds: [d._id],
        vehicleIds: [v._id],
      });
      await harness.models.Delivery.updateMany({ _id: d._id }, { batchId: batch._id });

      const res = await harness.request
        .post('/api/v1/routes/optimize')
        .set(headers)
        .send({
          batchId: batch._id.toString(),
          vehicleIds: [v._id.toString()],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.optimized);
      assert.ok(Array.isArray(res.body.data.routes));
    });
  },
};
