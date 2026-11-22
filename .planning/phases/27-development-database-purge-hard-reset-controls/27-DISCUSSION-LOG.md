# Phase 27: Development Database Purge & Hard Reset Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-22
**Phase:** 27-Development Database Purge & Hard Reset Controls
**Areas discussed:** Safety Safeguards & Confirmation UX, User Account Retention Boundary, UI Placement & Danger Zone Design, Post-Purge Real-Time State & Socket Broadcast

---

## Safety Safeguards & Confirmation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Typed Uppercase Phrase | Require typing exact phrase 'PURGE' into a text box before enabling the Wipe button | |
| Long Confirmation Phrase | Require typing full phrase 'RESET ALL OPERATIONAL DATA' | |
| 2-Step Modal with Countdown Timer | Simple 2-step confirmation modal with red warning and countdown timer (no text input required) | ✓ |

**User's choice:** Simple 2-step confirmation modal with red warning and countdown timer (no text input required).
**Notes:** Prevents accidental double clicks without creating tedious friction for dev workflows.

---

## User Account Retention Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve All Admins | Preserve current active Admin & all ADMIN accounts (wipe all driver profiles, driver user logins, deliveries, vehicles, routes, batches, and tracking) | ✓ |
| Preserve Root Admin Only | Preserve ONLY the root bootstrap admin account | |
| Preserve Admins & Fleet Managers | Preserve all ADMIN and FLEET_MANAGER accounts | |

**User's choice:** Preserve current active Admin & all ADMIN accounts.
**Notes:** Removes driver logins and driver profiles alongside operational data, but ensures administrators never lose access.

---

## UI Placement & Danger Zone Design

| Option | Description | Selected |
|--------|-------------|----------|
| Admin Control Center Dashboard | Inside a high-visibility red 'Developer Danger Zone' card alongside the Demo Dataset section | ✓ |
| Admin Header / Quick Actions | Dev tools icon/button in the top header | |
| System Settings Page | Placed at the bottom of user management/system administration | |

**User's choice:** Admin Control Center dashboard inside a high-visibility red 'Developer Danger Zone' card alongside the Demo Dataset section.

---

## Post-Purge Real-Time State & Socket Broadcast

| Option | Description | Selected |
|--------|-------------|----------|
| WebSocket Event Broadcast | Broadcast WebSocket 'system:purged' event to instantly zero out real-time metrics, clear active map layers, refresh tables, and show green confirmation toast | ✓ |
| Hard Browser Reload | Hard reload page immediately after toast | |
| Table Navigation | Zero out dashboard state and navigate to Deliveries Manifest table | |

**User's choice:** Broadcast WebSocket 'system:purged' event to instantly zero out real-time metrics, clear active map layers, refresh tables, and show green confirmation toast.

---

## the agent's Discretion
- Cascade deletion order across collections to cleanly avoid orphaned records.
- Collections to purge: Deliveries, Batches, Vehicles, Drivers, Routes, RouteAssignments, VehicleAssignments, TelemetryPings, TelemetryAlerts, DriverShifts, DriverIncidents, VehicleChecklists, MaintenanceRecords, DeliveryEvents, SystemNotifications, and Driver Users.

## Deferred Ideas
None — discussion stayed strictly within the phase scope.
