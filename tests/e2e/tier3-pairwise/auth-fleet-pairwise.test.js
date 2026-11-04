/**
 * Tier 3 Pairwise Suite: Auth & RBAC + Fleet Vehicle & Driver Operations
 * Validates cross-feature interactions between Features 1, 2, 4, 5, 6.
 */

module.exports = {
  name: 'Auth + Fleet Operations Pairwise Suite',
  tier: 3,
  file: 'auth-fleet-pairwise.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T3-AF-1: Complete user provisioning to fleet pairing operational sequence', async () => {
      const { headers: adminHeaders } = await harness.getAuthHeaders('ADMIN');

      // 1. Admin provisions new Fleet Manager
      const mgrEmail = `mgr_${Date.now()}@smartroute.test`;
      const mgrRes = await harness.request
        .post('/api/v1/auth/users')
        .set(adminHeaders)
        .send({
          name: 'Prakash Jena',
          email: mgrEmail,
          password: 'Password123!',
          role: 'FLEET_MANAGER',
        });
      assert.strictEqual(mgrRes.status, 201);

      // 2. Admin provisions new Driver
      const drvEmail = `drv_${Date.now()}@smartroute.test`;
      const drvRes = await harness.request
        .post('/api/v1/auth/users')
        .set(adminHeaders)
        .send({
          name: 'Niranjan Sahu',
          email: drvEmail,
          password: 'Password123!',
          role: 'DRIVER',
          licenseNumber: 'OD-02-PW-001',
          phone: '+91 94370 12399',
        });
      assert.strictEqual(drvRes.status, 201);
      const driverId = drvRes.body.data.driver ? drvRes.body.data.driver._id : null;

      // 3. Manager logs in with credentials
      const loginRes = await harness.request
        .post('/api/v1/auth/login')
        .send({ email: mgrEmail, password: 'Password123!' });
      assert.strictEqual(loginRes.status, 200);
      const mgrHeaders = { Authorization: `Bearer ${loginRes.body.data.token}` };

      // 4. Manager registers new vehicle
      const vehRes = await harness.request
        .post('/api/v1/vehicles')
        .set(mgrHeaders)
        .send({
          vehicleId: 'OD-02-PW-VEH',
          makeModel: 'Tata Ace EV Pairwise',
          type: 'Van',
          capacityKg: 1000,
          capacityM3: 4.5,
          fuelType: 'Electric',
          energyKWhPerKm: 0.18,
          batterySoC: 90,
        });
      assert.strictEqual(vehRes.status, 201);
      const vehicleId = vehRes.body.data.vehicle._id;

      // 5. Manager assigns driver to vehicle (if driver profile exists)
      if (driverId) {
        const assignRes = await harness.request
          .put(`/api/v1/drivers/${driverId}/assign`)
          .set(mgrHeaders)
          .send({ vehicleId });
        assert.strictEqual(assignRes.status, 200);
        assert.strictEqual(assignRes.body.data.vehicle.availability, 'ASSIGNED');
      }
    });

    it('TC-T3-AF-2: Driver cannot register, edit, or retire vehicles (enforces RBAC matrix)', async () => {
      const { headers: driverHeaders } = await harness.getAuthHeaders('DRIVER');
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      // Attempt vehicle creation
      const createRes = await harness.request
        .post('/api/v1/vehicles')
        .set(driverHeaders)
        .send(fixtures.VEHICLE_FIXTURES.mahindraBoleroDiesel);
      assert.strictEqual(createRes.status, 403);
      assert.strictEqual(createRes.body.error.code, 'INSUFFICIENT_PERMISSIONS');

      // Attempt vehicle update
      const updateRes = await harness.request
        .put(`/api/v1/vehicles/${vehicle._id}`)
        .set(driverHeaders)
        .send({ capacityKg: 1500 });
      assert.strictEqual(updateRes.status, 403);

      // Attempt vehicle deletion
      const deleteRes = await harness.request
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set(driverHeaders);
      assert.strictEqual(deleteRes.status, 403);
    });

    it('TC-T3-AF-3: Admin soft-deleting assigned vehicle automatically unpairs driver', async () => {
      const { headers: adminHeaders } = await harness.getAuthHeaders('ADMIN');
      const { user: drvUser } = await harness.createTestUser('DRIVER', 'unpair_test@smartroute.test');

      const vehicle = await harness.models.Vehicle.create({
        ...fixtures.VEHICLE_FIXTURES.tataAceEV,
        vehicleId: 'OD-02-UNPAIR-1',
        availability: 'ASSIGNED',
      });

      const driver = await harness.models.Driver.create({
        userId: drvUser._id,
        licenseNumber: 'OD-02-LIC-UNP',
        phone: '+91 94370 77112',
        assignedVehicleId: vehicle._id,
        availability: 'AVAILABLE',
      });

      vehicle.assignedDriverId = driver._id;
      await vehicle.save();

      // Admin retires vehicle
      const res = await harness.request
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set(adminHeaders);

      assert.strictEqual(res.status, 200);

      const refreshedVehicle = await harness.models.Vehicle.findById(vehicle._id);
      const refreshedDriver = await harness.models.Driver.findById(driver._id);

      assert.strictEqual(refreshedVehicle.availability, 'RETIRED');
      assert.strictEqual(refreshedVehicle.assignedDriverId, null);
      assert.strictEqual(refreshedDriver.assignedVehicleId, null);
    });
  },
};
