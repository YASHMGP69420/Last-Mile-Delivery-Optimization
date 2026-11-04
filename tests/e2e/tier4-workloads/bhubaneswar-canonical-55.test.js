/**
 * Tier 4 Workload Suite: Canonical Bhubaneswar 55-Consignment Operational Scenario
 * Validates Feature 14, 15, 16 in a realistic production-scale operational scenario.
 */

const seedBhubaneswar = require('../../../server/src/seed/seedBhubaneswar');

module.exports = {
  name: 'Canonical Bhubaneswar 55-Consignment Operational Scenario',
  tier: 4,
  file: 'bhubaneswar-canonical-55.test.js',

  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    afterEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T4-BBSR-1: Canonical seed executes cleanly and creates 55 deliveries across 5 clusters', async () => {
      const seedResult = await seedBhubaneswar();

      assert.strictEqual(seedResult.deliveriesCount, 55);

      const totalDeliveries = await harness.models.Delivery.countDocuments({});
      assert.strictEqual(totalDeliveries, 55);

      // Verify 5 clusters with 11 deliveries each
      const expectedClusters = [
        'Patia (Z-1)',
        'Jaydev Vihar (Z-2)',
        'Saheed Nagar (Z-3)',
        'Khandagiri (Z-4)',
        'Chandrasekharpur',
      ];

      for (const zone of expectedClusters) {
        const count = await harness.models.Delivery.countDocuments({ 'address.zone': zone });
        assert.strictEqual(count, 11, `Cluster ${zone} must contain exactly 11 delivery stops`);
      }
    });

    it('TC-T4-BBSR-2: Geographic coordinate bounding box and geocoding integrity check for Bhubaneswar', async () => {
      await seedBhubaneswar();

      const deliveries = await harness.models.Delivery.find({});

      // Bhubaneswar bounding box roughly: Lat [20.20, 20.45], Lng [85.70, 85.95]
      for (const d of deliveries) {
        const [lng, lat] = d.location.coordinates;
        assert.ok(
          lat >= 20.20 && lat <= 20.45,
          `Delivery ${d.orderReference} latitude (${lat}) out of Bhubaneswar bounds [20.20, 20.45]`
        );
        assert.ok(
          lng >= 85.70 && lng <= 85.95,
          `Delivery ${d.orderReference} longitude (${lng}) out of Bhubaneswar bounds [85.70, 85.95]`
        );
        assert.strictEqual(d.location.geocoded, true);
        assert.ok(d.location.geocodingConfidence >= 0.8);
      }
    });

    it('TC-T4-BBSR-3: Morning express batch (BBSR-EXP-01) aggregates initial 25 deliveries and metrics', async () => {
      await seedBhubaneswar();

      const batch = await harness.models.DeliveryBatch.findOne({ code: 'BBSR-EXP-01' });
      assert.ok(batch, 'Morning operational batch BBSR-EXP-01 must exist');
      assert.strictEqual(batch.deliveryIds.length, 25);
      assert.strictEqual(batch.metrics.totalDeliveries, 25);
      assert.ok(batch.metrics.totalWeightKg > 0);

      // Verify Rasulgarh central depot
      assert.strictEqual(batch.depot.name, 'Rasulgarh Logistics Hub');
      assert.strictEqual(Number(batch.depot.geo.lat.toFixed(3)), 20.296);
      assert.strictEqual(Number(batch.depot.geo.lng.toFixed(3)), 85.865);
    });
  },
};
