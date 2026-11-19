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

  describe('MISHAP-03: Atomic mishap recovery cascade and POD preservation', () => {
    test('DELETE /api/v1/admin/users/:id?forceReassign=true rescues uncompleted deliveries to READY with Urgent priority while preserving completed POD intact', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });
      await Vehicle.findByIdAndUpdate(vehicle._id, { assignedDriverId: driver._id });

      const batch = await DeliveryBatch.create({
        code: `BATCH-CASCADE-${Date.now()}`,
        name: 'Cascade Batch',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      // 1. Completed delivery with POD
      const completedDelivery = await createTestDelivery({
        orderReference: `#COMPLETED-POD-${Date.now()}`,
        status: 'COMPLETED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        proofOfDelivery: {
          otp: '789123',
          otpVerified: true,
          signatureSvg: '<svg>signature-evidence</svg>',
          photoUrl: 'https://smartroute.test/pod-proof.jpg',
        },
      });

      // 2. Uncompleted deliveries: PENDING and ARRIVED
      const pendingDelivery = await createTestDelivery({
        orderReference: `#PENDING-RESCUE-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        priority: 'Standard',
      });

      const arrivedDelivery = await createTestDelivery({
        orderReference: `#ARRIVED-RESCUE-${Date.now()}`,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        priority: 'Standard',
      });

      const routeCode = `RT-CASCADE-${Date.now()}`;
      const route = await Route.create({
        routeCode,
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'IN_PROGRESS',
        stops: [
          {
            sequence: 1,
            deliveryId: completedDelivery._id,
            orderReference: completedDelivery.orderReference,
            customer: completedDelivery.customer,
            address: completedDelivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: completedDelivery.timeWindow,
            status: 'COMPLETED',
          },
          {
            sequence: 2,
            deliveryId: pendingDelivery._id,
            orderReference: pendingDelivery.orderReference,
            customer: pendingDelivery.customer,
            address: pendingDelivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: pendingDelivery.timeWindow,
            status: 'PENDING',
          },
          {
            sequence: 3,
            deliveryId: arrivedDelivery._id,
            orderReference: arrivedDelivery.orderReference,
            customer: arrivedDelivery.customer,
            address: arrivedDelivery.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: arrivedDelivery.timeWindow,
            status: 'ARRIVED',
          },
        ],
      });

      const shift = await DriverShift.create({
        driverId: driver._id,
        vehicleId: vehicle._id,
        date: new Date('2026-11-20'),
        startTime: '08:00',
        endTime: '17:00',
        status: 'IN_PROGRESS',
      });

      const VehicleAssignment = require('../src/models/VehicleAssignment');
      const assignment = await VehicleAssignment.create({
        vehicleId: vehicle._id,
        driverId: driver._id,
        routeId: route._id,
        startTime: new Date('2026-11-20T08:00:00Z'),
        endTime: new Date('2026-11-20T17:00:00Z'),
        status: 'ACTIVE',
      });

      // Execute deletion with forceReassign=true
      const res = await request(app)
        .delete(`/api/v1/admin/users/${driverUser.user._id}?forceReassign=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 1. Verify Completed delivery retained COMPLETED and intact POD
      const checkCompleted = await Delivery.findById(completedDelivery._id);
      expect(checkCompleted.status).toBe('COMPLETED');
      expect(checkCompleted.proofOfDelivery.signatureSvg).toBe('<svg>signature-evidence</svg>');
      expect(checkCompleted.proofOfDelivery.photoUrl).toBe('https://smartroute.test/pod-proof.jpg');
      expect(checkCompleted.proofOfDelivery.otpVerified).toBe(true);

      // 2. Verify Uncompleted deliveries rescued to READY with Urgent priority
      const checkPending = await Delivery.findById(pendingDelivery._id);
      expect(checkPending.status).toBe('READY');
      expect(checkPending.priority).toBe('Urgent');
      expect(checkPending.assignedDriverId).toBeNull();
      expect(checkPending.assignedVehicleId).toBeNull();
      expect(checkPending.failureNotes).toContain('Rescued from route');

      const checkArrived = await Delivery.findById(arrivedDelivery._id);
      expect(checkArrived.status).toBe('READY');
      expect(checkArrived.priority).toBe('Urgent');
      expect(checkArrived.assignedDriverId).toBeNull();
      expect(checkArrived.assignedVehicleId).toBeNull();

      // 3. Verify Route cancelled with reason
      const checkRoute = await Route.findById(route._id);
      expect(checkRoute.status).toBe('CANCELLED');
      expect(checkRoute.cancellationReason).toBe('DRIVER_ACCOUNT_DELETED');

      // 4. Verify DriverShift force-closed
      const checkShift = await DriverShift.findById(shift._id);
      expect(checkShift.status).toBe('FORCE_CLOSED');
      expect(checkShift.endTime).toBeDefined();

      // 5. Verify VehicleAssignment cancelled and Vehicle available
      const checkAssignment = await VehicleAssignment.findById(assignment._id);
      expect(checkAssignment.status).toBe('CANCELLED');

      const checkVehicle = await Vehicle.findById(vehicle._id);
      expect(checkVehicle.availability).toBe('AVAILABLE');
      expect(checkVehicle.assignedDriverId).toBeNull();

      // 6. Verify AuditEvent created for rescued deliveries
      const AuditEvent = require('../src/models/AuditEvent');
      const auditLogs = await AuditEvent.find({
        type: 'EXCEPTION_REPORTED',
        deliveryId: { $in: [pendingDelivery._id, arrivedDelivery._id] },
      });
      expect(auditLogs.length).toBe(2);

      // 7. Verify SystemNotification generated
      const SystemNotification = require('../src/models/SystemNotification');
      const notification = await SystemNotification.findOne({
        category: 'SAFETY',
        severity: 'CRITICAL',
      }).sort({ createdAt: -1 });
      expect(notification).not.toBeNull();
      expect(notification.title).toContain('Rescued');
    });

    test('POST /api/v1/routes/:id/mishap-recover executes cascade recovery for vehicle breakdown mishap setting vehicle to MAINTENANCE', async () => {
      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });

      const batch = await DeliveryBatch.create({
        code: `BATCH-BREAKDOWN-${Date.now()}`,
        name: 'Breakdown Batch',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery = await createTestDelivery({
        orderReference: `#BREAKDOWN-DEL-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      const route = await Route.create({
        routeCode: `RT-BREAKDOWN-${Date.now()}`,
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
        .post(`/api/v1/routes/${route._id}/mishap-recover`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Engine transmission failure on highway',
          mishapCategory: 'VEHICLE_BREAKDOWN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkVehicle = await Vehicle.findById(vehicle._id);
      expect(checkVehicle.availability).toBe('MAINTENANCE');

      const checkRoute = await Route.findById(route._id);
      expect(checkRoute.status).toBe('CANCELLED');
      expect(checkRoute.cancellationReason).toBe('Engine transmission failure on highway');
    });
  });

  describe('MISHAP-04: Multi-channel notifications and socket broadcast assertions', () => {
    test('Cascade recovery emits socket events (route:cancelled, deliveries:reassigned, driver:incident) and creates SystemNotification', async () => {
      const socketService = require('../src/services/socketService');
      const spyRouteCancelled = jest.spyOn(socketService, 'emitRouteCancelled');
      const spyDeliveriesReassigned = jest.spyOn(socketService, 'emitDeliveriesReassigned');
      const spyDriverIncident = jest.spyOn(socketService, 'emitDriverIncident');

      const driverUser = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ availability: 'IN_TRANSIT' });
      const driver = await createTestDriver(driverUser.user, {
        assignedVehicleId: vehicle._id,
        availability: 'IN_TRANSIT',
      });

      const batch = await DeliveryBatch.create({
        code: `BATCH-SOCKET-${Date.now()}`,
        name: 'Socket Batch',
        date: '2026-11-20',
        status: 'IN_PROGRESS',
      });

      const delivery1 = await createTestDelivery({
        orderReference: `#SOCKET-DEL-1-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      const delivery2 = await createTestDelivery({
        orderReference: `#SOCKET-DEL-2-${Date.now()}`,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
      });

      const routeCode = `RT-SOCKET-${Date.now()}`;
      const route = await Route.create({
        routeCode,
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'DISPATCHED',
        stops: [
          {
            sequence: 1,
            deliveryId: delivery1._id,
            orderReference: delivery1.orderReference,
            customer: delivery1.customer,
            address: delivery1.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery1.timeWindow,
            status: 'PENDING',
          },
          {
            sequence: 2,
            deliveryId: delivery2._id,
            orderReference: delivery2.orderReference,
            customer: delivery2.customer,
            address: delivery2.address,
            location: { lat: 20.2961, lng: 85.8645 },
            weightKg: 5,
            priority: 'Standard',
            timeWindow: delivery2.timeWindow,
            status: 'PENDING',
          },
        ],
      });

      // Update status to SUSPENDED with forceReassign=true
      const res = await request(app)
        .patch(`/api/v1/admin/users/${driverUser.user._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'SUSPENDED',
          reason: 'Severe safety infraction on duty',
          forceReassign: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.accountStatus).toBe('SUSPENDED');

      // Socket assertions
      expect(spyRouteCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: route._id.toString(),
          routeCode,
          driverId: driver._id.toString(),
          rescuedCount: 2,
        })
      );

      expect(spyDeliveriesReassigned).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: driver._id.toString(),
          routeId: route._id.toString(),
          routeCode,
          count: 2,
          rescuedDeliveryIds: expect.arrayContaining([
            delivery1._id.toString(),
            delivery2._id.toString(),
          ]),
        })
      );

      expect(spyDriverIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: driver._id.toString(),
          routeId: route._id.toString(),
          routeCode,
          incidentCategory: 'DRIVER_REMOVED',
        })
      );

      // SystemNotification assertion
      const SystemNotification = require('../src/models/SystemNotification');
      const notification = await SystemNotification.findOne({
        'metadata.routeId': route._id.toString(),
        severity: 'CRITICAL',
      });
      expect(notification).not.toBeNull();
      expect(notification.title).toContain('2 Consignments Rescued');
      expect(notification.category).toBe('SAFETY');

      spyRouteCancelled.mockRestore();
      spyDeliveriesReassigned.mockRestore();
      spyDriverIncident.mockRestore();
    });
  });
});
