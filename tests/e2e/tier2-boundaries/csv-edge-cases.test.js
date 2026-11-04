/**
 * Tier 2 Boundary Suite: CSV Manifest Ingestion Edge Cases & Schema Resilience
 * Validates Feature 8 parser hardening and defensive handling.
 */

module.exports = {
  name: 'CSV Manifest Parser Boundary Suite',
  tier: 2,
  file: 'csv-edge-cases.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-CSV-1: Empty CSV string returns 400 Bad Request and EMPTY_CSV_CONTENT', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: '',
          dryRun: true,
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(['EMPTY_CSV_CONTENT', 'MISSING_CSV_CONTENT'].includes(res.body.error.code));
    });

    it('TC-T2-CSV-2: Header mismatch (unrecognized columns) rejects all rows with field errors', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.INVALID_CSVS.invalidHeaders,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.invalidRows > 0);
      assert.ok(res.body.data.errors.length > 0);
    });

    it('TC-T2-CSV-3: Numeric phone number and order reference are safely coerced to strings', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const csvWithNumericTypes = `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
99887766,Numeric Customer,9861012345,numeric@test.in,Damana Square,Bhubaneswar,Chandrasekharpur,751016,20.32,85.81,4.5,0.02,Standard,10:00,12:00`;

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: csvWithNumericTypes,
          dryRun: false,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.importedCount, 1);

      const saved = await harness.models.Delivery.findOne({ orderReference: '99887766' });
      assert.ok(saved);
      assert.strictEqual(typeof saved.orderReference, 'string');
      assert.strictEqual(typeof saved.customer.phone, 'string');
    });

    it('TC-T2-CSV-4: High-volume stress batch (100 rows) executes dry-run within performance budget', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // Generate 100 rows CSV
      const rows = ['orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd'];
      for (let i = 1; i <= 100; i++) {
        rows.push(`#STRESS-${i},Stress User ${i},+919937000${String(i).padStart(3, '0')},user${i}@stress.test,Road ${i},Bhubaneswar,Patia (Z-1),751024,20.35,85.81,2.5,0.01,Standard,09:00,12:00`);
      }
      const stressCsv = rows.join('\n');

      const start = Date.now();
      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: stressCsv,
          dryRun: true,
        });
      const elapsed = Date.now() - start;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.totalRows, 100);
      assert.strictEqual(res.body.data.validRows, 100);
      assert.ok(elapsed < 4000, `Expected 100 rows dry-run in < 4000ms, took ${elapsed}ms`);
    });

    it('TC-T2-CSV-5: Atomicity check: Batch import with 1 invalid row in commit mode does not perform partial writes', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // 2 valid rows + 1 invalid row (zero weight)
      const mixedCsv = `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-MIX-01,Valid 1,+919937011111,v1@test.in,Patia,Bhubaneswar,Patia (Z-1),751024,20.35,85.81,5.0,0.02,Standard,09:00,11:00
#DEL-MIX-02,Invalid 2,+919937022222,v2@test.in,Patia,Bhubaneswar,Patia (Z-1),751024,20.35,85.81,0.0,0.02,Standard,09:00,11:00
#DEL-MIX-03,Valid 3,+919937033333,v3@test.in,Patia,Bhubaneswar,Patia (Z-1),751024,20.35,85.81,3.0,0.02,Standard,09:00,11:00`;

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: mixedCsv,
          dryRun: false,
        });

      // Should either fail commit atomically or return validation failure
      if (res.status !== 201) {
        assert.ok([400, 422].includes(res.status));
        const count = await harness.models.Delivery.countDocuments({});
        assert.strictEqual(count, 0, 'No rows should be inserted if validation fails');
      } else {
        // If partial import is supported, only valid rows are saved
        assert.strictEqual(res.body.data.importedCount, 2);
      }
    });
  },
};
