/**
 * Tier 1 Feature Suite: Delivery Consignments, State Machine & Audit Trail
 * Validates Features 7, 9, 10 in isolation.
 */

module.exports = {
  name: 'Delivery Consignments & Lifecycle State Machine',
  tier: 1,
  file: 'deliveries.test.js',

  async run({ it, beforeEach, harness, fixtures, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-DEL-1: Create single delivery consignment defaults to DRAFT status and validates payload', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const deliveryPayload = {
        orderReference: '#DEL-T1-001',
        customer: {
          name: 'Alok Mohapatra',
          phone: '+91 99370 12345',
          email: 'alok@smartroute.test',
        },
        address: {
          street: 'Plot 45, KIIT Square',
          city: 'Bhubaneswar',
          zone: 'Patia (Z-1)',
          postalCode: '751024',
        },
        location: {
          type: 'Point',
          coordinates: [85.8175, 20.3542],
        },
        weightKg: 8.5,
        volumeM3: 0.03,
        priority: 'Standard',
        timeWindow: {
          start: '09:00',
          end: '12:00',
        },
      };

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send(deliveryPayload);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.orderReference, '#DEL-T1-001');
      assert.strictEqual(res.body.data.status, 'DRAFT');
      assert.strictEqual(res.body.data.weightKg, 8.5);
    });

    it('TC-T1-DEL-2: Delivery state machine valid progression DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-T1-002',
        customer: { name: 'Priyanka Das', phone: '+91 99370 55555' },
        address: { street: 'Mayfair Lagoon Gate', city: 'Bhubaneswar', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
        location: { type: 'Point', coordinates: [85.8232, 20.3015] },
        weightKg: 5.0,
        status: 'DRAFT',
        timeWindow: { start: '09:00', end: '12:00' },
      });

      // 1. Transition DRAFT -> READY
      const resReady = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(headers)
        .send({ status: 'READY' });
      assert.strictEqual(resReady.status, 200);
      assert.strictEqual(resReady.body.data.status, 'READY');

      // 2. Transition READY -> ASSIGNED
      const resAssigned = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(headers)
        .send({ status: 'ASSIGNED' });
      assert.strictEqual(resAssigned.status, 200);
      assert.strictEqual(resAssigned.body.data.status, 'ASSIGNED');

      // 3. Transition ASSIGNED -> OUT_FOR_DELIVERY
      const resOfd = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(headers)
        .send({ status: 'OUT_FOR_DELIVERY' });
      assert.strictEqual(resOfd.status, 200);
      assert.strictEqual(resOfd.body.data.status, 'OUT_FOR_DELIVERY');
    });

    it('TC-T1-DEL-3: Illegal status transition (DRAFT directly to COMPLETED) is rejected with 400', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-T1-003',
        customer: { name: 'Soumya Ray', phone: '+91 99370 66666' },
        address: { street: 'Bhawani Mall', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        location: { type: 'Point', coordinates: [85.8521, 20.2884] },
        weightKg: 4.2,
        status: 'DRAFT',
        timeWindow: { start: '10:00', end: '13:00' },
      });

      const res = await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(headers)
        .send({ status: 'COMPLETED' });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_STATUS_TRANSITION');
    });

    it('TC-T1-DEL-4: Complete delivery via /complete requires Proof of Delivery and records COMPLETED', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-T1-004',
        customer: { name: 'Lipsa Tripathy', phone: '+91 99370 77777' },
        address: { street: 'Khandagiri Caves', city: 'Bhubaneswar', zone: 'Khandagiri (Z-4)', postalCode: '751030' },
        location: { type: 'Point', coordinates: [85.7876, 20.2581] },
        weightKg: 3.1,
        status: 'OUT_FOR_DELIVERY',
        timeWindow: { start: '11:00', end: '14:00' },
      });

      const res = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set(headers)
        .send({
          otp: '482910',
          signature: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
          notes: 'Delivered to recipient at front gate',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'COMPLETED');
      assert.ok(res.body.data.proofOfDelivery);
      assert.strictEqual(res.body.data.proofOfDelivery.otp, '482910');
    });

    it('TC-T1-DEL-5: Fail delivery via /fail requires mandatory reason code and marks FAILED', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-T1-005',
        customer: { name: 'Debasis Sahoo', phone: '+91 99370 88888' },
        address: { street: 'Care Hospital', city: 'Bhubaneswar', zone: 'Chandrasekharpur', postalCode: '751023' },
        location: { type: 'Point', coordinates: [85.8184, 20.3255] },
        weightKg: 7.0,
        status: 'OUT_FOR_DELIVERY',
        timeWindow: { start: '12:00', end: '15:00' },
      });

      // Attempt failure without reason code should be rejected
      const failNoReason = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/fail`)
        .set(headers)
        .send({ notes: 'Recipient not answering door' });
      assert.strictEqual(failNoReason.status, 400);

      // Submit with failureReason
      const failSuccess = await harness.request
        .post(`/api/v1/deliveries/${delivery._id}/fail`)
        .set(headers)
        .send({
          failureReason: 'CUSTOMER_UNAVAILABLE',
          notes: 'Called customer 3 times; no response.',
        });
      assert.strictEqual(failSuccess.status, 200);
      assert.strictEqual(failSuccess.body.data.status, 'FAILED');
      assert.strictEqual(failSuccess.body.data.failureReason, 'CUSTOMER_UNAVAILABLE');
    });

    it('TC-T1-DEL-6: Audit logging verifies immutable AuditEvent recorded for delivery status transitions', async () => {
      const { headers, user } = await harness.getAuthHeaders('FLEET_MANAGER');
      const delivery = await harness.models.Delivery.create({
        orderReference: '#DEL-T1-006',
        customer: { name: 'Audit Test User', phone: '+91 99370 99999' },
        address: { street: 'Infocity Avenue', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        location: { type: 'Point', coordinates: [85.817, 20.354] },
        weightKg: 2.5,
        status: 'DRAFT',
        timeWindow: { start: '09:00', end: '12:00' },
      });

      await harness.request
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set(headers)
        .send({ status: 'READY' });

      const auditRecords = await harness.models.AuditEvent.find({ deliveryId: delivery._id });
      assert.ok(auditRecords.length >= 1, 'Expected at least 1 AuditEvent for state transition');
      assert.strictEqual(String(auditRecords[0].actorId), String(user._id));
      assert.strictEqual(auditRecords[0].type, 'STATUS_CHANGE');
    });
  },
};
