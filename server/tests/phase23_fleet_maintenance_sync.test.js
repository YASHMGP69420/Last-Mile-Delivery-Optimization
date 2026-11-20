const request = require('supertest');
const ioClient = require('socket.io-client');
const app = require('../src/app');
const { server, io } = require('../src/index');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const socketService = require('../src/services/socketService');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');
const { ROLES, VEHICLE_STATUS } = require('../src/config/constants');

describe('Phase 23: Fleet Maintenance, In-Transit Guard & Socket Ping Test Suite', () => {
  let serverPort;
  let serverUrl;
  let managerToken, managerUser;
  let driverToken, driverUser, driverDoc;
  let testVehicle;

  beforeAll(async () => {
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
    const manager = await createTestUser(ROLES.FLEET_MANAGER);
    managerToken = manager.token;
    managerUser = manager.user;

    const driverObj = await createTestUser(ROLES.DRIVER);
    driverToken = driverObj.token;
    driverUser = driverObj.user;
    driverDoc = await createTestDriver(driverUser);

    testVehicle = await createTestVehicle();
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

  describe('1. Vehicle Maintenance Schema & Status Transitions', () => {
    test('TC-MAINT-1: Updating vehicle to MAINTENANCE with maintenanceNotes succeeds and persists notes', async () => {
      const res = await request(app)
        .put(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          availability: VEHICLE_STATUS.MAINTENANCE,
          maintenanceNotes: 'Scheduled 10,000 km service • Brake pad check',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle.availability).toBe(VEHICLE_STATUS.MAINTENANCE);
      expect(res.body.data.vehicle.maintenanceNotes).toBe('Scheduled 10,000 km service • Brake pad check');

      const updated = await Vehicle.findById(testVehicle._id);
      expect(updated.availability).toBe(VEHICLE_STATUS.MAINTENANCE);
      expect(updated.maintenanceNotes).toBe('Scheduled 10,000 km service • Brake pad check');
    });

    test('TC-MAINT-2: Transitioning from MAINTENANCE to AVAILABLE clears maintenanceNotes by default', async () => {
      await Vehicle.findByIdAndUpdate(testVehicle._id, {
        availability: VEHICLE_STATUS.MAINTENANCE,
        maintenanceNotes: 'Tire repair',
      });

      const res = await request(app)
        .put(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          availability: VEHICLE_STATUS.AVAILABLE,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle.availability).toBe(VEHICLE_STATUS.AVAILABLE);
      expect(res.body.data.vehicle.maintenanceNotes).toBeNull();
    });

    test('TC-MAINT-3: Attempting to move an IN_TRANSIT vehicle to MAINTENANCE returns HTTP 409 ACTIVE_OPERATION_CONFLICT', async () => {
      await Vehicle.findByIdAndUpdate(testVehicle._id, {
        availability: VEHICLE_STATUS.IN_TRANSIT,
      });

      const res = await request(app)
        .put(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          availability: VEHICLE_STATUS.MAINTENANCE,
          maintenanceNotes: 'Emergency check',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
      expect(res.body.error.message).toMatch(/Cannot move vehicle to maintenance while route is in transit/i);
    });
  });

  describe('2. Real-Time Socket Broadcast & Remote Ping Bridge', () => {
    test('TC-SOCK-SYNC-1: Updating vehicle triggers fleet:vehicle_updated on management room', async () => {
      const managerSocket = createClientSocket({
        auth: { token: managerToken },
      });

      await new Promise((resolve) => managerSocket.once('connect', resolve));

      const updatePromise = new Promise((resolve) => {
        managerSocket.once('fleet:vehicle_updated', (payload) => {
          resolve(payload);
        });
      });

      const res = await request(app)
        .put(`/api/v1/vehicles/${testVehicle._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          availability: VEHICLE_STATUS.MAINTENANCE,
          maintenanceNotes: 'Oil change',
        });

      expect(res.status).toBe(200);

      const payload = await updatePromise;
      expect(payload.vehicleId).toBe(testVehicle._id.toString());
      expect(payload.vehicle.availability).toBe(VEHICLE_STATUS.MAINTENANCE);
      expect(payload.vehicle.maintenanceNotes).toBe('Oil change');

      managerSocket.disconnect();
    });

    test('TC-SOCK-PING-1: telemetry:request_ping from manager forwards ping to driver room', async () => {
      driverDoc.assignedVehicleId = testVehicle._id;
      await driverDoc.save();
      testVehicle.assignedDriverId = driverDoc._id;
      await testVehicle.save();

      const driverSocket = createClientSocket({ auth: { token: driverToken } });
      const managerSocket = createClientSocket({ auth: { token: managerToken } });

      await Promise.all([
        new Promise((resolve) => driverSocket.once('connect', resolve)),
        new Promise((resolve) => managerSocket.once('connect', resolve)),
      ]);

      await new Promise((resolve) =>
        driverSocket.emit('driver:join', { driverId: driverDoc._id.toString() }, resolve)
      );

      const pingPromise = new Promise((resolve) => {
        driverSocket.once('telemetry:request_ping', (payload) => {
          resolve(payload);
        });
      });

      const ack = await new Promise((resolve) => {
        managerSocket.emit(
          'telemetry:request_ping',
          { vehicleId: testVehicle._id.toString(), driverId: driverDoc._id.toString() },
          resolve
        );
      });

      expect(ack.success).toBe(true);
      expect(ack.message).toBe('Ping transmitted');

      const pingData = await pingPromise;
      expect(pingData.vehicleId).toBe(testVehicle._id.toString());
      expect(pingData.requestedBy).toBe(managerUser.email);
      expect(pingData.timestamp).toBeDefined();

      driverSocket.disconnect();
      managerSocket.disconnect();
    });

    test('TC-SOCK-PING-2: telemetry:request_ping resolves assigned driver from vehicleId when driverId omitted', async () => {
      testVehicle.assignedDriverId = driverDoc._id;
      await testVehicle.save();

      const driverSocket = createClientSocket({ auth: { token: driverToken } });
      const managerSocket = createClientSocket({ auth: { token: managerToken } });

      await Promise.all([
        new Promise((resolve) => driverSocket.once('connect', resolve)),
        new Promise((resolve) => managerSocket.once('connect', resolve)),
      ]);

      await new Promise((resolve) =>
        driverSocket.emit('driver:join', { driverId: driverDoc._id.toString() }, resolve)
      );

      const pingPromise = new Promise((resolve) => {
        driverSocket.once('telemetry:request_ping', (payload) => {
          resolve(payload);
        });
      });

      const ack = await new Promise((resolve) => {
        managerSocket.emit(
          'telemetry:request_ping',
          { vehicleId: testVehicle._id.toString() },
          resolve
        );
      });

      expect(ack.success).toBe(true);
      const pingData = await pingPromise;
      expect(pingData.vehicleId).toBe(testVehicle._id.toString());

      driverSocket.disconnect();
      managerSocket.disconnect();
    });

    test('TC-SOCK-PING-3: telemetry:request_ping rejects non-management client with FORBIDDEN', async () => {
      const driverSocket = createClientSocket({ auth: { token: driverToken } });
      await new Promise((resolve) => driverSocket.once('connect', resolve));

      const ack = await new Promise((resolve) => {
        driverSocket.emit(
          'telemetry:request_ping',
          { vehicleId: testVehicle._id.toString() },
          resolve
        );
      });

      expect(ack.success).toBe(false);
      expect(ack.code).toBe('FORBIDDEN');

      driverSocket.disconnect();
    });

    test('TC-SOCK-PING-4: telemetry:request_ping returns NO_ASSIGNED_DRIVER when vehicle has no driver', async () => {
      testVehicle.assignedDriverId = null;
      await testVehicle.save();

      const managerSocket = createClientSocket({ auth: { token: managerToken } });
      await new Promise((resolve) => managerSocket.once('connect', resolve));

      const ack = await new Promise((resolve) => {
        managerSocket.emit(
          'telemetry:request_ping',
          { vehicleId: testVehicle._id.toString() },
          resolve
        );
      });

      expect(ack.success).toBe(false);
      expect(ack.code).toBe('NO_ASSIGNED_DRIVER');

      managerSocket.disconnect();
    });
  });
});
