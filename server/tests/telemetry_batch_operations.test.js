const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const TelemetryPing = require('../src/models/TelemetryPing');
const TelemetryAlert = require('../src/models/TelemetryAlert');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');
const { CANONICAL_DEPOT, DELIVERY_STATUS } = require('../src/config/constants');

describe('Live Telemetry & Delivery Batch Operations Test Suite', () => {
  let adminToken;
  let driverUser;
  let driverToken;
  let driverDoc;
  let vehicleDoc;

  beforeEach(async () => {
    // Admin user
    const adminAuth = await createTestUser('ADMIN');
    adminToken = adminAuth.token;

    // Driver user
    const driverAuth = await createTestUser('DRIVER');
    driverUser = driverAuth.user;
    driverToken = driverAuth.token;

    vehicleDoc = await createTestVehicle({
      vehicleId: `OD-02-TEL-${Math.floor(Math.random() * 9000 + 1000)}`,
    });

    driverDoc = await createTestDriver(driverUser, {
      assignedVehicleId: vehicleDoc._id,
    });
  });

  // ==========================================
  // PART 1: LIVE TELEMETRY AUDIT & REPAIR
  // ==========================================
  describe('1. Live Telemetry Ingestion & Validation', () => {
    test('TC-TELEM-1: Successfully ingests valid GPS telemetry ping from driver', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8645, 20.2961],
          speedKmh: 35.5,
          headingDegrees: 180,
          accuracyMeters: 4.2,
          batteryPercent: 88,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ping.driverId).toBe(driverDoc._id.toString());
      expect(res.body.data.ping.location.coordinates).toEqual([85.8645, 20.2961]);
      expect(res.body.data.ping.speedKmh).toBe(35.5);
      expect(res.body.data.ping.batteryPercent).toBe(88);
      // Hardware device connected is false by default
      expect(res.body.data.ping.hardwareSensors.connected).toBe(false);
      expect(res.body.data.ping.hardwareSensors.engineRpm).toBeNull();
    });

    test('TC-TELEM-2: Rejects invalid geographic coordinates out of bounds', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [200.0, 95.0], // Out of bounds
          speedKmh: 30,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COORDINATES_OUT_OF_BOUNDS');
    });

    test('TC-TELEM-3: Rejects negative speed and invalid heading', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8645, 20.2961],
          speedKmh: -15, // Invalid negative speed
          headingDegrees: 450, // Invalid heading > 360
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('TC-TELEM-4: Driver HUD /location forwarder endpoint successfully ingests GPS', async () => {
      const res = await request(app)
        .post('/api/v1/driver-hud/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8340, 20.3010],
          accuracyMeters: 3.5,
          speedKmh: 22.0,
          headingDegrees: 90,
          batteryPercent: 75,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ping.location.coordinates).toEqual([85.8340, 20.3010]);
    });

    test('TC-TELEM-5: Speeding trigger generates OVERSPEED TelemetryAlert', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8645, 20.2961],
          speedKmh: 82.5, // Exceeds 65 km/h urban threshold
        });

      expect(res.status).toBe(201);
      expect(res.body.data.alerts.length).toBeGreaterThan(0);
      expect(res.body.data.alerts[0].alertType).toBe('OVERSPEED');
      expect(res.body.data.alerts[0].severity).toBe('CRITICAL');

      const savedAlert = await TelemetryAlert.findOne({ alertType: 'OVERSPEED' });
      expect(savedAlert).not.toBeNull();
      expect(savedAlert.acknowledged).toBe(false);
    });

    test('TC-TELEM-6: Low battery trigger generates LOW_BATTERY TelemetryAlert', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8645, 20.2961],
          batteryPercent: 8, // < 15% threshold
        });

      expect(res.status).toBe(201);
      expect(res.body.data.alerts.some((a) => a.alertType === 'LOW_BATTERY')).toBe(true);
    });

    test('TC-TELEM-7: GET /api/v1/telemetry/live returns consolidated status with staleness and hardware distinction', async () => {
      // Ingest recent ping
      await request(app)
        .post('/api/v1/telemetry')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          coordinates: [85.8645, 20.2961],
          speedKmh: 25,
          batteryPercent: 90,
        });

      const res = await request(app)
        .get('/api/v1/telemetry/live')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.fleet)).toBe(true);

      const targetEntry = res.body.data.fleet.find(
        (item) => item.vehicle.id === vehicleDoc._id.toString()
      );
      expect(targetEntry).toBeDefined();
      expect(targetEntry.telemetry.isStale).toBe(false);
      expect(targetEntry.hardwareSensors.connected).toBe(false);
      expect(targetEntry.hardwareSensors.statusText).toBe('Vehicle telemetry device not connected');
    });

    test('TC-TELEM-8: Alert acknowledgment endpoint updates status and audit', async () => {
      const alert = new TelemetryAlert({
        driverId: driverDoc._id,
        vehicleId: vehicleDoc._id,
        alertType: 'OVERSPEED',
        severity: 'CRITICAL',
        message: 'Test overspeed alert',
      });
      await alert.save();

      const res = await request(app)
        .post(`/api/v1/telemetry/alerts/${alert._id}/ack`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert.acknowledged).toBe(true);
    });
  });

  // ==========================================
  // PART 2: DELIVERY BATCH MANAGEMENT CRUD & OPS
  // ==========================================
  describe('2. Delivery Batch Management CRUD & Operations', () => {
    let del1, del2, del3;

    beforeEach(async () => {
      del1 = await createTestDelivery({ weightKg: 10.5, address: { zone: 'Saheed Nagar (Z-3)' } });
      del2 = await createTestDelivery({ weightKg: 15.0, address: { zone: 'Saheed Nagar (Z-3)' } });
      del3 = await createTestDelivery({ weightKg: 8.0, address: { zone: 'Saheed Nagar (Z-3)' } });
    });

    test('TC-BATCH-1: Creates new batch with calculated payload and stops metrics', async () => {
      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'BATCH-TEST-01',
          name: 'Morning Delivery Cluster',
          date: '2026-11-06',
          shift: 'Shift A (08:00 - 17:00)',
          deliveryIds: [del1._id, del2._id],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.metrics.totalDeliveries).toBe(2);
      expect(res.body.data.batch.metrics.totalWeightKg).toBe(25.5);

      // Deliveries should be bound to batch
      const updatedDel1 = await Delivery.findById(del1._id);
      expect(updatedDel1.batchId.toString()).toBe(res.body.data.batch.id);
    });

    test('TC-BATCH-2: Duplicate batch creates clone in DRAFT status', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-ORIG-01',
        name: 'Original Batch',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
        status: 'READY',
      });
      await batch.save();

      const res = await request(app)
        .post(`/api/v1/batches/${batch._id}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.status).toBe('DRAFT');
      expect(res.body.data.batch.code).toContain('BATCH-ORIG-01-CP');
      expect(res.body.data.batch.name).toBe('Copy of Original Batch');
    });

    test('TC-BATCH-3: Add deliveries to existing batch updates deliveries and recalculates metrics', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-ADD-01',
        name: 'Batch Add Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [del1._id],
        metrics: { totalDeliveries: 1, totalWeightKg: 10.5 },
      });
      await batch.save();

      const res = await request(app)
        .post(`/api/v1/batches/${batch._id}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryIds: [del2._id, del3._id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.metrics.totalDeliveries).toBe(3);
      expect(res.body.data.batch.metrics.totalWeightKg).toBe(33.5);

      // Verify delivery 2 bound
      const updatedDel2 = await Delivery.findById(del2._id);
      expect(updatedDel2.batchId.toString()).toBe(batch._id.toString());
    });

    test('TC-BATCH-4: Reject adding completed or cancelled delivery to batch', async () => {
      const completedDel = await createTestDelivery({
        status: DELIVERY_STATUS.COMPLETED,
        weightKg: 5,
      });

      const batch = new DeliveryBatch({
        code: 'BATCH-REJ-01',
        name: 'Batch Rejection Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
      });
      await batch.save();

      const res = await request(app)
        .post(`/api/v1/batches/${batch._id}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deliveryIds: [completedDel._id],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INELIGIBLE_DELIVERY_STATUS');
    });

    test('TC-BATCH-5: Remove delivery unbinds delivery and recalculates batch metrics', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-REM-01',
        name: 'Batch Remove Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [del1._id, del2._id],
        metrics: { totalDeliveries: 2, totalWeightKg: 25.5 },
      });
      await batch.save();
      await Delivery.findByIdAndUpdate(del1._id, { batchId: batch._id });

      const res = await request(app)
        .delete(`/api/v1/batches/${batch._id}/deliveries/${del1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.metrics.totalDeliveries).toBe(1);
      expect(res.body.data.batch.metrics.totalWeightKg).toBe(15.0);

      // Verify del1 unbound
      const unbindedDel1 = await Delivery.findById(del1._id);
      expect(unbindedDel1.batchId).toBeNull();
      expect(unbindedDel1.status).toBe(DELIVERY_STATUS.READY);
    });

    test('TC-BATCH-6: Assign fleet resources to batch', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-FLT-01',
        name: 'Batch Fleet Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
      });
      await batch.save();

      const res = await request(app)
        .post(`/api/v1/batches/${batch._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vehicleIds: [vehicleDoc._id],
          driverIds: [driverDoc._id],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.vehicleIds).toHaveLength(1);
      expect(res.body.data.batch.driverIds).toHaveLength(1);
    });

    test('TC-BATCH-7: Export batch manifest returns valid CSV format', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-EXP-01',
        name: 'Batch Export Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [del1._id],
      });
      await batch.save();

      const res = await request(app)
        .get(`/api/v1/batches/${batch._id}/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Order Reference');
      expect(res.text).toContain(del1.orderReference);
    });

    test('TC-BATCH-8: Delete batch unbinds all constituent deliveries', async () => {
      const batch = new DeliveryBatch({
        code: 'BATCH-DEL-01',
        name: 'Batch Delete Test',
        date: '2026-11-06',
        shift: 'Shift A (08:00 - 17:00)',
        deliveryIds: [del1._id, del2._id],
      });
      await batch.save();
      await Delivery.updateMany({ _id: { $in: [del1._id, del2._id] } }, { batchId: batch._id });

      const res = await request(app)
        .delete(`/api/v1/batches/${batch._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const d1 = await Delivery.findById(del1._id);
      const d2 = await Delivery.findById(del2._id);
      expect(d1.batchId).toBeNull();
      expect(d2.batchId).toBeNull();
    });
  });
});
