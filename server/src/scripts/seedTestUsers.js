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
  {
    email: 'driver2@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Driver 2',
    role: ROLES.DRIVER,
  },
  {
    email: 'driver3@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Driver 3',
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

  // Ensure a pool of test vehicles exists and is available for batch optimization
  const TEST_VEHICLES = [
    {
      vehicleId: 'E2E-TEST-001',
      makeModel: 'Test Electric Van Prime',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 1000,
      capacityM3: 10,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.25,
      batteryCapacityKWh: 80,
      batterySoC: 98,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'E2E-TEST-002',
      makeModel: 'Test Heavy Truck',
      type: VEHICLE_TYPES.TRUCK,
      capacityKg: 5000,
      capacityM3: 25,
      fuelType: FUEL_TYPES.DIESEL,
      kmPerLitre: 8,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'E2E-TEST-003',
      makeModel: 'Test Electric Van',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 1200,
      capacityM3: 8,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.25,
      batteryCapacityKWh: 75,
      batterySoC: 95,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'E2E-TEST-004',
      makeModel: 'Test Quick Bike',
      type: VEHICLE_TYPES.BIKE,
      capacityKg: 100,
      capacityM3: 0.5,
      fuelType: FUEL_TYPES.PETROL,
      kmPerLitre: 35,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
  ];

  const vehicleDocs = {};
  for (const vData of TEST_VEHICLES) {
    let vehicle = await Vehicle.findOne({ vehicleId: vData.vehicleId });
    if (!vehicle) {
      vehicle = await Vehicle.create(vData);
      console.log(`[SeedTestUsers] Created vehicle ${vData.vehicleId}`);
    } else {
      Object.assign(vehicle, vData);
      await vehicle.save();
      console.log(`[SeedTestUsers] Reset vehicle ${vData.vehicleId} to AVAILABLE`);
    }
    vehicleDocs[vData.vehicleId] = vehicle;
  }

  // Create driver profiles for test drivers
  const DRIVER_ASSIGNMENTS = [
    { email: 'driver@smartroute.test', empId: 'E2E-DRIVER-001', dl: 'DL-E2E-TEST-001', phone: '+919876543210', vehId: 'E2E-TEST-001' },
    { email: 'driver2@smartroute.test', empId: 'E2E-DRIVER-002', dl: 'DL-E2E-TEST-002', phone: '+919876543211', vehId: 'E2E-TEST-002' },
    { email: 'driver3@smartroute.test', empId: 'E2E-DRIVER-003', dl: 'DL-E2E-TEST-003', phone: '+919876543212', vehId: 'E2E-TEST-003' },
  ];

  for (const da of DRIVER_ASSIGNMENTS) {
    const dUser = await User.findOne({ email: da.email });
    if (dUser) {
      let dProfile = await Driver.findOne({ userId: dUser._id });
      const targetVeh = vehicleDocs[da.vehId];
      if (!dProfile) {
        dProfile = await Driver.create({
          userId: dUser._id,
          employeeId: da.empId,
          licenseNumber: da.dl,
          phone: da.phone,
          assignedVehicleId: targetVeh ? targetVeh._id : null,
          availability: DRIVER_AVAILABILITY.AVAILABLE,
          isDemoData: true,
        });
        console.log(`[SeedTestUsers] Created driver profile for ${da.email}`);
      } else {
        dProfile.assignedVehicleId = targetVeh ? targetVeh._id : null;
        dProfile.availability = DRIVER_AVAILABILITY.AVAILABLE;
        dProfile.currentRouteId = null;
        await dProfile.save();
        console.log(`[SeedTestUsers] Reset driver profile for ${da.email}`);
      }

      if (targetVeh) {
        await Vehicle.updateMany(
          { assignedDriverId: dProfile._id, _id: { $ne: targetVeh._id } },
          { $set: { assignedDriverId: null } }
        );
        targetVeh.assignedDriverId = dProfile._id;
        await targetVeh.save();
      }
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