# Technical Implementation Specification: Frontend Route Planner Workspace UI (Milestone 2)

**Author:** `teamwork_explorer_m2_3` (Frontend Route Planner UI Explorer)  
**Target Milestone:** Milestone 2 (M2) — Mapping, Matrix Services & Route Optimization Engine  
**Working Directory:** `.agents/teamwork/teamwork_explorer_m2_3/`  
**Reference Design:** Google Stitch Route Planner Optimizer & Delivery Dispatch Flow (`stitch_smartroute_fleet_platform/`)  

---

## 1. Executive Summary & Architecture Overview

The **Route Planner Workspace UI** is the operational centerpiece of SmartRoute Milestone 2. It equips logistics dispatchers and fleet managers in the **Bhubaneswar Central Hub (Rasulgarh)** with a high-density, real-time command interface to configure, execute, inspect, and dispatch algorithmic multi-stop vehicle delivery routes.

### Core Architectural Pillars
1. **Asymmetric 35% / 65% Workspace Layout**:
   - **Left Panel (35% width, `lg:col-span-4`)**: Optimization parameters, algorithm sliders (Max 2-opt iterations, traffic scenario multiplier, EV priority), multi-objective weights, assigned vehicle/driver telemetry card with dynamic payload gauge, and an interactive stop sequence manager.
   - **Right Panel (65% width, `lg:col-span-8`)**: Vector GIS Map Canvas (`GISMapCanvas.tsx`) rendering the Bhubaneswar road network, canonical Rasulgarh hub depot, numbered stop pins, dual polylines (dashed baseline vs glowing electric-blue 2-opt), traffic heatmap overlays, floating map telemetry HUD, and the 5 Impact Metric KPI cards.
2. **Google Stitch Design Alignment**:
   - Strict adherence to Google Stitch design tokens: Primary Navy Deep (`#14243A`), Interactive Electric Blue (`#0051D5`), Surface Canvas (`#FAF8FF`), Neutral Borders (`#C5C6CD` / `#E2E8F0`), and Semantic Status Indicators (Error `#BA1A1A`, Warning `#F59E0B`, Success `#16A34A`).
   - High-contrast typography using Inter with tabular figures (`tabular-nums font-mono`) across all distances, durations, currencies (₹), and package weights.
3. **Pure Client Vector GIS Rendering**:
   - Scalable, interactive SVG map projection covering the canonical Bhubaneswar delivery envelope (`lat 20.24 - 20.38`, `lng 85.77 - 85.88`), including Rasulgarh Depot (`20.2961, 85.8645`), Patia/KIIT, Jaydev Vihar, Saheed Nagar, Chandrasekharpur, and Khandagiri.
   - Seamless fallbacks: Zero external tile dependency required for core operational routing vectors, with smooth hover tooltips, click-to-focus waypoints, and animated glow filters.
4. **State Machine & Dispatch Flow**:
   - Real-time parameter fine-tuning, greedy Nearest-Neighbor baseline comparison, 2-opt iterative optimization execution with loading animations, side-by-side comparison drawer, and pre-dispatch driver/vehicle safety verification modal.

---

## 2. Directory Layout & File Manifest

All planned frontend files comply with the project layout specified in `PROJECT.md` and `docs/COMPONENT_GUIDELINES.md`:

```
client/src/
├── api/
│   ├── client.ts                      # Augmented with RoutesApi
│   └── routeApi.ts                    # Dedicated route optimization & dispatch endpoints
├── types/
│   ├── index.ts                       # Augmented with route domain types
│   └── route.ts                       # Route, Stop, OptimizationConfig, and Deltas interfaces
├── hooks/
│   ├── useOptimization.ts             # Hook for optimization parameter state & execution
│   └── useRoutePlanner.ts             # Hook for batch selection, stop sequence & map state
├── components/
│   ├── maps/
│   │   ├── GISMapCanvas.tsx           # Vector SVG/Canvas GIS map with dual polylines & stops
│   │   ├── MapStopPin.tsx             # Numbered stop pin with hover tooltip & status pill
│   │   ├── MapTelemetryHUD.tsx        # Floating vehicle speed, bearing, and active sync badge
│   │   └── MapControls.tsx            # Floating layer toggles (traffic, baseline path, zoom)
│   └── optimization/
│       ├── OptimizationControlPanel.tsx # 35% Left panel: Sliders, presets, vehicle telemetry
│       ├── ParameterSliders.tsx       # Multi-objective weight & iteration range inputs
│       ├── StopSequenceList.tsx       # Resequenceable manifest stop list (Depot -> Stops -> Depot)
│       ├── VehicleTelemetryCard.tsx   # Driver rating, vehicle capacity & payload utilization bar
│       ├── ImpactMetricsBar.tsx       # 5 KPI cards (Distance, Time, Fuel ₹, CO2, SLA %) + Dispatch CTA
│       ├── RouteComparisonDrawer.tsx  # Slide-over comparing baseline NN vs 2-opt stop-by-stop
│       └── DispatchConfirmationModal.tsx # Pre-dispatch safety audit and driver push confirmation
└── pages/
    └── admin/
        └── RoutePlannerPage.tsx       # Master Route Planner Workspace assembling all subsystems
```

---

## 3. Domain Models & TypeScript Interfaces

### `client/src/types/route.ts`

```typescript
import { Delivery, DeliveryPriority, Vehicle, Driver, Depot } from './index';

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
  isDepot?: boolean;
  deliveryId?: string;
  orderReference?: string;
  recipientName?: string;
  recipientPhone?: string;
  streetAddress?: string;
  zone?: string;
  coordinates: [number, number];      // [longitude, latitude] matching GeoJSON
  priority?: DeliveryPriority;
  timeWindow?: {
    start: string;
    end: string;
  };
  weightKg: number;
  volumeM3?: number;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  distanceFromPreviousKm: number;
  durationFromPreviousMin: number;
}

/**
 * Summary metrics for a route sequence
 */
export interface RouteMetrics {
  totalDistanceKm: number;
  totalDurationMin: number;
  costInr: number;
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
  co2AvoidedKg: number;               // e.g. 11.2 kg CO2 avoided
  slaCertaintyGainPercent: number;    // e.g. +2.1%
  chokePointsBypassed?: string[];     // e.g. ['Jaydev Vihar Corridor']
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
 * Payload for POST /api/v1/routes/:id/dispatch
 */
export interface DispatchRoutePayload {
  routeId: string;
  vehicleId: string;
  driverId: string;
  confirmedStopSequence: string[];    // Array of delivery IDs in confirmed order
  notes?: string;
}
```

---

## 4. REST API Integration (`client/src/api/routeApi.ts`)

```typescript
import { apiClient } from './client';
import { ApiResponse } from '../types';
import {
  Route,
  OptimizationResult,
  OptimizeRoutePayload,
  DispatchRoutePayload,
} from '../types/route';

export const RoutesApi = {
  /**
   * Run 2-Opt route optimization against a batch
   */
  optimize: async (payload: OptimizeRoutePayload): Promise<ApiResponse<OptimizationResult>> => {
    const res = await apiClient.post<ApiResponse<OptimizationResult>>('/routes/optimize', payload);
    return res.data;
  },

  /**
   * Dispatch route, transition deliveries to ASSIGNED, and notify driver
   */
  dispatch: async (routeId: string, payload: DispatchRoutePayload): Promise<ApiResponse<Route>> => {
    const res = await apiClient.post<ApiResponse<Route>>(`/routes/${routeId}/dispatch`, payload);
    return res.data;
  },

  /**
   * List routes with optional batch or status filter
   */
  list: async (params?: Record<string, any>): Promise<ApiResponse<{ routes: Route[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ routes: Route[]; total: number }>>('/routes', { params });
    return res.data;
  },

  /**
   * Retrieve single route with version snapshots and audit timeline
   */
  getById: async (id: string): Promise<ApiResponse<{ route: Route; baseline?: Route }>> => {
    const res = await apiClient.get<ApiResponse<{ route: Route; baseline?: Route }>>(`/routes/${id}`);
    return res.data;
  },

  /**
   * Reset route custom sequence back to default manifest order
   */
  reset: async (batchId: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>(`/routes/batch/${batchId}/reset`);
    return res.data;
  },
};
```

---

## 5. Custom React Hooks

### 5.1 `useOptimization.ts`
Manages algorithm configuration presets, iteration bounds, scenario selections, and asynchronous execution with progress indication:

```typescript
import { useState, useCallback } from 'react';
import {
  OptimizationConfig,
  OptimizationResult,
  OptimizeRoutePayload,
  StrategyPreset,
  TrafficScenario,
  VehiclePreference,
} from '../types/route';
import { RoutesApi } from '../api/routeApi';

const DEFAULT_CONFIG: OptimizationConfig = {
  maxIterations: 1000,
  trafficScenario: 'MORNING_RUSH',
  vehiclePreference: 'EV_PREFERRED',
  weights: {
    distanceWeight: 70,
    timeWeight: 85,
    fuelCostWeight: 60,
    vipPriorityWeight: 95,
  },
};

export const useOptimization = () => {
  const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_CONFIG);
  const [activePreset, setActivePreset] = useState<StrategyPreset>('BALANCED');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((preset: StrategyPreset) => {
    setActivePreset(preset);
    switch (preset) {
      case 'BALANCED':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 70, timeWeight: 85, fuelCostWeight: 60, vipPriorityWeight: 95 },
        }));
        break;
      case 'FASTEST':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 30, timeWeight: 98, fuelCostWeight: 40, vipPriorityWeight: 90 },
        }));
        break;
      case 'ECONOMICAL':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 95, timeWeight: 45, fuelCostWeight: 95, vipPriorityWeight: 60 },
        }));
        break;
      case 'CUSTOM':
        break;
    }
  }, []);

  const updateWeight = useCallback((key: keyof OptimizationConfig['weights'], value: number) => {
    setActivePreset('CUSTOM');
    setConfig((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: value },
    }));
  }, []);

  const updateScenario = useCallback((scenario: TrafficScenario) => {
    setConfig((prev) => ({ ...prev, trafficScenario: scenario }));
  }, []);

  const updateMaxIterations = useCallback((iterations: number) => {
    setConfig((prev) => ({ ...prev, maxIterations: iterations }));
  }, []);

  const updateVehiclePreference = useCallback((pref: VehiclePreference) => {
    setConfig((prev) => ({ ...prev, vehiclePreference: pref }));
  }, []);

  const runOptimization = useCallback(
    async (batchId: string, vehicleIds: string[], driverId?: string) => {
      setIsOptimizing(true);
      setError(null);
      setOptimizationProgress(15);

      const progressTimer = setInterval(() => {
        setOptimizationProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      try {
        const payload: OptimizeRoutePayload = {
          batchId,
          vehicleIds,
          driverId,
          options: config,
        };
        const response = await RoutesApi.optimize(payload);
        setOptimizationProgress(100);
        setResult(response.data);
        return response.data;
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message || 'Optimization failed';
        setError(msg);
        throw err;
      } finally {
        clearInterval(progressTimer);
        setTimeout(() => setIsOptimizing(false), 300);
      }
    },
    [config]
  );

  return {
    config,
    activePreset,
    applyPreset,
    updateWeight,
    updateScenario,
    updateMaxIterations,
    updateVehiclePreference,
    runOptimization,
    isOptimizing,
    optimizationProgress,
    result,
    setResult,
    error,
  };
};
```

---

### 5.2 `useRoutePlanner.ts`
Coordinates batch state, assigned driver & vehicle telemetry, stop resequencing, map layer toggles, and modal drawers:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { DeliveryBatch, Vehicle, Driver } from '../types';
import { RouteStop, OptimizationResult } from '../types/route';
import { BatchesApi, FleetApi } from '../api/client';
import { RoutesApi } from '../api/routeApi';

export const useRoutePlanner = (initialBatchId?: string) => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || '');
  const [selectedBatch, setSelectedBatch] = useState<DeliveryBatch | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);

  const [currentStops, setCurrentStops] = useState<RouteStop[]>([]);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);

  const [showNaiveRoute, setShowNaiveRoute] = useState<boolean>(true);
  const [showTrafficLayer, setShowTrafficLayer] = useState<boolean>(true);
  const [isComparisonDrawerOpen, setIsComparisonDrawerOpen] = useState<boolean>(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Initial Load: Batches and Fleet
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [batchRes, fleetRes, driverRes] = await Promise.all([
          BatchesApi.list(),
          FleetApi.getVehicles(),
          FleetApi.getDrivers(),
        ]);

        const batchList = batchRes.data.batches || [];
        setBatches(batchList);
        setVehicles(fleetRes.data.vehicles || []);

        // Auto-select first batch if none specified
        if (!selectedBatchId && batchList.length > 0) {
          setSelectedBatchId(batchList[0].id);
        }
      } catch (err) {
        console.error('Failed to load route planner prerequisites:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // 2. Sync Selected Batch & Vehicle
  useEffect(() => {
    if (!selectedBatchId) return;
    const fetchBatchDetails = async () => {
      try {
        const res = await BatchesApi.getById(selectedBatchId);
        const batch = res.data.batch;
        setSelectedBatch(batch);

        // Pre-select vehicle if allocated
        if (batch.vehicleIds && batch.vehicleIds.length > 0) {
          const vId = typeof batch.vehicleIds[0] === 'string' ? batch.vehicleIds[0] : (batch.vehicleIds[0] as any).id;
          setSelectedVehicleId(vId);
        }
      } catch (err) {
        console.error('Failed to load batch:', err);
      }
    };
    fetchBatchDetails();
  }, [selectedBatchId]);

  // 3. Sync Driver when Vehicle is Selected
  useEffect(() => {
    if (!selectedVehicleId) return;
    const v = vehicles.find((x) => x.id === selectedVehicleId || x.vehicleId === selectedVehicleId);
    if (v && v.assignedDriverId) {
      if (typeof v.assignedDriverId === 'object') {
        setAssignedDriver(v.assignedDriverId as Driver);
      }
    }
  }, [selectedVehicleId, vehicles]);

  // Resequence stops manually via drag & drop
  const reorderStops = useCallback((startIndex: number, endIndex: number) => {
    setCurrentStops((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((item, idx) => ({ ...item, sequenceOrder: idx + 1 }));
    });
  }, []);

  // Apply Optimization Result stops to workspace
  const applyOptimizationResult = useCallback((optResult: OptimizationResult) => {
    if (optResult.optimized && optResult.optimized.stops) {
      setCurrentStops(optResult.optimized.stops);
    }
  }, []);

  return {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    assignedDriver,
    currentStops,
    setCurrentStops,
    reorderStops,
    applyOptimizationResult,
    hoveredStopId,
    setHoveredStopId,
    focusedStopId,
    setFocusedStopId,
    showNaiveRoute,
    setShowNaiveRoute,
    showTrafficLayer,
    setShowTrafficLayer,
    isComparisonDrawerOpen,
    setIsComparisonDrawerOpen,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    isDispatched,
    setIsDispatched,
    isLoading,
  };
};
```

---

## 6. Vector Map GIS Component Blueprint (`GISMapCanvas.tsx`)

### 6.1 Geographical Coordinate Projection
The canonical Bhubaneswar operating envelope encompasses:
- **Latitude**: `Min 20.24°N` (Khandagiri/Dhauli border) to `Max 20.38°N` (Infocity/Patia north border).
- **Longitude**: `Min 85.77°E` (Baramunda/AMRI) to `Max 85.88°E` (Rasulgarh/Cuttack Bypass).
- **Depot Anchor**: Rasulgarh Central Logistics Hub at `20.2961°N, 85.8645°E`.

The coordinate projection to SVG coordinate space (`viewBox="0 0 800 600"`) maintains geographical aspect ratio:

```typescript
interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const DEFAULT_BBSR_BOUNDS: GeoBounds = {
  minLat: 20.245,
  maxLat: 20.375,
  minLng: 85.775,
  maxLng: 85.885,
};

export const projectGeoToSvg = (
  lat: number,
  lng: number,
  bounds: GeoBounds = DEFAULT_BBSR_BOUNDS,
  width = 800,
  height = 600,
  padding = 40
): { x: number; y: number } => {
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Normalized (0 to 1)
  const normX = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng);
  // Lat increases northwards, SVG Y increases downwards
  const normY = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat);

  return {
    x: padding + normX * innerWidth,
    y: padding + normY * innerHeight,
  };
};
```

### 6.2 SVG Route & Polyline Rendering
- **Baseline Naive Polyline**:
  - Rendered with `stroke="#94A3B8"` or `#F59E0B`, `stroke-dasharray="6,6"`, `stroke-width="3"`, `opacity="0.85"`.
- **AI-Optimized 2-Opt Polyline**:
  - Gradient ribbon `#0051D5` $\to$ `#316BF3` $\to$ `#10B981` (Electric Blue to Emerald green efficiency).
  - SVG Filter `#glow`:
    ```xml
    <filter id="optGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    ```
  - Stroke: `filter="url(#optGlow)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`.
- **Congestion Heatmap**:
  - Jaydev Vihar choke point at `(x: 340, y: 220)` with pulsing red ellipse (`#BA1A1A`, opacity 0.25).
- **Numbered Stop Markers**:
  - Sequence circles: Red `#BA1A1A` for `Urgent`, Electric Blue `#0051D5` for `Standard`, Indigo for `Cold Chain`.
  - Tooltip popovers on hover displaying waybill, contact name, SLA time window, and parcel weight.

---

## 7. Component Blueprint: Master Page (`RoutePlannerPage.tsx`)

### Layout Blueprint (12-Column Responsive Grid)
```
+---------------------------------------------------------------------------------------------------+
| AdminHeader: Active Batch Selector | Vehicle Chips (Battery SoC/Fuel) | Reset | Export | Optimize |
+---------------------------------------------------------------------------------------------------+
| LEFT PANEL (35% / 4 Cols)                         | RIGHT PANEL (65% / 8 Cols)                    |
| +-----------------------------------------------+ | +-------------------------------------------+ |
| | 1. Route Parameters Card                      | | | Interactive GIS Map Canvas                | |
| |    Depot, Date, Shift, Batch ID               | | | - Baseline Route (dashed amber/gray)      | |
| +-----------------------------------------------+ | | - Optimized Route (solid glowing electric)| |
| | 2. Optimization Strategy & Sliders            | | | - Rasulgarh Depot Marker & Stop Pins      | |
| |    Balanced | Fastest | Economical            | | | - Jaydev Vihar Congestion Heatmap         | |
| |    Distance, Time, Fuel, VIP Priority         | | | - Floating Map HUD (Speed, Telemetry)     | |
| |    Max 2-Opt Iterations (100-2000)            | | | - Optimization Toast / Computation Stats  | |
| |    Traffic Scenario & EV Priority             | | +-------------------------------------------+ |
| +-----------------------------------------------+ | | 5 Impact Metric KPI Cards                 | |
| | 3. Telemetry & Driver Unit Card               | | | [Distance] [Time] [Fuel ₹] [CO2] [SLA %]  | |
| |    OD-02-CD-5678 (EV 92%) | Payload (64%)     | | +-------------------------------------------+ |
| |    Bikram Das (★4.9, 142 on-time runs)        | | | Master Dispatch Button:                   | |
| +-----------------------------------------------+ | | [ Accept & Push to Driver App ]           | |
| | 4. Delivery Manifest Sequence List            | | +-------------------------------------------+ |
| |    Depot Start -> Stops 1..N -> Depot Return  | |                                               |
| |    Drag-and-drop resequencing                 | |                                               |
| +-----------------------------------------------+ |                                               |
+---------------------------------------------------------------------------------------------------+
```

### Complete JSX Architecture

```tsx
import React, { useState } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Button } from '../../components/common/Button';
import { GISMapCanvas } from '../../components/maps/GISMapCanvas';
import { OptimizationControlPanel } from '../../components/optimization/OptimizationControlPanel';
import { ImpactMetricsBar } from '../../components/optimization/ImpactMetricsBar';
import { RouteComparisonDrawer } from '../../components/optimization/RouteComparisonDrawer';
import { DispatchConfirmationModal } from '../../components/optimization/DispatchConfirmationModal';
import { useRoutePlanner } from '../../hooks/useRoutePlanner';
import { useOptimization } from '../../hooks/useOptimization';
import {
  Route,
  Sparkles,
  Send,
  RotateCcw,
  Download,
  AlertTriangle,
  Layers,
  ChevronDown,
} from 'lucide-react';

export const RoutePlannerPage: React.FC = () => {
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    assignedDriver,
    currentStops,
    reorderStops,
    applyOptimizationResult,
    hoveredStopId,
    setHoveredStopId,
    focusedStopId,
    setFocusedStopId,
    showNaiveRoute,
    setShowNaiveRoute,
    showTrafficLayer,
    setShowTrafficLayer,
    isComparisonDrawerOpen,
    setIsComparisonDrawerOpen,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    isDispatched,
    setIsDispatched,
    isLoading,
  } = useRoutePlanner();

  const {
    config,
    activePreset,
    applyPreset,
    updateWeight,
    updateScenario,
    updateMaxIterations,
    updateVehiclePreference,
    runOptimization,
    isOptimizing,
    optimizationProgress,
    result: optResult,
    error: optError,
  } = useOptimization();

  const handleRunOptimization = async () => {
    if (!selectedBatchId) return;
    try {
      const res = await runOptimization(selectedBatchId, selectedVehicleId ? [selectedVehicleId] : []);
      applyOptimizationResult(res);
    } catch (e) {
      console.error('Optimization error:', e);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Command Header & Action Bar */}
      <AdminHeader
        title="Route Planner & Optimizer"
        subtitle="Rasulgarh Central Hub • Algorithmic Local Search & Fleet Scheduling"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch Selector */}
            <div className="relative">
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-surface-low border border-outline-variant font-mono text-xs font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.name})
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsComparisonDrawerOpen(true)}
              disabled={!optResult}
              leftIcon={<Layers className="w-3.5 h-3.5" />}
            >
              Compare
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleRunOptimization}
              isLoading={isOptimizing}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-200" />}
            >
              Run AI Optimization
            </Button>

            <Button
              size="sm"
              variant="primary"
              disabled={!optResult || isDispatched}
              onClick={() => setIsDispatchModalOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              {isDispatched ? 'Dispatched' : 'Save & Dispatch'}
            </Button>
          </div>
        }
      />

      {/* Optimization Error Alert */}
      {optError && (
        <div className="p-3 bg-error-container text-on-error-container rounded-lg border border-error/30 flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-error" />
          <span>{optError}</span>
        </div>
      )}

      {/* 2. Main 35% / 65% Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-6">
        {/* LEFT PANEL: 35% Width (cols 1 to 4 on 12-col grid) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <OptimizationControlPanel
            batch={selectedBatch}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            assignedDriver={assignedDriver}
            stops={currentStops}
            onReorderStops={reorderStops}
            config={config}
            activePreset={activePreset}
            onApplyPreset={applyPreset}
            onUpdateWeight={updateWeight}
            onUpdateScenario={updateScenario}
            onUpdateMaxIterations={updateMaxIterations}
            onUpdateVehiclePreference={updateVehiclePreference}
            isOptimizing={isOptimizing}
            optimizationProgress={optimizationProgress}
            onRunOptimization={handleRunOptimization}
          />
        </div>

        {/* RIGHT PANEL: 65% Width (cols 5 to 12 on 12-col grid) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Map Canvas */}
          <GISMapCanvas
            stops={currentStops}
            baselineStops={optResult?.baseline?.stops || []}
            baselineMetrics={optResult?.baseline?.metrics}
            optimizedMetrics={optResult?.optimized?.metrics}
            showNaiveRoute={showNaiveRoute}
            onToggleNaiveRoute={() => setShowNaiveRoute((v) => !v)}
            showTrafficLayer={showTrafficLayer}
            onToggleTrafficLayer={() => setShowTrafficLayer((v) => !v)}
            hoveredStopId={hoveredStopId}
            onHoverStop={setHoveredStopId}
            focusedStopId={focusedStopId}
            onSelectStop={setFocusedStopId}
            optimizationResult={optResult}
            assignedVehicle={vehicles.find((v) => v.id === selectedVehicleId || v.vehicleId === selectedVehicleId)}
          />

          {/* 5 Impact Metric Cards Bar */}
          <ImpactMetricsBar
            deltas={optResult?.deltas}
            baselineMetrics={optResult?.baseline?.metrics}
            optimizedMetrics={optResult?.optimized?.metrics}
            unassignedCount={optResult?.unassignedDeliveries?.length || 0}
            isDispatched={isDispatched}
            onTriggerDispatch={() => setIsDispatchModalOpen(true)}
          />
        </div>
      </div>

      {/* Route Comparison Side Drawer */}
      <RouteComparisonDrawer
        isOpen={isComparisonDrawerOpen}
        onClose={() => setIsComparisonDrawerOpen(false)}
        result={optResult}
      />

      {/* Pre-Dispatch Safety Confirmation Modal */}
      <DispatchConfirmationModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        batch={selectedBatch}
        vehicle={vehicles.find((v) => v.id === selectedVehicleId || v.vehicleId === selectedVehicleId)}
        driver={assignedDriver}
        stops={currentStops}
        metrics={optResult?.optimized?.metrics}
        onConfirmDispatch={async () => {
          if (!optResult?.routeId && !selectedBatchId) return;
          try {
            await RoutesApi.dispatch(optResult?.routeId || selectedBatchId, {
              routeId: optResult?.routeId || selectedBatchId,
              vehicleId: selectedVehicleId,
              driverId: assignedDriver?.id || '',
              confirmedStopSequence: currentStops.map((s) => s.deliveryId || '').filter(Boolean),
            });
            setIsDispatched(true);
            setIsDispatchModalOpen(false);
          } catch (err) {
            console.error('Dispatch failed:', err);
          }
        }}
      />
    </div>
  );
};
```

---

## 8. Detailed Component Specifications

### 8.1 `OptimizationControlPanel.tsx`
Renders the complete control sidebar with 4 specialized sub-cards:
1. **Route Parameters Card**:
   - Origin Depot: "Bhubaneswar (Rasulgarh Logistics Hub)"
   - Return Depot: "Same (Closed Loop TSP)"
   - Date & Shift: "Today • Shift A (08:30 AM)"
   - Active Batch Code: e.g. `#BBSR-EXP-08`
2. **Optimization Strategy & Weights Card**:
   - Strategy preset buttons (`Balanced`, `Fastest`, `Economical`)
   - 4 Sliders with real-time numeric badges:
     - Minimize Distance (`0 - 100%`)
     - Minimize Delivery Time (`0 - 100%`)
     - Fuel Cost Efficiency (`0 - 100%`)
     - Prioritize Urgent VIP Stops (`0 - 100%`)
   - Advanced Settings (Collapsible):
     - Max 2-Opt Iterations slider: `100 - 2000`, step `100` (`tabular-nums font-mono`)
     - Traffic Multiplier scenario dropdown: `FREE_FLOW (1.0x)`, `MORNING_RUSH (1.8x)`, `EVENING_PEAK (2.2x)`, `MONSOON_RAIN (1.5x)`, `WEEKEND (1.1x)`
     - Propulsion priority toggle: `EV Preferred` vs `Cost Optimal`
3. **Assigned Telemetry & Driver Card**:
   - Vehicle Chip: `OD-02-AK-1001` (Tata Ace EV, 92% Battery SoC)
   - Payload Utilization Bar: e.g. `768.2 kg / 1,000 kg (76.8%)`
     - Color transitions: `<80%` Blue (`bg-secondary`), `80-100%` Amber (`bg-amber-500`), `>100%` Red (`bg-error`)
   - Driver profile: `Bikram Das` (Rating: ★4.9, 142 on-time runs)
4. **Delivery Manifest Sequence Manager (`StopSequenceList.tsx`)**:
   - Depot Departure item (Rasulgarh at 08:30 AM)
   - Ordered list of stops with drag handles (`drag_indicator`)
   - Priority badges: `Urgent` (red pill), `Standard` (slate pill), `Cold Chain` (cyan pill)
   - Recipient address, time window (`09:00 - 09:30 AM`), cargo weight (`14.5 kg`)
   - Depot Return item (Rasulgarh at 03:15 PM)

---

### 8.2 `ImpactMetricsBar.tsx`
Renders the 5 impact telemetry KPI cards aligned with Google Stitch tokens:

| Card # | Metric Title | Formula / Delta | Styling & Semantic Indicators |
|---|---|---|---|
| **1** | **Distance Reduction** | `Baseline km -> Optimized km (-Z%)` | `text-primary`, tabular-nums, `text-secondary font-semibold` |
| **2** | **Drive Time Saved** | `Baseline min -> Optimized min (-Z min)` | `text-primary`, tabular-nums, `text-secondary font-semibold` |
| **3** | **Fleet Operating Cost** | `₹Baseline -> ₹Optimized (₹Z saved)` | `text-primary`, tabular-nums, fuel preserved subtitle |
| **4** | **Carbon Footprint Avoided** | `Z kg CO2 avoided` | `text-primary`, green leaf icon, `Net Green Score A+` |
| **5** | **SLA Certainty & Fulfillment** | `99.2% on-time`, `Unassigned: N` | `text-secondary`, zero window breaches, warning pill if unassigned $> 0$ |

---

### 8.3 `RouteComparisonDrawer.tsx`
A 500px slide-over drawer triggered by the "Compare" action bar button:
- **Header**: "Route Sequence Diff: Baseline vs 2-Opt Optimized".
- **Summary Diff Banner**:
  - Distance: `-15.4 km (-31.7%)`
  - Travel Duration: `-75 min (-34.1%)`
  - Fuel Cost: `-₹1,420`
- **Side-by-Side Stop Sequence Diff**:
  - Compares the greedy Nearest-Neighbor stop order vs the 2-Opt local search edge-swapped order.
  - Highlights inverted sub-tours (e.g. "Reversed Stops 4 & 5 to avoid Jaydev Vihar choke point").
  - Stop arrival delta indicator (e.g. `10:15 AM -> 09:45 AM (-30m)`).

---

### 8.4 `DispatchConfirmationModal.tsx`
A high-reliability safety verification modal required before dispatching routes to mobile couriers:
- **Step 1: Driver Verification**:
  - Name: Bikram Das
  - Contact: `+91 94370 12345`
  - Shift Status: `ON_DUTY`
- **Step 2: Vehicle & Cargo Clearance**:
  - Vehicle: `OD-02-AK-1001` (Tata Ace EV)
  - Battery Charge: `92%` (Minimum required for route: `45%`)
  - Payload Weight: `768.2 kg / 1,000 kg` (Clearance PASS)
- **Step 3: Route Manifest Summary**:
  - Total Stops: `8 stops + 2 depot passes`
  - Estimated Return Time: `03:15 PM`
  - Zero SLA breaches detected
- **Action**: "Confirm & Push to Handheld" $\to$ triggers `RoutesApi.dispatch`, records audit event `ROUTE_DISPATCHED`, and transitions route to `DISPATCHED`.

---

## 9. Google Stitch Design System & Accessibility Alignment

### 9.1 Stitch Color Tokens & Tailwind Mapping
- **Primary Navy Deep**: `#14243A` (`bg-primary`, `text-primary`, `border-primary`)
- **Electric Blue**: `#0051D5` (`bg-secondary`, `text-secondary`, `border-secondary`)
- **Canvas Surface**: `#FAF8FF` (`bg-surface`)
- **Card Shells**: `#FFFFFF` (`bg-surface-lowest`)
- **Sub-panel Accent**: `#F2F3FF` (`bg-surface-low`)
- **Subtle Borders**: `#C5C6CD` / `#E2E8F0` (`border-outline-variant`)
- **High-Contrast Text**: `#131B2E` (`text-on-surface`)
- **Muted Subtitles**: `#44474D` (`text-on-surface-variant`)
- **Semantic Error**: `#BA1A1A` (`bg-error`, `text-error`)
- **Semantic Warning**: `#F59E0B` (`bg-warning`, `text-warning`)
- **Semantic Success**: `#16A34A` (`bg-success`, `text-success`)

### 9.2 Typography & Tabular Figures (`tnum`)
- **Base Font**: `Inter, system-ui, sans-serif`
- **Tabular Figures**: Every numeric dynamic indicator (distances in `km`, durations in `min`, weights in `kg`, currencies in `₹`, and percentage badges) **must** feature the classes `tabular-nums font-mono` to prevent jitter during real-time updates.

### 9.3 Accessibility (WCAG 2.1 AA)
- All range input sliders include `aria-label`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-valuenow`.
- Keyboard navigation: Stop list items support keyboard focus and Arrow key reordering.
- Color contrast: All text against background meets or exceeds 4.5:1 contrast ratio.

---

## 10. Verification & Test Plan

1. **Rendering & Layout Verification**:
   - Verify 35% / 65% split on desktop viewports ($\ge 1024\text{px}$).
   - Verify clean single-column fallback on mobile screens ($< 1024\text{px}$).
2. **GIS Vector Map Accuracy**:
   - Verify Rasulgarh depot pin coordinates resolve to `20.2961, 85.8645`.
   - Verify all 5 Bhubaneswar clusters (Patia, Jaydev Vihar, Saheed Nagar, Khandagiri, Chandrasekharpur) project within the SVG canvas without clipping.
3. **Algorithm & Slider Interactivity**:
   - Verify slider movements update percentage badges synchronously.
   - Verify clicking `Balanced`, `Fastest`, or `Economical` presets updates all 4 sliders simultaneously.
4. **Impact Metrics Delta Calculation**:
   - Verify distance saved is calculated as `baseline.totalDistanceKm - optimized.totalDistanceKm`.
   - Verify duration saved is calculated as `baseline.totalDurationMin - optimized.totalDurationMin`.
   - Verify fuel cost saved and CO2 avoided match the dual EV/ICE models.
5. **Dispatch State Machine Enforcement**:
   - Verify Dispatch button is disabled until optimization completes.
   - Verify confirming dispatch modal transitions route state to `DISPATCHED` and locks further reordering.
