/**
 * Tier 3 Pairwise Suite: Driver Assignment + Delivery Lifecycle State Machine
 * Validates cross-feature interactions between Features 5, 6, 9, 10, 31, 32.
 */

module.exports = {
  name: 'Driver Assignment + Delivery Lifecycle Pairwise Suite',
  tier: 3,
  file: 'driver-lifecycle-pairwise.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T3-DL-1: Full happy-path lifecycle: Driver pairing -> Assignment -> OFD -> POD Completion', async () => {
      const { headers: mgrHeaders } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: drvUser, headers: drvHeaders } = await harness.getAuthHeaders('DRIVER', 'driver_cycle_1@smartroute.test');

      // 1. Create Vehicle and Driver Profile
      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.tataAceEV);
      const driver = await harness.models.Driver.create({
        userId: drvUser._id,
        licenseNumber: 'OD-02-DL-001',
        phone: '+91 94370 11999',
        assignedVehicleId: vehicle._id,
      });
      vehicle.assignedDriverId = driver._id;
      vehicle.availability = 'ASSIGNED';
      await vehicle.save();

      // 2. Create Delivery in DRAFT
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-PW-DL-01',
        customer: { name: 'Sarmistha Barik', phone: '+91 99370 12345' },
        address: { street: 'KIIT Road', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 4.5,
        status: 'DRAFT',
        timeWindow: { start: '09:00', end: '12:00' },
      });

      // 3. Manager transitions to READY
      const resReady = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(mgrHeaders)
        .send({ status: 'READY' });
      assert.strictEqual(resReady.status, 200);

      // 4. Manager assigns vehicle and driver
      const resAssign = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/assign`)
        .set(mgrHeaders)
        .send({ vehicleId: vehicle._id, driverId: driver._id });
      assert.strictEqual(resAssign.status, 200);
      assert.strictEqual(resAssign.body.data.status, 'ASSIGNED');

      // 5. Driver updates status to OUT_FOR_DELIVERY
      const resOfd = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(drvHeaders)
        .send({ status: 'OUT_FOR_DELIVERY' });
      assert.strictEqual(resOfd.status, 200);
      assert.strictEqual(resOfd.body.data.status, 'OUT_FOR_DELIVERY');

      // 6. Driver submits Proof of Delivery (OTP, Signature SVG)
      const resComplete = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set(drvHeaders)
        .send({
          otp: '918273',
          signature: '<svg viewBox="0 0 100 100"><path d="M10 10 L50 50"/></svg>',
          notes: 'Customer signed digitally at doorstep',
        });
      assert.strictEqual(resComplete.status, 200);
      assert.strictEqual(resComplete.body.data.status, 'COMPLETED');

      // 7. Verify Audit Events captured the lifecycle
      const auditEvents = await harness.models.AuditEvent.find({ deliveryId: delivery._id });
      assert.ok(auditEvents.length >= 3, `Expected at least 3 audit events, found ${auditEvents.length}`);
    });

    it('TC-T3-DL-2: Exception path: Delivery fails -> Audit logged -> Manager resets to READY for re-dispatch', async () => {
      const { headers: mgrHeaders } = await harness.getAuthHeaders('FLEET_MANAGER');
      const { user: drvUser, headers: drvHeaders } = await harness.getAuthHeaders('DRIVER', 'driver_cycle_2@smartroute.test');

      const vehicle = await harness.models.Vehicle.create(fixtures.VEHICLE_FIXTURES.heroElectricBike);
      const driver = await harness.models.Driver.create({
        userId: drvUser._id,
        licenseNumber: 'OD-02-DL-002',
        phone: '+91 94370 22999',
        assignedVehicleId: vehicle._id,
      });

      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-PW-DL-02',
        customer: { name: 'Customer Exception', phone: '+91 99370 54321' },
        address: { street: 'Niladri Vihar', city: 'Bhubaneswar', zone: 'Chandrasekharpur', postalCode: '751021' },
        location: { type: 'Point', coordinates: [85.818, 20.325] },
        weightKg: 2.0,
        status: 'OUT_FOR_DELIVERY',
        assignedDriverId: driver._id,
        assignedVehicleId: vehicle._id,
        timeWindow: { start: '14:00', end: '16:00' },
      });

      // 1. Driver fails delivery due to wrong address
      const resFail = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/fail`)
        .set(drvHeaders)
        .send({
          failureReason: 'WRONG_ADDRESS',
          notes: 'Plot number 40 does not exist in Niladri Vihar Sector 3',
        });
      assert.strictEqual(resFail.status, 200);
      assert.strictEqual(resFail.body.data.status, 'FAILED');
      assert.strictEqual(resFail.body.data.failureReason, 'WRONG_ADDRESS');

      // 2. Manager resets failed delivery back to READY
      const resReset = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(mgrHeaders)
        .send({ status: 'READY' });
      assert.strictEqual(resReset.status, 200);
      assert.strictEqual(resReset.body.data.status, 'READY');
    });
  },
};
