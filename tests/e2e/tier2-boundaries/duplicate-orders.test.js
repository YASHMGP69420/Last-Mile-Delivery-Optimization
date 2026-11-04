/**
 * Tier 2 Boundary Suite: Duplicate Order References & ID Collision Defenses
 * Validates Feature 7 & 8 collision rejection.
 */

module.exports = {
  name: 'Duplicate Order Reference Collision Defenses Suite',
  tier: 2,
  file: 'duplicate-orders.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-DUP-1: Intra-file duplicate order references in CSV are rejected during dry-run', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.INVALID_CSVS.intraFileDuplicates,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.invalidRows >= 1);
      const dupError = res.body.data.errors.find((e) => e.field === 'orderReference' || e.message.toLowerCase().includes('duplicate'));
      assert.ok(dupError, 'Expected duplicate order reference error to be flagged');
    });

    it('TC-T2-DUP-2: Case-insensitive intra-file duplicate references (#case-dup-01 vs #CASE-DUP-01) are caught', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.INVALID_CSVS.caseInsensitiveDuplicates,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.invalidRows >= 1);
      const dupError = res.body.data.errors.find((e) => e.field === 'orderReference' || e.message.toLowerCase().includes('duplicate'));
      assert.ok(dupError, 'Case-insensitive collision must be detected');
    });

    it('TC-T2-DUP-3: Cross-system collision: CSV containing pre-existing database orderReference is flagged', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Pre-seed an order in the database
      await harness.models.Delivery.create({
        orderReference: '#DEL-EXISTING-01',
        customer: { name: 'Existing Customer', phone: '+91 99370 12345' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 5.0,
        timeWindow: { start: '09:00', end: '11:00' },
      });

      const collidingCsv = `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-EXISTING-01,Colliding Customer,+919937099999,col@test.in,Patia,Bhubaneswar,Patia (Z-1),751024,20.35,85.81,4.0,0.02,Standard,10:00,12:00`;

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: collidingCsv,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.invalidRows, 1);
      const err = res.body.data.errors.find((e) => e.field === 'orderReference' || e.message.toLowerCase().includes('already exists') || e.message.toLowerCase().includes('duplicate'));
      assert.ok(err, 'Expected pre-existing database order collision to be caught');
    });

    it('TC-T2-DUP-4: Direct REST API POST /api/v1/deliveries with duplicate reference returns 409 Conflict', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const deliveryData = {
        orderReference: '#DEL-DUP-REST',
        customer: { name: 'Original', phone: '+91 99370 12345' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 5.0,
        timeWindow: { start: '09:00', end: '11:00' },
      };

      // 1. First creation succeeds
      const res1 = await harness.request.post('/api/v1/deliveries').set(headers).send(deliveryData);
      assert.strictEqual(res1.status, 201);

      // 2. Duplicate creation returns 409
      const res2 = await harness.request.post('/api/v1/deliveries').set(headers).send(deliveryData);
      assert.strictEqual(res2.status, 409);
      assert.strictEqual(res2.body.success, false);
      assert.strictEqual(res2.body.error.code, 'DUPLICATE_KEY_CONFLICT');
    });
  },
};
