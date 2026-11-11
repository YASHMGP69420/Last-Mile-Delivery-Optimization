# Phase 10: Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the critical cross-phase gaps identified in the Milestone 4 audit (`v4-MILESTONE-AUDIT.md`) and fulfill the remaining functional & KPI requirements from the original Unified Mentor Smart Route Optimization PRD:
1. Eliminate the Phase 07 demo route/event cleanup orphan leak and formalize `07-VERIFICATION.md`, sync Fleet Manager Control Center savings, enforce `DRIVER` role redirect in `AdminLayout`, clean dead `RoutesApi.reset`, and finish dark-mode alert contrast fixes on secondary modals.
2. Complete all PRD KPIs and Planned vs Actual comparison on `AnalyticsPage.tsx` using real MongoDB `Route`, `Delivery`, `Vehicle`, and Phase 08 `DriverShift` telemetry.
3. Implement automatic mid-shift route recalculation on `DriverIncident` (`ROUTE_OBSTRUCTION` traffic/closure incidents) plus dispatcher-accessible `POST /api/v1/routes/:id/reoptimize`.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Demo Cleanup & Milestone 4 Audit Fixes
- **D-01:** Add `isDemoData: { type: Boolean, default: false, index: true }` to all secondary operational schemas (`DeliveryEvent`, `DriverIncident`, `DriverShift`, `MaintenanceRecord`, `RouteAssignment`, `SystemNotification`, `TelemetryAlert`, `TelemetryPing`, `VehicleAssignment`, `VehicleChecklist`), and propagate `isDemoData: Boolean(batch?.isDemoData)` onto `Route` documents created by `routeController.optimizeRoutes` and `dispatchEligibilityService.createOrUpdateRouteFromSequence`.
- **D-02:** Harden `demoDataService.deleteDemoDataset()` to purge `Route` by `{ $or: [{ isDemoData: true }, { batchId: { $in: demoBatchIds } }, { driverId: { $in: demoDriverIds } }, { vehicleId: { $in: demoVehicleIds } }] }` and purge `DeliveryEvent` and all 10 secondary collections using both `isDemoData: true` and demo entity reference clauses, so zero orphaned demo records remain even after demo batches are optimized/dispatched.
- **D-03:** Author and verify `.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md` backed by automated Jest integration tests verifying `importDemoDataset` -> `optimizeRoutes` -> `dispatchRoute` -> `deleteDemoDataset` leaves zero orphan `Route` or `DeliveryEvent` records.
- **D-04:** Update `AdminControlCenterPage.tsx` (`FLEET_MANAGER` branch) to exclude `DRAFT` routes from savings totals and compute `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, and `actualFuelUsedLitres` consistently with `/admin/overview`.
- **D-05:** Redirect `user.role === 'DRIVER'` away from `/admin/*` back to `/driver` in `client/src/components/layout/AdminLayout.tsx`, remove dead `RoutesApi.reset` in `client/src/api/routeApi.ts`, fix light-only alert boxes (`bg-blue-50`/`bg-amber-50`/`bg-red-50`/`bg-emerald-50` -> Carbon & Zinc dark-compatible classes) across `RoutePlannerPage.tsx`, `DispatchConfirmationModal.tsx`, `CsvImportModal.tsx`, `DriverHeader.tsx`, `PODModal.tsx`, and `DriversPage.tsx`, and convert the remaining `rounded-full` button in `BatchesPage.tsx` (`handleRemoveDelivery` / delete chip) to `rounded-lg`.

### Area 2: PRD Analytics KPIs & Planned vs Actual (`AnalyticsPage.tsx`)
- **D-06:** Extend Analytics metrics (backend `adminController` or aggregated analytics endpoint / clean client derivation from real DB documents) to surface all remaining PRD KPIs honestly with `0`/`—` fallbacks when empty (zero synthetic data):
  - **Average Delivery Time** (computed from real completed delivery duration / active route ETA deltas)
  - **Fuel Cost per Delivery** (`totalOperatingCostInr / completedDeliveries` or `totalDeliveries`, `₹0` when 0)
  - **Route Efficiency Score** (`%` distance/cost efficiency across optimized non-draft routes)
  - **Vehicle Utilization Rate** (`(ASSIGNED + IN_TRANSIT vehicles) / total non-retired vehicles` + active cargo utilization context)
- **D-07:** Add a **Planned vs Actual Performance** section on `AnalyticsPage.tsx` comparing planned route baseline/optimized metrics (`Route.metrics.distanceKm`, `Route.metrics.fuelLitres`, `Route.metrics.costInr`) against actual Phase 08 `DriverShift` odometer distance and fuel/charge consumption (`actualDistanceKm`, `actualFuelOrChargeUsed`), cleanly showing `0` / awaiting shift telemetry when no closed shifts exist.

### Area 3: Automatic Mid-Shift Route Recalculation (`DriverIncident` Traffic/Closure Reroute)
- **D-08:** Implement a reusable active-route re-optimization service (`reoptimizeActiveRoute`) that locks already terminal stops (`COMPLETED`, `FAILED`) in sequence, anchors from the vehicle's latest live GPS telemetry coordinates (falling back to incident coordinates or depot hub), recalculates ETA and pending stop ordering using the updated traffic scenario (`HEAVY_TRAFFIC` or supplied scenario) via nearest-neighbor + 2-Opt, persists updated `stops`, `metrics`, and `trafficScenario` on the `Route` document, and emits `route:reordered` + `route:updated` via Socket.IO so Driver Handheld (`DriverSocketContext`) and Admin Tracking update live.
- **D-09:** Automatically invoke `reoptimizeActiveRoute` inside `driverHudController.reportIncident` whenever a driver with an active `DISPATCHED`/`IN_PROGRESS` route reports a `ROUTE_OBSTRUCTION` incident (road closure, severe congestion, or traffic obstruction) with `>= 2` pending stops remaining, returning the updated stop count / reroute status in the `reportIncident` response and broadcasting a system alert to Fleet Operations.
- **D-10:** Also expose `POST /api/v1/routes/:id/reoptimize` (`ADMIN` / `FLEET_MANAGER`) using the same `reoptimizeActiveRoute` service so dispatchers can manually trigger traffic-scenario re-optimization on active routes if desired (`D-08` reuse).

### the agent's Discretion
- Exact chart/card layout grid on `AnalyticsPage.tsx` following the Industrial Carbon & Zinc dark palette (`09-UI-REVIEW.md`) and crisp `rounded-[4px]` left-bar micro-tags.
- Whether `AnalyticsPage.tsx` fetches shift aggregates from `/admin/overview` or a dedicated lightweight `/admin/analytics` endpoint (prefer extending `/admin/overview` or existing endpoints cleanly without breaking existing consumers).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Audit & Design Specs
- `.planning/v4-MILESTONE-AUDIT.md` — Exact integration gaps, `BLOCKER` file/line citations, and secondary modal contrast items
- `.planning/phases/09-operational-guards-and-validation-polish/09-UI-REVIEW.md` — Industrial Carbon & Zinc palette (`#0B0C0E`, `#121417`, `#262A32`, `#14B8A6`) and crisp left-bar micro-tag conventions
- `.planning/phases/07-production-data-cleanup-and-demo-controls/07-PLAN.md` — Original secondary model `isDemoData` tagging & cleanup spec
- `.planning/phases/08-driver-shift-odometer-and-savings/08-CONTEXT.md` — Shift odometer & fuel/charge aggregation source of truth

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/optimization/optimizerEngine.js` & `twoOpt.js`: Existing optimization heuristics usable by `reoptimizeActiveRoute` for pending stops.
- `server/src/services/savingsAnalyticsService.js`: Existing Phase 08 shift telemetry (`actualDistanceKm`, `actualFuelOrChargeUsed`) aggregator.
- `server/src/services/socketService.js` (`emitRouteReordered`, `emitTelemetryAlert`) & `DriverSocketContext.tsx` (`route:reordered` listener): Live WebSocket broadcast + Driver Handheld refresh already wired.

### Integration Points
- `server/src/services/demoDataService.js`, `routeController.js`, `dispatchEligibilityService.js`, and 10 secondary Mongoose models (`DeliveryEvent`, `DriverIncident`, `DriverShift`, `MaintenanceRecord`, `RouteAssignment`, `SystemNotification`, `TelemetryAlert`, `TelemetryPing`, `VehicleAssignment`, `VehicleChecklist`).
- `server/src/controllers/driverHudController.js` (`reportIncident`) and `server/src/routes/routeRoutes.js` (`POST /:id/reoptimize`).
- `client/src/pages/admin/AdminControlCenterPage.tsx`, `AnalyticsPage.tsx`, `client/src/components/layout/AdminLayout.tsx`, `client/src/api/routeApi.ts`, and secondary modal alert classes.

</code_context>

<specifics>
## Specific Ideas

- Triggered directly by original Unified Mentor PRD parity review + Milestone 4 audit (`1, 2, 3 for now`).
- Automated mid-shift recalculation on `DriverIncident` (`ROUTE_OBSTRUCTION`) keeps field drivers automatically routed around traffic/road closures without manual dispatcher lag.

</specifics>

<deferred>
## Deferred Ideas

- **README rewrite & Live Deployment Setup (`#4`)**: Updating `README.md` (fixing stale `5174` port, `151` test count, deleted `admin@example.com` demo credentials) and adding Render/Vercel/Docker deployment manifests & live deployed link for final evaluation — deferred to dedicated deployment step.
- **Admin User Management UI for `D-17`**: Backend Last-Admin protection is tested in Jest; Admin User Management frontend UI remains unscheduled unless needed.
- **Delivery POD & strict OTP verification checks**: Deferred from Phase 09.

</deferred>

---

*Phase: 10-Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization*
*Context gathered: 2026-11-11*
