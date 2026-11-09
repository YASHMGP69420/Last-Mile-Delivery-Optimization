const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const ioClient = require('socket.io-client');
const env = require('../src/config/env');
const { ROLES } = require('../src/config/constants');
const { generateAccessToken, blacklistToken } = require('../src/middleware/auth');
const Route = require('../src/models/Route');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const socketService = require('../src/services/socketService');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');
const { server, io } = require('../src/index');

describe('Socket.IO Gateway Authentication & Room Authorization (F-07)', () => {
  let serverPort;
  let serverUrl;
  let adminUser, adminToken;
  let driverUser1, driverDoc1, driverToken1;
  let driverUser2, driverDoc2, driverToken2;
  let vehicle1, batch1, route1;

  beforeAll(async () => {
    // Start HTTP/Socket server on an ephemeral port if not already listening
    if (!server.listening) {
      await new Promise((resolve) => {
        server.listen(0, () => {
          serverPort = server.address().port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
          resolve();
        });
      });
    } else {
      serverPort = server.address().port;
      serverUrl = `http://127.0.0.1:${serverPort}`;
    }
  });

  afterAll(async () => {
    await new Promise((resolve) => io.close(resolve));
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    // 1. Create Admin
    const adminObj = await createTestUser(ROLES.ADMIN);
    adminUser = adminObj.user;
    adminToken = adminObj.token;

    // 2. Create Driver 1
    const driverObj1 = await createTestUser(ROLES.DRIVER);
    driverUser1 = driverObj1.user;
    driverToken1 = driverObj1.token;
    driverDoc1 = await createTestDriver(driverUser1);

    // 3. Create Driver 2
    const driverObj2 = await createTestUser(ROLES.DRIVER);
    driverUser2 = driverObj2.user;
    driverToken2 = driverObj2.token;
    driverDoc2 = await createTestDriver(driverUser2);

    // 4. Create Vehicle, Batch & Route assigned to Driver 1
    vehicle1 = await createTestVehicle();

    batch1 = await DeliveryBatch.create({
      code: `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Socket Batch Test',
      date: '2026-11-09',
      status: 'DRAFT',
    });

    route1 = await Route.create({
      routeCode: `RT-SOCK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batchId: batch1._id,
      vehicleId: vehicle1._id,
      driverId: driverDoc1._id,
      status: 'DISPATCHED',
      stops: [],
    });
  });

  const createClientSocket = (options = {}) => {
    return ioClient(serverUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      ...options,
    });
  };

  describe('1. Handshake Authentication Gateway', () => {
    test('TC-SOCK-AUTH-1: Rejects connection when authentication token is missing', (done) => {
      const client = createClientSocket();

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Connection should not have succeeded without token'));
      });

      client.on('connect_error', (err) => {
        expect(err.message).toBe('AUTHENTICATION_REQUIRED');
        client.disconnect();
        done();
      });
    });

    test('TC-SOCK-AUTH-2: Rejects connection with invalid or tampered JWT token', (done) => {
      const client = createClientSocket({
        auth: { token: 'tampered.jwt.signature.here' },
      });

      client.on('connect_error', (err) => {
        expect(err.message).toBe('INVALID_TOKEN');
        client.disconnect();
        done();
      });
    });

    test('TC-SOCK-AUTH-3: Rejects connection with expired JWT token', (done) => {
      const expiredToken = jwt.sign(
        { sub: driverUser1._id.toString(), email: driverUser1.email, role: driverUser1.role },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const client = createClientSocket({
        auth: { token: expiredToken },
      });

      client.on('connect_error', (err) => {
        expect(err.message).toBe('TOKEN_EXPIRED');
        client.disconnect();
        done();
      });
    });

    test('TC-SOCK-AUTH-4: Rejects connection with revoked / blacklisted token', (done) => {
      const revokedToken = generateAccessToken(driverUser1);
      blacklistToken(revokedToken);

      const client = createClientSocket({
        auth: { token: revokedToken },
      });

      client.on('connect_error', (err) => {
        expect(err.message).toBe('TOKEN_REVOKED');
        client.disconnect();
        done();
      });
    });

    test('TC-SOCK-AUTH-5: Successfully authenticates via auth.token', (done) => {
      const client = createClientSocket({
        auth: { token: driverToken1 },
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(err);
      });
    });
  });

  describe('2. Driver Room Authorization (driver:join)', () => {
    test('TC-SOCK-ROOM-1: Driver can successfully join their own driver room', (done) => {
      const client = createClientSocket({
        auth: { token: driverToken1 },
      });

      client.on('connect', () => {
        client.emit('driver:join', { driverId: driverDoc1._id.toString() }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe(`driver:${driverDoc1._id.toString()}`);
          client.disconnect();
          done();
        });
      });
    });

    test('TC-SOCK-ROOM-2: Driver cannot spy on another driver room (BOLA blocked with FORBIDDEN)', (done) => {
      const client = createClientSocket({
        auth: { token: driverToken1 },
      });

      client.on('connect', () => {
        // Driver 1 attempts to join Driver 2's room
        client.emit('driver:join', { driverId: driverDoc2._id.toString() }, (res) => {
          expect(res.success).toBe(false);
          expect(res.code).toBe('FORBIDDEN');
          client.disconnect();
          done();
        });
      });
    });

    test('TC-SOCK-ROOM-3: Admin can monitor any driver room', (done) => {
      const client = createClientSocket({
        auth: { token: adminToken },
      });

      client.on('connect', () => {
        client.emit('driver:join', { driverId: driverDoc1._id.toString() }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe(`driver:${driverDoc1._id.toString()}`);
          client.disconnect();
          done();
        });
      });
    });

    test('TC-SOCK-ROOM-4: Rejects driver:join with invalid or missing driverId', (done) => {
      const client = createClientSocket({
        auth: { token: adminToken },
      });

      client.on('connect', () => {
        client.emit('driver:join', { driverId: 'not-an-id' }, (res) => {
          expect(res.success).toBe(false);
          expect(res.code).toBe('INVALID_ID');
          client.disconnect();
          done();
        });
      });
    });
  });

  describe('3. Route Room Authorization (route:join)', () => {
    test('TC-SOCK-ROUTE-1: Driver can join route room assigned to them', (done) => {
      const client = createClientSocket({
        auth: { token: driverToken1 },
      });

      client.on('connect', () => {
        client.emit('route:join', { routeId: route1._id.toString() }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe(`route:${route1._id.toString()}`);
          client.disconnect();
          done();
        });
      });
    });

    test('TC-SOCK-ROUTE-2: Driver cannot join route room assigned to another driver', (done) => {
      const client = createClientSocket({
        auth: { token: driverToken2 },
      });

      client.on('connect', () => {
        // Driver 2 attempts to join Route 1 (which belongs to Driver 1)
        client.emit('route:join', { routeId: route1._id.toString() }, (res) => {
          expect(res.success).toBe(false);
          expect(res.code).toBe('FORBIDDEN');
          client.disconnect();
          done();
        });
      });
    });

    test('TC-SOCK-ROUTE-3: Admin can monitor any route room', (done) => {
      const client = createClientSocket({
        auth: { token: adminToken },
      });

      client.on('connect', () => {
        client.emit('route:join', { routeId: route1._id.toString() }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe(`route:${route1._id.toString()}`);
          client.disconnect();
          done();
        });
      });
    });
  });

  describe('4. Real-Time Room Event Isolation', () => {
    test('TC-SOCK-ISOL-1: Targeted dispatch message reaches only authorized driver room', async () => {
      const client1 = createClientSocket({ auth: { token: driverToken1 } });
      const client2 = createClientSocket({ auth: { token: driverToken2 } });

      await Promise.all([
        new Promise((resolve) => client1.once('connect', resolve)),
        new Promise((resolve) => client2.once('connect', resolve)),
      ]);

      await Promise.all([
        new Promise((resolve) =>
          client1.emit('driver:join', { driverId: driverDoc1._id.toString() }, resolve)
        ),
        new Promise((resolve) =>
          client2.emit('driver:join', { driverId: driverDoc2._id.toString() }, resolve)
        ),
      ]);

      let client2Received = false;
      client2.on('dispatch:message', () => {
        client2Received = true;
      });

      const messagePromise = new Promise((resolve) => {
        client1.once('dispatch:message', (payload) => {
          resolve(payload);
        });
      });

      // Send message targeted specifically to Driver 1
      socketService.emitDispatchMessage({
        driverId: driverDoc1._id.toString(),
        title: 'High Priority Pickup',
        message: 'Head to Rasulgarh Hub for dispatch pickup.',
      });

      const payload = await messagePromise;
      expect(payload.title).toBe('High Priority Pickup');
      expect(payload.message).toBe('Head to Rasulgarh Hub for dispatch pickup.');

      // Wait 150ms to verify client2 never received it
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(client2Received).toBe(false);

      client1.disconnect();
      client2.disconnect();
    });
  });
});
