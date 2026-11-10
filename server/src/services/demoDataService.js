const crypto = require('crypto');
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

async function getDemoDataStatus() {
  const [users, drivers, vehicles, deliveries, batches, routes] = await Promise.all([
    User.countDocuments({ isDemoData: true }),
    Driver.countDocuments({ isDemoData: true }),
    Vehicle.countDocuments({ isDemoData: true }),
    Delivery.countDocuments({ isDemoData: true }),
    DeliveryBatch.countDocuments({ isDemoData: true }),
    Route.countDocuments({ isDemoData: true }),
  ]);

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

  // 1. Demo Fleet Manager & 3 Demo Drivers
  const [demoManager, drvUser1, drvUser2, drvUser3] = await User.create([
    {
      name: 'Demo Hub Dispatcher',
      email: 'demo.manager@smartroute.local',
      passwordHash: demoPasswordSeed(),
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
      passwordHash: demoPasswordSeed(),
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
      passwordHash: demoPasswordSeed(),
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
      passwordHash: demoPasswordSeed(),
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
 * Deletes ONLY records explicitly marked `isDemoData: true` (plus any shifts,
 * telemetry, checklists, incidents, or assignments linked to those demo IDs).
 * Real users, orders, routes, vehicles, and drivers remain completely untouched.
 */
async function deleteDemoDataset() {
  const [demoDriverIds, demoVehicleIds, demoRouteIds, demoBatchIds, demoDeliveryIds] =
    await Promise.all([
      Driver.find({ isDemoData: true }).distinct('_id'),
      Vehicle.find({ isDemoData: true }).distinct('_id'),
      Route.find({ isDemoData: true }).distinct('_id'),
      DeliveryBatch.find({ isDemoData: true }).distinct('_id'),
      Delivery.find({ isDemoData: true }).distinct('_id'),
    ]);

  const refClauses = [];
  if (demoDriverIds.length) refClauses.push({ driverId: { $in: demoDriverIds } });
  if (demoVehicleIds.length) refClauses.push({ vehicleId: { $in: demoVehicleIds } });
  if (demoRouteIds.length) refClauses.push({ routeId: { $in: demoRouteIds } });
  if (demoBatchIds.length) refClauses.push({ batchId: { $in: demoBatchIds } });
  if (demoDeliveryIds.length) refClauses.push({ deliveryId: { $in: demoDeliveryIds } });

  const secondaryDeletes = refClauses.length
    ? [
        RouteAssignment.deleteMany({ $or: refClauses }),
        DriverShift.deleteMany({ $or: refClauses }),
        DriverIncident.deleteMany({ $or: refClauses }),
        TelemetryPing.deleteMany({ $or: refClauses }),
        TelemetryAlert.deleteMany({ $or: refClauses }),
        VehicleChecklist.deleteMany({ $or: refClauses }),
        VehicleAssignment.deleteMany({ $or: refClauses }),
        MaintenanceRecord.deleteMany({ $or: refClauses }),
      ]
    : [];

  const auditFilter = refClauses.length
    ? { $or: [{ isDemoData: true }, ...refClauses] }
    : { isDemoData: true };

  const coreDeletes = [
    SystemNotification.deleteMany({ 'metadata.isDemoData': true }),
    AuditEvent.deleteMany(auditFilter),
    Delivery.deleteMany({ isDemoData: true }),
    DeliveryBatch.deleteMany({ isDemoData: true }),
    Route.deleteMany({ isDemoData: true }),
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

module.exports = {
  getDemoDataStatus,
  importDemoDataset,
  deleteDemoDataset,
};
