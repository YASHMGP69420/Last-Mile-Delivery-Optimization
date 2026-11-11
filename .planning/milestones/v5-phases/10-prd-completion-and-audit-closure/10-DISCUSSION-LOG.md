# Phase 10: Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-11
**Phase:** 10-Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization
**Areas discussed:** Demo Cleanup & Audit Fixes, Analytics PRD KPIs & Planned vs Actual, Mid-Shift Dynamic Route Recalculation

---

## Area 1: Demo Cleanup & Audit Fixes
| Option | Description | Selected |
|--------|-------------|----------|
| Full audit closure | Tag `isDemoData` across secondary models/routes, cascade demo delete across all linked collections + create `07-VERIFICATION.md`, sync `FLEET_MANAGER` fuel/kWh/km metrics, add `DRIVER` redirect in `AdminLayout`, remove dead `RoutesApi.reset`, and fix secondary modal dark-mode alert contrast. | ✓ |
| Demo cleanup + Control Center sync only | Fix demo route leak, `07-VERIFICATION.md`, and `FLEET_MANAGER` savings metrics; skip secondary modal dark-mode polish and `AdminLayout` redirect. | |

**User's choice:** Full audit closure.

---

## Area 2: Analytics PRD KPIs & Planned vs Actual
| Option | Description | Selected |
|--------|-------------|----------|
| Real DB telemetry + honest empty fallbacks | Compute Fuel Cost/Delivery, Vehicle Utilization %, Route Efficiency Score, Avg Delivery Time (from delivery timestamps/ETAs), and Planned vs Actual comparison (Route metrics vs Phase 08 `DriverShift` odometer/fuel), showing `0`/`—` when no shifts/deliveries exist. | ✓ |
| Route metrics only | Derive all new KPIs and Planned vs Actual from Route baseline vs optimized deltas without pulling Phase 08 `DriverShift` actuals. | |

**User's choice:** Real DB telemetry + honest empty fallbacks.

---

## Area 3: Mid-Shift Dynamic Route Recalculation
| Option | Description | Selected |
|--------|-------------|----------|
| Admin/Fleet triggered re-optimize on remaining stops | Add traffic-scenario & incident-aware 'Re-optimize Active Route' in `TrackingPage` & `RoutePlannerPage`. | |
| Automatic on DriverIncident | Auto-recalculate route immediately whenever a driver reports a `ROUTE_OBSTRUCTION` (traffic/road closure) incident without waiting for dispatcher confirmation (plus shared `POST /routes/:id/reoptimize` endpoint). | ✓ |

**User's choice:** Automatic on `DriverIncident`.

---

## Deferred Ideas
- **README rewrite & Live Deployment configs (`#4`)**: Deferred for dedicated deployment step.
- **Admin User Management UI (`D-17`)** & **Delivery POD OTP checks**: Noted in deferred scope.
