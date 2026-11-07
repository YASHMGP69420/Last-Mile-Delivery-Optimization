import { Delivery, DeliveryPriority, Depot } from './index';

/**
 * 5 Deterministic Traffic Scenarios matching backend simulatedTrafficService
 */
export type TrafficScenario =
  | 'FREE_FLOW'      // 1.0x
  | 'MORNING_RUSH'   // 1.8x
  | 'EVENING_PEAK'   // 2.2x
  | 'MONSOON_RAIN'   // 1.5x
  | 'WEEKEND';       // 1.1x

/**
 * Vehicle Propulsion Preference for multi-vehicle assignment
 */
export type VehiclePreference = 'EV_PREFERRED' | 'COST_OPTIMAL' | 'BALANCED';

/**
 * Strategy Presets matching Google Stitch designs
 */
export type StrategyPreset = 'BALANCED' | 'FASTEST' | 'ECONOMICAL' | 'CUSTOM';

/**
 * Multi-objective optimization weight factors (0 - 100)
 */
export interface OptimizationWeights {
  distanceWeight: number;     // Minimize road distance (km)
  timeWeight: number;         // Minimize delivery duration (min)
  fuelCostWeight: number;     // Fuel / energy cost efficiency (₹)
  vipPriorityWeight: number;  // Prioritize Urgent & Cold Chain time windows
}

/**
 * Optimization configuration passed to backend algorithm engine
 */
export interface OptimizationConfig {
  maxIterations: number;              // 100 to 2000, step 100 (default: 1000)
  trafficScenario: TrafficScenario;    // Default: 'MORNING_RUSH'
  vehiclePreference: VehiclePreference;// Default: 'EV_PREFERRED'
  weights: OptimizationWeights;
  departureTime?: string;             // ISO string or '08:30 AM'
}

/**
 * Sequenced route waypoint stop
 */
export interface RouteStop {
  sequenceOrder: number;              // 1-indexed (0 is Start Depot, N+1 is Return Depot)
  sequence?: number;
  isDepot?: boolean;
  deliveryId?: string;
  orderReference?: string;
  recipientName?: string;
  recipientPhone?: string;
  streetAddress?: string;
  zone?: string;
  coordinates: [number, number];      // [longitude, latitude] matching GeoJSON
  location?: { lat: number; lng: number };
  customer?: { name?: string; phone?: string };
  address?: { street?: string; zone?: string; city?: string; postalCode?: string };
  status?: string;
  priority?: DeliveryPriority;
  timeWindow?: {
    start: string;
    end: string;
  };
  weightKg: number;
  volumeM3?: number;
  eta?: string;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  distanceFromPreviousKm: number;
  durationFromPreviousMin: number;
  googleMapsUrl?: string;
}

/**
 * Summary metrics for a route sequence
 */
export interface RouteMetrics {
  totalDistanceKm: number;
  totalDurationMin: number;
  drivingTimeMin?: number;
  serviceDurationMin?: number;
  costInr: number;
  fuelConsumed?: number;
  fuelUnit?: string;
  co2Kg: number;
  stopsCount: number;
  totalPayloadKg: number;
  payloadUtilizationPercent: number;
  onTimeCertaintyPercent: number;
}

/**
 * Differential impact between Baseline (Nearest-Neighbor) and Optimized (2-Opt)
 */
export interface RouteDeltas {
  distanceSavedKm: number;
  percentDistanceReduction: number;   // e.g. -31.7%
  timeSavedMin: number;
  percentTimeReduction: number;       // e.g. -34.1%
  costSavedInr: number;               // e.g. ₹1,420 saved
  percentCostReduction?: number;
  fuelSaved?: number;
  percentFuelReduction?: number;
  fuelUnit?: string;
  isImproved?: boolean;
  message?: string;
  co2AvoidedKg: number;               // e.g. 11.2 kg CO2 avoided
  slaCertaintyGainPercent?: number;   // e.g. +2.1%
  chokePointsBypassed?: string[];     // e.g. ['Jaydev Vihar Corridor']
}

export interface RouteBaselineMetrics {
  totalDistanceKm: number;
  drivingTimeMin: number;
  serviceDurationMin: number;
  totalDurationMin: number;
  departureTime: string;
  estimatedArrival: string;
  fuelConsumed: number;
  fuelUnit: string;
  costInr: number;
  co2Kg: number;
  stopsCount: number;
  totalPayloadKg: number;
  startingLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  endingLocation: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  isElectric: boolean;
  vehicle?: {
    id: string;
    vehicleId: string;
    makeModel: string;
    fuelType: string;
    capacityKg: number;
  };
}

export interface BaselineEvaluationResult {
  stops: RouteStop[];
  metrics: RouteBaselineMetrics;
  polylineCoords: [number, number][];
  googleMapsUrls?: {
    currentRoute: string;
    segments?: string[];
  };
}

/**
 * Route version & dispatch lifecycle
 */
export type RouteStatus = 'DRAFT' | 'OPTIMIZED' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface Route {
  id: string;
  routeCode: string;                  // e.g. 'RT-BBSR-20261104-01'
  batchId: string;
  vehicleId: string;
  driverId: string;
  status: RouteStatus;
  version: number;                    // Incremented upon dispatch snapshot or reroute
  depot: Depot;
  stops: RouteStop[];
  metrics: RouteMetrics;
  deltas?: RouteDeltas;
  polylineCoords?: [number, number][];// Rendered road coordinates [lng, lat]
  createdAt: string;
  updatedAt: string;
  dispatchedAt?: string;
}

/**
 * Response payload from POST /api/v1/routes/optimize
 */
export interface OptimizationResult {
  routeId?: string;
  routes?: any[];
  batchId: string;
  vehicleId: string;
  driverId?: string;
  baseline: {
    stops: RouteStop[];
    metrics: RouteMetrics;
    polylineCoords?: [number, number][];
  };
  optimized: {
    stops: RouteStop[];
    metrics: RouteMetrics;
    polylineCoords?: [number, number][];
  };
  deltas: RouteDeltas;
  unassignedDeliveries: Delivery[];
  executionTimeMs: number;
  iterationsCount: number;
  converged: boolean;
}

/**
 * Payload for POST /api/v1/routes/optimize
 */
export interface OptimizeRoutePayload {
  batchId: string;
  vehicleIds?: string[];
  driverId?: string;
  options: OptimizationConfig;
}

/**
 * Payload for POST /api/v1/routes/:id/dispatch or /api/v1/routes/dispatch
 */
export interface DispatchRoutePayload {
  routeId?: string;
  batchId?: string;
  vehicleId: string;
  driverId: string;
  confirmedStopSequence?: string[];    // Array of delivery IDs in confirmed order
  deliveryIds?: string[];
  notes?: string;
}

export interface DispatchValidationResult {
  canDispatch: boolean;
  error: string | null;
  ineligibilityReasons: string[];
  eligibleDeliveries: any[];
  ineligibleDeliveries: Array<{ deliveryId: string; orderReference: string; reason: string }>;
  totalPayloadKg: number;
  capacityKg: number;
  excessKg: number;
}
