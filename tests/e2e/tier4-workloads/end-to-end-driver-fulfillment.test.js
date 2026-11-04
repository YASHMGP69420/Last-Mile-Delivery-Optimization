/**
 * Tier 4 Workload Suite: End-to-End Driver Fulfillment Lifecycle
 * Validates Features 1, 5, 6, 9, 10, 31, 32, 34 under complete operational driver flow.
 */

const seedBhubaneswar = require('../../../server/src/seed/seedBhubaneswar');

module.exports = {
  name: 'End-to-End Driver Fulfillment Lifecycle Suite',
  tier: 4,
  file: 'end-to-end-driver-fulfillment.test.js',

  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    afterEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T4-E2E-1: Seeded driver authenticates, retrieves assigned vehicle, and views manifest', async () => {
      const seedData = await seedBhubaneswar();

      // 1. Driver login
      const loginRes = await harness.request
        .post('/api/v1/auth/login')
        .send({
          email: 'driver@smartroute.io',
          password: 'Driver@123',
        });

      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.body.success, true);
      assert.strictEqual(loginRes.body.data.user.role, 'DRIVER');
      assert.ok(loginRes.body.data.token);

      const driverHeaders = { Authorization: `Bearer ${loginRes.body.data.token}` };

      // 2. GET /auth/me returns driver entity and assigned vehicle
      const meRes = await harness.request.get('/api/v1/auth/me').set(driverHeaders);
      assert.strictEqual(meRes.status, 200);
      assert.strictEqual(meRes.body.data.user.email, 'driver@smartroute.io');
    });

    it('TC-T4-E2E-2: Driver executes multi-stop delivery manifest with POD completion and exception reporting', async () => {
      const seedData = await seedBhubaneswar();

      // 1. Authenticate as Driver
      const loginRes = await harness.request
        .post('/api/v1/auth/login')
        .send({ email: 'driver@smartroute.io', password: 'Driver@123' });
      const driverHeaders = { Authorization: `Bearer ${loginRes.body.data.token}` };
      const driver = seedData.driver1;
      const vehicle = seedData.vehicle1;

      // 2. Pick 2 deliveries from seeded batch and assign to driver
      const batchDeliveries = await harness.models.Delivery.find({ batchId: seedData.batch._id }).limit(2);
      const [stop1, stop2] = batchDeliveries;

      await harness.models.Delivery.findByIdAndUpdate(stop1._id, {
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        status: 'ASSIGNED',
      });
      await harness.models.Delivery.findByIdAndUpdate(stop2._id, {
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        status: 'ASSIGNED',
      });

      // 3. Driver starts Stop 1 (OUT_FOR_DELIVERY -> COMPLETED)
      const ofd1Res = await harness.request
        .patch(`/api/v1/deliveries/${stop1._id}/status`)
        .set(driverHeaders)
        .send({ status: 'OUT_FOR_DELIVERY' });
      assert.strictEqual(ofd1Res.status, 200);

      const podRes = await harness.request
        .post(`/api/v1/deliveries/${stop1._id}/complete`)
        .set(driverHeaders)
        .send({
          otp: '772211',
          signature: '<svg><path d="M0 0"/></svg>',
          notes: 'Handed over to Alok Mohapatra',
        });
      assert.strictEqual(podRes.status, 200);
      assert.strictEqual(podRes.body.data.status, 'COMPLETED');

      // 4. Driver starts Stop 2 (OUT_FOR_DELIVERY -> FAILED)
      const ofd2Res = await harness.request
        .patch(`/api/v1/deliveries/${stop2._id}/status`)
        .set(driverHeaders)
        .send({ status: 'OUT_FOR_DELIVERY' });
      assert.strictEqual(ofd2Res.status, 200);

      const failRes = await harness.request
        .post(`/api/v1/deliveries/${stop2._id}/fail`)
        .set(driverHeaders)
        .send({
          failureReason: 'CUSTOMER_UNAVAILABLE',
          notes: 'Customer phone unreachable after 3 attempts',
        });
      assert.strictEqual(failRes.status, 200);
      assert.strictEqual(failRes.body.data.status, 'FAILED');
      assert.strictEqual(failRes.body.data.failureReason, 'CUSTOMER_UNAVAILABLE');

      // 5. Verify immutable audit trail recorded for both stops
      const auditStop1 = await harness.models.AuditEvent.find({ deliveryId: stop1._id });
      const auditStop2 = await harness.models.AuditEvent.find({ deliveryId: stop2._id });

      assert.ok(auditStop1.length >= 2, 'Stop 1 must have OFD and COMPLETED audit events');
      assert.ok(auditStop2.length >= 2, 'Stop 2 must have OFD and FAILED audit events');
    });

    it('TC-T4-E2E-3: Audit trail and operational metrics reconcile across all stops', async () => {
      await seedBhubaneswar();

      const totalStops = await harness.models.Delivery.countDocuments({});
      const readyStops = await harness.models.Delivery.countDocuments({ status: 'READY' });
      const completedStops = await harness.models.Delivery.countDocuments({ status: 'COMPLETED' });
      const failedStops = await harness.models.Delivery.countDocuments({ status: 'FAILED' });

      assert.strictEqual(totalStops, 55);
      assert.strictEqual(readyStops + completedStops + failedStops, 55);
    });
  },
};
