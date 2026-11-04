/**
 * Tier 1 Feature Suite: Authentication & Role-Based Access Control (RBAC)
 * Validates Features 1, 2, 3 in isolation.
 */

module.exports = {
  name: 'Authentication & RBAC Feature Suite',
  tier: 1,
  file: 'auth-rbac.test.js',

  async run({ it, beforeEach, harness, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-AUTH-1: Login with valid credentials returns 200, JWT token, and sanitized user payload', async () => {
      const { user } = await harness.createTestUser('ADMIN', 'admin_login_t1@smartroute.test');

      const res = await harness.request
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.token, 'Expected JWT access token in response');
      assert.strictEqual(res.body.data.user.email, user.email);
      assert.strictEqual(res.body.data.user.role, 'ADMIN');
      assert.strictEqual(res.body.data.user.passwordHash, undefined, 'passwordHash must never be leaked');
    });

    it('TC-T1-AUTH-2: Login with invalid password returns 401 with standard error envelope', async () => {
      const { user } = await harness.createTestUser('FLEET_MANAGER', 'manager_login_fail@smartroute.test');

      const res = await harness.request
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'WrongPassword999!' });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error);
      assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('TC-T1-AUTH-3: User provisioning endpoint (POST /api/v1/auth/users) succeeds for ADMIN', async () => {
      const { headers } = await harness.getAuthHeaders('ADMIN');

      const newDriverPayload = {
        name: 'New Test Driver',
        email: `driver_${Date.now()}@smartroute.test`,
        password: 'Password123!',
        role: 'DRIVER',
        phone: '+91 94370 88888',
        licenseNumber: 'OD-02-2026-TEST1',
      };

      const res = await harness.request
        .post('/api/v1/auth/users')
        .set(headers)
        .send(newDriverPayload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.role, 'DRIVER');
      assert.strictEqual(res.body.data.user.email, newDriverPayload.email);
      assert.strictEqual(res.body.data.user.passwordHash, undefined);
    });

    it('TC-T1-AUTH-4: User provisioning endpoint rejects non-admin role (FLEET_MANAGER) with 403 Forbidden', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/auth/users')
        .set(headers)
        .send({
          name: 'Unauthorized User Creation',
          email: 'unauth@smartroute.test',
          password: 'Password123!',
          role: 'DRIVER',
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INSUFFICIENT_PERMISSIONS');
    });

    it('TC-T1-AUTH-5: GET /api/v1/auth/me returns current user identity with valid Bearer token', async () => {
      const { headers, user } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request.get('/api/v1/auth/me').set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.email, user.email);
      assert.strictEqual(res.body.data.user.role, 'FLEET_MANAGER');
      assert.strictEqual(res.body.data.user.passwordHash, undefined);
    });

    it('TC-T1-AUTH-6: POST /api/v1/auth/logout revokes access and invalidates active token', async () => {
      const { headers } = await harness.getAuthHeaders('ADMIN');

      const logoutRes = await harness.request.post('/api/v1/auth/logout').set(headers);
      assert.strictEqual(logoutRes.status, 200);
      assert.strictEqual(logoutRes.body.success, true);

      // Re-requesting with same token should be rejected (token blacklist)
      const followUpRes = await harness.request.get('/api/v1/auth/me').set(headers);
      assert.strictEqual(followUpRes.status, 401);
      assert.strictEqual(followUpRes.body.success, false);
    });
  },
};
