const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const { sanitizeObject, noSqlSanitizer } = require('../src/middleware/sanitize');

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
});
