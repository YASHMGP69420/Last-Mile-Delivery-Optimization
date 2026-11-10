# Phase 10: Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization - Research

**Researched:** 2026-11-11
**Domain:** Full-Stack Logistics Operations (Node.js/Express/Mongoose + Socket.IO + React/TypeScript/Tailwind)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add `isDemoData: { type: Boolean, default: false, index: true }` to all secondary operational schemas (`DeliveryEvent`, `DriverIncident`, `DriverShift`, `MaintenanceRecord`, `RouteAssignment`, `SystemNotification`, `TelemetryAlert`, `TelemetryPing`, `VehicleAssignment`, `VehicleChecklist`), and propagate `isDemoData: Boolean(batch?.isDemoData)` onto `Route` documents created by `routeController.optimizeRoutes` and `dispatchEligibilityService.createOrUpdateRouteFromSequence`.
- **D-02:** Harden `demoDataService.deleteDemoDataset()` to purge `Route` by `{ $or: [{ isDemoData: true }, { batchId: { $in: demoBatchIds } }, { driverId: { $in: demoDriverIds } }, { vehicleId: { $in: demoVehicleIds } }] }` and purge `DeliveryEvent` and all 10 secondary collections using both `isDemoData: true` and demo entity reference clauses, so zero orphaned demo records remain even after demo batches are optimized/dispatched.
- **D-03:** Author and verify `.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md` backed by automated Jest integration tests verifying `importDemoDataset` -> `optimizeRoutes` -> `dispatchRoute` -> `deleteDemoDataset` leaves zero orphan `Route` or `DeliveryEvent` records.
- **D-04:** Update `AdminControlCenterPage.tsx` (`FLEET_MANAGER` branch) to exclude `DRAFT` routes from savings totals and compute `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, and `actualFuelUsedLitres` consistently with `/admin/overview`.
- **D-05:** Redirect `user.role === 'DRIVER'` away from `/admin/*` back to `/driver` in `client/src/components/layout/AdminLayout.tsx`, remove dead `RoutesApi.reset` in `client/src/api/routeApi.ts`, fix light-only alert boxes (`bg-blue-50`/`bg-amber-50`/`bg-red-50`/`bg-emerald-50` -> Carbon & Zinc dark-compatible classes) across `RoutePlannerPage.tsx`, `DispatchConfirmationModal.tsx`, `CsvImportModal.tsx`, `DriverHeader.tsx`, `PODModal.tsx`, and `DriversPage.tsx`, and convert the remaining `rounded-full` button in `BatchesPage.tsx` (`handleRemoveDelivery` / delete chip) to `rounded-lg`.
- **D-06:** Extend Analytics metrics (backend `adminController` or aggregated analytics endpoint / clean client derivation from real DB documents) to surface all remaining PRD KPIs honestly with `0`/`—` fallbacks when empty (zero synthetic data):
  - **Average Delivery Time** (computed from real completed delivery duration / active route ETA deltas)
  - **Fuel Cost per Delivery** (`totalOperatingCostInr / completedDeliveries` or `totalDeliveries`, `₹0` when 0)
  - **Route Efficiency Score** (`%` distance/cost efficiency across optimized non-draft routes)
  - **Vehicle Utilization Rate** (`(ASSIGNED + IN_TRANSIT vehicles) / total non-retired vehicles` + active cargo utilization context)
- **D-07:** Add a **Planned vs Actual Performance** section on `AnalyticsPage.tsx` comparing planned route baseline/optimized metrics (`Route.metrics.distanceKm`, `Route.metrics.fuelLitres`, `Route.metrics.costInr`) against actual Phase 08 `DriverShift` odometer distance and fuel/charge consumption (`actualDistanceKm`, `actualFuelOrChargeUsed`), cleanly showing `0` / awaiting shift telemetry when no closed shifts exist.
- **D-08:** Implement a reusable active-route re-optimization service (`reoptimizeActiveRoute`) that locks already terminal stops (`COMPLETED`, `FAILED`) in sequence, anchors from the vehicle's latest live GPS telemetry coordinates (falling back to incident coordinates or depot hub), recalculates ETA and pending stop ordering using the updated traffic scenario (`HEAVY_TRAFFIC` or supplied scenario) via nearest-neighbor + 2-Opt, persists updated `stops`, `metrics`, and `trafficScenario` on the `Route` document, and emits `route:reordered` + `route:updated` via Socket.IO so Driver Handheld (`DriverSocketContext`) and Admin Tracking update live.
- **D-09:** Automatically invoke `reoptimizeActiveRoute` inside `driverHudController.reportIncident` whenever a driver with an active `DISPATCHED`/`IN_PROGRESS` route reports a `ROUTE_OBSTRUCTION` incident (road closure, severe congestion, or traffic obstruction) with `>= 2` pending stops remaining, returning the updated stop count / reroute status in the `reportIncident` response and broadcasting a system alert to Fleet Operations.
- **D-10:** Also expose `POST /api/v1/routes/:id/reoptimize` (`ADMIN` / `FLEET_MANAGER`) using the same `reoptimizeActiveRoute` service so dispatchers can manually trigger traffic-scenario re-optimization on active routes if desired (`D-08` reuse).

### the agent's Discretion
- Exact chart/card layout grid on `AnalyticsPage.tsx` following the Industrial Carbon & Zinc dark palette (`09-UI-REVIEW.md`) and crisp `rounded-[4px]` left-bar micro-tags.
- Whether `AnalyticsPage.tsx` fetches shift aggregates from `/admin/overview` or a dedicated lightweight `/admin/analytics` endpoint (prefer extending `/admin/overview` or existing endpoints cleanly without breaking existing consumers).

### Deferred Ideas (OUT OF SCOPE)
- **README rewrite & Live Deployment Setup (`#4`)**: Updating `README.md` (fixing stale `5174` port, `151` test count, deleted `admin@example.com` demo credentials) and adding Render/Vercel/Docker deployment manifests & live deployed link for final evaluation — deferred to dedicated deployment step.
- **Admin User Management UI for `D-17`**: Backend Last-Admin protection is tested in Jest; Admin User Management frontend UI remains unscheduled unless needed.
- **Delivery POD & strict OTP verification checks**: Deferred from Phase 09.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Tag `isDemoData` on all 10 secondary models and propagate `isDemoData` onto `Route` documents in `optimizeRoutes` & `createOrUpdateRouteFromSequence` | Audited all 10 model files (`AuditEvent`/`DeliveryEvent` already tagged; 9 need field added); verified exact creation sites in `routeController.js:596-607`, `dispatchEligibilityService.js:645-683`, and `dispatchExecutionService.js` |
| D-02 | Cascade-purge orphan demo `Route`, `DeliveryEvent`, and all 10 secondary collections in `demoDataService.deleteDemoDataset()` | Audited `demoDataService.js:309-361`; mapped exact FK/metadata reference fields (`targetUserId`, `metadata.driverId`, `routeId`, `batchId`, etc.) per model |
| D-03 | Author `07-VERIFICATION.md` backed by Jest integration test of `importDemoDataset -> optimizeRoutes -> dispatchRoute -> deleteDemoDataset` | Verified `08-VERIFICATION.md` format and `server/tests/demo_data.test.js` fixture patterns |
| D-04 | Sync `AdminControlCenterPage.tsx` (`FLEET_MANAGER` branch) savings totals excluding `DRAFT` routes | Verified `admin_control.test.js:40-48` mandates keeping `/admin/overview` `ADMIN`-only; shared `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`) solves both D-04 and D-06/D-07 cleanly |
| D-05 | `AdminLayout` `DRIVER` redirect, dead `RoutesApi.reset` removal, secondary dark-mode alert contrast fixes, `BatchesPage.tsx:746` radius fix | Verified exact lines across all 9 target frontend files and confirmed zero callers of `RoutesApi.reset` |
| D-06 | Surface Average Delivery Time, Fuel Cost per Delivery, Route Efficiency Score, Vehicle Utilization Rate on `AnalyticsPage.tsx` with `0`/`—` fallbacks | Verified `Route`, `Delivery`, `Vehicle`, `AuditEvent` fields and `savingsAnalyticsService.js` patterns |
| D-07 | Planned vs Actual Performance section on `AnalyticsPage.tsx` comparing `Route` metrics vs `DriverShift` telemetry | Verified exact Mongoose field names (`Route.metrics.totalDistanceKm`, `fuelConsumed`, `costInr` vs `DriverShift.actualDistanceKm`, `actualFuelOrChargeUsed`, `fuelUnit`) |
| D-08 | Reusable `reoptimizeActiveRoute` service locking terminal stops, anchoring from live GPS/incident/depot, running NN + 2-Opt, emitting `route:reordered` + `route:updated` | Verified `matrixBuilder.js`, `optimizerEngine.js`, `simulatedTrafficService.js` (`HEAVY_TRAFFIC` multiplier gap identified!), `socketService.js`, `DriverSocketContext.tsx`, `TrackingPage.tsx` |
| D-09 | Automatic invocation inside `driverHudController.reportIncident` on `ROUTE_OBSTRUCTION` when active route has `>= 2` pending stops | Verified `driverHudController.js:1101-1160` and `DriverSupportPage.tsx:48-67` |
| D-10 | Expose `POST /api/v1/routes/:id/reoptimize` (`ADMIN` / `FLEET_MANAGER`) reusing `reoptimizeActiveRoute` | Verified `routeRoutes.js:47-51` and `client/src/api/routeApi.ts` |
</phase_requirements>

## Summary

Phase 10 closes all Milestone 4 audit blockers and completes the remaining functional requirements from the SmartRoute PRD across three tightly scoped areas: (1) Demo data isolation & Milestone 4 audit closure (`D-01`–`D-05`), (2) PRD KPIs & Planned-vs-Actual analytics (`D-06`–`D-07`), and (3) automatic mid-shift route recalculation on `ROUTE_OBSTRUCTION` incidents plus dispatcher manual re-optimization (`D-08`–`D-10`). Every component needed already exists in the codebase — no new npm dependencies are required on either `server` or `client`.

Several critical implementation details were uncovered by direct source inspection that would cause bugs if missed during planning:
1. **`TRAFFIC_SCENARIOS` gap (`D-08`)**: `server/src/config/constants.js` and `simulatedTrafficService.js` currently only define `FREE_FLOW`, `MORNING_RUSH`, `EVENING_PEAK`, `MONSOON_RAIN`, and `WEEKEND`. Passing `'HEAVY_TRAFFIC'` without adding `HEAVY_TRAFFIC: 'HEAVY_TRAFFIC'` (`2.0x` multiplier) to `constants.js` causes `simulatedTrafficService.calculateDuration()` to silently fall back to `FREE_FLOW` (`1.0x`).
2. **`/admin/overview` RBAC lock (`D-04`, `D-06`)**: `server/tests/admin_control.test.js:40-48` (`TC-ADMIN-RBAC-2`) explicitly asserts that `FLEET_MANAGER` receives `403` on `GET /api/v1/admin/overview`. Therefore, `AdminControlCenterPage.tsx` (`FLEET_MANAGER` branch) and `AnalyticsPage.tsx` (accessible to both `ADMIN` and `FLEET_MANAGER`) MUST NOT be pointed at `/admin/overview`. Instead, adding a dedicated `GET /api/v1/admin/analytics` endpoint mounted alongside `/notifications` and `/incidents` (authorized for `ROLES.ADMIN, ROLES.FLEET_MANAGER`) serves both `AnalyticsPage.tsx` and the `FLEET_MANAGER` dashboard without breaking any RBAC tests.
3. **`SystemNotification` & `DeliveryEvent` deletion (`D-01`, `D-02`)**: `DeliveryEvent.js` is an alias re-exporting `AuditEvent.js` (which already has `isDemoData`), while `SystemNotification.js` stores driver/vehicle/route IDs as strings inside `metadata` rather than top-level ObjectId fields. `demoDataService.deleteDemoDataset()` must discover orphaned `Route` IDs by `{ $or: [{ isDemoData: true }, { batchId }, { driverId }, { vehicleId }] }` first, then purge all 10 secondary collections using both `isDemoData: true` and entity/string-metadata clauses.
4. **Live Socket.IO sync (`D-08`)**: `socketService.emitRouteReordered()` currently emits only `'route:reordered'` (not `'route:updated'`), and `TrackingPage.tsx` does not yet listen for `'route:reordered'` or `'route:updated'`. Both need wiring so Admin Tracking and Driver Handheld update simultaneously.

**Primary recommendation:** Structure Phase 10 into three parallelizable implementation tracks matching the three areas: (1) Demo cleanup + `07-VERIFICATION.md` + `D-04`/`D-05` UI/route audit fixes, (2) Backend `GET /api/v1/admin/analytics` + `AnalyticsPage.tsx` PRD KPIs & Planned-vs-Actual comparison, and (3) `reoptimizeActiveRoute` service + `HEAVY_TRAFFIC` multiplier + `reportIncident` auto-trigger + `POST /routes/:id/reoptimize` + live Socket.IO sync.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `isDemoData` tagging & cascade deletion (`D-01`–`D-02`) | API / Backend (`demoDataService.js`, `routeController.js`, `dispatchEligibilityService.js`, `dispatchExecutionService.js`) | Database / Storage (Mongoose schemas + indexes) | Data integrity and cross-collection cleanup must execute server-side in MongoDB; UI never filters demo vs real manually. |
| `FLEET_MANAGER` savings sync (`D-04`) & PRD Analytics aggregation (`D-06`–`D-07`) | API / Backend (`savingsAnalyticsService.js`, `adminController.getAnalytics`) | Browser / Client (`AdminControlCenterPage.tsx`, `AnalyticsPage.tsx`) | Multi-collection joins across `Route` (metrics/baseline), `Delivery`, `Vehicle`, `AuditEvent`, and `DriverShift` belong in backend aggregation so `FLEET_MANAGER` gets identical totals to `/admin/overview` without pulling unbounded raw shifts to the browser. |
| `AdminLayout` `DRIVER` guard & dark-mode contrast (`D-05`) | Browser / Client (`AdminLayout.tsx`, `routeApi.ts`, secondary modals/pages) | — | Route-level SPA navigation protection and Tailwind Carbon & Zinc styling live purely in React components. |
| Mid-shift active route re-optimization (`D-08`–`D-10`) | API / Backend (`reoptimizeService`, `driverHudController.reportIncident`, `routeController.reoptimizeRoute`, `socketService`) | Browser / Client (`DriverSocketContext.tsx`, `DriverSupportPage.tsx`, `TrackingPage.tsx`) | Nearest-neighbor + 2-Opt calculation, terminal stop locking, live GPS anchor lookup (`TelemetryPing`), DB persistence, and room-scoped Socket.IO fan-out are authoritative backend responsibilities; clients reactively refresh on `route:reordered` / `route:updated`. |

## Standard Stack

### Core (All Already Installed — Zero New External Packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^4.19.2` [VERIFIED: server/package.json:20] | REST API routing & middleware | Existing server framework |
| `mongoose` | `^8.3.1` [VERIFIED: server/package.json:25] | MongoDB ODM schemas, queries & aggregations | Existing persistence layer |
| `socket.io` | `^4.7.5` [VERIFIED: server/package.json:29] | Real-time bi-directional room broadcasts | Existing WebSocket layer (`management`, `driver:<id>`, `route:<id>`) |
| `react` / `react-router-dom` | `^18.3.1` / `^6.23.1` [VERIFIED: client/package.json:20,23] | Frontend SPA views & role guards | Existing client framework |
| `tailwindcss` | `^3.4.3` [VERIFIED: client/package.json:36] | Carbon & Zinc dark-mode utility styling | Existing styling system (`client/tailwind.config.js`) |
| `lucide-react` | `^0.378.0` [VERIFIED: client/package.json:18] | Operational UI icons | Existing icon library |

### Supporting (Testing & Verification)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` | `^29.7.0` [VERIFIED: server/package.json:34] | Backend unit & integration test runner | All backend tests (`npm --prefix server test`) |
| `supertest` | `^6.3.4` [VERIFIED: server/package.json:37] | HTTP endpoint integration assertions | Testing `/admin/demo-data`, `/admin/analytics`, `/driver-hud/incidents`, `/routes/:id/reoptimize` |
| `typescript` / `vite` | `^5.9.3` / `^5.2.11` [VERIFIED: client/package.json:37-38] | Static typechecking & bundle compilation | Client verification (`npm --prefix client test` & `npm --prefix client run build`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`) | Allowing `FLEET_MANAGER` on `GET /api/v1/admin/overview` | Rejected: `server/tests/admin_control.test.js:40-48` (`TC-ADMIN-RBAC-2`) explicitly tests that `FLEET_MANAGER` receives `403 INSUFFICIENT_PERMISSIONS` on `/admin/overview`. |
| Client-side `DriverShift` fetching for Planned vs Actual | Server-side aggregation in `savingsAnalyticsService` + `/admin/analytics` | Server-side aggregation avoids exposing raw `DriverShift` lists to a new endpoint and guarantees identical numbers across `AdminControlCenterPage` (`FLEET_MANAGER`) and `AnalyticsPage`. |

**Installation:** No package installation required.

## Package Legitimacy Audit

No external npm/PyPI/crates packages are added or recommended in Phase 10. All capabilities use existing dependencies already audited in `server/package.json` and `client/package.json`.

## Architecture Patterns

### System Architecture Diagram

```
[Driver Handheld: DriverSupportPage] --POST /driver-hud/incidents (ROUTE_OBSTRUCTION)--> [driverHudController.reportIncident]
                                                                                              |
                                                                                              v (active route & >=2 pending stops)
[Dispatcher: TrackingPage / API] ----POST /routes/:id/reoptimize (ADMIN/FLEET_MGR)----> [reoptimizeActiveRoute Service]
                                                                                              |
     +----------------------------------------------------------------------------------------+
     | 1. Lock COMPLETED/FAILED stops   2. Anchor GPS (TelemetryPing -> incident -> depot)
     | 3. buildMatrix(anchor, pending, { trafficScenario }) -> runRouteOptimization (NN + 2-Opt)
     | 4. Persist Route (stops, metrics, deltas, version+1, trafficScenario) + AuditEvent + SystemNotification
     v
[socketService.emitRouteReordered] ===> emits 'route:reordered' + 'route:updated'
     |                                         |
     v                                         v
[DriverSocketContext] (triggerRefresh)    [TrackingPage] (handleLiveProgress -> fetchData)

[AnalyticsPage / AdminControlCenterPage (FLEET_MANAGER)]
     |
     +--> GET /api/v1/admin/analytics (ADMIN + FLEET_MANAGER)
             |
             +--> savingsAnalyticsService (Route planned metrics/deltas + DriverShift actuals)
             +--> Delivery + AuditEvent + Vehicle aggregations (Avg Delivery Time, Cost/Deliv, Efficiency, Utilization)
```

### Component Responsibilities

| Component / File | Responsibility in Phase 10 |
|------------------|---------------------------|
| 9 Secondary Mongoose Models (`DriverIncident.js`, `DriverShift.js`, `MaintenanceRecord.js`, `RouteAssignment.js`, `SystemNotification.js`, `TelemetryAlert.js`, `TelemetryPing.js`, `VehicleAssignment.js`, `VehicleChecklist.js`) | Add `isDemoData: { type: Boolean, default: false, index: true }` (`AuditEvent.js` / `DeliveryEvent.js` already has it at `AuditEvent.js:49-53`) |
| `routeController.js`, `dispatchEligibilityService.js`, `dispatchExecutionService.js`, `auditService.js` | Propagate `isDemoData: Boolean(batch?.isDemoData)` onto created/updated `Route`, `VehicleAssignment`, `RouteAssignment`, and `AuditEvent` records |
| `demoDataService.js` | Harden `deleteDemoDataset()` to resolve all orphan `Route` IDs by `{ $or: [{ isDemoData: true }, { batchId }, { driverId }, { vehicleId }, { 'stops.deliveryId' }] }` and purge all 10 secondary collections by `isDemoData: true` + entity/metadata refs |
| `server/src/config/constants.js` | Add `HEAVY_TRAFFIC: 'HEAVY_TRAFFIC'` to `TRAFFIC_SCENARIOS` and `HEAVY_TRAFFIC: 2.0` to `TRAFFIC_MULTIPLIERS` |
| `server/src/services/optimization/activeRouteReoptimizer.js` (new) | Encapsulate `reoptimizeActiveRoute({ route, trafficScenario, anchorCoordinates, actor, reason })` |
| `server/src/controllers/driverHudController.js` (`reportIncident`) | Auto-invoke `reoptimizeActiveRoute` on `ROUTE_OBSTRUCTION` when driver has active `DISPATCHED`/`IN_PROGRESS` route with `>= 2` non-terminal (`PENDING`/`ARRIVED`) stops; return `reoptimization` summary & emit ops alert |
| `server/src/controllers/routeController.js` & `routeRoutes.js` | Expose `POST /api/v1/routes/:id/reoptimize` (`ROLES.ADMIN`, `ROLES.FLEET_MANAGER`) |
| `server/src/services/socketService.js` | Emit both `'route:reordered'` and `'route:updated'` in `emitRouteReordered()` |
| `server/src/services/savingsAnalyticsService.js` & `adminController.js` & `adminRoutes.js` | Add `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`) returning fleet savings, `DriverShift` actuals, Planned vs Actual totals, and PRD KPIs |
| `client/src/pages/admin/AdminControlCenterPage.tsx` | Update `FLEET_MANAGER` branch to fetch `/admin/analytics` (or filter non-draft routes) and populate `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, `actualFuelUsedLitres` |
| `client/src/pages/admin/AnalyticsPage.tsx` | Display Average Delivery Time, Fuel Cost per Delivery, Route Efficiency Score, Vehicle Utilization Rate, and Planned vs Actual Performance card/table using Carbon & Zinc styling |
| `client/src/components/layout/AdminLayout.tsx` | Redirect `user.role === 'DRIVER'` to `/driver` |
| `client/src/api/routeApi.ts` | Remove dead `RoutesApi.reset`; add `RoutesApi.reoptimize(routeId, payload)` |
| `client/src/pages/admin/TrackingPage.tsx` & `client/src/pages/driver/DriverSupportPage.tsx` | Subscribe to `route:reordered` & `route:updated` in `TrackingPage`; surface auto-reroute feedback in `DriverSupportPage` |
| `RoutePlannerPage.tsx`, `DispatchConfirmationModal.tsx`, `CsvImportModal.tsx`, `DriverHeader.tsx`, `PODModal.tsx`, `DriversPage.tsx`, `BatchesPage.tsx` | Replace light-only `bg-*-50`/`bg-*-100` alerts/badges with Carbon & Zinc dark-compatible `dark:` classes and convert `BatchesPage.tsx:746` `rounded-full` to `rounded-lg` |

### Pattern 1: Demo Data Tagging & Dependency-Order Cascade Purge (`D-01`, `D-02`)
**What:** Every document created directly or indirectly from a demo batch/driver/vehicle carries `isDemoData: true`, and `deleteDemoDataset()` discovers both explicitly tagged documents AND any untagged documents linked to demo entities before deleting.
**When to use:** `importDemoDataset`, `optimizeRoutes`, `createOrUpdateRouteFromSequence`, `executeDispatch`, and `deleteDemoDataset`.
**Verified Code Facts:**
- `DeliveryEvent.js:1-4` exports `AuditEvent` (`module.exports = AuditEvent;`) [VERIFIED: server/src/models/DeliveryEvent.js:1-4], and `AuditEvent.js:49-53` already has:
  ```js
  isDemoData: {
    type: Boolean,
    default: false,
    index: true,
  },
  ```
  [VERIFIED: server/src/models/AuditEvent.js:49-53]
- `SystemNotification.js:4-44` has NO top-level `driverId`, `vehicleId`, `routeId`, or `batchId` fields — only `targetUserId` and `metadata: { type: mongoose.Schema.Types.Mixed }` [VERIFIED: server/src/models/SystemNotification.js:12-43]. Meanwhile `driverHudController.js:651, 1054, 1130` writes string IDs into `metadata` (`{ vehicleId: vehicle._id.toString(), driverId: driver._id.toString() }`) [VERIFIED: server/src/controllers/driverHudController.js:651].
- Therefore, `deleteDemoDataset()` must resolve `demoUserIds`, `demoDriverIds`, `demoVehicleIds`, `demoBatchIds`, `demoDeliveryIds`, then resolve `demoRouteIds` via:
  ```js
  const routeFilter = {
    $or: [
      { isDemoData: true },
      ...(demoBatchIds.length ? [{ batchId: { $in: demoBatchIds } }] : []),
      ...(demoDriverIds.length ? [{ driverId: { $in: demoDriverIds } }] : []),
      ...(demoVehicleIds.length ? [{ vehicleId: { $in: demoVehicleIds } }] : []),
      ...(demoDeliveryIds.length ? [{ 'stops.deliveryId': { $in: demoDeliveryIds } }] : []),
    ],
  };
  const demoRouteIds = await Route.find(routeFilter).distinct('_id');
  ```
- Then build `refClauses` including `demoRouteIds`, and delete each of the 10 secondary collections with `{ $or: [{ isDemoData: true }, ...applicableRefClauses] }` (for `SystemNotification`, include `{ isDemoData: true }`, `{ 'metadata.isDemoData': true }`, `{ targetUserId: { $in: demoUserIds } }`, and string metadata matches `{ 'metadata.driverId': { $in: demoDriverIdStrs } }`, `{ 'metadata.vehicleId': { $in: demoVehicleIdStrs } }`, `{ 'metadata.routeId': { $in: demoRouteIdStrs } }`).
- Keep `getDemoDataStatus()` returning `{ hasDemoData, counts: { users, drivers, vehicles, deliveries, batches, routes, total } }` to preserve the exact contract tested in `server/tests/demo_data.test.js:53-54, 88-93` [VERIFIED: server/tests/demo_data.test.js:53-54,88-93] and typed in `client/src/api/client.ts:326-338` [VERIFIED: client/src/api/client.ts:326-338].

### Pattern 2: Mid-Shift Active Route Re-Optimization (`D-08`–`D-10`)
**What:** Lock terminal stops (`COMPLETED`, `FAILED`), anchor from live GPS (fallback to incident coords -> last terminal stop -> `route.depot`), optimize remaining non-terminal stops via `buildMatrix` + `runRouteOptimization` under `HEAVY_TRAFFIC` (or supplied `trafficScenario`), update stop ETAs/distances/durations and route metrics, increment `route.version`, and broadcast `route:reordered` + `route:updated`.
**Verified Code Facts:**
- `server/src/services/optimization/matrixBuilder.js:59-61` already extracts coordinates from `delivery.location.lat` and `delivery.location.lng` [VERIFIED: server/src/services/optimization/matrixBuilder.js:59-61], which matches `Route.stops` subdocuments (`location: { lat: Number, lng: Number }`) [VERIFIED: server/src/models/Route.js:30-33].
- `server/src/config/constants.js:116-130` defines `TRAFFIC_SCENARIOS` (`FREE_FLOW`, `MORNING_RUSH`, `EVENING_PEAK`, `MONSOON_RAIN`, `WEEKEND`) and `TRAFFIC_MULTIPLIERS` (`1.0`, `1.8`, `2.2`, `1.5`, `1.1`) [VERIFIED: server/src/config/constants.js:116-130]. Adding `HEAVY_TRAFFIC: 'HEAVY_TRAFFIC'` and `HEAVY_TRAFFIC: 2.0` ensures `simulatedTrafficService.js:95-97` applies real congestion delay instead of defaulting to `FREE_FLOW` (`1.0`).
- `server/src/services/telemetryService.js:222` queries `TelemetryPing.findOne(query).sort({ timestamp: -1 })` with GeoJSON `[lng, lat]` at `location.coordinates` [VERIFIED: server/src/services/telemetryService.js:222].
- When anchoring mid-shift at `(anchorLat, anchorLng)`:
  - `buildMatrix` treats index `0` as the anchor (`{ name: 'Current Vehicle Location', geo: { lat: anchorLat, lng: anchorLng } }`) and indices `1..k` as the `k` non-terminal stops.
  - `runRouteOptimization({ depotIndex: 0, stopIndices, getDistanceKm, getDurationMin, points, vehicle, options })` returns `optimized.stopSequence` (array of 1-based point indices in optimal order).
  - Note: `optimizerEngine.js` closes the tour back to index `0`. For updating `route.stops` and `route.metrics`, compute sequential leg `distanceFromPrevKm`, `durationFromPrevMin`, and `eta` (formatted `HH:MM` matching `routeController.js:536` `toTimeString().substring(0, 5)` from `new Date()`) starting from `anchor` through the reordered pending stops, and compute the final return-to-depot leg to `route.depot.geo` (using `roadDistance` / `calculateDuration` or `geoapifyService`) so `metrics.totalDistanceKm`, `metrics.totalDurationMin`, `metrics.costInr`, `metrics.fuelConsumed`, `metrics.co2Kg` reflect the full updated route accurately (preserving terminal-stop distances + remaining optimized legs).
  - Update `route.optimizationMetadata.trafficScenario = scenario`, `route.optimizationMetadata.algorithm = optEngineRes.algorithmUsed`, `route.version = (route.version || 1) + 1`.
- In `driverHudController.reportIncident` (`driverHudController.js:1101-1160`):
  - Resolve active route via `findActiveRouteForDriver(driver, true)` (or `Route.findById(routeId)` when supplied, checking status `DISPATCHED` or `IN_PROGRESS` per `D-09`: "whenever a driver with an active `DISPATCHED`/`IN_PROGRESS` route reports a `ROUTE_OBSTRUCTION` incident ... with `>= 2` pending stops remaining").
  - Count non-terminal stops (`s.status !== 'COMPLETED' && s.status !== 'FAILED'`).
  - Only trigger when `category === 'ROUTE_OBSTRUCTION'`, route status is `'DISPATCHED'` or `'IN_PROGRESS'`, and `pendingStops.length >= 2`.
  - Wrap re-optimization in a try/catch or let incident persistence succeed even if map matrix fails transiently? Better: persist `DriverIncident` first, then run `reoptimizeActiveRoute`; if it succeeds, create a `SystemNotification` (`targetRole: 'FLEET_MANAGER'`, `category: 'ROUTE'`) + `emitTelemetryAlert` informing Fleet Operations of the automatic reroute, and attach `reoptimization: { triggered: true, routeId, routeCode, version, pendingStopsCount, trafficScenario, stopSequence }` to the `201` response alongside `incident`.

### Pattern 3: Shared Analytics Endpoint & Exact Schema Field Alignment (`D-04`, `D-06`, `D-07`)
**What:** Add `GET /api/v1/admin/analytics` authorized for `ROLES.ADMIN, ROLES.FLEET_MANAGER` right above `router.use(authorize(ROLES.ADMIN))` in `server/src/routes/adminRoutes.js:18` [VERIFIED: server/src/routes/adminRoutes.js:10-18].
**Why:** `AnalyticsPage.tsx` is accessible to both `ADMIN` and `FLEET_MANAGER` (`client/src/App.tsx:66` [VERIFIED: client/src/App.tsx:66]), and `AdminControlCenterPage.tsx` (`FLEET_MANAGER` branch) also needs `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, `actualFuelUsedLitres`, `totalDistanceSavedKm`, and `fuelSavedInr` computed identically to `/admin/overview` (`D-04`), while `GET /api/v1/admin/overview` must remain `403` for `FLEET_MANAGER` per `server/tests/admin_control.test.js:40-48`.
**Verified Schema Field Names (avoid paraphrase drift):**
- `Route.js:106-128`:
  - `route.metrics.totalDistanceKm` (NOT `distanceKm`)
  - `route.metrics.totalDurationMin`
  - `route.metrics.fuelConsumed` & `route.metrics.fuelUnit` (`'L'` | `'kWh'`, NOT `fuelLitres`)
  - `route.metrics.costInr`
  - `route.baseline.totalDistanceKm`, `route.baseline.totalDurationMin`, `route.baseline.costInr`
  - `route.deltas.distanceSavedKm`, `route.deltas.costSavedInr`, `route.deltas.co2AvoidedKg`
  [VERIFIED: server/src/models/Route.js:106-128]
- `DriverShift.js:34-46`:
  - `status`: `SHIFT_STATUS.COMPLETED` (`'COMPLETED'`)
  - `fuelUnit`: `'L'` | `'%'`
  - `actualDistanceKm`
  - `actualFuelOrChargeUsed`
  - `telemetryCapturedAtEnd`
  [VERIFIED: server/src/models/DriverShift.js:24-46]
- `Vehicle.js:48-53` & `constants.js:16-22`:
  - `availability`: `'AVAILABLE' | 'ASSIGNED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'RETIRED'`
  [VERIFIED: server/src/config/constants.js:16-22]

**Exact Metric Formulas (Zero Synthetic Data, `0`/`—` when empty):**
1. **Average Delivery Time (`avgDeliveryTimeMin`)**:
   - Primary: For `COMPLETED` deliveries (`Delivery.find({ status: 'COMPLETED' })`), check linked dispatched/completed `Route` (`route.dispatchedAt`) or `AuditEvent` (`POD_RECORDED` vs `ROUTE_DISPATCHED`); compute `(completedAt - startAt)` in minutes (using `delivery.updatedAt` minus `route.dispatchedAt` if `route.dispatchedAt && delivery.updatedAt >= route.dispatchedAt`, else `delivery.updatedAt - delivery.createdAt` capped sensibly or raw minutes).
   - Fallback when `0` completed deliveries exist: if non-draft/non-cancelled routes exist with `totalStops > 0`, use planned average stop duration `sum(r.metrics.totalDurationMin) / sum(r.metrics.totalStops)`, or `0` (display `—` on UI when `0` completed deliveries and no routes, or show `Planned ETA avg` sub-label). Returning both `avgCompletedDeliveryTimeMin` (real completed POD duration, `null`/`0` when 0 completed) and `avgPlannedStopDurationMin` gives `AnalyticsPage.tsx` complete honesty without mixing apples and oranges.
2. **Fuel Cost per Delivery (`fuelCostPerDeliveryInr`)**:
   - Sum `r.metrics.costInr` across non-draft, non-cancelled routes (`status: { $in: ['OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED'] }`).
   - Divide by `completedDeliveries` if `completedDeliveries > 0`, else by `totalDeliveries` if `totalDeliveries > 0`, else `0` (rendered as `₹0` when `0`). Also return both denominators clearly so UI subtext states `"per completed POD"` vs `"per consignment"`.
3. **Route Efficiency Score (`routeEfficiencyScorePct`)**:
   - Across non-draft, non-cancelled routes (`status: { $in: ['OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED'] }`) where `baseline.totalDistanceKm > 0`:
     - Distance reduction % = `((sumBaseDist - sumOptDist) / sumBaseDist) * 100`
     - Or efficiency score: `sumBaseDist > 0 ? Number(((1 - sumOptDist / sumBaseDist) * 100).toFixed(1)) : 0` (Wait: note if a route was dispatched via `createOrUpdateRouteFromSequence` without optimization, `baseline.totalDistanceKm === metrics.totalDistanceKm` and `deltas.distanceSavedKm === 0`; if optimized and already optimal, reduction is `0%`, whereas if optimized and improved, e.g., `24.5%` saved. Clarify label on UI as `"Distance & Cost Efficiency"` showing `%` reduction, or `Math.min(100, Number(((sumOptDist > 0 ? sumBaseDist / sumOptDist : 1) ...)))` — actually `%` reduction `((sumBaseDist - sumOptDist) / sumBaseDist) * 100` plus cost reduction `%` directly matches `deltas.percentDistanceReduction` in `costScorer.js:131` and stays `0%` when empty!).
4. **Vehicle Utilization Rate (`vehicleUtilizationRatePct`)**:
   - `nonRetiredVehicles = vehicles.filter(v => v.availability !== 'RETIRED')`
   - `activeVehicles = nonRetiredVehicles.filter(v => v.availability === 'ASSIGNED' || v.availability === 'IN_TRANSIT')`
   - `vehicleUtilizationRatePct = nonRetiredVehicles.length > 0 ? Number(((activeVehicles.length / nonRetiredVehicles.length) * 100).toFixed(1)) : 0`
   - Active cargo context: sum `weightKg` of active deliveries (`ASSIGNED` + `OUT_FOR_DELIVERY`) vs sum `capacityKg` of `activeVehicles` (`cargoLoadPct`).
5. **Planned vs Actual Performance (`plannedVsActual`)**:
   - **Planned**: Aggregate across `ACTIVE_SAVINGS_ROUTE_STATUSES` (`['DISPATCHED', 'IN_PROGRESS', 'COMPLETED']`, plus optionally `OPTIMIZED` reported separately so un-dispatched plans don't skew executed shift comparisons!):
     - `plannedBaselineDistanceKm`: sum `r.baseline.totalDistanceKm`
     - `plannedOptimizedDistanceKm`: sum `r.metrics.totalDistanceKm`
     - `plannedFuelLitres`: sum `r.metrics.fuelConsumed` where `r.metrics.fuelUnit !== 'kWh'`
     - `plannedEnergyKwh`: sum `r.metrics.fuelConsumed` where `r.metrics.fuelUnit === 'kWh'`
     - `plannedCostInr`: sum `r.metrics.costInr`
   - **Actual** (from Phase 08 `DriverShift` where `status: 'COMPLETED'`):
     - `actualDistanceKm`: sum `s.actualDistanceKm` (`fleetSavings.actualDistanceDrivenKm`)
     - `actualFuelLitres`: sum `s.actualFuelOrChargeUsed` where `s.fuelUnit !== '%'` (`fleetSavings.actualFuelUsedLitres`)
     - `actualAvgBatteryUsedPct`: `fleetSavings.actualAvgBatteryUsedPct`
     - `completedShiftsCount`: count of `COMPLETED` shifts with telemetry (`telemetryCapturedAtEnd: true` or `completedShifts.length`)
     - `distanceVarianceKm`: `completedShiftsCount > 0 ? Number((actualDistanceKm - plannedOptimizedDistanceKm).toFixed(2)) : 0`

### Anti-Patterns to Avoid
- **Never give `FLEET_MANAGER` access to `GET /api/v1/admin/overview`:** Breaks `TC-ADMIN-RBAC-2` in `server/tests/admin_control.test.js:40-48` [VERIFIED: server/tests/admin_control.test.js:40-48].
- **Never delete `Route` only by `{ isDemoData: true }` without entity-ref clauses:** Leaves orphan `Route` records if any pre-fix or legacy route references a demo batch/driver/vehicle (`D-02`).
- **Never reorder `COMPLETED` or `FAILED` stops during mid-shift re-optimization:** Terminal stops must remain locked in their existing sequence at the start of `route.stops` (`D-08`).
- **Never use `bg-*-50` / `bg-*-100` without `dark:` variants:** Breaks Carbon & Zinc dark-mode contrast established in `09-UI-REVIEW.md` and `client/src/index.css:50-94` [VERIFIED: client/src/index.css:50-94].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance/duration matrix with traffic multipliers | Custom Haversine loops in `reportIncident` or `reoptimize` | `matrixBuilder.buildMatrix` + `simulatedTrafficService` | Reuses Geoapify facade, cache, curvature factor (`1.35x`), and traffic scenario scaling |
| Route stop re-sequencing heuristic | Inline greedy swap in controller | `optimizerEngine.runRouteOptimization` (`nearestNeighbor` + `twoOpt` + `orOpt`) | Already enforces invariant that optimized distance never exceeds baseline distance |
| Fuel / CO2 / INR cost calculation | Inline rate arithmetic | `costScorer.scoreRouteCost` & `calculateDeltas` | Handles `Electric` (`kWh`), `Petrol`, `Diesel`, and org tariff overrides consistently |
| Shift & route savings aggregation | Duplicate Mongoose queries in `adminController` | `savingsAnalyticsService.getFleetSavingsSummary` (extended for Planned vs Actual) | Single source of truth across `/admin/overview`, `/admin/analytics`, `/drivers`, and `/driver-hud/profile` |

**Key insight:** All optimization, cost scoring, matrix caching, and shift aggregation primitives already exist and are heavily tested (`277` passing Jest tests); Phase 10 only needs clean composition services and schema/UI wiring.

## Common Pitfalls

### Pitfall 1: `HEAVY_TRAFFIC` Silently Falls Back to `FREE_FLOW` (`1.0x`)
**What goes wrong:** `reoptimizeActiveRoute` defaults to `trafficScenario = 'HEAVY_TRAFFIC'` per `D-08`, but `TRAFFIC_MULTIPLIERS['HEAVY_TRAFFIC']` is `undefined` in `server/src/config/constants.js:124-130` [VERIFIED: server/src/config/constants.js:124-130], so `simulatedTrafficService.js:95-97` [VERIFIED: server/src/services/mapping/simulatedTrafficService.js:95-97] falls back to `FREE_FLOW` (`1.0x`)!
**How to avoid:** Add `HEAVY_TRAFFIC: 'HEAVY_TRAFFIC'` to `TRAFFIC_SCENARIOS` and `HEAVY_TRAFFIC: 2.0` to `TRAFFIC_MULTIPLIERS` in `server/src/config/constants.js`, and add `'HEAVY_TRAFFIC'` to `TrafficScenario` union in `client/src/types/route.ts`.
**Warning signs:** Unit test comparing `FREE_FLOW` vs `HEAVY_TRAFFIC` durations yields identical `totalDurationMin`.

### Pitfall 2: `route.stops` Subdocument Validation & Mongoose Field Stripping
**What goes wrong:** `routeController.js:545-580` pushes fields like `sequenceOrder`, `recipientName`, `coordinates`, `estimatedArrival` onto `stops`, which Mongoose strips because `routeStopSchema` (`server/src/models/Route.js:4-65`) only defines `sequence`, `deliveryId`, `orderReference`, `customer`, `address`, `location`, `weightKg`, `priority`, `timeWindow`, `eta`, `distanceFromPrevKm`, `durationFromPrevMin`, `status` [VERIFIED: server/src/models/Route.js:4-65]. Similarly, `route.baseline` in `Route.js:116-121` does NOT have `fuelConsumed` or `fuelUnit` in its schema!
**How to avoid:** When building `reoptimizeActiveRoute` and Planned vs Actual analytics, rely only on fields actually persisted in `Route.js` (`stops[].location.{lat,lng}`, `metrics.totalDistanceKm`, `metrics.fuelConsumed`, `metrics.fuelUnit`, `metrics.costInr`, `baseline.totalDistanceKm`, `baseline.costInr`). Use `scoreRouteCost(r.baseline.totalDistanceKm, r.vehicleId)` if baseline fuel is needed, rather than reading undefined `r.baseline.fuelConsumed`.
**Warning signs:** `Planned Fuel` showing `0` despite routes having `baseline.totalDistanceKm > 0`.

### Pitfall 3: `reoptimizeActiveRoute` With `0` or `1` Pending Stops or Non-Active Route Status
**What goes wrong:** Running 2-Opt or re-optimization when `pendingStops.length < 2` is unnecessary, and running it on `COMPLETED` or `CANCELLED` routes corrupts historical state.
**How to avoid:**
- In `driverHudController.reportIncident`: auto-trigger ONLY when `category === 'ROUTE_OBSTRUCTION'`, route `status` is `'DISPATCHED'` or `'IN_PROGRESS'`, and non-terminal stops count `>= 2`.
- In `POST /api/v1/routes/:id/reoptimize`: reject `COMPLETED` or `CANCELLED` routes with `400 IMMUTABLE_ROUTE_STATUS` (matching `reorderRouteStops` at `routeController.js:1122-1124` [VERIFIED: server/src/controllers/routeController.js:1122-1124]), and handle `pendingStops.length < 2` gracefully (recalculate ETA/metrics from current anchor without permuting sequence, or return descriptive message).

### Pitfall 4: `SystemNotification` Cleanup Missing String-Metadata Demo References
**What goes wrong:** `SystemNotification.js` has no `driverId` or `vehicleId` ObjectId fields — `driverHudController.js:651, 1054, 1130` stores string IDs in `metadata.driverId` / `metadata.vehicleId` [VERIFIED: server/src/controllers/driverHudController.js:651,1054,1130]. A naive `SystemNotification.deleteMany({ driverId: { $in: demoDriverIds } })` matches zero documents!
**How to avoid:** Tag `isDemoData: true` at creation time when the driver/route/vehicle is demo, AND in `deleteDemoDataset()` match `$or` on `{ isDemoData: true }`, `{ 'metadata.isDemoData': true }`, `{ targetUserId: { $in: demoUserIds } }`, and string metadata IDs (`demoDriverIdStrs`, `demoVehicleIdStrs`, `demoRouteIdStrs`).

### Pitfall 5: `Driver.currentRouteId` & `Route.findOne` Resolution on `reportIncident`
**What goes wrong:** A driver may have an active route bound via `route.driverId` or `driver.assignedVehicleId` even if `req.body.routeId` wasn't sent by `DriverSupportPage.tsx` (`DriverSupportPage.tsx:26-30` only sends `{ category, severity, description }` [VERIFIED: client/src/pages/driver/DriverSupportPage.tsx:26-30]).
**How to avoid:** Inside `reportIncident`, if `routeId` is absent or `driver.currentRouteId` is null, fall back to `findActiveRouteForDriver(driver, true)` (`driverHudController.js:83-123` [VERIFIED: server/src/controllers/driverHudController.js:83-123]), and save `incident.routeId = activeRoute._id` when found!

### Pitfall 6: Remaining Light-Only Classes Outside the Primary List
**What goes wrong:** While `D-05` explicitly names `RoutePlannerPage.tsx`, `DispatchConfirmationModal.tsx`, `CsvImportModal.tsx`, `DriverHeader.tsx`, `PODModal.tsx`, `DriversPage.tsx`, and `BatchesPage.tsx:746`, a codebase grep also found light-only `bg-amber-50` / `bg-emerald-50` / `hover:bg-red-50` in `DriverRoutePage.tsx:221, 235, 350-371` and `DriverProfilePage.tsx:207` and `TrackingPage.tsx:388-389`.
**How to avoid:** Fix all 6 listed files + `BatchesPage.tsx:746` thoroughly, and check whether `TrackingPage.tsx:388-389` (`bg-red-100 text-red-800` / `bg-amber-100 text-amber-800`) needs `dark:` variants when touching `TrackingPage.tsx` for `D-08`!

## Code Examples

### 1. Carbon & Zinc Dark-Mode Alert Pattern (matching `09-UI-REVIEW.md` & `index.css`)
```tsx
// Verified pattern from client/src/pages/admin/DriversPage.tsx:350-351 & BatchComposerPanel.tsx:135
// Success banner:
<div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
// Warning banner:
<div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
// Error banner:
<div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
// Info banner:
<div className="p-3 rounded-lg border bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs font-medium flex items-center gap-2">
```

### 2. Crisp Left-Bar Micro-Tag Pattern (from `09-UI-REVIEW.md` & `TrackingPage.tsx:502-510`)
```tsx
// Source: client/src/pages/admin/TrackingPage.tsx:502-510
<span className="px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider text-[10px] font-semibold border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] border-l-primary text-on-surface dark:text-zinc-100">
  {label}
</span>
```

### 3. `AdminLayout.tsx` `DRIVER` Role Redirect (`D-05`)
```tsx
// Source pattern: client/src/components/layout/AdminLayout.tsx:29-31 + client/src/App.tsx:36
if (!user) {
  return <Navigate to="/login" replace />;
}
if (user.role === 'DRIVER') {
  return <Navigate to="/driver" replace />;
}
```

### 4. Secondary Schema `isDemoData` Field (`D-01`)
```js
// Exact field definition matching server/src/models/Route.js:149-153 & AuditEvent.js:49-53
isDemoData: {
  type: Boolean,
  default: false,
  index: true,
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AdminControlCenterPage` `FLEET_MANAGER` branch reduces `RoutesApi.list()` raw including `DRAFT` routes | Shared `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`) backed by `savingsAnalyticsService` (`ACTIVE_SAVINGS_ROUTE_STATUSES`) | Phase 10 | Consistent `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, `actualFuelUsedLitres` across Admin & Fleet Manager views |
| `deleteDemoDataset` deletes `Route` by `{ isDemoData: true }` only | Propagates `isDemoData` at `optimizeRoutes` / `createOrUpdateRouteFromSequence` + cascade-purges by entity & metadata refs | Phase 10 | Zero orphan `Route` or `DeliveryEvent` records after demo workflow |
| Static dispatched stop order until manual dispatcher `reorder` | Auto `reoptimizeActiveRoute` on `ROUTE_OBSTRUCTION` incident + `POST /routes/:id/reoptimize` | Phase 10 | Real-time mid-shift rerouting around traffic/closures with live Socket.IO push |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `HEAVY_TRAFFIC: 2.0` in `TRAFFIC_MULTIPLIERS` (between `MORNING_RUSH: 1.8` and `EVENING_PEAK: 2.2`) matches intended congestion scaling for `D-08` | Architecture Patterns / Pitfall 1 | Minor ETA scaling difference only; easily adjusted in `constants.js` |
| A2 | Adding `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`) rather than opening `/admin/overview` to `FLEET_MANAGER` aligns with the Discretion note in `10-CONTEXT.md` and preserves `TC-ADMIN-RBAC-2` | Summary / Architectural Responsibility Map | None — `10-CONTEXT.md` explicitly permits a dedicated `/admin/analytics` endpoint |
| A3 | For `Route Efficiency Score` (`D-06`), computing aggregate `(sumBaselineDist - sumOptimizedDist) / sumBaselineDist * 100` (distance reduction %) alongside cost reduction % across non-draft routes matches PRD expectations | Architecture Patterns (Pattern 3) | UI label clarifies exact definition so users see true mathematical basis |

## Open Questions (RESOLVED)

1. **Completed Delivery Duration Baseline When `Route.dispatchedAt` Is Absent (Legacy/Manual Tests) — RESOLVED**
   - What we know: `Delivery.js` has `timestamps: true` (`createdAt`, `updatedAt`), and `Route.js` has `dispatchedAt` and `completedAt`.
   - What's unclear: Some deliveries completed without a `Route.dispatchedAt` only have `Delivery.createdAt` and `Delivery.updatedAt`.
   - RESOLVED (`10-03-PLAN.md` Task 1): Compute `averageDeliveryTimeMin` from `delivery.updatedAt - route.dispatchedAt` (for stops matched to a dispatched route) with fallback to `delivery.updatedAt - delivery.createdAt` when `dispatchedAt` is missing; return `null` when `0` completed deliveries exist so `AnalyticsPage.tsx` renders `—` cleanly alongside planned route duration fallback.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend Express + Jest + Vite | ✓ | `v24.16.0` [VERIFIED: `node --version`] | — |
| npm | Package scripts (`test`, `build`) | ✓ | `11.16.0` [VERIFIED: `npm --version`] | — |
| MongoDB (`mongod`) | Jest integration tests (`smartroute_test`) | ✓ | Running (`mongod` PID active) [VERIFIED: `Get-Process mongod`] | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Jest `^29.7.0` + Supertest `^6.3.4` (`testEnvironment: 'node'`) [VERIFIED: server/package.json:34,37; server/jest.config.js:2] |
| Backend Config File | `server/jest.config.js` (`setupFilesAfterEnv: ['./tests/setup.js']`, `testTimeout: 20000`) [VERIFIED: server/jest.config.js:1-13] |
| Backend Test DB | `mongodb://127.0.0.1:27017/smartroute_test` (wiped in `afterEach` in `server/tests/setup.js:17-25`) [VERIFIED: server/tests/setup.js:7-25] |
| Frontend Verification | TypeScript `tsc --noEmit` (`^5.9.3`) + Vite production build (`tsc && vite build`, `^5.2.11`) [VERIFIED: client/package.json:7,9,37-38] |
| Quick Run Command (Backend single suite) | `npm --prefix server test -- tests/<suite>.test.js` |
| Full Suite Command (Backend) | `npm --prefix server test` (`cross-env NODE_ENV=test jest --runInBand --detectOpenHandles --forceExit`) [VERIFIED: server/package.json:12] |
| Full Check Command (Frontend) | `npm --prefix client test && npm --prefix client run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01, D-02, D-03 | `importDemoDataset -> optimizeRoutes -> dispatchRoute -> deleteDemoDataset` leaves 0 orphan `Route`, `DeliveryEvent`/`AuditEvent`, and secondary records while preserving real records | Integration (Jest + Supertest) | `npm --prefix server test -- tests/demo_data.test.js` | ✅ Extend `server/tests/demo_data.test.js` |
| D-04, D-06, D-07 | `GET /api/v1/admin/analytics` allows `ADMIN` & `FLEET_MANAGER`, rejects `DRIVER` (`403`), excludes `DRAFT` routes, computes PRD KPIs & Planned vs Actual from `Route` + `DriverShift`, returns `0` cleanly when empty | Integration (Jest + Supertest) | `npm --prefix server test -- tests/analytics_prd.test.js` | ❌ Wave 0 (`server/tests/analytics_prd.test.js`) |
| D-04 (RBAC invariant) | `FLEET_MANAGER` still receives `403` on `GET /api/v1/admin/overview` | Regression (Jest) | `npm --prefix server test -- tests/admin_control.test.js` | ✅ Existing |
| D-08, D-09 | `POST /api/v1/driver-hud/incidents` (`ROUTE_OBSTRUCTION`) auto-reoptimizes active route with `>=2` pending stops, locks `COMPLETED`/`FAILED` stops, anchors from `TelemetryPing`/incident, emits `route:reordered` + `route:updated`; skips when `<2` pending stops or non-obstruction | Integration (Jest + Supertest + Socket.IO check) | `npm --prefix server test -- tests/midshift_reoptimize.test.js` | ❌ Wave 0 (`server/tests/midshift_reoptimize.test.js`) |
| D-10 | `POST /api/v1/routes/:id/reoptimize` (`ADMIN`/`FLEET_MANAGER`, `403` for `DRIVER`, `400` for `COMPLETED`/`CANCELLED`) reorders pending stops under supplied `trafficScenario` | Integration (Jest + Supertest) | `npm --prefix server test -- tests/midshift_reoptimize.test.js` | ❌ Wave 0 (`server/tests/midshift_reoptimize.test.js`) |
| D-04, D-05, D-06, D-07, D-08 | TypeScript strict compilation & Vite production bundle across all edited React/TSX pages/modals | Static Typecheck + Build | `npm --prefix client test && npm --prefix client run build` | ✅ Existing (`client/tsconfig.json`) |

### Sampling Rate
- **Per task commit:** Targeted Jest test file (`npm --prefix server test -- tests/<file>.test.js`) or `npm --prefix client test`
- **Per wave merge:** Full backend suite (`npm --prefix server test`) + `npm --prefix client test && npm --prefix client run build`
- **Phase gate:** Full server suite (`23+` suites green, `0` failures) + clean `tsc --noEmit` + clean `vite build` + authored `.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md`

### Wave 0 Gaps
- [ ] Extend `server/tests/demo_data.test.js` with `TC-DEMO-3` covering `importDemoDataset` -> `optimizeRoutes` -> `dispatchRoute` -> `driverHud` secondary records -> `deleteDemoDataset` zero-orphan assertions
- [ ] Create `server/tests/analytics_prd.test.js` covering `GET /api/v1/admin/analytics` RBAC, empty-DB `0` fallbacks, `DRAFT` exclusion, Planned vs Actual `Route` vs `DriverShift` comparison, and 4 PRD KPIs
- [ ] Create `server/tests/midshift_reoptimize.test.js` covering `reoptimizeActiveRoute`, `HEAVY_TRAFFIC` multiplier, terminal stop locking, live `TelemetryPing` anchoring, `reportIncident` `ROUTE_OBSTRUCTION` auto-trigger (`>=2` vs `<2` pending stops), and `POST /api/v1/routes/:id/reoptimize`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | Existing JWT middleware `authenticate` in `server/src/middleware/auth.js` |
| V3 Session Management | No (unchanged) | Existing token lifecycle |
| V4 Access Control | Yes | `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)` on `GET /api/v1/admin/analytics` and `POST /api/v1/routes/:id/reoptimize`; keep `GET /api/v1/admin/overview` `ROLES.ADMIN` only; `AdminLayout.tsx` client redirect for `DRIVER` (UI defense-in-depth backed by server RBAC); `reportIncident` derives `driver` strictly from authenticated `req.user` (`resolveDriver`) |
| V5 Input Validation | Yes | Validate `trafficScenario` against `Object.values(TRAFFIC_SCENARIOS)` (fallback/400 on invalid), validate `mongoose.Types.ObjectId.isValid(id)` on `:id/reoptimize`, reject `COMPLETED`/`CANCELLED` route mutations with `400` |
| V6 Cryptography | No (unchanged) | Not touched in Phase 10 |

### Known Threat Patterns for Express + Mongoose + Socket.IO

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege Escalation on `/admin/analytics` or `/routes/:id/reoptimize` | Elevation of Privilege | Enforce `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)` middleware on both routes; verify `403` for `DRIVER` in Jest |
| Destructive Demo Purge Deleting Real Records (`deleteDemoDataset`) | Tampering / Integrity | Restrict `refClauses` strictly to IDs queried from `{ isDemoData: true }` root entities; assert real `User`/`Driver`/`Vehicle`/`Delivery`/`Route` survival in `demo_data.test.js` |
| Cross-Driver Route Hijack via `reportIncident` `routeId` | Tampering / BOLA | In `reportIncident`, resolve active route owned by `driver._id` (or verify `route.driverId.toString() === driver._id.toString()`) before invoking `reoptimizeActiveRoute` |

## Sources

### Primary (HIGH confidence — Direct Codebase Inspection)
- `.planning/phases/10-prd-completion-and-audit-closure/10-CONTEXT.md` — Locked decisions `D-01`–`D-10`
- `.planning/v4-MILESTONE-AUDIT.md` — Milestone 4 gaps & file/line citations
- `.planning/phases/09-operational-guards-and-validation-polish/09-UI-REVIEW.md` — Carbon & Zinc dark palette & left-bar micro-tag spec
- `.planning/phases/07-production-data-cleanup-and-demo-controls/07-PLAN.md` — Secondary model cleanup scope
- `server/src/services/demoDataService.js`, `server/src/controllers/routeController.js`, `server/src/services/dispatchEligibilityService.js`, `server/src/services/dispatch/dispatchExecutionService.js`, `server/src/services/auditService.js`
- `server/src/models/Route.js`, `AuditEvent.js`, `DeliveryEvent.js`, `DriverIncident.js`, `DriverShift.js`, `MaintenanceRecord.js`, `RouteAssignment.js`, `SystemNotification.js`, `TelemetryAlert.js`, `TelemetryPing.js`, `VehicleAssignment.js`, `VehicleChecklist.js`, `Delivery.js`, `Vehicle.js`, `DeliveryBatch.js`
- `server/src/controllers/adminController.js`, `driverHudController.js`, `driverController.js`, `server/src/routes/adminRoutes.js`, `routeRoutes.js`
- `server/src/services/savingsAnalyticsService.js`, `telemetryService.js`, `socketService.js`, `optimization/optimizerEngine.js`, `optimization/twoOpt.js`, `optimization/matrixBuilder.js`, `optimization/costScorer.js`, `mapping/simulatedTrafficService.js`, `server/src/config/constants.js`
- `client/src/pages/admin/AdminControlCenterPage.tsx`, `AnalyticsPage.tsx`, `TrackingPage.tsx`, `RoutePlannerPage.tsx`, `DriversPage.tsx`, `client/src/pages/BatchesPage.tsx`, `client/src/pages/driver/DriverSupportPage.tsx`, `DriverRoutePage.tsx`
- `client/src/components/layout/AdminLayout.tsx`, `DriverHeader.tsx`, `client/src/components/optimization/DispatchConfirmationModal.tsx`, `client/src/components/deliveries/CsvImportModal.tsx`, `client/src/components/driver/PODModal.tsx`
- `client/src/api/routeApi.ts`, `client/src/api/client.ts`, `client/src/context/DriverSocketContext.tsx`, `client/src/index.css`, `client/tailwind.config.js`
- `server/tests/demo_data.test.js`, `admin_control.test.js`, `shift_telemetry_savings.test.js`, `driver_hud.test.js`, `routes.test.js`, `server/jest.config.js`, `server/tests/setup.js`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all versions read directly from `package.json`
- Architecture: HIGH — every integration point, schema field, RBAC rule, and Socket.IO event verified in source
- Pitfalls: HIGH — uncovered concrete mismatches (`HEAVY_TRAFFIC` multiplier, `TC-ADMIN-RBAC-2` on `/admin/overview`, `SystemNotification` metadata IDs, `Route.baseline` missing `fuelConsumed`) directly from files

**Research date:** 2026-11-11
**Valid until:** 2026-12-11 (stable internal codebase)
