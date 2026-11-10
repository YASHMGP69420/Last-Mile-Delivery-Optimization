const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const OtpToken = require('../src/models/OtpToken');
const googleAuthService = require('../src/services/googleAuthService');
const { ROLES } = require('../src/config/constants');
const { createTestUser } = require('./helpers/testUtils');

describe('OTP Verification & Real Google Auth Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('OTP-Verified Driver Registration (Email & Phone)', () => {
    test('TC-OTP-1: Registration without OTP proof is rejected before creating User or Driver', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Unverified Driver',
          email: 'unverified@smartroute.io',
          phone: '9876543210',
          licenseNumber: 'OD02-DRV-9001',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_VERIFICATION_REQUIRED');
      expect(await User.findOne({ email: 'unverified@smartroute.io' })).toBeNull();
      expect(await Driver.findOne({ licenseNumber: 'OD02-DRV-9001' })).toBeNull();
    });

    test('TC-OTP-2: Passwordless Email OTP registration verifies OTP, creates User & Driver, and mints JWT + refreshToken', async () => {
      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'driver.emailotp@smartroute.io', purpose: 'REGISTER' });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.channel).toBe('EMAIL');
      expect(sendRes.body.data.devPreviewCode).toMatch(/^\d{6}$/);

      // Ensure OtpToken stores hashed code rather than plaintext
      const storedToken = await OtpToken.findOne({ target: 'driver.emailotp@smartroute.io' });
      expect(storedToken).toBeTruthy();
      expect(storedToken.codeHash).not.toBe(sendRes.body.data.devPreviewCode);

      const verifyRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          identifier: 'driver.emailotp@smartroute.io',
          purpose: 'REGISTER',
          code: sendRes.body.data.devPreviewCode,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.verified).toBe(true);
      expect(verifyRes.body.data.verificationToken).toBeTruthy();

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Arjun Rout',
          email: 'driver.emailotp@smartroute.io',
          phone: '+919876501234',
          licenseNumber: 'OD02-OTP-1001',
          verificationToken: verifyRes.body.data.verificationToken,
          otpTarget: 'driver.emailotp@smartroute.io',
          otpChannel: 'EMAIL',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.token).toBeTruthy();
      expect(regRes.body.data.refreshToken).toBeTruthy();
      expect(regRes.body.data.user).toMatchObject({
        email: 'driver.emailotp@smartroute.io',
        role: ROLES.DRIVER,
        emailVerified: true,
        phoneVerified: false,
      });
      expect(regRes.body.data.user.driverId).toBeTruthy();

      // Single-use verificationToken cannot be replayed
      const replayReg = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Replay User',
          email: 'replay@smartroute.io',
          phone: '+919876509999',
          licenseNumber: 'OD02-OTP-1002',
          verificationToken: verifyRes.body.data.verificationToken,
          otpTarget: 'driver.emailotp@smartroute.io',
          otpChannel: 'EMAIL',
        });
      expect(replayReg.status).toBe(401);
    });

    test('TC-OTP-3: Phone OTP registration sets phoneVerified=true and rejects invalid/maxed OTP attempts', async () => {
      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: '+919937001122', channel: 'PHONE', purpose: 'REGISTER' });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.channel).toBe('PHONE');
      const code = sendRes.body.data.devPreviewCode;
      const wrongCode = code === '000000' ? '111111' : '000000';

      // 4 invalid attempts -> 401
      for (let i = 0; i < 4; i++) {
        const failRes = await request(app)
          .post('/api/v1/auth/otp/verify')
          .send({ identifier: '+919937001122', channel: 'PHONE', purpose: 'REGISTER', code: wrongCode });
        expect(failRes.status).toBe(401);
      }

      // 5th invalid attempt locks & deletes the token -> 429
      const lockRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ identifier: '+919937001122', channel: 'PHONE', purpose: 'REGISTER', code: wrongCode });
      expect(lockRes.status).toBe(429);
      expect(lockRes.body.error.code).toBe('OTP_MAX_ATTEMPTS');

      // Request fresh code & register via inline OTP
      const resendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: '+919937001122', channel: 'PHONE', purpose: 'REGISTER' });
      expect(resendRes.status).toBe(200);

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Phone Driver',
          email: 'phonedrv@smartroute.io',
          phone: '+919937001122',
          licenseNumber: 'OD02-PHN-7788',
          otp: resendRes.body.data.devPreviewCode,
          otpTarget: '+919937001122',
          otpChannel: 'PHONE',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.user.phoneVerified).toBe(true);
    });
  });

  describe('Passwordless Email / Phone OTP Sign-In', () => {
    test('TC-OTP-4: Existing Driver signs in passwordlessly via Email OTP and can refresh token', async () => {
      const { user } = await createTestUser(ROLES.DRIVER, 'otp-login@smartroute.io');
      await Driver.create({
        userId: user._id,
        licenseNumber: 'OD02-LGN-3344',
        phone: '+919437112233',
      });

      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'otp-login@smartroute.io', purpose: 'LOGIN' });
      expect(sendRes.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({
          identifier: 'otp-login@smartroute.io',
          code: sendRes.body.data.devPreviewCode,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeTruthy();
      expect(loginRes.body.data.refreshToken).toBeTruthy();
      expect(loginRes.body.data.user.driverId).toBeTruthy();

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.data.refreshToken });
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.token).toBeTruthy();
    });

    test('TC-OTP-5: OTP login send rejects unknown identifier with 404', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'nobody@smartroute.io', purpose: 'LOGIN' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
    });
  });

  describe('Real Google ID Token Verification (/api/v1/auth/google)', () => {
    test('TC-GGL-1: Rejects spoofed structured profile payload without verified Google ID credential', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({
          profile: {
            googleId: 'fake_sub_123',
            email: 'attacker@smartroute.io',
            name: 'Spoofed User',
          },
          role: 'ADMIN',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_GOOGLE_AUTH');
      expect(await User.findOne({ email: 'attacker@smartroute.io' })).toBeNull();
    });

    test('TC-GGL-2: Verifies real Google ID token, blocks self-elevation to ADMIN, and creates linked Driver', async () => {
      jest.spyOn(googleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
        googleId: 'google-sub-999111',
        email: 'new.google.driver@gmail.com',
        name: 'Google Driver',
        avatarUrl: 'https://lh3.googleusercontent.com/a/example',
        emailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({
          credential: 'mock.valid.google.id.token',
          role: 'ADMIN', // Attempted elevation must be ignored for new accounts
        });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.user.role).toBe(ROLES.DRIVER);
      expect(res.body.data.user.emailVerified).toBe(true);
      expect(res.body.data.user.driverId).toBeTruthy();

      const linkedDriver = await Driver.findById(res.body.data.user.driverId);
      expect(linkedDriver).toBeTruthy();
      expect(linkedDriver.licenseNumber).toMatch(/^GGL-/);
    });

    test('TC-GGL-3: Provisioned corporate ADMIN preserves ADMIN role when signing in via verified Google email', async () => {
      await createTestUser(ROLES.ADMIN, 'corp.admin@smartroute.io');

      jest.spyOn(googleAuthService, 'verifyGoogleIdToken').mockResolvedValue({
        googleId: 'google-sub-admin-1',
        email: 'corp.admin@smartroute.io',
        name: 'Corporate Admin',
        avatarUrl: null,
        emailVerified: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ credential: 'mock.valid.admin.token' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(ROLES.ADMIN);
      expect(res.body.data.user.emailVerified).toBe(true);
    });
  });
});
