const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createTestUser } = require('./helpers/testUtils');
const bcrypt = require('bcryptjs');

describe('Authentication & RBAC Test Suite (server/tests/auth.test.js)', () => {
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('SmartRoute2026!', 10);
      await User.create({
        name: 'Super Admin',
        email: 'admin@smartroute.internal',
        passwordHash,
        role: 'ADMIN',
        active: true,
      });
    });

    test('TC-AUTH-1: Login with valid credentials returns 200, JWT token, and sanitized user object', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@smartroute.internal',
          password: 'SmartRoute2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user).toMatchObject({
        email: 'admin@smartroute.internal',
        role: 'ADMIN',
      });
      // passwordHash and password must NOT be returned
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('TC-AUTH-2: Login with invalid password returns 401 and INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@smartroute.internal',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.data).toBeUndefined();
    });

    test('TC-AUTH-3: Login with non-existent email returns 401 without account existence leak', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@smartroute.internal',
          password: 'SmartRoute2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('TC-AUTH-4: Login with missing fields returns 400 Bad Request with field validation errors', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email-format',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('JWT Verification & RBAC Authorization Middleware', () => {
    test('TC-AUTH-5: Request to protected route without Authorization header returns 401', async () => {
      const res = await request(app).get('/api/v1/vehicles');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('TC-AUTH-6: Request with malformed or invalid JWT token returns 401', async () => {
      const res = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', 'Bearer this-is-an-invalid-garbage-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('TC-AUTH-7: User provisioning (POST /api/v1/auth/users) allows ADMIN role', async () => {
      const { token: adminToken } = await createTestUser('ADMIN');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Fleet Manager',
          email: 'fleet.manager.new@smartroute.test',
          password: 'Password123!',
          role: 'FLEET_MANAGER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('fleet.manager.new@smartroute.test');
      expect(res.body.data.user.role).toBe('FLEET_MANAGER');
    });

    test('TC-AUTH-8: User provisioning (POST /api/v1/auth/users) rejects FLEET_MANAGER with 403 Forbidden', async () => {
      const { token: managerToken } = await createTestUser('FLEET_MANAGER');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Hacker User',
          email: 'hacker@smartroute.test',
          password: 'Password123!',
          role: 'ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('TC-AUTH-9: User provisioning (POST /api/v1/auth/users) rejects DRIVER with 403 Forbidden', async () => {
      const { token: driverToken } = await createTestUser('DRIVER');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          name: 'Hacker User',
          email: 'hacker@smartroute.test',
          password: 'Password123!',
          role: 'DRIVER',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });
});
