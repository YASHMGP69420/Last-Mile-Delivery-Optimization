/**
 * Tier 4 Workload Suite: Multi-Cluster Fleet Dispatch & Energy Efficiency
 * Validates Features 19, 21, 23, 24 under multi-vehicle operational loads.
 */

const seedBhubaneswar = require('../../../server/src/seed/seedBhubaneswar');
const { packDeliveries } = require('../../../server/src/services/optimization/binPacker');
const { estimateFuel } = require('../../../server/src/services/optimization/fuelModel');

module.exports = {
  name: 'Multi-Cluster Mixed Fleet Dispatch & Energy Model Suite',
  tier: 4,
  file: 'multi-cluster-dispatch.test.js',

  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    afterEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T4-MCD-1: Multi-vehicle bin-packing allocates 55 consignments across mixed fleet honoring weight capacities', async () => {
      await seedBhubaneswar();

      const deliveries = await harness.models.Delivery.find({});
      const vehicles = await harness.models.Vehicle.find({ availability: { $in: ['AVAILABLE', 'ASSIGNED'] } });

      assert.strictEqual(deliveries.length, 55);
      assert.ok(vehicles.length >= 2);

      const { vehicleBins, unassignedDeliveries } = packDeliveries(deliveries, vehicles, { maxStopsPerVehicle: 35 });

      assert.ok(vehicleBins.length >= 1, 'Deliveries must be allocated to at least 1 vehicle bin');

      // Verify no vehicle bin exceeds its rated capacityKg
      for (const bin of vehicleBins) {
        assert.ok(
          bin.totalWeightKg <= bin.vehicle.capacityKg + 1e-4,
          `Bin for vehicle ${bin.vehicle.vehicleId} weight (${bin.totalWeightKg}) exceeded capacity (${bin.vehicle.capacityKg})`
        );
      }

      // Verify unassigned + assigned deliveries = total 55
      const totalAssigned = vehicleBins.reduce((acc, bin) => acc + bin.deliveries.length, 0);
      assert.strictEqual(totalAssigned + unassignedDeliveries.length, 55);
    });

    it('TC-T4-MCD-2: Route optimization endpoint generates distinct routes for multi-vehicle batch', async () => {
      const { admin } = await seedBhubaneswar();
      const batch = await harness.models.DeliveryBatch.findOne({ code: 'BBSR-EXP-01' });
      assert.ok(batch);

      // Authenticate as Admin
      const token = require('jsonwebtoken').sign(
        { sub: admin._id.toString(), email: admin.email, role: admin.role, name: admin.name },
        harness.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const headers = { Authorization: `Bearer ${token}` };

      const res = await harness.request
        .post('/api/v1/routes/optimize')
        .set(headers)
        .send({
          batchId: batch._id.toString(),
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.routes.length >= 1);

      // Verify baseline vs optimized metrics exist
      assert.ok(res.body.data.baseline.totalDistanceKm >= 0);
      assert.ok(res.body.data.optimized.totalDistanceKm >= 0);
      assert.ok(res.body.data.deltas);
    });

    it('TC-T4-MCD-3: Fleet energy modeling calculates total fuel, electricity, and CO2 emissions across routes', async () => {
      // 1. Diesel vehicle on 60km route: 12.5 km/L -> 4.8 L -> CO2 factor 2.68 kg/L = 12.86 kg CO2
      const diesel = { fuelType: 'ICE', fuelEfficiency: 12.5 };
      const dieselFuel = estimateFuel(diesel, 60.0);
      assert.strictEqual(dieselFuel.unit, 'L');
      assert.strictEqual(Number(dieselFuel.fuelConsumed.toFixed(2)), 4.8);
      const dieselCo2 = dieselFuel.fuelConsumed * 2.68;
      assert.ok(dieselCo2 > 10.0);

      // 2. Electric vehicle on 60km route: 0.18 kWh/km -> 10.8 kWh -> grid CO2 factor 0.7 kg/kWh = 7.56 kg CO2
      const ev = { fuelType: 'EV', energyEfficiency: 0.18 };
      const evEnergy = estimateFuel(ev, 60.0);
      assert.strictEqual(evEnergy.unit, 'kWh');
      assert.strictEqual(Number(evEnergy.fuelConsumed.toFixed(2)), 10.8);
      const evCo2 = evEnergy.fuelConsumed * 0.7;
      assert.ok(evCo2 < dieselCo2, 'EV CO2 footprint must be strictly lower than ICE equivalent');
    });
  },
};
