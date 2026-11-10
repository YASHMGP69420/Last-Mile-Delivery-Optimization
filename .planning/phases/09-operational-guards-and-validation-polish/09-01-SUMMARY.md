---
phase: 09-operational-guards-and-validation-polish
plan: 01
subsystem: api
tags: [mongoose, express, telemetry, odometer, fuel-caps, bola, driver-hud, jest]

# Dependency graph
requires:
  - phase: 08-driver-shift-odometer-and-savings
    provides: DriverShift telemetry fields, ShiftTelemetryModal unit auto-detection, and savingsAnalyticsService
provides:
  - Vehicle schema telemetry baselines (lastOdometerKm, lastFuelLitres, tankCapacityLitres)
  - VehicleChecklist fuelUnit enum ('L' | '%') with relaxed >100 L capacity support
  - MaintenanceRecord pre-validate guard for cost >= 0 and nextServiceDate >= serviceDate
  - Shared telemetryValidationService (getFuelUpperCap, validateOdometerContinuity, validateFuelLevel)
  - Hardened driverHudController shift, inspection, and terminal delivery mutation guards
  - Wave 0 backend integration suite server/tests/phase09_guards.test.js
affects: [09-02, 09-03, 09-04, 09-05]

# Actuals (#2632)
actuals:
  tokens: 9277
  tasks: 3
  commits: 3

commits: 3
plan_head_before: 5ebc2b87fc33d1a08a5d0b29862835e589d83a1f
plan_head_after: 02a09b4fdaccc9402836eb99950dfec7d79cfec0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized telemetryValidationService for tank cap resolution (custom > Truck 500 L > Bike/Van 200 L, EV 100%) and odometer continuity"
    - "assertDriverCanMutateDelivery helper combining BOLA ownership verification with terminal COMPLETED/FAILED state locking"

key-files:
  created:
    - server/src/services/telemetryValidationService.js
    - server/tests/phase09_guards.test.js
  modified:
    - server/src/models/Vehicle.js
    - server/src/models/VehicleChecklist.js
    - server/src/models/MaintenanceRecord.js
    - server/src/controllers/driverHudController.js

key-decisions:
  - "Compute endShift odometer baseline as Math.max(shift.startOdometerKm, vehicle.lastOdometerKm) so mid-shift inspections or prior baselines cannot be regressed on clock-out"
  - "Enforce assertDriverCanMutateDelivery immediately after loading Delivery in failDelivery (before failureReason enum check) so BOLA and terminal locks always fail fast with 403/400"

patterns-established:
  - "Telemetry Continuity: startShift, endShift, and submitVehicleCheck all validate >= vehicle.lastOdometerKm and persist lastOdometerKm + lastFuelLitres/batterySoC back to Vehicle"
  - "Delivery Mutation Guard: markDeliveryArrived, completeDelivery, and failDelivery share assertDriverCanMutateDelivery for BOLA + terminal COMPLETED/FAILED locks"

requirements-completed: [D-01, D-02, D-05, D-06, D-07, D-08, D-11, D-13, D-16]

coverage:
  - id: D1
    description: "Vehicle persists lastOdometerKm, lastFuelLitres, and optional tankCapacityLitres across shift start, shift end, and pre-trip vehicle checks"
    requirement: "D-01"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-01/D-02: Odometer continuity enforced across startShift, endShift, and submitVehicleCheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "Driver shift start, shift end, and pre-trip vehicle checks reject odometer readings lower than vehicle.lastOdometerKm with HTTP 400 INVALID_ODOMETER_READING"
    requirement: "D-02"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-01/D-02: Odometer continuity enforced across startShift, endShift, and submitVehicleCheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fuel upper-bound validation (custom tankCapacityLitres or 200 L Bike/Van, 500 L Truck, 100% EV) and mid-shift refuel persistence across shift and checklist endpoints"
    requirement: "D-06"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-05/D-06/D-07/D-08: Tank capacity caps, Truck 500 L inspection, EV 100% cap, and mid-shift refuel persistence"
        status: pass
    human_judgment: false
  - id: D4
    description: "Driver startShift blocked with HTTP 400 VEHICLE_UNAVAILABLE_FOR_SHIFT when assigned vehicle is MAINTENANCE or RETIRED"
    requirement: "D-11"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-11: startShift rejects vehicles in MAINTENANCE or RETIRED availability"
        status: pass
    human_judgment: false
  - id: D5
    description: "Driver delivery mutation endpoints enforce BOLA ownership and reject COMPLETED/FAILED deliveries with HTTP 400 DELIVERY_TERMINAL"
    requirement: "D-13"
    verification:
      - kind: integration
        ref: "server/tests/phase09_guards.test.js#D-13: Delivery execution endpoints enforce BOLA ownership and lock terminal COMPLETED/FAILED states"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-11-10
status: complete
---

# Phase 09 Plan 01: Telemetry Continuity & Driver Execution Guards Summary

**Vehicle telemetry baseline schemas, shared tank-cap & odometer continuity validators, MAINTENANCE/RETIRED shift clock-in blocks, and terminal delivery BOLA/state locks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-10T18:09:33Z
- **Completed:** 2026-11-10T18:13:21Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extended `Vehicle` with `lastOdometerKm`, `lastFuelLitres`, and `tankCapacityLitres`; updated `VehicleChecklist` with `fuelUnit` (`'L' | '%'`) without the hardcoded `max: 100` cap so Trucks/Vans can record litre levels above 100 L; added `pre('validate')` cost/date-range checks to `MaintenanceRecord`.
- Created `server/src/services/telemetryValidationService.js` (`getFuelUpperCap`, `validateOdometerContinuity`, `validateFuelLevel`) and wired it across `startShift`, `endShift`, and `submitVehicleCheck` in `driverHudController.js`.
- Added `VEHICLE_UNAVAILABLE_FOR_SHIFT` guard on `startShift` for `MAINTENANCE`/`RETIRED` vehicles, exposed `lastOdometerKm`/`lastFuelLitres`/`tankCapacityLitres` on `getDashboard`, and added `assertDriverCanMutateDelivery` to enforce BOLA (`403`) and terminal `COMPLETED`/`FAILED` locks (`400 DELIVERY_TERMINAL`) on `markDeliveryArrived`, `completeDelivery`, and `failDelivery`.
- Built Wave 0 integration suite `server/tests/phase09_guards.test.js` (5 test cases) and verified all 19 tests pass across `phase09_guards.test.js`, `driver_hud.test.js`, and `shift_telemetry_savings.test.js`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add vehicle telemetry & maintenance schema invariants and shared telemetryValidationService** - `125bb38` (feat)
2. **Task 2: Enforce odometer continuity, tank caps, vehicle readiness, and terminal delivery locks in driverHudController** - `4d52aa8` (feat)
3. **Task 3: Create Wave 0 integration tests in server/tests/phase09_guards.test.js covering D-01..D-08, D-11, and D-13** - `02a09b4` (test)

## Files Created/Modified
- `server/src/models/Vehicle.js` - Added `lastOdometerKm`, `lastFuelLitres`, and `tankCapacityLitres` optional fields
- `server/src/models/VehicleChecklist.js` - Removed `max: 100` on `fuelOrBatteryLevelPercent` and added `fuelUnit` (`['L', '%']`)
- `server/src/models/MaintenanceRecord.js` - Added `pre('validate')` guard for `cost >= 0` and `nextServiceDate >= serviceDate`
- `server/src/services/telemetryValidationService.js` - Shared tank capacity cap and odometer/fuel continuity validators
- `server/src/controllers/driverHudController.js` - Integrated telemetry persistence/validation, `MAINTENANCE`/`RETIRED` shift block, and `assertDriverCanMutateDelivery` BOLA + terminal lock
- `server/tests/phase09_guards.test.js` - Wave 0 integration test suite covering D-01..D-08, D-11, D-12, and D-13

## Decisions Made
- Computed `endShift` odometer baseline as `Math.max(shift.startOdometerKm, vehicle.lastOdometerKm)` so an intermediate pre-trip inspection or prior vehicle baseline cannot be regressed at shift close.
- Invoked `assertDriverCanMutateDelivery` immediately after loading `Delivery` in `failDelivery` (prior to `failureReason` validation) so unauthorized drivers and terminal deliveries always fail fast with `403 BOLA_VIOLATION` / `400 DELIVERY_TERMINAL`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Vehicle telemetry baseline fields, shared validation service, and Wave 0 operational guard tests are in place and passing.
- Ready for Phase 09 Wave 2 plans (`09-02` through `09-04`) covering fleet/driver/maintenance resource guards, consignment create/edit parity, CSV/batch guards, and frontend Driver/Admin UI wiring.

## Self-Check: PASSED

- Verified created/modified files exist on disk (`Vehicle.js`, `VehicleChecklist.js`, `MaintenanceRecord.js`, `telemetryValidationService.js`, `driverHudController.js`, `phase09_guards.test.js`).
- Verified commits `125bb38`, `4d52aa8`, and `02a09b4` are ancestors of `HEAD`.
- Verified Jest run (`phase09_guards.test.js`, `driver_hud.test.js`, `shift_telemetry_savings.test.js`): 3/3 suites, 19/19 tests passed.

---
*Phase: 09-operational-guards-and-validation-polish*
*Completed: 2026-11-10*
