# SmartRoute Frontend & UI/UX Specification Report

**Generated Date:** 2026-11-03  
**Status:** Comprehensive Specification Complete  
**Author:** Teamwork Specification Miner 2 (`teamwork_spec_miner_survey_2`)  
**Scope:** Exhaustive specification of frontend, UI/UX, component hierarchy, map/telemetry integration, optimization review, batch CSV ingestion, driver mobile views, and operational analytics.

---

## 1. Executive Summary & Design System Foundations

SmartRoute is an enterprise last-mile logistics and route optimization platform tailored for three primary operational roles: **Admin**, **Fleet Manager**, and **Driver**. The UI balances high-density operational telemetry with visual clarity, built upon Google Stitch design exports, Tailwind CSS, TypeScript, and React.

### 1.1 Stitch Design System Tokens & Style Guide
Derived from `stitch_smartroute_fleet_platform/smartroute_logistics_operations_system/DESIGN.md`:
- **Palette**:
  - `primary`: `#14243A` (Deep Navy / Primary command surfaces & headers)
  - `secondary`: `#0051D5` / `#2563EB` (Electric Blue / Active vectors, selection rings, primary buttons)
  - `secondary-container`: `#316BF3` / `#DBEAFE` (Active pill backgrounds, navigation highlights)
  - `surface`: `#FAF8FF` / `#F8FAFC` (Ergonomic low-glare dashboard canvas)
  - `surface-container-lowest`: `#FFFFFF` (Card shells, table rows, modal surfaces)
  - `surface-container-low`: `#F2F3FF` / `#F1F5F9` (Subtle container backgrounds, alternating table rows)
  - `outline`: `#75777D` / `outline-variant`: `#C5C6CD` (Divider rules and borders)
  - `success`: `#16A34A` (Delivered, connected telemetry, on-time SLA)
  - `warning`: `#F59E0B` (Traffic delay, low battery threshold, break needed)
  - `error`: `#BA1A1A` / `#DC2626` (Exception, breakdown, unassigned load, SLA breach)
- **Typography**: Inter across all surfaces. Proportional tabular lining figures (`tnum`) enforced across all telemetry coordinates, speeds, ETAs, and timestamps to eliminate UI jitter during live WebSockets streaming.
- **Layout Architecture**:
  - *Desktop (1440px+)*: 3-zone workbench layout (64px/250px collapsible navigation rail, 360px–420px dispatch drawer, edge-to-edge GIS canvas or data table).
  - *Tablet (1024px–1439px)*: Off-canvas slide-over dock over map viewport; table rows collapse secondary telemetry behind expanders.
  - *Mobile (<1023px)*: Bottom-sheet driven interface; map viewport occupies top 40–45%, bottom sheets anchor manifests, turn-by-turn guidance, and proof-of-delivery workflows with touch targets $\ge 44\text{px}$.

---

## 2. Role-Based Page & Route Inventory

| Route | Role Access | Primary Purpose | Stitch Prototype Reference |
|---|---|---|---|
| `/login` | Public | JWT authentication, role resolution & redirection | Custom Auth Form |
| `/dashboard` | Admin, Fleet Manager | Operational master dashboard, live 6-KPI metrics, GIS matrix, hourly chart | `smartroute_operational_master_dashboard` & `smartroute_fleet_operations_delivery_dispatch_flow` |
| `/deliveries` | Admin, Fleet Manager | Manifest management, parcel table, filter bar, bulk batching, waybill inspector drawer | `smartroute_delivery_operations_batch_management` |
| `/batches` | Admin, Fleet Manager | Batch lifecycle view (`DRAFT` $\to$ `READY` $\to$ `PLANNED` $\to$ `IN_PROGRESS` $\to$ `CLOSED`), batch creation | `smartroute_delivery_operations_batch_management` |
| `/batches/import` | Admin, Fleet Manager | CSV/XLSX drag-and-drop import, client PapaParse validation, dry-run modal | `smartroute_delivery_operations_batch_management` |
| `/route-planner` | Admin, Fleet Manager | Multi-stop optimizer, parameter sliders, 2-opt sequence manager, baseline comparison | `smartroute_route_planner_optimizer` |
| `/live-tracking` | Admin, Fleet Manager | 3-tier cockpit: vehicle registry, vector map with live pins/congestion, CAN-Bus inspector | `smartroute_live_fleet_tracking_telemetry` |
| `/fleet/vehicles` | Admin, Fleet Manager | Vehicle registry CRUD, EV vs ICE specs, payload capacity, maintenance status | `docs/05-data-model.txt` Entity Registry |
| `/fleet/drivers` | Admin, Fleet Manager | Driver profile CRUD, vehicle pairing, shift status, performance ratings | `docs/05-data-model.txt` Entity Registry |
| `/analytics` | Admin, Fleet Manager | Historical planned vs actual metrics, Recharts charts, date/vehicle filters, exports | `docs/01-execution-plan.txt` Phase 7 |
| `/admin/users` | Admin Only | User provisioning (Fleet Manager & Driver accounts) | `docs/06-api-contract.txt` `/auth/users` |
| `/admin/settings`| Admin Only | Fuel costs, electricity tariffs, default optimization weights, map fallbacks | `docs/07-optimization-specification.txt` |
| `/driver/home` | Driver | Active shift overview, vehicle battery %, remaining stops bento, active stop card, bottom nav | `driver_home_active_shift_stops` |
| `/driver/navigation`| Driver | Turn-by-turn HUD, maneuver cues, lane guidance, consignee call/SMS, arrival trigger | `active_turn_by_turn_stop_navigation` |
| `/driver/pod/:deliveryId`| Driver | 4-step Proof of Delivery wizard: OTP, photo evidence, signature canvas, condition checklist | `proof_of_delivery_completion` |
| `/driver/manifest` | Driver | Sequenced stop manifest for active shift, stop notes, contact triggers | `driver_home_active_shift_stops` |
| `/driver/history` | Driver | Driver shift history, completed deliveries audit | `driver_home_active_shift_stops` Nav Tab |
| `/driver/profile` | Driver | Driver credentials, assigned vehicle specs, shift settings | `driver_home_active_shift_stops` Nav Tab |

---

## 3. The 9 Stitch Design Templates & React Component Architecture

```
client/src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Drawer.tsx
│   │   └── Toast.tsx
│   ├── layout/
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminHeader.tsx
│   │   ├── DriverHeader.tsx
│   │   └── DriverBottomNav.tsx
│   ├── maps/
│   │   ├── GISMapCanvas.tsx
│   │   ├── VehicleMarker.tsx
│   │   ├── StopMarker.tsx
│   │   ├── RoutePolyline.tsx
│   │   ├── CongestionLayer.tsx
│   │   └── MapControls.tsx
│   ├── optimization/
│   │   ├── RouteComparisonBanner.tsx
│   │   ├── ParameterSliders.tsx
│   │   ├── StopSequenceManager.tsx
│   │   └── ImpactMetricsCard.tsx
│   ├── deliveries/
│   │   ├── ManifestTable.tsx
│   │   ├── BatchComposerPanel.tsx
│   │   ├── CsvImportModal.tsx
│   │   ├── ConsignmentDrawer.tsx
│   │   └── CreateDeliveryModal.tsx
│   └── driver/
│       ├── TurnByTurnHud.tsx
│       ├── ActiveStopCard.tsx
│       ├── ConsigneeCard.tsx
│       ├── SignaturePad.tsx
│       ├── CameraCapture.tsx
│       └── PodChecklist.tsx
├── pages/
│   ├── admin/
│   │   ├── DashboardPage.tsx
│   │   ├── DeliveriesPage.tsx
│   │   ├── RoutePlannerPage.tsx
│   │   ├── LiveTrackingPage.tsx
│   │   └── AnalyticsPage.tsx
│   └── driver/
│       ├── DriverHomePage.tsx
│       ├── DriverNavigationPage.tsx
│       └── DriverPodPage.tsx
```

### 3.1 Detailed Template Breakdown
1. **`smartroute_logistics_operations_system/DESIGN.md`**: Master design specification. Defines color tokens (`primary`, `secondary`, `surface`, `error`), Inter typography scales, elevation levels (Level 0 flat to Level 3 scrim modals), and 3-zone layout geometry.
2. **`smartroute_operational_master_dashboard`**: Hub Operations Cockpit. Hosts 6 KPI summary cards (Total Deliveries, Completed %, In Transit count, On-Time SLA %, Active Fleet, Fuel Spend), mini GIS canvas, hourly dispatch bar chart (with target line and delayed overlay), recent deliveries table, fleet utilization gauge (87.5% SVG donut), operations launcher, and real-time activity feed.
3. **`smartroute_fleet_operations_delivery_dispatch_flow`**: Flow overview dashboard. Features hub context header, live corridor vector simulation, interactive quick delivery creation modal, tabular status filtering tabs (All, In Transit, Delayed, High Priority), and quick intervention buttons.
4. **`smartroute_delivery_operations_batch_management`**: High-density manifest management. Includes 5 KPI metric cards, search and filter controls, dynamic bulk selection bar (Assign to Batch, Flag Urgent, Print Waybills), high-density data table with 10 columns, active batch composer panel with capacity bar gauge, suggested AI chassis pick, and slide-over waybill inspector drawer with fulfillment milestone timeline.
5. **`smartroute_route_planner_optimizer`**: Core optimization workspace. Features 35%/65% split: left panel contains route configuration, strategy presets (Balanced, Fastest, Economical) with 4 constraint weight sliders, chassis payload meter, and drag-and-drop stop sequence manager; right panel contains dual-polyline vector map canvas (dashed naive vs glowing optimized ribbon), Jaydev Vihar congestion heatmap ellipse, comparison header (48.6 km vs 33.2 km), 5 impact telemetry cards (Distance Saved, Time Saved, Fuel Saved, CO2 Reduction, SLA Certainty), and master dispatch trigger.
6. **`smartroute_live_fleet_tracking_telemetry`**: Real-time 3-tier tracking cockpit:
   - *Left*: Fleet vehicle directory with search, filter chips (All, Transit, Idle, Delayed, Depot), and telemetry cards showing battery SoC %, speed, current stop, and progress bar.
   - *Center*: Full GIS canvas showing traffic flow colors, visited checkmark stops, active target stop with animated ping, heading compass vehicle pin, floating telemetry HUD, and map action controls.
   - *Right*: Vehicle diagnostics inspector with OBD-II streaming badge, driver profile with VoIP/chat buttons, active manifest progress, CAN-Bus telemetry gauges (Speed vs Limit, SoC/Range, Tire PSI, Motor Temp), and driver eco-score sparkline.
7. **`driver_home_active_shift_stops`**: Driver mobile landing. Includes On Duty toggle pill, Bolero EV battery status, remaining stops/km bento grid, prominent next stop medical card with thumbnail map, phone/manifest actions, scrollable upcoming stop manifest queue, quick break/emergency SOS actions, and fixed 5-tab bottom navigation rail.
8. **`active_turn_by_turn_stop_navigation`**: Driver in-transit cockpit. Top high-contrast turn-by-turn banner with maneuver icon, distance, instruction, street name, speed limit indicator, lane guidance pills; vector navigation map viewport with GPS heading indicator; draggable bottom sheet holding consignee contact buttons, cold chain delivery notes, and primary "Arrived at Location" / "Report Issue" action triggers.
9. **`proof_of_delivery_completion`**: Comprehensive POD completion screen. 4 verification modules: 4-digit recipient SMS OTP display/input; photo evidence capture with Lat/Long and timestamp watermarks; HTML5 recipient signature canvas pad with signer relationship pills; condition & temperature checklist (package seal intact, cold-chain reading in °C, safe range indicator); and "Confirm & Complete Delivery" primary button.

---

## 4. Interactive Map & Telemetry Specifications

### 4.1 Architecture & Google Maps Integration Rules
- **Rule from `docs/03-architecture.txt` (Rule 28)**: UI components must NEVER call Google Maps Platform APIs directly. All geocoding, directions, and distance matrices are proxied through backend endpoints (`/api/v1/routes`, `/api/v1/deliveries/geocode`).
- **Dual-Mode GIS Canvas**:
  1. *Live Provider Mode*: When valid API credentials are configured, loads Google Maps JavaScript API with custom vector styling matching `#14243A` dark-slate palette.
  2. *Deterministic Simulated Fallback*: High-fidelity SVG/Canvas renderer rendering static satellite/street tiles, vector paths, and interactive DOM overlays (used for offline development and test repeatability).

### 4.2 Map Layer Specifications
- **Vehicle Markers**:
  - Rotating heading compass arrow indicating travel bearing ($0^\circ - 360^\circ$).
  - Color-coded vehicle state: Blue (`#0051D5`) for in-transit, Amber (`#F59E0B`) for idle, Red (`#DC2626`) for delayed/emergency.
  - Hover/Click HUD badge showing License Plate, Speed, Driver Name, and Battery/Fuel SoC.
- **Route Polylines**:
  - *Baseline / Naive Polyline*: Dashed Slate (`#94A3B8`), `stroke-dasharray="6,6"`, opacity $0.85$.
  - *Optimized Polyline*: Multi-stop glowing ribbon using linear gradient (`#0051D5` $\to$ `#316BF3` $\to$ `#10B981`) with SVG Gaussian blur filter (`stdDeviation="3"`).
  - *Historical Breadcrumbs*: Semi-transparent dots marking GPS coordinates emitted during current active route.
- **Stop Waypoints**:
  - *Visited Stops*: Green circle with white checkmark icon (`#16A34A`).
  - *Active Target Stop*: Numbered circle with expanding animated ping ring (`animate-ping`) and ETA badge.
  - *Upcoming Stops*: Numbered slate chips indicating sequence order.
  - *Exception/Congestion Nodes*: Red warning badge (`#DC2626`) with animated bounce.
- **Simulation & Playback Controls**:
  - Live GPS Stream toggle switch.
  - Simulation speed multiplier ($1\times, 2\times, 5\times$).
  - Recenter on selected vehicle button.
  - Traffic Congestion layer toggle (Normal green, Moderate amber, Congested red corridors).
  - Socket.IO connection status badge with latency ping (e.g. `120ms`).

---

## 5. Batch Management & CSV Import Specifications

### 5.1 Batch Lifecycle State Machine
```text
DRAFT ──► READY ──► PLANNED ──► IN_PROGRESS ──► CLOSED
  ▲         │
  └─────────┘ (Amended prior to planning)
```

### 5.2 CSV Ingestion Pipeline
1. **File Selection**: Drag-and-drop dropzone supporting `.csv` and `.xlsx` (up to 10MB).
2. **Client Parsing**: In-browser parsing via `PapaParse` with auto-header mapping for:
   - `orderId` / `reference`
   - `customerName`
   - `phone`
   - `address`
   - `city` / `zone`
   - `weightKg`
   - `volumeM3`
   - `priority` (`Standard`, `Urgent`, `Cold Chain`)
   - `timeWindowStart` & `timeWindowEnd` (`HH:mm` format)
3. **Dry-Run Validation (`POST /api/v1/deliveries/import?dryRun=true`)**:
   - Schema and syntax verification.
   - Address geocoding validation.
   - Time-window sanity checks (start < end, window $\ge 30\text{ min}$).
   - Weight and volume positivity checks.
4. **Validation Summary UI**:
   - Total records, valid count, invalid count.
   - Interactive error table highlighting erroneous cells with actionable tooltips.
   - "Download Error CSV" button containing original data with appended `ErrorReason` column.
   - "Proceed with Valid Records" button.
5. **Manual Delivery Editor**:
   - Create Delivery Modal supporting manual consignment entry.
   - Slide-over consignment drawer allowing field amendments before route lock.

---

## 6. Optimization Review UI Specifications

### 6.1 Baseline vs. Optimized Comparison
- **Inputs**: Baseline sequence (original CSV stop order) and Optimized sequence (heuristic 2-opt output) computed on the exact same distance/time matrix snapshot.
- **Visual Display**:
  - Dual polylines on map with toggle button ("Toggle Naive Path").
  - 5 Key Metric Cards:
    1. *Distance Saved*: Total km delta and percentage (e.g., $15.4\text{ km}$, $-31.7\%$).
    2. *Travel Time Saved*: Total minutes delta and duration percentage (e.g., $1\text{h }15\text{m}$, $-34.1\%$).
    3. *Fuel / Energy Saved*: Estimated cost in ₹ and liters/kWh preserved (e.g., ₹$1,420$, $4.8\text{L}$).
    4. *CO2 Emissions Reduced*: Estimated kg of carbon offset (e.g., $11.2\text{ kg}$).
    5. *On-Time SLA Certainty*: Percentage probability of meeting all time windows (e.g., $99.2\%$).
- **Solver Telemetry**: Engine version, execution latency in milliseconds (e.g., $142\text{ms}$), objective weights applied.
- **Unassigned Deliveries Drawer**: Explicit list of dropped shipments with system reason codes:
  - `CAPACITY_EXCEEDED`: Parcel exceeds chassis payload or volume allowance.
  - `TIME_WINDOW_INFEASIBLE`: Earliest arrival violates customer deadline.
  - `NO_REFRIGERATION`: Cold-chain consignment mapped to standard chassis.
  - `DRIVER_SHIFT_LIMIT`: Exceeds maximum 8-hour driving regulation.

### 6.2 Parameter Tuning Sliders & Presets
- **Presets**:
  - `Balanced`: $w_d = 0.35, w_t = 0.35, w_f = 0.20, w_p = 0.10$.
  - `Fastest`: $w_t = 0.70, w_d = 0.15, w_f = 0.05, w_p = 0.10$.
  - `Economical`: $w_f = 0.50, w_d = 0.40, w_t = 0.10, w_p = 0.00$.
- **Interactive Sliders**: Real-time weights ($0\% - 100\%$) triggering re-optimization request upon release.
- **Sequence Manager**: Drag-and-drop sequenced stops with manual override capability.

---

## 7. Driver Mobile-Responsive Specifications

### 7.1 Viewport & Usability Standard
- Target Viewport: $375\text{px} - 430\text{px}$ width, dynamic viewport height (`100dvh`).
- Safe Area Insets: `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` applied.
- Touch Ergonomics: Primary action buttons located in thumb reach zone (bottom 35% of viewport) with minimum height of $48\text{px}$.

### 7.2 Turn-by-Turn Navigation UI
- **HUD Banner**:
  - Next maneuver icon (e.g., `turn_left`, `straight`, `roundabout`).
  - Distance countdown to maneuver (e.g., $350\text{m}$).
  - Maneuver text and target road/avenue.
  - Vehicle current speed vs speed limit with threshold alert.
  - Multi-lane guidance indicators (e.g., "Keep 2 Left Lanes").
- **Interactive Map Area**: Centered heading tracking with smooth bearing interpolation.
- **Quick Handoffs**: Direct `tel:+...` and `sms:+...` native triggers for consignee communication.
- **Exception Reporting Modal**:
  - Options: *Consignee Unreachable*, *Gate Entry Denied*, *Address Not Found*, *Refused Delivery*.
  - Submits delivery event with reason code and automatically advances stop queue.

### 7.3 Proof of Delivery (POD) Completion
1. **Recipient OTP Step**: 4-digit input field with automatic verification check.
2. **Camera Capture**: HTML5 file/media capture API rendering real-time image preview with burned-in geotag (Lat/Long, timestamp, depot location) and "Tamper Verified" cryptographic hash indicator.
3. **Signature Pad**: HTML5 `<canvas>` element with smooth bezier stroke interpolation, relationship radio pills (*In Person*, *Reception*, *Proxy*), Clear button, and auto-generated timestamp.
4. **Condition & Cold Chain Checklist**: Package undamaged verification checkbox and real-time sensor temperature input in °C (highlighted green if within $2.0^\circ\text{C} - 8.0^\circ\text{C}$ safe range, red if breached).
5. **Submission**: Single-click "Confirm & Complete Delivery" with loading state, updating delivery status to `COMPLETED` and syncing via Socket.IO.

---

## 8. Analytics & Reporting Specifications

### 8.1 KPI Summary Grid
- Total Deliveries, Fulfillment Rate (%), On-Time SLA (%), Planned vs Actual Distance Variance (km), Planned vs Actual Duration Variance (mins), Total Fuel Cost & AI Fuel Savings (₹).

### 8.2 Recharts Visualization Suite
1. **Hourly Delivery Dispatch vs Target**: Composed chart showing stacked bars for Delivered and Delayed orders alongside a dashed target baseline.
2. **Distance & Time Variance Analysis**: Grouped bar chart comparing planned route distance vs actual telemetry odometer distance across vehicles.
3. **Fleet Capacity Utilization**: Donut / Radial Bar chart visualizing fleet payload and volumetric space utilization.
4. **Fuel Efficiency & Cost Savings Trend**: Multi-line area chart tracking daily fuel expenditures vs counterfactual naive routing costs.
5. **Exceptions & Failure Distribution**: Pie chart breaking down delivery exceptions by category (Consignee Absent, Wrong Address, Seal Damaged, Weather Delay).

### 8.3 Filters & Data Exporting
- **Filters**: Date range picker (Today, 7D, 30D, Custom), Vehicle selector, Driver selector, Zone/Depot selector.
- **CSV Export**: Clean tabular export of delivery audit logs and route execution records using `PapaParse` and Blob downloads.
- **PDF Report Generation**: Printable executive summary layout utilizing `@media print` CSS with page-break optimizations and table repeat headers.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Navigation | Turn-by-Turn HUD Banner | High-contrast driver header showing upcoming maneuver, distance, road name, live speed, speed limit, and lane guidance | GPS speed, route turn-by-turn directions | Visual maneuver cue, lane pill guidance | Displays GPS signal lost warning if stream drops | `active_turn_by_turn_stop_navigation/code.html` |
| 2 | Driver | Geofence Arrival Trigger | One-touch arrival confirmation that validates vehicle proximity to stop coordinates before unlocking POD | Vehicle GPS coordinate, Stop coordinate | Unlocks POD completion screen; updates status to `OUT_FOR_DELIVERY` | Warns driver if vehicle is >150m from stop pin | `active_turn_by_turn_stop_navigation/code.html` |
| 3 | Driver | Delivery Exception Dialog | In-app modal for drivers to log failed stops with predefined reason codes | Driver option selection (1-4), optional note | Emits `delivery:statusChanged` with `FAILED` status and reason code | Requires valid reason code before dismissing | `active_turn_by_turn_stop_navigation/code.html` |
| 4 | Driver | Shift Status Toggle Pill | Header pill allowing driver to toggle between On Duty, Paused (Break), and Off Duty | Click interaction | Updates driver availability state in telemetry | Prevents starting navigation while Paused | `driver_home_active_shift_stops/code.html` |
| 5 | Driver | Emergency SOS Trigger | Dedicated urgent button in driver mobile UI for breakdowns or safety incidents | Click interaction, GPS coordinates | Broadcasts high-priority alert to Dispatch Command | Triggers confirmation prompt to avoid accidental taps | `driver_home_active_shift_stops/code.html` |
| 6 | Driver POD | 4-Digit SMS OTP Verification | Verification card confirming delivery via customer OTP | 4 numeric digits | Validated OTP status badge | Shows error shake animation on incorrect OTP | `proof_of_delivery_completion/code.html` |
| 7 | Driver POD | Photo Evidence with Geostamp | Photo capture module overlaying GPS Lat/Long, location name, and timestamp watermark | Camera image stream / file | Watermarked JPEG preview + tamper verification hash | Disallows submission if camera permission denied | `proof_of_delivery_completion/code.html` |
| 8 | Driver POD | Recipient Signature Canvas | HTML5 interactive drawing canvas with relationship pills (Self, Reception, Proxy) | Touch/mouse draw events | Base64 PNG signature string + timestamp | Warns if submitted with empty canvas | `proof_of_delivery_completion/code.html` |
| 9 | Driver POD | Cold-Chain Checklist & Temp Input | Inspection module capturing package integrity and internal container temperature | Checkbox boolean, decimal °C temperature | Status badge (Safe Range: 2.0°C–8.0°C) | Highlights warning if temperature is outside safe band | `proof_of_delivery_completion/code.html` |
| 10 | Manifest | Bulk Delivery Selection Bar | Floating action bar activated when table rows are checked; displays count and combined load | Checkbox row selection | Combined weight (kg), volume (m³), batch assignment button | Disables actions if aggregate weight exceeds capacity | `smartroute_delivery_operations_batch_management/code.html` |
| 11 | Manifest | Waybill Inspector Drawer | Slide-over drawer detailing shipment history, consignee, driver specs, and timeline | Table row click / Order ID | Slide-out panel with chain of custody milestones | Displays fallback message if delivery record missing | `smartroute_delivery_operations_batch_management/code.html` |
| 12 | Manifest | Manual Delivery Modal | Pop-up modal to manually register individual shipments into the unbatched queue | Customer name, phone, address, zone, weight, volume, priority, time window | Persisted Delivery entity added to unassigned table | Inline validation highlighting missing required fields | `smartroute_delivery_operations_batch_management/code.html` |
| 13 | Batching | Batch Composer Panel | Interactive sidebar displaying draft batch statistics, payload utilization bar, and AI chassis pick | Selected shipment IDs | Batch summary bento, capacity gauge, AI suggested driver/vehicle | Flags overload warning if payload > chassis capacity | `smartroute_delivery_operations_batch_management/code.html` |
| 14 | Optimizer | Dual Polyline Visualization | Simultaneous map rendering of naive baseline route vs AI optimized multi-stop ribbon | Route coordinates, stop sequence | Dashed grey naive trace vs glowing gradient optimized ribbon | Falls back to straight Euclidean lines if matrix fails | `smartroute_route_planner_optimizer/code.html` |
| 15 | Optimizer | Optimization Strategy Sliders | Interactive sliders for distance, time, fuel, and VIP priority weights with presets | Slider percentages ($0\% - 100\%$), preset buttons | Updated solver weight parameters | Normalizes weights so sum equals $1.0$ | `smartroute_route_planner_optimizer/code.html` |
| 16 | Optimizer | Drag-and-Drop Sequence Manager | Reorderable stop list allowing manual sequence overrides prior to dispatch | Drag-and-drop stop cards | Reordered sequence points and recalculated arrival ETAs | Flags time-window violations in red if reordering breaks window | `smartroute_route_planner_optimizer/code.html` |
| 17 | Optimizer | Impact Metrics Telemetry Cards | 5-card telemetry strip quantifying distance, time, fuel, CO2, and SLA deltas | Baseline vs optimized metrics | Formatted delta cards (e.g. -31.7% distance) | Displays "No Improvement" if optimized equals baseline | `smartroute_route_planner_optimizer/code.html` |
| 18 | Tracking | 3-Tier Telemetry Cockpit | Multi-panel screen combining vehicle directory, vector map, and CAN-Bus diagnostics | WebSocket telemetry feed | Real-time vehicle cards, map pins, speed, battery SoC, tire PSI | Shows disconnected banner if WebSocket drops | `smartroute_live_fleet_tracking_telemetry/code.html` |
| 19 | Tracking | Real-Time Road Congestion Layer | Map vector lines color-coded by traffic congestion (Green/Amber/Red) | Traffic speed data / simulated scenario | Colored road overlay with bottleneck callouts | Reverts to nominal road colors if traffic unavailable | `smartroute_live_fleet_tracking_telemetry/code.html` |
| 20 | Tracking | Live GPS Stream Toggle | Header switch enabling or pausing incoming real-time coordinate streaming | Toggle switch click | Pauses/resumes marker position updates | Retains last known coordinate when stream is paused | `smartroute_live_fleet_tracking_telemetry/code.html` |
| 21 | Dashboard | 6-Card Operational KPI Grid | Master dashboard summary cards with micro sparklines and completion gauges | Aggregated operational stats | Total Deliveries, Completed %, Transit, SLA %, Fleet, Fuel Spend | Displays zero/dash when date range has no deliveries | `smartroute_operational_master_dashboard/code.html` |
| 22 | Dashboard | Hourly Dispatch vs Target Chart | Composed hourly chart visualizing delivered parcels, delayed parcels, and target polyline | Hourly delivery logs | SVG/Recharts bar and line chart (08:00–18:00) | Empty bar slots for hours prior to depot opening | `smartroute_fleet_operations_delivery_dispatch_flow/code.html` |
| 23 | Dashboard | Real-Time Telemetry Feed | Chronological live event stream logging driver completions, route updates, and weather alerts | WebSocket event stream | Timestamped activity list with icon pills | Truncates to last 50 events to prevent DOM bloat | `smartroute_fleet_operations_delivery_dispatch_flow/code.html` |
| 24 | Ingestion | CSV Dry-Run Validation Modal | Pre-import validation engine parsing CSV, validating schema, geocoding, and errors | CSV/XLSX file upload | Error count, valid count, downloadable error report | Rejects corrupt or empty files with explicit alert | `docs/01-execution-plan.txt` & Stitch Manifest |
| 25 | Analytics | Planned vs Actual Route Comparison | Filtered analytical view comparing planned distance/time against executed GPS breadcrumbs | Route ID, date range, vehicle ID | Variance tables, distance error %, fuel variance | Labels data as simulated if live telemetry was absent | `docs/01-execution-plan.txt` Phase 7 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | CSV Batch Import | CSV contains un-geocodable address string (e.g. "Corner shop near red tree") | Backend dry-run flags address as un-resolvable; UI highlights row in red with error chip "Address Ambiguous / Geocode Failed" and offers manual coordinate pin placement. |
| 2 | CSV Batch Import | Delivery weight exceeds total vehicle capacity ($1,500\text{ kg}$ on an $800\text{ kg}$ van) | Batch composer blocks vehicle assignment, marks delivery as `UNASSIGNED` with reason code `CAPACITY_EXCEEDED`, and prevents dispatch until smaller parcels or higher-capacity chassis selected. |
| 3 | Route Optimizer | Time window is already in the past (e.g. delivery window $09:00 - 10:00$, planned departure $10:30$) | Optimizer classifies stop as hard-constraint violation, moves stop to unassigned queue with reason code `TIME_WINDOW_EXPIRED`, and alerts manager. |
| 4 | Route Optimizer | Two identical stop locations in the same batch with conflicting priorities | Heuristic merges coordinates for travel calculation but treats package drop-offs as sequenced stops, placing urgent drop first in service schedule. |
| 5 | Route Optimizer | Manual drag-and-drop reordering introduces a time window breach | UI immediately renders red warning border on breached stop card, displays expected arrival time in red text, and prompts dispatcher with "Time Window Violation (+35m late)". |
| 6 | Driver Navigation | Driver phone loses internet connectivity while in transit | Map displays offline banner, retains cached turn sequence and route instructions in local storage, and queues GPS breadcrumbs locally for deferred sync. |
| 7 | Driver Navigation | Driver taps "Arrived at Location" while $>500\text{m}$ outside the geofence | UI triggers verification warning modal: "Geofence Mismatch: You are 520m away from destination. Confirm you are at the correct location?", requiring explicit manager override code or manual bypass. |
| 8 | Proof of Delivery | Consignee cannot provide SMS OTP (phone dead / network outage) | Driver selects "Bypass OTP" option; UI prompts driver to select justification reason (*Consignee Phone Inaccessible*), requiring mandatory recipient photo and physical signature. |
| 9 | Proof of Delivery | Signature canvas submitted without any touch strokes (blank canvas) | Form validation prevents submission, displays toast notification "Recipient signature is mandatory", and keeps modal focused. |
| 10 | Proof of Delivery | Cold-chain temperature reading entered outside safe band ($14.5^\circ\text{C}$ on vaccines) | UI displays high-contrast amber/red alert: "Temperature Exceeds Safe Threshold (2.0°C - 8.0°C). Mandatory exception note required before proceeding." |
| 11 | Live Fleet Tracking | WebSocket server connection drops unexpectedly | Header sync badge transitions from green pinging "Socket.IO: Connected" to amber "Reconnecting..." with exponential backoff polling, falling back to REST `/api/v1/routes` polling every 10 seconds. |
| 12 | Live Fleet Tracking | Vehicle reports zero movement for $>30\text{ minutes}$ during active transit | Vehicle directory card automatically transitions status badge from "In Transit" to amber "Idle Alert (34m)" and surfaces "Check Driver Status" action trigger. |
| 13 | Live Fleet Tracking | Electric vehicle battery SoC drops below $15\%$ | Telemetry widget changes battery chip to red flashing warning "Critical Battery (12%) - Return to Depot / Charger Required" and highlights nearest charging hubs on GIS canvas. |
| 14 | Operational Dashboard | No delivery data exists for the selected filter date | Dashboard replaces chart and tables with clean empty state illustration: "No delivery manifests recorded for this date. Upload CSV or create a delivery to begin." |
| 15 | Analytics Export | User requests CSV export for a dataset containing $>10,000$ delivery records | Export executes via chunked streaming blob download to prevent browser tab out-of-memory crashes, showing a percent progress bar. |

---

## 9. Next Steps for Implementation Agents

1. **Phase 1 Foundation**:
   - Align `client/tailwind.config.js` with the tokens from `stitch_smartroute_fleet_platform/smartroute_logistics_operations_system/DESIGN.md`.
   - Scaffold React Router v6 routes in `client/src/App.tsx` matching Section 2 role paths.
   - Configure React Context / Zustand stores for Auth, Telemetry, and Active Route state.
2. **Phase 2 & 3 Manifest & Maps**:
   - Build reusable table components with density controls (`client/src/components/deliveries/ManifestTable.tsx`).
   - Implement `client/src/components/maps/GISMapCanvas.tsx` supporting both simulated SVG vectors and Google Maps API.
   - Implement `PapaParse` CSV upload with dry-run validation review.
3. **Phase 4 & 5 Route Optimizer UI**:
   - Implement 35%/65% split layout in `client/src/pages/admin/RoutePlannerPage.tsx`.
   - Integrate drag-and-drop stop sequencer with HTML5 drag events or `@hello-pangea/dnd`.
   - Build dual-polyline comparison visualization and delta impact cards.
4. **Phase 6 Driver Mobile App**:
   - Implement mobile-responsive views (`DriverHomePage.tsx`, `DriverNavigationPage.tsx`, `DriverPodPage.tsx`).
   - Build HTML5 canvas signature pad and camera capture component.
5. **Phase 7 Analytics**:
   - Construct Recharts visualizations (`HourlyDispatchChart.tsx`, `CapacityUtilizationDonut.tsx`, `VarianceAnalysisChart.tsx`).
   - Implement CSV and PDF export handlers.
