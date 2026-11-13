import { Delivery, DeliveryBatch, Vehicle, Driver, Route, OptimizationResult, PlannedRoute, VehicleAssignment } from '../types';

// Mock data factories for SmartRoute components

export const createMockUser = (overrides: Partial<{
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'FLEET_MANAGER' | 'DRIVER';
  phone: string;
  licenseNumber: string;
  isActive: boolean;
}> = {}) => ({
  id: overrides.id || `user-${Date.now()}`,
  _id: overrides.id || `user-${Date.now()}`,
  name: overrides.name || 'Test User',
  email: overrides.email || 'test@example.com',
  role: overrides.role || 'FLEET_MANAGER',
  phone: overrides.phone || '+91 98610 00000',
  licenseNumber: overrides.licenseNumber || 'DL-TEST-001',
  isActive: overrides.isActive ?? true,
  createdAt: new Date().toISOString(),
});

export const createMockVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  _id: overrides._id || `vehicle-${Date.now()}`,
  id: overrides._id || `vehicle-${Date.now()}`,
  plate: overrides.plate || `OR-02-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
  makeModel: overrides.makeModel || 'Tata Ace EV',
  capacityKg: overrides.capacityKg || 1000,
  fuelType: overrides.fuelType || 'Electric',
  kmPerLitre: overrides.kmPerLitre || 12.5,
  availability: overrides.availability || 'AVAILABLE',
  assignedDriverId: overrides.assignedDriverId || null,
  createdAt: overrides.createdAt || new Date().toISOString(),
  updatedAt: overrides.updatedAt || new Date().toISOString(),
  ...overrides,
});

export const createMockDriver = (overrides: Partial<Driver> = {}): Driver => ({
  _id: overrides._id || `driver-${Date.now()}`,
  id: overrides._id || `driver-${Date.now()}`,
  name: overrides.name || 'Test Driver',
  email: overrides.email || 'driver@test.com',
  phone: overrides.phone || '+91 98610 00000',
  licenseNumber: overrides.licenseNumber || 'DL-TEST-001',
  availability: overrides.availability || 'AVAILABLE',
  assignedVehicleId: overrides.assignedVehicleId || null,
  currentRouteId: overrides.currentRouteId || null,
  shiftStatus: overrides.shiftStatus || null,
  createdAt: overrides.createdAt || new Date().toISOString(),
  updatedAt: overrides.updatedAt || new Date().toISOString(),
  ...overrides,
});

export const createMockDelivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  _id: overrides._id || `delivery-${Date.now()}`,
  id: overrides._id || `delivery-${Date.now()}`,
  orderReference: overrides.orderReference || `#DEL-${Date.now()}`,
  batchId: overrides.batchId || `batch-${Date.now()}`,
  customer: overrides.customer || {
    name: 'Test Customer',
    phone: '+91 98610 00000',
  },
  address: overrides.address || {
    street: 'Test Street',
    zone: 'Saheed Nagar (Z-3)',
    postalCode: '751007',
  },
  location: overrides.location || {
    type: 'Point',
    coordinates: [85.8520, 20.2880],
    geocoded: true,
  },
  weightKg: overrides.weightKg || 25.0,
  priority: overrides.priority || 'Standard',
  timeWindow: overrides.timeWindow || { start: '09:00', end: '11:00' },
  status: overrides.status || 'READY',
  assignedVehicleId: overrides.assignedVehicleId || null,
  assignedDriverId: overrides.assignedDriverId || null,
  pod: overrides.pod || null,
  createdAt: overrides.createdAt || new Date().toISOString(),
  updatedAt: overrides.updatedAt || new Date().toISOString(),
  ...overrides,
});

export const createMockBatch = (overrides: Partial<DeliveryBatch> = {}): DeliveryBatch => ({
  _id: overrides._id || `batch-${Date.now()}`,
  id: overrides._id || `batch-${Date.now()}`,
  code: overrides.code || `BATCH-${Date.now()}`,
  name: overrides.name || 'Test Batch',
  date: overrides.date || new Date().toISOString().split('T')[0],
  shift: overrides.shift || 'Shift A (08:00 - 17:00)',
  depot: overrides.depot || { name: 'Bhubaneswar Central Depot', location: { type: 'Point', coordinates: [85.8245, 20.2961] } },
  deliveryIds: overrides.deliveryIds || [],
  vehicleIds: overrides.vehicleIds || [],
  driverIds: overrides.driverIds || [],
  status: overrides.status || 'READY',
  metrics: overrides.metrics || {
    totalDeliveries: 0,
    assignedDeliveries: 0,
    completedDeliveries: 0,
    totalWeightKg: 0,
    totalDistanceKm: 0,
    totalDurationMin: 0,
  },
  createdAt: overrides.createdAt || new Date().toISOString(),
  updatedAt: overrides.updatedAt || new Date().toISOString(),
  ...overrides,
});

export const createMockRoute = (overrides: Partial<PlannedRoute> = {}): PlannedRoute => ({
  id: overrides.id || `route-${Date.now()}`,
  routeCode: overrides.routeCode || `RT-${Date.now()}`,
  batchId: overrides.batchId || `batch-${Date.now()}`,
  vehicleId: overrides.vehicleId || `vehicle-${Date.now()}`,
  driverId: overrides.driverId || `driver-${Date.now()}`,
  status: overrides.status || 'DRAFT',
  version: overrides.version || 1,
  depot: overrides.depot || { name: 'Bhubaneswar Central Depot', location: { type: 'Point', coordinates: [85.8245, 20.2961] } },
  stops: overrides.stops || [],
  polyline: overrides.polyline || '',
  metrics: overrides.metrics || {
    totalDistanceKm: 15.5,
    totalDurationMin: 45,
    costInr: 1250,
    co2Kg: 2.5,
  },
  createdAt: overrides.createdAt || new Date().toISOString(),
  updatedAt: overrides.updatedAt || new Date().toISOString(),
  dispatchedAt: overrides.dispatchedAt || null,
  ...overrides,
});

export const createMockVehicleAssignment = (overrides: Partial<VehicleAssignment> = {}): VehicleAssignment => ({
  vehicleId: overrides.vehicleId || `vehicle-${Date.now()}`,
  vehiclePlate: overrides.vehiclePlate || 'OR-02-AB-1234',
  vehicleMakeModel: overrides.vehicleMakeModel || 'Tata Ace EV',
  driverId: overrides.driverId || `driver-${Date.now()}`,
  driverName: overrides.driverName || 'Test Driver',
  driverLicenseNumber: overrides.driverLicenseNumber || 'DL-TEST-001',
  binIndex: overrides.binIndex || 0,
  utilizationPercent: overrides.utilizationPercent || 75,
  ...overrides,
});

export const createMockOptimizationResult = (overrides: Partial<OptimizationResult> = {}): OptimizationResult => ({
  baseline: overrides.baseline || {
    totalDistanceKm: 20.0,
    totalDurationMin: 60,
    costInr: 1500,
    co2Kg: 3.0,
    stopsCount: 5,
  },
  optimized: overrides.optimized || {
    totalDistanceKm: 15.5,
    totalDurationMin: 45,
    costInr: 1250,
    co2Kg: 2.5,
    stopsCount: 5,
  },
  deltas: overrides.deltas || {
    distanceSavedKm: 4.5,
    percentDistanceReduction: 22.5,
    costSavedInr: 250,
    co2AvoidedKg: 0.5,
  },
  unassignedDeliveries: overrides.unassignedDeliveries || [],
  routes: overrides.routes || [createMockRoute()],
  vehicleAssignments: overrides.vehicleAssignments || [createMockVehicleAssignment()],
  ...overrides,
});

// Multi-bin mock data
export const createMultiBinOptimizationResult = (binCount: number = 3): OptimizationResult => {
  const routes = Array.from({ length: binCount }, (_, i) => createMockRoute({
    id: `route-${Date.now()}-${i}`,
    routeCode: `RT-${Date.now()}-${i}`,
    binIndex: i,
  }));

  const vehicleAssignments = Array.from({ length: binCount }, (_, i) => createMockVehicleAssignment({
    binIndex: i,
    vehicleId: `vehicle-${Date.now()}-${i}`,
    vehiclePlate: `OR-02-AB-${String(1234 + i).padStart(4, '0')}`,
    driverId: `driver-${Date.now()}-${i}`,
    driverName: `Driver ${i + 1}`,
  }));

  return createMockOptimizationResult({
    routes,
    vehicleAssignments,
    baseline: {
      totalDistanceKm: 45.0,
      totalDurationMin: 135,
      costInr: 3500,
      co2Kg: 7.0,
      stopsCount: 15,
    },
    optimized: {
      totalDistanceKm: 35.5,
      totalDurationMin: 105,
      costInr: 2800,
      co2Kg: 5.5,
      stopsCount: 15,
    },
    deltas: {
      distanceSavedKm: 9.5,
      percentDistanceReduction: 21.1,
      costSavedInr: 700,
      co2AvoidedKg: 1.5,
    },
  });
};

// Zone-aware mock deliveries for bin packing tests
export const createZoneAwareDeliveries = (): Delivery[] => [
  // Zone Z-1 (Patia)
  createMockDelivery({
    orderReference: '#DEL-Z1-1',
    address: { street: 'KIIT Square', zone: 'Patia (Z-1)', postalCode: '751024' },
    location: { type: 'Point', coordinates: [85.8170, 20.3540], geocoded: true },
  }),
  createMockDelivery({
    orderReference: '#DEL-Z1-2',
    address: { street: 'Patia Chowk', zone: 'Patia (Z-1)', postalCode: '751024' },
    location: { type: 'Point', coordinates: [85.8200, 20.3500], geocoded: true },
  }),
  // Zone Z-2 (Jaydev Vihar)
  createMockDelivery({
    orderReference: '#DEL-Z2-1',
    address: { street: 'Mayfair Lagoon', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
    location: { type: 'Point', coordinates: [85.8230, 20.3010], geocoded: true },
  }),
  createMockDelivery({
    orderReference: '#DEL-Z2-2',
    address: { street: 'Jaydev Vihar Road', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
    location: { type: 'Point', coordinates: [85.8250, 20.2980], geocoded: true },
  }),
  // Zone Z-3 (Saheed Nagar)
  createMockDelivery({
    orderReference: '#DEL-Z3-1',
    address: { street: 'Bhawani Mall', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
    location: { type: 'Point', coordinates: [85.8520, 20.2880], geocoded: true },
  }),
  createMockDelivery({
    orderReference: '#DEL-Z3-2',
    address: { street: 'Saheed Nagar Market', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
    location: { type: 'Point', coordinates: [85.8550, 20.2850], geocoded: true },
  }),
  // Zone Z-4 (Khandagiri)
  createMockDelivery({
    orderReference: '#DEL-Z4-1',
    address: { street: 'Khandagiri Road', zone: 'Khandagiri (Z-4)', postalCode: '751030' },
    location: { type: 'Point', coordinates: [85.7870, 20.2580], geocoded: true },
  }),
];

// Mock API responses
export const mockApiResponses = {
  optimizeSuccess: (data?: Partial<OptimizationResult>) => ({
    success: true,
    data: createMockOptimizationResult(data),
  }),
  optimizeMultiBin: (binCount?: number) => ({
    success: true,
    data: createMultiBinOptimizationResult(binCount),
  }),
  dispatchSuccess: (route?: Partial<PlannedRoute>) => ({
    success: true,
    data: createMockRoute({ ...route, status: 'DISPATCHED', version: 2 }),
  }),
  userList: (users: ReturnType<typeof createMockUser>[] = []) => ({
    success: true,
    data: {
      users: users.length > 0 ? users : [createMockUser({ role: 'ADMIN' }), createMockUser({ role: 'FLEET_MANAGER' }), createMockUser({ role: 'DRIVER' })],
      total: users.length > 0 ? users.length : 3,
      page: 1,
      totalPages: 1,
    },
  }),
  batchList: (batches: ReturnType<typeof createMockBatch>[] = []) => ({
    success: true,
    data: {
      batches: batches.length > 0 ? batches : [createMockBatch()],
      total: batches.length > 0 ? batches.length : 1,
      page: 1,
      totalPages: 1,
    },
  }),
  vehicleList: (vehicles: ReturnType<typeof createMockVehicle>[] = []) => ({
    success: true,
    data: {
      vehicles: vehicles.length > 0 ? vehicles : [createMockVehicle()],
      total: vehicles.length > 0 ? vehicles.length : 1,
    },
  }),
  driverList: (drivers: ReturnType<typeof createMockDriver>[] = []) => ({
    success: true,
    data: {
      drivers: drivers.length > 0 ? drivers : [createMockDriver()],
      total: drivers.length > 0 ? drivers.length : 1,
    },
  }),
  error: (code: string, message: string, status: number = 400) => ({
    success: false,
    error: { code, message },
    status,
  }),
};