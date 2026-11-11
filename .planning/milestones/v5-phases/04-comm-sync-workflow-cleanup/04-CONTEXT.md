# Phase 04 Context: End-to-End Admin ↔ Fleet ↔ Driver Communication, State Sync & Dead-UI Cleanup

**Status**: Discussed & Locked
**Date**: 2026-11-10
**Origin**: `/gsd-audit-uat` + `/gsd-discuss-phase` session

## Locked Decisions

### 1. Driver Issue Reporting, Pre-Trip Checks & Removal of Broken SOS (`A1`)
- **Remove Cockpit SOS**: Delete the broken `SOS` button and modal from `DriverCockpitPage.tsx` (previously failed with `400` due to `type: 'EMERGENCY_SOS'` mismatch).
- **Keep & Complete Support + Alerts**: Keep Call Dispatch and structured incident reporting on `DriverSupportPage.tsx`, and wire both `DriverIncident` reports and critical `VehicleChecklist` pre-trip failures cleanly to real-time Fleet/Admin alerts (`telemetry:alert` + shared Notifications/Incidents view with resolution controls).

### 2. Shared Fleet/Admin Alerts, Live Socket.IO Sync & State Machine Closure (`A2`)
- **Fix Direct Messaging (`sendRouteMessage`)**: Replace invalid `category: 'OPERATIONS'` with `'ROUTE'` in `routeController.js:1308` so direct messages save to `SystemNotification` and emit `dispatch:message`.
- **Room-Scoped Socket.IO (No Cross-Driver Leaks)**: Remove unscoped global `ioInstance.emit` leaks across drivers, ensure `socketAuth.js` joins management sockets (`ADMIN`, `FLEET_MANAGER`) to role rooms (`admin`, `fleet`), remove duplicate `route:dispatched` emit in `dispatchExecutionService.js`, remove dead `/socket/tracking` emits, fix `DriverSocketContext` reconnect churn, and add client-side `driverId`/`routeId` guards.
- **Shared Admin & Fleet Alerts/Incidents Access**: Decouple notifications and driver incidents from strict Super-Admin-only `/admin/*` barriers so `FLEET_MANAGER` no longer gets `403`, fix `getNotifications` filter to include `targetRole: 'FLEET_MANAGER'`, and hide `Audit Trail` from `FLEET_MANAGER` in `AdminSidebar`.
- **Complete Route/Vehicle/Driver/Batch State Transitions**:
  - Release `Vehicle.availability = 'AVAILABLE'`, close `VehicleAssignment` & `RouteAssignment`, set `Route.completedAt`, and close `DeliveryBatch` cleanly when the last pending stop finishes (in both `completeDelivery` and `failDelivery`).
  - Fix `Vehicle.findByIdAndUpdate` virtual bug (`availability` instead of `status`) in `adminController.js` `CANCEL_ROUTE` & `getAdminOverview`, fix Fleet Manager overview activity mapping corruption, fix `ROLES` missing import in `driverController.js`, fix `BatchesPage` authenticated CSV export, fix `TrackingPage` `msgNotice` + vehicle GPS map markers + `batteryPercent` in `GET /telemetry/live` + `'Electric'` case fix, and wire live Socket.IO (`delivery:updated`, `route:progress`, `telemetry:alert`) into `TrackingPage`, `AdminControlCenterPage`, and `SystemNotificationsPage`.

### 3. Standardized Driver Handheld Workflow, Continuous GPS & Persisted Notifications (`A3`)
- **Standardize POD & Skip**: Wire `PODModal` consistently across `DriverCockpitPage`, `DriverRoutePage`, and `DriverDeliveriesPage`; align payload (`otp`, `signatureSvg`, `photoUrl`, `handoverNotes` at top level), stop `getUserMedia` tracks cleanly on close/tab switch, align `Skip` reason codes with backend `FAILURE_REASONS`, and render `<Toast />` in `DriverCockpitPage` & `DriverRoutePage`.
- **Shift Controls, Route Claiming & Telemetry Card**: Allow Shift Clock-In from the status bar even when an active route is dispatched, restrict `claimRoute` to unassigned routes (`driverId: null`), enrich `/driver-hud/dashboard` vehicle payload + `'Electric'` check so `DriverVehicleStatusCard` shows real values, and display `estimatedArrival || eta`.
- **Persisted Driver Notifications & Continuous GPS**: Load `GET /driver-hud/notifications` in Driver UI + add Mark-as-Read (`PATCH /driver-hud/notifications/:id/read`), move active-shift GPS pings to `DriverLayout`/`DriverSocketContext`, replace static/misleading metrics (`4.9` rating default, `"Live Sync"`, hardcoded `14250` odometer), and delete orphaned `DriverDeliveryDetailPage`, duplicate `components/driver/DriverBottomNav.tsx`, and unused `hooks/useDriverSocket.ts`.

### 4. Remove Orphaned Bloat Pages & Deduplicate Admin Chrome (`A4`)
- **Prune Orphaned Governance Pages**: Remove the 9 unlinked/non-functional Admin pages (`PermissionMatrixPage`, `OptimizationSettingsPage`, `OrganizationPage`, `IntegrationsPage`, `DataManagementPage`, `FleetControlPage`, `OperationsControlPage`, `UserManagementPage`, `FuelSettingsPage`) from routes/files, keeping core workflow pages cleanly focused.
- **Remove Broken 'Fleets' 404 Tab**: Remove the non-existent `/fleets` tab/modal/CSV import from `FleetsPage.tsx` (leaving clean Fleet Vehicles management).
- **Deduplicate Header vs Sidebar & RoutePlanner Controls**: Remove duplicate top nav tab bar from `AdminHeader` (keeping `AdminSidebar` as single workspace dock + keeping `AdminHeader` clean for title, Bell with unread badge, `ThemeToggle`, and contextual actions), streamline redundant Optimize/Dispatch triggers on `RoutePlannerPage`, and remove un-wired objective weight sliders from `OptimizationControlPanel`.
