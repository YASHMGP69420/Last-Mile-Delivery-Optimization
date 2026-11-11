const crypto = require('crypto');
const env = require('../config/env');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Route = require('../models/Route');
const AuditEvent = require('../models/AuditEvent');
const DriverShift = require('../models/DriverShift');
const DriverIncident = require('../models/DriverIncident');
const DeliveryEvent = require('../models/DeliveryEvent');
const TelemetryPing = require('../models/TelemetryPing');
const TelemetryAlert = require('../models/TelemetryAlert');
const VehicleChecklist = require('../models/VehicleChecklist');
const VehicleAssignment = require('../models/VehicleAssignment');
const RouteAssignment = require('../models/RouteAssignment');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const SystemNotification = require('../models/SystemNotification');
const { AppError } = require('../middleware/errorHandler');
const {
  ROLES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  VEHICLE_TYPES,
  FUEL_TYPES,
  DRIVER_AVAILABILITY,
  PRIORITY_LEVELS,
  AUDIT_EVENT_TYPES,
  CANONICAL_DEPOT,
} = require('../config/constants');

const DEMO_SHOWCASE_PROFILES = {
  [ROLES.ADMIN]: {
    email: 'demo.admin@smartroute.local',
    name: 'Demo System Admin',
    role: ROLES.ADMIN,
    phone: '+919937090000',
    department: 'Platform Administration (Demo)',
  },
  [ROLES.FLEET_MANAGER]: {
    email: 'demo.manager@smartroute.local',
    name: 'Demo Hub Dispatcher',
    role: ROLES.FLEET_MANAGER,
    phone: '+919937090001',
    department: 'Fleet Operations (Demo)',
  },
  [ROLES.DRIVER]: {
    email: 'demo.driver1@smartroute.local',
    name: 'Rajesh Mohanty (Demo)',
    role: ROLES.DRIVER,
    phone: '+919437090101',
    department: 'Fleet Operations (Demo)',
  },
};

function generateDemoDriverPassword() {
  return `Demo-${crypto.randomBytes(9).toString('base64url')}`;
}

function deriveDemoCipherKey() {
  return crypto.createHash('sha256').update(String(env.JWT_SECRET)).digest();
}

function encryptDemoCredential(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveDemoCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptDemoCredential(payload) {
  if (!payload || typeof payload !== 'string') {
    return null;
  }
  try {
    const parts = payload.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(dataB64, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) {
      return null;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveDemoCipherKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

async function getDemoDataStatus() {
  const [users, drivers, vehicles, deliveries, batches, routes] = await Promise.all([
    User.countDocuments({ isDemoData: true }),
    Driver.countDocuments({ isDemoData: true }),
    Vehicle.countDocuments({ isDemoData: true }),
    Delivery.countDocuments({ isDemoData: true }),
    DeliveryBatch.countDocuments({ isDemoData: true }),
    Route.countDocuments({ isDemoData: true }),
  ]);

  let driverCredentials = [];
  if (drivers > 0 || users > 0) {
    const [demoDriverUsers, demoDrivers] = await Promise.all([
      User.find({ isDemoData: true, role: ROLES.DRIVER })
        .select('+demoCredentialEnc name email')
        .sort({ email: 1 })
        .lean(),
      Driver.find({ isDemoData: true })
        .populate('assignedVehicleId', 'vehicleId')
        .lean(),
    ]);

    const driverByUserId = new Map(
      demoDrivers.map((drv) => [drv.userId?.toString(), drv])
    );

    driverCredentials = demoDriverUsers.map((user) => {
      const driverProfile = driverByUserId.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        password: decryptDemoCredential(user.demoCredentialEnc),
        licenseNumber: driverProfile?.licenseNumber || null,
        vehicleId: driverProfile?.assignedVehicleId?.vehicleId || null,
      };
    });
  }

  const total = users + drivers + vehicles + deliveries + batches + routes;
  return {
    hasDemoData: total > 0,
    counts: {
      users,
      drivers,
      vehicles,
      deliveries,
      batches,
      routes,
      total,
    },
    driverCredentials,
  };
}

/**
 * Imports a curated, non-destructive Bhubaneswar prebuilt demo dataset.
 * Every created entity carries `isDemoData: true` so it can be cleanly removed later
 * without affecting real production accounts, orders, vehicles, or drivers.
 */
async function importDemoDataset(actorUserId = null) {
  const status = await getDemoDataStatus();
  if (status.hasDemoData) {
    throw new AppError(
      'Prebuilt demo dataset is already loaded. Delete existing demo data before re-importing.',
      409,
      'DEMO_DATA_ALREADY_LOADED'
    );
  }

  const demoPasswordSeed = () => crypto.randomBytes(16).toString('hex');
  const drvPassword1 = generateDemoDriverPassword();
  const drvPassword2 = generateDemoDriverPassword();
  const drvPassword3 = generateDemoDriverPassword();

  // 1. Demo System Admin, Demo Fleet Manager & 3 Demo Drivers
  const [, demoManager, drvUser1, drvUser2, drvUser3] = await User.create([
    {
      name: 'Demo System Admin',
      email: 'demo.admin@smartroute.local',
      passwordHash: demoPasswordSeed(),
      demoCredentialEnc: null,
      role: ROLES.ADMIN,
      phone: '+919937090000',
      department: 'Platform Administration (Demo)',
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    },
    {
      name: 'Demo Hub Dispatcher',
      email: 'demo.manager@smartroute.local',
      passwordHash: demoPasswordSeed(),
      demoCredentialEnc: null,
      role: ROLES.FLEET_MANAGER,
      phone: '+919937090001',
      department: 'Fleet Operations (Demo)',
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    },
    {
      name: 'Rajesh Mohanty (Demo)',
      email: 'demo.driver1@smartroute.local',
      passwordHash: drvPassword1,
      demoCredentialEnc: encryptDemoCredential(drvPassword1),
      role: ROLES.DRIVER,
      phone: '+919437090101',
      department: 'Fleet Operations (Demo)',
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    },
    {
      name: 'Bikash Panda (Demo)',
      email: 'demo.driver2@smartroute.local',
      passwordHash: drvPassword2,
      demoCredentialEnc: encryptDemoCredential(drvPassword2),
      role: ROLES.DRIVER,
      phone: '+919437090102',
      department: 'Fleet Operations (Demo)',
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    },
    {
      name: 'Sunil Nayak (Demo)',
      email: 'demo.driver3@smartroute.local',
      passwordHash: drvPassword3,
      demoCredentialEnc: encryptDemoCredential(drvPassword3),
      role: ROLES.DRIVER,
      phone: '+919437090103',
      department: 'Fleet Operations (Demo)',
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    },
  ]);

  // 2. Demo Fleet Vehicles
  const vehicles = await Vehicle.create([
    {
      vehicleId: 'DEMO-EV-101',
      makeModel: 'Tata Ace EV (Demo)',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 600,
      capacityM3: 4.5,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.28,
      batterySoC: 94,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'DEMO-VAN-102',
      makeModel: 'Mahindra Supro Maxi (Demo)',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 1000,
      capacityM3: 6.2,
      fuelType: FUEL_TYPES.DIESEL,
      kmPerLitre: 16.5,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'DEMO-VAN-103',
      makeModel: 'Maruti Super Carry (Demo)',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 750,
      capacityM3: 4.8,
      fuelType: FUEL_TYPES.PETROL,
      kmPerLitre: 18.0,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
    {
      vehicleId: 'DEMO-TRK-104',
      makeModel: 'Tata 407 Gold (Demo)',
      type: VEHICLE_TYPES.TRUCK,
      capacityKg: 2500,
      capacityM3: 14.0,
      fuelType: FUEL_TYPES.DIESEL,
      kmPerLitre: 9.5,
      availability: VEHICLE_STATUS.AVAILABLE,
      isDemoData: true,
    },
  ]);

  // 3. Linked Demo Driver Profiles
  const drivers = await Driver.create([
    {
      userId: drvUser1._id,
      licenseNumber: 'OD02-DEMO-101',
      phone: drvUser1.phone,
      assignedVehicleId: vehicles[0]._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      rating: 4.9,
      onTimeRuns: 32,
      isDemoData: true,
    },
    {
      userId: drvUser2._id,
      licenseNumber: 'OD02-DEMO-102',
      phone: drvUser2.phone,
      assignedVehicleId: vehicles[1]._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      rating: 4.8,
      onTimeRuns: 27,
      isDemoData: true,
    },
    {
      userId: drvUser3._id,
      licenseNumber: 'OD02-DEMO-103',
      phone: drvUser3.phone,
      assignedVehicleId: vehicles[2]._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      rating: 4.7,
      onTimeRuns: 19,
      isDemoData: true,
    },
  ]);

  // Mirror 1:1 Vehicle -> Driver links
  await Promise.all([
    Vehicle.findByIdAndUpdate(vehicles[0]._id, {
      assignedDriverId: drivers[0]._id,
      availability: VEHICLE_STATUS.ASSIGNED,
    }),
    Vehicle.findByIdAndUpdate(vehicles[1]._id, {
      assignedDriverId: drivers[1]._id,
      availability: VEHICLE_STATUS.ASSIGNED,
    }),
    Vehicle.findByIdAndUpdate(vehicles[2]._id, {
      assignedDriverId: drivers[2]._id,
      availability: VEHICLE_STATUS.ASSIGNED,
    }),
  ]);

  // 4. Prebuilt Bhubaneswar Demo Consignments
  const stopsSpec = [
    { ref: 'DEMO-BBSR-001', name: 'Aarav Pattnaik', phone: '+919861001001', street: 'KIIT Square, Patia', zone: 'Patia (Z-1)', pin: '751024', lat: 20.3533, lng: 85.8266, kg: 18.5, priority: PRIORITY_LEVELS.COLD_CHAIN },
    { ref: 'DEMO-BBSR-002', name: 'Snigdha Mohanty', phone: '+919861001002', street: 'Infocity Ave, Patia', zone: 'Patia (Z-1)', pin: '751024', lat: 20.3489, lng: 85.8154, kg: 12.0, priority: PRIORITY_LEVELS.STANDARD },
    { ref: 'DEMO-BBSR-003', name: 'Debashis Nayak', phone: '+919861001003', street: 'Esplanade One, Rasulgarh', zone: 'Other', pin: '751010', lat: 20.2908, lng: 85.8629, kg: 24.0, priority: PRIORITY_LEVELS.URGENT },
    { ref: 'DEMO-BBSR-004', name: 'Pratyusha Swain', phone: '+919861001004', street: 'Kalinga Hospital Rd, Chandrasekharpur', zone: 'Chandrasekharpur', pin: '751023', lat: 20.3219, lng: 85.8171, kg: 9.5, priority: PRIORITY_LEVELS.STANDARD },
    { ref: 'DEMO-BBSR-005', name: 'Satyajit Behera', phone: '+919861001005', street: 'Pal Heights, Jaydev Vihar', zone: 'Jaydev Vihar (Z-2)', pin: '751013', lat: 20.2994, lng: 85.8245, kg: 14.2, priority: PRIORITY_LEVELS.URGENT },
    { ref: 'DEMO-BBSR-006', name: 'Ipsita Dash', phone: '+919861001006', street: 'XIMB Square, Jaydev Vihar', zone: 'Jaydev Vihar (Z-2)', pin: '751013', lat: 20.3075, lng: 85.8198, kg: 21.0, priority: PRIORITY_LEVELS.STANDARD },
    { ref: 'DEMO-BBSR-007', name: 'Subham Tripathy', phone: '+919861001007', street: 'BMC Bhawani Mall, Saheed Nagar', zone: 'Saheed Nagar (Z-3)', pin: '751007', lat: 20.2895, lng: 85.8442, kg: 16.0, priority: PRIORITY_LEVELS.COLD_CHAIN },
    { ref: 'DEMO-BBSR-008', name: 'Ananya Sahoo', phone: '+919861001008', street: 'Rupali Square, Saheed Nagar', zone: 'Saheed Nagar (Z-3)', pin: '751007', lat: 20.2867, lng: 85.8414, kg: 7.8, priority: PRIORITY_LEVELS.STANDARD },
    { ref: 'DEMO-BBSR-009', name: 'Rohan Parida', phone: '+919861001009', street: 'Khandagiri Square', zone: 'Khandagiri (Z-4)', pin: '751030', lat: 20.2569, lng: 85.7792, kg: 28.5, priority: PRIORITY_LEVELS.STANDARD },
    { ref: 'DEMO-BBSR-010', name: 'Madhusmita Jena', phone: '+919861001010', street: 'SUM Hospital Rd, Khandagiri', zone: 'Khandagiri (Z-4)', pin: '751003', lat: 20.2818, lng: 85.7721, kg: 11.4, priority: PRIORITY_LEVELS.URGENT },
  ];

  const deliveries = await Delivery.create(
    stopsSpec.map((s) => ({
      orderReference: s.ref,
      customer: { name: s.name, phone: s.phone },
      address: { street: s.street, city: 'Bhubaneswar', zone: s.zone, postalCode: s.pin },
      location: {
        type: 'Point',
        coordinates: [s.lng, s.lat],
        geocoded: true,
        geocodingConfidence: 0.95,
        geocodingSource: 'MANUAL',
      },
      weightKg: s.kg,
      volumeM3: Number((s.kg * 0.004).toFixed(3)),
      priority: s.priority,
      timeWindow: { start: '09:00', end: '18:00' },
      status: DELIVERY_STATUS.READY,
      isDemoData: true,
    }))
  );

  // 5. Ready Dispatch Batch linking all 10 Demo Deliveries & 3 Demo Vehicles/Drivers
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalWeightKg = Number(deliveries.reduce((sum, d) => sum + d.weightKg, 0).toFixed(1));
  const demoBatch = await DeliveryBatch.create({
    code: 'BATCH-DEMO-BBSR-01',
    name: 'Prebuilt Bhubaneswar Morning Wave (Demo)',
    date: todayStr,
    shift: 'Shift A (08:00 - 17:00)',
    depot: CANONICAL_DEPOT,
    deliveryIds: deliveries.map((d) => d._id),
    vehicleIds: [vehicles[0]._id, vehicles[1]._id, vehicles[2]._id],
    driverIds: drivers.map((d) => d._id),
    status: 'READY',
    metrics: {
      totalDeliveries: deliveries.length,
      totalWeightKg,
      assignedDeliveries: 0,
    },
    isDemoData: true,
  });

  await Delivery.updateMany(
    { _id: { $in: deliveries.map((d) => d._id) } },
    { $set: { batchId: demoBatch._id } }
  );

  await AuditEvent.create({
    batchId: demoBatch._id,
    type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
    actorId: actorUserId || demoManager._id,
    actorRole: actorUserId ? ROLES.ADMIN : 'SYSTEM',
    action: 'Imported prebuilt Bhubaneswar demo dataset (isDemoData=true)',
    metadata: {
      batchCode: demoBatch.code,
      deliveries: deliveries.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
    },
    isDemoData: true,
  });

  return getDemoDataStatus();
}

/**
 * Builds a MongoDB filter combining `{ isDemoData: true }` with any non-null
 * entity reference clauses applicable to the target model.
 */
function buildDemoCascadeFilter(clauses = []) {
  const validClauses = clauses.filter(Boolean);
  if (!validClauses.length) {
    return { isDemoData: true };
  }
  return { $or: [{ isDemoData: true }, ...validClauses] };
}

/**
 * Deletes ONLY records explicitly marked `isDemoData: true` plus any routes,
 * audit/delivery events, notifications, shifts, telemetry, checklists,
 * maintenance records, incidents, or assignments linked to those demo IDs.
 * Real users, orders, routes, vehicles, and drivers remain completely untouched.
 */
async function deleteDemoDataset() {
  // Step A: Query root demo entity IDs in parallel
  const [demoUserIds, demoDriverIds, demoVehicleIds, demoBatchIds, demoDeliveryIds] =
    await Promise.all([
      User.find({ isDemoData: true }).distinct('_id'),
      Driver.find({ isDemoData: true }).distinct('_id'),
      Vehicle.find({ isDemoData: true }).distinct('_id'),
      DeliveryBatch.find({ isDemoData: true }).distinct('_id'),
      Delivery.find({ isDemoData: true }).distinct('_id'),
    ]);

  // Step B: Resolve all demo-linked Route IDs before deleting secondary or core records
  const routeClauses = [{ isDemoData: true }];
  if (demoBatchIds.length) routeClauses.push({ batchId: { $in: demoBatchIds } });
  if (demoDriverIds.length) routeClauses.push({ driverId: { $in: demoDriverIds } });
  if (demoVehicleIds.length) routeClauses.push({ vehicleId: { $in: demoVehicleIds } });
  if (demoDeliveryIds.length) routeClauses.push({ 'stops.deliveryId': { $in: demoDeliveryIds } });

  const routeFilter = routeClauses.length === 1 ? routeClauses[0] : { $or: routeClauses };
  const demoRouteIds = await Route.find(routeFilter).distinct('_id');

  // Step C: Build non-empty reference clauses scoped cleanly per model
  const driverClause = demoDriverIds.length ? { driverId: { $in: demoDriverIds } } : null;
  const vehicleClause = demoVehicleIds.length ? { vehicleId: { $in: demoVehicleIds } } : null;
  const routeClause = demoRouteIds.length ? { routeId: { $in: demoRouteIds } } : null;
  const batchClause = demoBatchIds.length ? { batchId: { $in: demoBatchIds } } : null;
  const deliveryClause = demoDeliveryIds.length ? { deliveryId: { $in: demoDeliveryIds } } : null;
  const actorClause = demoUserIds.length ? { actorId: { $in: demoUserIds } } : null;

  const demoUserIdStrs = demoUserIds.map((id) => id.toString());
  const demoDriverIdStrs = demoDriverIds.map((id) => id.toString());
  const demoVehicleIdStrs = demoVehicleIds.map((id) => id.toString());
  const demoRouteIdStrs = demoRouteIds.map((id) => id.toString());
  const demoDeliveryIdStrs = demoDeliveryIds.map((id) => id.toString());

  const notificationClauses = [
    { isDemoData: true },
    { 'metadata.isDemoData': true },
  ];
  if (demoUserIds.length) {
    notificationClauses.push({ targetUserId: { $in: demoUserIds } });
    notificationClauses.push({ 'metadata.userId': { $in: [...demoUserIds, ...demoUserIdStrs] } });
  }
  if (demoDriverIds.length) {
    notificationClauses.push({ 'metadata.driverId': { $in: [...demoDriverIds, ...demoDriverIdStrs] } });
  }
  if (demoVehicleIds.length) {
    notificationClauses.push({ 'metadata.vehicleId': { $in: [...demoVehicleIds, ...demoVehicleIdStrs] } });
  }
  if (demoRouteIds.length) {
    notificationClauses.push({ 'metadata.routeId': { $in: [...demoRouteIds, ...demoRouteIdStrs] } });
  }
  if (demoDeliveryIds.length) {
    notificationClauses.push({ 'metadata.deliveryId': { $in: [...demoDeliveryIds, ...demoDeliveryIdStrs] } });
  }

  const auditFilter = buildDemoCascadeFilter([
    batchClause,
    routeClause,
    deliveryClause,
    actorClause,
  ]);

  const secondaryDeletes = [
    RouteAssignment.deleteMany(buildDemoCascadeFilter([routeClause, vehicleClause, driverClause])),
    DriverShift.deleteMany(buildDemoCascadeFilter([driverClause, vehicleClause])),
    DriverIncident.deleteMany(buildDemoCascadeFilter([driverClause, routeClause, deliveryClause])),
    TelemetryPing.deleteMany(buildDemoCascadeFilter([vehicleClause, driverClause, routeClause])),
    TelemetryAlert.deleteMany(buildDemoCascadeFilter([vehicleClause, driverClause, routeClause])),
    VehicleChecklist.deleteMany(buildDemoCascadeFilter([vehicleClause, driverClause, routeClause])),
    VehicleAssignment.deleteMany(buildDemoCascadeFilter([vehicleClause, driverClause, routeClause])),
    MaintenanceRecord.deleteMany(buildDemoCascadeFilter([vehicleClause])),
    SystemNotification.deleteMany({ $or: notificationClauses }),
  ];

  const coreDeletes = [
    DeliveryEvent.deleteMany(auditFilter),
    ...(AuditEvent !== DeliveryEvent ? [AuditEvent.deleteMany(auditFilter)] : []),
    Route.deleteMany(routeFilter),
    Delivery.deleteMany({ isDemoData: true }),
    DeliveryBatch.deleteMany({ isDemoData: true }),
    Driver.deleteMany({ isDemoData: true }),
    Vehicle.deleteMany({ isDemoData: true }),
    User.deleteMany({ isDemoData: true }),
  ];

  const results = await Promise.all([...secondaryDeletes, ...coreDeletes]);
  const deletedCount = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);

  return {
    deletedCount,
    status: await getDemoDataStatus(),
  };
}

async function ensureDemoShowcaseUser(requestedRole) {
  const role = String(requestedRole || '').trim().toUpperCase();
  const spec = DEMO_SHOWCASE_PROFILES[role];
  if (!spec) {
    throw new AppError(
      'Demo showcase role must be ADMIN, FLEET_MANAGER, or DRIVER',
      400,
      'INVALID_DEMO_ROLE'
    );
  }

  // Fail closed if a real non-demo account exists at this showcase email before any auto-import
  let user = await User.findOne({ email: spec.email });
  if (user && user.isDemoData !== true) {
    throw new AppError(
      'Cannot sign in to a non-demo account via demo showcase',
      403,
      'DEMO_USER_ISOLATION_VIOLATION'
    );
  }

  const status = await getDemoDataStatus();
  if (!status.hasDemoData) {
    try {
      await importDemoDataset(null);
    } catch (err) {
      if (!err || err.code !== 'DEMO_DATA_ALREADY_LOADED') {
        throw err;
      }
    }
    user = await User.findOne({ email: spec.email });
  }

  if (user && user.isDemoData !== true) {
    throw new AppError(
      'Cannot sign in to a non-demo account via demo showcase',
      403,
      'DEMO_USER_ISOLATION_VIOLATION'
    );
  }

  if (!user) {
    user = await User.create({
      name: spec.name,
      email: spec.email,
      passwordHash: crypto.randomBytes(16).toString('hex'),
      demoCredentialEnc: null,
      role: spec.role,
      phone: spec.phone,
      department: spec.department,
      active: true,
      accountStatus: 'ACTIVE',
      emailVerified: true,
      isDemoData: true,
    });
  }

  let driverProfile = null;
  if (role === ROLES.DRIVER) {
    driverProfile = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
    if (!driverProfile) {
      driverProfile = await Driver.create({
        userId: user._id,
        licenseNumber: 'OD02-DEMO-101',
        phone: user.phone || '+919437090101',
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        isDemoData: true,
      });
      driverProfile = await Driver.findById(driverProfile._id).populate('assignedVehicleId');
    }
  }

  return { user, driverProfile };
}

module.exports = {
  DEMO_SHOWCASE_PROFILES,
  getDemoDataStatus,
  importDemoDataset,
  deleteDemoDataset,
  ensureDemoShowcaseUser,
};
