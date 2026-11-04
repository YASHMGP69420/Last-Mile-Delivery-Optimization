/**
 * Tier 1 Feature Suite: Driver Profiles & 1:1 Vehicle Pairing
 * Validates Features 5 & 6 in isolation.
 */

module.exports = {
  name: 'Driver Registry & 1:1 Pairing Feature Suite',
  tier: 1,
  file: 'drivers.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-DRV-1: Create driver profile linked to user returns 201', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'driver_t1_1@smartroute.test');

      const res = await harness.request
        .post('/api/v1/drivers')
        .set(headers)
        .send({
          userId: driverUser._id,
          licenseNumber: 'OD-02-2022-998877',
          phone: '+91 94370 11223',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.driver.licenseNumber, 'OD-02-2022-998877');
      assert.strictEqual(res.body.data.driver.availability, 'AVAILABLE');
    });

    it('TC-T1-DRV-2: GET /api/v1/drivers/:id retrieves driver profile with user entity', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'driver_t1_2@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-2021-123456',
        phone: '+91 94370 22334',
        availability: 'AVAILABLE',
      });

      const res = await harness.request
        .get(`/api/v1/drivers/${driver._id}`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.driver.licenseNumber, 'OD-02-2021-123456');
      assert.ok(res.body.data.driver.userId);
      assert.strictEqual(res.body.data.driver.userId.email, driverUser.email);
    });

    it('TC-T1-DRV-3: 1:1 Vehicle Assignment binds vehicle and sets status to ASSIGNED', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'driver_t1_3@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-2020-554433',
        phone: '+91 94370 33445',
        availability: 'AVAILABLE',
      });
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      const res = await harness.request
        .put(`/api/v1/drivers/${driver._id}/assign`)
        .set(headers)
        .send({ vehicleId: vehicle._id });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify DB mutations
      const updatedDriver = await harness.models.Driver.findById(driver._id);
      const updatedVehicle = await harness.models.Vehicle.findById(vehicle._id);

      assert.strictEqual(String(updatedDriver.assignedVehicleId), String(vehicle._id));
      assert.strictEqual(String(updatedVehicle.assignedDriverId), String(driver._id));
      assert.strictEqual(updatedVehicle.availability, 'ASSIGNED');
    });

    it('TC-T1-DRV-4: Reassigning driver to new vehicle frees previous vehicle to AVAILABLE', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'driver_t1_4@smartroute.test');
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-2020-667788',
        phone: '+91 94370 44556',
        availability: 'AVAILABLE',
      });
      const v1 = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      const v2 = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.mahindraBoleroDiesel);

      // Assign to v1 first
      await harness.request
        .put(`/api/v1/drivers/${driver._id}/assign`)
        .set(headers)
        .send({ vehicleId: v1._id });

      // Reassign to v2
      const res = await harness.request
        .put(`/api/v1/drivers/${driver._id}/assign`)
        .set(headers)
        .send({ vehicleId: v2._id });

      assert.strictEqual(res.status, 200);

      const updatedV1 = await harness.models.Vehicle.findById(v1._id);
      const updatedV2 = await harness.models.Vehicle.findById(v2._id);
      assert.strictEqual(updatedV1.availability, 'AVAILABLE');
      assert.strictEqual(updatedV1.assignedDriverId, null);
      assert.strictEqual(updatedV2.availability, 'ASSIGNED');
      assert.strictEqual(String(updatedV2.assignedDriverId), String(driver._id));
    });

    it('TC-T1-DRV-5: Unassigning driver frees vehicle and updates driver availability', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: driverUser } = await harness.createTestUser('DRIVER', 'driver_t1_5@smartroute.test');
      const v1 = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      const driver = await harness.models.Driver.create({
        userId: driverUser._id,
        licenseNumber: 'OD-02-2020-778899',
        phone: '+91 94370 55667',
        assignedVehicleId: v1._id,
        availability: 'AVAILABLE',
      });
      v1.assignedDriverId = driver._id;
      v1.availability = 'ASSIGNED';
      await v1.save();

      const res = await harness.request
        .put(`/api/v1/drivers/${driver._id}/unassign`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const updatedVehicle = await harness.models.Vehicle.findById(v1._id);
      const updatedDriver = await harness.models.Driver.findById(driver._id);
      assert.strictEqual(updatedVehicle.availability, 'AVAILABLE');
      assert.strictEqual(updatedVehicle.assignedDriverId, null);
      assert.strictEqual(updatedDriver.assignedVehicleId, null);
    });
  },
};
