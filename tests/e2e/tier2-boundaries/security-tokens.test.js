/**
 * Tier 2 Boundary Suite: Security Tokens, Token Lifecycle & BOLA Route Defenses
 * Validates Features 1, 2, 3, 38 security hardening.
 */

const jwt = require('jsonwebtoken');

module.exports = {
  name: 'Security Tokens, JWT Hardening & BOLA Defenses Suite',
  tier: 2,
  file: 'security-tokens.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-SEC-1: Expired JWT token returns 401 TOKEN_EXPIRED', async () => {
      const { user } = await harness.createTestUser('FLEET_MANAGER', 'expired_tok@smartroute.test');

      // Create token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { sub: user._id.toString(), email: user.email, role: user.role },
        harness.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const res = await harness.request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'TOKEN_EXPIRED');
    });

    it('TC-T2-SEC-2: Tampered JWT signature returns 401 INVALID_TOKEN', async () => {
      const { token } = await harness.getAuthHeaders('ADMIN');

      // Tamper signature by flipping characters at the end
      const tamperedToken = token.slice(0, -6) + 'abcdef';

      const res = await harness.request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
    });

    it('TC-T2-SEC-3: Algorithm "none" unsigned token is rejected with 401', async () => {
      // Craft an unencoded header with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'attacker-id', role: 'ADMIN' })).toString('base64url');
      const forgedToken = `${header}.${payload}.`;

      const res = await harness.request
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_TOKEN');
    });

    it('TC-T2-SEC-4: Revoked / blacklisted token is blocked from re-use after logout', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      // 1. Verify token works initially
      const validRes = await harness.request.get('/api/v1/auth/me').set(headers);
      assert.strictEqual(validRes.status, 200);

      // 2. Perform logout
      const logoutRes = await harness.request.post('/api/v1/auth/logout').set(headers);
      assert.strictEqual(logoutRes.status, 200);

      // 3. Subsequent call with blacklisted token must fail with 401 TOKEN_REVOKED
      const blockedRes = await harness.request.get('/api/v1/auth/me').set(headers);
      assert.strictEqual(blockedRes.status, 401);
      assert.strictEqual(blockedRes.body.error.code, 'TOKEN_REVOKED');
    });

    it('TC-T2-SEC-5: BOLA Check: Driver cannot update or complete another driver\'s delivery', async () => {
      const { user: u1, headers: h1 } = await harness.getAuthHeaders('DRIVER', 'bola_d1@smartroute.test');
      const { user: u2, headers: h2 } = await harness.getAuthHeaders('DRIVER', 'bola_d2@smartroute.test');

      const driver1 = await harness.models.Driver.create({
        userId: u1._id,
        licenseNumber: 'OD-02-BOLA-1',
        phone: '+91 94370 77771',
      });

      const driver2 = await harness.models.Driver.create({
        userId: u2._id,
        licenseNumber: 'OD-02-BOLA-2',
        phone: '+91 94370 77772',
      });

      // Delivery assigned specifically to driver 1
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-BOLA-01',
        customer: { name: 'Customer BOLA', phone: '+91 99370 12345' },
        address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 5.0,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driver1._id,
        timeWindow: { start: '09:00', end: '12:00' },
      });

      // Driver 2 attempts to mark driver 1's delivery complete
      const res = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set(h2)
        .send({
          otp: '123456',
          signature: 'sig',
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });
  },
};
