/**
 * Tier 1 Feature Suite: Vehicle Registry CRUD & Specifications
 * Validates Feature 4 in isolation.
 */

module.exports = {
  name: 'Vehicle Registry Feature Suite',
  tier: 1,
  file: 'vehicles.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-VEH-1: Register Diesel vehicle with kmPerLitre returns 201 with valid schema', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const dieselVehiclePayload = {
        vehicleId: 'OD-02-DIESEL-01',
        makeModel: 'Mahindra Bolero Maxi Truck',
        type: 'Van',
        capacityKg: 1200,
        capacityM3: 5.2,
        fuelType: 'Diesel',
        kmPerLitre: 12.5,
        availability: 'AVAILABLE',
      };

      const res = await harness.request
        .post('/api/v1/vehicles')
        .set(headers)
        .send(dieselVehiclePayload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.vehicle.vehicleId, 'OD-02-DIESEL-01');
      assert.strictEqual(res.body.data.vehicle.fuelType, 'Diesel');
      assert.strictEqual(res.body.data.vehicle.kmPerLitre, 12.5);
      assert.strictEqual(res.body.data.vehicle.energyKWhPerKm, null);
    });

    it('TC-T1-VEH-2: Register Electric vehicle with energyKWhPerKm returns 201', async () => {
      const { headers } = await harness.getAuthHeaders('ADMIN');

      const evPayload = {
        vehicleId: 'OD-02-EV-02',
        makeModel: 'Tata Ace EV',
        type: 'Van',
        capacityKg: 1000,
        capacityM3: 4.5,
        fuelType: 'Electric',
        energyKWhPerKm: 0.18,
        batterySoC: 95,
        availability: 'AVAILABLE',
      };

      const res = await harness.request
        .post('/api/v1/vehicles')
        .set(headers)
        .send(evPayload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.vehicle.fuelType, 'Electric');
      assert.strictEqual(res.body.data.vehicle.energyKWhPerKm, 0.18);
      assert.strictEqual(res.body.data.vehicle.batterySoC, 95);
    });

    it('TC-T1-VEH-3: Query fleet vehicles with fuelType filter returns matching vehicles', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.mahindraBoleroDiesel);

      const res = await harness.request
        .get('/api/v1/vehicles?fuelType=Electric')
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.vehicles));
      assert.strictEqual(res.body.data.vehicles.length, 1);
      assert.strictEqual(res.body.data.vehicles[0].vehicleId, fixtures.VEHICLE_FIXTURES.tataAceEV.vehicleId);
    });

    it('TC-T1-VEH-4: Update vehicle capacity and maintenance status returns 200', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);

      const res = await harness.request
        .put(`/api/v1/vehicles/${vehicle._id}`)
        .set(headers)
        .send({
          capacityKg: 1100,
          availability: 'MAINTENANCE',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.vehicle.capacityKg, 1100);
      assert.strictEqual(res.body.data.vehicle.availability, 'MAINTENANCE');
    });

    it('TC-T1-VEH-5: Soft delete vehicle (DELETE /api/v1/vehicles/:id) marks availability as RETIRED', async () => {
      const { headers } = await harness.getAuthHeaders('ADMIN');
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.heroElectricBike);

      const res = await harness.request
        .delete(`/api/v1/vehicles/${vehicle._id}`)
        .set(headers);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const updated = await harness.models.Vehicle.findById(vehicle._id);
      assert.strictEqual(updated.availability, 'RETIRED');
    });
  },
};
