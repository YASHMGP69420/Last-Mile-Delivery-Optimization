---
phase: 04-comm-sync-workflow-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/middleware/socketAuth.js
  - server/src/services/socketService.js
  - server/src/services/dispatch/dispatchExecutionService.js
  - server/src/services/telemetryService.js
  - server/src/controllers/routeController.js
  - server/src/controllers/driverHudController.js
  - server/src/controllers/driverController.js
  - server/src/controllers/adminController.js
  - server/src/routes/adminRoutes.js
  - server/src/routes/driverHudRoutes.js
  - client/src/context/DriverSocketContext.tsx
  - client/src/api/client.ts
  - client/src/components/layout/AdminHeader.tsx
  - client/src/components/layout/AdminSidebar.tsx
  - client/src/components/layout/DriverHeader.tsx
  - client/src/components/layout/DriverLayout.tsx
  - client/src/components/driver/CurrentStopHeroCard.tsx
  - client/src/components/driver/DriverVehicleStatusCard.tsx
  - client/src/components/driver/PODModal.tsx
  - client/src/components/optimization/OptimizationControlPanel.tsx
  - client/src/components/optimization/CurrentRouteCard.tsx
  - client/src/pages/BatchesPage.tsx
  - client/src/pages/admin/AdminControlCenterPage.tsx
  - client/src/pages/admin/FleetsPage.tsx
  - client/src/pages/admin/RoutePlannerPage.tsx
  - client/src/pages/admin/TrackingPage.tsx
  - client/src/pages/admin/SystemNotificationsPage.tsx
  - client/src/pages/driver/DriverCockpitPage.tsx
  - client/src/pages/driver/DriverRoutePage.tsx
  - client/src/pages/driver/DriverDeliveriesPage.tsx
  - client/src/pages/driver/DriverVehicleCheckPage.tsx
  - client/src/pages/driver/DriverProfilePage.tsx
  - client/src/App.tsx
autonomous: true
requirements:
  - COMM-MSG-01
  - COMM-SOCK-02
  - SYNC-STATE-03
  - DRV-HANDHELD-04
  - UI-CLEANUP-05
must_haves:
  truths:
    - "Admin & Fleet Managers can send direct messages and view/resolve driver incidents and failed pre-trip vehicle checks in real time without 400/403 failures."
    - "Socket.IO events are scoped to target driver, route, and management rooms without leaking dispatches/messages across unrelated drivers."
    - "Finishing or cancelling a route releases Driver & Vehicle availability, closes assignments, and updates Batches cleanly."
    - "Driver Handheld persists notification inbox + mark-as-read, collects real POD evidence via PODModal, keeps GPS pings active across all driver pages during shifts, and removes broken SOS & dead duplicates."
    - "Orphaned Admin governance pages, broken 404 Fleets tab, duplicate Admin navigation chrome, and redundant Route Planner buttons are removed cleanly."
---

# Phase 04 Execution Plan: End-to-End Admin ↔ Fleet ↔ Driver Communication, State Sync & Dead-UI Cleanup

Execute strictly in **3 Waves**, preserving all existing passing tests while fixing every broken Admin ↔ Fleet ↔ Driver link and pruning dead/AI-artifact UI elements locked in `04-CONTEXT.md`.

---

## Wave 1 — Backend & Socket.IO Foundation (Messaging, Room Scoping, State Closure & Incidents API)

### 1.1 Fix Direct Messaging & Shared Admin/Fleet Alerts + Incidents Endpoints
- [`server/src/controllers/routeController.js`](server/src/controllers/routeController.js):
  - In `sendRouteMessage` (`line 1308`), change invalid `category: 'OPERATIONS'` → `category: 'ROUTE'` so `SystemNotification.create` succeeds before emitting `dispatch:message`.
- [`server/src/routes/adminRoutes.js`](server/src/routes/adminRoutes.js) & [`server/src/controllers/adminController.js`](server/src/controllers/adminController.js):
  - Mount `/notifications`, `/notifications/:id/read`, `/incidents`, and `/incidents/:id` under `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)` (keep `/overview`, `/users`, `/audit-logs`, `/permissions`, etc. restricted to `ROLES.ADMIN`).
  - Update `getNotifications` query from `targetRole: { $in: ['ALL', 'ADMIN'] }` to `{ $in: ['ALL', 'ADMIN', 'FLEET_MANAGER'] }` so both Admins and Fleet Managers see driver vehicle-check failures and incident alerts.
  - Add `getIncidents` (`DriverIncident.find().populate('driverId routeId')`) and `resolveIncident` (`PATCH /admin/incidents/:id` updating `status: 'RESOLVED' | 'INVESTIGATING'`, `resolutionNotes`, `resolvedBy`, `resolvedAt`).
  - Fix `getOverview` (`lines 63-64`) to query `Vehicle.countDocuments({ availability: ... })` instead of virtual `status`, and include real `totalDistanceSavedKm` & `fuelSavedInr`.
  - Fix `CANCEL_ROUTE` (`line 708`) to update `{ availability: VEHICLE_STATUS.AVAILABLE }` instead of `{ status: VEHICLE_STATUS.AVAILABLE }`.
- [`server/src/controllers/driverController.js`](server/src/controllers/driverController.js):
  - Import `ROLES` from `../config/constants` so `createDriver` (`line 78`) no longer throws `ReferenceError: ROLES is not defined`.
- [`server/src/controllers/driverHudController.js`](server/src/controllers/driverHudController.js) & [`server/src/routes/driverHudRoutes.js`](server/src/routes/driverHudRoutes.js):
  - `getDashboard`: return full vehicle fields (`model`, `capacityKg`, `currentPayloadKg`, `batteryLevelPercent`, `fuelLevelPercent`) alongside existing keys.
  - `claimRoute`: filter `{ status: { $in: ['DISPATCHED', 'IN_PROGRESS'] }, driverId: null }` when no `routeId` is passed so a driver cannot steal another driver's route.
  - `completeDelivery`: read `{ recipientName, otp, signatureSvg, photoUrl, handoverNotes, temperatureReading }` safely from either top-level `req.body` or `req.body.pod` (accepting `photo`/`signature`/`notes` aliases cleanly), pass `routeId` in `emitDeliveryUpdated`, and on route completion release `Vehicle.availability = 'AVAILABLE'`, close `VehicleAssignment` & `RouteAssignment`, set `Route.completedAt = new Date()`, and close `DeliveryBatch` (`status = 'CLOSED'`) when no active routes remain on the batch.
  - `failDelivery`: pass `routeId` in `emitDeliveryUpdated`; if zero `PENDING`/`ARRIVED` stops remain on the route, execute the exact same Route/Driver/Vehicle/Assignment/Batch completion helper as `completeDelivery`.
  - `submitVehicleCheck` & `reportIncident`: emit real-time `telemetry:alert` to management rooms when critical vehicle issues or incidents are reported.
  - Add `PATCH /driver-hud/notifications/:id/read` (`markNotificationRead`) so drivers can acknowledge/dismiss persisted notifications server-side.
  - Remove dead `POST /shifts/break` endpoint (`driverHudRoutes.js` & `driverHudController.js`) only if no test asserts it (check `tests/` first; keep returning `400` if tested).

### 1.2 Socket.IO Room Isolation, Telemetry Fixes & Churn Elimination
- [`server/src/middleware/socketAuth.js`](server/src/middleware/socketAuth.js):
  - On connection for `ADMIN` or `FLEET_MANAGER`, auto-join role rooms (`'admin'`, `'fleet'`).
- [`server/src/services/socketService.js`](server/src/services/socketService.js):
  - Eliminate cross-driver leaks: emit driver/route events (`route:dispatched`, `route:reordered`, `route:cancelled`, `stop:priority_escalated`, `dispatch:message`) strictly to targeted rooms (`driver:${driverId}`, `route:${routeId}`) + management rooms (`admin`, `fleet`), removing blind `ioInstance.emit(...)` broadcasts to unrelated drivers. Remove dead `/socket/tracking` namespace emits.
- [`server/src/services/dispatch/dispatchExecutionService.js`](server/src/services/dispatch/dispatchExecutionService.js):
  - Remove duplicate `req.app.get('io')` emissions (`lines 287-299`) since `socketService.emitRouteDispatched` already handles scoped emissions cleanly.
- [`server/src/services/telemetryService.js`](server/src/services/telemetryService.js):
  - Fix `'Electric'` case comparison on line `167` (`VEHICLE_STATUS` / `FUEL_TYPES.ELECTRIC`).
  - Include `batteryPercent` inside `getLiveFleetStatus` (`lines 249-262`) telemetry projection.

---

## Wave 2 — Driver Handheld Synchronization, Standardized POD/Skip, Continuous GPS & Dead File Cleanup

### 2.1 Socket Context & Continuous GPS + Persisted Notifications
- [`client/src/api/client.ts`](client/src/api/client.ts):
  - Add `DriverHudApi.markNotificationRead(id)`, `AdminApi.getIncidents(params)`, `AdminApi.resolveIncident(id, data)`, and `BatchesApi.exportCsv(id)` (authenticated blob download helper).
  - Remove dead client API methods for orphaned pages (`getPermissions`, `updatePermissions`, `getOptimizationSettings`, `updateOptimizationSettings`, `getOrganization`, `updateOrganization`, `addDepot`, `updateDepot`, `getFleetControl`, `overrideFleetResource`, `getOperationsOversight`, `overrideOperation`, `getIntegrations`, `testIntegration`, `exportData`, `FleetApi.list/create/importCsv`).
- [`client/src/context/DriverSocketContext.tsx`](client/src/context/DriverSocketContext.tsx):
  - Store loaded notifications (`notifications[]`, `unreadCount`) fetched from `DriverHudApi.getNotifications()` on mount and refreshed on arrival, plus `markAsRead(id)`.
  - Filter incoming socket events by `driverId` / `activeRouteId` when present so no stray message leaks.
  - Fix `useEffect` dependency array (`[user?.id]`, tracking `driverIdRef` & `activeRouteIdRef` via refs cleanly) so changing `activeRouteId` joins the new room dynamically without disconnecting and rebuilding Socket.IO.
  - Move active-shift GPS geolocation ping interval (`navigator.geolocation.getCurrentPosition` / `navigator.getBattery()`) here (while `user?.role === 'DRIVER'` and shift active / triggered via shared shift flag), so pings continue seamlessly across Route, Manifest, Vehicle Check, and Support pages.
- [`client/src/components/layout/DriverHeader.tsx`](client/src/components/layout/DriverHeader.tsx):
  - Replace `"Live Sync"` pill with honest socket state (`"Connected"` / `"Reconnecting"` / `"Offline"`).
  - Surface unread persisted notification bell/badge + clean expandable inbox drawer with **Dismiss / Mark Read** (`markAsRead`) wired to `DriverHudApi.markNotificationRead`.

### 2.2 Driver Pages: Remove SOS Modal, Fix POD/Skip, Mount Toast & Clean Dead Files
- [`client/src/pages/driver/DriverCockpitPage.tsx`](client/src/pages/driver/DriverCockpitPage.tsx):
  - **Remove broken `SOS` button & SOS modal completely** (decision `A1`).
  - Render `<Toast />` cleanly when `toastMsg` is non-null.
  - Show `"Clock In & Start Shift"` in the Status Bar whenever `shift?.status !== 'IN_PROGRESS'` (even when an active route is dispatched!), and read `stop.estimatedArrival || stop.eta`.
  - Send top-level POD payload (`{ otp, signatureSvg, photoUrl, handoverNotes }`) to `completeDelivery`.
- [`client/src/components/driver/PODModal.tsx`](client/src/components/driver/PODModal.tsx):
  - Initialize controlled fields (`otp: ''`, `notes: ''`), add `stopCameraStream()` helper called on tab switch, modal close, and unmount, and replace `alert()` with inline camera error notice.
- [`client/src/components/driver/CurrentStopHeroCard.tsx`](client/src/components/driver/CurrentStopHeroCard.tsx):
  - Align Skip reason dropdown options strictly with backend `FAILURE_REASONS`: `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `ACCESS_RESTRICTED`, `DAMAGED_PACKAGE`, `TIME_EXPIRED`, `OTHER`.
- [`client/src/components/driver/DriverVehicleStatusCard.tsx`](client/src/components/driver/DriverVehicleStatusCard.tsx):
  - Fix EV comparison (`String(vehicle?.fuelType).toUpperCase() === 'ELECTRIC'`).
- [`client/src/pages/driver/DriverRoutePage.tsx`](client/src/pages/driver/DriverRoutePage.tsx) & [`client/src/pages/driver/DriverDeliveriesPage.tsx`](client/src/pages/driver/DriverDeliveriesPage.tsx):
  - Wire `PODModal` into both `DriverRoutePage` (with `Skip` failure modal too!) and `DriverDeliveriesPage` so proof of delivery works consistently across every driver screen.
  - Render `<Toast />` in both pages (replacing `alert()`), guard missing `customer.phone` on `tel:` links, and add `'Arrived'` state sync.
- [`client/src/pages/driver/DriverVehicleCheckPage.tsx`](client/src/pages/driver/DriverVehicleCheckPage.tsx) & [`client/src/pages/driver/DriverProfilePage.tsx`](client/src/pages/driver/DriverProfilePage.tsx):
  - Fetch real vehicle & dashboard odometer defaults (no static `14250`), show empty-state notice if no vehicle is assigned instead of an unsubmittable form, clean unused imports, and relabel completion ratio accurately on `DriverProfilePage` (removing static fallback fake `4.9` display when unavailable).
- **Delete Dead Driver Files**:
  - `client/src/pages/driver/DriverDeliveryDetailPage.tsx` (orphaned)
  - `client/src/components/driver/DriverBottomNav.tsx` (unused duplicate)
  - `client/src/hooks/useDriverSocket.ts` (unused duplicate)

---

## Wave 3 — Admin/Fleet Real-Time UI Sync, Shared Incidents Panel & Dead-Page / Duplicate Chrome Cleanup

### 3.1 Live Communication & Operational Fixes on Admin/Fleet Views
- [`client/src/pages/admin/TrackingPage.tsx`](client/src/pages/admin/TrackingPage.tsx):
  - Plot **live vehicle GPS markers** from `telemetryMap` alongside delivery stops on `InteractiveMap`.
  - Render `msgNotice` toast/banner after sending a message to a driver.
  - Listen to `telemetry:ping`, `telemetry:alert`, `delivery:updated`, and `route:progress` safely via Socket.IO (filtering incoming alert shape before rendering).
- [`client/src/pages/admin/SystemNotificationsPage.tsx`](client/src/pages/admin/SystemNotificationsPage.tsx):
  - Add tabbed view for **System Alerts & Broadcasts** AND **Reported Driver Incidents** (`AdminApi.getIncidents` + Resolve / Mark Investigating actions), auto-refreshing on `telemetry:alert` socket events.
- [`client/src/pages/admin/AdminControlCenterPage.tsx`](client/src/pages/admin/AdminControlCenterPage.tsx):
  - Fix Fleet Manager recent activity transformation so deliveries render real `orderReference`, address zone, customer/priority, and status instead of corrupted `AUD-undefined` / `'Live'` fields.
  - Attach live Socket.IO `delivery:updated` / `telemetry:alert` refresh triggers.
- [`client/src/pages/BatchesPage.tsx`](client/src/pages/BatchesPage.tsx):
  - Replace broken `window.open(exportCsvUrl)` (which caused `401`) with authenticated `BatchesApi.exportCsv(batchId)` Blob download.

### 3.2 Prune Orphaned Governance Pages, Broken 404 'Fleets' Tab & Duplicate Chrome
- **Delete the 9 Orphaned Admin Governance Pages**:
  - `client/src/pages/admin/PermissionMatrixPage.tsx`
  - `client/src/pages/admin/OptimizationSettingsPage.tsx`
  - `client/src/pages/admin/OrganizationPage.tsx`
  - `client/src/pages/admin/IntegrationsPage.tsx`
  - `client/src/pages/admin/DataManagementPage.tsx`
  - `client/src/pages/admin/FleetControlPage.tsx`
  - `client/src/pages/admin/OperationsControlPage.tsx`
  - `client/src/pages/admin/UserManagementPage.tsx`
  - `client/src/pages/admin/FuelSettingsPage.tsx`
- [`client/src/App.tsx`](client/src/App.tsx):
  - Remove imports and `<Route>` definitions for the 9 deleted Admin pages and `DriverDeliveryDetailPage`; allow both `ADMIN` and `FLEET_MANAGER` on `/admin/notifications`.
- [`client/src/pages/admin/FleetsPage.tsx`](client/src/pages/admin/FleetsPage.tsx):
  - Remove the broken 404 `"Fleets"` tab, `"Add Fleet"` modal, and `FleetApi.importCsv` handlers, focusing purely on real Fleet Vehicles CRUD & status.
- [`client/src/components/layout/AdminHeader.tsx`](client/src/components/layout/AdminHeader.tsx) & [`client/src/components/layout/AdminSidebar.tsx`](client/src/components/layout/AdminSidebar.tsx):
  - Remove the redundant 6-tab segmented navbar from `AdminHeader` (keeping `AdminSidebar` as single clear navigation dock, plus notification Bell button with live unread count & `ThemeToggle`).
  - Hide `Audit Trail` (`isAdmin` guard) from `FLEET_MANAGER` in `AdminSidebar`.
- [`client/src/pages/admin/RoutePlannerPage.tsx`](client/src/pages/admin/RoutePlannerPage.tsx) & [`client/src/components/optimization/OptimizationControlPanel.tsx`](client/src/components/optimization/OptimizationControlPanel.tsx):
  - Remove the un-wired 4 objective weight sliders (`distanceWeight`, `timeWeight`, `fuelCostWeight`, `vipPriorityWeight`) and redundant hardcoded clock/preset fluff from `OptimizationControlPanel`, keeping real Traffic Scenario, Max Iterations, EV/Cost Propulsion Priority (`vehicleTypePreference`), Vehicle/Driver assignment, and stop resequencing.
  - Deduplicate redundant Optimize & Dispatch triggers across header/panel/metrics bar so there is one clear control path.

---

## Verification Steps
1. Client TypeScript check (`npm --prefix client test` -> `tsc --noEmit`) passes with 0 errors.
2. Client Vite production build (`npm --prefix client run build`) passes cleanly.
3. Full backend Jest test suite (`npm --prefix server test`) passes 100% (`18/18` suites, including new/updated assertions verifying messaging `OPERATIONS` -> `ROUTE` fix, vehicle release on route completion/cancel, and Driver `ROLES` import fix).
4. Commit and push cleanly to `origin/master`.
