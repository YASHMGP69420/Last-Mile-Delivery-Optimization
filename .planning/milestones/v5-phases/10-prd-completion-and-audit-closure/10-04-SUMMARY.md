---
phase: 10-prd-completion-and-audit-closure
plan: 04
subsystem: optimization
tags: [midshift-reoptimization, heavy-traffic, socket-io, incident-reroute, rbac, integration-tests]

# Dependency graph
requires:
  - phase: 10-prd-completion-and-audit-closure
    plan: 01
    provides: isDemoData field propagation across Route, DriverIncident, and SystemNotification
provides:
  - HEAVY_TRAFFIC (2.0x) traffic scenario and multiplier in constants.js
  - Dual route:reordered + route:updated Socket.IO broadcast in socketService.emitRouteReordered
  - Reusable reoptimizeActiveRoute service in server/src/services/optimization/activeRouteReoptimizer.js
  - Automatic mid-shift reroute trigger on ROUTE_OBSTRUCTION in driverHudController.reportIncident with anti-BOLA route ownership guard
  - Dispatcher-accessible POST /api/v1/routes/:id/reoptimize endpoint behind ADMIN/FLEET_MANAGER RBAC
  - Integration test suite server/tests/midshift_reoptimize.test.js (TC-REOPT-1..3)
affects:
  - Plan 10-05 frontend TrackingPage & DriverSupportPage live re-optimization integration

# Actuals (#2632) & Measured Commit Ledger (#3968)
actuals:
  tokens: 11241
  tasks: 3
  commits: 3
commits: 3
plan_head_before: e1192e67f0e2440f5e73049f4b3f1e56089e18f3
plan_head_after: 8350a37785e03124cd1feb079c7fb7a4bcb8015d

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Open-path mid-shift optimization: lock COMPLETED/FAILED stops at front, anchor from TelemetryPing -> incident coords -> last terminal stop -> depot, and evaluate Live Anchor -> pending stops -> Depot distance"
    - "Anti-BOLA incident route resolution: derive active route from authenticated req.user -> driver._id and require { _id: routeId, driverId: driver._id } match for explicit routeId overrides"
    - "Non-fatal automatic reroute wrapper: incident creation and safety alert persistence succeed even if auto-reoptimization skips or errors"

key-files:
  created:
    - server/src/services/optimization/activeRouteReoptimizer.js
    - server/tests/midshift_reoptimize.test.js
  modified:
    - server/src/config/constants.js
    - server/src/services/socketService.js
    - server/src/controllers/driverHudController.js
    - server/src/controllers/routeController.js
    - server/src/routes/routeRoutes.js

key-decisions:
  - "Evaluate open-path + return-to-depot distance across optimizer sequence, reverse orientation, and Nearest Neighbor in reoptimizeActiveRoute so closed-loop symmetry ties on 2+ pending stops never override a closer first stop from live GPS telemetry"
  - "Persist AuditEvent in reoptimizeActiveRoute only when an actor ID is present to keep direct service invocations cleanly non-blocking without AuditEvent actorId validation errors"

patterns-established:
  - "Mid-shift route mutation emits both route:reordered and route:updated identically to management, driver:{driverId}, and route:{routeId} rooms"

requirements-completed:
  - D-08
  - D-09
  - D-10

coverage:
  - id: D1
    description: "HEAVY_TRAFFIC (2.0x) multiplier and reoptimizeActiveRoute terminal-stop locking, live TelemetryPing anchoring, and dual Socket.IO emission"
    requirement: "D-08"
    verification:
      - kind: integration
        ref: "npm --prefix server test -- tests/midshift_reoptimize.test.js (TC-REOPT-1 passed) + node verify script (REOPT_CORE_OK 24 48)"
        status: pass
    human_judgment: false
  - id: D2
    description: "driverHudController.reportIncident auto-triggers reoptimizeActiveRoute on ROUTE_OBSTRUCTION with >=2 pending stops and anti-BOLA route derivation"
    requirement: "D-09"
    verification:
      - kind: integration
        ref: "npm --prefix server test -- tests/midshift_reoptimize.test.js tests/driver_hud.test.js (TC-REOPT-2 + TC-HUD-INC-1 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/v1/routes/:id/reoptimize enforces ADMIN/FLEET_MANAGER RBAC, ObjectId, trafficScenario, and immutable route status checks"
    requirement: "D-10"
    verification:
      - kind: integration
        ref: "npm --prefix server test -- tests/midshift_reoptimize.test.js tests/routes.test.js (TC-REOPT-3 + routes suite passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-11-11
status: complete
---

# Phase 10 Plan 04: Mid-Shift Route Recalculation, Incident Auto-Trigger & Manual Reoptimize Summary

**Implemented `HEAVY_TRAFFIC` (`2.0x`) scaling, reusable `reoptimizeActiveRoute` with terminal-stop locking and live GPS anchoring, dual `route:reordered`/`route:updated` Socket.IO broadcasts, automatic `ROUTE_OBSTRUCTION` rerouting in `reportIncident`, dispatcher `POST /api/v1/routes/:id/reoptimize`, and `TC-REOPT-1..3` integration tests.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-10T20:57:19Z
- **Completed:** 2026-11-10T21:04:34Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Added `TRAFFIC_SCENARIOS.HEAVY_TRAFFIC` and `TRAFFIC_MULTIPLIERS.HEAVY_TRAFFIC = 2.0` in `server/src/config/constants.js`, doubling travel duration vs `FREE_FLOW` (`48` min vs `24` min at 10 km).
- Updated `socketService.emitRouteReordered` in `server/src/services/socketService.js` to emit both `'route:reordered'` and `'route:updated'` to `'management'`, `driver:{driverId}`, and `route:{routeId}`.
- Built `server/src/services/optimization/activeRouteReoptimizer.js` exporting `reoptimizeActiveRoute`, which validates route mutability and `trafficScenario`, locks `COMPLETED`/`FAILED` stops at the front, anchors from `TelemetryPing` -> provided coordinates -> last terminal stop -> depot, re-sequences pending stops via `runRouteOptimization` + open-path-to-depot tie-breaking, recalculates leg distances/ETAs/metrics/deltas, increments `route.version`, and broadcasts live Socket.IO updates.
- Wired automatic re-optimization into `driverHudController.reportIncident` on `ROUTE_OBSTRUCTION` when `>= 2` non-terminal stops exist on the authenticated driver's active `DISPATCHED`/`IN_PROGRESS` route (with `{ _id: routeId, driverId: driver._id }` anti-BOLA ownership guard), creating a `FLEET_MANAGER` route notification and returning `data.reoptimization`.
- Added `routeController.reoptimizeRoute` and mounted `POST /api/v1/routes/:id/reoptimize` in `server/src/routes/routeRoutes.js` behind `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)`.
- Created `server/tests/midshift_reoptimize.test.js` (`TC-REOPT-1..3`) and verified both targeted suites (`3/3` suites, `29/29` tests) and the full server Jest suite (`25/25` suites, `284/284` tests).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HEAVY_TRAFFIC multiplier, dual Socket.IO broadcast, and activeRouteReoptimizer service** - `8902f52` (feat)
2. **Task 2: Auto-trigger reoptimizeActiveRoute on ROUTE_OBSTRUCTION and mount POST /api/v1/routes/:id/reoptimize** - `6a26f3c` (feat)
3. **Task 3: Create Wave 0 integration tests in server/tests/midshift_reoptimize.test.js** - `8350a37` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added open-path-to-depot tie-breaking for 2+ pending stops in `reoptimizeActiveRoute`**
- **Found during:** Task 1 (`activeRouteReoptimizer.js` implementation)
- **Issue:** `runRouteOptimization` evaluates a closed loop (`0 -> ... -> 0`) on symmetric road matrices, so a 2-stop pending subset ties between `[A, B]` and `[B, A]` and defaults to `ORIGINAL_ORDER` even when `B` is directly beside the live `TelemetryPing` anchor.
- **Fix:** After running `runRouteOptimization` (`AUTO`), evaluated open-path + return-to-depot distance across the optimizer sequence, its reverse orientation, and `constructNearestNeighborRoute` so closer first-leg stops from live GPS telemetry are prioritized without breaking 3+ stop 2-Opt improvements.
- **Files modified:** `server/src/services/optimization/activeRouteReoptimizer.js`
- **Commit:** `8902f52`

**2. [Rule 2 - Missing Critical Functionality] Guarded `recordAuditEvent` when `actor` is omitted**
- **Found during:** Task 1 (`activeRouteReoptimizer.js` implementation)
- **Issue:** `AuditEvent` requires `actorId`; direct calls to `reoptimizeActiveRoute` without an HTTP `req.user` actor would log Mongoose validation errors.
- **Fix:** Persist `AuditEvent` only when `actor?.id || actor?._id` is provided, while all HTTP-triggered calls (`reportIncident`, `reoptimizeRoute`) pass `req.user` and persist audit records normally.
- **Files modified:** `server/src/services/optimization/activeRouteReoptimizer.js`
- **Commit:** `8902f52`

## Verification

- `node -e "... calculateDuration(10, 'FREE_FLOW') ... calculateDuration(10, 'HEAVY_TRAFFIC') ..."` -> `REOPT_CORE_OK 24 48`
- `npm --prefix server test -- tests/midshift_reoptimize.test.js tests/driver_hud.test.js tests/routes.test.js` -> `3/3` suites passed, `29/29` tests passed
- `npm --prefix server test` -> `25/25` suites passed, `284/284` tests passed

## Self-Check: PASSED

- Verified all 7 created/modified files exist on disk (`constants.js`, `socketService.js`, `activeRouteReoptimizer.js`, `driverHudController.js`, `routeController.js`, `routeRoutes.js`, `midshift_reoptimize.test.js`).
- Verified all 3 task commits (`8902f52`, `6a26f3c`, `8350a37`) are ancestors of `HEAD`.

---
*Phase: 10-prd-completion-and-audit-closure*
*Completed: 2026-11-11*
