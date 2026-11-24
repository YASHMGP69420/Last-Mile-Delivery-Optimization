const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const Hub = require('../src/models/Hub');
const {
  createTestUser,
  createTestDriver,
  createTestVehicle,
  createTestDelivery,
} = require('./helpers/testUtils');
const { DRIVER_AVAILABILITY, VEHICLE_STATUS, VEHICLE_TYPES, FUEL_TYPES } = require('../src/config/constants');

describe('Operational Delivery Batch Auto Vehicle & Driver Assignment', () => {
  let prodManagerToken;
  let demoManagerToken;
  let testHub;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_test');
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    const prodUser = await createTestUser('FLEET_MANAGER', `prod.mgr.${Date.now()}@example.com`);
    prodManagerToken = prodUser.token;

    const demoUser = await createTestUser('FLEET_MANAGER', `demo.dispatcher.${Date.now()}@smartroute.local`);
    demoManagerToken = demoUser.token;

    testHub = await Hub.create({
      code: `HUB-TEST-${Date.now().toString().slice(-4)}`,
      name: 'Test Central Hub',
      address: 'Janpath, Bhubaneswar',
      location: { lat: 20.2961, lng: 85.8645 },
      isActive: true,
      isCanonical: true,
    });
  });

  test('POST /api/v1/batches auto-assigns available best-fit vehicle and driver when vehicleIds and driverIds are empty', async () => {
    // 1. Create a production driver and vehicle with pairing
    const dUser = await createTestUser('DRIVER', `driver.${Date.now()}@example.com`);
    const vehicle = await createTestVehicle({
      vehicleId: `OD-02-AUTO-${Date.now().toString().slice(-4)}`,
      makeModel: 'Tata Ace Diesel',
      capacityKg: 1000,
      availability: VEHICLE_STATUS.AVAILABLE,
      homeHubId: testHub._id,
      isDemoData: false,
    });

    const driver = await createTestDriver(dUser.user, {
      licenseNumber: `OD-DRV-${Date.now().toString().slice(-4)}`,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      assignedVehicleId: vehicle._id,
      isDemoData: false,
    });
    vehicle.assignedDriverId = driver._id;
    await vehicle.save();

    // 2. Create deliveries
    const d1 = await createTestDelivery({ weightKg: 25, isDemoData: false });
    const d2 = await createTestDelivery({ weightKg: 40, isDemoData: false });

    // 3. Create batch without vehicleIds or driverIds
    const res = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${prodManagerToken}`)
      .send({
        code: `BATCH-AUTO-${Date.now().toString().slice(-4)}`,
        name: 'Auto Fleet Batch',
        deliveryIds: [d1._id.toString(), d2._id.toString()],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const createdBatch = res.body.data.batch;

    // Verify auto-assigned fleet
    expect(createdBatch.vehicleIds).toBeDefined();
    expect(createdBatch.vehicleIds.length).toBe(1);
    expect(createdBatch.driverIds).toBeDefined();
    expect(createdBatch.driverIds.length).toBe(1);

    const assignedVehId = (createdBatch.vehicleIds[0]._id || createdBatch.vehicleIds[0].id || createdBatch.vehicleIds[0]).toString();
    const assignedDrvId = (createdBatch.driverIds[0]._id || createdBatch.driverIds[0].id || createdBatch.driverIds[0]).toString();

    expect(assignedVehId).toBe(vehicle._id.toString());
    expect(assignedDrvId).toBe(driver._id.toString());
  });

  test('POST /api/v1/batches strictly isolates demo sandbox: demo dispatchers only auto-receive demo fleet', async () => {
    // 1. Create a demo driver and demo vehicle
    const demoDrvUser = await createTestUser('DRIVER', `demo.driver.${Date.now()}@smartroute.local`);
    const demoVehicle = await createTestVehicle({
      vehicleId: `OD02-DEMO-${Date.now().toString().slice(-4)}`,
      makeModel: 'Demo Van',
      capacityKg: 800,
      availability: VEHICLE_STATUS.AVAILABLE,
      homeHubId: testHub._id,
      isDemoData: true,
    });
    const demoDriver = await createTestDriver(demoDrvUser.user, {
      licenseNumber: `DEMO-DRV-${Date.now().toString().slice(-4)}`,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      assignedVehicleId: demoVehicle._id,
      isDemoData: true,
    });
    demoVehicle.assignedDriverId = demoDriver._id;
    await demoVehicle.save();

    // 2. Create demo deliveries
    const d1 = await createTestDelivery({ weightKg: 10, isDemoData: true });

    // 3. Demo dispatcher creates batch
    const res = await request(app)
      .post('/api/v1/batches')
      .set('Authorization', `Bearer ${demoManagerToken}`)
      .send({
        code: `DEMO-AUTO-${Date.now().toString().slice(-4)}`,
        name: 'Demo Auto Batch',
        deliveryIds: [d1._id.toString()],
      });

    expect(res.status).toBe(201);
    const createdBatch = res.body.data.batch;
    expect(createdBatch.isDemoData).toBe(true);

    const assignedVehId = (createdBatch.vehicleIds[0]._id || createdBatch.vehicleIds[0].id || createdBatch.vehicleIds[0]).toString();
    const assignedDrvId = (createdBatch.driverIds[0]._id || createdBatch.driverIds[0].id || createdBatch.driverIds[0]).toString();

    expect(assignedVehId).toBe(demoVehicle._id.toString());
    expect(assignedDrvId).toBe(demoDriver._id.toString());
  });
});
