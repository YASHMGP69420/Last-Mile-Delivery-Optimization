---
phase: 09-operational-guards-and-validation-polish
plan: 03
subsystem: api
tags: [express, mongoose, fleet, drivers, csv, resource-guards, jest]

# Dependency graph
requires:
  - phase: 09-operational-guards-and-validation-polish
    provides: Vehicle telemetry baseline fields (lastOdometerKm, lastFuelLitres, tankCapacityLitres) and Wave 0 phase09_guards.test.js
provides:
  - Shared resourceGuardService (assertNoActiveDriverOrVehicleOperations) returning 409 ACTIVE_OPERATION_CONFLICT
  - Admin lastOdometerKm downward override, tankCapacityLitres & positive spec validation, retire lock, and maintenance cost/date validation in vehicleController
  - 1:1 pairing active-operation guards across current and prior paired vehicles/drivers, input normalization, and shared phone validation (createDriver & updateDriver) in driverController
  - Vehicle CSV trim+uppercase normalization, numeric spec checks, dry-run DB collision detection, and atomic 422 commit rejection in csvVehicleImportService
  - Extended integration tests in server/tests/phase09_guards.test.js
affects: [09-05]

# Actuals (#2632)
actuals:
  tokens: 16877
  tasks: 2
  commits: 4

commits: 4
plan_head_before: f0530da60b05e6829a2fac70d72bc2591a215ecf
plan_head_after: cba9e293f980a9f750653b7ce7aefa8ed3e2fa10

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared assertNoActiveDriverOrVehicleOperations({ driverIds, vehicleIds, actionLabel }) querying DriverShift (IN_PROGRESS) and Route (DISPATCHED/IN_PROGRESS)"
    - "Shared validateAndNormalizePhone helper enforced in both driverController.createDriver and driverController.updateDriver"
    - "Pre-insert full-file validation + MongoDB $in collision check in csvVehicleImportService so dryRun=true surfaces DB duplicates and dryRun=false fails atomically with 422"

key-files:
  created:
    - server/src/services/resourceGuardService.js
  modified:
    - server/src/controllers/vehicleController.js
    - server/src/controllers/driverController.js
    - server/src/services/csvVehicleImportService.js
    - server/tests/phase09_guards.test.js

key-decisions:
  - "Checked IN_TRANSIT status guards (409 VEHICLE_IN_ACTIVE_TRANSIT / DRIVER_IN_ACTIVE_TRANSIT) ahead of assertNoActiveDriverOrVehicleOperations (409 ACTIVE_OPERATION_CONFLICT) in driverController so existing TC-ADV-FLEET-2 behavior remains unchanged while active shifts/routes without IN_TRANSIT status are also blocked"
  - "Validated all vehicle CSV rows against MongoDB Vehicle.vehicleId before inserting any record in processVehicleCsv so dryRun=false aborts atomically with HTTP 422 and zero partial writes"

patterns-established:
  - "Active-Operation Resource Interlock: vehicle retirement/deletion and driver 1:1 assign/unassign check both DriverShift (IN_PROGRESS) and Route (DISPATCHED, IN_PROGRESS) across all involved current and prior records"
  - "Admin Odometer Override vs Driver Continuity: PUT /vehicles/:id permits setting lastOdometerKm to any finite number >= 0 (including downward typo corrections), while driver shift/check endpoints strictly enforce >= lastOdometerKm"

requirements-completed: [D-01, D-03, D-06, D-12, D-14, D-16]

coverage:
  - id: D1
    description: "Vehicle create/update supports lastOdometerKm baseline and tankCapacityLitres while rejecting negative/non-positive specs; Admin/Fleet Manager can lower lastOdometerKm to correct driver typos"
    requirement: "D-03"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-03/D-06/D-16: Admin can override lastOdometerKm downward and set tankCapacityLitres while negative/zero vehicle specs are rejected"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vehicle retirement/deletion and driver 1:1 assign/unassign across current and prior paired records are blocked with 409 ACTIVE_OPERATION_CONFLICT during IN_PROGRESS shifts or DISPATCHED/IN_PROGRESS routes"
    requirement: "D-12"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-12: Blocks vehicle retire/delete and driver re-pairing with 409 ACTIVE_OPERATION_CONFLICT during active shift or route, and validates maintenance endpoint"
        status: pass
      - kind: integration
        ref: "server/tests/fleet.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Maintenance endpoint rejects cost < 0 (400 INVALID_MAINTENANCE_COST) and nextServiceDate < serviceDate (400 INVALID_SERVICE_DATE_RANGE)"
    requirement: "D-12"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-12: Blocks vehicle retire/delete and driver re-pairing with 409 ACTIVE_OPERATION_CONFLICT during active shift or route, and validates maintenance endpoint"
        status: pass
    human_judgment: false
  - id: D4
    description: "driverController normalizes name/email/licenseNumber/phone and validates 10-15 digit phone format in both createDriver and updateDriver"
    requirement: "D-16"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-16: driverController normalizes inputs and validates phone format on createDriver and updateDriver"
        status: pass
    human_judgment: false
  - id: D5
    description: "csvVehicleImportService normalizes vehicleId (trim + uppercase), validates positive/non-negative specs, flags DB collisions in dryRun=true, and aborts live import atomically with 422 on errors"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-14: Vehicle CSV dryRun normalizes vehicleId, validates positive/non-negative specs, and flags DB collisions atomically"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-10
status: complete
---

# Phase 09 Plan 03: Fleet/Driver Safety Interlocks, Admin Odometer Override & Vehicle CSV Guards Summary

**Shared `resourceGuardService` active-shift/route interlocks (`409 ACTIVE_OPERATION_CONFLICT`), Admin `lastOdometerKm` typo override & positive vehicle/maintenance validation, driver phone validation parity, and vehicle CSV dry-run DB duplicate detection**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-10T18:23:28Z
- **Completed:** 2026-11-10T18:29:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `server/src/services/resourceGuardService.js` exporting `assertNoActiveDriverOrVehicleOperations` to query `DriverShift` (`IN_PROGRESS`) and `Route` (`DISPATCHED`, `IN_PROGRESS`) across deduplicated driver and vehicle IDs, throwing `409 ACTIVE_OPERATION_CONFLICT`.
- Hardened `server/src/controllers/vehicleController.js`: normalized `vehicleId` (trim+uppercase) and `makeModel` (trim), enforced strictly positive `capacityKg`, `capacityM3`, `tankCapacityLitres`, `kmPerLitre`, and `energyKWhPerKm`, added Admin/Fleet Manager `lastOdometerKm >= 0` override support on `updateVehicle` (per D-03), protected vehicle retirement/deletion (`PUT` to `RETIRED` and `DELETE`) with `assertNoActiveDriverOrVehicleOperations`, and added `INVALID_MAINTENANCE_COST` / `INVALID_SERVICE_DATE_RANGE` checks on `logMaintenance`.
- Hardened `server/src/controllers/driverController.js`: added shared `validateAndNormalizePhone` used in both `createDriver` and `updateDriver` (Plan-Checker Advisory Note), normalized `name`, `email`, and `licenseNumber`, and wired `assertNoActiveDriverOrVehicleOperations` across all current and prior paired driver/vehicle records in `assignVehicle` and `unassignVehicle`.
- Upgraded `server/src/services/csvVehicleImportService.js` to trim+uppercase `vehicleId`, validate `capacityKg`, `capacityM3`, `tankCapacityLitres`, `lastOdometerKm`, `kmPerLitre`, and `energyKWhPerKm`, flag MongoDB `Vehicle.vehicleId` collisions in `dryRun: true`, persist optional telemetry/capacity fields, and throw `422` atomically with zero partial writes when `dryRun: false` encounters any error.
- Extended `server/tests/phase09_guards.test.js` (now 9 tests) and verified all 3 required suites (`phase09_guards.test.js`, `fleet.test.js`, `adversarial_csv_batch.test.js` — 37/37 tests) plus `adversarial.test.js` (20/20 tests) pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resourceGuardService and harden vehicleController & driverController** - `529cae2` (feat)
2. **Task 2: Upgrade csvVehicleImportService dry-run DB duplicate detection and extend phase09_guards.test.js** - `cba9e29` (feat)

_Note: Parallel Wave 2 Plan `09-04` executed concurrently on the main branch (`320d441`, `4cbf522`), so `git rev-list --count plan_head_before..plan_head_after` across `f0530da..cba9e29` measures 4 total commits._

## Files Created/Modified
- `server/src/services/resourceGuardService.js` - Shared `assertNoActiveDriverOrVehicleOperations` guard for `IN_PROGRESS` shifts and `DISPATCHED`/`IN_PROGRESS` routes
- `server/src/controllers/vehicleController.js` - Vehicle spec validation, Admin `lastOdometerKm` override, `tankCapacityLitres` persistence, active-operation retirement lock, and maintenance cost/date validation
- `server/src/controllers/driverController.js` - Input normalization, shared `validateAndNormalizePhone` on `createDriver` and `updateDriver`, and cross-entity active-operation pairing guards on `assignVehicle`/`unassignVehicle`
- `server/src/services/csvVehicleImportService.js` - `trim().toUpperCase()` plate normalization, numeric spec bounds, dry-run MongoDB duplicate detection, and atomic `422` rejection on invalid live commit
- `server/tests/phase09_guards.test.js` - Added integration tests covering D-03, D-06, D-12, D-14 (vehicle CSV), and D-16

## Decisions Made
- Evaluated `IN_TRANSIT` availability checks (`409 VEHICLE_IN_ACTIVE_TRANSIT` / `DRIVER_IN_ACTIVE_TRANSIT`) before `assertNoActiveDriverOrVehicleOperations` (`409 ACTIVE_OPERATION_CONFLICT`) in `driverController.js` so existing `TC-ADV-FLEET-2` assertions remain exact while clocked-in/dispatched pairings without `IN_TRANSIT` status are also guarded.
- Validated all vehicle CSV rows and DB `vehicleId` collisions before persisting any `Vehicle` document in `csvVehicleImportService.processVehicleCsv` so `dryRun: false` fails atomically with `422` without partial inserts.

## Deviations from Plan

None - plan executed as written, incorporating the plan-checker advisory note to enforce phone format validation in both `createDriver` and `updateDriver`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Fleet/driver resource interlocks, vehicle spec/maintenance guards, and vehicle CSV dry-run DB collision checks are verified and ready for Plan `09-05` Admin Fleet UI integration.

## Self-Check: PASSED

- Verified created/modified files exist on disk (`resourceGuardService.js`, `vehicleController.js`, `driverController.js`, `csvVehicleImportService.js`, `phase09_guards.test.js`).
- Verified task commits `529cae2` and `cba9e29` are ancestors of `HEAD`.
- Verified Jest run (`tests/phase09_guards.test.js`, `tests/fleet.test.js`, `tests/adversarial_csv_batch.test.js`): 3/3 suites, 37/37 tests passed (`adversarial.test.js` 20/20 also passed after Task 1).

---
*Phase: 09-operational-guards-and-validation-polish*
*Completed: 2026-11-10*
