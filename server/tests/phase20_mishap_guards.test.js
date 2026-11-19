const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 20 Mishap Guards & Orphan Recovery (server/tests/phase20_mishap_guards.test.js)', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;
  });

  describe('MISHAP-01: End-to-end active operation interlock guard and 409 conflict reporting', () => {
    test('DELETE /api/v1/admin/users/:id returns 409 ACTIVE_OPERATION_CONFLICT with routeId, routeCode, and activeDeliveryCount when driver has active DISPATCHED route', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });

      const batch = await DeliveryBatch.create({
        code: `BATCH-MISHAP-01-${Date.now()}`,
        name: 'Batch Mishap 01',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#MISHAP-01-DEL-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      const routeCode = `RT-MISHAP-${Date.now()}`;
      const activeRoute = await Route.create({
        routeCode,
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
        .delete(`/api/v1/admin/users/${driverUser.user._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details.routeId).toBe(activeRoute._id.toString());
      expect(res.body.error.details.routeCode).toBe(routeCode);
      expect(res.body.error.details.activeDeliveryCount).toBe(1);
      expect(res.body.error.details.driverName).toBe(driverUser.user.name);
    });

    test('PATCH /api/v1/admin/users/:id/status to INACTIVE returns 409 ACTIVE_OPERATION_CONFLICT when driver has active shift or route', async () => {
      const driverUser = await createTestUser('DRIVER');
      const driver = await createTestDriver(driverUser.user, {
        availability: 'ON_DUTY',
      });

      const shift = await DriverShift.create({
        driverId: driver._id,
        date: new Date('2026-11-20'),
        startTime: '08:00',
        endTime: '17:00',
        status: 'IN_PROGRESS',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${driverUser.user._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE', reason: 'Driver unassigned test' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details.shiftId).toBe(shift._id.toString());
      expect(res.body.error.details.driverName).toBe(driverUser.user.name);
    });

    test('Non-driver users or drivers without active shifts/routes can be deleted normally (200 OK)', async () => {
      const driverUser = await createTestUser('DRIVER');
      await createTestDriver(driverUser.user, {
        availability: 'AVAILABLE',
      });

      const res = await request(app)
        .delete(`/api/v1/admin/users/${driverUser.user._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(driverUser.user._id.toString());

      // Ensure user and driver were removed
      const deletedUser = await User.findById(driverUser.user._id);
      expect(deletedUser).toBeNull();
      const deletedDriver = await Driver.findOne({ userId: driverUser.user._id });
      expect(deletedDriver).toBeNull();
    });
  });
});
