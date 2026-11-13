require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const { ROLES, VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATUS, DRIVER_AVAILABILITY } = require('../config/constants');

const TEST_USERS = [
  {
    email: 'admin@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Admin',
    role: ROLES.ADMIN,
  },
  {
    email: 'manager@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Manager',
    role: ROLES.FLEET_MANAGER,
  },
  {
    email: 'driver@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Driver',
    role: ROLES.DRIVER,
  },
];

async function seedTestUsers() {
  await connectDB();

  for (const userData of TEST_USERS) {
    const existing = await User.findOne({ email: userData.email });

    if (existing) {
      console.log(`[SeedTestUsers] User ${userData.email} already exists, updating password...`);
      existing.passwordHash = userData.password;
      existing.role = userData.role;
      existing.name = userData.name;
      existing.emailVerified = true;
      existing.active = true;
      existing.accountStatus = 'ACTIVE';
      existing.isDemoData = true;
      await existing.save();
      console.log(`[SeedTestUsers] Updated ${userData.email}`);
    } else {
      const user = await User.create({
        ...userData,
        passwordHash: userData.password,
        emailVerified: true,
        active: true,
        accountStatus: 'ACTIVE',
        isDemoData: true,
      });
      console.log(`[SeedTestUsers] Created ${user.email} (${user.role})`);
    }
  }

  // Create driver profile for test driver
  const driverUser = await User.findOne({ email: 'driver@smartroute.test' });
  if (driverUser) {
    let driverProfile = await Driver.findOne({ userId: driverUser._id });
    if (!driverProfile) {
      // Create a test vehicle first
      let vehicle = await Vehicle.findOne({ vehicleId: 'E2E-TEST-001' });
      if (!vehicle) {
        vehicle = await Vehicle.create({
          vehicleId: 'E2E-TEST-001',
          makeModel: 'Test Van',
          type: VEHICLE_TYPES.VAN,
          capacityKg: 1000,
          fuelType: FUEL_TYPES.DIESEL,
          kmPerLitre: 15,
          availability: VEHICLE_STATUS.AVAILABLE,
          isDemoData: true,
        });
        console.log(`[SeedTestUsers] Created test vehicle ${vehicle.vehicleId}`);
      }

      driverProfile = await Driver.create({
        userId: driverUser._id,
        employeeId: 'E2E-DRIVER-001',
        licenseNumber: 'DL-E2E-TEST-001',
        phone: '+919876543210',
        assignedVehicleId: vehicle._id,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        isDemoData: true,
      });
      console.log(`[SeedTestUsers] Created driver profile for ${driverUser.email}`);

      // Update vehicle with assigned driver
      vehicle.assignedDriverId = driverProfile._id;
      await vehicle.save();
    } else {
      console.log(`[SeedTestUsers] Driver profile already exists for ${driverUser.email}`);
    }
  }

  await disconnectDB();
  console.log('[SeedTestUsers] Done');
}

if (require.main === module) {
  seedTestUsers().catch((err) => {
    console.error('[SeedTestUsers] Error:', err);
    process.exit(1);
  });
}

module.exports = { seedTestUsers };