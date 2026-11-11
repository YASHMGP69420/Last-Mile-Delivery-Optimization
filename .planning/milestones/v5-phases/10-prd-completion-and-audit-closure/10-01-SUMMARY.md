---
phase: 10-prd-completion-and-audit-closure
plan: 01
subsystem: database
tags: [mongoose, isDemoData, route-optimization, dispatch, audit-trail]

# Dependency graph
requires:
  - phase: 07-production-data-cleanup-and-demo-controls
    provides: Demo dataset import/delete lifecycle and primary entity isDemoData tagging
provides:
  - Indexed isDemoData boolean field (default false) on all 9 remaining secondary Mongoose operational schemas
  - Server-side isDemoData propagation across route optimization, direct dispatch sequence creation, dispatch execution assignments, and audit events
affects:
  - 10-02-PLAN (zero-orphan deleteDemoDataset cascade purge and 07-VERIFICATION.md)

# Actuals (#2632) & Measured Commit Ledger (#3968)
actuals:
  tokens: 2299
  tasks: 3
  commits: 3
commits: 3
plan_head_before: e91b68529b7394feb42db8c50ce487962034a82d
plan_head_after: eadc97e68feb85eb4ffae2c7a40869929352ddf5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side provenance propagation: derive isDemoData from persisted DB entities (batch, vehicle, driver, route) rather than client input"
    - "All secondary operational Mongoose models carry indexed isDemoData: { type: Boolean, default: false, index: true }"

key-files:
  created: []
  modified:
    - server/src/models/DriverIncident.js
    - server/src/models/DriverShift.js
    - server/src/models/MaintenanceRecord.js
    - server/src/models/RouteAssignment.js
    - server/src/models/SystemNotification.js
    - server/src/models/TelemetryAlert.js
    - server/src/models/TelemetryPing.js
    - server/src/models/VehicleAssignment.js
    - server/src/models/VehicleChecklist.js
    - server/src/controllers/routeController.js
    - server/src/services/dispatchEligibilityService.js
    - server/src/services/dispatch/dispatchExecutionService.js
    - server/src/services/auditService.js

key-decisions:
  - "Derive isDemoData strictly server-side from persisted batch, route, vehicle, and driver flags across optimizeRoutes, createOrUpdateRouteFromSequence, and executeDispatch"
  - "Preserve route.isDemoData = Boolean(batch?.isDemoData || route.isDemoData) when updating existing DRAFT routes during re-optimization"

patterns-established:
  - "Secondary model demo isolation: every operational Mongoose schema defines indexed isDemoData defaulting to false"
  - "Audit provenance: recordAuditEvent accepts optional isDemoData (default false) so route and dispatch events inherit demo flags"

requirements-completed:
  - D-01

coverage:
  - id: D1
    description: "All 9 remaining secondary Mongoose operational schemas define indexed isDemoData defaulting to false, alongside DeliveryEvent and Route"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "node schema path check across all 9 models + DeliveryEvent + Route (MODELS_BATCH_1_OK, MODELS_BATCH_2_OK)"
        status: pass
    human_judgment: false
  - id: D2
    description: "optimizeRoutes, createOrUpdateRouteFromSequence, executeDispatch, and recordAuditEvent propagate isDemoData onto Route, VehicleAssignment, RouteAssignment, and AuditEvent documents"
    requirement: "D-01"
    verification:
      - kind: integration
        ref: "npm --prefix server test -- tests/demo_data.test.js tests/routes.test.js (16/16 passed) and full suite npm --prefix server test (23/23 suites, 277/277 tests passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-11-11
status: complete
---

# Phase 10 Plan 01: Secondary Schema `isDemoData` Tagging & Route/Dispatch Propagation Summary

**Indexed `isDemoData` added across all 9 remaining secondary operational Mongoose schemas and propagated server-side from demo batches, vehicles, and drivers onto `Route`, `VehicleAssignment`, `RouteAssignment`, and `AuditEvent` documents.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-10T20:30:09Z
- **Completed:** 2026-11-10T20:35:07Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Added `isDemoData: { type: Boolean, default: false, index: true }` to `DriverIncident`, `DriverShift`, `MaintenanceRecord`, `RouteAssignment`, `SystemNotification`, `TelemetryAlert`, `TelemetryPing`, `VehicleAssignment`, and `VehicleChecklist` (matching `AuditEvent`/`DeliveryEvent` and `Route`).
- Extended `auditService.recordAuditEvent` with optional `isDemoData = false` persisted as `Boolean(isDemoData)` on `AuditEvent`.
- Updated `routeController.optimizeRoutes` and `dispatchEligibilityService.createOrUpdateRouteFromSequence` to inherit `isDemoData` from persisted `batch` (and `vehicle`/`driver` in sequence creation) onto created and updated `Route` documents and optimization `AuditEvent` records.
- Updated `dispatchExecutionService.executeDispatch` to compute `isDemo` from `route`, `targetBatch`, `vehicle`, and `driver`, persisting it onto `Route`, `VehicleAssignment`, `RouteAssignment`, and the `ROUTE_DISPATCHED` `AuditEvent`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isDemoData schema field to first 5 secondary operational models** - `39184b0` (feat)
2. **Task 2: Add isDemoData schema field to remaining 4 secondary models** - `c21c3cb` (feat)
3. **Task 3: Propagate isDemoData onto Route, Assignment, and AuditEvent documents during optimization and dispatch** - `eadc97e` (feat)

**Plan metadata:** recorded in final docs commit (see git log)

## Files Created/Modified
- `server/src/models/DriverIncident.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/DriverShift.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/MaintenanceRecord.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/RouteAssignment.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/SystemNotification.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/TelemetryAlert.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/TelemetryPing.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/VehicleAssignment.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/models/VehicleChecklist.js` - Added indexed `isDemoData` boolean field defaulting to `false`
- `server/src/services/auditService.js` - Added optional `isDemoData = false` parameter to `recordAuditEvent`
- `server/src/controllers/routeController.js` - Propagated `batch?.isDemoData` onto `Route` and `recordAuditEvent` in `optimizeRoutes`
- `server/src/services/dispatchEligibilityService.js` - Propagated `batch`/`vehicle`/`driver` `isDemoData` onto `Route` in `createOrUpdateRouteFromSequence`
- `server/src/services/dispatch/dispatchExecutionService.js` - Propagated `isDemoData` across `Route`, `VehicleAssignment`, `RouteAssignment`, and `AuditEvent` in `executeDispatch`

## Decisions Made
- Derived `isDemoData` strictly server-side from persisted database entities (`batch.isDemoData`, `route.isDemoData`, `vehicle.isDemoData`, `driver.isDemoData`) to uphold threat mitigation `T-10-01`.
- Preserved existing `route.isDemoData` with logical OR (`Boolean(batch?.isDemoData || route.isDemoData)`) on the draft re-optimization `else` branch in `optimizeRoutes`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 10 secondary operational models (9 updated + `DeliveryEvent`/`AuditEvent`) and `Route` expose indexed `isDemoData` fields and inherit demo provenance during optimization and dispatch.
- Ready for Plan `10-02` (`deleteDemoDataset()` cascade purge hardening, `TC-DEMO-3`, and `07-VERIFICATION.md`).

## Self-Check: PASSED

- All 13 modified files verified present on disk and all 3 task commits (`39184b0`, `c21c3cb`, `eadc97e`) verified as ancestors of `HEAD`.
- Schema checks (`MODELS_BATCH_1_OK`, `MODELS_BATCH_2_OK`), targeted Jest suites (`tests/demo_data.test.js`, `tests/routes.test.js`: 16/16 passed), and full server Jest suite (`npm --prefix server test`: 23/23 suites, 277/277 tests passed) all passed after final edits.

---
*Phase: 10-prd-completion-and-audit-closure*
*Completed: 2026-11-11*
