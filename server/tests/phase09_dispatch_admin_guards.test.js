const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const Vehicle = require('../src/models/Vehicle');
const User = require('../src/models/User');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 09 Dispatch, CSV, Batch & Admin Guards (server/tests/phase09_dispatch_admin_guards.test.js)', () => {
  let adminToken;
  let adminUser;
  let managerToken;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
    adminUser = admin.user;

    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;
  });

  describe('1. Consignment Create/Edit Validation Parity & Batch Weight Sync (D-09, D-16)', () => {
    test('POST and PUT /deliveries enforce identical validation rules and handle unpadded time windows', async () => {
      // Create with unpadded time window "9:00" vs "17:00" and whitespace/lowercase orderReference
      const createRes = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          orderReference: '  #del-parity-01  ',
          customer: { name: '  Aarav Patnaik  ', phone: '+91 98610 12345' },
          address: { street: '  Plot 12, Patia  ', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 10,
          volumeM3: 0.25,
          serviceDurationMinutes: 15,
          timeWindow: { start: '9:00', end: '17:00' },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.orderReference).toBe('#DEL-PARITY-01');
      expect(createRes.body.data.customer.name).toBe('Aarav Patnaik');
      expect(createRes.body.data.timeWindow).toEqual({ start: '09:00', end: '17:00' });

      const deliveryId = createRes.body.data.id;

      // Reject negative/zero weight on PUT
      const badWeight = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ weightKg: 0 });
      expect(badWeight.status).toBe(400);
      expect(badWeight.body.error.code).toBe('INVALID_WEIGHT');

      // Reject negative volumeM3 on PUT
      const badVolume = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ volumeM3: -0.5 });
      expect(badVolume.status).toBe(400);
      expect(badVolume.body.error.code).toBe('INVALID_VOLUME');

      // Reject non-positive serviceDurationMinutes on PUT
      const badDuration = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ serviceDurationMinutes: 0 });
      expect(badDuration.status).toBe(400);
      expect(badDuration.body.error.code).toBe('INVALID_SERVICE_DURATION');

      // Reject inverted timeWindow on PUT
      const badTw = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ timeWindow: { start: '14:00', end: '9:00' } });
      expect(badTw.status).toBe(400);
      expect(badTw.body.error.code).toBe('INVALID_TIME_WINDOW');

      // Reject invalid phone on PUT
      const badPhone = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ customer: { phone: '12345' } });
      expect(badPhone.status).toBe(400);
      expect(badPhone.body.error.code).toBe('INVALID_PHONE');

      // Reject non-6-digit postalCode on PUT
      const badPostal = await request(app)
        .put(`/api/v1/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ address: { postalCode: '7510' } });
      expect(badPostal.status).toBe(400);
      expect(badPostal.body.error.code).toBe('INVALID_POSTAL_CODE');

      // Reject non-6-digit postalCode on POST too
      const badCreatePostal = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          orderReference: '#DEL-BAD-PIN',
          customer: { name: 'Bad Pin', phone: '9861012345' },
          address: { street: 'Main Rd', postalCode: 'ABC123' },
          weightKg: 5,
        });
      expect(badCreatePostal.status).toBe(400);
      expect(badCreatePostal.body.error.code).toBe('INVALID_POSTAL_CODE');
    });

    test('PUT /deliveries/:id recalculates parent batch totalWeightKg when weightKg changes', async () => {
      const d1 = await createTestDelivery({ orderReference: '#SYNC-01', weightKg: 10 });
      const d2 = await createTestDelivery({ orderReference: '#SYNC-02', weightKg: 15 });

      const batchRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: '  batch-sync-01  ',
          name: '  Weight Sync Batch  ',
          deliveryIds: [d1._id, d2._id],
        });
      expect(batchRes.status).toBe(201);
      expect(batchRes.body.data.batch.code).toBe('BATCH-SYNC-01');
      expect(batchRes.body.data.batch.name).toBe('Weight Sync Batch');
      expect(batchRes.body.data.batch.metrics.totalWeightKg).toBe(25);

      const batchId = batchRes.body.data.batch.id;

      // Update d1 weightKg from 10 -> 22.5
      const updateRes = await request(app)
        .put(`/api/v1/deliveries/${d1._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ weightKg: 22.5, timeWindow: { start: '9:00', end: '18:00' } });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.weightKg).toBe(22.5);

      const updatedBatch = await DeliveryBatch.findById(batchId);
      expect(updatedBatch.metrics.totalDeliveries).toBe(2);
      expect(updatedBatch.metrics.totalWeightKg).toBe(37.5);
    });
  });

  describe('2. Delivery CSV Dry-Run Parity & Collision Detection (D-14)', () => {
    test('dryRun=true trims/uppercases orderReference, detects DB collisions, and validates volume, duration, phone, postalCode', async () => {
      await createTestDelivery({ orderReference: '#CSV-COLLISION-01' });

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          dryRun: true,
          rows: [
            // Row 2: Valid with lowercase + whitespace orderReference & unpadded timeWindow
            {
              orderReference: '  #csv-fresh-01  ',
              customerName: 'Valid User',
              phone: '9861012345',
              address: 'Patia',
              postalCode: '751024',
              weightKg: 8,
              volumeM3: 0,
              serviceDurationMinutes: 12,
              timeWindowStart: '9:00',
              timeWindowEnd: '17:00',
            },
            // Row 3: DB collision via lowercase/trimmed orderReference
            {
              orderReference: '  #csv-collision-01 ',
              customerName: 'Dup User',
              phone: '+91 98610 11111',
              address: 'Jaydev Vihar',
              postalCode: '751013',
              weightKg: 5,
            },
            // Row 4: Negative volumeM3, bad postalCode, bad serviceDurationMinutes, short phone
            {
              orderReference: '#CSV-BAD-FIELDS',
              customerName: 'Bad Fields User',
              phone: '1234',
              address: 'Khandagiri',
              postalCode: '7510',
              weightKg: 4,
              volumeM3: -1.5,
              serviceDurationMinutes: 0,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.validRows).toBe(1);
      expect(res.body.data.invalidRows).toBe(2);
      expect(res.body.data.preview[0].orderReference).toBe('#CSV-FRESH-01');
      expect(res.body.data.preview[0].timeWindow).toEqual({ start: '09:00', end: '17:00' });

      const errors = res.body.data.errors;
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 3, field: 'orderReference', message: expect.stringMatching(/already exists/i) }),
          expect.objectContaining({ row: 4, field: 'phone' }),
          expect.objectContaining({ row: 4, field: 'postalCode' }),
          expect.objectContaining({ row: 4, field: 'volumeM3' }),
          expect.objectContaining({ row: 4, field: 'serviceDurationMinutes' }),
        ])
      );
    });
  });

  describe('3. Batch Eligibility & Active Route Lock Guards (D-15)', () => {
    test('POST /batches and POST /batches/:id/deliveries reject COMPLETED and OUT_FOR_DELIVERY consignments', async () => {
      const readyDel = await createTestDelivery({ orderReference: '#ELIG-READY', status: 'READY' });
      const completedDel = await createTestDelivery({ orderReference: '#INELIG-COMP', status: 'COMPLETED' });
      const ofdDel = await createTestDelivery({ orderReference: '#INELIG-OFD', status: 'OUT_FOR_DELIVERY' });

      const createComp = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'BATCH-COMP-FAIL', deliveryIds: [completedDel._id] });
      expect(createComp.status).toBe(400);
      expect(createComp.body.error.code).toBe('INELIGIBLE_DELIVERY_STATUS');

      const createOfd = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'BATCH-OFD-FAIL', deliveryIds: [ofdDel._id] });
      expect(createOfd.status).toBe(400);
      expect(createOfd.body.error.code).toBe('INELIGIBLE_DELIVERY_STATUS');

      const batchRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ code: 'BATCH-GOOD-01', deliveryIds: [readyDel._id] });
      expect(batchRes.status).toBe(201);
      const batchId = batchRes.body.data.batch.id;

      const addOfd = await request(app)
        .post(`/api/v1/batches/${batchId}/deliveries`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ deliveryIds: [ofdDel._id] });
      expect(addOfd.status).toBe(400);
      expect(addOfd.body.error.code).toBe('INELIGIBLE_DELIVERY_STATUS');
    });

    test('DELETE /batches/:id and PATCH /batches/:id/status (CLOSED) return 409 BATCH_HAS_ACTIVE_ROUTES while routes are DISPATCHED/IN_PROGRESS', async () => {
      const vehicle = await createTestVehicle({ vehicleId: 'OD02-BATCH-LOCK' });
      const d1 = await createTestDelivery({ orderReference: '#BL-01', status: 'READY' });
      const batch = await DeliveryBatch.create({
        code: 'BATCH-ACT-LOCK',
        name: 'Active Route Locked Batch',
        date: '2026-11-10',
        deliveryIds: [d1._id],
        vehicleIds: [vehicle._id],
        status: 'IN_PROGRESS',
        metrics: { totalDeliveries: 1, totalWeightKg: d1.weightKg, assignedDeliveries: 1 },
      });

      const route = await Route.create({
        routeCode: `RT-LOCK-${Date.now()}`,
        batchId: batch._id,
        vehicleId: vehicle._id,
        status: 'DISPATCHED',
        stops: [],
      });

      // Attempt to close batch -> 409 BATCH_HAS_ACTIVE_ROUTES
      const closeRes = await request(app)
        .patch(`/api/v1/batches/${batch._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CLOSED' });
      expect(closeRes.status).toBe(409);
      expect(closeRes.body.error.code).toBe('BATCH_HAS_ACTIVE_ROUTES');

      // Attempt to delete batch -> 409 BATCH_HAS_ACTIVE_ROUTES
      const delRes = await request(app)
        .delete(`/api/v1/batches/${batch._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('BATCH_HAS_ACTIVE_ROUTES');

      // Also verify IN_PROGRESS blocks deletion
      route.status = 'IN_PROGRESS';
      await route.save();
      const delInProg = await request(app)
        .delete(`/api/v1/batches/${batch._id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(delInProg.status).toBe(409);
      expect(delInProg.body.error.code).toBe('BATCH_HAS_ACTIVE_ROUTES');

      // Once route completes, batch can be closed
      route.status = 'COMPLETED';
      await route.save();
      const closeOk = await request(app)
        .patch(`/api/v1/batches/${batch._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CLOSED' });
      expect(closeOk.status).toBe(200);
      expect(closeOk.body.data.batch.status).toBe('CLOSED');
    });
  });

  describe('4. Last-Admin Protection & Admin RETIRE Active-Operation Guard (D-12, D-17)', () => {
    test('Last-Admin guard blocks demoting, deactivating, or deleting the sole remaining active ADMIN (409 LAST_ADMIN_PROTECTED)', async () => {
      // Single admin self-actions remain 403
      const selfDemote = await request(app)
        .put(`/api/v1/admin/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'FLEET_MANAGER' });
      expect(selfDemote.status).toBe(403);
      expect(selfDemote.body.error.code).toBe('SELF_DEMOTION_BLOCKED');

      const selfDelete = await request(app)
        .delete(`/api/v1/admin/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(selfDelete.status).toBe(403);
      expect(selfDelete.body.error.code).toBe('SELF_LOCKOUT_PREVENTED');

      // Create second admin so there are 2 active admins
      const admin2 = await createTestUser('ADMIN');

      // Admin 1 CAN demote Admin 2 while Admin 1 remains active (200)
      const demoteSecondRes = await request(app)
        .put(`/api/v1/admin/users/${admin2.user._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'FLEET_MANAGER', name: '  Demoted Admin Two  ', email: '  DEMOTED.TWO@SMARTROUTE.TEST  ' });
      expect(demoteSecondRes.status).toBe(200);
      expect(demoteSecondRes.body.data.user.role).toBe('FLEET_MANAGER');
      expect(demoteSecondRes.body.data.user.name).toBe('Demoted Admin Two');
      expect(demoteSecondRes.body.data.user.email).toBe('demoted.two@smartroute.test');

      // Now adminUser is the SOLE active ADMIN in the database.
      // Using admin2's existing ADMIN-signed JWT token (peer request) to remove adminUser's ADMIN access -> 409 LAST_ADMIN_PROTECTED
      const demoteLastRes = await request(app)
        .put(`/api/v1/admin/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${admin2.token}`)
        .send({ role: 'FLEET_MANAGER' });
      expect(demoteLastRes.status).toBe(409);
      expect(demoteLastRes.body.error.code).toBe('LAST_ADMIN_PROTECTED');

      const deactivateLastPutRes = await request(app)
        .put(`/api/v1/admin/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${admin2.token}`)
        .send({ accountStatus: 'INACTIVE' });
      expect(deactivateLastPutRes.status).toBe(409);
      expect(deactivateLastPutRes.body.error.code).toBe('LAST_ADMIN_PROTECTED');

      const suspendLastPatchRes = await request(app)
        .patch(`/api/v1/admin/users/${adminUser._id}/status`)
        .set('Authorization', `Bearer ${admin2.token}`)
        .send({ status: 'SUSPENDED', reason: 'Attempt last admin suspension' });
      expect(suspendLastPatchRes.status).toBe(409);
      expect(suspendLastPatchRes.body.error.code).toBe('LAST_ADMIN_PROTECTED');

      const deleteLastRes = await request(app)
        .delete(`/api/v1/admin/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${admin2.token}`);
      expect(deleteLastRes.status).toBe(409);
      expect(deleteLastRes.body.error.code).toBe('LAST_ADMIN_PROTECTED');

      // Verify sole active admin is still untouched in DB
      const verifiedAdmin = await User.findById(adminUser._id);
      expect(verifiedAdmin).not.toBeNull();
      expect(verifiedAdmin.role).toBe('ADMIN');
      expect(verifiedAdmin.accountStatus).toBe('ACTIVE');

      // Also verify DELETE /users/:id succeeds for a non-last-admin user
      const deleteNonAdmin = await request(app)
        .delete(`/api/v1/admin/users/${admin2.user._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteNonAdmin.status).toBe(200);
      expect(await User.findById(admin2.user._id)).toBeNull();
    });

    test('POST /admin/fleet-control/override RETIRE blocks with 409 ACTIVE_OPERATION_CONFLICT during IN_PROGRESS shift', async () => {
      const driverAccount = await createTestUser('DRIVER');
      const vehicle = await createTestVehicle({ vehicleId: 'OD02-ADM-RET-01' });
      const driver = await createTestDriver(driverAccount.user, { assignedVehicleId: vehicle._id });

      const shift = await DriverShift.create({
        driverId: driver._id,
        vehicleId: vehicle._id,
        date: new Date('2026-11-10T00:00:00Z'),
        startTime: '08:00',
        endTime: '17:00',
        status: 'IN_PROGRESS',
      });

      const blockedRetire = await request(app)
        .post('/api/v1/admin/fleet-control/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'VEHICLE',
          resourceId: vehicle._id,
          action: 'RETIRE',
          reason: 'Retiring fleet unit while driver is mid-shift',
        });
      expect(blockedRetire.status).toBe(409);
      expect(blockedRetire.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');

      // Complete shift -> RETIRE succeeds
      shift.status = 'COMPLETED';
      await shift.save();

      const allowedRetire = await request(app)
        .post('/api/v1/admin/fleet-control/override')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'VEHICLE',
          resourceId: vehicle._id,
          action: 'RETIRE',
          reason: 'End of lease cycle after shift completed',
        });
      expect(allowedRetire.status).toBe(200);
      const updatedVeh = await Vehicle.findById(vehicle._id);
      expect(updatedVeh.availability).toBe('RETIRED');
    });
  });

  describe('5. Active-Batch Consignment & Fleet Conflict Guards (Quick 261111-4fq)', () => {
    test('POST /batches rejects consignments already assigned to an active (non-CLOSED) batch with 409 DELIVERY_ALREADY_IN_BATCH', async () => {
      const del1 = await createTestDelivery({ orderReference: '#DUP-BATCH-101', status: 'READY' });
      const activeBatch = await DeliveryBatch.create({
        code: 'BBSR-ACT-101',
        name: 'Active Batch 101',
        date: '2026-11-11',
        deliveryIds: [del1._id],
        status: 'DRAFT',
        metrics: { totalDeliveries: 1, totalWeightKg: del1.weightKg, assignedDeliveries: 0 },
      });
      await Delivery.findByIdAndUpdate(del1._id, { batchId: activeBatch._id });

      const conflictRes = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BBSR-NEW-102',
          deliveryIds: [del1._id],
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('DELIVERY_ALREADY_IN_BATCH');
      expect(conflictRes.body.error.message).toContain('#DUP-BATCH-101');
      expect(conflictRes.body.error.message).toContain('BBSR-ACT-101');
    });

    test('POST /batches/:id/deliveries rejects consignments in another non-CLOSED batch (409) but allows same batch or previously CLOSED batch', async () => {
      const delInOther = await createTestDelivery({ orderReference: '#CONFLICT-201', status: 'READY' });
      const delSame = await createTestDelivery({ orderReference: '#SAME-202', status: 'READY' });
      const delFromClosed = await createTestDelivery({ orderReference: '#CLOSED-203', status: 'READY' });

      const otherBatch = await DeliveryBatch.create({
        code: 'BBSR-OTHER-201',
        name: 'Other Active Batch',
        date: '2026-11-11',
        deliveryIds: [delInOther._id],
        status: 'PLANNED',
      });
      await Delivery.findByIdAndUpdate(delInOther._id, { batchId: otherBatch._id });

      const closedBatch = await DeliveryBatch.create({
        code: 'BBSR-CLOSED-203',
        name: 'Closed Historical Batch',
        date: '2026-11-10',
        deliveryIds: [delFromClosed._id],
        status: 'CLOSED',
      });
      await Delivery.findByIdAndUpdate(delFromClosed._id, { batchId: closedBatch._id });

      const targetBatch = await DeliveryBatch.create({
        code: 'BBSR-TARGET-202',
        name: 'Target Batch',
        date: '2026-11-11',
        deliveryIds: [delSame._id],
        status: 'DRAFT',
      });
      await Delivery.findByIdAndUpdate(delSame._id, { batchId: targetBatch._id });

      // Adding consignment from another active batch -> 409 DELIVERY_ALREADY_IN_BATCH
      const conflictAdd = await request(app)
        .post(`/api/v1/batches/${targetBatch._id}/deliveries`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ deliveryIds: [delInOther._id] });

      expect(conflictAdd.status).toBe(409);
      expect(conflictAdd.body.error.code).toBe('DELIVERY_ALREADY_IN_BATCH');
      expect(conflictAdd.body.error.message).toContain('#CONFLICT-201');
      expect(conflictAdd.body.error.message).toContain('BBSR-OTHER-201');

      // Adding same-batch consignment + consignment previously in a CLOSED batch -> 200
      const okAdd = await request(app)
        .post(`/api/v1/batches/${targetBatch._id}/deliveries`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ deliveryIds: [delSame._id, delFromClosed._id] });

      expect(okAdd.status).toBe(200);
      expect(okAdd.body.data.batch.deliveryIds.map((id) => id.toString())).toEqual(
        expect.arrayContaining([delSame._id.toString(), delFromClosed._id.toString()])
      );
    });

    test('POST /batches and POST /batches/:id/assign reject MAINTENANCE/RETIRED vehicles (409 VEHICLE_UNAVAILABLE_FOR_SHIFT) and active route resources (409 ACTIVE_OPERATION_CONFLICT)', async () => {
      const maintVehicle = await createTestVehicle({
        vehicleId: 'OD02-MAINT-99',
        availability: 'MAINTENANCE',
      });
      const activeVehicle = await createTestVehicle({
        vehicleId: 'OD02-ACT-99',
        availability: 'IN_TRANSIT',
      });
      const driverUser = await createTestUser('DRIVER');
      const activeDriver = await createTestDriver(driverUser.user, {
        assignedVehicleId: activeVehicle._id,
        availability: 'IN_TRANSIT',
      });

      const activeRouteBatch = await DeliveryBatch.create({
        code: 'BATCH-ROUTE-ACT-99',
        name: 'Route Active Batch',
        date: '2026-11-11',
        status: 'IN_PROGRESS',
      });

      await Route.create({
        routeCode: `RT-ACT-99-${Date.now()}`,
        batchId: activeRouteBatch._id,
        vehicleId: activeVehicle._id,
        driverId: activeDriver._id,
        status: 'IN_PROGRESS',
        stops: [],
      });

      const delReady = await createTestDelivery({ orderReference: '#FLT-GRD-01', status: 'READY' });

      // 1. Create batch with MAINTENANCE vehicle -> 409 VEHICLE_UNAVAILABLE_FOR_SHIFT
      const maintCreate = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BATCH-MAINT-FAIL',
          deliveryIds: [delReady._id],
          vehicleIds: [maintVehicle._id],
        });
      expect(maintCreate.status).toBe(409);
      expect(maintCreate.body.error.code).toBe('VEHICLE_UNAVAILABLE_FOR_SHIFT');

      // 2. Create batch with active IN_PROGRESS route vehicle/driver -> 409 ACTIVE_OPERATION_CONFLICT
      const activeCreate = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: 'BATCH-ACTIVE-FAIL',
          deliveryIds: [delReady._id],
          vehicleIds: [activeVehicle._id],
          driverIds: [activeDriver._id],
        });
      expect(activeCreate.status).toBe(409);
      expect(activeCreate.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');

      // 3. Assign MAINTENANCE vehicle & active route driver to existing batch -> 409 guards
      const cleanBatch = await DeliveryBatch.create({
        code: 'BATCH-CLEAN-99',
        name: 'Clean Batch',
        date: '2026-11-11',
        status: 'DRAFT',
      });

      const maintAssign = await request(app)
        .post(`/api/v1/batches/${cleanBatch._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleIds: [maintVehicle._id] });
      expect(maintAssign.status).toBe(409);
      expect(maintAssign.body.error.code).toBe('VEHICLE_UNAVAILABLE_FOR_SHIFT');

      const activeAssign = await request(app)
        .post(`/api/v1/batches/${cleanBatch._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ driverIds: [activeDriver._id] });
      expect(activeAssign.status).toBe(409);
      expect(activeAssign.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
    });
  });
});
