# Phase 15: Dispatch Simplification & Auto Vehicle Assignment — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-12
**Phase:** 15 — Dispatch Simplification & Auto Vehicle Assignment
**Areas discussed:** Vehicle Auto-Selection During Optimization, Consignment-Level Assignment

---

## Vehicle Auto-Selection During Optimization

| Option | Description | Selected |
|--------|-------------|----------|
| Best-fit (Recommended) | Pick the smallest vehicle that fits the total batch weight — avoids wasting a large truck on a small load | ✓ |
| Best-available | Pick the vehicle with highest capacity that is AVAILABLE — simpler, ensures headroom | |
| EV-first | Prefer electric vehicles when they fit, fall back to diesel — same as current EV_PREFERRED option | |

**User's choice:** Best-fit: pick the smallest vehicle that fits the total batch weight

| Option | Description | Selected |
|--------|-------------|----------|
| Show in result card (Recommended) | Show auto-selected vehicle in the optimization result card (plate + make/model + capacity used%) | ✓ |
| Toast/banner only | Brief toast: "Optimized with MH12-AB-1234 (Tata Ace, 72% load)" | |
| No explicit feedback | Vehicle shows up in route details when dispatcher reviews | |

**User's choice:** Show auto-selected vehicle in the optimization result card

| Option | Description | Selected |
|--------|-------------|----------|
| Soft lock with override (Recommended) | Show auto-selected vehicle with "Change Vehicle" link to override before dispatching | ✓ |
| Hard lock | Optimizer picks, no override UI | |
| No lock | Dispatcher can freely change vehicle after optimization in route detail view | |

**User's choice:** Soft lock — show auto-selected vehicle with "Change Vehicle" link

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with clear error | "No AVAILABLE vehicle with sufficient capacity. Add a vehicle or free one from active route" | |
| Warn and let proceed | Show which vehicles are over-capacity, suggest splitting batch or returning vehicle | |
| Auto-split by zone (User proposed) | Auto-split the batch into two smaller batches using the best available vehicles, grouping by zone for same-day delivery | ✓ |

**User's choice:** Auto-split between vehicles going to the same zone to ensure same-day delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-assign with change option (Recommended) | System picks next AVAILABLE driver by status/seniority, "Change Driver" link in result | |
| Round-robin | Rotate across all available drivers to balance workload | |
| Lightweight driver picker modal | Just name + status, no vehicle field | |
| Auto-assign with change option (User confirmed) | Auto-assign but keep option to change | ✓ |

**User's choice:** Auto-assign but keep option to change

---

## Consignment-Level Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Remove both dropdowns entirely (Recommended) | Delivery shows batch membership; vehicle/driver read-only after route dispatched | ✓ |
| Remove vehicle, keep driver | Some dispatchers pre-assign individual deliveries to drivers | |
| Read-only after batch+route, editable only for DRAFT | Replace dropdowns with display once batch+route exists | |

**User's choice:** Remove both dropdowns entirely

| Option | Description | Selected |
|--------|-------------|----------|
| Batch status chip (Recommended) | Chip showing batch code (e.g., BBSR-EXP-4821) and route status (Pending/Dispatched) | ✓ |
| Show nothing | Omit the section entirely | |
| Compact info row | "Part of Batch BBSR-EXP-4821 • Route SR-091 • Driver: Rahul Singh" | |

**User's choice:** Replace with a "Batch" status chip showing batch code and route status

| Option | Description | Selected |
|--------|-------------|----------|
| Keep driver dropdown in batch composer | Dispatcher picks driver in batch composer (no vehicle field) | |
| Remove driver field too, auto-assign with change link (User chose) | Let optimizer auto-assign driver, show "Change Driver" link in result | ✓ |
| Move driver selection to "Optimize & Dispatch" step | Driver selection part of optimization step, not batch creation | |

**User's choice:** Remove the driver field too — let the optimizer auto-assign a driver and just show a "Change Driver" link in the result

---

## the agent's Discretion

- Whether to keep the read-only "Assigned Vehicle" display column in `DriversPage` or remove it entirely (populated by optimizer after dispatch)
- Exact UI styling of the "Change Vehicle" and "Change Driver" links in the result card (button vs link vs dropdown inline)

---

## Deferred Ideas

- **Zone-aware manual batch splitting UI** — letting dispatchers manually split a large batch into zones before optimizing; belongs in a future "Advanced Dispatch Controls" phase
- **Driver workload balancing dashboard** — showing historical delivery counts per driver for fair assignment; separate analytics phase
- **Vehicle maintenance scheduling integration** — blocking vehicles that are due for service from auto-selection; separate maintenance-tracking phase