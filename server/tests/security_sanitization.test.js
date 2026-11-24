const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const { sanitizeObject, noSqlSanitizer } = require('../src/middleware/sanitize');
const { sanitizeCsvValue, sanitizeCsvRow } = require('../src/utils/csvSanitizer');
const { processCsvManifest } = require('../src/services/csvImportService');
const { createTestUser, createTestDelivery } = require('./helpers/testUtils');

describe('Security Sanitizer & NoSQL Injection Hardening', () => {
  describe('Security Sanitizer Tracer', () => {
    test('sanitizeObject recursively removes keys starting with $ and containing .', () => {
      const maliciousPayload = {
        username: 'admin',
        password: { $ne: null },
        filter: {
          'profile.role': 'SUPERUSER',
          nested: {
            $gt: 50,
            safeKey: 'safeValue',
          },
        },
        items: [
          { $where: 'sleep(1000)' },
          { valid: true, $invalid: false },
        ],
      };

      const result = sanitizeObject(maliciousPayload);

      expect(result.username).toBe('admin');
      expect(result.password).toEqual({});
      expect(result.filter['profile.role']).toBeUndefined();
      expect(result.filter.nested.$gt).toBeUndefined();
      expect(result.filter.nested.safeKey).toBe('safeValue');
      expect(result.items[0]).toEqual({});
      expect(result.items[1]).toEqual({ valid: true });
    });

    test('sanitizeObject blocks prototype pollution keys (__proto__, constructor, prototype)', () => {
      const payload = {
        name: 'test',
        __proto__: { admin: true },
        constructor: { evil: true },
        prototype: { bad: true },
        nested: {
          __proto__: { hacked: true },
        },
      };

      sanitizeObject(payload);

      expect(payload.__proto__).toBe(Object.prototype);
      expect(Object.prototype.admin).toBeUndefined();
      expect(payload.constructor).toBe(Object);
      expect(payload.prototype).toBeUndefined();
      expect(payload.nested.prototype).toBeUndefined();
    });

    test('noSqlSanitizer middleware sanitizes req.body, req.query, and req.params in place', () => {
      const req = {
        body: {
          code: 'DEL-101',
          $where: 'this.amount > 0',
        },
        query: {
          search: 'active',
          $regex: '.*',
          'dot.key': 'val',
        },
        params: {
          id: '123',
          $operator: 'injection',
        },
      };
      const res = {};
      const next = jest.fn();

      noSqlSanitizer(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ code: 'DEL-101' });
      expect(req.query).toEqual({ search: 'active' });
      expect(req.params).toEqual({ id: '123' });
    });

    test('Express app globally strips NoSQL operators from incoming POST request body', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(noSqlSanitizer);
      testApp.post('/test-sanitize', (req, res) => {
        res.status(200).json({ received: req.body });
      });

      const res = await request(testApp)
        .post('/test-sanitize')
        .send({
          email: 'driver@test.com',
          password: { $ne: 'wrong' },
          'nested.param': 'injected',
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toEqual({
        email: 'driver@test.com',
        password: {},
      });
      expect(res.body.received['nested.param']).toBeUndefined();
    });
  });

  describe('CSV Formula Neutralization (D-01 / SEC-INJECT-01)', () => {
    test('sanitizeCsvValue prepends single quote to spreadsheet formula triggers (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCsvValue('=cmd|"/C calc"!A0')).toBe('\'=cmd|"/C calc"!A0');
      expect(sanitizeCsvValue('+cmd|"/C calc"!A0')).toBe('\'+cmd|"/C calc"!A0');
      expect(sanitizeCsvValue('-cmd|"/C calc"!A0')).toBe('\'-cmd|"/C calc"!A0');
      expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');
      expect(sanitizeCsvValue('\t=calc')).toBe('\'\t=calc');
      expect(sanitizeCsvValue('\r=calc')).toBe('\'\r=calc');
    });

    test('sanitizeCsvValue preserves valid finite numbers (negative coordinates, weights, counts)', () => {
      expect(sanitizeCsvValue('-85.8645')).toBe('-85.8645');
      expect(sanitizeCsvValue('+20.2961')).toBe('+20.2961');
      expect(sanitizeCsvValue('-1.5')).toBe('-1.5');
      expect(sanitizeCsvValue('+10')).toBe('+10');
      expect(sanitizeCsvValue('42')).toBe('42');
      expect(sanitizeCsvValue(25.4)).toBe(25.4);
      expect(sanitizeCsvValue(null)).toBe(null);
      expect(sanitizeCsvValue('')).toBe('');
    });

    test('sanitizeCsvRow escapes formula triggers across object keys and array elements', () => {
      const rowObj = {
        orderReference: '=HYPERLINK("http://attacker.com")',
        customerName: 'Amit Pattnaik',
        weightKg: '-5.2',
        notes: '@DDE("cmd";"calc")',
      };

      const sanitized = sanitizeCsvRow(rowObj);
      expect(sanitized.orderReference).toBe('\'=HYPERLINK("http://attacker.com")');
      expect(sanitized.customerName).toBe('Amit Pattnaik');
      expect(sanitized.weightKg).toBe('-5.2');
      expect(sanitized.notes).toBe('\'@DDE("cmd";"calc")');
    });

    test('CSV import neutralization protects database records from formula injection', async () => {
      const csvInput = [
        'orderReference,customerName,phone,address,postalCode,weightKg,timeWindowStart,timeWindowEnd',
        'ORD-FORMULA-1,=cmd|"/C calc"!A0,9876543210,@Patia Square 123,751024,2.5,09:00,12:00',
      ].join('\n');

      const result = await processCsvManifest(csvInput, { dryRun: true });
      expect(result.validCount).toBe(1);
      const delivery = result.preview[0];
      expect(delivery.customer.name).toBe('\'=cmd|"/C calc"!A0');
      expect(delivery.address.street).toBe('\'@Patia Square 123');
    });

    test('Export batch CSV sanitizes fields before generating CSV manifest', async () => {
      const adminAuth = await createTestUser('ADMIN');
      const del = await createTestDelivery({
        orderReference: 'ORD-EXP-SEC-01',
        customer: {
          name: '=DDE("cmd";"/C calc";"A0")',
          phone: '+919876543210',
        },
        address: {
          street: '+Block 4, Chandrasekharpur',
          zone: 'Chandrasekharpur',
        },
      });

      const batch = new DeliveryBatch({
        code: 'BATCH-SEC-EXP',
        name: 'Batch Security Export',
        date: '2026-11-24',
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [del._id],
      });
      await batch.save();

      const res = await request(app)
        .get(`/api/v1/batches/${batch._id}/export`)
        .set('Authorization', `Bearer ${adminAuth.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('\'=DDE(');
      expect(res.text).toContain('\'+Block 4, Chandrasekharpur');
    });
  });
});
