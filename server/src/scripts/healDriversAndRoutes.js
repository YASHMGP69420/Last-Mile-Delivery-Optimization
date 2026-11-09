const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const { connectDB, disconnectDB } = require('../config/db');
const { ROLES, DRIVER_AVAILABILITY, VEHICLE_STATUS } = require('../config/constants');

async function heal() {
  console.log('[Heal] Connecting to MongoDB...');
  await connectDB();

  console.log('[Heal] 1. Auditing all DRIVER user accounts...');
  const driverUsers = await User.find({ role: ROLES.DRIVER });
  let createdCount = 0;

  for (const u of driverUsers) {
    let d = await Driver.findOne({ userId: u._id });
    if (!d) {
      console.log(`[Heal] User ${u.email} (${u.name}) has role DRIVER but no Driver document. Creating...`);
      const licenseNumber = u.email === 'driver@example.com'
        ? 'OD-02-2022-0077889'
        : `OD-DL-${u._id.toString().slice(-6).toUpperCase()}`;

      d = await Driver.create({
        userId: u._id,
        licenseNumber,
        phone: u.phone || '+91 94370 00000',
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        rating: 4.9,
        onTimeRuns: 40,
      });
      createdCount++;
      console.log(`[Heal] Created Driver ${d._id} for user ${u.email}`);
    }
  }

  console.log(`[Heal] Auto-provisioned ${createdCount} missing Driver profile(s).`);

  console.log('[Heal] 2. Checking demo driver (driver@example.com)...');
  const demoUser = await User.findOne({ email: 'driver@example.com' });
  if (demoUser) {
    const demoDriver = await Driver.findOne({ userId: demoUser._id });
    if (demoDriver && !demoDriver.assignedVehicleId) {
      // Find an available vehicle without assigned driver, or vehicle OD-02-DN-4004
      let targetVeh = await Vehicle.findOne({ assignedDriverId: null, availability: { $ne: 'RETIRED' } });
      if (!targetVeh) {
        targetVeh = await Vehicle.findOne({ vehicleId: 'OD-02-DN-4004' });
      }
      if (targetVeh) {
        if (targetVeh.assignedDriverId) {
          await Driver.findByIdAndUpdate(targetVeh.assignedDriverId, { assignedVehicleId: null });
        }
        demoDriver.assignedVehicleId = targetVeh._id;
        demoDriver.availability = DRIVER_AVAILABILITY.AVAILABLE;
        await demoDriver.save();
        targetVeh.assignedDriverId = demoDriver._id;
        targetVeh.availability = VEHICLE_STATUS.ASSIGNED;
        await targetVeh.save();
        console.log(`[Heal] Linked demo driver ${demoUser.email} to vehicle ${targetVeh.vehicleId}`);
      }
    }
  }

  console.log('[Heal] 3. Synchronizing active routes with driver currentRouteId...');
  const activeRoutes = await Route.find({ status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } }).sort({ dispatchedAt: -1, updatedAt: -1 });
  console.log(`[Heal] Found ${activeRoutes.length} active dispatched route(s).`);

  for (const r of activeRoutes) {
    if (r.driverId) {
      const drv = await Driver.findById(r.driverId);
      if (drv && !drv.currentRouteId) {
        drv.currentRouteId = r._id;
        drv.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
        await drv.save();
        console.log(`[Heal] Synced Driver ${drv.licenseNumber} currentRouteId -> Route ${r.routeCode}`);
      }
    }
  }

  console.log('[Heal] 4. Final verification state:');
  const allDrivers = await Driver.find().populate('userId assignedVehicleId').lean();
  for (const d of allDrivers) {
    console.log(`- Driver: ${d.licenseNumber} | User: ${d.userId?.email} | Veh: ${d.assignedVehicleId?.vehicleId || 'NONE'} | Route: ${d.currentRouteId || 'NONE'}`);
  }

  console.log('[Heal] Complete!');
  await disconnectDB();
  process.exit(0);
}

heal().catch((err) => {
  console.error('[Heal] Fatal error:', err);
  process.exit(1);
});
