const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Vehicle = require('../src/models/Vehicle');
const { processCsvManifest, validateRow } = require('../src/services/csvImportService');
const { createTestUser, createTestVehicle } = require('./helpers/testUtils');

describe('Adversarial Test Suite: CSV Ingestion, Batch Management & Boundary Conditions', () => {
  let managerToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_test', {
        serverSelectionTimeoutMS: 5000,
      });
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  });

  beforeEach(async () => {
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;
  });

  // =========================================================================
  // 1. MALFORMED CSV FILES & SCHEMA RESILIENCE
  // =========================================================================
  describe('1. Malformed CSV Files & Schema Resilience', () => {
    test('ADV-CSV-1: Header mismatch (unrecognized columns) rejects all rows with field errors', async () => {
      const malformedCsv = `ColumnA,ColumnB,ColumnC,ColumnD
Alpha,Beta,Gamma,Delta
Epsilon,Zeta,Eta,Theta`;

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv?dryRun=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Content-Type', 'text/csv')
        .send(malformedCsv);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.validRows).toBe(0);
      expect(res.body.data.invalidRows).toBeGreaterThan(0);
      expect(res.body.data.errors.length).toBeGreaterThanOrEqual(2);

      // Verify each row reported missing orderReference, customerName, phone, address, and weight
      const row2Errors = res.body.data.errors.filter((e) => e.row === 2);
      const fieldsWithErrors = row2Errors.map((e) => e.field);
      expect(fieldsWithErrors).toContain('orderReference');
      expect(fieldsWithErrors).toContain('customerName');
      expect(fieldsWithErrors).toContain('phone');
      expect(fieldsWithErrors).toContain('address');
      expect(fieldsWithErrors).toContain('weightKg');
    });

    test('ADV-CSV-2: Non-numeric weights ("TEN kg", "abc", null) are caught and flagged', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#ADV-WT-01', customerName: 'Ramesh', phone: '9861000001', address: 'Patia', weightKg: 'TEN kg' },
          { orderReference: '#ADV-WT-02', customerName: 'Suresh', phone: '9861000002', address: 'Khandagiri', weightKg: 'NaN' },
          { orderReference: '#ADV-WT-03', customerName: 'Ganesh', phone: '9861000003', address: 'Saheed Nagar', weightKg: '' },
          { orderReference: '#ADV-WT-04', customerName: 'Dinesh', phone: '9861000004', address: 'Jaydev Vihar', weightKg: '15.5' }, // Valid
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(4);
      expect(res.body.data.validRows).toBe(1);
      const weightErrors = res.body.data.errors.filter((e) => e.field === 'weightKg');
      expect(weightErrors.length).toBe(3);
      expect(weightErrors.map((e) => e.row)).toEqual([2, 3, 4]);
    });

    test('ADV-CSV-3: Missing address triggers rejection; missing coordinates gracefully falls back to canonical hub', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          // Missing street address -> must fail
          { orderReference: '#ADV-ADDR-01', customerName: 'Priya', phone: '9861000010', address: '', latitude: 20.29, longitude: 85.82, weightKg: 5 },
          // Missing coordinates -> must succeed with simulated coordinates
          { orderReference: '#ADV-COORD-02', customerName: 'Kavita', phone: '9861000011', address: 'Baramunda Bus Stand', latitude: '', longitude: '', weightKg: 8 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.validRows).toBe(1);
      expect(res.body.data.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ row: 2, field: 'address' })])
      );

      // Verify the preview for ADV-COORD-02 has fallback coordinates and geocoded: false
      const validPreview = res.body.data.preview.find((p) => p.orderReference === '#ADV-COORD-02');
      expect(validPreview).toBeDefined();
      expect(validPreview.location.geocoded).toBe(false);
      expect(validPreview.location.geocodingSource).toBe('SIMULATED');
      expect(validPreview.location.coordinates).toEqual([85.8645, 20.2961]);
    });

    test('ADV-CSV-4: Empty CSV string returns 400 Bad Request and service handles empty input gracefully', async () => {
      // 1. Missing body completely returns 400 MISSING_CSV_CONTENT
      const resMissing = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(resMissing.status).toBe(400);
      expect(resMissing.body.error.code).toBe('MISSING_CSV_CONTENT');

      // 2. Direct service call on completely empty CSV string returns empty summary cleanly
      const emptyServiceResult = await processCsvManifest('', { dryRun: true });
      expect(emptyServiceResult.totalRows).toBe(0);
      expect(emptyServiceResult.validRows).toBe(0);
      expect(emptyServiceResult.invalidRows).toBe(0);
      expect(emptyServiceResult.errors).toEqual([]);

      // 3. Raw empty text/csv body to endpoint results in HTTP 400 Bad Request
      const resEmptyText = await request(app)
        .post('/api/v1/deliveries/import-csv?dryRun=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Content-Type', 'text/csv')
        .send('');
      expect(resEmptyText.status).toBe(400);
      expect(resEmptyText.body.error.code).toBe('EMPTY_CSV_CONTENT');
      expect(resEmptyText.body.error.message).toMatch(/CSV content cannot be empty/i);

      // 4. Header-only CSV is handled safely returning 0 rows
      const headerOnly = `orderReference,customerName,phone,address,weightKg\n`;
      const resHeaderOnly = await request(app)
        .post('/api/v1/deliveries/import-csv?dryRun=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Content-Type', 'text/csv')
        .send(headerOnly);

      expect(resHeaderOnly.status).toBe(200);
      expect(resHeaderOnly.body.data.totalRows).toBe(0);
      expect(resHeaderOnly.body.data.validRows).toBe(0);
    });

    test('ADV-CSV-5: 500-Row high-volume stress batch performance & precision', async () => {
      const numRows = 500;
      let totalExpectedWeight = 0;
      const rows = [];

      for (let i = 1; i <= numRows; i++) {
        const weight = 2.0 + (i % 20) * 0.5; // weights between 2.0 and 11.5 kg
        totalExpectedWeight += weight;
        rows.push({
          orderReference: `#STRESS-${String(i).padStart(4, '0')}`,
          customerName: `Stress Consignee ${i}`,
          phone: `+91 98610 ${String(i).padStart(5, '0')}`,
          address: `Plot ${i}, Sector 1, Chandrasekharpur`,
          zone: 'Chandrasekharpur',
          weightKg: weight,
          priority: i % 10 === 0 ? 'Urgent' : 'Standard',
          timeWindowStart: '09:00',
          timeWindowEnd: '17:00',
        });
      }

      // Step A: Dry run validation on 500 rows
      const t0 = Date.now();
      const dryRes = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ dryRun: true, rows });
      const dryTime = Date.now() - t0;

      expect(dryRes.status).toBe(200);
      expect(dryRes.body.data.totalRows).toBe(500);
      expect(dryRes.body.data.validRows).toBe(500);
      expect(dryRes.body.data.invalidRows).toBe(0);
      expect(dryTime).toBeLessThan(5000);

      // Verify no records were persisted during dry run
      const countAfterDry = await Delivery.countDocuments({ orderReference: { $regex: /^#STRESS-/ } });
      expect(countAfterDry).toBe(0);

      // Step B: Create a target batch
      const batchRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BATCH-STRESS-500',
          name: '500 Stop Stress Run',
          date: '2026-11-04',
        });
      expect(batchRes.status).toBe(201);
      const batchId = batchRes.body.data.batch.id;

      // Step C: Commit import with batch linkage
      const t1 = Date.now();
      const commitRes = await request(app)
        .post(`/api/v1/deliveries/import-csv?batchId=${batchId}&dryRun=false`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rows, dryRun: false });
      const commitTime = Date.now() - t1;

      expect(commitRes.status).toBe(201);
      expect(commitRes.body.data.importedCount).toBe(500);
      expect(commitTime).toBeLessThan(6000);

      // Verify DB persistence of 500 records
      const countAfterCommit = await Delivery.countDocuments({ batchId });
      expect(countAfterCommit).toBe(500);

      // Verify batch metrics updated correctly
      const updatedBatch = await DeliveryBatch.findById(batchId);
      expect(updatedBatch).not.toBeNull();
      expect(updatedBatch.metrics.totalDeliveries).toBe(500);
      expect(Math.abs(updatedBatch.metrics.totalWeightKg - totalExpectedWeight)).toBeLessThan(0.001);
    }, 15000);

    test('ADV-CSV-6: Numeric data types in string fields (phone, orderReference) are safely coerced without TypeError', async () => {
      // If a client sends numeric phone or numeric orderReference via JSON rows array
      const numericPhonePayload = {
        dryRun: true,
        rows: [
          { orderReference: 10492, customerName: 'Numeric Ref & Phone', phone: 9861012345, address: 'Patia', weightKg: 10 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(numericPhonePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(1);
      expect(res.body.data.validRows).toBe(1);
      expect(res.body.data.invalidRows).toBe(0);
      expect(res.body.data.preview[0].orderReference).toBe('10492');
      expect(res.body.data.preview[0].customer.phone).toBe('9861012345');
    });
  });

  // =========================================================================
  // 2. DRY-RUN INTEGRITY & PERSISTENCE ISOLATION
  // =========================================================================
  describe('2. Dry-Run Integrity & Non-Persistence Proof', () => {
    test('ADV-DRY-1: Dry-run returns validation summary without writing to MongoDB', async () => {
      const initialCount = await Delivery.countDocuments();

      const dryPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#DRY-ISO-01', customerName: 'Anil', phone: '9861011111', address: 'Patia', weightKg: 10 },
          { orderReference: '#DRY-ISO-02', customerName: 'Sunil', phone: '9861022222', address: 'Jaydev Vihar', weightKg: 20 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(dryPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.validCount).toBe(2);

      const finalCount = await Delivery.countDocuments();
      expect(finalCount).toBe(initialCount);
    });

    test('ADV-DRY-2: Commit mode with validation errors aborts atomically without dirty writes', async () => {
      const initialCount = await Delivery.countDocuments();

      const mixedPayload = {
        dryRun: false,
        rows: [
          { orderReference: '#DIRTY-VALID-01', customerName: 'Good Row 1', phone: '9861033333', address: 'Patia', weightKg: 10 },
          { orderReference: '#DIRTY-INVALID-02', customerName: 'Bad Row', phone: '9861044444', address: 'Nayapalli', weightKg: -99 }, // Fatal error
          { orderReference: '#DIRTY-VALID-03', customerName: 'Good Row 2', phone: '9861055555', address: 'Saheed Nagar', weightKg: 15 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(mixedPayload);

      // Must fail with 422
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);

      // Verify that NEITHER valid row was persisted into the DB
      const count = await Delivery.countDocuments({
        orderReference: { $in: ['#DIRTY-VALID-01', '#DIRTY-INVALID-02', '#DIRTY-VALID-03'] },
      });
      expect(count).toBe(0);
      expect(await Delivery.countDocuments()).toBe(initialCount);
    });
  });

  // =========================================================================
  // 3. BATCH CAPACITY & NUMERICAL BOUNDARY CONDITIONS
  // =========================================================================
  describe('3. Batch Capacity & Numerical Boundary Conditions', () => {
    test('ADV-BOUND-1: Exact vehicle capacity (1000.0 / 1000.0 kg) is validated and permitted', async () => {
      const vehicle = await createTestVehicle({
        vehicleId: 'OD-02-EXACT-1000',
        capacityKg: 1000.0,
      });

      // Create 10 deliveries of 100 kg each = exactly 1000.0 kg
      const deliveryIds = [];
      for (let i = 1; i <= 10; i++) {
        const d = await Delivery.create({
          orderReference: `#EXACT-1000-${i}`,
          customer: { name: `Customer ${i}`, phone: '9861099999' },
          address: { street: `Lane ${i}`, city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 100.0,
          timeWindow: { start: '09:00', end: '12:00' },
          status: 'READY',
        });
        deliveryIds.push(d._id);
      }

      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BATCH-EXACT-1000',
          name: 'Exact 1000kg Payload Batch',
          deliveryIds,
          vehicleIds: [vehicle._id],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.batch.metrics.totalDeliveries).toBe(10);
      expect(res.body.data.batch.metrics.totalWeightKg).toBe(1000.0);

      // Verify capacity calculation logic: total <= capacity
      const isOverloaded = res.body.data.batch.metrics.totalWeightKg > vehicle.capacityKg;
      expect(isOverloaded).toBe(false);
      const utilization = (res.body.data.batch.metrics.totalWeightKg / vehicle.capacityKg) * 100;
      expect(utilization).toBe(100);
    });

    test('ADV-BOUND-2: Overflow by 0.1 kg (1000.1 / 1000.0 kg) triggers overload detection', async () => {
      const vehicle = await createTestVehicle({
        vehicleId: 'OD-02-OVERFLOW-1000',
        capacityKg: 1000.0,
      });

      // 10 deliveries of 100 kg + 1 parcel of 0.1 kg = 1000.1 kg
      const deliveryIds = [];
      for (let i = 1; i <= 10; i++) {
        const d = await Delivery.create({
          orderReference: `#OVERFLOW-1000-${i}`,
          customer: { name: `Customer ${i}`, phone: '9861099999' },
          address: { street: `Street ${i}`, city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 100.0,
          timeWindow: { start: '09:00', end: '12:00' },
        });
        deliveryIds.push(d._id);
      }
      const extraParcel = await Delivery.create({
        orderReference: '#OVERFLOW-EXTRA-01',
        customer: { name: 'Extra Parcel', phone: '9861099999' },
        address: { street: 'Corner Shop', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        weightKg: 0.1,
        timeWindow: { start: '09:00', end: '12:00' },
      });
      deliveryIds.push(extraParcel._id);

      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BATCH-OVERFLOW-1000-1',
          name: 'Overflow 1000.1kg Batch',
          deliveryIds,
          vehicleIds: [vehicle._id],
        });

      expect(res.status).toBe(201);
      const totalWeight = res.body.data.batch.metrics.totalWeightKg;
      expect(Math.abs(totalWeight - 1000.1)).toBeLessThan(0.001);

      // Overload check: 1000.1 > 1000.0 MUST be true
      const isOverloaded = totalWeight > vehicle.capacityKg;
      expect(isOverloaded).toBe(true);
      const excess = totalWeight - vehicle.capacityKg;
      expect(Math.abs(excess - 0.1)).toBeLessThan(0.001);
    });

    test('ADV-BOUND-3: Zero-weight packages (0 kg) are rejected across CSV import, REST API, and Mongoose model', async () => {
      // 1. CSV Import with weightKg: 0
      const csvRes = await request(app)
        .post('/api/v1/deliveries/import-csv?dryRun=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          rows: [{ orderReference: '#ZERO-01', customerName: 'Zero Wt', phone: '9861000000', address: 'Patia', weightKg: 0 }],
        });
      expect(csvRes.status).toBe(200);
      expect(csvRes.body.data.validRows).toBe(0);
      expect(csvRes.body.data.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'weightKg', message: expect.stringMatching(/positive/i) })])
      );

      // 2. Direct REST API POST with weightKg: 0
      const apiRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          orderReference: '#ZERO-API-01',
          customer: { name: 'Zero API', phone: '9861000000' },
          address: { street: 'Main Rd', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 0,
        });
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.error.code).toBe('INVALID_WEIGHT');

      // 3. Mongoose Model Validation
      const doc = new Delivery({
        orderReference: '#ZERO-MONGO-01',
        customer: { name: 'Zero Mongoose', phone: '9861000000' },
        address: { street: 'Main Rd', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 0,
        timeWindow: { start: '09:00', end: '10:00' },
      });
      let validationError = null;
      try {
        await doc.validate();
      } catch (err) {
        validationError = err;
      }
      expect(validationError).not.toBeNull();
      expect(validationError.errors.weightKg).toBeDefined();
    });

    test('ADV-BOUND-4: Negative weight packages (-0.1kg, -5kg) are rejected across all entry points', async () => {
      // 1. CSV Import with negative weight
      const csvRes = await request(app)
        .post('/api/v1/deliveries/import-csv?dryRun=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          rows: [{ orderReference: '#NEG-01', customerName: 'Negative Wt', phone: '9861000000', address: 'Patia', weightKg: -5.5 }],
        });
      expect(csvRes.status).toBe(200);
      expect(csvRes.body.data.validRows).toBe(0);
      expect(csvRes.body.data.errors[0].field).toBe('weightKg');

      // 2. Direct REST API POST with negative weight
      const apiRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          orderReference: '#NEG-API-01',
          customer: { name: 'Negative API', phone: '9861000000' },
          address: { street: 'Main Rd', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: -0.1,
        });
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.error.code).toBe('INVALID_WEIGHT');

      // 3. Vehicle with non-positive capacityKg is rejected
      const vehicleDoc = new Vehicle({
        vehicleId: 'OD-02-NEG-VEH',
        makeModel: 'Tata Ace',
        type: 'Van',
        capacityKg: -50,
        fuelType: 'Diesel',
        kmPerLitre: 12.0,
      });
      let vehicleError = null;
      try {
        await vehicleDoc.validate();
      } catch (err) {
        vehicleError = err;
      }
      expect(vehicleError).not.toBeNull();
      expect(vehicleError.errors.capacityKg).toBeDefined();
    });
  });

  // =========================================================================
  // 4. DUPLICATE ORDER REFERENCES & INTEGRITY DEFENSES
  // =========================================================================
  describe('4. Duplicate Order References & Collision Defenses', () => {
    test('ADV-DUP-1: Intra-file duplicate order references in CSV are rejected', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#DUP-INTRA-01', customerName: 'First Occurrence', phone: '9861011111', address: 'Patia', weightKg: 10 },
          { orderReference: '#DUP-INTRA-02', customerName: 'Different Ref', phone: '9861022222', address: 'Saheed Nagar', weightKg: 12 },
          { orderReference: '#DUP-INTRA-01', customerName: 'Second Occurrence', phone: '9861033333', address: 'Khandagiri', weightKg: 15 }, // DUPLICATE
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(3);
      expect(res.body.data.validRows).toBe(2);
      expect(res.body.data.invalidRows).toBe(1);

      const dupError = res.body.data.errors.find((e) => e.field === 'orderReference');
      expect(dupError).toBeDefined();
      expect(dupError.row).toBe(4); // 1-based index + 1 for header
      expect(dupError.message).toMatch(/duplicate order reference/i);
    });

    test('ADV-DUP-2: Case-insensitive intra-file duplicate references (#dup-case-01 vs #DUP-CASE-01) are caught', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#dup-case-01', customerName: 'Lower case', phone: '9861011111', address: 'Patia', weightKg: 10 },
          { orderReference: '#DUP-CASE-01', customerName: 'Upper case', phone: '9861022222', address: 'Patia', weightKg: 10 },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.validRows).toBe(1);
      expect(res.body.data.invalidRows).toBe(1);
      expect(res.body.data.errors[0].message).toMatch(/duplicate order reference/i);
    });

    test('ADV-DUP-3: Cross-system collision: CSV containing pre-existing database orderReference is flagged and rejected on commit', async () => {
      // Pre-seed an active consignment in MongoDB
      await Delivery.create({
        orderReference: '#PRE-EXISTING-99',
        customer: { name: 'Existing Consignee', phone: '9861000099' },
        address: { street: 'Secretariat Rd', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751001' },
        weightKg: 25.0,
        timeWindow: { start: '09:00', end: '11:00' },
      });

      // Attempt to import CSV that re-uses #PRE-EXISTING-99
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#PRE-EXISTING-99', customerName: 'Collision Consignee', phone: '9861088888', address: 'Janpath', weightKg: 12 },
          { orderReference: '#BRAND-NEW-01', customerName: 'Brand New', phone: '9861077777', address: 'Unit 9', weightKg: 14 },
        ],
      };

      // In dry run: detected
      const dryRes = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(dryRes.status).toBe(200);
      expect(dryRes.body.data.validRows).toBe(1);
      expect(dryRes.body.data.invalidRows).toBe(1);
      expect(dryRes.body.data.errors[0].message).toMatch(/already exists in database/i);

      // In commit mode: rejected with 422
      const commitRes = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          dryRun: false,
          rows: csvPayload.rows,
        });

      expect(commitRes.status).toBe(422);
      expect(commitRes.body.success).toBe(false);

      // Verify '#BRAND-NEW-01' was not inserted due to transaction rollback/pre-validation
      const brandNewCheck = await Delivery.findOne({ orderReference: '#BRAND-NEW-01' });
      expect(brandNewCheck).toBeNull();
    });

    test('ADV-DUP-4: Direct REST API POST /api/v1/deliveries with duplicate reference returns 409 Conflict', async () => {
      const payload = {
        orderReference: '#API-DUP-CHECK',
        customer: { name: 'First Creator', phone: '9861011111' },
        address: { street: 'Sailashree Vihar', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751021' },
        weightKg: 10.0,
        timeWindow: { start: '09:00', end: '12:00' },
      };

      const res1 = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);
      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('DUPLICATE_KEY_CONFLICT');
    });
  });
});
