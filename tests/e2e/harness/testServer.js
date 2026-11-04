/**
 * Test server harness for SmartRoute 4-tier E2E testing framework.
 * Initializes the Express app, manages test database lifecycle, and generates auth credentials.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../../server/src/app');
const User = require('../../../server/src/models/User');
const Vehicle = require('../../../server/src/models/Vehicle');
const Driver = require('../../../server/src/models/Driver');
const Delivery = require('../../../server/src/models/Delivery');
const DeliveryBatch = require('../../../server/src/models/DeliveryBatch');
const Route = require('../../../server/src/models/Route');
const AuditEvent = require('../../../server/src/models/AuditEvent');
const env = require('../../../server/src/config/env');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_test';
const JWT_SECRET = env.JWT_SECRET || 'test_jwt_secret_smartroute_bhubaneswar_2026';

let isInitialized = false;

async function startTestEnvironment() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }
  isInitialized = true;
  return { app, mongoose, connection: mongoose.connection };
}

async function cleanDatabase(connection = null) {
  const conn = connection || mongoose.connection;
  if (conn && conn.readyState !== 0) {
    const collections = conn.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

async function stopTestEnvironment() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  isInitialized = false;
}

/**
 * Creates a persisted test user with proper password hash and returns signed token.
 */
async function createTestUser(role = 'ADMIN', emailSuffix = null) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  const email = emailSuffix || `${role.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}@smartroute.test`;

  const user = await User.create({
    name: `Test ${role}`,
    email,
    passwordHash,
    role,
    phone: '+91 99370 12345',
    active: true,
  });

  const token = jwt.sign(
    { sub: user._id.toString(), id: user._id.toString(), role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return { user, token };
}

/**
 * Convenience helper returning { 'Authorization': 'Bearer <token>', user, token }
 */
async function getAuthHeaders(role = 'ADMIN', emailSuffix = null) {
  const { user, token } = await createTestUser(role, emailSuffix);
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    user,
    token,
  };
}

module.exports = {
  app,
  request: request(app),
  rawRequest: request,
  startTestEnvironment,
  cleanDatabase,
  stopTestEnvironment,
  createTestUser,
  getAuthHeaders,
  JWT_SECRET,
  models: {
    User,
    Vehicle,
    Driver,
    Delivery,
    DeliveryBatch,
    Route,
    AuditEvent,
  },
};
