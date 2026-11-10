const request = require('supertest');
const nodemailer = require('nodemailer');
const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const OtpToken = require('../src/models/OtpToken');
const otpDeliveryService = require('../src/services/otpDeliveryService');
const googleAuthService = require('../src/services/googleAuthService');
const { ROLES } = require('../src/config/constants');
const { createTestUser } = require('./helpers/testUtils');

describe('OTP Verification, Out-of-Band Delivery & Real Google Auth Test Suite', () => {
  const originalEnv = { ...env };

  afterEach(() => {
    Object.assign(env, originalEnv);
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

    test('TC-OTP-2: Passwordless Email OTP sends out-of-band without HTTP leakage, creates User & Driver, and mints JWT', async () => {
      let capturedEmailCode = null;
      const emailSpy = jest
        .spyOn(otpDeliveryService, 'sendEmailOtp')
        .mockImplementation(async (toEmail, code) => {
          capturedEmailCode = code;
          return { delivered: true, channel: 'EMAIL', mode: 'SMTP' };
        });

      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'driver.emailotp@smartroute.io', purpose: 'REGISTER' });

      expect(sendRes.status).toBe(200);
      expect(emailSpy).toHaveBeenCalledTimes(1);
      expect(capturedEmailCode).toMatch(/^\d{6}$/);
      expect(sendRes.body.data.channel).toBe('EMAIL');
      expect(sendRes.body.data.devPreviewCode).toBeUndefined();
      expect(JSON.stringify(sendRes.body)).not.toContain(capturedEmailCode);

      // Ensure OtpToken stores hashed code rather than plaintext
      const storedToken = await OtpToken.findOne({ target: 'driver.emailotp@smartroute.io' });
      expect(storedToken).toBeTruthy();
      expect(storedToken.codeHash).not.toBe(capturedEmailCode);

      const verifyRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({
          identifier: 'driver.emailotp@smartroute.io',
          purpose: 'REGISTER',
          code: capturedEmailCode,
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
      let capturedSmsCode = null;
      jest.spyOn(otpDeliveryService, 'sendSmsOtp').mockImplementation(async (toPhone, code) => {
        capturedSmsCode = code;
        return { delivered: true, channel: 'PHONE', mode: 'TWILIO' };
      });

      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: '+919937001122', channel: 'PHONE', purpose: 'REGISTER' });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.channel).toBe('PHONE');
      expect(sendRes.body.data.devPreviewCode).toBeUndefined();
      expect(capturedSmsCode).toMatch(/^\d{6}$/);
      expect(JSON.stringify(sendRes.body)).not.toContain(capturedSmsCode);

      const wrongCode = capturedSmsCode === '000000' ? '111111' : '000000';

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
      expect(JSON.stringify(resendRes.body)).not.toContain(capturedSmsCode);

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Phone Driver',
          email: 'phonedrv@smartroute.io',
          phone: '+919937001122',
          licenseNumber: 'OD02-PHN-7788',
          otp: capturedSmsCode,
          otpTarget: '+919937001122',
          otpChannel: 'PHONE',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.user.phoneVerified).toBe(true);
    });
  });

  describe('Passwordless Email / Phone OTP Sign-In', () => {
    test('TC-OTP-4: Existing Driver signs in passwordlessly via Email OTP and can refresh token', async () => {
      let capturedCode = null;
      jest.spyOn(otpDeliveryService, 'sendEmailOtp').mockImplementation(async (to, code) => {
        capturedCode = code;
        return { delivered: true, channel: 'EMAIL', mode: 'SMTP' };
      });

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
      expect(sendRes.body.data.devPreviewCode).toBeUndefined();
      expect(JSON.stringify(sendRes.body)).not.toContain(capturedCode);

      const loginRes = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({
          identifier: 'otp-login@smartroute.io',
          code: capturedCode,
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

  describe('Provider Configuration, Failure Rollback, Cooldown & Readiness Endpoint', () => {
    test('TC-OTP-6: Unconfigured SMTP/SMS returns 503 and deletes pending OtpToken cleanly', async () => {
      env.SMTP_SERVICE = '';
      env.SMTP_HOST = '';
      env.SMTP_USER = '';
      env.SMTP_PASS = '';
      env.TWILIO_ACCOUNT_SID = '';
      env.TWILIO_AUTH_TOKEN = '';
      env.TWILIO_FROM_NUMBER = '';
      env.FAST2SMS_API_KEY = '';
      env.SMS_WEBHOOK_URL = '';

      const emailRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'no-smtp@smartroute.io', purpose: 'REGISTER' });
      expect(emailRes.status).toBe(503);
      expect(emailRes.body.error.code).toBe('EMAIL_OTP_UNCONFIGURED');
      expect(await OtpToken.findOne({ target: 'no-smtp@smartroute.io' })).toBeNull();

      const smsRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: '+919988776655', channel: 'PHONE', purpose: 'REGISTER' });
      expect(smsRes.status).toBe(503);
      expect(smsRes.body.error.code).toBe('SMS_OTP_UNCONFIGURED');
      expect(await OtpToken.findOne({ target: '+919988776655' })).toBeNull();
    });

    test('TC-OTP-7: SMTP send failure rolls back OtpToken; Twilio & SMTP transports dispatch real credentials', async () => {
      env.SMTP_SERVICE = 'gmail';
      env.SMTP_USER = 'ops@smartroute.io';
      env.SMTP_PASS = 'app-password-secret';

      const failingSendMail = jest.fn().mockRejectedValue(new Error('Invalid SMTP auth'));
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: failingSendMail });

      const failRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'smtp-fail@smartroute.io', purpose: 'REGISTER' });
      expect(failRes.status).toBe(502);
      expect(failRes.body.error.code).toBe('OTP_DELIVERY_FAILED');
      expect(await OtpToken.findOne({ target: 'smtp-fail@smartroute.io' })).toBeNull();

      // Now verify Twilio SMS dispatch with mocked fetch
      env.TWILIO_ACCOUNT_SID = 'AC12345';
      env.TWILIO_AUTH_TOKEN = 'twilio-secret';
      env.TWILIO_FROM_NUMBER = '+15005550006';
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, status: 201, text: async () => '{}' });

      const smsOk = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: '+919876543210', channel: 'PHONE', purpose: 'REGISTER' });
      expect(smsOk.status).toBe(200);
      expect(smsOk.body.data.deliveryMode).toBe('TWILIO');
      expect(smsOk.body.data.devPreviewCode).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC12345/Messages.json',
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('TC-OTP-8: Resend cooldown enforces 429 OTP_RESEND_COOLDOWN before window expires', async () => {
      env.OTP_RESEND_COOLDOWN_SECONDS = 30;
      jest.spyOn(otpDeliveryService, 'sendEmailOtp').mockResolvedValue({
        delivered: true,
        channel: 'EMAIL',
        mode: 'SMTP',
      });

      const first = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'cooldown@smartroute.io', purpose: 'REGISTER' });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ identifier: 'cooldown@smartroute.io', purpose: 'REGISTER' });
      expect(second.status).toBe(429);
      expect(second.body.error.code).toBe('OTP_RESEND_COOLDOWN');
    });

    test('TC-OTP-9: GET /api/v1/auth/otp/providers reports non-sensitive provider capabilities', async () => {
      env.SMTP_SERVICE = 'gmail';
      env.SMTP_USER = 'ops@smartroute.io';
      env.SMTP_PASS = 'secret';
      env.TWILIO_ACCOUNT_SID = '';
      env.FAST2SMS_API_KEY = '';
      env.SMS_WEBHOOK_URL = '';

      const res = await request(app).get('/api/v1/auth/otp/providers');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        emailConfigured: true,
        smsConfigured: false,
        emailProvider: 'gmail',
        smsProvider: null,
      });
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
          role: 'ADMIN',
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
