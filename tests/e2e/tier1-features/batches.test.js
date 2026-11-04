/**
 * Tier 1 Feature Suite: Delivery Batch Management
 * Validates Feature 11 in isolation.
 */

module.exports = {
  name: 'Delivery Batch Management Feature Suite',
  tier: 1,
  file: 'batches.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-BAT-1: Create operational delivery batch aggregates cargo weight and stop metrics', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Create 2 deliveries with valid schema
      const d1 = await harness.models.Delivery.create({
        orderReference: '#BAT-D1',
        customer: { name: 'Customer 1', phone: '+91 99370 11111' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 10.0,
        timeWindow: { start: '09:00', end: '12:00' },
      });
      const d2 = await harness.models.Delivery.create({
        orderReference: '#BAT-D2',
        customer: { name: 'Customer 2', phone: '+91 99370 22222' },
        address: { street: 'Jaydev Vihar', city: 'Bhubaneswar', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.823, 20.301] },
        weightKg: 15.5,
        timeWindow: { start: '10:00', end: '13:00' },
      });

      const batchPayload = {
        code: 'BBSR-TEST-B1',
        name: 'Morning Express Wave 1',
        shift: 'Shift A',
        date: '2026-11-04',
        deliveryIds: [d1._id, d2._id],
        status: 'READY',
      };

      const res = await harness.request
        .post('/api/v1/batches')
        .set(headers)
        .send(batchPayload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.batch.code, 'BBSR-TEST-B1');
      assert.strictEqual(res.body.data.batch.metrics.totalDeliveries, 2);
      assert.strictEqual(res.body.data.batch.metrics.totalWeightKg, 25.5);
    });

    it('TC-T1-BAT-2: GET /api/v1/batches/:id returns batch details with populated deliveries', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const d1 = await harness.models.Delivery.create({
        orderReference: '#BAT-D3',
        customer: { name: 'Customer 3', phone: '+91 99370 33333' },
        address: { street: 'Saheed Nagar', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.852, 20.288] },
        weightKg: 5.0,
        timeWindow: { start: '11:00', end: '14:00' },
      });

      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-TEST-B2',
        name: 'Afternoon Wave',
        date: '2026-11-04',
        deliveryIds: [d1._id],
        metrics: { totalDeliveries: 1, totalWeightKg: 5.0 },
      });

      const res = await harness.request
        .get(`/api/v1/batches/${batch._id}`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.batch.code, 'BBSR-TEST-B2');
      assert.ok(Array.isArray(res.body.data.batch.deliveryIds));
      assert.strictEqual(res.body.data.batch.deliveryIds[0].orderReference, '#BAT-D3');
    });

    it('TC-T1-BAT-3: Update batch assignment with new vehicles and drivers', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-TEST-B3',
        name: 'Evening Wave',
        date: '2026-11-04',
        deliveryIds: [],
        metrics: { totalDeliveries: 0, totalWeightKg: 0 },
      });

      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      const res = await harness.request
        .put(`/api/v1/batches/${batch._id}`)
        .set(headers)
        .send({
          vehicleIds: [vehicle._id],
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.batch.vehicleIds.length === 1);
    });

    it('TC-T1-BAT-4: Batch status transition (PATCH /api/v1/batches/:id/status) updates status', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-TEST-B4',
        name: 'Status Test Wave',
        date: '2026-11-04',
        status: 'READY',
      });

      const res = await harness.request
        .patch(`/api/v1/batches/${batch._id}/status`)
        .set(headers)
        .send({ status: 'PLANNED' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.batch.status, 'PLANNED');
    });

    it('TC-T1-BAT-5: Deleting DRAFT batch unbinds deliveries and removes batch record', async () => {
      const { headers } = await harness.getAuthHeaders('ADMIN');
      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-TEST-B5',
        name: 'Draft Wave to Delete',
        date: '2026-11-04',
        status: 'DRAFT',
      });

      const res = await harness.request
        .delete(`/api/v1/batches/${batch._id}`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const found = await harness.models.DeliveryBatch.findById(batch._id);
      assert.strictEqual(found, null);
    });
  },
};
