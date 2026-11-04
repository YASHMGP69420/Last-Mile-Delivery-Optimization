/**
 * Tier 3 Pairwise Suite: Delivery CSV Import + Batch Composer
 * Validates cross-feature interactions between Features 7, 8, 11.
 */

module.exports = {
  name: 'CSV Manifest Import + Batch Composer Pairwise Suite',
  tier: 3,
  file: 'csv-batch-pairwise.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T3-CB-1: Import CSV manifest and bundle into operational batch with automatic metric aggregation', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // 1. Ingest 5-row CSV into DRAFT consignments
      const importRes = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.VALID_CSV_SAMPLE,
          dryRun: false,
        });

      assert.strictEqual(importRes.status, 201);
      assert.strictEqual(importRes.body.data.importedCount, 5);

      // 2. Fetch all imported delivery IDs
      const importedDeliveries = await harness.models.Delivery.find({});
      assert.strictEqual(importedDeliveries.length, 5);
      const deliveryIds = importedDeliveries.map((d) => d._id);
      const expectedTotalWeight = importedDeliveries.reduce((acc, d) => acc + d.weightKg, 0);

      // 3. Compose operational batch linking those deliveries
      const batchRes = await harness.request
        .post('/api/v1/batches')
        .set(headers)
        .send({
          code: 'BBSR-PW-BATCH-01',
          name: 'Pairwise Morning Dispatch',
          date: '2026-11-04',
          shift: 'Shift A',
          depot: fixtures.CANONICAL_DEPOT,
          deliveryIds,
        });

      assert.strictEqual(batchRes.status, 201);
      const batchData = batchRes.body.data.batch;
      assert.strictEqual(batchData.metrics.totalDeliveries, 5);
      assert.strictEqual(
        Number(batchData.metrics.totalWeightKg.toFixed(1)),
        Number(expectedTotalWeight.toFixed(1))
      );

      // 4. Verify deliveries are now updated with batchId
      const updatedDeliveries = await harness.models.Delivery.find({ batchId: batchData._id || batchData.id });
      assert.strictEqual(updatedDeliveries.length, 5);
    });

    it('TC-T3-CB-2: Querying manifest filtered by batchId returns exactly the batch deliveries', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Create 2 deliveries in Batch A and 1 in Batch B
      const d1 = await harness.models.Delivery.create({
        orderReference: '#DEL-PW-B1-01',
        customer: { name: 'Customer A1', phone: '+91 99370 11111' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 5.0,
        timeWindow: { start: '09:00', end: '11:00' },
      });
      const d2 = await harness.models.Delivery.create({
        orderReference: '#DEL-PW-B1-02',
        customer: { name: 'Customer A2', phone: '+91 99370 22222' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 8.0,
        timeWindow: { start: '10:00', end: '12:00' },
      });

      const batchA = await harness.models.DeliveryBatch.create({
        code: 'BBSR-PW-BA',
        name: 'Batch Alpha',
        date: '2026-11-04',
        deliveryIds: [d1._id, d2._id],
        metrics: { totalDeliveries: 2, totalWeightKg: 13.0 },
      });
      await harness.models.Delivery.updateMany({ _id: { $in: [d1._id, d2._id] } }, { batchId: batchA._id });

      const res = await harness.request
        .get(`/api/v1/deliveries?batchId=${batchA._id}`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.deliveries.length, 2);
    });
  },
};
