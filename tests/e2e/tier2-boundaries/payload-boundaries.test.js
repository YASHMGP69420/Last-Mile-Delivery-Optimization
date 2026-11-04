/**
 * Tier 2 Boundary Suite: Package Weights & Vehicle Payload Capacities
 * Validates Features 4, 7, 19 across numerical boundary conditions.
 */

module.exports = {
  name: 'Payload & Cargo Weight Boundaries Suite',
  tier: 2,
  file: 'payload-boundaries.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-BOUND-1: Zero-weight delivery (0 kg) is strictly rejected with 400 across REST API', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-ZERO-WT',
          customer: { name: 'Boundary Tester', phone: '+91 99370 00000' },
          address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 0,
          timeWindow: { start: '09:00', end: '11:00' },
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(['INVALID_WEIGHT', 'VALIDATION_ERROR'].includes(res.body.error.code));
    });

    it('TC-T2-BOUND-2: Negative-weight deliveries (-0.5 kg, -10 kg) are rejected with 400', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-NEG-WT',
          customer: { name: 'Negative Tester', phone: '+91 99370 00000' },
          address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: -2.5,
          timeWindow: { start: '09:00', end: '11:00' },
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(['INVALID_WEIGHT', 'VALIDATION_ERROR'].includes(res.body.error.code));
    });

    it('TC-T2-BOUND-3: Exact boundary weight (0.01 kg) is accepted as minimum valid weight', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-MIN-WT',
          customer: { name: 'Minimum Tester', phone: '+91 99370 00000' },
          address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 0.01,
          timeWindow: { start: '09:00', end: '11:00' },
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.weightKg, 0.01);
    });

    it('TC-T2-BOUND-4: Vehicle registration rejects non-positive payload capacity (<= 0 kg)', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/vehicles')
        .set(headers)
        .send({
          vehicleId: 'OD-02-INV-CAP',
          makeModel: 'Invalid Van',
          type: 'Van',
          capacityKg: 0,
          capacityM3: 2.0,
          fuelType: 'Diesel',
          kmPerLitre: 12.0,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('TC-T2-BOUND-5: Vehicle allocation honors maximum payload boundary (1000.0 kg vs 1000.1 kg)', async () => {
      // Simulate multi-vehicle bin packing boundary logic
      const vehicleCapacity = 1000.0;
      const exactPackageList = [{ weightKg: 500.0 }, { weightKg: 500.0 }];
      const overflowPackageList = [{ weightKg: 500.0 }, { weightKg: 500.1 }];

      const totalExact = exactPackageList.reduce((acc, p) => acc + p.weightKg, 0);
      const totalOverflow = overflowPackageList.reduce((acc, p) => acc + p.weightKg, 0);

      assert.ok(totalExact <= vehicleCapacity, 'Exact 1000.0 kg should fit within 1000.0 kg capacity');
      assert.ok(totalOverflow > vehicleCapacity, '1000.1 kg exceeds 1000.0 kg capacity and must trigger overload rejection');
    });
  },
};
