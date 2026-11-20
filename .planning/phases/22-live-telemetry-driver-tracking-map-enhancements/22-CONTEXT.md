# Phase 22: Live Telemetry Driver Tracking & Map Visual Enhancements - Context

**Gathered:** 2026-11-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the Fleet Tracking & Live Telemetry view (`TrackingPage.tsx`, `InteractiveMap.tsx`) so that:
1. Real-time driver location is prominently distinguished from stop delivery pins — rendering a minimalist pulsing navigation arrowhead oriented along their heading with an attached live speed & driver name pill (e.g. `Rajesh • 34 km/h`), replacing the ambiguous numeric "1" pin.
2. A dedicated "Find Driver" / "Locate Driver" camera action is added as both a floating tactical button on the map canvas and a shortcut in each vehicle card, enabling smooth zoom-in (level 16) and an auto-follow toggle mode as telemetry pings stream in.
3. Stop status pins are clearly differentiated: Completed stops are rendered as small, flat dimmed grey dots to declutter the map; Cancelled/Failed stops are rendered as bold red pins with a slash-through banner; Active/Next stops pulse in bright indigo (`#6366f1`); and Upcoming Pending stops remain vibrant emerald (`#10b981`).
4. Route lines render as dual-color polylines along the driver's route: traversed segments up to the driver's live GPS position are muted/dashed, and remaining segments to upcoming stops are solid vibrant emerald.
5. A floating, collapsible glassmorphic Map Legend with interactive filter checkboxes (Completed, Cancelled, Pending, Driver) is added directly to the tracking map canvas so dispatchers can identify every marker and quickly declutter the display.

</domain>

<decisions>
## Implementation Decisions

### 1. Driver Marker Identity & Telemetry Visuals
- **D-01:** Driver's live GPS position is represented on the Leaflet map as a distinct, minimalist pulsing navigation arrowhead rotated to match `headingDegrees` (falling back to a directional cone if heading is 0/stationary).
- **D-02:** A live driver badge/pill is permanently anchored directly above the arrowhead displaying the driver's name and real-time speed (e.g. `Rajesh • 34 km/h`), pulsing green when movement speed > 0 and amber when stationary or stale.
- **D-03:** Discontinue overloading `sequenceOrder: idx + 1` for vehicle GPS markers in `TrackingPage.tsx` so vehicles never render with confusing numeric stop pins like "1".

### 2. "Find Driver" & Camera Navigation
- **D-04:** Add a floating tactical "Find Driver" (target/crosshair icon) control button directly on the map canvas (top-right next to zoom controls), plus a quick "Locate" button on each vehicle card in the sidebar.
- **D-05:** Clicking "Find Driver" triggers Leaflet `flyTo` or smooth pan centering on the driver's current coordinates at zoom level 16.
- **D-06:** Include an "Auto-Follow Driver" toggle switch. When enabled, incoming `telemetry:ping` socket events smoothly re-center the map viewport onto the driver without interrupting manual pan interactions (manual drag temporarily disengages auto-follow).

### 3. Stop Pin Status Styling & Differentiation
- **D-07:** Completed delivery stops are styled as small, flat, unobtrusive grey dots (opacity ~0.6) instead of full-sized pins, keeping the active delivery route uncluttered.
- **D-08:** Cancelled and Failed stops are styled as prominent red (`#ef4444`) pins featuring a diagonal slash-through banner and distinct alert glyph.
- **D-09:** The Next Active stop is highlighted in pulsing bright indigo (`#6366f1`) to clearly indicate the immediate target destination, while subsequent pending stops remain vibrant emerald (`#10b981`) with their assigned sequence numbers.

### 4. Route Lines & Tactical Map Legend
- **D-10:** Split the route polyline into traversed vs remaining segments: the traversed segment (from depot up to current driver coordinates) renders as a muted dashed/grey line (`#94a3b8` / `#475569`), while the remaining path to pending stops renders as a solid vibrant emerald line (`#10b981`).
- **D-11:** Add a floating, semi-transparent glassmorphic Map Legend in the bottom-left corner of the map canvas with a collapse/expand toggle.
- **D-12:** The legend includes active filter checkboxes for every entity type (`[x] Drivers`, `[x] Next Stop`, `[x] Pending`, `[x] Completed`, `[x] Cancelled`) allowing dispatchers to dynamically toggle marker visibility.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Live Telemetry & Tracking
- `client/src/pages/admin/TrackingPage.tsx` — Main fleet tracking page handling real-time telemetry socket stream (`telemetry:ping`), active vehicle selection, and stops compilation.
- `client/src/components/maps/InteractiveMap.tsx` — Leaflet map container, custom SVG marker generators (`createStopIcon`), polyline rendering, and map lifecycle guards.
- `client/src/types/route.ts` — Definition of `RouteStop`, coordinates, status, and route geometry types.
- `server/src/services/telemetryService.js` — Real-time telemetry ingestion and broadcast service.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InteractiveMap.tsx` has `useMap()` hooks (`MapLifecycleGuard`, `FitBounds`) which can be extended with a `CameraFollowController` for smooth pan/flyTo and auto-follow.
- Leaflet `L.divIcon` allows custom HTML/SVG with inline styles, CSS transforms (`transform: rotate(...)`), and Tailwind animations (`animate-pulse`).
- `TrackingPage.tsx` already receives live `telemetry:ping` events containing `headingDegrees`, `speedKmh`, and `coordinates`.

### Integration Points
- `TrackingPage.tsx`:
  - `vehicleGpsStops`: Pass explicit `isDriverMarker: true`, `driverName`, `headingDegrees`, `speedKmh` into the stop object rather than dummy `sequenceOrder: idx + 1`.
  - Pass `selectedVehicleCoordinates` or `focusCoordinates` down to `InteractiveMap`.
  - Pass filter state to `InteractiveMap` based on legend checkboxes.
- `InteractiveMap.tsx`:
  - Enhance `createStopIcon` to handle `isDriverMarker`, `COMPLETED` (small flat grey dot), `CANCELLED` / `FAILED` (red pin with slash banner), and `ACTIVE` (bright indigo).
  - Add floating control buttons (Find Driver, Legend toggle).
  - Render dual polylines (traversed muted, remaining solid).

</code_context>

<specifics>
## Specific Ideas
- Clean, uncluttered UI: As drivers deliver packages, completed stops shrink into flat grey dots so the admin's attention stays on the active driver and pending deliveries.
- Tactical driver marker: Pulsing navigation arrowhead rotated to current heading with an attached speed/name tag gives dispatchers immediate situational awareness.
- Full legend checkboxes: Dispatchers can uncheck "Completed" to hide past stops completely when focusing on a dense urban route.

</specifics>

<deferred>
## Deferred Ideas
- None — all discussed items fit cleanly into Phase 22 scope.

</deferred>

---

*Phase: 22-live-telemetry-driver-tracking-map-enhancements*
*Context gathered: 2026-11-20*
