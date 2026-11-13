# Phase 15: Dispatch Simplification & Auto Vehicle Assignment — Research

**Generated:** 2026-11-12
**Phase:** 15 — Dispatch Simplification & Auto Vehicle Assignment
**Status:** Research Complete

---

## Executive Summary

This phase removes manual vehicle/driver assignment from Fleet & Driver management pages and batch creation flow. Vehicle assignment becomes automatic during route optimization using the existing **best-fit bin-packing** algorithm. Drivers are auto-assigned by availability. The backend already supports multi-vehicle bin-packing — the UI currently only surfaces the first bin.

---

## 1. Backend Vehicle Auto-Selection (D-01, D-04)

### Current Implementation

**File:** `server/src/services/optimization/binPacker.js` (lines 50–180)

The `packDeliveries()` function already implements **tiered best-fit decreasing**:
- Sorts vehicles by capacity (ascending for best-fit, descending for EV-preferred)
- Creates bins per vehicle, fills with deliveries sorted by priority + weight
- Returns `vehicleBins[]` with utilization percentages
- Handles unassigned deliveries when capacity exceeded

**Strategy mapping (line 51–70):**
```javascript
vehicleTypePreference === 'EV'     → EVs first, then ICE (both ascending capacity)
vehicleTypePreference === 'COST_OPTIMAL' → All vehicles ascending capacity (best-fit)
vehicleTypePreference === 'BALANCED'     → Same as COST_OPTIMAL
```

### Route Controller Integration

**File:** `server/src/controllers/routeController.js` (lines 403–417, 427, 765–832)

```javascript
// Vehicle resolution (lines 403-417)
let vehicles = [];
if (Array.isArray(vehicleIds) && vehicleIds.length > 0) {
  vehicles = await Vehicle.find({ _id: { $in: vehicleIds } });
} else if (Array.isArray(batch.vehicleIds) && batch.vehicleIds.length > 0) {
  vehicles = await Vehicle.find({ _id: { $in: batch.vehicleIds } });
} else {
  vehicles = await Vehicle.find({
    availability: { $in: [VEHICLE_STATUS.AVAILABLE, VEHICLE_STATUS.ASSIGNED] },
  });
}

// Bin packing (line 427)
const { vehicleBins, unassignedDeliveries } = packDeliveries(deliveries, vehicles, normalizedOptions);

// Response building (lines 765-832) — ONLY SURFACES FIRST BIN
const firstRouteId = firstRoute?.id || firstRoute?._id?.toString();
res.status(200).json({
  data: {
    routeId: firstRouteId,                    // Single route
    vehicleId: firstRoute?.vehicleId?.toString(),  // Single vehicle
    routes: plannedRoutes,                    // All bins internally
    baseline: { ... firstBaselineStops ... }, // Only first bin
    optimized: { ... firstOptimizedStops ... }, // Only first bin
  }
});
```

**Key Finding:** Backend already auto-selects vehicles when `batch.vehicleIds` is empty. The multi-bin output (`plannedRoutes[]`, `vehicleBins[]`) exists but the response only exposes the first bin's data.

### Required Backend Changes for D-04 (Multi-Bin UI)

1. **Modify response structure** to include all bins with their vehicle/driver info
2. **Add driver auto-assignment** per bin when `batch.driverIds` is empty
3. **Return per-bin metrics** (vehicleId, makeModel, capacityKg, utilizationPercent, driverId, driverName)

---

## 2. Driver Auto-Assignment (D-05)

### Current State

- **Driver model** (`server/src/models/Driver.js`): `availability` enum — `AVAILABLE`, `ON_DUTY`, `IN_TRANSIT`, `ON_BREAK`, `OFF_DUTY`
- **Vehicle model** (`server/src/models/Vehicle.js`): `assignedDriverId` field (line 54–58)
- **Batch model** (`server/src/models/DeliveryBatch.js`): `driverIds[]` array (lines 64–69)

### Implementation Approach

Add in `routeController.js` after bin-packing (around line 442):

```javascript
// Auto-assign drivers to each vehicle bin
const availableDrivers = await Driver.find({
  availability: { $in: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.ON_DUTY] },
  currentRouteId: null,  // Not on active route
}).sort({ rating: -1, onTimeRuns: -1 });  // Best-rated, most reliable first

vehicleBins.forEach((bin, idx) => {
  if (availableDrivers[idx]) {
    bin.driver = availableDrivers[idx];
    bin.driverId = availableDrivers[idx]._id;
  }
});
```

**Assignment priority:** `AVAILABLE` → `ON_DUTY` → by `rating` desc → by `onTimeRuns` desc

---

## 3. Frontend Components — Required Changes

### 3.1 BatchComposerPanel.tsx (D-06, D-07)

**File:** `client/src/components/deliveries/BatchComposerPanel.tsx`

**Current state (lines 68–73):**
```typescript
const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() =>
  getPreferredVehicleId(vehicles)
);
const [selectedDriverId, setSelectedDriverId] = useState<string>(() =>
  getPreferredDriverId(drivers)
);
```

**Current API call (lines 160–161):**
```typescript
vehicleIds: activeVehicleId ? [activeVehicleId] : [],
driverIds: activeDriverId ? [activeDriverId] : [],
```

**Required changes:**
- Remove `selectedVehicleId` / `selectedDriverId` state
- Remove vehicle dropdown (lines 368–377) and driver dropdown (lines 378–385)
- Remove `vehicleIds` / `driverIds` from `BatchesApi.create()` call
- Update `BatchCreatedInfo` interface (lines 10–16) — remove `vehicleLabel`, `driverLabel` or make them post-optimization only

### 3.2 ConsignmentDrawer.tsx (D-08, D-09)

**File:** `client/src/components/deliveries/ConsignmentDrawer.tsx`

**Current assignment state (lines 186–259):**
```typescript
const [assignVehicleId, setAssignVehicleId] = useState<string>('');
const [assignDriverId, setAssignDriverId] = useState<string>('');
// ... fetch current assignments, handle assign/unassign
```

**Current dropdowns (lines 630–671):**
- Vehicle select (line 632–645)
- Driver select (line 650–662)
- Assign button (line 671) — requires both fields

**Required changes:**
- Remove `assignVehicleId`, `assignDriverId` state
- Remove vehicle/driver dropdowns and assign button
- Add **Batch Status Chip** in their place:
  ```tsx
  // Shows: "BBSR-EXP-4821 · Pending" or "BBSR-EXP-4821 · Dispatched"
  <Badge variant={isDispatched ? 'success' : 'default'}>
    {delivery.batchId?.code || 'Unbatched'} · {isDispatched ? 'Dispatched' : 'Pending'}
  </Badge>
  ```

### 3.3 DriversPage.tsx (D-10, D-12)

**File:** `client/src/pages/admin/DriversPage.tsx`

**Current assign modal (lines 18–22, 84–115):**
```typescript
const [showAssignModal, setShowAssignModal] = useState(false);
const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
// handleAssign() calls FleetApi.assignVehicle()
```

**Onboard form vehicle field (line 32):**
```typescript
assignedVehicleId: '',
```

**Required changes:**
- Remove assign modal state and `handleAssign`/`handleUnassign` functions
- Remove "Assign Vehicle" button from driver table rows
- Remove `assignedVehicleId` from onboard form `newDriver` state
- Remove post-onboard `assignVehicle` call (lines 133–138)
- **Agent discretion:** Keep or remove "Assigned Vehicle" column in table (read-only, populated by optimizer)

### 3.4 FleetsPage.tsx (D-11)

**File:** `client/src/pages/admin/FleetsPage.tsx`

**Current "Assigned Driver" column (lines 501–505):**
```typescript
{
  header: 'Assigned Driver',
  render: (v) => {
    if (!v.assignedDriverId) return <span className="text-on-surface-variant">—</span>;
    if (typeof v.assignedDriverId === 'string') return v.assignedDriverId;
    return (v.assignedDriverId as any)?.licenseNumber || 'Assigned';
  },
}
```

**Required changes:**
- Remove "Assigned Driver" column from vehicles table
- The `assignedDriverId` field on Vehicle model is now managed by optimizer, not manual assignment

### 3.5 Optimization Result Card — CurrentRouteCard.tsx (D-02, D-03)

**File:** `client/src/components/optimization/CurrentRouteCard.tsx`

**Current props (lines 23–31):**
```typescript
export interface CurrentRouteCardProps {
  baseline: BaselineEvaluationResult | null;
  isLoading?: boolean;
  optResult?: OptimizationResult | null;
  onDispatchCurrent?: () => void;
  onRunOptimization?: () => void;
  isOptimizing?: boolean;
  isDispatched?: boolean;
}
```

**Current display (lines 100–160):** Shows baseline vs optimized metrics table (distance, duration, fuel, cost)

**Required changes for D-02 (Auto-selected vehicle display):**
- Extend `OptimizationResult` type to include per-bin vehicle info:
  ```typescript
  export interface VehicleAssignment {
    vehicleId: string;
    vehiclePlate: string;
    makeModel: string;
    capacityKg: number;
    utilizationPercent: number;
    driverId?: string;
    driverName?: string;
    driverLicenseNumber?: string;
  }
  export interface OptimizationResult {
    // ... existing fields
    vehicleAssignments: VehicleAssignment[];  // One per bin
  }
  ```
- Add vehicle info section in card (after metrics table, before action bar):
  ```tsx
  <div className="p-3 bg-surface-low/50 border-t border-outline-variant">
    <h4 className="font-semibold text-on-surface mb-2">Assigned Vehicles</h4>
    {optResult?.vehicleAssignments?.map((va, idx) => (
      <div key={va.vehicleId} className="flex items-center justify-between gap-2 p-2 bg-surface-lowest rounded-lg">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-secondary" />
          <div>
            <span className="font-mono font-medium text-on-surface">{va.vehiclePlate}</span>
            <span className="text-xs text-on-surface-variant ml-2">{va.makeModel}</span>
            <span className="text-xs text-primary ml-2">{va.utilizationPercent}% load</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {va.driverName && (
            <span className="text-xs text-on-surface-variant">
              Driver: {va.driverName} ({va.driverLicenseNumber})
            </span>
          )}
          {/* D-03: Change Vehicle link */}
          <Button variant="ghost" size="sm" onClick={() => onChangeVehicle(idx)}>
            Change Vehicle
          </Button>
          {va.driverId && (
            <Button variant="ghost" size="sm" onClick={() => onChangeDriver(idx)}>
              Change Driver
            </Button>
          )}
        </div>
      </div>
    ))}
  </div>
  ```

### 3.6 OptimizationControlPanel.tsx (D-03 Override UI)

**File:** `client/src/components/optimization/OptimizationControlPanel.tsx`

**Current props (lines 23–46):** Includes `selectedVehicleId`, `onSelectVehicle`, `drivers`, `assignedDriver`, `onSelectDriver`

**Required changes:**
- Remove `selectedVehicleId`, `onSelectVehicle`, `drivers`, `assignedDriver`, `onSelectDriver` props
- Remove vehicle select dropdown (lines 150–170) and driver select dropdown (lines 171–190)
- The panel becomes read-only for vehicle/driver — they're shown in CurrentRouteCard with change links

### 3.7 useOptimization.ts Hook

**File:** `client/src/hooks/useOptimization.ts`

**Current `runOptimization` (lines 78–110):**
```typescript
const runOptimization = useCallback(
  async (batchId: string, vehicleIds: string[], driverId?: string) => {
    const payload: OptimizeRoutePayload = {
      batchId,
      vehicleIds,
      driverId,
      options: config,
    };
    const response = await RoutesApi.optimize(payload);
    // ...
  },
  [config]
);
```

**Required changes:**
- Remove `vehicleIds` and `driverId` parameters
- Call `RoutesApi.optimize({ batchId, options: config })` — backend handles auto-selection

---

## 4. API Layer Changes

### 3.8 routeApi.ts

**File:** `client/src/api/routeApi.ts`

**Current `OptimizeRoutePayload` (lines 6, 213–218):**
```typescript
export interface OptimizeRoutePayload {
  batchId: string;
  vehicleIds?: string[];
  driverId?: string;
  options: OptimizationConfig;
}
```

**Required changes:**
- Make `vehicleIds` and `driverId` optional (already are) — frontend stops sending them
- Backend ignores them when empty

### 3.9 client.ts (FleetApi)

**File:** `client/src/api/client.ts`

**Current assign/unassign (lines 276–281):**
```typescript
assignVehicle: async (driverId: string, vehicleId: string) => { ... }
unassignVehicle: async (driverId: string) => { ... }
```

**Required changes:**
- Keep backend endpoints (may be used by other flows)
- Remove frontend call sites from DriversPage.tsx

---

## 5. Multi-Bin UI Risk Assessment (D-04 — Costly)

### Current Limitation

The optimizer returns `plannedRoutes[]` (one per bin) but the response only exposes:
- `routeId` — first bin only
- `vehicleId` — first bin only
- `baseline` / `optimized` — first bin only
- `routes: plannedRoutes` — all bins included but not typed/structured for UI

### Required Changes (High Effort)

| Component | Change |
|-----------|--------|
| `routeController.js` | Restructure response to include per-bin vehicle/driver assignments, metrics, polylines |
| `OptimizationResult` type | Add `vehicleAssignments: VehicleAssignment[]` |
| `CurrentRouteCard.tsx` | Render multiple vehicle assignment cards |
| `RouteComparisonDrawer.tsx` | Support comparing multi-bin routes |
| `DispatchConfirmationModal.tsx` | Handle dispatching multiple routes (one per vehicle) |
| `useRoutePlanner.ts` / `useOptimization.ts` | Handle multi-route result state |

### Mitigation

1. **Phase 1 (MVP):** Implement single-bin auto-assignment first (covers 80% of batches that fit in one vehicle)
2. **Phase 2:** Add multi-bin response structure and UI
3. **Fallback:** If multi-bin, show "Batch split across N vehicles — review each route" with expandable sections

---

## 6. Implementation Sequence (Recommended)

### Plan 15-01: Backend Response Restructure & Driver Auto-Assignment
- Modify `routeController.js` `optimizeRoutes` to:
  - Auto-assign drivers per bin when `batch.driverIds` empty
  - Return `vehicleAssignments[]` with vehicle + driver info per bin
  - Include per-bin metrics in response
- Update `OptimizationResult` type in `client/src/types/route.ts`

### Plan 15-02: BatchComposerPanel — Remove Vehicle/Driver Selection
- Remove `selectedVehicleId`, `selectedDriverId` state
- Remove dropdowns from UI
- Remove `vehicleIds`/`driverIds` from API call
- Update `BatchCreatedInfo` interface

### Plan 15-03: ConsignmentDrawer — Remove Assignment, Add Batch Chip
- Remove `assignVehicleId`, `assignDriverId` state and dropdowns
- Add Batch Status Chip component
- Show batch code + route status (Pending/Dispatched)

### Plan 15-04: DriversPage — Remove Assign Vehicle Flow
- Remove assign modal, `handleAssign`/`handleUnassign`
- Remove `assignedVehicleId` from onboard form
- Remove post-onboard assign call
- **Discretion:** Keep/remove "Assigned Vehicle" table column

### Plan 15-05: FleetsPage — Remove Assigned Driver Column
- Remove "Assigned Driver" column from vehicles table

### Plan 15-06: Optimization Result Card — Vehicle/Driver Display + Override
- Extend `CurrentRouteCardProps` with `vehicleAssignments`
- Add vehicle assignment section with "Change Vehicle" / "Change Driver" links
- Add `onChangeVehicle`, `onChangeDriver` callbacks to parent

### Plan 15-07: OptimizationControlPanel — Remove Vehicle/Driver Dropdowns
- Remove vehicle/driver select props and UI
- Panel becomes read-only for assignments

### Plan 15-08: Multi-Bin UI Support (if scope allows)
- Update `DispatchConfirmationModal` for multi-route dispatch
- Update `RouteComparisonDrawer` for multi-bin comparison
- Update `useRoutePlanner` / `useOptimization` for multi-route state

---

## 7. Integration Points Summary

| Area | Files | Key Changes |
|------|-------|-------------|
| Backend vehicle selection | `binPacker.js`, `routeController.js` | Already works — no change for single-bin |
| Backend driver assignment | `routeController.js` | New: auto-assign per bin |
| Backend response | `routeController.js` | New: `vehicleAssignments[]` in response |
| Batch creation | `BatchComposerPanel.tsx`, `routeApi.ts` | Remove vehicle/driver from UI & payload |
| Consignment view | `ConsignmentDrawer.tsx` | Remove dropdowns, add batch chip |
| Driver management | `DriversPage.tsx` | Remove assign modal, onboard vehicle field |
| Fleet management | `FleetsPage.tsx` | Remove Assigned Driver column |
| Optimization result | `CurrentRouteCard.tsx`, `OptimizationControlPanel.tsx` | Show assignments + override links |
| Hooks | `useOptimization.ts`, `useRoutePlanner.ts` | Remove vehicleIds/driverId from payload |

---

## 8. Testing Considerations

1. **Unit tests:** `binPacker.test.js` — verify best-fit strategy with various vehicle mixes
2. **Integration tests:** `routeController.test.js` — verify response includes `vehicleAssignments[]`
3. **E2E tests:** 
   - Create batch without vehicle/driver → optimize → verify auto-assignment
   - Override vehicle via "Change Vehicle" link → re-optimize → verify new assignment
   - Batch exceeding single vehicle capacity → verify multi-bin response (if implemented)
4. **Visual regression:** CurrentRouteCard with vehicle assignments, ConsignmentDrawer batch chip

---

## 9. Deferred / Out of Scope

- Zone-aware manual batch splitting UI (separate phase)
- Driver workload balancing dashboard (analytics phase)
- Vehicle maintenance scheduling integration (maintenance phase)
- Historical assignment audit trail (already covered by `AUDIT_EVENT_TYPES.ASSIGNMENT_CHANGE`)

---

*Research complete. Ready for planning phase.*