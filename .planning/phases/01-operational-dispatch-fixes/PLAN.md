---
phase: 01
slug: operational-dispatch-fixes
title: "Operational Dispatch & Driver Workflow Stabilization"
status: planned
date: 2026-11-09
requirements:
  - FIX-MSG-01: Support direct driver messaging without requiring active route lookup or failing with 'Route not found'
  - REM-BRK-02: Remove driver break option and shift break controls from UI and API endpoints
  - FIX-PSH-03: Enable seamless 'Push to Driver Handheld' from Route Planner and Optimization panel
  - FIX-ASN-04: Eliminate duplicate and cascading vehicle/driver assignments across planner and batches
---

# Phase 01: Operational Dispatch & Driver Workflow Stabilization

## Executive Summary
This phase addresses four operational and dispatch pain points reported during active testing:
1. **Driver Messaging 404 Error**: Dispatchers attempting to message drivers from Tracking or Operations pages receive `"Route or driver not found for ID"` when `currentRouteId` is stale, unassigned, or passed instead of `driverId`.
2. **Driver Break Option Removal**: Decommission the "On Break" option and shift break controls so couriers operate strictly across active duty states (`ON_DUTY`, `IN_TRANSIT`, `OFF_DUTY`).
3. **Push to Driver Handheld Failure**: The "Push to Driver" CTA in Route Planner and Optimization Control Panel fails with 404 when batch routes are not yet dispatched or when reordering uncommitted draft sequences.
4. **Duplicate Driver & Vehicle Assignments**: `useRoutePlanner` fires redundant background HTTP `assignFleet` requests on every dropdown toggle, triggering cascading state updates and noisy audit logs.

---

## Detailed Task Breakdown

### Task 1: Resolve Driver Messaging Target Resolution (FIX-MSG-01)
- **Problem**: `TrackingPage.tsx` passes `messagingDriver.currentRouteId` as the primary identifier to `RoutesApi.sendMessage(targetId, ...)`. If the driver has no route or a cancelled route, the backend looks up the non-existent route and throws `404 TARGET_NOT_FOUND` ("Route or driver not found for ID").
- **Implementation**:
  1. In `client/src/pages/admin/TrackingPage.tsx`:
     - Update `handleSendDriverMessage` to send the driver's unique ID directly (`(messagingDriver as any)._id || messagingDriver.id`).
  2. In `server/src/controllers/routeController.js` (`sendRouteMessage`):
     - Robust multi-identifier lookup: Check if `id` is a Route ObjectId, Route Code, Driver ObjectId, Driver licenseNumber, or User ObjectId.
     - Decouple driver messaging from route presence: If target is a driver without an active route, successfully log the `SystemNotification` (targeted to `targetUserId`) and emit real-time WebSocket instruction via `socketService.emitDispatchMessage({ driverId, ... })`.
  3. In `client/src/pages/admin/OperationsControlPage.tsx`:
     - Ensure fallback target resolution works seamlessly.
- **Files**:
  - `client/src/pages/admin/TrackingPage.tsx`
  - `server/src/controllers/routeController.js`
  - `server/tests/routes.test.js`

### Task 2: Remove Break Option from Driver Workflow (REM-BRK-02)
- **Problem**: Drivers should remain on active duty without an intermittent "Take a Break" toggle in the mobile hud.
- **Implementation**:
  1. In `client/src/components/driver/DriverVehicleStatusCard.tsx`:
     - Clean up unused `Pause` / `Play` imports and shift break button references.
     - Keep shift handover / clock out button clean and focused.
  2. In `client/src/pages/driver/DriverCockpitPage.tsx`:
     - Verify no break controls are exposed; maintain only Clock In (`handleStartShift`) and Clock Out / Handover (`submitEndShift`).
  3. In `server/src/controllers/driverHudController.js` and `driverHudRoutes.js`:
     - Deprecate/decommission `toggleBreak` endpoint (gracefully return 200 without transitioning to `ON_BREAK` or remove route).
  4. In `client/src/api/client.ts`:
     - Clean up `toggleBreak` method from `DriverHudApi`.
- **Files**:
  - `client/src/components/driver/DriverVehicleStatusCard.tsx`
  - `client/src/pages/driver/DriverCockpitPage.tsx`
  - `server/src/controllers/driverHudController.js`
  - `server/src/routes/driverHudRoutes.js`
  - `client/src/api/client.ts`

### Task 3: Enable Reliable "Push to Driver Handheld" (FIX-PSH-03)
- **Problem**: Dispatchers clicking "Push to Driver" on `OptimizationControlPanel.tsx` or `RoutePlannerPage.tsx` encounter `404 ROUTE_NOT_FOUND` when a batch route is still in draft/planning or when attempting to reorder an un-dispatched batch.
- **Implementation**:
  1. In `client/src/pages/admin/RoutePlannerPage.tsx`:
     - Align the "Push to Driver" button in `OptimizationControlPanel`:
       - If route is already dispatched (`isDispatched === true`): Call `RoutesApi.reorderStops` to push the reordered waypoints to the driver handheld.
       - If route is NOT yet dispatched: Open the `DispatchConfirmationModal` or invoke `RoutesApi.dispatch` directly to push the route to the driver handheld.
  2. In `server/src/controllers/routeController.js`:
     - In `pushRouteToHandheld` (`POST /routes/:id/push`):
       - If `id` is a `batchId` and no Route exists yet, dynamically create and dispatch the route using `dispatchExecutionService.executeDispatch`, ensuring all stops, vehicle, and driver are bound.
       - Emit `route:dispatched` socket event so driver handheld updates instantly.
     - In `reorderRouteStops` (`POST /routes/:id/reorder`):
       - If `id` is a `batchId`, resolve the latest route for that batch across `['DISPATCHED', 'IN_PROGRESS', 'OPTIMIZED', 'DRAFT']`.
- **Files**:
  - `client/src/components/optimization/OptimizationControlPanel.tsx`
  - `client/src/pages/admin/RoutePlannerPage.tsx`
  - `server/src/controllers/routeController.js`

### Task 4: Eliminate Duplicate Vehicle & Driver Assignments (FIX-ASN-04)
- **Problem**: When a user selects a vehicle or driver in Route Planner, `useRoutePlanner.ts` immediately fires `BatchesApi.assignFleet` in the background for vehicles, which triggers a secondary effect that updates the driver and fires another `assignFleet` call. This generates duplicate API requests, multiple duplicate audit log events, and racing state updates.
- **Implementation**:
  1. In `client/src/hooks/useRoutePlanner.ts`:
     - Maintain `selectedVehicleId` and `assignedDriver` as local workspace state during route planning.
     - Remove auto-firing `BatchesApi.assignFleet` on transient dropdown clicks. Persist fleet binding when the route is dispatched or when the user explicitly saves changes.
     - Decouple the vehicle-selection effect from driver overwriting: only default the driver if no driver is currently selected and the batch has no preassigned driver.
  2. In `server/src/controllers/batchController.js` (`assignBatchFleet`):
     - Check whether `vehicleIds` and `driverIds` differ from existing batch values before performing database write or generating an `AuditEvent`. If identical, return early.
  3. In `server/src/services/dispatch/dispatchExecutionService.js`:
     - Ensure atomic, idempotent assignment of driver and vehicle without conflicting writes.
- **Files**:
  - `client/src/hooks/useRoutePlanner.ts`
  - `server/src/controllers/batchController.js`

---

## Verification Plan

### Automated Test Suite
- `npm --prefix server test -- tests/routes.test.js`
- `npm --prefix server test -- tests/socket_auth.test.js`
- Full test pass across all 17 server test suites (`npm --prefix server test`).

### Client Validation
- `npm --prefix client test` (TypeScript typecheck with 0 errors).
- `npm --prefix client run build` (Production Vite bundle compilation with 0 errors).

### Manual / Integration Checklist
1. Navigate to `/admin/tracking` → Click "Message Driver" on any driver (with or without active route) → verify message transmits without 404 error.
2. Verify Driver Cockpit / Vehicle Status Card has no break option.
3. In `/admin/route-planner` → Click "Push to Driver" → verify it dispatches or synchronizes stop sequence without 404.
4. Select vehicle in Route Planner → verify only a single assignment occurs and no duplicate audit log entries are spawned.
