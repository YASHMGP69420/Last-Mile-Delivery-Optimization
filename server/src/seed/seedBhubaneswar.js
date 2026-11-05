const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Route = require('../models/Route');
const AuditEvent = require('../models/AuditEvent');
const { connectDB, disconnectDB } = require('../config/db');
const {
  ROLES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  VEHICLE_TYPES,
  FUEL_TYPES,
  DRIVER_AVAILABILITY,
  PRIORITY_LEVELS,
  CANONICAL_DEPOT,
} = require('../config/constants');

const seedDatabase = async () => {
  try {
    console.log('[Seed] Connecting to database for canonical seeding...');
    await connectDB();

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Vehicle.deleteMany({}),
      Driver.deleteMany({}),
      Delivery.deleteMany({}),
      DeliveryBatch.deleteMany({}),
      Route.deleteMany({}),
      AuditEvent.deleteMany({}),
    ]);

    console.log('[Seed] Creating demo users...');
    const passwordHashAdmin = await bcrypt.hash('Admin@123', 10);
    const passwordHashManager = await bcrypt.hash('Manager@123', 10);
    const passwordHashDriver = await bcrypt.hash('Driver@123', 10);

    const passwordHashQuickAdmin = await bcrypt.hash('admin123', 10);
    const passwordHashQuickManager = await bcrypt.hash('manager123', 10);
    const passwordHashQuickDriver = await bcrypt.hash('driver123', 10);

    const admin = await User.create({
      name: 'Chief Operations Admin',
      email: 'admin@smartroute.io',
      passwordHash: passwordHashAdmin,
      role: ROLES.ADMIN,
      phone: '+91 99370 00001',
      active: true,
    });

    // QuickLogin user
    await User.create({
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash: passwordHashQuickAdmin,
      role: ROLES.ADMIN,
      phone: '+91 99370 00010',
      active: true,
    });

    const manager = await User.create({
      name: 'Bhubaneswar Hub Dispatcher',
      email: 'manager@smartroute.io',
      passwordHash: passwordHashManager,
      role: ROLES.FLEET_MANAGER,
      phone: '+91 99370 00002',
      active: true,
    });

    // QuickLogin manager
    await User.create({
      name: 'Operations Manager',
      email: 'manager@example.com',
      passwordHash: passwordHashQuickManager,
      role: ROLES.FLEET_MANAGER,
      phone: '+91 99370 00020',
      active: true,
    });

    const driverUser = await User.create({
      name: 'Rajesh Mohanty',
      email: 'driver@smartroute.io',
      passwordHash: passwordHashDriver,
      role: ROLES.DRIVER,
      phone: '+91 94370 12345',
      active: true,
    });

    // QuickLogin driver
    const driverUserQuick = await User.create({
      name: 'Ramesh Chandra (Driver)',
      email: 'driver@example.com',
      passwordHash: passwordHashQuickDriver,
      role: ROLES.DRIVER,
      phone: '+91 94370 99887',
      active: true,
    });

    const driverUser2 = await User.create({
      name: 'Suresh Patra',
      email: 'suresh.driver@smartroute.io',
      passwordHash: passwordHashDriver,
      role: ROLES.DRIVER,
      phone: '+91 94370 54321',
      active: true,
    });

    console.log('[Seed] Creating fleet vehicles...');
    const vehicle1 = await Vehicle.create({
      vehicleId: 'OD-02-AK-1001',
      makeModel: 'Tata Ace EV',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 1000,
      capacityM3: 4.5,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.18,
      batterySoC: 92,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    const vehicle2 = await Vehicle.create({
      vehicleId: 'OD-02-BL-2002',
      makeModel: 'Mahindra Bolero Maxi Truck',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 1200,
      capacityM3: 5.2,
      fuelType: FUEL_TYPES.DIESEL,
      kmPerLitre: 12.5,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    const vehicle3 = await Vehicle.create({
      vehicleId: 'OD-02-CM-3003',
      makeModel: 'Hero Electric Nyx',
      type: VEHICLE_TYPES.BIKE,
      capacityKg: 80,
      capacityM3: 0.3,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.05,
      batterySoC: 88,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    const vehicle4 = await Vehicle.create({
      vehicleId: 'OD-02-DN-4004',
      makeModel: 'Bajaj Maxima Z 3-Wheeler',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 600,
      capacityM3: 2.8,
      fuelType: FUEL_TYPES.DIESEL,
      kmPerLitre: 18.0,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    const vehicle5 = await Vehicle.create({
      vehicleId: 'OD-02-EP-5005',
      makeModel: 'TVS King EV Cargo',
      type: VEHICLE_TYPES.VAN,
      capacityKg: 500,
      capacityM3: 2.5,
      fuelType: FUEL_TYPES.ELECTRIC,
      energyKWhPerKm: 0.12,
      batterySoC: 95,
      availability: VEHICLE_STATUS.AVAILABLE,
    });

    console.log('[Seed] Creating driver profiles with 1:1 vehicle assignment...');
    const driver1 = await Driver.create({
      userId: driverUser._id,
      licenseNumber: 'OD-02-2020-0089123',
      phone: driverUser.phone,
      assignedVehicleId: vehicle1._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      rating: 4.9,
      onTimeRuns: 142,
    });

    vehicle1.assignedDriverId = driver1._id;
    vehicle1.availability = VEHICLE_STATUS.ASSIGNED;
    await vehicle1.save();

    const driver2 = await Driver.create({
      userId: driverUser2._id,
      licenseNumber: 'OD-02-2018-0054321',
      phone: driverUser2.phone,
      assignedVehicleId: vehicle2._id,
      availability: DRIVER_AVAILABILITY.AVAILABLE,
      rating: 4.8,
      onTimeRuns: 98,
    });

    vehicle2.assignedDriverId = driver2._id;
    vehicle2.availability = VEHICLE_STATUS.ASSIGNED;
    await vehicle2.save();

    console.log('[Seed] Generating 55 deliveries across 5 Bhubaneswar clusters...');
    const clusters = [
      {
        zone: 'Patia (Z-1)',
        baseLat: 20.354,
        baseLng: 85.817,
        landmarks: [
          'KIIT Square, Patia',
          'Infocity Avenue, Patia',
          'DLF Cybercity, Patia',
          'KIMS Hospital Road',
          'Silicon Hills, Silicon Tech',
          'Sikharchandi Foothills',
          'Trident Academy Road',
          'Maruti Villa, Patia',
          'Magnet Square Mall, Patia',
          'Prasanti Vihar, Patia',
          'KIIT International School',
        ],
      },
      {
        zone: 'Jaydev Vihar (Z-2)',
        baseLat: 20.301,
        baseLng: 85.823,
        landmarks: [
          'Mayfair Lagoon Entrance',
          'Fortune Tower Commercial Complex',
          'Pal Heights Mall, Jaydev Vihar',
          'Nayapalli Behera Sahi',
          'Indradhanu Market, Nayapalli',
          'IRC Village, Jaydev Vihar',
          'Ekamra Villa, Jaydev Vihar',
          'Salia Sahi Link Road',
          'Biju Patnaik College Road',
          'VIP Road, Nayapalli',
          'World Skill Center Campus',
        ],
      },
      {
        zone: 'Saheed Nagar (Z-3)',
        baseLat: 20.288,
        baseLng: 85.852,
        landmarks: [
          'Bhawani Mall, Saheed Nagar',
          'Maharshi College Road',
          'Angan Restaurant Square',
          'Vanivihar University Gate',
          'Satya Nagar Medical Road',
          'Janpath Boulevard, Block 4',
          'Saheed Nagar Post Office',
          'Sparsh Hospital Lane',
          'Utkal Chambers, Saheed Nagar',
          'Kalyani Mandap, Saheed Nagar',
          'Bomikhal Canal Road',
        ],
      },
      {
        zone: 'Khandagiri (Z-4)',
        baseLat: 20.258,
        baseLng: 85.787,
        landmarks: [
          'Khandagiri Caves Foothill Plaza',
          'Baramunda Bus Stand Terminal',
          'Udayagiri Heritage Path',
          'AMRI Hospital Lane, Khandagiri',
          'Kolathia Square, Khandagiri',
          'Aiginia Wholesale Vegetable Hub',
          'Dharmavihar Residential Colony',
          'Khandagiri Bari Enclave',
          'Ghatikia Green Valley',
          'Jagamara Road Intersection',
          'ITER College Campus Road',
        ],
      },
      {
        zone: 'Chandrasekharpur',
        baseLat: 20.325,
        baseLng: 85.818,
        landmarks: [
          'Care Hospital Road, CSPur',
          'Damana Square Commercial Row',
          'Kalarahanga Main Road',
          'Sailashree Vihar Phase 2',
          'Niladri Vihar Sector 3',
          'IOCL Regional Office, CSPur',
          'Aditya Care Plaza',
          'Railway Complex, CSPur',
          'Lumbini Vihar Residential Park',
          'Bhubaneswar Club North Annex',
          'Nandan Kanan Road, Raghunathpur',
        ],
      },
    ];

    const customerNames = [
      'Alok Mohapatra', 'Priyanka Das', 'Soumya Ranjan Ray', 'Lipsa Tripathy',
      'Debasis Sahoo', 'Archana Nayak', 'Rakesh Behera', 'Manas Jena',
      'Tanmayee Mishra', 'Bikash Samal', 'Smita Pradhan', 'Anurag Panda',
      'Sneha Patnaik', 'Prashant Kar', 'Sarmistha Barik', 'Gautam Acharya',
      'Monalisa Rout', 'Chandan Senapati', 'Sunita Mahalik', 'Subhashree Biswal',
    ];

    const priorities = [PRIORITY_LEVELS.STANDARD, PRIORITY_LEVELS.STANDARD, PRIORITY_LEVELS.URGENT, PRIORITY_LEVELS.COLD_CHAIN];
    const timeWindows = [
      { start: '09:00', end: '11:00' },
      { start: '11:00', end: '13:00' },
      { start: '14:00', end: '16:00' },
      { start: '16:00', end: '18:00' },
    ];

    const deliveryDocs = [];
    let count = 1;

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.landmarks.length; i++) {
        const landmark = cluster.landmarks[i];
        const custName = customerNames[(count - 1) % customerNames.length];
        const priority = priorities[(count - 1) % priorities.length];
        const window = timeWindows[(count - 1) % timeWindows.length];

        // Slightly jitter coordinates around cluster base
        const latOffset = (Math.random() - 0.5) * 0.018;
        const lngOffset = (Math.random() - 0.5) * 0.018;
        const lat = parseFloat((cluster.baseLat + latOffset).toFixed(5));
        const lng = parseFloat((cluster.baseLng + lngOffset).toFixed(5));
        const weightKg = parseFloat((1.2 + Math.random() * 24).toFixed(1));

        deliveryDocs.push({
          orderReference: `#DEL-BBSR-${String(count).padStart(3, '0')}`,
          customer: {
            name: custName,
            phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
            email: `${custName.toLowerCase().replace(/\s+/g, '.')}${count}@example.in`,
          },
          address: {
            street: `${landmark}, Plot ${10 + (count % 80)}`,
            city: 'Bhubaneswar',
            zone: cluster.zone,
            postalCode: '7510' + String(10 + (count % 15)),
          },
          location: {
            type: 'Point',
            coordinates: [lng, lat],
            geocoded: true,
            geocodingConfidence: 0.95,
            geocodingSource: 'CACHE',
          },
          weightKg,
          volumeM3: parseFloat((weightKg * 0.003).toFixed(3)),
          priority,
          timeWindow: window,
          serviceDurationMinutes: priority === PRIORITY_LEVELS.COLD_CHAIN ? 15 : 10,
          status: DELIVERY_STATUS.READY,
        });

        count++;
      }
    }

    const insertedDeliveries = await Delivery.insertMany(deliveryDocs);
    console.log(`[Seed] Inserted ${insertedDeliveries.length} canonical deliveries.`);

    // Group first 25 deliveries into the morning operational batch
    const batchDeliveries = insertedDeliveries.slice(0, 25);
    const batchDeliveryIds = batchDeliveries.map((d) => d._id);
    const totalBatchWeight = batchDeliveries.reduce((acc, d) => acc + d.weightKg, 0);

    const todayStr = new Date().toISOString().split('T')[0];

    const batch = await DeliveryBatch.create({
      code: 'BBSR-EXP-01',
      name: 'Bhubaneswar Morning Express Dispatch',
      date: todayStr,
      shift: 'Shift A (08:00 - 17:00)',
      depot: CANONICAL_DEPOT,
      deliveryIds: batchDeliveryIds,
      vehicleIds: [vehicle1._id, vehicle2._id, vehicle3._id],
      driverIds: [driver1._id, driver2._id],
      status: 'READY',
      metrics: {
        totalDeliveries: batchDeliveryIds.length,
        totalWeightKg: parseFloat(totalBatchWeight.toFixed(1)),
        assignedDeliveries: 0,
      },
    });

    // Update batchId in delivery records
    await Delivery.updateMany({ _id: { $in: batchDeliveryIds } }, { batchId: batch._id });

    // Seed audit event
    await AuditEvent.create({
      batchId: batch._id,
      type: 'STATUS_CHANGE',
      actorId: admin._id,
      actorRole: 'ADMIN',
      action: 'Seeded canonical Bhubaneswar logistics operational cluster',
      metadata: {
        depot: CANONICAL_DEPOT.name,
        deliveriesCount: insertedDeliveries.length,
        batchCode: batch.code,
      },
    });

    console.log(`[Seed] Seeded operational batch ${batch.code} with ${batchDeliveryIds.length} deliveries.`);
    console.log('[Seed] Canonical Bhubaneswar dataset seeded successfully!');

    return {
      admin,
      manager,
      driverUser,
      driver1,
      vehicle1,
      deliveriesCount: insertedDeliveries.length,
      batch,
    };
  } catch (error) {
    console.error(`[Seed] Seeding failed: ${error.message}`);
    throw error;
  }
};

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = seedDatabase;
