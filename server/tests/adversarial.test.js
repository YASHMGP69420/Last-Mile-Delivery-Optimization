const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const env = require('../src/config/env');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

const JWT_SECRET = env.JWT_SECRET || 'test_jwt_secret_smartroute_bhubaneswar_2026';

describe('Empirical Adversarial Challenge Test Suite (server/tests/adversarial.test.js)', () => {
  let adminToken;
  let managerToken;
  let driverToken;
  let driverUser;
  let testDriver;
  let testVehicle;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_test', {
        serverSelectionTimeoutMS: 5000,
      });
    }
    await Promise.all([Vehicle.syncIndexes(), Driver.syncIndexes()]);
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
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const driverData = await createTestUser('DRIVER');
    driverToken = driverData.token;
    driverUser = driverData.user;

    testVehicle = await createTestVehicle();
    testDriver = await createTestDriver(driverUser, { assignedVehicleId: testVehicle._id });
  });

  // =========================================================================
  // SECTION 1: AUTH SECURITY & RBAC BYPASS
  // =========================================================================
  describe('1. Auth Security & RBAC Bypass Attacks', () => {
    test('TC-ADV-AUTH-1: Non-admin roles (DRIVER, FLEET_MANAGER) cannot access ADMIN-only endpoints', async () => {
      // Test POST /api/v1/auth/users
      const driverUserCreateRes = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          name: 'Hacked Admin',
          email: 'hacked_admin@smartroute.test',
          password: 'Password123!',
          role: 'ADMIN',
        });
      expect(driverUserCreateRes.status).toBe(403);
      expect(driverUserCreateRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

      const managerUserCreateRes = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Hacked Admin 2',
          email: 'hacked_admin2@smartroute.test',
          password: 'Password123!',
          role: 'ADMIN',
        });
      expect(managerUserCreateRes.status).toBe(403);
      expect(managerUserCreateRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Test DELETE /api/v1/vehicles/:id (Admin only)
      const driverDeleteRes = await request(app)
        .delete(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${driverToken}`);
      expect(driverDeleteRes.status).toBe(403);
      expect(driverDeleteRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');

      const managerDeleteRes = await request(app)
        .delete(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(managerDeleteRes.status).toBe(403);
      expect(managerDeleteRes.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('TC-ADV-AUTH-2: DRIVER role cannot create/modify vehicles, drivers, or delivery batches', async () => {
      // Driver cannot create vehicle
      const createVehRes = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          vehicleId: 'OD-02-HACK-01',
          makeModel: 'Hack Van',
          type: 'Van',
          capacityKg: 500,
          fuelType: 'Diesel',
          kmPerLitre: 12.0,
        });
      expect(createVehRes.status).toBe(403);

      // Driver cannot update vehicle
      const updateVehRes = await request(app)
        .put(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ makeModel: 'Modified By Driver' });
      expect(updateVehRes.status).toBe(403);

      // Driver cannot create driver profile
      const createDriverRes = await request(app)
        .post('/api/v1/drivers')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          userId: driverUser._id,
          licenseNumber: 'OD-HACK-LIC',
          phone: '+91 9999999999',
        });
      expect(createDriverRes.status).toBe(403);

      // Driver cannot reassign vehicle
      const assignVehRes = await request(app)
        .put(`/api/v1/drivers/${testDriver._id}/assign`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ vehicleId: testVehicle._id });
      expect(assignVehRes.status).toBe(403);

      // Driver cannot create delivery consignment
      const createDelivRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          orderReference: '#DEL-HACK-01',
          customer: { name: 'Hack', phone: '+91 9999999999' },
          address: { street: 'Street', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 10,
        });
      expect(createDelivRes.status).toBe(403);

      // Driver cannot import CSV manifest
      const importCsvRes = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ dryRun: true, rows: [] });
      expect(importCsvRes.status).toBe(403);

      // Driver cannot create batch
      const createBatchRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          code: 'BATCH-HACK',
          name: 'Hack Batch',
        });
      expect(createBatchRes.status).toBe(403);
    });

    test('TC-ADV-AUTH-3: Tampered signature and algorithm "none" are strictly rejected', async () => {
      // 1. Token signed with wrong secret
      const wrongSecretToken = jwt.sign(
        { sub: driverUser._id.toString(), role: 'ADMIN', email: driverUser.email },
        'completely_wrong_secret_key_12345'
      );
      const resWrongSecret = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${wrongSecretToken}`);
      expect(resWrongSecret.status).toBe(401);
      expect(resWrongSecret.body.error.code).toBe('INVALID_TOKEN');

      // 2. Token tampering: valid token header.payload with forged signature
      const validToken = driverToken;
      const parts = validToken.split('.');
      const forgedToken = `${parts[0]}.${parts[1]}.invalidsignaturebytes123456789`;
      const resForged = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(resForged.status).toBe(401);
      expect(resForged.body.error.code).toBe('INVALID_TOKEN');

      // 3. Algorithm 'none' attack: unsigned token header {"alg":"none","typ":"JWT"}
      const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const nonePayload = Buffer.from(JSON.stringify({
        sub: driverUser._id.toString(),
        role: 'ADMIN',
        email: driverUser.email,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url');
      const noneToken = `${noneHeader}.${nonePayload}.`;
      const resNone = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${noneToken}`);
      expect(resNone.status).toBe(401);
      expect(resNone.body.error.code).toBe('INVALID_TOKEN');
    });

    test('TC-ADV-AUTH-4: Expired token and malformed Authorization header formats are rejected', async () => {
      // Expired token
      const expiredToken = jwt.sign(
        { sub: driverUser._id.toString(), role: 'DRIVER', email: driverUser.email },
        JWT_SECRET,
        { expiresIn: '-10s' }
      );
      const resExpired = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(resExpired.status).toBe(401);
      expect(resExpired.body.error.code).toBe('TOKEN_EXPIRED');

      // Missing Bearer prefix
      const resNoBearer = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `${adminToken}`);
      expect(resNoBearer.status).toBe(401);
      expect(resNoBearer.body.error.code).toBe('UNAUTHORIZED');

      // Basic auth prefix
      const resBasic = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic dXNlcjpwYXNz`);
      expect(resBasic.status).toBe(401);
      expect(resBasic.body.error.code).toBe('UNAUTHORIZED');

      // Empty Bearer token
      const resEmptyBearer = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer ');
      expect(resEmptyBearer.status).toBe(401);
      expect(['UNAUTHORIZED', 'INVALID_TOKEN']).toContain(resEmptyBearer.body.error.code);
    });

    test('TC-ADV-AUTH-5: Blacklisted / revoked token is blocked from re-use after logout', async () => {
      // Check token works before logout
      const preLogout = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(preLogout.status).toBe(200);

      // Perform logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Re-use logged-out token
      const postLogout = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(postLogout.status).toBe(401);
      expect(postLogout.body.error.code).toBe('TOKEN_REVOKED');
    });
  });

  // =========================================================================
  // SECTION 2: PASSWORD SECURITY & SENSITIVE DATA EXPOSURE
  // =========================================================================
  describe('2. Password Security & Sensitive Field Sanitization', () => {
    test('TC-ADV-PWD-1: Login endpoint never exposes passwordHash or password in payload', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: driverUser.email,
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toMatch(/passwordHash/i);
      expect(rawBody).not.toMatch(/\$2[ab]\$\d+\$/); // No bcrypt hash pattern
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('TC-ADV-PWD-2: User provisioning endpoint never exposes passwordHash or password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Safe User',
          email: 'audit.safe@smartroute.test',
          password: 'SuperSecretPassword999!',
          role: 'FLEET_MANAGER',
        });

      expect(res.status).toBe(201);
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toMatch(/SuperSecretPassword999!/);
      expect(rawBody).not.toMatch(/passwordHash/i);
      expect(rawBody).not.toMatch(/\$2[ab]\$\d+\$/);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    test('TC-ADV-PWD-3: GET /auth/me never exposes passwordHash or refreshToken', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toMatch(/passwordHash/i);
      expect(rawBody).not.toMatch(/refreshToken/i);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.refreshToken).toBeUndefined();
    });

    test('TC-ADV-PWD-4: Populated driver and vehicle user references never leak passwordHash', async () => {
      // 1. GET /api/v1/drivers (populates userId)
      const driversRes = await request(app)
        .get('/api/v1/drivers')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(driversRes.status).toBe(200);
      const driversRaw = JSON.stringify(driversRes.body);
      expect(driversRaw).not.toMatch(/passwordHash/i);
      expect(driversRaw).not.toMatch(/\$2[ab]\$\d+\$/);

      // 2. GET /api/v1/vehicles (populates assignedDriverId -> userId)
      const vehiclesRes = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(vehiclesRes.status).toBe(200);
      const vehiclesRaw = JSON.stringify(vehiclesRes.body);
      expect(vehiclesRaw).not.toMatch(/passwordHash/i);
      expect(vehiclesRaw).not.toMatch(/\$2[ab]\$\d+\$/);

      // 3. User model default query does not select passwordHash
      const directUser = await User.findById(driverUser._id);
      expect(directUser.passwordHash).toBeUndefined();
    });
  });

  // =========================================================================
  // SECTION 3: DELIVERY STATE MACHINE INVARIANTS & TRANSITION ATTACKS
  // =========================================================================
  describe('3. Delivery State Machine Invariants & Illegal Transitions', () => {
    let testDelivery;

    beforeEach(async () => {
      testDelivery = await Delivery.create({
        orderReference: `#DEL-STATE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customer: { name: 'State Test Consignee', phone: '+91 98610 55555' },
        address: { street: 'Janpath Road', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        weightKg: 8.5,
        priority: 'Standard',
        timeWindow: { start: '10:00', end: '12:00' },
        status: 'DRAFT',
      });
    });

    test('TC-ADV-STATE-1: Illegal status transitions via PATCH /deliveries/:id/status are rejected', async () => {
      // 1. DRAFT -> ASSIGNED directly (must go DRAFT -> READY first)
      const resDraftToAssigned = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'ASSIGNED' });
      expect(resDraftToAssigned.status).toBe(400);
      expect(resDraftToAssigned.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // 2. DRAFT -> OUT_FOR_DELIVERY directly
      const resDraftToOfd = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'OUT_FOR_DELIVERY' });
      expect(resDraftToOfd.status).toBe(400);
      expect(resDraftToOfd.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // 3. DRAFT -> COMPLETED directly
      const resDraftToComp = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'COMPLETED' });
      expect(resDraftToComp.status).toBe(400);
      expect(resDraftToComp.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // 4. DRAFT -> FAILED directly
      const resDraftToFail = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'FAILED', failureReason: 'CUSTOMER_UNAVAILABLE' });
      expect(resDraftToFail.status).toBe(400);
      expect(resDraftToFail.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Advance to READY
      await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'READY' });

      // 5. READY -> OUT_FOR_DELIVERY directly (must go READY -> ASSIGNED first)
      const resReadyToOfd = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'OUT_FOR_DELIVERY' });
      expect(resReadyToOfd.status).toBe(400);
      expect(resReadyToOfd.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // 6. READY -> COMPLETED directly
      const resReadyToComp = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'COMPLETED' });
      expect(resReadyToComp.status).toBe(400);
      expect(resReadyToComp.body.error.code).toBe('INVALID_STATUS_TRANSITION');

      // Advance to ASSIGNED
      await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'ASSIGNED' });

      // 7. ASSIGNED -> COMPLETED directly (must be OUT_FOR_DELIVERY first)
      const resAssignedToComp = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'COMPLETED' });
      expect(resAssignedToComp.status).toBe(400);
      expect(resAssignedToComp.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    test('TC-ADV-STATE-2: Terminal COMPLETED deliveries cannot transition to any other status', async () => {
      // Progress delivery to COMPLETED
      testDelivery.status = 'OUT_FOR_DELIVERY';
      testDelivery.assignedDriverId = testDriver._id;
      testDelivery.assignedVehicleId = testVehicle._id;
      await testDelivery.save();

      const completeRes = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          status: 'COMPLETED',
          pod: { otp: '1234', otpVerified: true, signatureSvg: '<svg></svg>' },
        });
      expect(completeRes.status).toBe(200);

      // Attempt all possible transitions from COMPLETED -> must all be rejected with 400
      const targetStatuses = ['DRAFT', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'FAILED'];
      for (const target of targetStatuses) {
        const res = await request(app)
          .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: target, failureReason: 'CUSTOMER_UNAVAILABLE' });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    test('TC-ADV-STATE-3: Amending / editing (PUT) locked deliveries in COMPLETED or OUT_FOR_DELIVERY is blocked', async () => {
      testDelivery.status = 'COMPLETED';
      await testDelivery.save();

      const updateCompletedRes = await request(app)
        .put(`/api/v1/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ weightKg: 99.0, priority: 'Urgent' });
      expect(updateCompletedRes.status).toBe(400);
      expect(updateCompletedRes.body.error.code).toBe('DELIVERY_LOCKED');

      testDelivery.status = 'OUT_FOR_DELIVERY';
      await testDelivery.save();

      const updateOfdRes = await request(app)
        .put(`/api/v1/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ weightKg: 50.0 });
      expect(updateOfdRes.status).toBe(400);
      expect(updateOfdRes.body.error.code).toBe('DELIVERY_LOCKED');
    });

    test('TC-ADV-STATE-4: Deletion (DELETE) of active or completed deliveries is blocked', async () => {
      // 1. In ASSIGNED status
      testDelivery.status = 'ASSIGNED';
      await testDelivery.save();
      const delAssigned = await request(app)
        .delete(`/api/v1/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(delAssigned.status).toBe(400);
      expect(delAssigned.body.error.code).toBe('DELIVERY_NOT_DELETABLE');

      // 2. In OUT_FOR_DELIVERY status
      testDelivery.status = 'OUT_FOR_DELIVERY';
      await testDelivery.save();
      const delOfd = await request(app)
        .delete(`/api/v1/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(delOfd.status).toBe(400);
      expect(delOfd.body.error.code).toBe('DELIVERY_NOT_DELETABLE');

      // 3. In COMPLETED status
      testDelivery.status = 'COMPLETED';
      await testDelivery.save();
      const delComp = await request(app)
        .delete(`/api/v1/deliveries/${testDelivery._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(delComp.status).toBe(400);
      expect(delComp.body.error.code).toBe('DELIVERY_NOT_DELETABLE');
    });

    test('TC-ADV-STATE-5: State Machine Bypass Check via POST /deliveries/:id/complete and /fail', async () => {
      // Delivery starts in DRAFT status
      expect(testDelivery.status).toBe('DRAFT');

      // Attempting to complete a delivery in DRAFT status via /complete
      const completeDraftRes = await request(app)
        .post(`/api/v1/deliveries/${testDelivery._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ otp: '9999' });

      // Attempting to fail a delivery in DRAFT status via /fail
      const failDraftRes = await request(app)
        .post(`/api/v1/deliveries/${testDelivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ failureReason: 'CUSTOMER_UNAVAILABLE' });

      // Empirical Check: Direct transition from DRAFT to COMPLETED via /complete MUST be rejected with 400
      expect(completeDraftRes.status).toBe(400);
      expect(failDraftRes.status).toBe(400);
    });

    test('TC-ADV-STATE-6: Transition to FAILED requires mandatory reason code', async () => {
      testDelivery.status = 'OUT_FOR_DELIVERY';
      await testDelivery.save();

      // Missing failureReason on POST /deliveries/:id/fail
      const failNoReason = await request(app)
        .post(`/api/v1/deliveries/${testDelivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({});
      expect(failNoReason.status).toBe(400);
      expect(failNoReason.body.error.code).toBe('MISSING_FAILURE_REASON');

      // Missing failureReason on PATCH /deliveries/:id/status
      const patchFailNoReason = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'FAILED' });
      expect(patchFailNoReason.status).toBe(400);
      expect(patchFailNoReason.body.error.code).toBe('MISSING_FAILURE_REASON');
    });

    test('TC-ADV-STATE-7: Illegal status transitions and reassignments on terminal COMPLETED delivery', async () => {
      // Set delivery to COMPLETED
      testDelivery.status = 'COMPLETED';
      await testDelivery.save();

      // 1. Attempting to mark a COMPLETED delivery as FAILED via /fail
      const failCompletedRes = await request(app)
        .post(`/api/v1/deliveries/${testDelivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ failureReason: 'CUSTOMER_UNAVAILABLE' });

      // 2. Attempting to re-assign a COMPLETED delivery via /assign
      const assignCompletedRes = await request(app)
        .patch(`/api/v1/deliveries/${testDelivery._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: testVehicle._id, driverId: testDriver._id });

      // Both of these must be rejected with 400!
      expect(failCompletedRes.status).toBe(400);
      expect(assignCompletedRes.status).toBe(400);
    });
  });

  // =========================================================================
  // SECTION 4: 1:1 DRIVER-VEHICLE MUTUAL EXCLUSIVITY & ASSIGNMENT INTEGRITY
  // =========================================================================
  describe('4. 1:1 Driver-Vehicle Mutual Exclusivity & Assignment Integrity', () => {
    let driverA;
    let driverB;
    let vehicleA;
    let vehicleB;

    beforeEach(async () => {
      const uA = await createTestUser('DRIVER');
      const uB = await createTestUser('DRIVER');

      driverA = await createTestDriver(uA.user, { licenseNumber: `LIC-A-${Date.now()}-${Math.floor(Math.random() * 10000)}` });
      driverB = await createTestDriver(uB.user, { licenseNumber: `LIC-B-${Date.now()}-${Math.floor(Math.random() * 10000)}` });

      vehicleA = await createTestVehicle({ vehicleId: `OD-02-EXA-${Date.now()}-${Math.floor(Math.random() * 10000)}` });
      vehicleB = await createTestVehicle({ vehicleId: `OD-02-EXB-${Date.now()}-${Math.floor(Math.random() * 10000)}` });
    });

    test('TC-ADV-FLEET-1: Cannot assign vehicle in RETIRED or MAINTENANCE status', async () => {
      // Retired
      vehicleA.availability = 'RETIRED';
      await vehicleA.save();

      const resRetired = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });
      expect(resRetired.status).toBe(400);
      expect(resRetired.body.error.code).toBe('VEHICLE_UNAVAILABLE');

      // Maintenance
      vehicleA.availability = 'MAINTENANCE';
      await vehicleA.save();

      const resMaint = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });
      expect(resMaint.status).toBe(400);
      expect(resMaint.body.error.code).toBe('VEHICLE_UNAVAILABLE');
    });

    test('TC-ADV-FLEET-2: Vehicle in active transit with driver cannot be stolen by another driver', async () => {
      // Assign driverA to vehicleA
      const assignRes = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });
      expect(assignRes.status).toBe(200);

      // Put driverA in IN_TRANSIT
      await Driver.findByIdAndUpdate(driverA._id, { availability: 'IN_TRANSIT' });

      // DriverB attempts to steal vehicleA
      const stealRes = await request(app)
        .put(`/api/v1/drivers/${driverB._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicleA._id });

      expect(stealRes.status).toBe(409);
      expect(stealRes.body.error.code).toBe('VEHICLE_IN_ACTIVE_TRANSIT');

      // Verify vehicleA remains with driverA
      const vCheck = await Vehicle.findById(vehicleA._id);
      expect(vCheck.assignedDriverId.toString()).toBe(driverA._id.toString());
      const dCheck = await Driver.findById(driverA._id);
      expect(dCheck.assignedVehicleId.toString()).toBe(vehicleA._id.toString());
    });

    test('TC-ADV-FLEET-3: Concurrent binding stress test — Two drivers requesting the same available vehicle', async () => {
      // Both driverA and driverB attempt to bind vehicleA at the exact same moment
      const [res1, res2] = await Promise.all([
        request(app)
          .put(`/api/v1/drivers/${driverA._id}/assign`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ vehicleId: vehicleA._id }),
        request(app)
          .put(`/api/v1/drivers/${driverB._id}/assign`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ vehicleId: vehicleA._id }),
      ]);

      // Both requests resolve with HTTP status codes
      expect([200, 409]).toContain(res1.status);
      expect([200, 409]).toContain(res2.status);

      // Verify final database state:
      const vFinal = await Vehicle.findById(vehicleA._id);
      expect(vFinal.assignedDriverId).not.toBeNull();

      const assignedDriverId = vFinal.assignedDriverId.toString();
      expect([driverA._id.toString(), driverB._id.toString()]).toContain(assignedDriverId);

      const winningDriver = await Driver.findById(assignedDriverId);
      expect(winningDriver.assignedVehicleId.toString()).toBe(vehicleA._id.toString());

      const otherDriverId = assignedDriverId === driverA._id.toString() ? driverB._id : driverA._id;
      const otherDriver = await Driver.findById(otherDriverId);
      // The other driver must NOT be linked to vehicleA!
      expect(otherDriver.assignedVehicleId).toBeNull();
    });

    test('TC-ADV-FLEET-4: Driver concurrent assignment to two vehicles — Driver binds Vehicle 1 and Vehicle 2 simultaneously', async () => {
      // DriverA attempts to bind vehicleA and vehicleB at the same time
      await Promise.all([
        request(app)
          .put(`/api/v1/drivers/${driverA._id}/assign`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ vehicleId: vehicleA._id }),
        request(app)
          .put(`/api/v1/drivers/${driverA._id}/assign`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ vehicleId: vehicleB._id }),
      ]);

      // Check final driver state
      const dFinal = await Driver.findById(driverA._id);
      expect(dFinal).not.toBeNull();
      expect(dFinal.assignedVehicleId).not.toBeNull();

      const winningVehicleId = dFinal.assignedVehicleId.toString();
      expect([vehicleA._id.toString(), vehicleB._id.toString()]).toContain(winningVehicleId);

      const losingVehicleId = winningVehicleId === vehicleA._id.toString() ? vehicleB._id : vehicleA._id;

      const vWin = await Vehicle.findById(winningVehicleId);
      expect(vWin.assignedDriverId.toString()).toBe(driverA._id.toString());
      expect(vWin.availability).toBe('ASSIGNED');

      const vLose = await Vehicle.findById(losingVehicleId);
      // Losing vehicle must NOT have driverA assigned to it!
      expect(vLose.assignedDriverId).toBeNull();
      expect(vLose.availability).toBe('AVAILABLE');
    });
  });
});
