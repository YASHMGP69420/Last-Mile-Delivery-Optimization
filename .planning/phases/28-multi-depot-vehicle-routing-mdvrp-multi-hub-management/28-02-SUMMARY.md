---
phase: 28-multi-depot-vehicle-routing-mdvrp-multi-hub-management
plan: "02"
subsystem: routing-engine
tags:
  - mdvrp
  - hub-clustering
  - closed-loop
  - multi-depot
  - tsp
  - dispatch
dependency_graph:
  requires:
    - 28-01
  provides:
    - nearest-hub-clustering
    - multi-depot-closed-loop-routing
  affects:
    - server/src/controllers/batchController.js
    - server/src/controllers/routeController.js
    - server/src/services/dispatchEligibilityService.js
tech_stack:
  added: []
  patterns:
    - haversine-clustering
    - closed-loop-tsp
    - origin-depot-resolution
key_files:
  created:
    - server/src/services/hubClusteringService.js
    - server/tests/mdvrp_routing.test.js
  modified:
    - server/src/controllers/batchController.js
    - server/src/routes/batchRoutes.js
    - server/src/controllers/routeController.js
    - server/src/services/dispatchEligibilityService.js
    - server/src/services/dispatch/dispatchExecutionService.js
    - server/src/services/optimization/matrixBuilder.js
decisions:
  - "D-02 Nearest-Hub Clustering: Automatically cluster consignments to the nearest active warehouse by centroid geodistance during batch creation, supporting dispatcher manual override."
  - "D-03 Strict Closed-Loop Tour Topology: Enforce departure from and return to the exact same origin hub coordinates across TSP optimization and baseline evaluation."
  - "Discretion Fallback: Legacy batches and routes lacking hubId seamlessly fall back to CANONICAL_DEPOT (Rasulgarh) without runtime errors."
metrics:
  duration: 12m
  completed: "2026-11-23"
status: complete
actuals:
  tokens: 13930
  tasks: 2
  commits: 2
  plan_head_before: 006cc9c5f6bf089cf20075e5a38bb9aee5ff2d07
  plan_head_after: c613b549192c2a3462e5fc68e8391213dbddcbef
---

# Phase 28 Plan 02: Multi-Depot Vehicle Routing (MDVRP) & Nearest-Hub Clustering Summary

Multi-depot vehicle routing (MDVRP) and nearest-hub consignment clustering with strict closed-loop tour topology and dispatcher override.

## Overview

Plan 28-02 extends SmartRoute's routing engine from a single-depot paradigm to a multi-depot vehicle routing (MDVRP) architecture:
1. **Nearest-Hub Consignment Clustering**: Developed `hubClusteringService.js` with Great-Circle Haversine calculations, coordinate boundary validation (T-28-05), preview batch size limiting (T-28-06), and automatic cluster centroid mapping.
2. **Multi-Depot Batch Management**: Updated `batchController.js` to automatically associate delivery batches with the closest active hub or accept dispatcher manual overrides (D-02), added `POST /api/v1/batches/cluster-preview`, and enabled `hubId` query filtering in `getBatches`.
3. **Closed-Loop Tour Topology**: Updated `dispatchEligibilityService.js`, `matrixBuilder.js`, and `routeController.js` to ensure baseline and 2-Opt TSP optimization routines strictly depart from and return to the exact assigned origin hub (D-03).
4. **Fleet Home Hub Verification**: Added vehicle `homeHubId` verification to `validateDispatchEligibility` to detect cross-hub assignments and surface informational warnings without blocking dispatch.
5. **Comprehensive MDVRP Test Suite**: Built 12 integration tests in `server/tests/mdvrp_routing.test.js` covering nearest-hub clustering, batch persistence, dispatcher manual override, closed-loop tour metrics, dispatch execution, and backward compatibility.

---

## Tasks Completed

| Task | Name | Commit | Key Files Modified |
|------|------|--------|--------------------|
| 1 | Consignment nearest-hub clustering service and batch controller hub integration | `a227293` | `hubClusteringService.js`, `batchController.js`, `batchRoutes.js`, `mdvrp_routing.test.js` |
| 2 | Closed-loop multi-depot TSP route calculation and dispatch engine | `c613b54` | `dispatchEligibilityService.js`, `routeController.js`, `matrixBuilder.js`, `dispatchExecutionService.js`, `mdvrp_routing.test.js` |

---

## Key Changes Implemented

### 1. `server/src/services/hubClusteringService.js`
- `haversineDistanceKm(lat1, lon1, lat2, lon2)`: Computes great-circle distance between two points in km with bounds checking.
- `isValidCoordinate(lat, lng)`: Guards against NaN, null, and out-of-range coordinates (T-28-05).
- `findNearestHub(point, activeHubs)`: Finds the closest active logistics hub to a given coordinate or delivery.
- `clusterConsignmentsByHub(deliveries, activeHubs)`: Partitions deliveries across active hubs, calculating cluster centroids, stops counts, aggregate weights, and recommended batch names.
- `computeConsignmentClusterPreview(deliveryIds)`: Service helper for dispatch preview endpoint with 500-delivery threshold protection (T-28-06).

### 2. `server/src/controllers/batchController.js` & `batchRoutes.js`
- `createBatch`: Evaluates incoming `hubId`. If provided, validates that the hub is active and sets `batch.hubId` with depot coordinates (manual override per D-02). If omitted and deliveries exist, auto-determines the nearest active hub from the delivery cluster centroid; falls back to the canonical hub or CANONICAL_DEPOT if none found.
- `previewHubClusters`: New `POST /api/v1/batches/cluster-preview` endpoint returning deliveries grouped by their nearest active warehouse.
- `getBatches`: Added support for `hubId` query parameter filtering and populated `hubId` metadata.
- `updateBatch`: Added support for manual hub override updates and audit logging.

### 3. `server/src/services/dispatchEligibilityService.js`
- `calculateStopSequenceMetrics`: Dynamic `depotGeo` resolution from `depot.geo` or `depot.location`, strictly starting `polylineCoords` at `[depotGeo.lng, depotGeo.lat]` and ending at `[depotGeo.lng, depotGeo.lat]` with the return leg explicitly computed and summed into `totalDistanceKm` and `totalDurationMin`.
- `validateDispatchEligibility`: Validates whether the assigned vehicle's `homeHubId` matches the route/batch origin hub, appending an informational warning without failing dispatch if mismatched.
- `createOrUpdateRouteFromSequence`: Resolves `hubId` and origin depot coordinates when creating non-optimized or direct routes.

### 4. `server/src/controllers/routeController.js` & `matrixBuilder.js`
- `resolveOriginDepot`: Reusable helper resolving origin hub and depot from route, batch, or custom depot, with fallback to `CANONICAL_DEPOT`.
- `evaluateBaseline`: Uses resolved origin depot for distance matrix, travel times, ETAs, and road polyline.
- `optimizeRoutes`: Builds matrix from resolved origin depot, persists `hubId` on generated Route documents, and verifies return leg topology.
- `getRoutes` & `getRouteById`: Populates `hubId` metadata for route listings and detail views.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Delivery resolution in `evaluateBaseline` for manifest batches**
- **Found during:** Task 2 verification
- **Issue:** `evaluateBaseline` queried deliveries only with `{ batchId: batch._id }`, returning 0 deliveries when batch was created with `deliveryIds: [...]` without direct `Delivery.batchId` update.
- **Fix:** Updated `evaluateBaseline` to query `{ $or: [{ batchId: batch._id }, { _id: { $in: batchDeliveryIdList } }] }` and preserve manifest order, mirroring `optimizeRoutes`.
- **Files modified:** `server/src/controllers/routeController.js`
- **Commit:** `c613b54`

**2. [Rule 1 - Bug] Duplicate Mongoose schema index warning on Route `hubId`**
- **Found during:** Task 2 test run
- **Issue:** Mongoose emitted a duplicate index warning because `hubId` was defined with `index: true` and also had `routeSchema.index({ hubId: 1 })`.
- **Fix:** Removed redundant `routeSchema.index({ hubId: 1 })` definition.
- **Files modified:** `server/src/models/Route.js`
- **Commit:** `c613b54`

---

## Verification Results

### 1. MDVRP Test Suite
`npm --prefix server test -- tests/mdvrp_routing.test.js`
- **12 tests passed, 0 failed, 12 total**
- Verified Haversine distance, bounds checking, nearest-hub clustering, cluster preview endpoint, automatic hub association on batch creation, manual dispatcher override, hub query filtering, closed-loop baseline evaluation, closed-loop TSP optimization, vehicle homeHubId mismatch warnings, dispatch route execution, and backward compatibility fallback.

### 2. Regression Test Suite
`npm --prefix server test -- tests/hub_crud.test.js tests/driver_vehicle_crud.test.js`
- **25 tests passed, 0 failed, 25 total across 2 test suites**
- Verified hub CRUD operations, vehicle homeHubId defaulting, cascade deletion guards, and driver/vehicle lifecycle.

---

## Self-Check: PASSED

1. Created files exist:
   - `server/src/services/hubClusteringService.js`: FOUND
   - `server/tests/mdvrp_routing.test.js`: FOUND
2. Commits exist in history:
   - `a227293`: FOUND
   - `c613b54`: FOUND
