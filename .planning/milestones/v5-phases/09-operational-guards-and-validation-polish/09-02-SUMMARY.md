---
phase: 09-operational-guards-and-validation-polish
plan: 02
subsystem: api
tags: [express, mongoose, validation, batch, csv, rbac, last-admin, jest]

# Dependency graph
requires:
  - phase: 04-state-sync-and-cleanup
    provides: Delivery CRUD, batch controller, and admin control endpoints
provides:
  - Shared validateAndNormalizeDeliveryInput validator with minute-based timeWindow comparison and batch weight sync in deliveryController
  - Ineligible delivery status guards (COMPLETED, OUT_FOR_DELIVERY, CANCELLED, active route) and active-route batch close/delete locks (409 BATCH_HAS_ACTIVE_ROUTES) in batchController
  - Consignment CSV dry-run parity checks (volumeM3, serviceDurationMinutes, 6-digit postalCode, 10-15 digit phone, minute-based timeWindow, DB collision detection) in csvImportService
  - Last-Admin lockout protection (409 LAST_ADMIN_PROTECTED) across PUT/PATCH/DELETE /admin/users/:id and RETIRE active-operation conflict lock (409 ACTIVE_OPERATION_CONFLICT) in adminController
  - Integration test suite server/tests/phase09_dispatch_admin_guards.test.js
affects: [09-04, 09-05]

# Actuals (#2632)
actuals:
  tokens: 14708
  tasks: 3
  commits: 3

commits: 3
plan_head_before: e23bd4b0fd420d1e8b453d34ff8047f171d515ac
plan_head_after: 08e4374350eafdcfa1b479cffbfd5d0b84707126

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared validateAndNormalizeDeliveryInput(payload, { isUpdate, existingDelivery }) for POST/PUT consignment parity and HH:mm total-minute time window parsing"
    - "assertDeliveriesEligibleForBatch and assertNoActiveRoutesOnBatch helpers guarding batch creation, addition, closing, and deletion"
    - "assertNotLastActiveAdmin helper invoked after self-lockout checks across PUT, PATCH, and DELETE /admin/users/:id"

key-files:
  created:
    - server/tests/phase09_dispatch_admin_guards.test.js
  modified:
    - server/src/controllers/deliveryController.js
    - server/src/controllers/batchController.js
    - server/src/services/csvImportService.js
    - server/src/controllers/adminController.js
    - server/src/routes/adminRoutes.js

key-decisions:
  - "Parse HH:mm into total minutes (hours * 60 + minutes) and pad normalized HH:mm strings in validateAndNormalizeDeliveryInput and csvImportService.validateRow so unpadded inputs like '9:00' vs '17:00' compare accurately and satisfy Delivery schema validation"
  - "Evaluate self-lockout checks (403 SELF_LOCKOUT_PREVENTED / SELF_DEMOTION_BLOCKED / SELF_SUSPENSION_BLOCKED) before assertNotLastActiveAdmin (409 LAST_ADMIN_PROTECTED) so existing self-protection behavior (TC-ADMIN-USER-2) remains preserved while peer demotion/deactivation/deletion of the sole active ADMIN returns 409"

patterns-established:
  - "Consignment Validation Parity: createDelivery, updateDelivery, and csvImportService enforce identical bounds on weightKg (> 0), volumeM3 (>= 0), serviceDurationMinutes (> 0), phone (10-15 digits), postalCode (6 digits), and minute-parsed timeWindow"
  - "Batch & Fleet Active-Operation Interlocks: batch close/delete and admin vehicle RETIRE override query DriverShift (IN_PROGRESS) and Route (DISPATCHED, IN_PROGRESS) before mutating state"

requirements-completed: [D-09, D-10, D-12, D-14, D-15, D-16, D-17]

coverage:
  - id: D1
    description: "Create and update delivery endpoints share validateAndNormalizeDeliveryInput parity, support unpadded HH:mm minute comparison, and keep parent batch metrics synchronized"
    requirement: "D-09"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#POST and PUT /deliveries enforce identical validation rules and handle unpadded time windows"
        status: pass
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#PUT /deliveries/:id recalculates parent batch totalWeightKg when weightKg changes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multi-vehicle route splitting remains enabled without blocking dispatch on single-vehicle cargo caps"
    requirement: "D-10"
    verification:
      - kind: integration
        ref: "server/tests/adversarial_csv_batch.test.js#ADV-BOUND-2: Overflow by 0.1 kg (1000.1 / 1000.0 kg) triggers overload detection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Admin fleet override RETIRE action is blocked with HTTP 409 ACTIVE_OPERATION_CONFLICT when an IN_PROGRESS shift or active DISPATCHED/IN_PROGRESS route is running"
    requirement: "D-12"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#POST /admin/fleet-control/override RETIRE blocks with 409 ACTIVE_OPERATION_CONFLICT during IN_PROGRESS shift"
        status: pass
    human_judgment: false
  - id: D4
    description: "CSV consignment dry-run validates volumeM3 >= 0, serviceDurationMinutes > 0, 6-digit postalCode, 10-15 digit phone, trimmed/uppercased orderReference, and DB collision detection"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#dryRun=true trims/uppercases orderReference, detects DB collisions, and validates volume, duration, phone, postalCode"
        status: pass
    human_judgment: false
  - id: D5
    description: "Batch creation/addition reject COMPLETED and OUT_FOR_DELIVERY consignments and active-route consignments; batch close/delete blocked with 409 BATCH_HAS_ACTIVE_ROUTES"
    requirement: "D-15"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#POST /batches and POST /batches/:id/deliveries reject COMPLETED and OUT_FOR_DELIVERY consignments"
        status: pass
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#DELETE /batches/:id and PATCH /batches/:id/status (CLOSED) return 409 BATCH_HAS_ACTIVE_ROUTES while routes are DISPATCHED/IN_PROGRESS"
        status: pass
    human_judgment: false
  - id: D6
    description: "Backend controllers and CSV importers trim strings, uppercase orderReference/batch code, and normalize email inputs"
    requirement: "D-16"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#POST and PUT /deliveries enforce identical validation rules and handle unpadded time windows"
        status: pass
    human_judgment: false
  - id: D7
    description: "User management endpoints (PUT/PATCH/DELETE /admin/users/:id) enforce Last-Admin protection (409 LAST_ADMIN_PROTECTED) while preserving 403 self-lockout protection"
    requirement: "D-17"
    verification:
      - kind: integration
        ref: "server/tests/phase09_dispatch_admin_guards.test.js#Last-Admin guard blocks demoting, deactivating, or deleting the sole remaining active ADMIN (409 LAST_ADMIN_PROTECTED)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-10
status: complete
---

# Phase 09 Plan 02: Dispatch, Batch, CSV & Last-Admin Guards Summary

**Unified consignment create/edit/CSV validation parity with minute-parsed time windows, batch active-route close/delete locks, and Last-Admin + vehicle RETIRE protection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-10T18:14:55Z
- **Completed:** 2026-11-10T18:21:38Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Extracted `validateAndNormalizeDeliveryInput` and `syncBatchMetrics` in `server/src/controllers/deliveryController.js` so `createDelivery` and `updateDelivery` enforce identical bounds (`weightKg > 0`, `volumeM3 >= 0`, `serviceDurationMinutes > 0`, 10–15 digit phone, 6-digit postal code, minute-parsed `timeWindow.start < timeWindow.end`) and keep parent batch weights synchronized.
- Hardened `server/src/controllers/batchController.js` with `assertDeliveriesEligibleForBatch` (rejecting `COMPLETED`, `OUT_FOR_DELIVERY`, `CANCELLED`, and active-route consignments on batch creation/addition) and `assertNoActiveRoutesOnBatch` (`409 BATCH_HAS_ACTIVE_ROUTES` on `deleteBatch` and `updateBatchStatus` to `CLOSED`), plus batch status allowlist validation and `code`/`name` normalization.
- Upgraded `server/src/services/csvImportService.js` (`validateRow`) to validate `volumeM3 >= 0`, `serviceDurationMinutes > 0`, 6-digit `postalCode`, 10–15 digit phone format, and minute-based time window ordering while preserving trim/uppercase `orderReference` normalization and `dryRun: true` DB collision checks.
- Added `assertNotLastActiveAdmin` (`409 LAST_ADMIN_PROTECTED`), `exports.deleteUser` (`DELETE /api/v1/admin/users/:id`), name/email normalization, and `RETIRE` active-operation conflict checks (`409 ACTIVE_OPERATION_CONFLICT`) in `server/src/controllers/adminController.js` and `server/src/routes/adminRoutes.js`.
- Created `server/tests/phase09_dispatch_admin_guards.test.js` (7 integration tests) and verified all 4 suites (48 tests) pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce delivery create/edit parity, batch active-route guards, and delivery CSV parity** - `150f4d5` (feat)
2. **Task 2: Add Last-Admin protection on user endpoints (including DELETE /users/:id) and RETIRE active-operation lock in adminController** - `bf2e104` (feat)
3. **Task 3: Create integration tests in server/tests/phase09_dispatch_admin_guards.test.js** - `08e4374` (test)

## Files Created/Modified
- `server/src/controllers/deliveryController.js` - Shared `validateAndNormalizeDeliveryInput`, minute-based time window parsing/padding, and `syncBatchMetrics`
- `server/src/controllers/batchController.js` - `assertDeliveriesEligibleForBatch`, `assertNoActiveRoutesOnBatch`, `ALLOWED_BATCH_STATUSES`, and `code`/`name` normalization
- `server/src/services/csvImportService.js` - `validateRow` parity for `volumeM3`, `serviceDurationMinutes`, `postalCode`, phone digits, and minute-based time window comparison
- `server/src/controllers/adminController.js` - `assertNotLastActiveAdmin`, `deleteUser`, name/email normalization, and `RETIRE` active shift/route check
- `server/src/routes/adminRoutes.js` - Registered `DELETE /users/:id`
- `server/tests/phase09_dispatch_admin_guards.test.js` - Integration tests covering D-09, D-12 (admin override), D-14, D-15, D-16, and D-17

## Decisions Made
- Normalized valid `HH:mm` time windows (e.g., `"9:00"` -> `"09:00"`) after comparing total minutes (`hours * 60 + minutes`) so unpadded inputs compare accurately and pass Mongoose `Delivery` pre-validate hooks cleanly.
- Kept self-lockout checks (`403 SELF_LOCKOUT_PREVENTED` / `SELF_DEMOTION_BLOCKED` / `SELF_SUSPENSION_BLOCKED`) ahead of `assertNotLastActiveAdmin` (`409 LAST_ADMIN_PROTECTED`) so existing single-admin self-suspension semantics (`TC-ADMIN-USER-2`) remain unchanged while peer removal of the sole active `ADMIN` returns `409`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Consignment create/edit/CSV parity, batch active-route guards, and Last-Admin endpoints are verified and tested.
- Ready for Plan 09-03 / 09-04 / 09-05 execution.

## Self-Check: PASSED

- Verified created/modified files exist on disk (`deliveryController.js`, `batchController.js`, `csvImportService.js`, `adminController.js`, `adminRoutes.js`, `phase09_dispatch_admin_guards.test.js`).
- Verified commits `150f4d5`, `bf2e104`, and `08e4374` are ancestors of `HEAD`.
- Verified Jest run (`phase09_dispatch_admin_guards.test.js`, `deliveries.test.js`, `admin_control.test.js`, `adversarial_csv_batch.test.js`): 4/4 suites, 48/48 tests passed.

---
*Phase: 09-operational-guards-and-validation-polish*
*Completed: 2026-11-10*
