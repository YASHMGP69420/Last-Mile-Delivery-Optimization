---
status: testing
phase: 22-live-telemetry-driver-tracking-map-enhancements
source: [22-VERIFICATION.md]
started: 2026-11-20T10:56:00Z
updated: 2026-11-20T10:56:00Z
---

## Current Test

number: 1
name: Live Driver Navigation Arrowhead & Real-Time Speed Badge
expected: |
  Navigate to Fleet Tracking (`/admin/tracking`) with an active driver vehicle. The driver's live GPS position renders as a distinct navigation arrowhead rotated to match headingDegrees (with a pulsing radar ring when moving) and an attached badge pill displaying `${driverName} • ${speed} km/h` (pulsing green when moving, amber on halt/stale), completely replacing the overloaded numeric "1" stop pin.
awaiting: user response

## Tests

### 1. Live Driver Navigation Arrowhead & Real-Time Speed Badge
expected: Navigate to Fleet Tracking (`/admin/tracking`) with an active driver vehicle. The driver's live GPS position renders as a distinct navigation arrowhead rotated to match headingDegrees (with a pulsing radar ring when moving) and an attached badge pill displaying `${driverName} • ${speed} km/h` (pulsing green when moving, amber on halt/stale), completely replacing the overloaded numeric "1" stop pin.
result: [pending]

### 2. 'Find Driver' Camera Action & Auto-Follow Engine
expected: On Fleet Tracking, click the floating tactical crosshair button on the top-right of the map or the "Locate" button on a vehicle card. The map executes a smooth `flyTo` centered on the driver at zoom level 16. Toggle "Auto-Follow Driver" on: incoming pings smoothly re-center the camera, and manually dragging or zooming the map automatically detaches auto-follow.
result: [pending]

### 3. Stop Pin Status Differentiation (Dimmed Dots, Red Slash Pins, Indigo Next)
expected: Observe delivery stops on the route map. Completed orders render as small, flat dimmed grey dots (20x20px with checkmark); cancelled/failed orders render as bold red pins with diagonal slash-through lines; the next active stop pulses in bright indigo (`#6366f1`) with an outer radar ring; and remaining pending stops render as vibrant emerald pins with sequence numbers.
result: [pending]

### 4. Dual-Segment Route Polylines & Interactive Filterable Map Legend
expected: Observe the route line: traversed path from depot to driver renders as a muted dashed line (`#64748b`), while remaining path to pending stops renders as solid vibrant emerald. Expand the bottom-left glassmorphic Map Legend and uncheck "Completed" or "Cancelled": the corresponding markers are immediately hidden from the map canvas, leaving an uncluttered view.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
