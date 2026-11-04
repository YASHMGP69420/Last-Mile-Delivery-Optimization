const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Vehicle = require('../../src/models/Vehicle');
const Driver = require('../../src/models/Driver');
const env = require('../../src/config/env');

const JWT_SECRET = env.JWT_SECRET || 'test_jwt_secret_smartroute_bhubaneswar_2026';

/**
 * Creates a persisted user in test DB and returns user and signed JWT token
 */
async function createTestUser(role = 'ADMIN', emailSuffix = null) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  const email = emailSuffix || `${role.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 10000)}@smartroute.test`;

  const user = await User.create({
    name: `Test ${role}`,
    email,
    passwordHash,
    role,
    active: true,
  });

  const token = jwt.sign(
    { sub: user._id.toString(), id: user._id.toString(), role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { user, token };
}

/**
 * Creates a persisted vehicle
 */
async function createTestVehicle(overrides = {}) {
  const fuelType = overrides.fuelType || 'Diesel';
  const isElectric = fuelType === 'Electric';

  return await Vehicle.create({
    vehicleId: overrides.vehicleId || `OD-02-TEST-${Math.floor(Math.random() * 9000 + 1000)}`,
    makeModel: overrides.makeModel || 'Tata Ace Diesel',
    type: overrides.type || 'Van',
    capacityKg: overrides.capacityKg || 1000,
    capacityM3: overrides.capacityM3 || 3.5,
    fuelType,
    kmPerLitre: isElectric ? null : (overrides.kmPerLitre || 14.0),
    energyKWhPerKm: isElectric ? (overrides.energyKWhPerKm || 0.15) : null,
    availability: overrides.availability || 'AVAILABLE',
    ...overrides,
  });
}

/**
 * Creates a persisted driver linked to a User
 */
async function createTestDriver(user, overrides = {}) {
  return await Driver.create({
    userId: user._id,
    licenseNumber: overrides.licenseNumber || `OD-02-LIC-${Math.floor(Math.random() * 90000 + 10000)}`,
    phone: overrides.phone || '+91 98610 99999',
    availability: overrides.availability || 'AVAILABLE',
    assignedVehicleId: overrides.assignedVehicleId || null,
    ...overrides,
  });
}

module.exports = {
  createTestUser,
  createTestVehicle,
  createTestDriver,
};
