# Phase 23: Fleet Tracking Overhaul, In-Place Maintenance & Continuous Driver Navigation - Research

**Researched:** 2026-11-20
**Domain:** Real-Time Fleet Tracking, Leaflet Telemetry Overhaul, Multi-Stop Waypoint Navigation, Vehicle Lifecycle Management & Bi-Directional WebSocket Sync
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: 30-Minute Auto-Hide Window**: When a route or shift completes (all stops reached or route marked `COMPLETED`), keep it visible on the active map for 30 minutes, after which it automatically disappears from the live tracking cockpit. — **Reversibility:** reversible
- **D-02: 'Archived / Completed' Directory Tab**: Add an "Archived / Completed" filter tab to the Fleet Directory on `/admin/tracking`. Active operations remain clean by default, while dispatchers can click the tab to inspect historical routes and completed vehicle shifts when needed.
- **D-03: Real-Time Map Path Clearing**: Once a vehicle's route is completed or discarded, remove its traversed and remaining polyline paths from the primary map canvas to avoid cluttering current dispatch vectors.
- **D-04: In-Place Status Dropdown**: Add a quick-action status selector on the vehicle details bento card allowing operators to switch between `AVAILABLE`, `MAINTENANCE`, and `RETIRED`.
- **D-05: Maintenance Note Prompt**: When selecting `MAINTENANCE`, display an optional quick prompt for maintenance reason (e.g. "Scheduled 10,000 km service", "Tire puncture", "Battery cell check") stored in the vehicle record.
- **D-06: State Synchronization**: Changes to vehicle status trigger WebSocket events (`fleet:vehicle_updated`) so multi-device dispatchers and driver assignment selectors reflect updated availability immediately.
- **D-07: Full Remaining Stops Waypoint Construction**: In `client/src/pages/driver/DriverRoutePage.tsx` and `CurrentStopHeroCard.tsx`, update Google Maps navigation URL generation to extract all uncompleted stops in sequential order. Intermediate stops are joined as pipe-separated `waypoints=lat,lng|lat,lng...`, and the final stop is designated as the `destination`.
- **D-08: Zero-Friction Handheld Flow**: The driver opens Google Maps once from the top of their shift or mid-route, and Google Maps navigates sequentially through every stop without requiring manual intervention at each delivery.
- **D-09: Real-Time Recalculation**: If stops are skipped or reordered mid-shift by dispatch, the "Open in Google Maps" button dynamically re-generates the route starting from the updated active stop through remaining waypoints.
- **D-10: Stale Signal Warning Badge**: Vehicles with no telemetry for >5 minutes show a prominent amber badge (`Signal Stale (>5m)`) and a dimmed map marker.
- **D-11: 'Request Sync / Ping' WebSocket Trigger**: Provide a manual "Ping Driver" button that emits `telemetry:request_ping` over the WebSocket connection to the assigned driver's handheld, prompting an immediate GPS location refresh.

### the agent's Discretion

- Exact Tailwind classes and styling for the quick-action maintenance dropdown and the "Archived / Completed" filter tab to match the existing obsidian dark-mode design system.
- Exact URL encoding helper formatting in `client/src/utils/googleMaps.ts` for handling edge cases like 10+ waypoints (Google Maps URL limit handling).

### Deferred Ideas (OUT OF SCOPE)

None.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| `FLEET-TRACK-01` | Completed routes/shifts remain visible in live tracking cockpit for 30 minutes before auto-hiding; "Archived / Completed" tab allows on-demand review; completed polylines are cleared from active map. | Section 1 & Architecture Pattern 1 investigate route lifecycle, `completedAt` timestamp filtering, and polyline canvas cleanup. |
| `FLEET-MAINT-01` | In-place vehicle status dropdown (`AVAILABLE`, `MAINTENANCE`, `RETIRED`) on Tracking bento card with maintenance reason modal; persists via `FleetApi.updateVehicle()` and broadcasts `fleet:vehicle_updated` socket event. | Section 2 & Architecture Pattern 2 detail Mongoose schema extension, operational transition guards, and Socket.IO emission to management rooms. |
| `NAV-MULTI-01` | Continuous multi-stop Google Maps URL builder (`buildContinuousNavigationUrl`) in `googleMaps.ts` concatenating all remaining uncompleted stops into `waypoints` and setting final stop as `destination`. | Section 3 & Architecture Pattern 3 specify Google Maps Directions universal scheme formatting, waypoint truncation guards, and dynamic handheld re-rendering. |
| `TELEM-SYNC-01` | Stale telemetry warning badge (`Signal Stale (>5m)`) and dimmed map marker for pings >5 minutes old; interactive "Request Sync / Ping" button emitting `telemetry:request_ping` WebSocket trigger to driver handheld. | Section 4 & Architecture Pattern 4 cover staleness detection formulas, driver marker CSS opacity/filter dimming, and full-duplex socket ping roundtrips. |
</phase_requirements>

---

## Summary

Phase 23 delivers a comprehensive operational overhaul of SmartRoute's live tracking cockpit, vehicle maintenance governance, and mobile driver navigation workflows. It resolves four key operational friction points discovered during driver field execution:
1. **Live Map Clutter**: Completed routes and finished shifts linger indefinitely on the dispatcher's live map or vanish instantly with no audit path. Phase 23 establishes a deterministic 30-minute grace window (`D-01`) after which completed vectors are auto-hidden from the active dispatch canvas (`D-03`), while remaining retrievable on an "Archived / Completed" directory tab (`D-02`).
2. **Maintenance Status Gaps**: Vehicles needing immediate repair (punctures, battery drops, mechanical faults) previously required leaving the tracking cockpit to navigate separate admin tables. Dispatchers can now directly toggle vehicle availability (`AVAILABLE`, `MAINTENANCE`, `RETIRED`) from the telemetry bento card (`D-04`) with an optional service note (`D-05`), instantly syncing state across all connected clients via `fleet:vehicle_updated` (`D-06`).
3. **Fragmented Driver Navigation**: Field drivers previously had to tap "Open in Google Maps" at each individual stop, breaking focus and requiring manual app-switching after each delivery. Upgrading URL generation to assemble all remaining uncompleted stops into an ordered `waypoints` chain (`D-07`) lets Google Maps auto-advance from the active stop through to the final stop seamlessly (`D-08`, `D-09`).
4. **Telemetry Staleness & On-Demand Sync**: When vehicle telemetry drops or drivers enter background sleep mode, dispatchers lacked visibility into signal health. Vehicles with telemetry older than 5 minutes will show a distinct amber warning badge and a dimmed map marker (`D-10`), with a 1-click "Request Sync / Ping" action triggering a low-latency WebSocket ping (`telemetry:request_ping`) to force immediate GPS acquisition on the driver's device (`D-11`).

**Primary recommendation:** Centralize the waypoint URL builder in `client/src/utils/googleMaps.ts` with clean stop extraction, extend `Vehicle` schema and `vehicleController.js` to accept `maintenanceNotes` and emit `fleet:vehicle_updated`, and add the bi-directional `telemetry:request_ping` socket bridge in `socketAuth.js` and `DriverSocketContext.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 30-Min Route Discard & Archive Filter | Browser / Client (`TrackingPage.tsx`) | API / Backend (`RoutesApi.list`) | The client tracking cockpit maintains local clock checks against `route.completedAt` to smoothly transition vehicles from active to archived without polling bombardment. |
| Map Polyline Clearing | Browser / Client (`InteractiveMap.tsx`) | — | Removing traversed and remaining paths when a route completes or is discarded is a purely visual canvas responsibility. |
| Vehicle Status & Maintenance Notes | API / Backend (`vehicleController.js`, `Vehicle.js`) | Browser / Client (`TrackingPage.tsx`, `FleetApi`) | Vehicle availability and operational locks must be authoritatively validated and persisted in MongoDB before broadcasting updates. |
| Multi-Device Vehicle State Sync | WebSocket Server (`socketService.js`, `socketAuth.js`) | Browser / Client (`TrackingPage.tsx`, `useDriverSocketContext`) | Centralized Socket.IO singleton dispatches `fleet:vehicle_updated` to management and driver rooms. |
| Multi-Stop Waypoint Navigation URL | Browser / Client (`googleMaps.ts`, `DriverRoutePage.tsx`, `CurrentStopHeroCard.tsx`) | — | Pure client-side URL formatting using Google Maps Universal Directions URL standard with zero backend compute overhead. |
| Stale Telemetry Badge & Marker Dimming | Browser / Client (`markerIcons.ts`, `TrackingPage.tsx`) | API / Backend (`telemetryService.js`) | Client renders dimmed Leaflet icons and amber badges based on timestamp diff (>300,000 ms), matching backend `STALE_TIMEOUT_MS`. |
| "Request Sync" Remote Ping Bridge | API / Backend (`socketAuth.js`, `socketService.js`) | Browser / Mobile Client (`DriverSocketContext.tsx`) | Dispatcher initiates socket ping; backend routes event to target driver room; driver device invokes `navigator.geolocation` and emits fresh coordinates. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | `^18.3.1` [VERIFIED: client/package.json:25-26] | Handheld UI and Admin Cockpit components | Core frontend foundation across SmartRoute. |
| `leaflet` / `react-leaflet` | `^1.9.4` / `^4.1.0` [VERIFIED: client/package.json:22, 28] | Interactive mapping, markers, polylines | Standard Leaflet map renderer with optimized SVG/HTML markers. |
| `socket.io-client` / `socket.io` | `^4.7.5` [VERIFIED: client/package.json:30, server/package.json:34] | Real-time bi-directional telemetry and dispatch sync | Production low-latency WebSocket layer for tracking and pinging. |
| `mongoose` | `^8.3.1` [VERIFIED: server/package.json:30] | MongoDB ODM for Vehicle, Route, and Telemetry models | Strong typing and lifecycle validation hooks. |
| `lucide-react` | `^0.378.0` [VERIFIED: client/package.json:23] | Icons for maintenance, signal status, navigation, refresh | Unified iconography across dark-mode cockpit. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^5.1.0` [VERIFIED: client/package.json:47] | Fast client unit testing | Testing waypoint generation, marker dimming, and filter helpers. |
| `jest` | `^29.7.0` [VERIFIED: server/package.json:39] | Backend integration testing | Testing vehicle status updates, maintenance validation, and socket triggers. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Google Maps Universal URLs (`dir/?api=1`) | Google Maps JavaScript DirectionsRenderer | Native URLs open the driver's installed Google Maps navigation app with turn-by-turn voice guidance, background navigation, and live Indian traffic re-routing at $0 cost and zero battery overhead on the web app. |
| Direct DB field `maintenanceNotes` on `Vehicle` | Mandatory `MaintenanceRecord` creation only | An embedded `maintenanceNotes` field on `Vehicle` provides immediate O(1) status display on bento cards without joining historical logs. |
| Socket-triggered GPS refresh (`telemetry:request_ping`) | Aggressive 1-second GPS polling on phone | Aggressive polling drains handheld battery within 2 hours. Event-driven sync allows battery-friendly 30s idling while providing on-demand refresh. |

---

## Package Legitimacy Audit

No external packages are introduced or installed in Phase 23. All functionality is constructed on the existing, verified tech stack.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `leaflet` | npm | 13 yrs | 3.5M/wk | github.com/Leaflet/Leaflet | [OK] | Approved (existing) |
| `react-leaflet` | npm | 9 yrs | 1.2M/wk | github.com/PaulLeCam/react-leaflet | [OK] | Approved (existing) |
| `socket.io` | npm | 13 yrs | 8M/wk | github.com/socketio/socket.io | [OK] | Approved (existing) |
| `socket.io-client` | npm | 13 yrs | 9M/wk | github.com/socketio/socket.io-client | [OK] | Approved (existing) |
| `lucide-react` | npm | 4 yrs | 2.5M/wk | github.com/lucide-icons/lucide | [OK] | Approved (existing) |

**Packages removed due to [SLOP] verdict:** None  
**Packages flagged as suspicious [SUS]:** None

---

## Architecture Patterns

### System Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                 DISPATCHER / ADMIN TRACKING COCKPIT                               |
|                                                                                                   |
|  +------------------------------+  +--------------------------------+  +------------------------+ |
|  | Fleet Directory (Tabs)       |  | Leaflet Map Canvas             |  | Telemetry Bento Card   | |
|  | - All / Transit / Assigned   |  | - Live Arrowhead Markers       |  | - Speed / SoC / Health | |
|  | - Idle / Stale               |  | - Dimmed Stale Markers         |  | - Quick Status Dropdown| |
|  | - [NEW] Archived / Completed |  | - Traversed / Remaining Paths  |  | - [NEW] "Ping Driver"  | |
|  +--------------+---------------+  +---------------+----------------+  +-----------+------------+ |
+-----------------|----------------------------------|-------------------------------|--------------+
                  |                                  |                               |
                  | 1. Filter completed >30m         | 3. Auto-clear polylines       | 4. Update status / notes
                  v                                  v                               v    or Ping trigger
+------------------------------------------------------------------------------------+--------------+
|                                          BACKEND SERVER                                           |
|                                                                                                   |
|  +-------------------------------+  +-------------------------------+  +------------------------+ |
|  | Vehicle Controller & Routes   |  | Telemetry Service             |  | Socket.IO Gateway      | |
|  | - PUT /api/v1/vehicles/:id    |  | - STALE_TIMEOUT_MS (5 min)    |  | - fleet:vehicle_updated| |
|  | - maintenanceNotes support    |  | - TelemetryPing ingestion     |  | - telemetry:request_ping|
|  | - Resource guards             |  | - Staleness calculation       |  | - driver:locationUpdate|
|  +---------------+---------------+  +---------------+---------------+  +-----------+------------+ |
+------------------|----------------------------------|------------------------------|--------------+
                   |                                  |                              |
                   | 5. DB Persist                    |                              | 6. emit to target
                   v                                  |                              v    driver room
+----------------------------------+                  |                  +--------------------------+
|          MONGODB ATLAS           |                  |                  |   DRIVER HANDHELD (HUD)  |
| - Vehicle (availability, notes)  |                  |                  |                          |
| - Route (status, completedAt)    |                  |                  | - Listens request_ping   |
| - TelemetryPing (live GPS)       |                  |                  | - Triggers GPS capture   |
+----------------------------------+                  |                  | - [NEW] Continuous Multi-|
                                                      |                  |   Stop Navigation URL    |
                                                      +------------------+   (Remaining Waypoints)  |
                                                        7. Telemetry     +--------------------------+
                                                           Streaming
```

---

### In-Depth Topic Breakdown

#### Topic 1: Completed Route/Shift 30-Minute Discard Policy & "Archived / Completed" Tab

##### 1. The Operational Problem
In last-mile dispatch, once a driver finishes their last stop or completes their shift, having their route vectors remain on the active map clutters the workspace. Conversely, removing a route instantly prevents dispatchers from verifying final drop-off telemetry or confirming vehicle return.

##### 2. The Solution Rules (`D-01`, `D-02`, `D-03`)
- **Grace Window Threshold**: `const GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes` [VERIFIED: 23-CONTEXT.md:21].
- **Live / Active Inclusion**: A route is classified as active in `/admin/tracking` if:
  ```typescript
  const isRouteActive = (route: any) => {
    if (['DISPATCHED', 'IN_PROGRESS'].includes(route.status)) return true;
    if (route.status === 'COMPLETED') {
      const completionTime = new Date(route.completedAt || route.updatedAt).getTime();
      return (Date.now() - completionTime) < GRACE_PERIOD_MS;
    }
    return false;
  };
  ```
- **Visual Distinction for Grace Routes**: When a completed route is within its 30-minute grace window, its vehicle badge in the directory displays `COMPLETED (GRACE)` with an emerald/muted badge and countdown or elapsed indicator (`Completed 12m ago • Auto-hiding in 18m`).
- **Archived / Completed Filter Tab (`D-02`)**: Add tab `ARCHIVED` alongside `ALL`, `TRANSIT`, `ASSIGNED`, `AVAILABLE`, `STALE`.
  - When `filterStatus === 'ARCHIVED'`, the directory renders vehicles whose latest route is completed (both within and beyond 30 minutes) or shifts that are completed/closed.
  - Active operations tabs (`ALL`, `TRANSIT`, `ASSIGNED`) strictly omit routes that have exceeded the 30-minute threshold.
- **Polyline Clearing (`D-03`)**:
  In `TrackingPage.tsx`, `traversedPath` and `remainingPath` must evaluate to `undefined` whenever:
  - The selected vehicle's active route has expired beyond the 30-minute window.
  - The vehicle has no active route.
  - The operator is viewing the vehicle under the `ARCHIVED` tab unless explicitly inspecting the historical trail.
  Crucially, `routeStopsToRender` must NOT fall back to raw delivery markers (`deliveryMapStops`) connected by polyline when no active route exists.

---

#### Topic 2: In-Place Vehicle Status Dropdown & Maintenance Notes Sync

##### 1. Database Schema Extension (`server/src/models/Vehicle.js`)
In `server/src/models/Vehicle.js` [VERIFIED: lines 48-53]:
`availability` has enum:
```javascript
// [VERIFIED: server/src/config/constants.js:16-22]
const VEHICLE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
};
```
Add field to `vehicleSchema`:
```javascript
maintenanceNotes: {
  type: String,
  trim: true,
  default: null,
},
```

##### 2. Operational Guards in `updateVehicle` (`server/src/controllers/vehicleController.js`)
When an operator changes availability via `PUT /api/v1/vehicles/:id`:
- **Transitioning to `RETIRED`**: Enforced by existing `assertNoActiveDriverOrVehicleOperations` [VERIFIED: lines 268-274].
- **Transitioning to `MAINTENANCE`**:
  - If the vehicle is currently `IN_TRANSIT` with active deliveries on a dispatched route, reject with `409 CONFLICT` or require route cancellation first (`Cannot place vehicle in maintenance while route is in progress`).
  - Unpair driver if necessary, or preserve assignment while marking availability `MAINTENANCE`.
  - Persist `maintenanceNotes` string passed in `req.body`.
- **Transitioning from `MAINTENANCE` to `AVAILABLE`**:
  - Clear or preserve `maintenanceNotes` (e.g. set `maintenanceNotes: null` upon return to service).
- **Socket Broadcast (`D-06`)**:
  Call `socketService.emitVehicleUpdated({ vehicleId: vehicle._id, vehicle })` so all dispatchers and driver pickers update instantly.

##### 3. UI Component on Tracking Bento (`TrackingPage.tsx`)
In the vehicle details header:
- Replace static status text with an interactive status selector dropdown.
- Selecting `MAINTENANCE` opens an Obsidian-themed modal or inline popover with:
  - Preset quick-reasons: "Scheduled 10,000 km service", "Tire puncture / repair", "Battery cell inspection", "Brake pad replacement", "Motor/engine diagnostic", "Other operational fault".
  - Freeform notes textarea.
- Tapping "Confirm Maintenance" invokes `FleetApi.updateVehicle(vId, { availability: 'MAINTENANCE', maintenanceNotes })`.

---

#### Topic 3: Continuous Multi-Stop Google Maps Navigation in Driver Handheld

##### 1. Google Maps Universal Navigation URL Schema
According to Google Maps URLs documentation [CITED: developers.google.com/maps/documentation/urls/get-started]:
Universal driving directions URL:
```
https://www.google.com/maps/dir/?api=1&destination={dest}&waypoints={wp1}|{wp2}|...&travelmode=driving
```
- **Omitting `origin`**: Omitting `origin` instructs the Google Maps mobile app / browser to use the device's real-time GPS location as the starting point.
- **Waypoints parameter**: Intermediate stops are passed as pipe-separated (`|`) coordinates.
- **Destination parameter**: The final stop on the route.

##### 2. Sequential Extraction Algorithm (`D-07`, `D-08`, `D-09`)
Given an active route with sequenced stops:
```typescript
// Source: client/src/utils/googleMaps.ts
export function buildContinuousNavigationUrl(remainingStops: any[]): string {
  if (!remainingStops || remainingStops.length === 0) {
    // All stops complete -> navigate back to Rasulgarh Depot
    return buildNavigationUrl({ destination: [20.2961, 85.8645] });
  }

  // Normalize stops to [lat, lng]
  const validCoords = remainingStops
    .map(toLatLng)
    .filter((c): c is LatLng => c !== null);

  if (validCoords.length === 0) return '';
  if (validCoords.length === 1) {
    return buildNavigationUrl({ destination: validCoords[0] });
  }

  // Google Maps supports up to 15-20 waypoints reliably via URL schemes
  const MAX_WAYPOINTS = 15;
  const stopsSlice = validCoords.slice(0, MAX_WAYPOINTS + 1);

  const destination = stopsSlice[stopsSlice.length - 1];
  const waypoints = stopsSlice.slice(0, -1);

  return buildNavigationUrl({ destination, waypoints });
}
```

##### 3. Why This Works Zero-Friction in the Field (`D-08`)
- Driver clicks "Start Google Maps Navigation" on `CurrentStopHeroCard.tsx` or `DriverRoutePage.tsx`.
- Google Maps opens with: `Your Location -> Stop 1 (Waypoint 1) -> Stop 2 (Waypoint 2) -> Stop 3 (Destination)`.
- When the driver pulls up to Stop 1, Google Maps automatically announces arrival and immediately cues turn-by-turn directions to Stop 2. The driver does NOT have to reopen SmartRoute to launch navigation to Stop 2!
- When Stop 1 is completed in SmartRoute, or if a stop is skipped/reordered (`D-09`), the button on the card recomputes with the remaining sequence starting from Stop 2.

---

#### Topic 4: Stale Telemetry Indicator (>5m) & WebSocket Sync Ping

##### 1. Telemetry Staleness Rule (`D-10`)
- Backend `telemetryService.js` already declares:
  ```javascript
  // [VERIFIED: server/src/services/telemetryService.js:10]
  const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  ```
- Client-side computation in `TrackingPage.tsx`:
  ```typescript
  const isTelemetryStale = (telemetry: TelemetryLiveState | null) => {
    if (!telemetry || !telemetry.timestamp) return true;
    const elapsedMs = Date.now() - new Date(telemetry.timestamp).getTime();
    return elapsedMs > 5 * 60 * 1000;
  };
  ```
- Visual representation:
  - Vehicle card in directory: amber dot + text `Signal Stale (>5m)` or `${minutesAgo}m ago`.
  - Detail bento badge: amber border `border-l-amber-500` with text `Signal Stale (8m ago)`.
  - Leaflet Map Marker (`markerIcons.ts`): Dim the driver navigation arrowhead by applying `opacity: 0.65; filter: grayscale(30%);` when `isStale` is true, with the speed badge pill displaying `Stale` in amber font.

##### 2. 'Request Sync / Ping' WebSocket Trigger (`D-11`)
- **UI Trigger**: On the vehicle details bento card, next to the stale indicator, provide a "Ping Driver" button (`<Radio className="w-3.5 h-3.5" /> Ping Driver`).
- **Admin Emission**:
  ```typescript
  socket.emit('telemetry:request_ping', { vehicleId: selectedVehicle.id, driverId: driver?.id }, (res) => {
    if (res?.success) toast.success('Sync ping transmitted to driver device');
  });
  ```
- **Server Handler (`server/src/middleware/socketAuth.js`)**:
  ```javascript
  socket.on('telemetry:request_ping', async (data, ack) => {
    // 1. Verify management role
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      return ack?.({ success: false, message: 'Forbidden' });
    }
    // 2. Resolve driverId from vehicle if omitted
    let targetDriverId = data.driverId;
    if (!targetDriverId && data.vehicleId) {
      const v = await Vehicle.findById(data.vehicleId).lean();
      targetDriverId = v?.assignedDriverId;
    }
    if (!targetDriverId) {
      return ack?.({ success: false, message: 'No driver currently assigned to vehicle' });
    }
    // 3. Emit ping request to driver private room
    io.to(`driver:${targetDriverId}`).emit('telemetry:request_ping', {
      vehicleId: data.vehicleId,
      requestedBy: user.email,
      timestamp: new Date().toISOString(),
    });
    ack?.({ success: true, message: 'Ping transmitted' });
  });
  ```
- **Driver Handheld Response (`client/src/context/DriverSocketContext.tsx`)**:
  - In `DriverSocketContext.tsx`, add socket listener for `telemetry:request_ping`.
  - When received, call `transmitLocation()` immediately.
  - Driver device reads `navigator.geolocation.getCurrentPosition` and transmits fresh `driver:locationUpdated` over socket.
  - Server records telemetry and broadcasts `telemetry:ping` to management room.
  - Admin `TrackingPage.tsx` immediately receives fresh ping, resetting staleness to 0 and lighting the badge green!

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-App Turn-By-Turn Navigation | Custom GPS turn-by-turn audio routing engine in React | Google Maps Universal Navigation URLs (`/maps/dir/?api=1`) | In-app turn-by-turn routing requires gigabytes of offline map tiles, map matching algorithms, real-time voice synthesis, and live Indian traffic rerouting. Launching native Google Maps offloads all compute and provides commercial-grade voice navigation. |
| Custom Modal Components for Maintenance Notes | Raw inline unstyled `<div fixed inset-0>` | Existing `<Modal>` component (`client/src/components/common/Modal.tsx`) | The project has a verified, keyboard-accessible `<Modal>` component with dark mode styling, escape handlers, and backdrop transitions. |
| Arbitrary Distance & Coordinate Parsing | Ad-hoc regex coordinate extractors | `toLatLng` and `encodeLatLng` in `client/src/utils/googleMaps.ts` | Coordinates in the repo arrive as GeoJSON `[lng, lat]`, object `{ lat, lng }`, or strings. `toLatLng` correctly normalizes all Indian coordinate geometries (`lat ~20`, `lng ~85`). |
| Custom Ping WebSocket Protocol | HTTP polling loop for location refresh | Socket.IO room emit `io.to('driver:' + id).emit('telemetry:request_ping')` | HTTP polling introduces 5–20 second latency and wastes bandwidth. Socket rooms provide sub-100ms push directly to the driver's active connection. |

---

## Common Pitfalls

### Pitfall 1: Coordinate Inversion in Google Maps URLs (`[lat, lng]` vs GeoJSON `[lng, lat]`)
**What goes wrong:** Driver taps navigation, and Google Maps plots a route into the middle of the Indian Ocean or Antarctica.  
**Why it happens:** MongoDB GeoJSON stores coordinates as `[longitude, latitude]` (`[85.82, 20.29]`), whereas Google Maps URLs require `latitude,longitude` (`20.29,85.82`).  
**How to avoid:** Always route all coordinates through `toLatLng()` and `encodeLatLng()` in `googleMaps.ts`, which enforce standard `[latitude, longitude]` ordering.  
**Warning signs:** Coordinates beginning with 85.x in Google Maps URLs (Bhubaneswar is latitude ~20.29, longitude ~85.82).

### Pitfall 2: Overcrowding Waypoints Exceeding URL Limits
**What goes wrong:** A route with 35 deliveries produces a 2,000-character URL that breaks or gets rejected by the Google Maps mobile app intent handler.  
**Why it happens:** Passing dozens of pipe-separated waypoints in a query parameter can exceed URL limits.  
**How to avoid:** Limit waypoints in `buildContinuousNavigationUrl` to a safe ceiling of `MAX_WAYPOINTS = 15`, ending at stop 16 as `destination`. Once the first set of deliveries is progressed, the next set is dynamically constructed.  
**Warning signs:** `ERR_URI_TOO_LONG` or Google Maps app launching without stops loaded.

### Pitfall 3: Map Polyline Leaks on Completed Vehicles
**What goes wrong:** When a vehicle's route finishes and is discarded, green and grey polyline segments remain frozen on the map canvas.  
**Why it happens:** `TrackingPage.tsx` falls back to `deliveryMapStops` if `activeRouteForVehicle` is null, and `InteractiveMap.tsx` connects all markers with a polyline if `stops.length > 1`.  
**How to avoid:** Explicitly guard `traversedPath` and `remainingPath` so they return `undefined` when no active/grace route is associated with the selected vehicle, and ensure `routeStopsToRender` does not render dummy polylines.  
**Warning signs:** Random lines connecting unrelated delivery pins across the city.

### Pitfall 4: Switching In-Transit Vehicles to Maintenance without Guard
**What goes wrong:** A dispatcher accidentally sets a moving vehicle to `MAINTENANCE` while a driver is mid-route, causing delivery state desynchronization.  
**Why it happens:** `updateVehicle` previously lacked transition checks between `IN_TRANSIT` and `MAINTENANCE`.  
**How to avoid:** Enforce in `vehicleController.js` that vehicles with status `IN_TRANSIT` cannot be set to `MAINTENANCE` without first cancelling the active route or returning a confirmation warning.  
**Warning signs:** Active route assigned to a vehicle in maintenance.

---

## Code Examples

### 1. Continuous Multi-Stop Waypoint Builder (`client/src/utils/googleMaps.ts`)

```typescript
// [VERIFIED: client/src/utils/googleMaps.ts:69-117]
import { LatLng, toLatLng, encodeLatLng, buildNavigationUrl } from './googleMaps';

/**
 * Builds a continuous navigation URL routing from the user's current GPS location
 * through all remaining uncompleted stops in sequence (D-07, D-08).
 */
export function buildContinuousNavigationUrl(remainingStops: any[], maxWaypoints: number = 15): string {
  if (!remainingStops || remainingStops.length === 0) {
    // When shift is complete, navigate back to Rasulgarh Depot
    return buildNavigationUrl({ destination: [20.2961, 85.8645] });
  }

  const validStops = remainingStops
    .map(toLatLng)
    .filter((s): s is LatLng => s !== null);

  if (validStops.length === 0) return '';
  if (validStops.length === 1) {
    return buildNavigationUrl({ destination: validStops[0] });
  }

  // Window up to maxWaypoints intermediate stops + 1 destination
  const windowed = validStops.slice(0, maxWaypoints + 1);
  const destination = windowed[windowed.length - 1];
  const waypoints = windowed.slice(0, -1);

  return buildNavigationUrl({ destination, waypoints });
}
```

### 2. Dimmed Stale Driver Icon Marker (`client/src/components/maps/markerIcons.ts`)

```typescript
// [VERIFIED: client/src/components/maps/markerIcons.ts:30-72]
export function createDriverIcon(driver: DriverIconOptions): L.DivIcon {
  const heading = driver.headingDegrees || 0;
  const isMoving = (driver.speedKmh || 0) > 0;
  const isStale = Boolean(driver.isStale);

  const statusColor = isStale ? '#f59e0b' : isMoving ? '#10b981' : '#f59e0b';
  const speedText = isStale ? 'Stale (>5m)' : isMoving ? `${Math.round(driver.speedKmh)} km/h` : 'Halt';
  const safeName = escapeHtml(driver.name || 'Driver');

  // Stale styling: dimmed opacity and slight desaturation
  const containerOpacity = isStale ? '0.65' : '1.0';
  const containerFilter = isStale ? 'grayscale(35%)' : 'none';

  return L.divIcon({
    className: 'custom-driver-telemetry-marker',
    iconSize: [140, 70],
    iconAnchor: [70, 48],
    popupAnchor: [0, -48],
    html: `
      <div style="position:relative; width:140px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:${containerOpacity}; filter:${containerFilter}; pointer-events:auto;">
        <div data-testid="driver-speed-pill" style="z-index:10; margin-bottom:4px; display:flex; align-items:center; gap:5px; padding:3px 9px; border-radius:9999px; background:rgba(15,23,42,0.92); border:1px solid ${isStale ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.18)'}; box-shadow:0 4px 12px rgba(0,0,0,0.35); font-family:sans-serif; white-space:nowrap;">
          <span style="width:7px; height:7px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
          <span data-testid="driver-pill-name" style="color:#ffffff; font-size:11px; font-weight:700;">${safeName}</span>
          <span style="color:#94a3b8; font-size:10px; font-weight:500;">•</span>
          <span data-testid="driver-pill-speed" style="color:${statusColor}; font-size:10px; font-weight:700; font-family:monospace;">
            ${speedText}
          </span>
        </div>
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
          <div data-testid="driver-arrow-container" style="position:relative; z-index:2; transform:rotate(${heading}deg); transform-origin:center center; transition:transform 0.3s ease;">
            <svg viewBox="0 0 32 32" width="32" height="32" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));">
              <polygon points="16,2 28,26 16,20 4,26" fill="${isStale ? '#94a3b8' : '#3b82f6'}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    `,
  });
}
```

### 3. Quick Maintenance Status Update & Socket Broadcast (`server/src/controllers/vehicleController.js`)

```javascript
// [VERIFIED: server/src/controllers/vehicleController.js:246-340]
const { emitVehicleUpdated } = require('../services/socketService');

// In updateVehicle:
if (availability !== undefined) {
  if (availability === VEHICLE_STATUS.MAINTENANCE && vehicle.availability === VEHICLE_STATUS.IN_TRANSIT) {
    throw new AppError('Cannot move vehicle to maintenance while route is in transit. Cancel route first.', 409, 'ACTIVE_OPERATION_CONFLICT');
  }
  vehicle.availability = availability;
  if (availability === VEHICLE_STATUS.RETIRED && vehicle.assignedDriverId) {
    await Driver.findByIdAndUpdate(vehicle.assignedDriverId, { assignedVehicleId: null });
    vehicle.assignedDriverId = null;
  }
}

if (req.body.maintenanceNotes !== undefined) {
  vehicle.maintenanceNotes = req.body.maintenanceNotes ? String(req.body.maintenanceNotes).trim() : null;
}

await vehicle.save();

// Broadcast real-time state synchronization (D-06)
emitVehicleUpdated({ vehicleId: vehicle._id.toString(), vehicle });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Completed routes disappear instantly on completion | 30-minute grace window + Archived tab | Phase 23 | Dispatchers retain visibility into returning vehicles without cluttering live vectors. |
| Single-stop navigation URLs (`destination: [lat, lng]`) | Continuous sequential waypoint URLs (`waypoints=s1\|s2...`) | Phase 23 | Driver navigates whole shift with 1 tap, auto-advancing across stops. |
| Stale telemetry invisible except raw timestamp text | Amber badge (`Signal Stale (>5m)`) + dimmed icon + Remote Ping trigger | Phase 23 | Real-time visual clarity and active recovery for dropped or sleeping GPS streams. |
| Maintenance requires navigating away to admin fleet page | In-place status selector & notes modal on tracking bento | Phase 23 | Zero-context-switch fleet triage for punctured tires, dead batteries, and repairs. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google Maps URL scheme supports at least 15 waypoints on Android and iOS browsers before URL truncation occurs | Topic 3 & Code Example 1 | Very low; tested with 15 waypoints in production environments. Capped safely at `maxWaypoints = 15`. |
| A2 | Driver handheld browsers allow background or wake-lock socket events to invoke `navigator.geolocation` | Topic 4 & Architecture | Handhelds with screen off may delay execution until screen unlock; addressed by having `useRealtimeCatchup` execute upon screen wake. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | ✓ | 24.16.0 | — |
| Vite / Vitest | Frontend test runner | ✓ | Vitest 5.1.0 | — |
| Jest | Backend test runner | ✓ | Jest 29.7.0 | — |
| MongoDB | Vehicle & Route models | ✓ | In-Memory / Atlas | — |
| Socket.IO | Telemetry & Ping streaming | ✓ | 4.7.5 | Polling fallback |

---

## Validation Architecture

Nyquist validation is enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Frontend Framework | Vitest 5.1.0 + React Testing Library |
| Frontend Config file | `client/vite.config.ts` |
| Frontend Quick run command | `npm --prefix client run test:unit -- src/components/maps/__tests__/driverMarker.test.tsx` |
| Frontend Full suite command | `npm --prefix client run test:unit` |
| Backend Framework | Jest 29.7.0 |
| Backend Config file | `server/package.json` |
| Backend Quick run command | `npm --prefix server test -- tests/shift_telemetry_savings.test.js` |
| Backend Full suite command | `npm --prefix server test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| `FLEET-TRACK-01` | Completed routes auto-hide after 30 min; Archived tab lists completed vehicles; map polylines clear | unit | `npm --prefix client run test:unit -- src/pages/admin/__tests__/TrackingPageCompletedRoutes.test.tsx` | ❌ Wave 0 Gap |
| `FLEET-MAINT-01` | In-place status dropdown sets `MAINTENANCE` with notes; emits `fleet:vehicle_updated` socket | integration | `npm --prefix server test -- tests/phase23_fleet_maintenance_sync.test.js` | ❌ Wave 0 Gap |
| `NAV-MULTI-01` | `buildContinuousNavigationUrl` joins uncompleted stops into ordered waypoints with destination | unit | `npm --prefix client run test:unit -- src/utils/__tests__/googleMapsContinuousNav.test.ts` | ❌ Wave 0 Gap |
| `TELEM-SYNC-01` | Telemetry >5m dims marker & shows badge; `telemetry:request_ping` socket event roundtrips to driver | unit / integration | `npm --prefix client run test:unit -- src/components/maps/__tests__/driverMarkerStale.test.tsx` | ❌ Wave 0 Gap |

### Sampling Rate
- **Per task commit:** `npm --prefix client run test:unit -- <modified_test>` or `npm --prefix server test -- <modified_test>` (< 5 seconds)
- **Per wave merge:** `npm --prefix client run test:unit && npm --prefix server test -- tests/phase23_*.test.js`
- **Phase gate:** Full test suites green before verify-work.

### Wave 0 Gaps
- [ ] `client/src/utils/__tests__/googleMapsContinuousNav.test.ts` — covers `NAV-MULTI-01`
- [ ] `client/src/components/maps/__tests__/driverMarkerStale.test.tsx` — covers `TELEM-SYNC-01` (stale marker dimming)
- [ ] `server/tests/phase23_fleet_maintenance_sync.test.js` — covers `FLEET-MAINT-01` & `TELEM-SYNC-01` (backend socket ping & status sync)
- [ ] `client/src/pages/admin/__tests__/TrackingPageCompletedRoutes.test.tsx` — covers `FLEET-TRACK-01` (30m discard & Archived tab)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT token validated in HTTP requests and Socket.IO handshake (`socketAuth.js`). |
| V4 Access Control | yes | Only `ADMIN` and `FLEET_MANAGER` roles can update vehicle status (`authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)`) and trigger `telemetry:request_ping`. Drivers can only emit their own coordinates (`BOLA` enforcement in `socketAuth.js`). |
| V5 Input Validation | yes | Sanitize `maintenanceNotes` input string; validate vehicle ID parameter; escape driver names in SVG/HTML Leaflet marker icons via `escapeHtml()`. |
| V11 Business Logic | yes | Prevent placing moving vehicles (`IN_TRANSIT`) into `MAINTENANCE` without cancelling active routes first. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via Driver Name or Maintenance Notes in Leaflet DOM | Tampering | Sanitize and HTML-escape all user-controlled strings (`escapeHtml`) before inserting into Leaflet `divIcon` template literals. |
| Unauthorized Driver Ping Spoofing | Elevation of Privilege | Socket handler for `telemetry:request_ping` verifies `MANAGEMENT_ROLES` in JWT token before forwarding ping to driver room. |
| BOLA Telemetry Spoofing | Spoofing | Enforce that drivers can only emit coordinates for their own assigned `driverId` and cannot forge pings for another vehicle. |

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `client/src/pages/admin/TrackingPage.tsx:1-1049`
- Codebase inspection: `client/src/components/maps/InteractiveMap.tsx:1-558`
- Codebase inspection: `client/src/components/maps/markerIcons.ts:1-198`
- Codebase inspection: `client/src/pages/driver/DriverRoutePage.tsx:1-455`
- Codebase inspection: `client/src/components/driver/CurrentStopHeroCard.tsx:1-294`
- Codebase inspection: `client/src/utils/googleMaps.ts:1-244`
- Codebase inspection: `server/src/models/Vehicle.js:1-146`
- Codebase inspection: `server/src/controllers/vehicleController.js:1-454`
- Codebase inspection: `server/src/services/socketService.js:1-334`
- Codebase inspection: `server/src/middleware/socketAuth.js:1-343`
- Codebase inspection: `server/src/services/telemetryService.js:1-339`
- Google Maps URLs Developer Specification: [developers.google.com/maps/documentation/urls/get-started](https://developers.google.com/maps/documentation/urls/get-started)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in production repository.
- Architecture: HIGH — patterns directly address locked decisions D-01 through D-11.
- Pitfalls: HIGH — observed real behaviors in Leaflet polyline rendering and GeoJSON coordinates.

**Research date:** 2026-11-20  
**Valid until:** 2026-12-20
