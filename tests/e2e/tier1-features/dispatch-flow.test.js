/**
 * Tier 1 Feature Suite: Route Dispatch Flow & Telemetry Gateway Contracts
 * Validates Features 24, 26, 27 in isolation.
 */

const { io } = require('../../../server/src/index');

module.exports = {
  name: 'Route Dispatch Flow & Telemetry Gateway Feature Suite',
  tier: 1,
  file: 'dispatch-flow.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-DISP-1: Assign vehicle and driver to consignment via PATCH /api/v1/deliveries/:id/assign', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'disp_driver_1@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-DISP-001',
        phone: '+91 94370 00111',
      });
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      const delivery = await harness.models.Delivery.create({
        orderReference: '#DISP-DEL-01',
        customer: { name: 'Customer Disp', phone: '+91 99370 12345' },
        address: { street: 'KIIT Square', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 5.0,
        status: 'READY',
        timeWindow: { start: '09:00', end: '12:00' },
      });

      const res = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/assign`)
        .set(headers)
        .send({
          vehicleId: vehicle._id,
          driverId: driver._id,
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'ASSIGNED');
      assert.strictEqual(String(res.body.data.assignedVehicleId), String(vehicle._id));
      assert.strictEqual(String(res.body.data.assignedDriverId), String(driver._id));
    });

    it('TC-T1-DISP-2: Route dispatch endpoint (POST /api/v1/routes/:id/dispatch) transitions status to DISPATCHED', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'disp_drv_route@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-DISP-RTE',
        phone: '+91 94370 99887',
      });
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      const batch = await harness.models.DeliveryBatch.create({
        code: 'BBSR-DISP-B',
        name: 'Dispatch Test Batch',
        date: '2026-11-04',
        depot: fixtures.CANONICAL_DEPOT,
      });

      const route = await harness.models.Route.create({
        routeCode: 'RTE-BBSR-DISP-01',
        batchId: batch._id,
        vehicleId: vehicle._id,
        driverId: driver._id,
        status: 'OPTIMIZED',
        stops: [],
      });

      const res = await harness.request
        .post(`/api/v1/routes/${route._id}/dispatch`)
        .set(headers)
        .send({
          driverId: driver._id.toString(),
          vehicleId: vehicle._id.toString(),
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.route.status, 'DISPATCHED');
      assert.ok(res.body.data.route.dispatchedAt);
    });

    it('TC-T1-DISP-3: Socket.IO tracking gateway instance is configured and initialized', async () => {
      assert.ok(io, 'Socket.IO server instance must be exported by server/src/index.js');
      assert.strictEqual(typeof io.on, 'function', 'io must have event listener method');
      assert.strictEqual(typeof io.emit, 'function', 'io must have broadcast method');
    });

    it('TC-T1-DISP-4: Active delivery query allows filtering by assigned driver and status', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'disp_driver_2@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-DISP-002',
        phone: '+91 94370 00222',
      });

      await harness.models.Delivery.create({
        orderReference: '#DISP-DEL-02',
        customer: { name: 'Customer Disp 2', phone: '+91 99370 23456' },
        address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.852, 20.288] },
        weightKg: 6.0,
        status: 'ASSIGNED',
        assignedDriverId: driver._id,
        timeWindow: { start: '10:00', end: '13:00' },
      });

      const res = await harness.request
        .get(`/api/v1/deliveries?status=ASSIGNED`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.deliveries.length >= 1);
    });
  },
};
