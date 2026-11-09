const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const { createTestUser, createTestDriver, createTestDelivery } = require('./helpers/testUtils');

describe('Delivery Controller - POD Validation', () => {
  let adminToken;
  let driverToken;
  let driverProfile;
  let testDelivery;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetview_test');
    }

    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    const driver = await createTestUser('DRIVER');
    driverToken = driver.token;

    driverProfile = await createTestDriver(driver.user);
  });

  beforeEach(async () => {
    testDelivery = await createTestDelivery({
      status: 'OUT_FOR_DELIVERY',
      assignedDriverId: driverProfile._id,
    });
  });

  afterAll(async () => {
    await Delivery.deleteMany({});
    await User.deleteMany({});
    await Driver.deleteMany({});
    await mongoose.connection.close();
  });

  it('should reject completion if POD data is missing', async () => {
    const response = await request(app)
      .post(`/api/v1/deliveries/${testDelivery._id}/complete`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({}); // No POD data

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/POD must include at least one verification method/);
  });

  it('should reject completion if POD is incomplete (no OTP, Signature, or Photo)', async () => {
    const response = await request(app)
      .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'COMPLETED',
        pod: { notes: 'Just some notes, no verification' },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/POD must include at least one verification method/);
  });

  it('should accept completion with valid OTP', async () => {
    const response = await request(app)
      .patch(`/api/v1/deliveries/${testDelivery._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'COMPLETED',
        pod: { otp: '123456' },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(response.body.data.proofOfDelivery.otp).toBe('123456');
  });
});
