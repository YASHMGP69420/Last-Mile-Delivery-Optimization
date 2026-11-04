/**
 * Tier 1 Feature Suite: CSV Batch Import & Dry-Run Validation
 * Validates Feature 8 in isolation.
 */

module.exports = {
  name: 'CSV Manifest Batch Ingestion Feature Suite',
  tier: 1,
  file: 'csv-import.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-CSV-1: Dry-run CSV validation (dryRun=true) returns row metrics without DB mutation', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.VALID_CSV_SAMPLE,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.totalRows, 5);
      assert.strictEqual(res.body.data.validRows, 5);
      assert.strictEqual(res.body.data.invalidRows, 0);

      // Verify zero DB rows were persisted
      const count = await harness.models.Delivery.countDocuments({});
      assert.strictEqual(count, 0, 'Dry-run must not persist any documents in the database');
    });

    it('TC-T1-CSV-2: Commit mode (dryRun=false) persists all valid rows in DRAFT status', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.VALID_CSV_SAMPLE,
          dryRun: false,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.importedCount, 5);

      const dbRows = await harness.models.Delivery.find({});
      assert.strictEqual(dbRows.length, 5);
      dbRows.forEach((row) => {
        assert.strictEqual(row.status, 'DRAFT');
        assert.ok(row.orderReference.startsWith('#DEL-TEST-'));
      });
    });

    it('TC-T1-CSV-3: Malformed CSV with non-numeric weight flags row errors with line numbers', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.INVALID_CSVS.nonNumericWeight,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.invalidRows, 1);
      assert.ok(Array.isArray(res.body.data.errors));
      assert.ok(res.body.data.errors.length >= 1);
      assert.strictEqual(res.body.data.errors[0].field, 'weightKg');
    });

    it('TC-T1-CSV-4: Inverted time window in CSV (start >= end) is detected during dry-run', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv')
        .set(headers)
        .send({
          csvContent: fixtures.INVALID_CSVS.invertedTimeWindow,
          dryRun: true,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.invalidRows, 1);
      const windowError = res.body.data.errors.find((e) => e.field === 'timeWindow' || e.field === 'timeWindowEnd');
      assert.ok(windowError, 'Expected time window error to be flagged');
    });

    it('TC-T1-CSV-5: Accepts raw CSV text/csv Content-Type in request body', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries/import-csv?dryRun=false')
        .set(headers)
        .set('Content-Type', 'text/csv')
        .send(fixtures.VALID_CSV_SAMPLE);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.importedCount, 5);
    });
  },
};
