/**
 * Tier 2 Boundary Suite: Delivery SLA Time Windows
 * Validates Feature 7 time window validation boundaries.
 */

module.exports = {
  name: 'Delivery Time Window Boundaries Suite',
  tier: 2,
  file: 'time-windows.test.js',

  async run({ it, beforeEach, harness, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T2-TIME-1: Inverted time window (start > end, "16:00" to "11:00") is rejected with 400', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-INV-TIME',
          customer: { name: 'Time Tester', phone: '+91 99370 12345' },
          address: { street: 'Saheed Nagar', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          weightKg: 5.0,
          timeWindow: {
            start: '16:00',
            end: '11:00',
          },
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_TIME_WINDOW');
    });

    it('TC-T2-TIME-2: Equal start and end time ("12:00" to "12:00") is rejected with 400', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-EQL-TIME',
          customer: { name: 'Time Tester', phone: '+91 99370 12345' },
          address: { street: 'Saheed Nagar', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          weightKg: 5.0,
          timeWindow: {
            start: '12:00',
            end: '12:00',
          },
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'INVALID_TIME_WINDOW');
    });

    it('TC-T2-TIME-3: Malformed time string ("25:70") fails regex format validation with 400', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-BAD-TIME',
          customer: { name: 'Time Tester', phone: '+91 99370 12345' },
          address: { street: 'Saheed Nagar', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          weightKg: 5.0,
          timeWindow: {
            start: '25:70',
            end: '28:90',
          },
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('TC-T2-TIME-4: Valid boundary time window (00:00 to 23:59) is accepted', async () => {
      const { headers } = await harness.getAuthHeaders('FLEET_MANAGER');

      const res = await harness.request
        .post('/api/v1/deliveries')
        .set(headers)
        .send({
          orderReference: '#DEL-FULLDAY-TIME',
          customer: { name: 'Time Tester', phone: '+91 99370 12345' },
          address: { street: 'Saheed Nagar', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
          weightKg: 5.0,
          timeWindow: {
            start: '00:00',
            end: '23:59',
          },
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.timeWindow.start, '00:00');
      assert.strictEqual(res.body.data.timeWindow.end, '23:59');
    });
  },
};
