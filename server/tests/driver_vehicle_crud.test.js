const request = require('supertest');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Unified Driver & Vehicle CRUD Operations (server/tests/driver_vehicle_crud.test.js)', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;
  });

  describe('Driver Update & User Synchronization (PUT /api/v1/drivers/:id)', () => {
    test('updates driver details and synchronizes linked user model name, email, and phone', async () => {
      const driverUser = await createTestUser('DRIVER');
      const driver = await createTestDriver(driverUser.user, {
        phone: '+91 98610 11111',
        licenseNumber: 'OD-02-DL-ORIGINAL',
        availability: 'AVAILABLE',
      });

      const updatedEmail = `driver_updated_${Date.now()}@smartroute.test`;
      const res = await request(app)
        .put(`/api/v1/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Driver Updated',
          email: updatedEmail,
          phone: '+91 94370 22222',
          licenseNumber: 'OD-02-DL-UPDATED',
          availability: 'ON_DUTY',
          rating: 4.8,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver.licenseNumber).toBe('OD-02-DL-UPDATED');
      expect(res.body.data.driver.phone).toBe('+91 94370 22222');
      expect(res.body.data.driver.availability).toBe('ON_DUTY');
      expect(res.body.data.driver.rating).toBe(4.8);

      // Verify User document was synchronized
      const syncedUser = await User.findById(driverUser.user._id);
      expect(syncedUser.name).toBe('Rajesh Driver Updated');
      expect(syncedUser.email).toBe(updatedEmail);
      expect(syncedUser.phone).toBe('+91 94370 22222');
    });

    test('rejects duplicate license number with 409 conflict', async () => {
      const user1 = await createTestUser('DRIVER');
      const driver1 = await createTestDriver(user1.user, { licenseNumber: 'OD-02-DL-FIRST' });

      const user2 = await createTestUser('DRIVER');
      const driver2 = await createTestDriver(user2.user, { licenseNumber: 'OD-02-DL-SECOND' });

      const res = await request(app)
        .put(`/api/v1/drivers/${driver2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          licenseNumber: 'OD-02-DL-FIRST',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_KEY_CONFLICT');
    });

    test('rejects duplicate email on linked user with 409 conflict', async () => {
      const existingUser = await createTestUser('ADMIN');
      const user2 = await createTestUser('DRIVER');
      const driver2 = await createTestDriver(user2.user);

      const res = await request(app)
        .put(`/api/v1/drivers/${driver2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: existingUser.user.email,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_KEY_CONFLICT');
    });
  });

  describe('Driver Deletion & Cascades (DELETE /api/v1/drivers/:id)', () => {
    test('deletes idle driver, removes user account, and unpairs vehicle cleanly', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'ASSIGNED' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'AVAILABLE',
      });
      await Vehicle.findByIdAndUpdate(vehicle._id, { assignedDriverId: driver._id });

      const res = await request(app)
        .delete(`/api/v1/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Driver and User documents were deleted
      const checkDriver = await Driver.findById(driver._id);
      expect(checkDriver).toBeNull();

      const checkUser = await User.findById(driverUser.user._id);
      expect(checkUser).toBeNull();

      // Verify Vehicle unpair
      const checkVehicle = await Vehicle.findById(vehicle._id);
      expect(checkVehicle.assignedDriverId).toBeNull();
    });

    test('returns 409 ACTIVE_OPERATION_CONFLICT when deleting active driver in transit', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });

      const batch = await DeliveryBatch.create({
        code: `BATCH-TEST-${Date.now()}`,
        name: 'Batch Test',
        date: '2026-11-22',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      await Route.create({
        routeCode: `RT-TEST-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      const res = await request(app)
        .delete(`/api/v1/drivers/${driver._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
      expect(res.body.error.details.hasActiveOperations).toBe(true);
      expect(res.body.error.details.activeDeliveryCount).toBe(1);
    });

    test('rescues deliveries to READY with forceReassign=true and deletes driver', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });

      const batch = await DeliveryBatch.create({
        code: `BATCH-RESCUE-${Date.now()}`,
        name: 'Batch Rescue',
        date: '2026-11-22',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        status: 'ASSIGNED',
        priority: 'Standard',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      const route = await Route.create({
        routeCode: `RT-RESCUE-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      const res = await request(app)
        .delete(`/api/v1/drivers/${driver._id}?forceReassign=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify driver and user were deleted
      const checkDriver = await Driver.findById(driver._id);
      expect(checkDriver).toBeNull();

      // Verify delivery rescued to READY with Urgent priority
      const checkDelivery = await Delivery.findById(delivery._id);
      expect(checkDelivery.status).toBe('READY');
      expect(checkDelivery.priority).toBe('Urgent');
      expect(checkDelivery.assignedDriverId).toBeNull();

      // Verify route cancelled
      const checkRoute = await Route.findById(route._id);
      expect(checkRoute.status).toBe('CANCELLED');
    });
  });

  describe('Vehicle Operations & Soft/Permanent Deletion', () => {
    test('soft-retires vehicle by default (availability = RETIRED) and unpairs driver', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'AVAILABLE' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
      });
      await Vehicle.findByIdAndUpdate(vehicle._id, { assignedDriverId: driver._id });

      const res = await request(app)
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkVehicle = await Vehicle.findById(vehicle._id);
      expect(checkVehicle).not.toBeNull();
      expect(checkVehicle.availability).toBe('RETIRED');
      expect(checkVehicle.assignedDriverId).toBeNull();

      const checkDriver = await Driver.findById(driver._id);
      expect(checkDriver.assignedVehicleId).toBeNull();
    });

    test('permanently deletes vehicle when permanent=true query parameter is passed', async () => {
      const vehicle = await createTestVehicle({ availability: 'AVAILABLE' });

      const res = await request(app)
        .delete(`/api/v1/vehicles/${vehicle._id}?permanent=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Vehicle deleted permanently');

      const checkVehicle = await Vehicle.findById(vehicle._id);
      expect(checkVehicle).toBeNull();
    });

    test('blocks vehicle deletion with 409 conflict when vehicle is in active transit', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });
      await Vehicle.findByIdAndUpdate(vehicle._id, { assignedDriverId: driver._id });

      const batch = await DeliveryBatch.create({
        code: `BATCH-VEH-${Date.now()}`,
        name: 'Batch Veh',
        date: '2026-11-22',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      await Route.create({
        routeCode: `RT-VEH-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery._id,
            orderReference: delivery.orderReference,
            customer: delivery.customer,
            address: delivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      const res = await request(app)
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
    });
  });
});
