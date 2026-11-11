---
phase: 10-prd-completion-and-audit-closure
plan: 03
subsystem: api
tags: [express, mongoose, analytics, prd-kpis, rbac, jest, supertest]

# Dependency graph
requires:
  - phase: 08-driver-shift-odometer-and-savings
    provides: savingsAnalyticsService.getFleetSavingsSummary() and DriverShift odometer/fuel telemetry
provides:
  - getAnalyticsSummary() aggregating PRD KPIs, synchronized fleet savings, and Planned vs Actual Route vs DriverShift comparison
  - GET /api/v1/admin/analytics endpoint authorized for ADMIN and FLEET_MANAGER while preserving ADMIN-only /api/v1/admin/overview
  - Wave 0 integration test suite server/tests/analytics_prd.test.js (TC-ANALYTICS-PRD-1..3)
affects:
  - 10-05-PLAN (AdminControlCenterPage FLEET_MANAGER sync and AnalyticsPage PRD KPIs + Planned vs Actual UI)

# Actuals (#2632) & Measured Commit Ledger (#3968)
actuals:
  tokens: 5726
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 4e1eab8713668b0ca86ab1acdb498f1264645b4f
plan_head_after: d63c5f25eae3bf4ce62126db0680abcf5aa84724

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared analytics endpoint above ADMIN barrier: mount GET /analytics with authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER) before router.use(authorize(ROLES.ADMIN)) to preserve TC-ADMIN-RBAC-2 on /overview"
    - "Single source of truth for savings: getAnalyticsSummary() composes getFleetSavingsSummary() and scoreRouteCost() while filtering DRAFT and CANCELLED routes"

key-files:
  created:
    - server/tests/analytics_prd.test.js
  modified:
    - server/src/services/savingsAnalyticsService.js
    - server/src/controllers/adminController.js
    - server/src/routes/adminRoutes.js

key-decisions:
  - "Mount GET /api/v1/admin/analytics above router.use(authorize(ROLES.ADMIN)) for ADMIN and FLEET_MANAGER instead of relaxing /api/v1/admin/overview RBAC"
  - "Return honest 0/null fallbacks when DB has no completed deliveries, routes, or shifts (averageDeliveryTimeMin: null, onTimeDeliveryRatePct: 0, hasResolvedDeliveries: false)"
  - "Compute plannedBaselineFuelLitres via scoreRouteCost(baseline.totalDistanceKm, vehicleId) since Route.baseline schema omits fuelConsumed"

patterns-established:
  - "Non-draft route filtering: PRD KPIs and operating costs include only OPTIMIZED, DISPATCHED, IN_PROGRESS, and COMPLETED routes while Planned vs Actual compares ACTIVE_SAVINGS_ROUTE_STATUSES against COMPLETED DriverShift records"

requirements-completed:
  - D-04
  - D-06
  - D-07

coverage:
  - id: D1
    description: "GET /api/v1/admin/analytics accessible to ADMIN and FLEET_MANAGER, returns 403 for DRIVER, and keeps /admin/overview ADMIN-only"
    requirement: "D-04"
    verification:
      - kind: integration
        ref: "TC-ANALYTICS-PRD-1 and TC-ADMIN-RBAC-2 in tests/analytics_prd.test.js & tests/admin_control.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty DB returns clean 0/null fallbacks and DRAFT routes are excluded from savings, cost, and Planned vs Actual totals"
    requirement: "D-04, D-06"
    verification:
      - kind: integration
        ref: "TC-ANALYTICS-PRD-2 in tests/analytics_prd.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "PRD KPIs (averageDeliveryTimeMin, fuelCostPerDeliveryInr, routeEfficiencyScorePct, vehicleUtilizationRatePct) and Planned vs Actual (Route vs DriverShift) match real DB records"
    requirement: "D-06, D-07"
    verification:
      - kind: integration
        ref: "TC-ANALYTICS-PRD-3 in tests/analytics_prd.test.js and full suite npm --prefix server test (24/24 suites, 280/280 tests passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-11-11
status: complete
---

# Phase 10 Plan 03: Backend Analytics Aggregation & PRD KPIs Summary

**Shared `GET /api/v1/admin/analytics` endpoint (`ADMIN` + `FLEET_MANAGER`) backed by `getAnalyticsSummary()` returning synchronized fleet savings, PRD KPIs, and Planned vs Actual (`Route` vs `DriverShift`) metrics while keeping `/admin/overview` strictly `ADMIN`-only.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-10T20:37:54Z
- **Completed:** 2026-11-10T20:45:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented `getAnalyticsSummary()` in `server/src/services/savingsAnalyticsService.js` composing `getFleetSavingsSummary()` and `scoreRouteCost()`, excluding `DRAFT` and `CANCELLED` routes, and computing `averageDeliveryTimeMin`, `avgPlannedStopDurationMin`, `fuelCostPerDeliveryInr`, `routeEfficiencyScorePct`, `costEfficiencyPct`, `vehicleUtilizationRatePct`, `cargoLoadPct`, `totalCo2AvoidedKg`, `plannedVsActual`, `zoneBreakdown`, `propulsionBreakdown`, and `counts`.
- Added `exports.getAnalytics` in `server/src/controllers/adminController.js` and mounted `GET /api/v1/admin/analytics` in `server/src/routes/adminRoutes.js` with `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)` directly above the `router.use(authorize(ROLES.ADMIN))` barrier.
- Created Wave 0 integration test suite `server/tests/analytics_prd.test.js` (`TC-ANALYTICS-PRD-1..3`) covering RBAC, empty DB `0`/`null` fallbacks, `DRAFT` exclusion, PRD KPIs, fleet savings synchronization, and Planned vs Actual (`Route` vs `DriverShift`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build getAnalyticsSummary in savingsAnalyticsService and expose GET /api/v1/admin/analytics (ADMIN + FLEET_MANAGER)** - `d86ac85` (feat)
2. **Task 2: Create Wave 0 integration tests in server/tests/analytics_prd.test.js** - `d63c5f2` (test)

**Plan metadata:** recorded in final docs commit (see git log)

## Files Created/Modified
- `server/src/services/savingsAnalyticsService.js` - Added `getAnalyticsSummary()` and `NON_DRAFT_ROUTE_STATUSES`
- `server/src/controllers/adminController.js` - Added `exports.getAnalytics` HTTP handler
- `server/src/routes/adminRoutes.js` - Mounted `GET /analytics` for `ADMIN` and `FLEET_MANAGER` above `ADMIN` barrier
- `server/tests/analytics_prd.test.js` - Created Wave 0 integration test suite (`TC-ANALYTICS-PRD-1..3`)

## Decisions Made
- Placed `GET /api/v1/admin/analytics` above `router.use(authorize(ROLES.ADMIN))` so `FLEET_MANAGER` and `ADMIN` access shared analytics while `GET /api/v1/admin/overview` stays strictly `ADMIN`-only (`T-10-03`, `T-10-04`).
- Returned `onTimeDeliveryRatePct: 0` with `hasResolvedDeliveries: false` and `averageDeliveryTimeMin: null` when no completed/failed deliveries exist so dashboards never fabricate synthetic `100%` metrics.
- Derived `plannedVsActual.plannedBaselineFuelLitres` using `scoreRouteCost(r.baseline.totalDistanceKm, r.vehicleId)` rather than reading an unpersisted baseline fuel field on `Route`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial run of `TC-ANALYTICS-PRD-3` failed Mongoose validation on `DeliveryBatch.create` due to missing required `code`, `name`, `date` fields and `'DISPATCHED'` status enum; updated test fixture to valid `DeliveryBatch` schema fields (`code`, `name`, `date`, `status: 'IN_PROGRESS'`).
- One full-suite run encountered a transient CPU-load timing flake in pre-existing `tests/adversarial_csv_batch.test.js` (`ADV-CSV-5` took `6302 ms` vs `< 6000 ms`); re-running `adversarial_csv_batch.test.js` (`5114 ms`) and the full server Jest suite both passed cleanly (`24/24` suites, `280/280` tests).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GET /api/v1/admin/analytics` is live and verified for both `ADMIN` and `FLEET_MANAGER`.
- Ready for Plan `10-05` (`AdminControlCenterPage.tsx` `FLEET_MANAGER` savings sync and `AnalyticsPage.tsx` PRD KPIs + Planned vs Actual UI).

## Self-Check: PASSED

- Verified all created/modified files exist on disk (`server/src/services/savingsAnalyticsService.js`, `server/src/controllers/adminController.js`, `server/src/routes/adminRoutes.js`, `server/tests/analytics_prd.test.js`).
- Verified commits `d86ac85` and `d63c5f2` are ancestors of `HEAD`.
- Targeted verification (`tests/analytics_prd.test.js`, `tests/admin_control.test.js`, `tests/shift_telemetry_savings.test.js`: 3/3 suites, 20/20 tests passed) and full server Jest suite (`npm --prefix server test`: 24/24 suites, 280/280 tests passed) passed after final edits.

---
*Phase: 10-prd-completion-and-audit-closure*
*Completed: 2026-11-11*
