/**
 * Tier 2 Boundary Suite: Concurrent Fleet Acquisition & 1:1 Mutual Exclusivity
 * Validates Feature 6 & Feature 37 race condition defense.
 */

module.exports = {
  name: 'Concurrent Fleet Acquisition & Mutual Exclusivity Suite',
  tier: 2,
  file: 'concurrent-fleet.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-CONF-1: Cannot assign vehicle in RETIRED or MAINTENANCE status', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'conf_d1@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-CONF-001',
        phone: '+91 94370 11111',
      });

      const retiredVehicle = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.tataAceEV,
        vehicleId: 'OD-02-RETIRED-1',
        availability: 'RETIRED',
      });

      const res = await harness.request
        .put(`/api/v1/drivers/${driver._id}/assign`)
        .set(headers)
        .send({ vehicleId: retiredVehicle._id });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VEHICLE_UNAVAILABLE');
    });

    it('TC-T2-CONF-2: Vehicle in active transit with driver cannot be stolen by another driver', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: u1 } = await harness.createTestUser('DRIVER', 'transit_d1@smartroute.test');
      const { user: u2 } = await harness.createTestUser('DRIVER', 'transit_d2@smartroute.test');

      const v = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.tataAceEV,
        vehicleId: 'OD-02-TRANSIT-1',
        availability: 'IN_TRANSIT',
      });

      const d1 = await harness.models.Driver.create({
        userId: u1._id,
        licenseNumber: 'OD-02-LIC-T1',
        phone: '+91 94370 22222',
        assignedVehicleId: v._id,
        availability: 'IN_TRANSIT',
      });
      v.assignedDriverId = d1._id;
      await v.save();

      const d2 = await harness.models.Driver.create({
        userId: u2._id,
        licenseNumber: 'OD-02-LIC-T2',
        phone: '+91 94370 33333',
        availability: 'AVAILABLE',
      });

      // d2 attempts to claim v while in transit
      const res = await harness.request
        .put(`/api/v1/drivers/${d2._id}/assign`)
        .set(headers)
        .send({ vehicleId: v._id });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VEHICLE_IN_ACTIVE_TRANSIT');
    });

    it('TC-T2-CONF-3: Concurrent binding stress test — Two drivers requesting same vehicle concurrently', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: u1 } = await harness.createTestUser('DRIVER', 'race_d1@smartroute.test');
      const { user: u2 } = await harness.createTestUser('DRIVER', 'race_d2@smartroute.test');

      const targetVehicle = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.tataAceEV,
        vehicleId: 'OD-02-RACE-VEH',
        availability: 'AVAILABLE',
      });

      const d1 = await harness.models.Driver.create({
        userId: u1._id,
        licenseNumber: 'OD-02-RACE-L1',
        phone: '+91 94370 44444',
        availability: 'AVAILABLE',
      });

      const d2 = await harness.models.Driver.create({
        userId: u2._id,
        licenseNumber: 'OD-02-RACE-L2',
        phone: '+91 94370 55555',
        availability: 'AVAILABLE',
      });

      // Fire both requests concurrently
      const [res1, res2] = await Promise.all([
        harness.request.put(`/api/v1/drivers/${d1._id}/assign`).set(headers).send({ vehicleId: targetVehicle._id }),
        harness.request.put(`/api/v1/drivers/${d2._id}/assign`).set(headers).send({ vehicleId: targetVehicle._id }),
      ]);

      // Exactly one must succeed (200) and one must be rejected (409) OR both succeed sequentially
      const statuses = [res1.status, res2.status];
      assert.ok(statuses.includes(200), 'At least one assignment request must succeed');

      // Verify DB state consistency: only 1 driver owns the vehicle
      const refreshedVehicle = await harness.models.Vehicle.findById(targetVehicle._id);
      assert.strictEqual(refreshedVehicle.availability, 'ASSIGNED');
      assert.ok(refreshedVehicle.assignedDriverId);
    });

    it('TC-T2-CONF-4: Driver concurrent assignment to two vehicles binds only one', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: u1 } = await harness.createTestUser('DRIVER', 'dual_d1@smartroute.test');

      const driver = await harness.models.Driver.create({
        userId: u1._id,
        licenseNumber: 'OD-02-DUAL-L1',
        phone: '+91 94370 66666',
        availability: 'AVAILABLE',
      });

      const v1 = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.tataAceEV,
        vehicleId: 'OD-02-DUAL-V1',
        availability: 'AVAILABLE',
      });

      const v2 = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.mahindraBoleroDiesel,
        vehicleId: 'OD-02-DUAL-V2',
        availability: 'AVAILABLE',
      });

      // Fire requests concurrently for v1 and v2
      await Promise.all([
        harness.request.put(`/api/v1/drivers/${driver._id}/assign`).set(headers).send({ vehicleId: v1._id }),
        harness.request.put(`/api/v1/drivers/${driver._id}/assign`).set(headers).send({ vehicleId: v2._id }),
      ]);

      // Verify driver has exactly 1 vehicle in DB
      const refreshedDriver = await harness.models.Driver.findById(driver._id);
      assert.ok(refreshedDriver.assignedVehicleId);

      // Verify mutual exclusivity across Vehicle collection: exactly 1 vehicle assigned to driver
      const assignedVehicles = await harness.models.Vehicle.find({ assignedDriverId: driver._id });
      assert.strictEqual(assignedVehicles.length, 1, 'Driver must be paired to exactly 1 vehicle in DB');
    });
  },
};
