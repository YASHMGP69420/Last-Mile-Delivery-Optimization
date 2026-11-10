# Phase 07 Execution Plan: Production Data Cleanup & Removable Prebuilt Demo Dataset Controls

**Milestone:** 3 — Production Readiness & Chrome Polish  
**Context:** [07-CONTEXT.md](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.planning/phases/07-production-data-cleanup-and-demo-controls/07-CONTEXT.md)  
**Goal:** Bring the database and codebase to a clean production baseline (keeping only real user accounts), isolate non-destructive prebuilt demo dataset Import/Delete controls (`isDemoData: true`) for easy future removal, and verify zero-crash empty states across all views.

---

## Wave 1: Schema Tagging (`isDemoData`), Isolated Demo Service/API & Production DB Wipe

**Objective:** Tag schemas safely with `isDemoData`, build the isolated Admin-only Demo Dataset import/delete module, remove legacy weak-password seed scripts, wipe existing dummy records from `smartroute`, and cover with adversarial isolation tests.

### Tasks

1. **Add `isDemoData` Field to Operational Mongoose Models**
   - Add `isDemoData: { type: Boolean, default: false, index: true }` cleanly across:
     - Core: `User.js`, `Driver.js`, `Vehicle.js`, `Delivery.js`, `DeliveryBatch.js`, `Route.js`, `AuditEvent.js`
     - Secondary telemetry/events: `DeliveryEvent.js`, `DriverIncident.js`, `DriverShift.js`, `MaintenanceRecord.js`, `RouteAssignment.js`, `SystemNotification.js`, `TelemetryAlert.js`, `TelemetryPing.js`, `VehicleAssignment.js`, `VehicleChecklist.js`

2. **Create Isolated Removable Backend Demo Module**
   - **`server/src/services/demoDataService.js`** (New):
     - `getDemoDataStatus()`: aggregates counts of `{ isDemoData: true }` across `User`, `Driver`, `Vehicle`, `Delivery`, `DeliveryBatch`, `Route` and returns `{ hasDemoData, counts }`.
     - `importDemoDataset(actorUserId)`:
       - Rejects with `409 DEMO_DATA_ALREADY_LOADED` if any `{ isDemoData: true }` operational records already exist (prevents duplicate license/email/order collisions).
       - Inserts curated Bhubaneswar prebuilt sample data (`isDemoData: true` on every document):
         - 1 demo Fleet Manager (`demo.manager@smartroute.local`), 3 demo Drivers + `Driver` profiles (`OD02-DEMO-101..103`), 4 demo Vehicles (`DEMO-EV-01`, `DEMO-VAN-02`, `DEMO-VAN-03`, `DEMO-TRK-04`), 12 demo Deliveries (`#DEMO-BBSR-001..012` across Bhubaneswar zones), 1 ready Dispatch Batch (`BATCH-DEMO-BBSR-01`), and 1 `AuditEvent` (`DEMO_DATA_IMPORTED`).
     - `deleteDemoDataset()`:
       - Runs strict `deleteMany({ isDemoData: true })` across all tagged models in clean dependency order (never touches any real document where `isDemoData` is `false` or unset).
       - Returns deleted counts `{ deleted }`.
   - **`server/src/controllers/demoDataController.js`** (New): `getStatus`, `importDemoData`, `deleteDemoData`.
   - **`server/src/routes/demoDataRoutes.js`** (New) + 1-line mount in `server/src/routes/index.js`:
     - Mounted at `/api/v1/admin/demo-data` behind `authenticate, authorize(ROLES.ADMIN)` (`GET /status`, `POST /import`, `DELETE /`).

3. **Refactor Legacy `server/src/seed/seedBhubaneswar.js` & Audit `healDriversAndRoutes.js`**
   - Remove all hardcoded weak demo passwords (`admin123`, `manager123`, `driver123`, `Admin@123`, `@example.com` demo users) from `seedBhubaneswar.js`; turn it into a thin CLI wrapper around `demoDataService` (`--import` / `--delete`) so no legacy dummy-user seeding survives.
   - Verify `healDriversAndRoutes.js` has no hardcoded demo/test creation on server boot.

4. **Purge Live Local `smartroute` Database to Production Baseline**
   - Preserve strictly `mishrayashaswee6@gmail.com` (`ADMIN`) and `yashasweemishra7@gmail.com` (`DRIVER` + its linked `Driver` profile with `assignedVehicleId` cleared if orphaned).
   - Remove all seeded/test users (`@example.com`, `@smartroute.live`, `@smartroute.internal`, `@smartroute.io`) and clear seeded `deliveries`, `deliverybatches`, `routes`, `vehicles`, remaining `drivers`, `auditevents`, and transient operational logs.

5. **Automated Tests (`server/tests/demo_data.test.js`)**
   - Verify `ADMIN` access vs `403` rejection for `FLEET_MANAGER` & `DRIVER`.
   - Verify `importDemoData` creates tagged records, updates `/status`, and prevents duplicate import (`409`).
   - Verify **Non-Destructive Isolation**: real `User`s, real `Vehicle`, real `Driver`, real `Delivery` (`isDemoData: false`) remain 100% intact after `deleteDemoData()` removes all `isDemoData: true` records.

**Wave 1 Verification:** `npm --prefix server test -- tests/demo_data.test.js` passes cleanly.

---

## Wave 2: Removable Admin Control Center Panel & Empty-State Resilience

**Objective:** Add the isolated `DemoDatasetPanel` in `AdminControlCenterPage.tsx` (Admin-only) and verify empty-state behavior across all pages when `0` consignments/vehicles/routes exist.

### Tasks

1. **Add Isolated `DemoDataApi` in `client/src/api/client.ts`**
   - `getStatus()`, `importDemoData()`, `deleteDemoData()` hitting `/admin/demo-data/*`.

2. **Create `client/src/components/dashboard/DemoDatasetPanel.tsx` & Wire in `AdminControlCenterPage.tsx`**
   - Self-contained glassmorphic obsidian card gated by `user?.role === 'ADMIN'`, removable via a 1-line import/JSX removal later.
   - Shows live demo status (`Clean Production Baseline` vs counts of active demo records).
   - **Import Prebuilt Demo Data** button + **Delete Demo Data** button with safe inline 2-step confirmation (`Confirm Delete Demo Data` / `Cancel`) and automatic Control Center metrics refresh callback (`fetchData()`).

3. **Audit & Harden Production Empty States**
   - Check `AdminControlCenterPage.tsx`, `OperationsCommandStrip.tsx`, `ConsignmentPipelineCard.tsx`, `AnalyticsPage.tsx`, `DeliveriesPage.tsx`, `BatchesPage.tsx`, `RoutePlannerPage.tsx`, `TrackingPage.tsx`, `FleetsPage.tsx`, `DriversPage.tsx` for safe zero-count rendering (no `NaN` percentages or crash when lists are `[]`).

**Wave 2 Verification:** `npm --prefix client test` and `npm --prefix client run build` pass with zero errors.

---

## Wave 3: Full Regression Verification, DB Audit, Docs & Push

1. Run full `npm --prefix server test` (all 20 suites) + `npm --prefix client test && npm --prefix client run build` + `npm ci --dry-run`.
2. Audit live `smartroute` MongoDB counts (`users: 2` — sole Admin + your Driver, `deliveries: 0`, `vehicles: 0`, `routes: 0`, `batches: 0`).
3. Write `.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md`, update `ROADMAP.md` & `STATE.md`, and push directly to `origin/master`.
