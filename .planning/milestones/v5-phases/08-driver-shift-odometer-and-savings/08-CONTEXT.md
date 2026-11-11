# Phase 08 Context: Driver Shift Odometer & Fuel/Charge Telemetry + Savings Attribution

**Date:** 2026-11-10  
**Status:** Locked Decisions from `/gsd-discuss-phase`

## Locked Decisions

1. **Prompt Timing & Delivery Gate**:
   - Prompt drivers to enter **Odometer Reading (km)** and **Remaining Fuel / Charge** when clicking **Clock In** (`startShift`) and when clicking **Clock Out** (`endShift`) on [DriverCockpitPage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/driver/DriverCockpitPage.tsx) (and on [DriverProfilePage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/driver/DriverProfilePage.tsx) / [DriverRoutePage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/driver/DriverRoutePage.tsx) if triggered there).
   - **Pre-Delivery Gate**: If an off-duty driver attempts to start/mark arrival on a delivery stop before clocking in, automatically open the **Clock In (Odometer & Fuel/Charge)** prompt first so no delivery executes without an active shift & starting reading.

2. **Validation & Vehicle Requirement**:
   - **Required when assigned a vehicle**: Drivers with an assigned vehicle must enter numeric starting & ending odometer readings (`endOdometerKm >= startOdometerKm`) and fuel/charge level (`>= 0`; `0–100%` for Electric) via the cockpit modal (`requireTelemetry: true` flag from UI).
   - **No-Vehicle / API Backward Compatibility**: If a driver has no assigned vehicle yet (or when legacy unit tests call `POST /driver-hud/shifts/start` with empty `{}`), shift endpoints remain non-breaking while rejecting invalid telemetry if supplied.

3. **Fuel / Charge Input Units**:
   - Auto-detected from the assigned vehicle's `fuelType`:
     - **Petrol / Diesel**: Remaining fuel in **Litres (`L`)**.
     - **Electric (`EV`)**: Remaining charge in **Battery Percentage (`%`, 0–100%)**.

4. **Savings & Usage Visibility Across All 3 Surfaces**:
   - **Admin Control Center** ([AdminControlCenterPage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/admin/AdminControlCenterPage.tsx) & [OperationsCommandStrip.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/dashboard/OperationsCommandStrip.tsx)): Show **Total Kilometers Saved (km)**, **Total Fuel / Energy Saved (`L` / `kWh` + `₹`)**, and aggregated **Shift Odometer Distance Driven & Fuel Used** returned by `/admin/overview` (and Fleet Manager dashboard aggregation).
   - **Admin Drivers Roster / Accounts** ([DriversPage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/admin/DriversPage.tsx) & `GET /api/v1/drivers`): Add per-driver metrics columns showing **Deliveries Completed**, **Km Driven (Odometer)**, **Fuel / Charge Used**, **Km Saved**, and **Fuel Saved (`L` / `kWh` + `₹`)**.
   - **Driver Account / Profile Page** ([DriverProfilePage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/driver/DriverProfilePage.tsx) & `GET /api/v1/driver-hud/profile`): Display the driver's **Deliveries Made**, **Km Saved**, **Fuel / Energy Saved (`L` / `kWh` & `₹`)**, **Total Distance Driven (Odometer km)**, and **Actual Fuel / Charge Consumed** (plus recent shift log breakdown).
