# Phase 09: Cross-Screen Operational Guards & Validation Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-10
**Phase:** 09-Cross-Screen Operational Guards & Validation Polish
**Areas discussed:** Vehicle Odometer Continuity, Fuel/Charge & Tank Sanity Checks, Order/Delivery & Form Validation Polish, Delivery Execution State Guards, CSV Import & Batch Readiness Checks, Input Normalization & Admin Account Safety

---

## Vehicle Odometer Continuity

### Question 1: Where should `lastOdometerKm` be tracked and updated?
| Option | Description | Selected |
|--------|-------------|----------|
| Driver shifts + inspections + optional Admin baseline | Track Vehicle.lastOdometerKm on creation/edit (optional), and automatically advance it on Shift Start, Shift End, and Pre-Trip Inspection. | ✓ |
| Driver shifts only | Only update lastOdometerKm from Clock In / Clock Out shifts; keep Admin Vehicles form unchanged. | |
| Shifts + Pre-Trip Inspection only | Track automatically from driver telemetry without adding an odometer field to the Admin Vehicle form. | |

**User's choice:** Driver shifts + inspections + optional Admin baseline.

### Question 2: How should modals display previous odometer readings?
| Option | Description | Selected |
|--------|-------------|----------|
| Helper hint + placeholder (require manual entry) | Show 'Last recorded: X km' badge and validate live + on submit, so drivers still look at and type the actual dashboard reading. | ✓ |
| Auto-prefill input with last reading | Pre-populate the input field with lastOdometerKm and block lowering it below that value. | |
| You decide | Choose the best UX pattern based on Driver Cockpit conventions. | |

**User's choice:** Helper hint + placeholder (require manual entry).

### Question 3: Corrections for earlier odometer typos
| Option | Description | Selected |
|--------|-------------|----------|
| Strict block for drivers, Admin/Fleet override in Vehicles edit | Drivers cannot enter less than lastOdometerKm; only Fleet Manager / Admin can correct a wrong odometer baseline when editing a vehicle. | ✓ |
| Always strictly non-decreasing | Block any decrease everywhere unless cleared via database. | |
| Show warning + require note | Allow lower reading if the driver types a mandatory explanation note. | |

**User's choice:** Strict block for drivers, Admin/Fleet override in Vehicles edit.

### Question 4: Displaying current odometer on status cards
| Option | Description | Selected |
|--------|-------------|----------|
| Show Odometer badge on both DriverVehicleStatusCard and Admin VehiclesPage | Keep current odometer visible alongside Fuel/Battery everywhere. | |
| Show only inside Clock In / Inspection modals | Keep vehicle cards minimal without adding odometer text. | ✓ |
| You decide | Balance card density based on existing dark-mode UI spacing. | |

**User's choice:** Show only inside Clock In / Inspection modals.

---

## Fuel, Charge & Tank Sanity Checks

### Question 1: Clock Out remaining fuel > Clock In value
| Option | Description | Selected |
|--------|-------------|----------|
| Reject increase unless 'Refueled / Recharged mid-shift' toggle is checked | Prevents accidental typos while still handling real mid-shift refueling cleanly. | |
| Strictly block endFuel > startFuel | Never allow closing fuel/charge higher than starting value. | |
| Show inline warning only | Warn visually if ending reading exceeds starting reading, without blocking submission. | ✓ |

**User's choice:** Show inline warning only.

### Question 2: Preventing unrealistic litre typos
| Option | Description | Selected |
|--------|-------------|----------|
| Optional tankCapacityLitres on Vehicle + sensible fallback cap | If Vehicle has tankCapacityLitres set, reject values above it; otherwise enforce a safe upper bound (200 L / 500 L). | ✓ |
| Always require tankCapacityLitres on new vehicles | Force Fleet Managers to enter tank size for every Petrol/Diesel vehicle. | |
| Only enforce a fixed safety max | Keep Vehicle forms simpler without adding tank capacity. | |

**User's choice:** Optional tankCapacityLitres on Vehicle + sensible fallback cap.

### Question 3: Pre-Trip Inspection fuel unit alignment
| Option | Description | Selected |
|--------|-------------|----------|
| Match ShiftTelemetryModal (L for Petrol/Diesel, % 0-100 for EV) | Replace hardcoded 0-100% slider with Litres for ICE and % for EVs. | ✓ |
| Keep 0-100% slider on Pre-Trip Inspection | Leave DriverVehicleCheckPage as fuel/battery percentage gauge only. | |

**User's choice:** Match ShiftTelemetryModal (L for Petrol/Diesel, % 0-100 for EV).

### Question 4: Remembering last recorded fuel level
| Option | Description | Selected |
|--------|-------------|----------|
| Store Vehicle.lastFuelLitres (alongside batterySoC) & show as hint | Update on Clock In/Out & Inspection, and show 'Last recorded: X L / X%' inside forms. | ✓ |
| Only store batterySoC for EVs | Keep Petrol/Diesel fuel readings only on shift history. | |

**User's choice:** Store Vehicle.lastFuelLitres (alongside batterySoC) & show as hint.

---

## Order, Delivery & Form Validation Polish

### Question 1: Create + Edit Consignment validation parity
| Option | Description | Selected |
|--------|-------------|----------|
| Full create + edit parity | Enforce weight > 0, volume >= 0, serviceDuration > 0, startTime < endTime, and clean phone/6-digit pincode checks on both Create and Edit Delivery forms + API. | ✓ |
| Backend validation only | Add missing checks in updateDelivery API without changing frontend forms. | |
| Time window & weight parity only | Sync timeWindow and weightKg checks on Edit only. | |

**User's choice:** Full create + edit parity.

### Question 2: Over-capacity vehicle handling on Route Planner
| Option | Description | Selected |
|--------|-------------|----------|
| Block overweight/over-volume dispatch | Show clear load vs capacity badge and reject overload. | |
| Show inline warning only | Highlight red load badge without blocking. | |
| Auto-split across available vehicles | Ignore single-vehicle cap since optimization already assigns multiple routes. | ✓ |

**User's choice:** Auto-split across available vehicles.

### Question 3: Roadworthiness checks guarding Clock In & deliveries
| Option | Description | Selected |
|--------|-------------|----------|
| Block Clock In if vehicle is MAINTENANCE/RETIRED + warn if Pre-Trip Inspection is missing/failed | Prevent unsafe dispatches while keeping off-shift inspections accessible. | ✓ |
| Strict block for both | Also block marking deliveries ARRIVED/COMPLETED unless inspection passed. | |
| Only block MAINTENANCE/RETIRED vehicles | Allow Clock In and deliveries without requiring a daily Pre-Trip Inspection. | |

**User's choice:** Block Clock In if vehicle is MAINTENANCE/RETIRED + warn if Pre-Trip Inspection is missing/failed.

### Question 4: Admin/Fleet resource integrity guards
| Option | Description | Selected |
|--------|-------------|----------|
| All active-operation & form guards | Block deleting/retiring/re-pairing vehicles or drivers during IN_PROGRESS shift/route; validate positive efficiency/capacity and maintenance cost >= 0 & nextServiceDate >= serviceDate. | ✓ |
| Active-operation guards only | Only block retire/delete/reassignment while on an active shift or route. | |
| Maintenance & numeric guards only | Validate maintenance dates/costs and positive vehicle metrics only. | |

**User's choice:** All active-operation & form guards.

---

## Delivery Execution State Guards

### Question 1: Terminal state lock
| Option | Description | Selected |
|--------|-------------|----------|
| Lock terminal states (COMPLETED & FAILED) | Block Arrived/Complete/Fail on already COMPLETED or FAILED stops unless Fleet Operations resets FAILED back to READY. | ✓ |
| Lock COMPLETED only | Prevent changing COMPLETED deliveries, while allowing drivers to retry FAILED stops. | |

**User's choice:** Lock terminal states (COMPLETED & FAILED).

### Question 2: POD & OTP checks
**User's choice:** Deferred — *"delivery pod checks are future scope"*.

---

## CSV Import & Batch Readiness Checks

### Question 1: Dry-run DB duplicate check & active-batch delete/state guard
| Option | Description | Selected |
|--------|-------------|----------|
| Enable both CSV dry-run DB duplicate check & active-batch delete/state guard | Catch duplicate plates/orders in dry-run before commit, and block deleting batches with active DISPATCHED/IN_PROGRESS routes. | ✓ |
| CSV dry-run duplicate check only | Fix CSV dry-run duplicate detection only. | |
| Batch active-route guard only | Protect active batches only. | |

**User's choice:** Enable both CSV dry-run DB duplicate check & active-batch delete/state guard.

---

## Input Normalization & Admin Account Safety

### Question 1: Numeric bounds, normalization & Last-Admin safety lock
| Option | Description | Selected |
|--------|-------------|----------|
| Include both HTML/API numeric bounds + normalization and Last-Admin safety lock | Enforce min/trim/uppercase consistency across forms and block demoting or deleting the sole ADMIN account. | ✓ |
| Form/API normalization only | Standardize trimming, uppercasing, and non-negative numeric bounds only. | |
| Last-Admin lock only | Only prevent locking out/deleting the last remaining ADMIN account. | |

**User's choice:** Include both HTML/API numeric bounds + normalization and Last-Admin safety lock.

---

## the agent's Discretion
- Dark-mode alert styling matching Phase 06 palette (`06-UI-SPEC.md`).
- Default fallback tank capacity thresholds (`200 L` for vans/bikes/3-wheelers vs `500 L` for trucks).

## Deferred Ideas
- Delivery POD & strict OTP verification checks (`completeDelivery` mandatory OTP verification, proof completeness, temperatureReading formatting) — marked by user as future scope.
