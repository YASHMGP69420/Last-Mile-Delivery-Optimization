/**
 * Canonical test fixtures for SmartRoute 4-tier E2E testing framework.
 * Focuses on the Bhubaneswar metropolitan delivery zone.
 */

const CANONICAL_DEPOT = {
  name: 'Rasulgarh Central Hub',
  address: 'Plot 102, Rasulgarh Industrial Estate, Bhubaneswar, Odisha 751010',
  location: {
    type: 'Point',
    coordinates: [85.863, 20.297], // [lng, lat]
  },
};

const BHUBANESWAR_CLUSTERS = [
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

const VEHICLE_FIXTURES = {
  tataAceEV: {
    vehicleId: 'OD-02-AK-1001',
    makeModel: 'Tata Ace EV',
    type: 'Van',
    capacityKg: 1000,
    capacityM3: 4.5,
    fuelType: 'Electric',
    energyKWhPerKm: 0.18,
    batterySoC: 92,
    availability: 'AVAILABLE',
  },
  mahindraBoleroDiesel: {
    vehicleId: 'OD-02-BL-2002',
    makeModel: 'Mahindra Bolero Maxi Truck',
    type: 'Van',
    capacityKg: 1200,
    capacityM3: 5.2,
    fuelType: 'Diesel',
    kmPerLitre: 12.5,
    availability: 'AVAILABLE',
  },
  heroElectricBike: {
    vehicleId: 'OD-02-CM-3003',
    makeModel: 'Hero Electric Nyx',
    type: 'Bike',
    capacityKg: 80,
    capacityM3: 0.3,
    fuelType: 'Electric',
    energyKWhPerKm: 0.05,
    batterySoC: 88,
    availability: 'AVAILABLE',
  },
  bajajMaximaDiesel: {
    vehicleId: 'OD-02-DN-4004',
    makeModel: 'Bajaj Maxima Z 3-Wheeler',
    type: 'Van',
    capacityKg: 600,
    capacityM3: 2.8,
    fuelType: 'Diesel',
    kmPerLitre: 18.0,
    availability: 'AVAILABLE',
  },
};

const VALID_CSV_SAMPLE = `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-TEST-001,Alok Mohapatra,+919937011111,alok@test.in,KIIT Square Plot 12,Bhubaneswar,Patia (Z-1),751024,20.3542,85.8175,5.5,0.02,STANDARD,09:00,12:00
#DEL-TEST-002,Priyanka Das,+919937022222,priyanka@test.in,Mayfair Lagoon Gate,Bhubaneswar,Jaydev Vihar (Z-2),751013,20.3015,85.8232,12.0,0.05,URGENT,10:00,13:00
#DEL-TEST-003,Soumya Ray,+919937033333,soumya@test.in,Bhawani Mall Block B,Bhubaneswar,Saheed Nagar (Z-3),751007,20.2884,85.8521,3.2,0.01,COLD_CHAIN,11:00,14:00
#DEL-TEST-004,Lipsa Tripathy,+919937044444,lipsa@test.in,Khandagiri Caves Road,Bhubaneswar,Khandagiri (Z-4),751030,20.2581,85.7876,8.4,0.03,STANDARD,12:00,15:00
#DEL-TEST-005,Debasis Sahoo,+919937055555,debasis@test.in,Care Hospital CSPur,Bhubaneswar,Chandrasekharpur,751023,20.3255,85.8184,15.0,0.06,STANDARD,13:00,16:00`;

const INVALID_CSVS = {
  empty: '',
  invalidHeaders: `colA,colB,colC\n1,2,3`,
  nonNumericWeight: `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-INV-001,John Doe,+919937012345,john@test.in,KIIT Square,Bhubaneswar,Patia,751024,20.35,85.81,TEN_KG,0.02,STANDARD,09:00,11:00`,
  zeroWeight: `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-INV-002,John Doe,+919937012345,john@test.in,KIIT Square,Bhubaneswar,Patia,751024,20.35,85.81,0,0.02,STANDARD,09:00,11:00`,
  invertedTimeWindow: `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DEL-INV-003,John Doe,+919937012345,john@test.in,KIIT Square,Bhubaneswar,Patia,751024,20.35,85.81,5.0,0.02,STANDARD,14:00,11:00`,
  intraFileDuplicates: `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#DUP-001,John Doe,+919937012345,john@test.in,KIIT Square,Bhubaneswar,Patia,751024,20.35,85.81,5.0,0.02,STANDARD,09:00,11:00
#DUP-001,Jane Smith,+919937054321,jane@test.in,Nayapalli,Bhubaneswar,Jaydev Vihar,751013,20.30,85.82,7.0,0.03,STANDARD,10:00,12:00`,
  caseInsensitiveDuplicates: `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,lat,lng,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd
#case-dup-01,John Doe,+919937012345,john@test.in,KIIT Square,Bhubaneswar,Patia,751024,20.35,85.81,5.0,0.02,STANDARD,09:00,11:00
#CASE-DUP-01,Jane Smith,+919937054321,jane@test.in,Nayapalli,Bhubaneswar,Jaydev Vihar,751013,20.30,85.82,7.0,0.03,STANDARD,10:00,12:00`,
};

module.exports = {
  CANONICAL_DEPOT,
  BHUBANESWAR_CLUSTERS,
  VEHICLE_FIXTURES,
  VALID_CSV_SAMPLE,
  INVALID_CSVS,
};
