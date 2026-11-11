# Phase 08 Execution Plan: Driver Shift Odometer & Fuel/Charge Logs + Admin & Driver Savings Analytics

**Milestone:** 3 — Production Readiness & Telemetry Analytics  
**Context:** [08-CONTEXT.md](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.planning/phases/08-driver-shift-odometer-and-savings/08-CONTEXT.md)  
**Goal:** Capture pre-delivery/shift-start and post-shift odometer readings and remaining fuel (`L`) or battery charge (`%`), compute exact shift distance & consumption, and attribute fuel saved, km saved, actual usage, and completed deliveries across Admin Control Center, Drivers Accounts, and Driver Profile.

---

## Wave 1: Shift Telemetry Schema, Usage Calculations & Admin/Driver Aggregation APIs

**Objective:** Extend `DriverShift` and shift endpoints to store & compute odometer/fuel telemetry safely, and surface unified savings + usage metrics across `/admin/overview`, `/drivers`, and `/driver-hud/profile`.

### Tasks

1. **Extend `DriverShift` Model (`server/src/models/DriverShift.js`)**
   - Add telemetry fields:
     - `vehicleId`: `ObjectId` ref `'Vehicle'` (default `null`)
     - `fuelUnit`: `String` enum `['L', '%']` (default `'L'`)
     - `startOdometerKm`: `Number` (`min: 0`, default `null`)
     - `startFuelOrCharge`: `Number` (`min: 0`, default `null`)
     - `endOdometerKm`: `Number` (`min: 0`, default `null`)
     - `endFuelOrCharge`: `Number` (`min: 0`, default `null`)
     - `actualDistanceKm`: `Number` (`min: 0`, default `0`)
     - `actualFuelOrChargeUsed`: `Number` (`min: 0`, default `0`)
     - `telemetryCapturedAtStart`: `Boolean` (`default: false`)
     - `telemetryCapturedAtEnd`: `Boolean` (`default: false`)

2. **Create Savings & Usage Aggregation Helper (`server/src/services/savingsAnalyticsService.js` — New)**
   - Uses `Route` optimization metrics + `costScorer.scoreRouteCost` (`vehicle.fuelType`, `kmPerLitre`, `energyKWhPerKm`) and `DriverShift` telemetry + `Delivery` completion counts:
     - `computeRouteFuelSaved(routeDoc, vehicleDoc)`: calculates exact fuel/energy saved (`fuelSavedLitres`, `energySavedKwh`) from `route.deltas.distanceSavedKm` using `scoreRouteCost`.
     - `getFleetSavingsSummary()`: aggregates across all active/completed routes + shifts for Control Center:
       - `totalDistanceSavedKm`, `fuelSavedLitres`, `energySavedKwh`, `fuelSavedInr`, `actualDistanceDrivenKm`, `actualFuelUsedLitres`, `actualAvgBatteryUsedPct`.
     - `getDriverPerformanceMetricsMap(driverIds)`: computes per-driver `deliveriesCompleted`, `deliveriesFailed`, `kmSaved`, `fuelSavedLitres`, `energySavedKwh`, `costSavedInr`, `actualDistanceKm`, `actualFuelUsedLitres`, `actualChargeUsedPct`, and `recentShifts`.

3. **Upgrade `driverHudController.startShift`, `endShift`, & `getProfile`**
   - **`startShift` (`POST /api/v1/driver-hud/shifts/start`)**:
     - Accepts optional `{ odometerKm, remainingFuelOrCharge, requireTelemetry }` (plus aliases `startOdometerKm`, `startFuelOrCharge`).
     - Resolves assigned `vehicle` (`driver.assignedVehicleId`), determines `fuelUnit = vehicle?.fuelType === 'Electric' ? '%' : 'L'`.
     - If `requireTelemetry === true` and `vehicle` exists, requires valid non-negative numbers (`odometerKm >= 0`, `remainingFuelOrCharge >= 0` and `<= 100` if `'%'`); returns `400 INVALID_SHIFT_TELEMETRY` if invalid.
     - Persists `vehicleId`, `fuelUnit`, `startOdometerKm`, `startFuelOrCharge`, `telemetryCapturedAtStart: true` on `DriverShift`; updates `Vehicle.batterySoC` if `Electric`.
   - **`endShift` (`POST /api/v1/driver-hud/shifts/end`)**:
     - Accepts `{ handoverNotes, odometerKm, remainingFuelOrCharge, requireTelemetry }`.
     - Preserves existing incomplete-deliveries handover notes safety guard (`INCOMPLETE_DELIVERIES_HANDOVER_REQUIRED`).
     - Validates `endOdometerKm >= startOdometerKm` (when both present, else `400 INVALID_ODOMETER_READING`), computes:
       - `actualDistanceKm = Number((endOdometerKm - startOdometerKm).toFixed(2))`
       - `actualFuelOrChargeUsed = Number(Math.max(0, startFuelOrCharge - endFuelOrCharge).toFixed(2))`
     - Updates `Vehicle.batterySoC` if `Electric`.
   - **`getProfile` (`GET /api/v1/driver-hud/profile`)**:
     - Enriches `performance` with `kmSaved`, `fuelSavedLitres`, `energySavedKwh`, `costSavedInr`, `actualDistanceKm`, `actualFuelUsedLitres`, `actualChargeUsedPct`, and `recentShifts` (last 5 completed shifts with odometer & usage deltas).

4. **Upgrade `adminController.getOverview` & `driverController.getDrivers`**
   - **`adminController.getOverview` (`GET /api/v1/admin/overview`)**:
     - Merges `savingsAnalyticsService.getFleetSavingsSummary()` into `operational`: exposes `fuelSavedLitres`, `energySavedKwh`, `actualDistanceDrivenKm`, `actualFuelUsedLitres` alongside `totalDistanceSavedKm` and `fuelSavedInr`.
   - **`driverController.getDrivers` (`GET /api/v1/drivers`)**:
     - Attaches `stats` summary per driver from `getDriverPerformanceMetricsMap(...)`: `{ deliveriesCompleted, deliveriesFailed, kmSaved, fuelSavedLitres, energySavedKwh, costSavedInr, actualDistanceKm, actualFuelUsedLitres, actualChargeUsedPct }`.

5. **Backend Tests (`server/tests/shift_telemetry_savings.test.js`)**
   - Verify pre-shift & post-shift odometer + fuel (`L` for Diesel/Petrol) and charge (`%` for Electric) usage computation (`end - start`).
   - Verify `endOdometerKm < startOdometerKm` rejects with `400 INVALID_ODOMETER_READING`, and `requireTelemetry: true` without readings rejects with `400 INVALID_SHIFT_TELEMETRY`.
   - Verify `/admin/overview`, `/drivers`, and `/driver-hud/profile` accurately report `fuelSavedLitres`, `energySavedKwh`, `totalDistanceSavedKm`, `actualDistanceKm`, `actualFuelUsedLitres`, and `deliveriesCompleted`.
   - Confirm existing `server/tests/driver_hud.test.js` continues passing cleanly.

**Wave 1 Verification:** `npm --prefix server test -- tests/shift_telemetry_savings.test.js tests/driver_hud.test.js` passes 100%.

---

## Wave 2: Driver Telemetry Modal, Pre-Delivery Gate, Control Center & Driver Account UIs

**Objective:** Build the Start/End Shift Odometer & Fuel/Charge modal in Driver Cockpit (auto-gating deliveries while off-duty) and surface savings + usage + deliveries across Admin Control Center, Drivers Accounts, and Driver Profile.

### Tasks

1. **Create `client/src/components/driver/ShiftTelemetryModal.tsx` (New)**
   - Reusable, clean glassmorphic modal supporting both `mode: 'START' | 'END'`.
   - Auto-adapts label & validation from assigned `vehicle?.fuelType`:
     - `'Electric'` → `"Remaining Battery Charge (%)"` (`0–100%`, step `1`)
     - `'Petrol' | 'Diesel'` → `"Fuel Remaining (Litres)"` (`>= 0`, step `0.1`)
   - In `'END'` mode:
     - Shows starting odometer & fuel/charge summary for comparison + real-time preview (`Distance driven: X km`, `Fuel/Charge used: Y L / %`).
     - Validates `endOdometerKm >= startOdometerKm`.
     - Integrates required handover notes textarea seamlessly when incomplete stops remain on active route (eliminating double modals!).

2. **Wire Pre-Delivery Gate & Clock-In/Out Telemetry in `DriverCockpitPage.tsx` & `client.ts`**
   - Update `DriverHudApi.startShift(payload?)` and `DriverHudApi.endShift(payload?)` in `client/src/api/client.ts`.
   - In `DriverCockpitPage.tsx`:
     - Clicking **Clock In** opens `ShiftTelemetryModal` (`mode="START"`).
     - Clicking **Arrived** (`handleMarkArrived`) or **Complete** while `shift?.status !== 'IN_PROGRESS'` intercepts cleanly and opens `ShiftTelemetryModal` (`mode="START"`) with notice `"Enter starting odometer & fuel/charge before starting your delivery"`, then auto-proceeds or updates cockpit state cleanly!
     - Clicking **Clock Out / End Shift** opens `ShiftTelemetryModal` (`mode="END"`) so post-shift odometer & remaining fuel/charge (plus handover notes if needed) are always recorded.

3. **Display Savings & Usage Metrics Across Admin & Driver Views**
   - **`OperationsCommandStrip.tsx` & `AdminControlCenterPage.tsx`**:
     - Enhance KPI card #4 (`Route Optimization & Savings`) and/or summary strip to display **Total Km Saved**, **Fuel/Energy Saved (`L` / `kWh` + `₹`)**, and **Actual Fleet Km / Fuel Logged** (computed cleanly for both `ADMIN` via `/admin/overview` and `FLEET_MANAGER` route/shift aggregation).
   - **`DriversPage.tsx` (Admin/Fleet Driver Accounts Table)**:
     - Add **Deliveries & Savings** column showing completed deliveries (`N completed`), **Km Saved**, **Fuel Saved (`L` / `kWh` / `₹`)**, and **Odometer Usage (`km driven • used`)**.
   - **`DriverProfilePage.tsx` (Driver Account Page)**:
     - Expand **Performance Summary** with **Km Saved**, **Fuel / Energy Saved**, **Deliveries Made**, **Odometer Distance Driven**, and **Fuel / Charge Used**, plus a compact **Recent Shift Logs** card showing start/end odometer & consumption per completed shift.

**Wave 2 Verification:** `npm --prefix client test` and `npm --prefix client run build` pass cleanly.

---

## Wave 3: Full Verification, Documentation & Push

1. Run full `npm --prefix server test` and `npm --prefix client test && npm --prefix client run build` + `npm ci --dry-run`.
2. Write `.planning/phases/08-driver-shift-odometer-and-savings/08-VERIFICATION.md`, update `.planning/ROADMAP.md` & `.planning/STATE.md`, and push directly to `origin/master`.
