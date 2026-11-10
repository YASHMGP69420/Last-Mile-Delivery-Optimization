# Phase 09: Cross-Screen Operational Guards & Validation Polish - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add lightweight, practical cross-screen validation checks and operational safety guards across Driver telemetry/inspections, Fleet/Vehicle/Driver management, Consignment/Batch forms, and CSV imports — starting with cross-shift vehicle odometer continuity (`lastOdometerKm`) and extending to fuel/tank sanity, create/edit parity, and admin lockout protection.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Decisions
- `.planning/phases/08-driver-shift-odometer-and-savings/08-CONTEXT.md` — Shift odometer/fuel modal behavior, unit auto-detection (`L` vs `%`), and telemetry schema decisions
- `.planning/phases/06-dark-mode-unification-and-sidebar-polish/06-UI-SPEC.md` — Obsidian dark-mode styling tokens and modal/form alert conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/driver/ShiftTelemetryModal.tsx`: Already supports unit detection (`L` vs `%`), inline validation error box, and `startOdometerKm` closing comparison.
- `server/src/controllers/driverHudController.js`: `parseNumericField`, `startShift`, `endShift`, `submitVehicleCheck`, `markDeliveryArrived`, `completeDelivery`, `failDelivery`.
- `server/src/controllers/deliveryController.js`: `VALID_TRANSITIONS` state machine and `createDelivery` checks (`timeWindow`, `weightKg`) ready to share with `updateDelivery`.
- `server/src/services/csvVehicleImportService.js` & `server/src/services/csvImportService.js`: Existing `dryRun` + `validateRow` loops.

### Established Patterns
- Structured API error envelopes via `throw new AppError(message, statusCode, code)` handled centrally by Express error middleware.
- Client forms show inline alert boxes and toast notifications (`Toast.tsx`) from `err.response?.data?.error?.message`.

### Integration Points
- `server/src/models/Vehicle.js`: Add `lastOdometerKm`, `lastFuelLitres`, and optional `tankCapacityLitres` (plus maintenance vehicle guard).
- `server/src/controllers/vehicleController.js`, `driverController.js`, `batchController.js`, `adminController.js` / user endpoints.
- `client/src/pages/driver/DriverVehicleCheckPage.tsx`, `client/src/pages/admin/VehiclesPage.tsx`, `DeliveriesPage.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Triggered directly by user observation: selecting/starting with a vehicle should reject odometer readings lower than previously recorded on that vehicle, matching the shift closing validation pattern.

</specifics>

<deferred>
## Deferred Ideas

- **Delivery POD & strict OTP verification checks**: Enforcing mandatory OTP verification on `completeDelivery`, recipient proof completeness, and strict numeric `temperatureReading` validation on POD submission were explicitly marked by the user as future scope.

</deferred>

---

*Phase: 09-Cross-Screen Operational Guards & Validation Polish*
*Context gathered: 2026-11-10*
