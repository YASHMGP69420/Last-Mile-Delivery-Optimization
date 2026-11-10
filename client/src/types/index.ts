export type UserRole = 'ADMIN' | 'FLEET_MANAGER' | 'DRIVER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  driverId?: string | null;
  assignedVehicle?: Vehicle | null;
}

export type VehicleType = 'Bike' | 'Van' | 'Truck';
export type FuelType = 'Petrol' | 'Diesel' | 'Electric';
export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'RETIRED';

export interface Fleet {
  id: string;
  name: string;
  description?: string;
  ownerId?: string | User | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  vehicleId: string;
  makeModel: string;
  type: VehicleType;
  capacityKg: number;
  capacityM3?: number | null;
  fuelType: FuelType;
  kmPerLitre?: number | null;
  energyKWhPerKm?: number | null;
  availability: VehicleStatus;
  assignedDriverId?: Driver | string | null;
  batterySoC?: number | null;
}

export type DriverAvailability = 'AVAILABLE' | 'ON_DUTY' | 'IN_TRANSIT' | 'ON_BREAK' | 'OFF_DUTY';

export interface Driver {
  id: string;
  userId: User | string;
  licenseNumber: string;
  phone: string;
  assignedVehicleId?: Vehicle | string | null;
  availability: DriverAvailability;
  rating: number;
  onTimeRuns: number;
  currentRouteId?: string | null;
}

export type DeliveryPriority = 'Standard' | 'Urgent' | 'Cold Chain';
export type DeliveryStatus = 'DRAFT' | 'READY' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'FAILED';
export type FailureReason =
  | 'WRONG_ADDRESS'
  | 'CUSTOMER_UNAVAILABLE'
  | 'DAMAGED_PACKAGE'
  | 'VEHICLE_BREAKDOWN'
  | 'ACCESS_RESTRICTED'
  | 'TIME_EXPIRED'
  | 'OTHER';

export interface Customer {
  name: string;
  phone: string;
  email?: string | null;
}

export interface Address {
  street: string;
  city: string;
  zone: string;
  postalCode: string;
}

export interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
  geocoded: boolean;
  geocodingConfidence?: number;
  geocodingSource: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface ProofOfDelivery {
  otp?: string | null;
  otpVerified: boolean;
  signatureSvg?: string | null;
  photoUrl?: string | null;
  photoCoordinates?: { lat: number | null; lng: number | null } | null;
  temperatureReading?: number | null;
  handoverNotes?: string | null;
}

export interface Delivery {
  id: string;
  orderReference: string;
  batchId?: string | DeliveryBatch | null;
  customer: Customer;
  address: Address;
  location: GeoLocation;
  weightKg: number;
  volumeM3?: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow;
  serviceDurationMinutes: number;
  status: DeliveryStatus;
  assignedVehicleId?: Vehicle | string | null;
  assignedDriverId?: Driver | string | null;
  proofOfDelivery: ProofOfDelivery;
  failureReason?: FailureReason | null;
  failureNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Depot {
  name: string;
  address: string;
  geo: {
    lat: number;
    lng: number;
  };
}

export interface BatchMetrics {
  totalDeliveries: number;
  totalWeightKg: number;
  assignedDeliveries: number;
}

export type BatchStatus = 'DRAFT' | 'READY' | 'PLANNED' | 'IN_PROGRESS' | 'CLOSED';

export interface DeliveryBatch {
  id: string;
  code: string;
  name: string;
  date: string;
  shift: string;
  depot: Depot;
  deliveryIds: Delivery[] | string[];
  vehicleIds: Vehicle[] | string[];
  driverIds: Driver[] | string[];
  status: BatchStatus;
  metrics: BatchMetrics;
  createdAt?: string;
}

export interface AuditEvent {
  id: string;
  deliveryId?: string | null;
  batchId?: string | null;
  routeId?: string | null;
  type: string;
  actorId: User | string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  metadata?: Record<string, any>;
  at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string; value?: any }>;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}

export interface CsvValidationSummary {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validCount: number;
  errorCount: number;
  errors: CsvRowError[];
  preview: Partial<Delivery>[];
  importedDeliveries?: Delivery[];
}

export * from './route';

