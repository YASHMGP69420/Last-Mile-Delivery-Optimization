const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const env = require('../src/config/env');
const { ROLES } = require('../src/config/constants');
const { createTestUser } = require('./helpers/testUtils');

describe('JWT Refresh Token Validation, Rotation & Revocation', () => {
  const password = 'Password123!';
  let testUser;
  let adminUser;
  let adminToken;

  beforeEach(async () => {
    const adminRes = await createTestUser(ROLES.ADMIN, 'admin-refresh@smartroute.io');
    adminUser = adminRes.user;
    adminToken = adminRes.token;

    const userRes = await createTestUser(ROLES.FLEET_MANAGER, 'manager-refresh@smartroute.io');
    testUser = userRes.user;
  });

  test('TC-REFRESH-1: Valid login refreshToken mints a new access token and rotates refreshToken', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password });

    expect(loginRes.status).toBe(200);
    const firstRefreshToken = loginRes.body.data.refreshToken;
    expect(firstRefreshToken).toBeTruthy();

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.token).toBeTruthy();
    expect(refreshRes.body.data.refreshToken).toBeTruthy();
    expect(refreshRes.body.data.refreshToken).not.toBe(firstRefreshToken);

    // Verify rotated token is persisted in DB
    const dbUser = await User.findById(testUser._id).select('+refreshToken');
    expect(dbUser.refreshToken).toBe(refreshRes.body.data.refreshToken);
  });

  test('TC-REFRESH-2: Replaying an already-rotated (superseded) refreshToken is rejected with 401', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password });
    const firstRefreshToken = loginRes.body.data.refreshToken;

    // First refresh rotates token
    const refresh1 = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken });
    expect(refresh1.status).toBe(200);

    // Replaying firstRefreshToken must fail
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('TC-REFRESH-3: Refreshing after /auth/logout fails even with unexpired refresh JWT', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password });

    const { token, refreshToken } = loginRes.body.data;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('TC-REFRESH-4: Refreshing after Admin password reset (which clears user.refreshToken = null) is blocked with 401', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password });
    const { refreshToken } = loginRes.body.data;

    // Admin resets password, clearing refreshToken while keeping user.active = true
    const resetRes = await request(app)
      .post(`/api/v1/admin/users/${testUser._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tempPassword: 'NewTempPassword123!' });
    expect(resetRes.status).toBe(200);

    const refreshAfterReset = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshAfterReset.status).toBe(401);
    expect(refreshAfterReset.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('TC-REFRESH-5: Refreshing for suspended or deactivated user is blocked with 401', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password });
    const { refreshToken } = loginRes.body.data;

    await User.findByIdAndUpdate(testUser._id, { active: false, accountStatus: 'SUSPENDED' });

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe('USER_INACTIVE');
  });

  test('TC-REFRESH-6: Missing or forged refreshToken returns 400 / 401', async () => {
    const missingRes = await request(app).post('/api/v1/auth/refresh').send({});
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error.code).toBe('MISSING_REFRESH_TOKEN');

    const forgedToken = jwt.sign({ sub: testUser._id.toString() }, 'wrong_secret_key', {
      expiresIn: '7d',
    });
    const forgedRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: forgedToken });
    expect(forgedRes.status).toBe(401);
    expect(forgedRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');

    // Validly signed refresh JWT that was never stored in DB (e.g. forged with stolen secret or out-of-band)
    const unstoredValidJwt = jwt.sign(
      { sub: testUser._id.toString(), jti: 'unstored-jti' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    const unstoredRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: unstoredValidJwt });
    expect(unstoredRes.status).toBe(401);
    expect(unstoredRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});
