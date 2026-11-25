---
phase: 26-unified-edit-delete-vehicles-drivers
plan: 01
subsystem: fleet-and-driver-lifecycle
tags: [driver-crud, vehicle-crud, cascade-protection, active-operation-conflict, mishap-rescue]
requires:
  - Phase 20: In-Transit Mishap Mitigation & Driver Deletion Cascade Protection
  - Phase 23: Fleet Tracking Overhaul, In-Place Maintenance & Continuous Driver Navigation
provides:
  - PUT /api/v1/drivers/:id with User synchronization
  - DELETE /api/v1/drivers/:id with active operation guard & forceReassign mishap recovery cascade
  - DELETE /api/v1/vehicles/:id with permanent purge & soft-retire toggle
  - Interactive EditDriverModal and DeleteDriverModal in DriversPage.tsx with 409 conflict rescue modal
  - Dedicated DeleteVehicleModal and Edit action workflow in FleetsPage.tsx
affects:
  - Driver & Vehicle management tables and administrative control centers
tech-stack:
  added: []
  patterns:
    - 409 ACTIVE_OPERATION_CONFLICT interlock guards on active shifts & routes
    - Atomic mishap recovery cascade when forceReassign is true
    - Dual entity profile sync across Driver and User collections
    - Real-time driver:updated, driver:deleted, and vehicle:deleted WebSocket room broadcasts
key-files:
  created:
    - server/tests/driver_vehicle_crud.test.js
    - client/src/pages/admin/__tests__/DriversPageCrud.test.tsx
  modified:
    - server/src/routes/driverRoutes.js
    - server/src/controllers/driverController.js
    - server/src/controllers/vehicleController.js
    - server/src/services/socketService.js
    - client/src/api/client.ts
    - client/src/pages/admin/DriversPage.tsx
    - client/src/pages/admin/FleetsPage.tsx
decisions:
  - "D-01: Synchronize Driver.userId profile updates (name, email, phone) with validation for license and email uniqueness excluding self."
  - "D-02: Protect drivers from deletion during active shifts/routes via assertNoActiveDriverOrVehicleOperations (HTTP 409), with forceReassign=true rescue cascade."
  - "D-03: Support permanent=true deletion for vehicles from database, retaining soft-retire (availability = RETIRED) as default non-destructive behavior."
  - "D-04: Present both Edit (Pencil) and Delete (Trash2) action buttons with confirmation modals in both DriversPage and FleetsPage."
metrics:
  duration: "18m"
  completed_date: "2026-11-22"
status: complete
actuals:
  tokens: 28500
  tasks: 5
  commits: 5
  plan_head_before: "b80c528"
  plan_head_after: "095261f"
---

# Phase 26 Plan 01: Driver & Vehicle Edit and Delete Lifecycle Operations with Cascade Protection Summary

## Objective
Provide complete administrative lifecycle management (edit and delete) for drivers and fleet vehicles in `DriversPage.tsx` and `FleetsPage.tsx`, backed by secure backend endpoints, active operation guards (`409 ACTIVE_OPERATION_CONFLICT`), mishap cascade recovery, confirmation dialogs, and real-time socket updates.

## Accomplishments

### 1. Backend Driver & Vehicle CRUD Endpoints
- **DELETE /api/v1/drivers/:id**: Registered and secured for ADMIN and FLEET_MANAGER roles.
- **Enhanced `updateDriver` (`driverController.js`)**:
  - Accepts `name`, `email`, `phone`, `licenseNumber`, `availability`, `rating`.
  - Automatically locates and synchronizes the linked `User` document (`driver.userId`) updating name, email, and phone.
  - Validates uniqueness for commercial driving license on `Driver` and email on `User` excluding the current entity.
  - Emits `driver:updated` socket event to dispatch/management rooms.
- **Implemented `deleteDriver` (`driverController.js`)**:
  - Guards against deletion if driver has active in-progress shifts or dispatched/in-progress routes via `assertNoActiveDriverOrVehicleOperations` (returns 409 `ACTIVE_OPERATION_CONFLICT`).
  - Supports `forceReassign: true` via query parameter or body, which executes `recoverDriverMishapCascade({ driverId, actor, reason: 'DRIVER_ACCOUNT_DELETED' })` to safely rescue deliveries to `READY` pool with Urgent priority.
  - Automatically unpairs any assigned vehicle cleanly.
  - Deletes both `Driver` and linked `User` documents.
  - Emits `driver:deleted` socket event to dispatch/management rooms.
- **Enhanced `deleteVehicle` (`vehicleController.js`)**:
  - Supports `permanent=true` query parameter for permanently deleting vehicle chassis from the database when idle.
  - Retains default soft-retire behavior (`availability = RETIRED`) and unpairs drivers.
  - Emits `vehicle:deleted` socket event to dispatch/management rooms.

### 2. Frontend API Client Extension (`FleetApi`)
- Added `updateDriver(id, data)` typed API helper in `client/src/api/client.ts`.
- Added `deleteDriver(id, options)` typed API helper with `forceReassign` options.
- Updated `deleteVehicle(id, options)` to support `permanent` deletion option.

### 3. Driver Management Edit & Delete UI (`DriversPage.tsx`)
- Replaced static optimizer column with interactive **Edit** (`Pencil`) and **Delete** (`Trash2`) action buttons.
- Added `EditDriverModal`: pre-populates name, email, phone, license number, availability status, and rating, validating input and executing updates via `FleetApi.updateDriver`.
- Added `DeleteDriverModal`: confirmation dialog warning that associated accounts and vehicle pairings will be removed.
- Integrated `ActiveOperationConflictModal` (reused from Phase 20): intercepts HTTP 409 conflicts and allows dispatchers to "Reassign Active Orders & Delete" (`forceReassign: true`).

### 4. Fleet Vehicles Edit & Delete UI (`FleetsPage.tsx`)
- Ensured table Actions column displays interactive **Edit** (`Pencil`), **Maintenance** (`Wrench`), **Retire** (`Archive`), and **Delete** (`Trash2`) buttons.
- Added dedicated `DeleteVehicleModal` with license plate, make/model, type details, vehicle detachment safety warning, and optional permanent purge checkbox.
- Connected real-time refetching and toast feedback on successful operations.

### 5. Automated Backend & Frontend Tests
- **Backend Tests (`server/tests/driver_vehicle_crud.test.js`)**: 9 integration tests covering driver update with User model synchronization, license and email collision checks, idle driver deletion and vehicle unpairing, in-transit 409 active operation blocking, `forceReassign=true` mishap recovery rescue, vehicle soft-retirement, permanent deletion, and active vehicle transit guards. All 9 passed.
- **Frontend Tests (`client/src/pages/admin/__tests__/DriversPageCrud.test.tsx`)**: 4 Vitest component tests verifying action button rendering, `EditDriverModal` submission, `DeleteDriverModal` confirmation, and 409 conflict interception with order rescue deletion. All 4 passed.
- **Full Client Test Suite**: 17 test files (105 tests) passing with 0 regressions, and full TypeScript compile check (`tsc --noEmit`) passing with 0 errors.

## Verification Checklist
- [x] `PUT /api/v1/drivers/:id` successfully updates driver and synchronized user properties.
- [x] `DELETE /api/v1/drivers/:id` safely deletes idle drivers and rejects active in-transit drivers with 409 conflict.
- [x] `DELETE /api/v1/drivers/:id?forceReassign=true` rescues active deliveries and deletes driver.
- [x] DriversPage renders interactive Edit and Delete action buttons with fully functional modals.
- [x] FleetsPage renders interactive Edit and Delete action buttons with confirmation modals.
- [x] All automated tests pass with 100% success rate.

## Deviations from Plan
None — plan executed exactly as specified.

## Self-Check: PASSED
- `server/src/routes/driverRoutes.js` exists and defines `router.delete('/:id')`
- `server/src/controllers/driverController.js` exists and provides `updateDriver` & `deleteDriver`
- `client/src/pages/admin/DriversPage.tsx` exists and provides interactive Edit and Delete modals
- `client/src/pages/admin/FleetsPage.tsx` exists and provides DeleteVehicleModal
- `server/tests/driver_vehicle_crud.test.js` exists and passes (9/9)
- `client/src/pages/admin/__tests__/DriversPageCrud.test.tsx` exists and passes (4/4)
- Atomic commits exist:
  - `b88565d`: feat(26-01): backend driver and vehicle edit and delete operations with cascade protection
  - `3b0adb8`: feat(26-01): extend FleetApi with driver update, delete, and permanent vehicle delete methods
  - `ff0dbf9`: feat(26-01): add interactive Edit and Delete modals to DriversPage with 409 conflict rescue
  - `fe53f3d`: feat(26-01): add dedicated DeleteVehicleModal and ensure Edit and Delete actions in FleetsPage
  - `095261f`: test(26-01): add backend integration and frontend component tests for driver and vehicle CRUD
