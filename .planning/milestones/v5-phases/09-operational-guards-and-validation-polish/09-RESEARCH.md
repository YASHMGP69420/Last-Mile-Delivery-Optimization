# Phase 09: Cross-Screen Operational Guards & Validation Polish - Research

**Researched:** 2026-11-10
**Domain:** Cross-screen fleet/driver telemetry continuity, operational state guards, CRUD validation parity, CSV dry-run DB collision detection, and Last-Admin safety (Node.js/Express/Mongoose + React/TypeScript/Vite)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Vehicle Odometer Continuity
- **D-01:** Add `lastOdometerKm` to `Vehicle` as an optional baseline on Admin Vehicle create/edit forms, and automatically advance it on Driver Shift Start (`startShift`), Shift End (`endShift`), and Pre-Trip Inspection (`submitVehicleCheck`).
- **D-02:** Display `'Last recorded: X km'` as a helper hint and placeholder inside `ShiftTelemetryModal` (Clock In / Clock Out) and `DriverVehicleCheckPage` without auto-prefilling the value, so drivers still read and manually enter the actual instrument reading; validate both inline on the client and strictly on the backend (`400` error when entered odometer `< vehicle.lastOdometerKm`).
- **D-03:** Enforce the decreasing-odometer check strictly for drivers; allow Fleet Manager / Admin to override/adjust `lastOdometerKm` on the Admin Vehicles edit modal when correcting an earlier typo.
- **D-04:** Keep `DriverVehicleStatusCard` and `VehiclesPage` fleet cards minimal — show `lastOdometerKm` only inside Clock In / Clock Out / Inspection forms rather than adding odometer clutter to cards.

### Fuel, Charge & Tank Sanity Checks
- **D-05:** On Clock Out (`ShiftTelemetryModal` `END` mode), display a clear non-blocking inline warning if entered remaining fuel/charge exceeds the Clock In value (`endFuel > startFuel`), rather than blocking submission (allowing legitimate mid-shift refueling/charging).
- **D-06:** Add optional `tankCapacityLitres` on `Vehicle` (shown in Admin Vehicles create/edit) and enforce upper-bound validation on Petrol/Diesel fuel readings against `tankCapacityLitres` if set, falling back to sensible vehicle-type safety caps (`200 L` for vans/bikes/3-wheelers, `500 L` for trucks) to reject accidental typos.
- **D-07:** Align `DriverVehicleCheckPage` fuel input with `ShiftTelemetryModal`: adapt the input label, step, and validation cleanly to **Litres (`L`)** for Petrol/Diesel vehicles and **`0–100%` Battery Charge** for Electric vehicles instead of a hardcoded `0–100%` slider.
- **D-08:** Persist `lastFuelLitres` on `Vehicle` (alongside `batterySoC` for EVs) across Shift Start, Shift End, and Pre-Trip Inspection, and show `'Last recorded: X L / X%'` inside telemetry and inspection forms.

### Order, Delivery & Form Validation Polish
- **D-09:** Bring Create and Edit Consignment/Delivery forms and API endpoints (`createDelivery`, `updateDelivery`) to full validation parity: enforce `weightKg > 0`, `volumeM3 >= 0`, `serviceDurationMinutes > 0`, `timeWindow.start < timeWindow.end`, and clean customer/driver phone & 6-digit pincode format checks.
- **D-10:** Preserve multi-vehicle auto-splitting in batch/route optimization rather than blocking dispatch on single-vehicle cargo caps.
- **D-11:** Block Driver Clock In (`startShift`) if the assigned vehicle's status is `MAINTENANCE` or `RETIRED`, and show a non-blocking warning banner when today's Pre-Trip Inspection is missing or failed.
- **D-12:** Add Admin/Fleet resource integrity guards: block retiring, deleting, or re-pairing a vehicle or driver while an `IN_PROGRESS` shift or active `DISPATCHED`/`IN_PROGRESS` route is running; validate positive numeric capacity/efficiency fields (`capacityKg`, `kmPerLitre`, `energyKWhPerKm`); enforce `cost >= 0` and `nextServiceDate >= serviceDate` on maintenance records (`logMaintenance`).

### Delivery Execution State Guards
- **D-13:** Lock terminal delivery states (`COMPLETED` and `FAILED`) on driver execution endpoints (`markDeliveryArrived`, `completeDelivery`, `failDelivery`) so drivers cannot accidentally double-tap or re-transition finished stops unless Fleet Operations explicitly resets a `FAILED` order back to `READY`.

### CSV Import & Batch Readiness Checks
- **D-14:** Upgrade `csvVehicleImportService.js` and `csvImportService.js` dry-run validation (`dryRun: true`) to normalize plate/order references (trim + uppercase) and detect collisions against existing DB records (`Vehicle.vehicleId`, `Delivery.orderReference`) before live commit.
- **D-15:** Guard batch creation/deletion (`batchController.js`): block creating batches containing already `COMPLETED` or `OUT_FOR_DELIVERY` consignments, and prevent deleting/closing batches that have active `DISPATCHED` or `IN_PROGRESS` routes.

### Input Normalization & Admin Account Safety
- **D-16:** Standardize input trimming, plate/order uppercasing, and `min` attributes (`min={0}` / `min={0.01}`) across client forms and backend controllers so negative values are caught early.
- **D-17:** Enforce Last-Admin protection on user management endpoints: prevent deleting or demoting the last remaining `ADMIN` user (and prevent an Admin from accidentally removing their own `ADMIN` access when no other Admin exists).

### the agent's Discretion
- Exact inline warning copy and color styling (following Phase 06 dark-mode palette).
- Exact upper safety bounds per vehicle category when `tankCapacityLitres` is omitted (`200 L` bikes/vans vs `500 L` trucks).

### Deferred Ideas (OUT OF SCOPE)
- **Delivery POD & strict OTP verification checks**: Enforcing mandatory OTP verification on `completeDelivery`, recipient proof completeness, and strict numeric `temperatureReading` validation on POD submission were explicitly marked by the user as future scope.
</user_constraints>

## Summary

Phase 09 hardens SmartRoute's operational reliability across the full stack without introducing any new external dependencies. All changes extend existing Mongoose schemas, Express controllers/services, and React/TypeScript forms using the codebase's established `AppError(message, statusCode, code)` error envelope `[VERIFIED: server/src/middleware/errorHandler.js:6-15]`, Phase 06 obsidian dark-mode tokens `[CITED: .planning/phases/06-dark-mode-unification-and-sidebar-polish/06-UI-SPEC.md]`, and Phase 08 shift telemetry modal patterns `[CITED: .planning/phases/08-driver-shift-odometer-and-savings/08-CONTEXT.md]`.

Codebase inspection uncovered several critical gaps that planning must account for explicitly:
1. **`VehiclesPage.tsx` does not exist** — the fleet vehicles page is `client/src/pages/admin/FleetsPage.tsx` `[VERIFIED: client/src/App.tsx:9,71]`, and it currently has only Create Vehicle and CSV Import modals (no Edit Vehicle modal, no Retire action, no Log Maintenance modal, and `FleetApi` in `client/src/api/client.ts` lacks `updateVehicle`, `deleteVehicle`, `logMaintenance`).
2. **`UsersPage.tsx` does not exist in `client/src/`** — user management currently exists only as backend API endpoints in `server/src/routes/adminRoutes.js:24-28` and `server/src/controllers/adminController.js:144-370` (which currently lacks a `DELETE /users/:id` route and lacks Last-Admin checks when editing/deactivating *another* Admin account).
3. **`VehicleChecklist.js` hardcodes `max: 100`** on `fuelOrBatteryLevelPercent` `[VERIFIED: server/src/models/VehicleChecklist.js:42-47]`, and `DriverVehicleCheckPage.tsx` auto-prefills `odometer` and caps fuel at `100` (`%`) `[VERIFIED: client/src/pages/driver/DriverVehicleCheckPage.tsx:55-62,181-189]`. For Petrol/Diesel trucks (cap `500 L`) and vans/bikes (cap `200 L`), `VehicleChecklist` must relax `max: 100` and store/validate units cleanly (`L` vs `%`) while preserving backward compatibility with existing tests (`TC-HUD-CHECK-1` / `TC-HUD-CHECK-2`).
4. **`ConsignmentDrawer.tsx` has no Edit form**, and `DeliveriesPage.tsx` New Consignment modal omits `volumeM3`, `serviceDurationMinutes`, `postalCode`, and `timeWindow` inputs, while `BatchComposerPanel.tsx:64,79-82,124` hard-blocks batch creation when payload exceeds a single selected vehicle's capacity (conflicting with D-10 multi-vehicle bin packing in `routeController.js:425`).

**Primary recommendation:** Implement shared backend validation helpers (tank cap calculation, consignment payload validation, active-operation conflict checks, Last-Admin count checks) and matching client inline validation + modal/drawer extensions so client feedback and server `400`/`409` enforcement stay in lockstep while keeping all 67 baseline tests green.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Odometer continuity, tank caps, maintenance & resource interlocks | API / Backend (`controllers/`, `models/`) | Browser / Client (`ShiftTelemetryModal`, `DriverVehicleCheckPage`, `FleetsPage`) | Client provides immediate inline hints (`Last recorded: X km`), warnings, and `min`/`max` bounds; backend enforces authoritative `400`/`409` invariants against MongoDB state |
| Vehicle telemetry state persistence (`lastOdometerKm`, `lastFuelLitres`, `batterySoC`, `tankCapacityLitres`) | Database / Storage (`Vehicle.js`, `VehicleChecklist.js`, `DriverShift.js`) | API / Backend (`driverHudController.js`, `vehicleController.js`) | Schema invariants and atomic updates ensure telemetry continuity survives shift boundaries and inspections |
| Consignment Create/Edit parity & phone/pincode normalization | API / Backend (`deliveryController.js`, `Delivery.js`) | Browser / Client (`DeliveriesPage.tsx`, `ConsignmentDrawer.tsx`) | Shared server validator enforces identical rules on `POST` and `PUT`; client forms collect and normalize matching fields |
| Multi-vehicle batch composition & optimization | API / Backend (`routeController.js`, `binPacker.js`) | Browser / Client (`BatchComposerPanel.tsx`) | `packDeliveries` splits stops across multiple vehicles; batch composition must warn rather than block when single-vehicle cap is exceeded |
| Delivery terminal-state locking (`COMPLETED`/`FAILED`) | API / Backend (`driverHudController.js`) | Browser / Client (`DriverRoutePage.tsx`, `DriverDeliveriesPage.tsx`) | Backend rejects double-tap/re-transition with `400`; Driver UI disables/hides action buttons on terminal stops |
| CSV dry-run DB collision detection & batch guards | API / Backend (`csvVehicleImportService.js`, `csvImportService.js`, `batchController.js`) | Browser / Client (`FleetsPage.tsx`, `CsvImportModal.tsx`, `BatchesPage.tsx`) | Dry-run queries MongoDB for normalized `vehicleId`/`orderReference` collisions before commit |
| Last-Admin lockout protection | API / Backend (`adminController.js`, `adminRoutes.js`) | — | Server counts remaining active `ADMIN` accounts before role demotion, suspension, or deletion |

## Standard Stack

### Core
No new external packages are required for Phase 09. All work uses the verified project stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^4.19.2` | REST API routing & middleware | Verified in `[VERIFIED: server/package.json:20]` |
| `mongoose` | `^8.3.1` | MongoDB schemas, validation hooks & atomic queries | Verified in `[VERIFIED: server/package.json:25]` |
| `papaparse` | `^5.4.1` | CSV manifest & vehicle parsing | Verified in `[VERIFIED: server/package.json:28]` |
| `react` | `^18.3.1` | Frontend UI components & forms | Verified in `[VERIFIED: client/package.json:20]` |
| `typescript` | `^5.9.3` | Static type checking (`tsc --noEmit`) | Verified in `[VERIFIED: client/package.json:37]` |
| `axios` | `^1.7.2` | HTTP client with semantic error interceptor | Verified in `[VERIFIED: client/package.json:14]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` / `supertest` | `^29.7.0` / `^6.3.4` | Backend integration & unit tests | Verified in `[VERIFIED: server/package.json:34,37]` |
| `lucide-react` | `^0.378.0` | Alert, warning, gauge, and edit icons | Verified in `[VERIFIED: client/package.json:18]` |
| `tailwindcss` | `^3.4.3` | Phase 06 obsidian dark-mode styling | Verified in `[VERIFIED: client/package.json:36]` |

**Installation:**
```bash
# No new npm packages required for Phase 09
```

## Package Legitimacy Audit

*Phase 09 installs zero new external packages. All dependencies listed in Standard Stack are pre-existing in `server/package.json` and `client/package.json`.*

## Architecture Patterns

### System Architecture Diagram

```
[Driver / Admin Browser UI]
   │  (inline min/max, phone/pincode, "Last recorded: X km / X L" hints, non-blocking warnings)
   ▼
[Express API Routes + Auth/Role Middleware]
   │
   ├──► [driverHudController] ──► (MAINTENANCE/RETIRED block, odo >= lastOdometerKm, tank cap, terminal delivery lock)
   │                                  └──► updates Vehicle.{lastOdometerKm, lastFuelLitres, batterySoC} + DriverShift / VehicleChecklist
   ├──► [vehicleController]   ──► (admin odo override allowed, positive capacity/efficiency, cost >= 0, nextServiceDate >= serviceDate, active shift/route lock)
   ├──► [driverController]    ──► (1:1 pairing blocked during IN_PROGRESS shift or DISPATCHED/IN_PROGRESS route)
   ├──► [deliveryController]  ──► (shared validateDeliveryPayload on create & update, batch weight delta sync)
   ├──► [batchController]     ──► (blocks COMPLETED/OUT_FOR_DELIVERY on create/add, blocks delete/close with active routes)
   ├──► [csvImport / csvVehicleImport] ──► (trim+uppercase normalization + DB collision check in dryRun=true)
   └──► [adminController]     ──► (Last-Admin guard on PUT /users/:id, PATCH /users/:id/status, DELETE /users/:id)
   │
   ▼
[MongoDB Collections: Vehicle, Driver, DriverShift, VehicleChecklist, Delivery, DeliveryBatch, Route, MaintenanceRecord, User]
```

### Exact Schema, Endpoint & Component Contracts (Verified from Codebase)

#### 1. `Vehicle` Model & Vehicle Endpoints (D-01, D-03, D-06, D-08, D-12, D-16)
- **Existing schema fields** `[VERIFIED: server/src/models/Vehicle.js:4-88]`:
  - `vehicleId` (uppercase, trimmed, unique), `makeModel` (trimmed), `type` (`'Bike' | 'Van' | 'Truck'`), `capacityKg` (`min: 0.1`), `capacityM3` (`min: 0.01, default: null`), `fuelType` (`'Petrol' | 'Diesel' | 'Electric'`), `kmPerLitre` (`min: 0.1, default: null`), `energyKWhPerKm` (`min: 0.01, default: null`), `availability` (`'AVAILABLE' | 'ASSIGNED' | 'IN_TRANSIT' | 'MAINTENANCE' | 'RETIRED'`), `assignedDriverId`, `batterySoC` (`min: 0, max: 100, default: null`).
- **New schema fields to add to `server/src/models/Vehicle.js`:**
  - `lastOdometerKm: { type: Number, min: [0, 'Last odometer reading cannot be negative'], default: null }`
  - `lastFuelLitres: { type: Number, min: [0, 'Last fuel level cannot be negative'], default: null }`
  - `tankCapacityLitres: { type: Number, min: [0.1, 'Tank capacity must be strictly positive'], default: null }`
- **Client TypeScript interface `Vehicle`** `[VERIFIED: client/src/types/index.ts:29-42]`:
  - Add optional `lastOdometerKm?: number | null; lastFuelLitres?: number | null; tankCapacityLitres?: number | null;`.
- **Fuel/Tank cap rule (D-06):**
  - Electric (`String(vehicle.fuelType).toUpperCase() === 'ELECTRIC'`): `0` to `100` (`%`).
  - Petrol / Diesel: upper cap `= (vehicle.tankCapacityLitres && vehicle.tankCapacityLitres > 0) ? vehicle.tankCapacityLitres : (vehicle.type === 'Truck' ? 500 : 200)` (`L`).
- **`vehicleController.js` changes:**
  - `createVehicle` (`POST /api/v1/vehicles`, lines 79-130): trim `makeModel`, uppercase+trim `vehicleId`; validate `capacityKg > 0`, `capacityM3 > 0` (when supplied), `kmPerLitre > 0` (non-EV) or `energyKWhPerKm > 0` (EV), `lastOdometerKm >= 0` (when supplied), `tankCapacityLitres > 0` (when supplied), `batterySoC` in `[0, 100]` (when supplied).
  - `updateVehicle` (`PUT /api/v1/vehicles/:id`, lines 161-198): support updating `makeModel`, `type`, `capacityKg`, `capacityM3`, `fuelType`, `availability`, `batterySoC`, `kmPerLitre`, `energyKWhPerKm`, `lastOdometerKm`, `lastFuelLitres`, `tankCapacityLitres`. Per **D-03**, allow Admin/Fleet Manager to set `lastOdometerKm` to any non-negative number (`>= 0`), including lowering it to fix a typo. If changing `availability` to `'RETIRED'`, enforce the active shift / active route guard (D-12).
  - `deleteVehicle` (`DELETE /api/v1/vehicles/:id`, lines 203-230): before retiring, check `DriverShift.exists({ vehicleId: vehicle._id, status: SHIFT_STATUS.IN_PROGRESS })` OR `Route.exists({ vehicleId: vehicle._id, status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } })` OR `vehicle.availability === VEHICLE_STATUS.IN_TRANSIT` (and if paired to a driver, check `DriverShift.exists({ driverId: vehicle.assignedDriverId, status: SHIFT_STATUS.IN_PROGRESS })`). Throw `AppError(..., 409, 'VEHICLE_IN_ACTIVE_USE')`.
  - `logMaintenance` (`POST /api/v1/vehicles/:id/maintenance`, lines 236-276): validate `cost !== undefined && cost !== null && cost !== ''`: `Number(cost)` must be finite and `>= 0` (`400`, `INVALID_MAINTENANCE_COST`); validate `serviceDate` is valid; if `nextServiceDate` is provided, validate it is a valid Date and `new Date(nextServiceDate) >= new Date(serviceDate)` (`400`, `INVALID_SERVICE_DATE_RANGE`). Also mirror `nextServiceDate >= serviceDate` in `server/src/models/MaintenanceRecord.js` `pre('validate')` hook.

#### 2. `DriverHudController`, `VehicleChecklist`, `ShiftTelemetryModal` & `DriverVehicleCheckPage` (D-01, D-02, D-04, D-05, D-07, D-08, D-11, D-13)
- **`VehicleChecklist.js` schema** `[VERIFIED: server/src/models/VehicleChecklist.js:37-47]`:
  - Currently `fuelOrBatteryLevelPercent` has `min: 0, max: 100, default: 100`.
  - **Change:** Remove `max: 100` from `fuelOrBatteryLevelPercent` on the Mongoose schema (keep `min: 0`) and add `fuelUnit: { type: String, enum: ['L', '%'], default: 'L' }` so Diesel/Petrol vehicles can log `> 100 L` (up to `tankCapacityLitres` or `200`/`500 L`) without Mongoose throwing a `ValidationError`, while Electric vehicles enforce `0..100` in controller validation and existing tests passing `fuelOrBatteryLevelPercent: 92` continue working.
- **`driverHudController.js:getDashboard`** `[VERIFIED: server/src/controllers/driverHudController.js:192-223]`:
  - Expose on `data.vehicle`:
    - `lastOdometerKm: v.lastOdometerKm ?? null`
    - `lastFuelLitres: v.lastFuelLitres ?? null`
    - `tankCapacityLitres: v.tankCapacityLitres ?? null`
    - `batteryLevelPercent`: already uses active shift or `v.batterySoC ?? latestChecklist?.fuelOrBatteryLevelPercent ?? null`
    - `fuelRemainingLitres`: update fallback to `activeShift?.startFuelOrCharge ?? v.lastFuelLitres ?? null` (for non-EV).
- **`driverHudController.js:startShift`** `[VERIFIED: server/src/controllers/driverHudController.js:266-371]`:
  - **D-11 vehicle status check:** If `vehicle` exists and `[VEHICLE_STATUS.MAINTENANCE, VEHICLE_STATUS.RETIRED].includes(vehicle.availability)`, throw `new AppError(\`Cannot start shift: assigned vehicle \${vehicle.vehicleId} is currently \${vehicle.availability}.\`, 400, 'VEHICLE_UNAVAILABLE_FOR_SHIFT')`.
  - **D-02 odometer continuity:** If `vehicle && vehicle.lastOdometerKm !== null && vehicle.lastOdometerKm !== undefined && startOdometerKm !== null && startOdometerKm < vehicle.lastOdometerKm`, throw `new AppError(\`Starting odometer (\${startOdometerKm} km) cannot be less than vehicle's last recorded odometer (\${vehicle.lastOdometerKm} km).\`, 400, 'INVALID_ODOMETER_READING')`.
  - **D-06 tank cap:** When `!isElectric && startFuelOrCharge !== null`, validate `startFuelOrCharge <= tankCap` (throw `400`, `INVALID_FUEL_LEVEL`).
  - **D-01 & D-08 vehicle update:** When `vehicle?._id`, build update object: if `startOdometerKm !== null`, set `lastOdometerKm = startOdometerKm`; if `startFuelOrCharge !== null`, set `batterySoC = Math.round(startFuelOrCharge)` (if EV) or `lastFuelLitres = startFuelOrCharge` (if non-EV). Persist with `Vehicle.findByIdAndUpdate(vehicle._id, vehicleUpdates)`.
- **`driverHudController.js:endShift`** `[VERIFIED: server/src/controllers/driverHudController.js:395-529]`:
  - **D-02 odometer continuity:** Validate `endOdometerKm` against `Math.max(shift?.startOdometerKm ?? -1, vehicle?.lastOdometerKm ?? -1)` when `endOdometerKm !== null`.
  - **D-06 tank cap:** Validate `!isElectric && endFuelOrCharge > tankCap` -> `400`, `INVALID_FUEL_LEVEL`.
  - **D-01 & D-08 vehicle update:** When `vehicle?._id`, update `lastOdometerKm = endOdometerKm` (if non-null), and `batterySoC = Math.round(endFuelOrCharge)` (if EV) or `lastFuelLitres = endFuelOrCharge` (if non-EV).
- **`driverHudController.js:submitVehicleCheck`** `[VERIFIED: server/src/controllers/driverHudController.js:535-637]`:
  - Accept `fuelLevel = parseNumericField(req.body.remainingFuelOrCharge ?? req.body.fuelOrChargeLevel ?? req.body.fuelOrBatteryLevelPercent)` and `odoKm = parseNumericField(req.body.odometerReadingKm)`.
  - Validate `odoKm !== null`: finite, `>= 0`, and if `vehicle.lastOdometerKm != null && odoKm < vehicle.lastOdometerKm`, throw `400` (`INVALID_ODOMETER_READING`).
  - Validate `fuelLevel !== null`: finite, `>= 0`, and `<= 100` (if EV) or `<= tankCap` (if Petrol/Diesel) -> else throw `400` (`INVALID_FUEL_LEVEL`).
  - Store `fuelUnit: isElectric ? '%' : 'L'` on `VehicleChecklist`, and advance `vehicle.lastOdometerKm`, `vehicle.lastFuelLitres` (non-EV) / `vehicle.batterySoC` (EV) on `vehicle`, then `await vehicle.save()`!
- **`driverHudController.js` delivery execution terminal-state locks (D-13)** `[VERIFIED: server/src/controllers/driverHudController.js:817-1019]`:
  - On `markDeliveryArrived` (line 817), `completeDelivery` (line 861), and `failDelivery` (line 939):
    - Verify `if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED].includes(delivery.status))` -> throw `new AppError(\`Consignment \${delivery.orderReference} is already in terminal status '\${delivery.status}' and cannot be modified.\`, 400, 'DELIVERY_TERMINAL')`.
    - Also verify BOLA ownership for `ROLES.DRIVER` (matching `getDeliveryById` lines 740-749) so a driver cannot mutate an unassigned/other driver's stop.
    - Keep accepting transitions from `ASSIGNED` / `READY` / `OUT_FOR_DELIVERY` on `completeDelivery` and `failDelivery` so existing `driver_hud.test.js` (`TC-HUD-DEL-2`, `TC-HUD-DEL-3`) remains green.
- **`ShiftTelemetryModal.tsx` contract** `[VERIFIED: client/src/components/driver/ShiftTelemetryModal.tsx:6-26]`:
  - Extend `vehicle` prop type to include `lastOdometerKm?: number | null; lastFuelLitres?: number | null; batteryLevelPercent?: number | null; tankCapacityLitres?: number | null; type?: string;`.
  - Add optional `serverError?: string | null` prop (or catch thrown error in `onSubmit`) so server `400` errors render inside the modal's error banner (`z-50` modal wouldn't obscure them behind backdrop).
  - Show `'Last recorded: X km'` as `helperText` and `placeholder={lastOdo != null ? \`Last recorded: \${lastOdo} km\` : 'e.g. 12450.5'}` (never prefill `odometerInput`).
  - Show `'Last recorded: X L'` (or `'Last recorded: X%'` for EV) as `helperText` on the fuel/charge input.
  - Validate `parsedOdo < lastOdo` inline before submit (`Last recorded: X km`).
  - Validate `parsedFuel > tankCap` (when non-EV) or `> 100` (when EV) inline before submit.
  - **D-05 non-blocking warning in `END` mode:** When `mode === 'END' && startFuelOrCharge !== null && parsedFuel !== null && Number.isFinite(parsedFuel) && parsedFuel > startFuelOrCharge`, render an amber warning alert (`bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300`) noting mid-shift refuel/recharge, without disabling submit.
- **`DriverVehicleCheckPage.tsx` contract** `[VERIFIED: client/src/pages/driver/DriverVehicleCheckPage.tsx:15-193]`:
  - Remove `setOdometer(String(latest.odometerReadingKm))` and `setFuelLevel(Number(...))` auto-prefills (lines 55-62) — keep inputs empty (`''`) on load.
  - Show `'Last recorded: X km'` and `'Last recorded: X L'` / `'X%'` helper text and placeholder.
  - Adapt fuel/charge field dynamically using `isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC'`:
    - Label: `Remaining Battery Charge (%)` vs `Fuel Remaining (Litres)`
    - Step: `1` (EV) vs `0.1` (Petrol/Diesel)
    - `min="0"`, `max={isElectric ? 100 : tankCap}`
  - Inline validate odometer (`>= 0`, `>= vehicle.lastOdometerKm`) and fuel/charge (`0..100%` or `0..tankCap L`) before submitting `DriverHudApi.submitVehicleCheck`.
- **`DriverCockpitPage.tsx` contract** `[VERIFIED: client/src/pages/driver/DriverCockpitPage.tsx:254-314]`:
  - **D-11:** Show non-blocking amber warning banner when `vehicle` is assigned and (`!dashboardData?.latestChecklist` or `['FAILED_CRITICAL', 'NEEDS_ATTENTION'].includes(dashboardData?.latestChecklist?.status)`), with a button to `/driver/vehicle-check`.
  - **D-11:** If `vehicle?.status === 'MAINTENANCE' || vehicle?.status === 'RETIRED'`, show clear blocked status badge/banner and disable Clock In (and block pre-delivery gate from opening `ShiftTelemetryModal` with a clear toast/notice).
  - **D-04:** Do NOT add `lastOdometerKm` to `DriverVehicleStatusCard.tsx`.

#### 3. Admin Fleet, Driver & Maintenance Integrity (D-01, D-03, D-04, D-06, D-12, D-16)
- **`FleetsPage.tsx` (named `VehiclesPage.tsx` in `09-CONTEXT.md`)** `[VERIFIED: client/src/pages/admin/FleetsPage.tsx:12-260]`:
  - Keep fleet table minimal per **D-04** (do NOT add an odometer column to `vehicleColumns`).
  - Upgrade **Create Vehicle** modal:
    - Switch efficiency field cleanly between `Fuel Efficiency (km/L)` (`kmPerLitre`, `min="0.1"`, `step="0.1"`) for Petrol/Diesel and `Energy Efficiency (kWh/km)` (`energyKWhPerKm`, `min="0.01"`, `step="0.01"`) for Electric.
    - Add optional `lastOdometerKm` (`min="0"`, `step="0.1"`), `tankCapacityLitres` (`min="1"`, `step="0.5"`, shown for Petrol/Diesel), and `capacityM3` (`min="0.01"`, `step="0.1"`).
    - Add `min="0.1"` on `capacityKg`; trim `makeModel` and uppercase+trim `vehicleId` on submit.
  - Add **Edit Vehicle** modal (`FleetApi.updateVehicle(id, data)` -> `PUT /api/v1/vehicles/:id`):
    - Allow editing `makeModel`, `capacityKg`, `capacityM3`, `availability`, `kmPerLitre`/`energyKWhPerKm`, `batterySoC`, `tankCapacityLitres`, and overriding `lastOdometerKm` (per **D-03**).
  - Add **Log Maintenance** modal (`FleetApi.logMaintenance(id, data)` -> `POST /api/v1/vehicles/:id/maintenance`):
    - Inputs: `serviceDate`, `type`, `cost` (`min="0"`), `nextServiceDate`, `notes`. Inline validate `cost >= 0` and `nextServiceDate >= serviceDate` when `nextServiceDate` is entered.
  - Add **Retire Vehicle** action (`FleetApi.deleteVehicle(id)` -> `DELETE /api/v1/vehicles/:id`, visible for `ADMIN` per `vehicleRoutes.js:20`), surfacing `409` active-operation conflict messages cleanly.
- **`driverController.js` & `adminController.js:overrideFleetResource` (D-12)**:
  - Extract a shared helper (e.g., `assertNoActiveDriverOrVehicleOperations({ driverId, vehicleId })` in `server/src/services/resourceGuardService.js` or inline helper) that queries:
    - `DriverShift.exists({ status: SHIFT_STATUS.IN_PROGRESS, $or: [...] })`
    - `Route.exists({ status: { $in: ['DISPATCHED', 'IN_PROGRESS'] }, $or: [...] })`
  - Enforce in:
    - `driverController.assignVehicle` (`PUT /api/v1/drivers/:id/assign`): check target driver, driver's *current* vehicle (if being replaced!), target vehicle, and any *former* driver on target vehicle for `IN_PROGRESS` shift or `DISPATCHED`/`IN_PROGRESS` route (`409`, `ACTIVE_OPERATION_CONFLICT`). Note: keep `VEHICLE_IN_ACTIVE_TRANSIT` / `DRIVER_IN_ACTIVE_TRANSIT` checks intact for `IN_TRANSIT` status!
    - `driverController.unassignVehicle` (`PUT /api/v1/drivers/:id/unassign`): check driver and `driver.assignedVehicleId` for `IN_PROGRESS` shift or `DISPATCHED`/`IN_PROGRESS` route (`409`, `ACTIVE_OPERATION_CONFLICT`).
    - `adminController.overrideFleetResource` (`POST /api/v1/admin/fleet-control/override`): block `RETIRE` on a vehicle with `IN_PROGRESS` shift or active `DISPATCHED`/`IN_PROGRESS` route, and block `FORCE_OFF_DUTY` if driver has an `IN_PROGRESS` shift or `DISPATCHED`/`IN_PROGRESS` route? Wait — check carefully: `TC-ADMIN-FLEET-1` tests `SUSPEND_MAINTENANCE` on an idle vehicle. Blocking `RETIRE` (and `SUSPEND_MAINTENANCE` only if an active shift/route is running, or strictly `RETIRE` per D-12: *"block retiring, deleting, or re-pairing a vehicle or driver while an `IN_PROGRESS` shift or active `DISPATCHED`/`IN_PROGRESS` route is running"* — keeping `RETIRE` blocked on active shift/route matches D-12 word-for-word without restricting emergency maintenance override if needed!).

#### 4. Consignment Create/Edit Parity & Multi-Vehicle Batch Splitting (D-09, D-10, D-16)
- **Shared Consignment Validator (`deliveryController.js`):**
  - Extract `validateAndNormalizeDeliveryInput(payload, { isUpdate })`:
    - `orderReference` (create only): trimmed & uppercased.
    - `customer.name`: trimmed, non-empty.
    - `customer.phone`: trimmed; extract digits `phone.replace(/\D/g, '')` -> require `10 <= digits.length <= 15` and valid characters `/^\+?[0-9\s\-()]{10,20}$/`.
    - `address.street`: trimmed, non-empty.
    - `address.postalCode`: trimmed; require `/^\d{6}$/` (`400`, `INVALID_POSTAL_CODE`).
    - `weightKg`: finite number `> 0` (`400`, `INVALID_WEIGHT`).
    - `volumeM3`: finite number `>= 0` (`400`, `INVALID_VOLUME`).
    - `serviceDurationMinutes`: finite number `> 0` (`400`, `INVALID_SERVICE_DURATION`).
    - `timeWindow`: both `start` and `end` match `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/` and `start < end` (`400`, `INVALID_TIME_WINDOW`).
  - Use this validator in BOTH `createDelivery` and `updateDelivery` (`PUT /api/v1/deliveries/:id`).
  - When `updateDelivery` changes `weightKg` on a delivery that belongs to a `batchId`, also update `DeliveryBatch.metrics.totalWeightKg` by the weight delta so batch metrics never drift!
- **`DeliveriesPage.tsx` & `ConsignmentDrawer.tsx`**:
  - `DeliveriesPage.tsx`: add `postalCode` (6-digit, default `'751024'`), `volumeM3` (`min={0}`), `serviceDurationMinutes` (`min={1}`), `timeWindow.start` & `timeWindow.end` (`type="time"`), plus inline validation & uppercase/trim normalization to New Consignment modal.
  - `ConsignmentDrawer.tsx`: add an "Edit Consignment" toggle/mode (enabled when `status` is `DRAFT`, `READY`, or `ASSIGNED`, disabled when locked `OUT_FOR_DELIVERY` / `COMPLETED` / `FAILED`), calling `DeliveriesApi.update(delivery.id, ...)` with the exact same validation rules and `min` attributes!
- **`BatchComposerPanel.tsx` (D-10)** `[VERIFIED: client/src/components/deliveries/BatchComposerPanel.tsx:60-83,124,214-219]`:
  - Remove the hard block `if (isOverloaded)` in `handleSubmit` and remove `|| isOverloaded` from `disabled` on the "Create Batch" button!
  - Instead, when `isOverloaded` is true, display a **non-blocking amber warning** (`"Payload (${totalWeightKg.toFixed(1)} kg) exceeds single selected vehicle cap (${maxCapacityKg} kg) — Route Optimizer will split across multiple fleet vehicles automatically."`) and allow creating the batch (even with multiple vehicles or unassigned vehicle).

#### 5. CSV Dry-Run DB Duplicate Detection & Batch Guards (D-14, D-15)
- **`csvVehicleImportService.js`** `[VERIFIED: server/src/services/csvVehicleImportService.js:21-114]`:
  - Normalize `vehicleId = safeTrim(row.vehicleId || row.VehicleID || row.vehicle_id).toUpperCase()`.
  - Validate `capacityKg > 0`, `capacityM3 > 0` (if present), `tankCapacityLitres > 0` (if present), `lastOdometerKm >= 0` (if present).
  - In `processVehicleCsv`, before the validation loop, query `const dbCollisions = await Vehicle.find({ vehicleId: { $in: incomingIds } }).select('vehicleId').lean()` and flag collisions in `summary.errors` during **both** `dryRun: true` and `dryRun: false` (`field: 'vehicleId'`, `message: "Vehicle ID '...' already exists in database"`).
  - When `!dryRun && summary.errors.length > 0`, throw `AppError` / `422` without partial writes (matching `csvImportService.js:283-288`).
  - Also in `FleetsPage.tsx` and `DriversPage.tsx`, display `errors` cleanly (not capped silently without total count) and disable commit or encourage dry-run verification cleanly.
- **`csvImportService.js`** `[VERIFIED: server/src/services/csvImportService.js:38-280]`:
  - Already normalizes `orderReference` (`trim` + `.toUpperCase()`) and queries `Delivery.find({ orderReference: { $in: incomingRefs } })` in `dryRun: true`.
  - Add parity checks in `validateRow` for `volumeM3 >= 0` (reject negative values rather than silently letting Mongoose fail at commit time), `serviceDurationMinutes > 0`, and 6-digit `postalCode` (when non-default) + clean phone digit check (`>= 10` digits, compatible with `adversarial_csv_batch.test.js` numeric `9861012345`).
- **`batchController.js` (D-15)** `[VERIFIED: server/src/controllers/batchController.js:87-155,302-364,529-586]`:
  - `createBatch`: if `deliveryIds.length > 0`, verify all IDs exist and check every delivery's status — block if any delivery is `COMPLETED` or `OUT_FOR_DELIVERY` (or `'CANCELLED'`) with `400` (`INELIGIBLE_DELIVERY_STATUS`). Also check if any delivery is already bound to an active `DISPATCHED`/`IN_PROGRESS` route (`409`, `DELIVERY_IN_ACTIVE_ROUTE`).
  - `addDeliveriesToBatch`: expand existing line 325 check (`COMPLETED`, `CANCELLED`) to also block `OUT_FOR_DELIVERY` (`400`, `INELIGIBLE_DELIVERY_STATUS`).
  - `deleteBatch` & `updateBatchStatus` (`status === 'CLOSED'`): check `await Route.exists({ batchId: batch._id, status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } })`; if truthy, throw `new AppError(\`Cannot \${action} batch \${batch.code} while active routes are DISPATCHED or IN_PROGRESS.\`, 409, 'BATCH_HAS_ACTIVE_ROUTES')`.

#### 6. Last-Admin Protection (D-17)
- **`adminController.js` & `adminRoutes.js`** `[VERIFIED: server/src/controllers/adminController.js:232-329, server/src/routes/adminRoutes.js:24-28]`:
  - Existing `updateUser` (`PUT /api/v1/admin/users/:id`) and `updateUserStatus` (`PATCH /api/v1/admin/users/:id/status`) already block self-demotion (`SELF_DEMOTION_BLOCKED`, `403`) and self-suspension (`SELF_SUSPENSION_BLOCKED` / `SELF_LOCKOUT_PREVENTED`, `403`).
  - **Add Last-Admin guard** in `updateUser`, `updateUserStatus`, and a new `deleteUser` (`DELETE /api/v1/admin/users/:id`):
    - Before changing `role` away from `'ADMIN'`, setting `accountStatus` to `'INACTIVE'` / `'SUSPENDED'`, or deleting a user whose `user.role === ROLES.ADMIN && user.accountStatus === 'ACTIVE' && user.active`:
      ```js
      const otherActiveAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: ROLES.ADMIN,
        accountStatus: 'ACTIVE',
        active: true,
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(
          'Cannot demote, deactivate, or delete the last remaining active administrator.',
          409,
          'LAST_ADMIN_PROTECTED'
        );
      }
      ```
    - In `deleteUser`, also block self-deletion (`id === req.user.id` -> `403`, `SELF_LOCKOUT_PREVENTED`) before checking `otherActiveAdmins === 0`.

### Anti-Patterns to Avoid
- **Auto-prefilling driver odometer inputs:** Never pre-populate `odometer` in `ShiftTelemetryModal` or `DriverVehicleCheckPage` — drivers would just click Submit without reading the dashboard gauge (violates D-02).
- **Blocking Admin odometer corrections:** Never apply the strictly non-decreasing odometer guard to `PUT /api/v1/vehicles/:id` — Admin/Fleet Manager must be able to correct an earlier driver typo (violates D-03).
- **Hard-blocking multi-vehicle batches on single-vehicle capacity:** `BatchComposerPanel` must not disable batch creation when selected deliveries exceed one vehicle's `capacityKg` (violates D-10).
- **Keeping `max: 100` on `VehicleChecklist.fuelOrBatteryLevelPercent`:** Fuel tanks on Petrol/Diesel vans and trucks exceed 100 L (up to 200 L / 500 L); leaving `max: 100` in Mongoose crashes valid inspections (violates D-06 & D-07).
- **Changing `TC-ADMIN-USER-2` or `TC-HUD-DEL-2` existing status codes:** Keep self-lockout as `403` (`SELF_LOCKOUT_PREVENTED`) and keep allowing `completeDelivery`/`failDelivery` from `ASSIGNED` in `driverHudController.js` (only locking terminal `COMPLETED`/`FAILED`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API error formatting & HTTP status mapping | Custom `res.status().json()` shapes per controller | `throw new AppError(message, statusCode, code)` in `server/src/middleware/errorHandler.js` | Guarantees consistent `{ success: false, message, error: { code, message, details, requestId } }` consumed by `client/src/api/client.ts` |
| Client-side error translation | Ad-hoc `err?.message` string parsing in components | `client/src/utils/errorUtils.ts` (`ERROR_CODE_TRANSLATIONS` + `err.friendlyMessage`) | Centralizes human-readable translations for new error codes (`LAST_ADMIN_PROTECTED`, `DELIVERY_TERMINAL`, `BATCH_HAS_ACTIVE_ROUTES`, `VEHICLE_UNAVAILABLE_FOR_SHIFT`) |
| CSV parsing | Manual `split(',')` line parsing | `papaparse` (`Papa.parse` with `header: true, skipEmptyLines: true`) | Handles quoted commas, CRLF, and header trimming identically across delivery, vehicle, and driver importers |
| Multi-vehicle load splitting | Single-vehicle weight sum rejection in batch composer | Existing `packDeliveries` in `server/src/services/optimization/binPacker.js` | Already implements priority-aware Best-Fit Decreasing across multiple vehicles |

## Common Pitfalls

### Pitfall 1: `DriverVehicleCheckPage.tsx` Auto-Prefill & `%` Cap Regression
**What goes wrong:** Currently `DriverVehicleCheckPage.tsx:55-62` calls `setOdometer(String(latest.odometerReadingKm))` and `setFuelLevel(Number(...))`, and line 185 sets `max="100"`. If only the backend changes, Petrol/Diesel drivers inspecting a truck with 150 L fuel get blocked by HTML5 `max="100"` or Mongoose `max: 100` on `VehicleChecklist`.
**How to avoid:** Update `VehicleChecklist.js` to remove `max: 100` (add `fuelUnit: { type: String, enum: ['L', '%'], default: 'L' }`), update `DriverVehicleCheckPage.tsx` to use empty string state with `'Last recorded: X km'` / `'Last recorded: X L / X%'` helper hints, and validate against `100` (EV) vs `tankCapacityLitres || (type === 'Truck' ? 500 : 200)` (Petrol/Diesel).
**Warning signs:** `ValidationError: fuelOrBatteryLevelPercent: Path 'fuelOrBatteryLevelPercent' (150) is more than maximum allowed value (100)`.

### Pitfall 2: Re-assigning a Driver Whose *Previous* Vehicle Has an Active Shift/Route
**What goes wrong:** In `driverController.js:assignVehicle`, checking only the *target* vehicle and driver availability misses the case where the driver's *previous* vehicle is in an `IN_PROGRESS` shift or the *former* driver on the target vehicle has an `IN_PROGRESS` shift (without `IN_TRANSIT` availability yet, e.g., clocked in at hub).
**How to avoid:** Query `DriverShift.exists({ status: SHIFT_STATUS.IN_PROGRESS, ... })` and `Route.exists({ status: { $in: ['DISPATCHED', 'IN_PROGRESS'] }, ... })` across all involved entities (target driver, driver's current vehicle, target vehicle, target vehicle's current driver) before unpairing or swapping.

### Pitfall 3: Delivery Weight Edit Desyncing `DeliveryBatch.metrics.totalWeightKg`
**What goes wrong:** When `updateDelivery` (`PUT /api/v1/deliveries/:id`) changes `weightKg` or `batchId`, `DeliveryBatch.metrics.totalWeightKg` becomes stale if not recalculated.
**How to avoid:** In `updateDelivery`, if `delivery.batchId` is present and `weightKg` (or `batchId`) changes, recalculate `metrics` on the affected batch(es) just like `batchController.js:recalculateBatchMetrics`.

### Pitfall 4: `ShiftTelemetryModal` Errors Hidden Behind `z-50` Backdrop
**What goes wrong:** `DriverCockpitPage.tsx:204` catches `startShift`/`endShift` errors and sets `toastMsg`, while `ShiftTelemetryModal` remains open with a `z-50` backdrop (`bg-black/65 backdrop-blur-sm`). If `Toast.tsx` has a lower or equal z-index, the user doesn't see why submission failed.
**How to avoid:** Pass `serverError` prop (or let `onSubmit` throw / return error message) so `ShiftTelemetryModal` renders server `400` errors inside its own inline red alert box (`lines 162-167`).

### Pitfall 5: `Batch` Status Enum vs `AdminOverview` Query Consistency
**What goes wrong:** `DeliveryBatch.js:73` defines `enum: ['DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED']`. Passing an arbitrary status string to `PATCH /api/v1/batches/:id/status` triggers Mongoose `ValidationError` unless validated cleanly, and closing a batch with active routes orphans live driver routes.
**How to avoid:** Validate `status` against `['DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED']` and block `CLOSED` / `DELETE` when `Route.exists({ batchId: batch._id, status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } })`.

## Code Examples

Verified patterns from existing project files:

### Tank Capacity & Telemetry Helper (Backend Pattern)
```javascript
// Matches server/src/config/constants.js VEHICLE_TYPES & FUEL_TYPES
function getFuelUpperCap(vehicle) {
  const isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';
  if (isElectric) return { isElectric: true, unit: '%', max: 100 };
  const customCap = Number(vehicle?.tankCapacityLitres);
  if (Number.isFinite(customCap) && customCap > 0) {
    return { isElectric: false, unit: 'L', max: customCap };
  }
  const isTruck = String(vehicle?.type || '').toUpperCase() === 'TRUCK';
  return { isElectric: false, unit: 'L', max: isTruck ? 500 : 200 };
}
```
*Source: Derived from `server/src/config/constants.js:24-34` and `09-CONTEXT.md` D-06.*

### Last-Admin Guard Pattern (Backend Pattern)
```javascript
// Source pattern: server/src/controllers/adminController.js:242-250, 295-297
const isCurrentlyActiveAdmin =
  user.role === ROLES.ADMIN && user.accountStatus === 'ACTIVE' && user.active !== false;
const wouldLoseAdminAccess =
  (nextRole && nextRole !== ROLES.ADMIN) ||
  (nextStatus && nextStatus !== 'ACTIVE');

if (isCurrentlyActiveAdmin && wouldLoseAdminAccess) {
  const otherActiveAdmins = await User.countDocuments({
    _id: { $ne: user._id },
    role: ROLES.ADMIN,
    accountStatus: 'ACTIVE',
    active: true,
  });
  if (otherActiveAdmins === 0) {
    throw new AppError(
      'Cannot demote or deactivate the last remaining active administrator.',
      409,
      'LAST_ADMIN_PROTECTED'
    );
  }
}
```

### Non-Blocking Clock-Out Warning in `ShiftTelemetryModal` (Frontend Pattern)
```tsx
// Source pattern: client/src/components/driver/ShiftTelemetryModal.tsx:71-77, 162-167
const showRefuelWarning =
  mode === 'END' &&
  startFuelOrCharge !== null &&
  parsedFuel !== null &&
  Number.isFinite(parsedFuel) &&
  parsedFuel > startFuelOrCharge;

{showRefuelWarning && (
  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
    <AlertTriangle className="w-4 h-4 shrink-0" />
    <span>
      Closing {isElectric ? 'charge' : 'fuel'} ({parsedFuel} {unitLabel}) exceeds shift start ({startFuelOrCharge} {unitLabel}). Confirm this reflects a mid-shift {isElectric ? 'recharge' : 'refuel'}.
    </span>
  </div>
)}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing `adminController.js` user management endpoints (`PUT /users/:id`, `PATCH /users/:id/status`, plus new `DELETE /users/:id`) are tested via API/integration tests without requiring a brand-new `UsersPage.tsx` screen unless planned separately. | Summary / Architecture Patterns | Low — `09-CONTEXT.md` D-17 specifies "on user management endpoints", and `client/src/` has no `UsersPage.tsx`; planner can keep D-17 scoped to `adminController.js` + `adminRoutes.js` (or add a minimal admin users modal if desired). |
| A2 | Phone validation allowing 10–15 digits with optional leading `+` and spaces/hyphens/parens (`/^\+?[0-9\s\-()]{10,20}$/` with `digits.length >= 10 && digits.length <= 15`) matches all valid Bhubaneswar/Indian and international numbers. | Architecture Patterns (D-09) | Low — verified against every existing phone fixture across all test files in `server/tests/`. |

## Open Questions

1. **Error HTTP Status Code for Last-Admin & Active-Operation Guards**
   - What we know: `adminController.js` uses `403` for `SELF_LOCKOUT_PREVENTED` / `SELF_DEMOTION_BLOCKED` `[VERIFIED: server/src/controllers/adminController.js:245-296]`; `driverController.js` uses `409` for `DRIVER_IN_ACTIVE_TRANSIT` / `VEHICLE_IN_ACTIVE_TRANSIT` `[VERIFIED: server/src/controllers/driverController.js:222-228]`.
   - What's unclear: Whether Last-Admin protection should return `409` (`LAST_ADMIN_PROTECTED`) or `400`/`403`.
   - Recommendation: Return `403` for self-lockout/self-demotion (preserving `TC-ADMIN-USER-2` `[VERIFIED: server/tests/admin_control.test.js:103-104]`) and `409` (`LAST_ADMIN_PROTECTED`) for demoting/deactivating/deleting the last active admin (or `400` if preferred; document code explicitly in tests and `errorUtils.ts`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend Express server & Jest tests | ✓ | `v24.16.0` | — |
| npm | Package scripts (`server` & `client`) | ✓ | `11.16.0` | — |
| MongoDB (`mongod` service) | Mongoose persistence & Jest integration tests | ✓ | Running (`MongoDB Server (MongoDB)`) | — |
| TypeScript (`tsc --noEmit`) | Client type verification | ✓ | `5.9.3` (via `client/package.json`) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Jest `^29.7.0` + Supertest `^6.3.4` (`[VERIFIED: server/package.json:34,37]`) |
| Backend Config | `server/jest.config.js` (`testEnvironment: 'node'`, `setupFilesAfterEnv: ['./tests/setup.js']`, `testTimeout: 20000`) (`[VERIFIED: server/jest.config.js:1-13]`) |
| Backend Test DB | Local MongoDB via `server/tests/setup.js` (`mongodb://127.0.0.1:27017/smartroute_test`, clears collections `afterEach`) (`[VERIFIED: server/tests/setup.js:7-25]`) |
| Frontend Verification | TypeScript compiler `tsc --noEmit` (`npm --prefix client test`) & Vite production bundle `tsc && vite build` (`npm --prefix client run build`) (`[VERIFIED: client/package.json:7,9]`) |
| Quick Backend Command | `npm --prefix server test -- tests/shift_telemetry_savings.test.js tests/fleet.test.js tests/deliveries.test.js tests/driver_hud.test.js tests/admin_control.test.js tests/adversarial_csv_batch.test.js` |
| Full Backend Command | `npm --prefix server test` |
| Frontend Command | `npm --prefix client test && npm --prefix client run build` |

**Baseline run verified this session:**
- `npm --prefix server test -- tests/shift_telemetry_savings.test.js` -> **2 passed, 2 total**
- `npm --prefix server test -- tests/fleet.test.js tests/deliveries.test.js tests/driver_hud.test.js tests/admin_control.test.js tests/adversarial_csv_batch.test.js` -> **65 passed, 65 total**
- `npm --prefix client test` -> **0 TypeScript errors**

### Phase Requirements → Test Map
*(Phase 09 decisions `D-01`..`D-17` from `09-CONTEXT.md`)*

| Decision ID | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|-------------|
| D-01..D-03 | `lastOdometerKm` continuity across `startShift`, `endShift`, `submitVehicleCheck` (`400` on `< lastOdometerKm`) + Admin downward override | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-05..D-08 | `tankCapacityLitres` & category caps (`200 L` / `500 L` / `100%`), `lastFuelLitres` persistence across shift & pre-trip inspection | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-09, D-16 | Create & Edit delivery parity (`weightKg > 0`, `volumeM3 >= 0`, `serviceDurationMinutes > 0`, `timeWindow`, phone, 6-digit pincode) | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-10 | Multi-vehicle bin packing preserved (`packDeliveries`) + client batch composer non-blocking warning | integration + TS check | `npm --prefix server test -- tests/routes.test.js && npm --prefix client test` | ✅ / ❌ UI manual |
| D-11 | `startShift` blocked on `MAINTENANCE` / `RETIRED` vehicle (`400`) + cockpit pre-trip inspection banner | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-12 | Block vehicle/driver retire/delete/re-pair during `IN_PROGRESS` shift or active route (`409`); maintenance `cost >= 0` & `nextServiceDate >= serviceDate` (`400`) | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-13 | Lock `COMPLETED` & `FAILED` deliveries on `markDeliveryArrived`, `completeDelivery`, `failDelivery` (`400` `DELIVERY_TERMINAL`) | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-14 | `csvVehicleImportService.js` & `csvImportService.js` uppercase+trim normalization and DB collision detection in `dryRun: true` | integration | `npm --prefix server test -- tests/phase09_guards.test.js tests/adversarial_csv_batch.test.js` | ❌ Wave 0 |
| D-15 | Block creating/adding to batches with `COMPLETED`/`OUT_FOR_DELIVERY` consignments; block deleting/closing batches with active routes (`409`) | integration | `npm --prefix server test -- tests/phase09_guards.test.js` | ❌ Wave 0 |
| D-17 | Last-Admin lockout protection on `PUT /users/:id`, `PATCH /users/:id/status`, `DELETE /users/:id` | integration | `npm --prefix server test -- tests/phase09_guards.test.js tests/admin_control.test.js` | ❌ Wave 0 |
| Client UI | TypeScript compilation & Vite production bundle across all updated React components/pages | build / typecheck | `npm --prefix client test && npm --prefix client run build` | ✅ Existing |

### Sampling Rate
- **Per task commit:** `npm --prefix server test -- tests/phase09_guards.test.js` (once Wave 0 created) + `npm --prefix client test`
- **Per wave merge:** `npm --prefix server test -- tests/phase09_guards.test.js tests/shift_telemetry_savings.test.js tests/fleet.test.js tests/deliveries.test.js tests/driver_hud.test.js tests/admin_control.test.js tests/adversarial_csv_batch.test.js` + `npm --prefix client test`
- **Phase gate:** Full `npm --prefix server test` green + `npm --prefix client run build` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/tests/phase09_guards.test.js` — integration tests covering D-01..D-17 backend guards, schema invariants, and backward compatibility with existing tests.
- [ ] Verify `tests/setup.js` handles all collections cleanly (already iterates `mongoose.connection.collections` and calls `deleteMany({})`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing JWT + Google OAuth + OTP flows unchanged |
| V3 Session Management | no | Existing refresh token revocation on status suspend (`adminController.js:308`) preserved |
| V4 Access Control | yes | RBAC (`authenticate` + `authorize`), BOLA ownership checks on `driverHudController` delivery mutations, Last-Admin lockout guard (`D-17`) |
| V5 Input Validation | yes | Strict numeric bounds (`min`/`max`, finite checks), regex format validation (phone, 6-digit pincode, `HH:mm`), string trim/uppercase normalization, CSV dry-run DB collision checks |
| V6 Cryptography | no | No crypto changes in Phase 09 |

### Known Threat Patterns for Express + Mongoose + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| BOLA / IDOR on driver delivery endpoints (`arrived`, `complete`, `fail`) | Elevation of Privilege / Tampering | Verify `delivery.assignedDriverId` or driver's active `Route` stop ownership when `req.user.role === ROLES.DRIVER` |
| Last-Admin self/peer lockout or privilege removal | Denial of Service | Count active `ADMIN` users excluding target before role demotion, deactivation, or deletion (`409 LAST_ADMIN_PROTECTED`) |
| Telemetry spoofing / negative odometer or fuel injection | Tampering | Server-side `parseNumericField`, finite checks, `>= vehicle.lastOdometerKm`, and tank capacity upper bounds (`400`) |
| Terminal delivery re-transition / double-tap replay | Tampering / Repudiation | Reject `COMPLETED`/`FAILED` transitions on driver HUD execution endpoints (`400 DELIVERY_TERMINAL`); only Admin `REOPEN_FAILED` resets `FAILED` -> `READY` |
| Prototype/NoSQL injection via unvalidated `req.body` strings | Tampering | Explicit field destructuring, `String(...).trim()`, numeric coercion (`Number`), and Mongoose schema enums |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: .planning/phases/09-operational-guards-and-validation-polish/09-CONTEXT.md:1-100]` — Phase 09 locked decisions D-01..D-17
- `[VERIFIED: .planning/phases/08-driver-shift-odometer-and-savings/08-CONTEXT.md:1-25]` — Shift telemetry & unit detection contract
- `[VERIFIED: .planning/phases/06-dark-mode-unification-and-sidebar-polish/06-UI-SPEC.md:1-88]` — Obsidian dark-mode styling tokens
- `[VERIFIED: server/src/models/Vehicle.js:1-132]` — Vehicle schema & pre-validate hook
- `[VERIFIED: server/src/models/VehicleChecklist.js:1-118]` — Checklist schema (`max: 100` constraint identified)
- `[VERIFIED: server/src/models/Delivery.js:1-219]` — Delivery schema & timeWindow hook
- `[VERIFIED: server/src/models/DeliveryBatch.js:1-115]` — Batch schema & status enum
- `[VERIFIED: server/src/models/DriverShift.js:1-66]` — Shift telemetry fields
- `[VERIFIED: server/src/models/MaintenanceRecord.js:1-34]` — Maintenance schema
- `[VERIFIED: server/src/models/User.js:1-133]` — User schema & roles
- `[VERIFIED: server/src/controllers/driverHudController.js:1-1309]` — Dashboard, shift start/end, vehicle check, delivery execution endpoints
- `[VERIFIED: server/src/controllers/vehicleController.js:1-287]` — Vehicle CRUD, delete/retire, maintenance logging
- `[VERIFIED: server/src/controllers/driverController.js:1-401]` — Driver CRUD & 1:1 pairing
- `[VERIFIED: server/src/controllers/deliveryController.js:1-669]` — Delivery create/update & state machine
- `[VERIFIED: server/src/controllers/batchController.js:1-601]` — Batch CRUD, add/remove deliveries, delete
- `[VERIFIED: server/src/controllers/adminController.js:1-1314]` — Admin user management & fleet/operations overrides
- `[VERIFIED: server/src/services/csvVehicleImportService.js:1-117]` & `[VERIFIED: server/src/services/csvImportService.js:1-335]` — CSV parsing, validation, and dry-run logic
- `[VERIFIED: client/src/components/driver/ShiftTelemetryModal.tsx:1-282]` & `[VERIFIED: client/src/pages/driver/DriverVehicleCheckPage.tsx:1-274]` — Telemetry & inspection forms
- `[VERIFIED: client/src/pages/admin/FleetsPage.tsx:1-362]`, `[VERIFIED: client/src/pages/DeliveriesPage.tsx:1-414]`, `[VERIFIED: client/src/components/deliveries/ConsignmentDrawer.tsx:1-280]`, `[VERIFIED: client/src/components/deliveries/BatchComposerPanel.tsx:1-295]`, `[VERIFIED: client/src/pages/BatchesPage.tsx:1-800]` — Admin/Operations UI components

### Secondary (MEDIUM confidence)
- `[VERIFIED: server/tests/shift_telemetry_savings.test.js]`, `[VERIFIED: server/tests/driver_hud.test.js]`, `[VERIFIED: server/tests/admin_control.test.js]`, `[VERIFIED: server/tests/fleet.test.js]`, `[VERIFIED: server/tests/deliveries.test.js]`, `[VERIFIED: server/tests/adversarial_csv_batch.test.js]` — Baseline test assertions & backward-compatibility contracts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from `server/package.json` and `client/package.json`; zero new packages needed
- Architecture: HIGH — every touched backend model, route, controller, service, and frontend page/component was read in full
- Pitfalls: HIGH — identified directly from schema limits (`VehicleChecklist.max: 100`), UI pre-fills (`DriverVehicleCheckPage`), missing modals (`FleetsPage`, `ConsignmentDrawer`), and test assertions (`TC-HUD-DEL-2`, `TC-ADMIN-USER-2`)

**Research date:** 2026-11-10
**Valid until:** 2026-12-10 (stable internal codebase)
