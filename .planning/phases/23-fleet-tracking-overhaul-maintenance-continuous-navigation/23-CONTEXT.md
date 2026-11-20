# Phase 23: Fleet Tracking Overhaul, In-Place Maintenance & Continuous Driver Navigation - Context

**Gathered:** 2026-11-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three tightly coupled operational capabilities for last-mile fleet management and field execution:
1. **Fleet Tracking Cockpit Overhaul & Completed Discard Policy**: Automatically discard/archive completed routes and completed vehicle shifts from the live tracking map and active directory after a 30-minute grace window, with a dedicated "Archived / Completed" tab for on-demand inspection without visual clutter.
2. **In-Place Vehicle Maintenance & Status Workflow**: Enable dispatchers to directly toggle vehicle status (`AVAILABLE`, `IN_TRANSIT`, `MAINTENANCE`, `RETIRED`) from the tracking cockpit with optional maintenance notes that persist to the fleet database via `FleetApi.updateVehicle()`.
3. **Continuous Multi-Stop Navigation in Driver Handheld**: Upgrade the driver's Route and Cockpit views so clicking "Open in Google Maps" generates a continuous multi-stop navigation route from current GPS location through all remaining stops in sequence (using Google Maps `waypoints`), rather than forcing drivers to restart single-stop navigation repeatedly.
4. **Telemetry Signal Health & Sync Pings**: Identify stale GPS streams (>5 minutes since last ping) with clear amber badges, dimmed map icons, and a "Request Sync / Ping" action to prompt the driver's device for an immediate telemetry update over WebSockets.

</domain>

<decisions>
## Implementation Decisions

### 1. Completed Vehicle & Route Discard Policy
- **D-01: 30-Minute Auto-Hide Window**: When a route or shift completes (all stops reached or route marked `COMPLETED`), keep it visible on the active map for 30 minutes, after which it automatically disappears from the live tracking cockpit. — **Reversibility:** reversible
- **D-02: 'Archived / Completed' Directory Tab**: Add an "Archived / Completed" filter tab to the Fleet Directory on `/admin/tracking`. Active operations remain clean by default, while dispatchers can click the tab to inspect historical routes and completed vehicle shifts when needed.
- **D-03: Real-Time Map Path Clearing**: Once a vehicle's route is completed or discarded, remove its traversed and remaining polyline paths from the primary map canvas to avoid cluttering current dispatch vectors.

### 2. Fleet Maintenance & Status Management
- **D-04: In-Place Status Dropdown**: Add a quick-action status selector on the vehicle details bento card allowing operators to switch between `AVAILABLE`, `MAINTENANCE`, and `RETIRED`.
- **D-05: Maintenance Note Prompt**: When selecting `MAINTENANCE`, display an optional quick prompt for maintenance reason (e.g. "Scheduled 10,000 km service", "Tire puncture", "Battery cell check") stored in the vehicle record.
- **D-06: State Synchronization**: Changes to vehicle status trigger WebSocket events (`fleet:vehicle_updated`) so multi-device dispatchers and driver assignment selectors reflect updated availability immediately.

### 3. Continuous Multi-Stop Google Maps Navigation in Driver Handheld
- **D-07: Full Remaining Stops Waypoint Construction**: In `client/src/pages/driver/DriverRoutePage.tsx` and `CurrentStopHeroCard.tsx`, update Google Maps navigation URL generation to extract all uncompleted stops in sequential order. Intermediate stops are joined as pipe-separated `waypoints=lat,lng|lat,lng...`, and the final stop is designated as the `destination`.
- **D-08: Zero-Friction Handheld Flow**: The driver opens Google Maps once from the top of their shift or mid-route, and Google Maps navigates sequentially through every stop without requiring manual intervention at each delivery.
- **D-09: Real-Time Recalculation**: If stops are skipped or reordered mid-shift by dispatch, the "Open in Google Maps" button dynamically re-generates the route starting from the updated active stop through remaining waypoints.

### 4. Telemetry Signal Health & Ping Sync
- **D-10: Stale Signal Warning Badge**: Vehicles with no telemetry for >5 minutes show a prominent amber badge (`Signal Stale (>5m)`) and a dimmed map marker.
- **D-11: 'Request Sync / Ping' WebSocket Trigger**: Provide a manual "Ping Driver" button that emits `telemetry:request_ping` over the WebSocket connection to the assigned driver's handheld, prompting an immediate GPS location refresh.

### Agent Discretion
- Exact Tailwind classes and styling for the quick-action maintenance dropdown and the "Archived / Completed" filter tab to match the existing obsidian dark-mode design system.
- Exact URL encoding helper formatting in `client/src/utils/googleMaps.ts` for handling edge cases like 10+ waypoints (Google Maps URL limit handling).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fleet & Telemetry Architecture
- `client/src/pages/admin/TrackingPage.tsx` — Current Fleet Tracking cockpit, vehicle directory, and telemetry detail bento
- `client/src/components/maps/InteractiveMap.tsx` — Leaflet map canvas, driver arrowhead, camera focus, and route lines
- `client/src/api/client.ts` — `FleetApi.getVehicles()`, `FleetApi.updateVehicle()`, `TelemetryApi`
- `server/src/routes/fleetRoutes.ts` — Backend vehicle status endpoints and validation

### Driver Navigation & Handheld
- `client/src/pages/driver/DriverRoutePage.tsx` — Driver Route view, active stop card, and navigation launcher
- `client/src/components/driver/CurrentStopHeroCard.tsx` — 1-Tap Google Maps button on active stop
- `client/src/utils/googleMaps.ts` — Google Maps URL builder (`buildNavigationUrl`) with waypoint support

</canonical_refs>
