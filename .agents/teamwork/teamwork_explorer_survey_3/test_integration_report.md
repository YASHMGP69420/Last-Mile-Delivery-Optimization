# Comprehensive Test, Scaffolding, Simulation & Integration Survey Report
**Project:** SmartRoute — Last Mile Delivery Optimization Platform  
**Author:** Teamwork Explorer Survey 3 (`teamwork_explorer_survey_3`)  
**Date:** 2026-11-03  
**Status:** Complete Investigation & Synthesis  

---

## Executive Summary

This survey establishes the complete testing architecture, scaffolding plan, simulation frameworks, demo dataset specifications, and quality release gates for **SmartRoute**. Based on a direct audit of the project charter, architecture rules, execution plan, Stitch UI designs, risk register, and deployment readiness requirements, this report provides the blueprint for building and verifying the system across its entire development lifecycle.

The application currently has an initial Vite/TypeScript client shell (`client/`) without UI dependencies or server integration, and no backend codebase (`server/`). To reach production readiness and fulfill all P0 scenarios, the platform requires an **opaque-box, requirement-driven 4-tier testing hierarchy**, a robust dual-mode mapping adapter with deterministic traffic simulation, realistic geospatial datasets for Bhubaneswar, and rigorous security/QA gates (T701–T704).

---

## 1. End-to-End (E2E) Testing Track & 4-Tier Testing Hierarchy

### 1.1 Testing Philosophy & Principles
1. **Opaque-Box Requirement-Driven Testing:**
   - Tests interact exclusively with system boundary interfaces: standard HTTP REST endpoints (`/api/v1/*`), Socket.IO WebSocket events (`/socket/tracking`), browser DOM elements, and CSV import/export artifacts.
   - Internal implementation details (e.g., specific variable names or internal private helpers) are never asserted in E2E tests, ensuring refactoring does not break test stability.
2. **Strict Traceability:**
   - Every test case maps directly to requirements in `docs/04-requirements-traceability.txt` (FR-01 through FR-10, NFR-01 through NFR-03) and the 7 P0 critical scenarios from `docs/08-quality-test-plan.txt`.
3. **Pass/Fail Semantics:**
   - **Hard Constraint Violations:** If an optimization route violates vehicle capacity, includes ungeocoded stops, or violates mandatory time windows, the test MUST fail immediately.
   - **Performance SLA:** Optimization runs for demo batches (50–100 stops) must terminate and respond in `< 10.0 seconds` (NFR-01).
   - **Security Zero-Tolerance:** 100% of negative authorization test cases (accessing routes across tenant or role boundaries) must return HTTP 401 or 403.
   - **Audit Immutability:** Any state transition on a delivery or route must produce an immutable audit event in the database.

---

### 1.2 4-Tier Testing Hierarchy

```
+-------------------------------------------------------------------+
| Tier 4: Real-World Operational Workloads & System Stress Tests     |
| (Multi-zone batches, fleet shortage, mid-shift breakdowns, SLA)   |
+-------------------------------------------------------------------+
                                  ^
+-------------------------------------------------------------------+
| Tier 3: Cross-Feature Pairwise Integration Scenarios              |
| (CSV + Geocode, Reassign + Optimizer, Socket Reconnect + REST)    |
+-------------------------------------------------------------------+
                                  ^
+-------------------------------------------------------------------+
| Tier 2: Boundary, Extreme & Corner Cases (>=5 per feature domain) |
| (0/1/100 stops, cap overflow, inverted windows, corrupt CSVs)     |
+-------------------------------------------------------------------+
                                  ^
+-------------------------------------------------------------------+
| Tier 1: Core Feature Coverage (>=5 test cases per feature)        |
| (Auth, Batches, Vehicles, Routing, Optimization, Telemetry, KPIs) |
+-------------------------------------------------------------------+
```

#### Tier 1: Feature Coverage (>=5 Test Cases per Feature)

##### Feature 1: Authentication & Role-Based Access Control (RBAC)
- **TC-1.1.1 (Admin Login):** Authenticate with valid Admin credentials; verify HTTP 200, JWT returned, role verified as `ADMIN`, and redirection to admin management view.
- **TC-1.1.2 (Fleet Manager Login):** Authenticate with Fleet Manager credentials; verify access to batch planner, fleet management, and analytics; verify access denied to user creation.
- **TC-1.1.3 (Driver Login):** Authenticate with Driver credentials; verify redirection to mobile-first turn-by-turn view; verify denial of batch planning endpoints.
- **TC-1.1.4 (Invalid Password Handling):** Attempt login with invalid password; verify HTTP 401, generic error message (no user existence leak), and zero token issued.
- **TC-1.1.5 (Token Expiry & Blacklist):** Send expired JWT or logged-out token; verify HTTP 401 Unauthorized with prompt to re-authenticate.

##### Feature 2: Delivery & Batch Management
- **TC-1.2.1 (Manual Stop Creation):** Fleet manager creates a single delivery stop with address, weight, priority, and time window; verify HTTP 201 and initial status `DRAFT`.
- **TC-1.2.2 (Batch CSV Import):** Upload valid CSV with 25 stops; verify all rows parsed, validated, geocoded, and assigned to a `READY` batch.
- **TC-1.2.3 (Batch CSV Partial Error Reporting):** Upload CSV with 3 invalid rows (negative weight, missing address); verify valid rows staged, invalid rows flagged with row numbers, and error CSV downloadable.
- **TC-1.2.4 (Delivery Status Lifecycle):** Move delivery through `DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED`; verify state progression and audit event timestamps.
- **TC-1.2.5 (Stop Failure with Reason):** Transition delivery from `OUT_FOR_DELIVERY -> FAILED`; verify mandatory reason code (`CUSTOMER_UNAVAILABLE`, `PREMISES_CLOSED`, `REFUSED`) is recorded.

##### Feature 3: Fleet Management (Vehicles & Drivers)
- **TC-1.3.1 (Vehicle Registration):** Create Van, Bike, and Electric vehicle profiles with capacity, fuel type, and mileage/efficiency ratings; verify persistence and validation.
- **TC-1.3.2 (Driver Profile Assignment):** Link driver profile to active vehicle; verify driver status updates to `AVAILABLE`.
- **TC-1.3.3 (Vehicle Inactive Toggle):** Set vehicle status to `MAINTENANCE`; verify optimizer excludes this vehicle from subsequent batch allocations.
- **TC-1.3.4 (Vehicle Capacity Constraint Validation):** Attempt to assign deliveries exceeding vehicle's `capacityKg`; verify rejection with validation message.
- **TC-1.3.5 (Driver Single-Vehicle Rule):** Attempt to bind an already assigned driver to a second concurrent vehicle; verify conflict rejection (HTTP 409).

##### Feature 4: Maps, Geocoding & Distance Matrix
- **TC-1.4.1 (Valid Address Geocoding):** Submit standard Bhubaneswar address (e.g., "Patia Square, Bhubaneswar"); verify latitude/longitude resolution and cache entry created.
- **TC-1.4.2 (Distance Matrix Generation):** Request distance matrix for 10 stops; verify 10x10 matrix populated with positive distances (km) and travel durations (minutes).
- **TC-1.4.3 (Geocode Cache Utilization):** Request geocode for previously resolved address; verify response served from cache without external API call.
- **TC-1.4.4 (Unresolvable Address Flagging):** Submit malformed address ("$$$ Nowhere Street"); verify geocoding failure marked, status set to `UNRESOLVED`, and route planning blocked until resolved.
- **TC-1.4.5 (Provider Outage Fallback):** Simulate maps provider network timeout; verify graceful fallback to simulated distance matrix with `matrixSnapshot.source = "SIMULATED"`.

##### Feature 5: Route Optimization Engine
- **TC-1.5.1 (Baseline vs Optimized Improvement):** Execute optimization on 20-stop batch; verify total cost/distance of optimized sequence is less than or equal to original sequence.
- **TC-1.5.2 (Capacity Compliance):** Verify sum of assigned package weights on each vehicle does not exceed vehicle capacity.
- **TC-1.5.3 (Urgent Delivery Priority):** Verify stops flagged as `URGENT` are scheduled earlier in the route sequence than comparable standard stops.
- **TC-1.5.4 (Mandatory Time-Window Enforcement):** Verify stops with morning windows (09:00–11:00) have ETAs within the window; verify infeasible stops flagged with `TIME_WINDOW_VIOLATED`.
- **TC-1.5.5 (Unassigned Deliveries Transparency):** Run batch where total load exceeds fleet capacity; verify remaining stops returned in explicit `unassignedDeliveries` array with `CAPACITY_EXCEEDED` reason codes.

##### Feature 6: Live Driver Telemetry & Turn-by-Turn Execution
- **TC-1.6.1 (Socket Connection & Auth):** Driver connects to Socket.IO `/socket/tracking` using valid JWT; verify socket handshake accepted and joined to driver-specific room.
- **TC-1.6.2 (Location Broadcast):** Driver emits `driver:locationUpdated` coordinate ping; verify manager client in corresponding route room receives event within 250ms.
- **TC-1.6.3 (Active Route Isolation):** Driver submits location while having no active route; verify server drops location event or rejects per privacy policy (no tracking off-shift).
- **TC-1.6.4 (Stop Arrival Detection):** Driver arrives within 50m geofence of stop; verify prompt to complete delivery / capture proof of delivery (POD).
- **TC-1.6.5 (Turn-by-Turn Navigation Launch):** Driver clicks "Navigate"; verify external map handoff URL generated with correct target coordinates.

##### Feature 7: Analytics & Reporting
- **TC-1.7.1 (Planned vs Actual Delta):** Complete a route with deliberate route deviations; verify analytics endpoint computes delta in distance, travel time, and fuel cost.
- **TC-1.7.2 (On-Time Delivery Rate KPI):** Complete 8 stops on-time and 2 stops late; verify aggregated on-time rate displays exactly 80.0%.
- **TC-1.7.3 (Fuel Cost Calculation):** Verify combustion vehicle fuel cost calculation matches `(distanceKm / kmPerLitre) * fuelPrice` and EV matches `distanceKm * kWhPerKm * electricityPrice`.
- **TC-1.7.4 (CSV Report Export):** Request route performance CSV export; verify CSV headers and rows match persisted performance metrics.
- **TC-1.7.5 (Date/Vehicle Filter Validation):** Filter analytics by date range and specific vehicle; verify metrics aggregate only matching completed routes.

---

#### Tier 2: Boundary, Extreme & Corner Cases (>=5 per Domain)

##### Domain A: Batch & Stop Extremes
1. **TC-2.1.1 (Empty Batch):** Run optimization on a batch with 0 deliveries; verify HTTP 400 Bad Request with `"Batch contains no deliveries"`.
2. **TC-2.1.2 (Single Stop Batch):** Run optimization with 1 delivery; verify route consists of Depot -> Stop 1 -> Depot, distance calculated correctly, no 2-opt errors.
3. **TC-2.1.3 (Max Load Boundary):** Run batch with 100 deliveries (upper demo limit); verify memory usage remains bounded and optimizer finishes within 10s.
4. **TC-2.1.4 (Oversized Batch Rejection):** Attempt batch creation with 500 stops; verify system rejects or enforces batch splitting with clear guidance.
5. **TC-2.1.5 (Zero-Weight & Fractional Weight Deliveries):** Submit deliveries with weights `0.01 kg`, `0.00 kg`, and `999.99 kg`; verify zero weights handled gracefully and micro-weights do not cause division by zero.

##### Domain B: Capacity & Fleet Edges
1. **TC-2.2.1 (Exact Capacity Fit):** Vehicle capacity = 1000 kg; assign exactly 10 stops totaling 1000.0 kg; verify 100% vehicle utilization accepted without overflow.
2. **TC-2.2.2 (Capacity Overflow by 0.1 kg):** Vehicle capacity = 1000 kg; assign stops totaling 1000.1 kg; verify last stop is excluded with `CAPACITY_EXCEEDED`.
3. **TC-2.2.3 (Single Package Exceeds All Vehicles):** Delivery weight = 1500 kg; largest vehicle capacity = 1250 kg; verify delivery immediately marked unassigned with `PACKAGE_EXCEEDS_MAX_FLEET_CAPACITY`.
4. **TC-2.2.4 (Zero Available Vehicles):** All vehicles marked `MAINTENANCE` or `IN_USE`; attempt route optimization; verify all stops returned unassigned with `NO_AVAILABLE_VEHICLES`.
5. **TC-2.2.5 (Heterogeneous Fleet Preference):** Fleet consists of 1 Electric Scooter (40 kg cap) and 1 Van (1000 kg cap); verify optimizer assigns small urgent envelope to scooter and bulky loads to van.

##### Domain C: Geospatial & Distance Matrix Edges
1. **TC-2.3.1 (Identical Coordinates for Multiple Stops):** Three deliveries at exact same apartment complex (`20.3533, 85.8266`); verify distance between them is 0 km, 0 duration, no divide-by-zero or infinite loops in 2-opt.
2. **TC-2.3.2 (Depot-Coincident Stop):** Delivery address identical to depot coordinates; verify handled as zero-distance stop without circular routing crash.
3. **TC-2.3.3 (Out-of-Bounds Coordinates):** Coordinates outside Odisha (`28.6139, 77.2090` - Delhi); verify geofence validation flags delivery as `OUTSIDE_OPERATING_ZONE`.
4. **TC-2.3.4 (Extreme Geographic Outlier):** 20 stops in central Bhubaneswar, 1 stop 80 km away in rural periphery; verify optimizer isolates outlier or flags travel time penalty.
5. **TC-2.3.5 (Inverted Coordinate Input):** Longitude and latitude accidentally inverted (`85.8, 20.3`); verify geospatial validator detects latitude > 90 or out-of-range polygon and rejects.

##### Domain D: Time Window & Chronological Edges
1. **TC-2.4.1 (Zero-Duration Time Window):** Start time = `10:00`, End time = `10:00`; verify flagged as invalid time window during validation (`end must be greater than start`).
2. **TC-2.4.2 (Inverted Time Window):** Start time = `14:00`, End time = `11:00`; verify rejected at input validation.
3. **TC-2.4.3 (Immediate Past Time Window):** Delivery window was `08:00–09:00`, current dispatch time is `10:00`; verify flagged as `TIME_WINDOW_EXPIRED`.
4. **TC-2.4.4 (Tight Chain Windows):** Stop 1 window `09:00-09:15`, Stop 2 window `09:16-09:30`, travel time 20 min; verify optimizer flags infeasibility and cannot satisfy both.
5. **TC-2.4.5 (Midnight Crossover):** Route operating across midnight (`23:30` to `01:30`); verify duration and ETAs calculate correctly across day boundary.

##### Domain E: CSV & File Parser Boundaries
1. **TC-2.5.1 (Corrupted UTF-8 / BOM):** CSV with UTF-8 BOM, emoji in recipient name, or special characters (`O'Connor`, `Plot #44/A`); verify clean parsing without encoding corruption.
2. **TC-2.5.2 (Missing Mandatory Columns):** CSV missing `Address` or `Weight` column header; verify entire file rejected with clear list of missing headers.
3. **TC-2.5.3 (Extra Columns & Whitespace):** CSV containing extra extraneous columns and leading/trailing whitespace in fields; verify sanitized and extraneous columns ignored.
4. **TC-2.5.4 (XSS / SQL / NoSQL Injection in CSV):** Recipient name `<script>alert(1)</script>` or `{"$gt": ""}`; verify sanitized, escaped, and stored harmlessly.
5. **TC-2.5.5 (Duplicate Rows):** CSV containing duplicate order IDs; verify duplicate detection flags rows without silently overwriting or duplicating database records.

---

#### Tier 3: Cross-Feature Pairwise Integration Scenarios

1. **Scenario 3.1: CSV Import -> Geocoding -> Fleet Assignment Pipeline**
   - Upload 30-stop CSV -> System validates rows -> Triggers geocode cache/provider -> 28 stops resolve, 2 require manual address edit -> Fleet manager amends addresses -> Batch transitions to `READY` -> All 30 stops allocated to fleet.
2. **Scenario 3.2: Optimizer Engine -> Vehicle Breakdown -> Dynamic Reroute**
   - Dispatch 2 routes to Vehicle A and Vehicle B -> Vehicle A reports breakdown after stop 3 -> Manager reassigns remaining stops from Vehicle A to Vehicle B -> Optimizer re-runs on remaining stops respecting Vehicle B's remaining capacity -> Generates Route Version 2 -> Socket notifies Vehicle B driver.
3. **Scenario 3.3: Urgent Delivery Injection into In-Progress Batch**
   - Active batch running -> Customer service injects urgent medical delivery (`priority: URGENT`, time window within 45 min) -> System evaluates active vehicles -> Inserts into optimal vehicle sequence -> Verifies other stops' time windows remain feasible.
4. **Scenario 3.4: Network Loss -> Offline Stop Execution -> Reconnect Sync**
   - Driver in dead-zone (e.g., basement parking) marks stop `COMPLETED` and takes proof-of-delivery photo -> Client queues event locally -> Network restored -> Client pushes event to REST endpoint -> Server updates status, emits Socket.IO event, and manager dashboard reconciles without duplicate status events.
5. **Scenario 3.5: Google Maps API 429 Quota Exceeded -> Deterministic Fallback**
   - Optimization triggered during live demo -> Maps provider mock returns HTTP 429 Too Many Requests -> Routing service catches quota error, logs warning, and switches to Deterministic Simulation Matrix -> Route generates with `trafficMode: SIMULATED` -> UI displays warning badge -> Evaluation metrics preserved.
6. **Scenario 3.6: Driver Route Isolation & Unauthorized Access Attempt**
   - Driver 1 logged in on mobile -> Intercepts HTTP request and attempts `POST /api/v1/driver/stops/:id/events` for Stop belonging to Driver 2 -> API verifies token driver ID against assigned route driver ID -> Rejects with HTTP 403 Forbidden -> Emits security audit alert.

---

#### Tier 4: Real-World Operational Workloads & System Stress Tests

1. **Workload 4.1: "The Bhubaneswar Peak Monsoon Rush" (Heavy Stress)**
   - **Dataset:** 75 realistic stops distributed across 5 Bhubaneswar zones.
   - **Fleet:** 2 Diesel Vans (1000 kg cap), 1 EV Van (800 kg cap), 2 Electric Bikes (40 kg cap). Total fleet capacity = 3880 kg. Total demand = 3450 kg (88.9% utilization).
   - **Constraints:** 15 Urgent medical/grocery stops with tight morning windows (09:30–11:00); simulated monsoon evening traffic multiplier (1.8x travel time).
   - **Verification:** Optimizer must assign all feasible stops, isolate any infeasible stops with reason codes, complete in < 10.0 seconds, and achieve >= 15% distance reduction compared to baseline stop order.
2. **Workload 4.2: "Fleet Capacity Shortage & Deficit Handling"**
   - **Dataset:** 90 stops totaling 4500 kg demand.
   - **Fleet:** Only 2 active vans available (total capacity 2000 kg).
   - **Verification:** System must not crash or overfill vehicles; exactly 2000 kg assigned to vehicles honoring priority; remaining 2500 kg returned in unassigned queue with `CAPACITY_EXCEEDED` codes; UI presents clear unassigned delivery triage panel.
3. **Workload 4.3: "Simulated Shift Execution & Telemetry Streaming"**
   - **Execution:** 3 drivers simulate active execution across 40 stops; telemetry emulator emits GPS coordinates every 2 seconds for each driver over 15 minutes of accelerated simulation; drivers submit completion/failure events.
   - **Verification:** Manager dashboard processes 450+ telemetry events and 40 status transitions without WebSocket memory leak, UI freezing, or out-of-order event states; final analytics match calculated planned-vs-actual metrics.
4. **Workload 4.4: "Optimization Engine Algorithmic Benchmark"**
   - **Workload:** 100 geocoded stops running Nearest-Neighbor construction followed by 2-opt local search.
   - **Hardware/Env:** Standard 2-core Node.js container / local developer workstation.
   - **Verification:** CPU execution time strictly `< 8.0 seconds`; memory footprint remains `< 250 MB`; baseline distance vs 2-opt distance delta verified and documented.

---

### 1.3 Test Harness & Runner Specifications

| Layer | Recommended Runner | Command | Target Coverage / SLA |
|---|---|---|---|
| Backend Unit & Service Tests | Jest (`ts-jest`) | `npm run test:backend` | > 90% branch coverage on algorithms, models, and services |
| API & Integration Tests | Jest + Supertest | `npm run test:api` | 100% of REST endpoints and RBAC negative cases |
| Frontend Component & Unit | Vitest + React Testing Library | `npm run test:client` | Key components, tables, filters, and state hooks |
| End-to-End System Tests | Cypress (or Playwright) | `npm run test:e2e` | All 7 P0 scenarios passing in headless CI mode |
| Performance Benchmark | Custom Node.js timed runner | `npm run test:perf` | Batch 50–100 stops completes in `< 10.0s` |

---

## 2. Scaffolding Needs: `server/` and `client/`

### 2.1 Workspace Audit & Current Gaps
An inspection of the repository reveals:
- **Root Directory:** No root `package.json` to coordinate npm workspaces or monorepo build/test scripts.
- **Client Directory (`client/`):** Contains a raw Vite + TypeScript skeleton created via `npm create vite@latest client --template react-ts`, but `package.json` lacks React Router, Lucide icons, Recharts, PapaParse, Leaflet/Maps, Axios, and Socket.IO client.
- **Server Directory (`server/`):** Completely missing. Must be created from scratch with complete Express, Mongoose, Socket.IO, and JWT structure.

---

### 2.2 Server Scaffolding Requirements (`server/`)

#### Directory Tree
```
server/
├── package.json
├── tsconfig.json (or jsconfig.json)
├── .env.example
├── .gitignore
├── src/
│   ├── index.js (Server entry point: Express + HTTP server + Socket.IO)
│   ├── config/
│   │   ├── db.js (Mongoose connection & retry logic)
│   │   ├── env.js (Environment variable schema validation)
│   │   └── constants.js (Roles, statuses, default weights)
│   ├── models/
│   │   ├── User.js (User, roles, password hashing)
│   │   ├── Driver.js (Driver profile, license, vehicle link)
│   │   ├── Vehicle.js (Specs, fuel type, capacity, availability)
│   │   ├── Delivery.js (Address, geo, priority, time window, status)
│   │   ├── DeliveryBatch.js (Batch code, depot, delivery/fleet references)
│   │   ├── Route.js (Versioned routes, stop sequence, metrics, snapshot)
│   │   ├── DeliveryEvent.js (Immutable status audit log)
│   │   └── LocationEvent.js (Telemetry history with retention policy)
│   ├── routes/
│   │   ├── authRoutes.js (/api/v1/auth)
│   │   ├── userRoutes.js (/api/v1/users)
│   │   ├── deliveryRoutes.js (/api/v1/deliveries)
│   │   ├── batchRoutes.js (/api/v1/batches)
│   │   ├── vehicleRoutes.js (/api/v1/vehicles)
│   │   ├── driverRoutes.js (/api/v1/drivers)
│   │   ├── routeRoutes.js (/api/v1/routes & /api/v1/routes/plan)
│   │   ├── driverExecutionRoutes.js (/api/v1/driver/*)
│   │   └── analyticsRoutes.js (/api/v1/analytics)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── deliveryController.js
│   │   ├── batchController.js
│   │   ├── fleetController.js
│   │   ├── optimizationController.js
│   │   ├── driverExecutionController.js
│   │   └── analyticsController.js
│   ├── services/
│   │   ├── mapping/
│   │   │   ├── mappingInterface.js (Common adapter interface)
│   │   │   ├── googleMapsService.js (Google Geocoding & Distance Matrix)
│   │   │   └── mockMappingService.js (Deterministic offline matrix & geocoder)
│   │   ├── optimization/
│   │   │   ├── optimizer.js (Heuristic coordinator)
│   │   │   ├── nearestNeighbor.js (Construction heuristic)
│   │   │   ├── twoOpt.js (2-opt local search improvement)
│   │   │   ├── costEvaluator.js (Configurable objective function)
│   │   │   └── vehicleAllocator.js (Multi-vehicle bin packing & capacity check)
│   │   ├── tracking/
│   │   │   └── trackingSocket.js (Socket.IO auth, rooms, telemetry broadcast)
│   │   └── analytics/
│   │       ├── kpiService.js (Aggregation pipelines for planned vs actual)
│   │       └── reportService.js (CSV / JSON report generation)
│   ├── middleware/
│   │   ├── authMiddleware.js (JWT extraction & role verification)
│   │   ├── validationMiddleware.js (express-validator error formatting)
│   │   ├── errorMiddleware.js (Centralized error handler & JSON envelope)
│   │   └── auditMiddleware.js (Automatic state-change event logging)
│   └── seed/
│       ├── seedDatabase.js (Seeder CLI)
│       └── bhubaneswarData.js (Realistic 50-100 stops, vehicles, users)
└── tests/
    ├── unit/
    │   ├── optimizer.test.js
    │   ├── costEvaluator.test.js
    │   └── fuelCalculator.test.js
    └── integration/
        ├── auth.test.js
        ├── deliveryCrud.test.js
        ├── batchPlanning.test.js
        └── rbacNegative.test.js
```

#### Key Server Dependencies (`server/package.json`)
```json
{
  "name": "smartroute-server",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "seed": "node src/seed/seedDatabase.js",
    "test": "jest --runInBand",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "express-validator": "^7.0.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.3.1",
    "morgan": "^1.10.0",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "supertest": "^6.3.4"
  }
}
```

---

### 2.3 Client Scaffolding Requirements (`client/`)

#### Target Directory Structure
```
client/src/
├── index.html
├── main.tsx
├── App.tsx
├── router.tsx (React Router role-protected routes)
├── design-system/
│   ├── components.css (Stitch utility classes)
│   └── tokens.ts (Colors, typography, spacing from Stitch DESIGN.md)
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx (Status indicators: Active, Caution, Critical)
│   │   └── Card.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx (240px / 64px collapsible)
│   │   ├── DashboardLayout.tsx
│   │   └── DriverLayout.tsx (Mobile optimized)
│   └── specific/
│       ├── batch/
│       │   ├── BatchTable.tsx
│       │   ├── CsvUploadModal.tsx
│       │   └── StopEditorModal.tsx
│       ├── map/
│       │   ├── InteractiveMap.tsx (Leaflet / Google Maps toggle)
│       │   ├── VehicleMarker.tsx (Dynamic heading & status)
│       │   └── RoutePolyline.tsx
│       ├── optimization/
│       │   ├── MetricsComparisonCard.tsx (Baseline vs 2-Opt deltas)
│       │   ├── UnassignedStopsDrawer.tsx
│       │   └── StopSequenceList.tsx
│       ├── driver/
│       │   ├── TurnByTurnNav.tsx
│       │   ├── StopChecklist.tsx
│       │   └── PodCaptureModal.tsx
│       └── analytics/
│           ├── KpiCard.tsx
│           ├── PerformanceChart.tsx (Recharts planned vs actual)
│           └── FuelCostBreakdown.tsx
├── pages/
│   ├── Login.tsx
│   ├── MasterDashboard.tsx (Stitch design)
│   ├── BatchManagement.tsx (Stitch design)
│   ├── RoutePlanner.tsx (Stitch design)
│   ├── LiveTracking.tsx (Stitch design)
│   ├── FleetManagement.tsx (Vehicles & Drivers)
│   ├── DriverHome.tsx (Mobile turn-by-turn)
│   └── AnalyticsDashboard.tsx (KPIs & Reports)
├── services/
│   ├── api.ts (Axios instance with JWT interceptor)
│   ├── authService.ts
│   ├── deliveryService.ts
│   ├── routeService.ts
│   └── socketService.ts (Socket.IO client singleton)
├── hooks/
│   ├── useAuth.ts
│   ├── useSocket.ts
│   └── useDeliveries.ts
└── utils/
    ├── formatters.ts (Distance km, currency INR, duration min)
    └── csvParser.ts (PapaParse wrapper with schema validation)
```

#### Required Client Dependencies to Add (`client/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "axios": "^1.6.8",
    "lucide-react": "^0.378.0",
    "recharts": "^2.12.7",
    "papaparse": "^5.4.1",
    "socket.io-client": "^4.7.5",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@types/papaparse": "^5.3.14",
    "@types/leaflet": "^1.9.11",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
```

---

### 2.4 Monorepo Root Scaffolding

To run and verify the complete solution, a root `package.json` is required:
```json
{
  "name": "smartroute-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "client",
    "server"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=client",
    "test": "npm run test --workspace=server",
    "test:e2e": "cypress run",
    "seed": "npm run seed --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

## 3. Mocking & Simulation Framework

### 3.1 Motivation & Risk Mitigation (Ref: `docs/09-risk-register.txt`)
- **API Cost & Quota Risk:** Google Maps Distance Matrix charges per element ($0.005 to $0.010 per origin-destination pair). A 50-stop matrix contains `50 x 50 = 2,500 elements` costing up to $25 per single test execution. Automated test runs would rapidly exhaust quotas or trigger unexpected cloud billing.
- **Offline / CI Stability:** Automated pipelines (e.g., GitHub Actions) must execute reliably without secret keys or internet access.
- **Flakiness Elimination:** Real-world traffic varies continuously, making deterministic mathematical assertions about baseline vs 2-opt improvements impossible.
- **Truth in Advertising (Charter & Decision Log D-07):** The system must never label simulated or cached data as "Live". Every matrix result must be stamped with its provenance (`source: "GOOGLE" | "SIMULATED"`).

---

### 3.2 Dual-Mode Mapping Service Architecture

```
                      +-----------------------------+
                      |   IMappingService Interface |
                      +-----------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
+-------------------------------+           +-------------------------------+
|     GoogleMapsService         |           |      MockMappingService       |
|  - Real Google Geocoding API  |           |  - Static Bhubaneswar POIs   |
|  - Google Distance Matrix API |           |  - Haversine + Circuity factor|
|  - In-memory TTL Caching      |           |  - Deterministic Traffic Mod. |
+-------------------------------+           +-------------------------------+
               |                                           |
               +---------------------+---------------------+
                                     |
                      +-----------------------------+
                      | Routing & Optimizer Engine  |
                      | (Consumes unified matrix)   |
                      +-----------------------------+
```

#### Deterministic Distance & Duration Formulation
When operating in mock/simulated mode:
1. **Haversine Surface Distance:**
   $$d_{\text{haversine}}(p_1, p_2) = 2 R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
   Where $R = 6371.0 \text{ km}$.
2. **Road Circuity Factor ($C_{\text{road}}$):**
   Urban Bhubaneswar road grids do not follow straight lines. Simulated road distance:
   $$\text{distanceKm} = d_{\text{haversine}} \times 1.35$$
3. **Base Travel Time:**
   Assuming average city speed $V_{\text{base}} = 28 \text{ km/h}$:
   $$\text{baseDurationMinutes} = \left(\frac{\text{distanceKm}}{V_{\text{base}}}\right) \times 60$$

---

### 3.3 Pre-Programmed Deterministic Traffic Scenarios

The `MockMappingService` supports selectable traffic profiles via the `trafficScenario` configuration:

| Scenario Code | Label | Multiplier | Road Speed ($V_{\text{avg}}$) | Context / Impact |
|---|---|---|---|---|
| `SCENARIO_NORMAL` | Clear Flow | 1.0x | 28 km/h | Standard mid-day conditions (11:00–16:00). |
| `SCENARIO_PEAK_MORNING` | Morning Rush | 1.5x | 18.6 km/h | Heavy congestion towards Secretariat and Master Canteen (08:30–10:30). |
| `SCENARIO_PEAK_EVENING` | Evening Rush | 1.8x | 15.5 km/h | Heavy congestion in Patia / Infocity and Janpath (17:00–20:00). |
| `SCENARIO_MONSOON_FLOOD` | Heavy Rain / Flood | 2.2x | 12.7 km/h | Waterlogging on low-lying segments (Iskcon Nayapalli, Rasulgarh square); EV efficiency reduced by 15%. |
| `SCENARIO_CORRIDOR_BLOCK` | Khandagiri Detour | +5.0 km / +20 min | Detour | Complete blockage on NH-16 junction forcing alternative arterial routing. |

#### Provenance Stamping in Route Result
Every route snapshot records:
```json
{
  "matrixSnapshot": {
    "source": "SIMULATED",
    "trafficScenario": "SCENARIO_PEAK_EVENING",
    "multiplier": 1.8,
    "generatedAt": "2026-11-03T18:00:00.000Z",
    "stopsCount": 50
  }
}
```

---

### 3.4 Driver Telemetry Simulation Engine

To enable 100% offline testing of Phase 6 (live tracking and turn-by-turn navigation):
- A server-side or client-side telemetry simulator advances simulated driver coordinates along the computed route polyline at configurable speeds ($1\times, 5\times, 20\times$).
- At each step, it emits a `driver:locationUpdated` WebSocket payload:
  ```json
  {
    "driverId": "6635c1234567890abcdef101",
    "routeId": "6635c1234567890abcdef201",
    "lat": 20.3541,
    "lng": 85.8289,
    "speedKmh": 24.5,
    "heading": 142,
    "timestamp": "2026-11-03T18:05:00.000Z"
  }
  ```
- When the simulated driver coordinate enters a 50-meter radius of the next stop, the simulation triggers the arrival state, testing the driver UI's transition to the POD capture screen.

---

## 4. Demo Dataset Specifications: Bhubaneswar, Odisha

### 4.1 Operating Region Rationale
- Region: **Bhubaneswar Urban Agglomeration, Odisha, India**.
- Bounding Box:
  - North: `20.3900° N` (Trisulia / Nandankanan boundary)
  - South: `20.2100° N` (Dhauli / Lingaraj rural fringe)
  - West: `85.7400° E` (SUM Hospital / Khandagiri hills)
  - East: `85.9100° E` (Hanspal / Kuakhai river bridge)
- Reference Depot:
  - **Mancheswar Industrial Estate Logistics Hub**
  - Address: Plot 12, Sector A, Mancheswar Industrial Estate, Bhubaneswar, Odisha 751010
  - Coordinates: `Lat: 20.3012° N, Lng: 85.8647° E`

---

### 4.2 Urban Clusters & Delivery Stops (50–100 Fixture Stops)

The fixture dataset distributes stops across 5 characteristic operational zones:

| Zone ID | Zone Name | Description & Major Landmarks | Lat Range | Lng Range | Stop Count |
|---|---|---|---|---|---|
| **Z-1** | IT & Higher Ed Corridor | Patia, Infocity, KIIT University, Sailashree Vihar, Chandrasekharpur | 20.3400 – 20.3700 | 85.8100 – 85.8350 | 25 stops |
| **Z-2** | Commercial & Retail Core | Saheed Nagar, Master Canteen, Janpath, Kharvela Nagar, Ashok Nagar | 20.2650 – 20.2950 | 85.8350 – 85.8550 | 25 stops |
| **Z-3** | Heritage & High-Density Core | Old Town, Lingaraj Temple Road, Bapuji Nagar, Forest Park | 20.2350 – 20.2550 | 85.8200 – 85.8450 | 15 stops |
| **Z-4** | Health & Western Hub | Khandagiri, Nayapalli, Jayadev Vihar, IRC Village, SUM Hospital | 20.2550 – 20.3050 | 85.7800 – 85.8150 | 20 stops |
| **Z-5** | Industrial & Transport Fringe | Rasulgarh, Mancheswar, Hanspal, Cuttack-Puri Bypass | 20.2850 – 20.3250 | 85.8650 – 85.8950 | 15 stops |
| **Total** | | Full Realistic Benchmark Fixture | | | **100 stops** |

#### Delivery Stop Attributes
Each stop in `bhubaneswarData.js` and `deliveries_fixture.csv` provides:
- `orderId`: Unique identifier (e.g., `ORD-BBS-1001` to `ORD-BBS-1100`).
- `customerName`: Realistic local names (e.g., "Soumya Ranjan Mohanty", "Debashis Patnaik", "Ananya Mishra").
- `phone`: Standard formatted mobile numbers (`+91 98610 XXXXX`).
- `address`: Full street address with area, landmark, and pincode (751001 to 751024).
- `lat`, `lng`: Exact verified coordinates within the zone.
- `weightKg`: Package weight (0.5 kg to 120 kg).
- `priority`: `URGENT` (20% of stops) vs `STANDARD` (80% of stops).
- `timeWindow`:
  - Morning Urgent: `09:30 - 11:30`
  - Afternoon Urgent: `13:30 - 15:30`
  - Standard All-Day: `09:00 - 18:00`
- `serviceDurationMinutes`: Estimated parking and delivery handoff time (5 to 12 min).

---

### 4.3 Fleet & Vehicle Fixtures

| Vehicle Code | Model / Description | Type | Capacity (kg) | Fuel Type | Efficiency | Fuel Price | Assigned Driver |
|---|---|---|---|---|---|---|---|
| `VEH-VAN-01` | Tata Ace Gold Diesel | Van | 750 kg | Diesel | 15.0 km/L | ₹94.50 / L | `DRV-01` (Rajesh Kumar) |
| `VEH-VAN-02` | Mahindra Bolero Maxi Truck | Van | 1200 kg | Diesel | 13.0 km/L | ₹94.50 / L | `DRV-02` (Amitabh Nayak) |
| `VEH-EV-01` | Mahindra Treo Zor Cargo | 3-Wheeler | 500 kg | Electric | 0.12 kWh/km | ₹7.20 / kWh | `DRV-03` (Priya Das) |
| `VEH-BIKE-01` | Hero Electric NYX Cargo | Bike | 40 kg | Electric | 0.04 kWh/km | ₹7.20 / kWh | `DRV-04` (Bikram Rout) |
| `VEH-BIKE-02` | Honda Activa 6G (Petrol) | Bike | 35 kg | Petrol | 45.0 km/L | ₹103.20 / L | (Unassigned Reserve) |

---

### 4.4 Demo User Accounts & Seed Credentials

| Role | Name | Email | Password (Plaintext for Demo) | Bcrypt Hash Rounds |
|---|---|---|---|---|
| `ADMIN` | Super Administrator | `admin@smartroute.internal` | `Admin@SmartRoute2026!` | 10 rounds |
| `FLEET_MANAGER` | Bhubaneswar Dispatcher | `manager.bbsr@smartroute.internal` | `Manager@SmartRoute2026!` | 10 rounds |
| `DRIVER` | Rajesh Kumar (Van 1) | `rajesh.driver@smartroute.internal` | `Driver@SmartRoute2026!` | 10 rounds |
| `DRIVER` | Amitabh Nayak (Van 2) | `amitabh.driver@smartroute.internal` | `Driver@SmartRoute2026!` | 10 rounds |
| `DRIVER` | Priya Das (EV Treo) | `priya.driver@smartroute.internal` | `Driver@SmartRoute2026!` | 10 rounds |

---

## 5. Quality Gates, Acceptance Criteria & Security Audit (T701–T704)

### 5.1 Task T701: Backend Unit, Algorithm & Integration Tests

#### Detailed Acceptance Criteria
1. **Optimization Pure Functions:**
   - Nearest-Neighbor algorithm produces a valid tour starting and ending at the depot.
   - 2-opt heuristic iteratively reduces total tour cost without violating hard capacity or time windows.
   - Objective cost function properly weights distance, time, fuel, and priority penalties according to configured constants:
     $$\text{Score} = w_d \cdot D_{\text{total}} + w_t \cdot T_{\text{total}} + w_f \cdot C_{\text{fuel}} + w_p \cdot P_{\text{priority}} + w_w \cdot P_{\text{window}}$$
   - Multi-vehicle bin packing respects maximum capacity and generates deterministic unassigned reason codes (`CAPACITY_EXCEEDED`, `UNGEODECODED`, `WINDOW_UNFEASIBLE`).
2. **Fuel Computation:**
   - Combustion formula strictly computes:
     $$\text{FuelLitres} = \frac{\text{DistanceKm}}{\text{kmPerLitre}}, \quad \text{FuelCost} = \text{FuelLitres} \times \text{PricePerLitre}$$
   - EV formula strictly computes:
     $$\text{EnergyKWh} = \text{DistanceKm} \times \text{kWhPerKm}, \quad \text{EnergyCost} = \text{EnergyKWh} \times \text{PricePerKWh}$$
   - Tests assert zero NaN, division-by-zero, or type coercion errors.
3. **Mongoose Model & Lifecycle Validation:**
   - State machine prevents invalid transitions (e.g., cannot jump directly from `DRAFT` to `COMPLETED`).
   - Every delivery state change writes an append-only `DeliveryEvent` document with user ID, prior status, new status, and timestamp.
4. **Target Coverage:**
   - Statements: $\ge 90\%$
   - Branches: $\ge 85\%$
   - Functions: $\ge 90\%$
   - Lines: $\ge 90\%$

---

### 5.2 Task T702: Cypress / Playwright End-to-End User Flow Tests

#### Verification of 7 Critical P0 Scenarios

| Scenario ID | Test Specification | Pre-conditions | Action | Assertion & Evidence |
|---|---|---|---|---|
| **P0-1** | CSV Import & Row-Level Error Handling | Fleet manager logged in | Upload `deliveries_partial_invalid.csv` | Valid 20 stops imported into batch; 2 invalid rows highlighted in table with row numbers and exact column validation errors; batch status remains `DRAFT`. |
| **P0-2** | Dispatch Prevention on Violations | Batch created with 1 ungeocoded stop and total weight > vehicle capacity | Click "Dispatch Batch" | System blocks dispatch action; UI displays modal detailing blocking issues (ungeocoded stop ID and excess kg); HTTP 422 returned. |
| **P0-3** | Optimization Metrics & Reproducibility | 25 geocoded stops in batch | Click "Optimize Routes" | UI renders baseline vs 2-opt comparison card; shows delta in km and INR; route record in database persists `matrixSnapshot`, `weights`, and original stop sequence. |
| **P0-4** | Driver Isolation & Tenant Security | Driver A and Driver B authenticated | Driver A attempts to view `/api/v1/routes/:driverB_routeId` or modify stop | Request rejected with HTTP 403 Forbidden; client redirects to Driver A's active shift screen. |
| **P0-5** | Driver Execution & Real-Time Sync | Manager on dashboard; Driver on mobile turn-by-turn view | Driver marks Stop 1 `COMPLETED` and Stop 2 `FAILED` (with reason `CUSTOMER_UNAVAILABLE`) | Manager screen receives WebSocket update within 1s; stop pin color changes to Green/Red; analytics summary updates without page reload. |
| **P0-6** | Provider Failure Safe Recovery | Maps API key disabled or mock returning HTTP 500 | Manager requests route optimization | Routing service falls back to `MockMappingService`; UI displays amber banner `"Operating in Simulated Traffic Mode"`; route completes successfully. |
| **P0-7** | Production Deployment Smoke Test | Deployed staging/production URL | Execute automated headless script: Login -> Create Batch -> Optimize -> Dispatch -> Complete Stop -> View Analytics | All steps complete with HTTP 200/201; no uncaught browser console errors; total run time < 45 seconds. |

---

### 5.3 Task T703: Security Audit & Hardening Matrix

#### OWASP Top 10 & Last-Mile Specific Security Requirements

1. **Authentication & Password Storage:**
   - All passwords hashed using `bcryptjs` with salt round work factor $\ge 10$.
   - Passwords never logged, printed in Morgan output, or returned in any user JSON payload (`select: '-passwordHash'`).
2. **JWT Security & Token Lifecycle:**
   - Access tokens signed using `HS256` or `RS256` with strong random secret (`JWT_SECRET`, min 32 characters).
   - Token expiry strictly bounded (e.g., 60 minutes for access tokens).
   - Server-side token invalidation / logout blacklist implemented in Redis or database collection.
3. **Role-Based Access Control (RBAC):**
   - Middleware `requireRole(['ADMIN'])`, `requireRole(['ADMIN', 'FLEET_MANAGER'])`, and `requireRole(['DRIVER'])` applied to every private route.
   - Resource-level ownership checks: verify `delivery.assignedDriverId === req.user.driverId` before allowing stop state changes.
4. **Input Sanitization & Injection Prevention:**
   - `express-validator` applied to all endpoints with strict schemas.
   - NoSQL injection protection: request bodies sanitized to strip `$` and `.` operators.
   - CSV upload sanitized to prevent CSV Formula Injection (cells starting with `=`, `+`, `-`, `@` escaped).
5. **CORS, Headers & Rate Limiting:**
   - Helmet.js configured with Content Security Policy (CSP), X-Frame-Options (`DENY`), and HSTS.
   - CORS origin restricted to `CLIENT_ORIGIN` (reject wildcard `*` in production).
   - Rate limiting: Max 10 requests per minute on `/api/v1/auth/login`; max 30 requests per minute on `/api/v1/routes/plan`.
6. **Location Privacy Compliance (Ref: Charter & Decision Log D-11):**
   - Telemetry location events accepted only when driver has an assigned route in `OUT_FOR_DELIVERY` status.
   - Location history retention policy: purge raw high-frequency pings after 30 days; retain only aggregated stop arrival timestamps.

---

### 5.4 Task T704: CI/CD Pipelines, Dockerfiles & Deployment Readiness

#### Dockerfile Strategy
- **Client (`client/Dockerfile`):** Multi-stage build.
  - Stage 1: `node:20-alpine` builds static bundle via `npm run build`.
  - Stage 2: `nginx:alpine` serves static files from `/dist` with SPA history fallback routing (`try_files $uri $uri/ /index.html;`).
- **Server (`server/Dockerfile`):**
  - Base: `node:20-alpine` runtime.
  - Installs production dependencies only (`npm ci --only=production`).
  - Runs non-root user for security (`USER node`).
  - Exposes port and healthcheck (`curl -f http://localhost:5000/health || exit 1`).

#### GitHub Actions Workflow Baseline (`.github/workflows/ci.yml`)
1. **Job 1: Lint & Typecheck**
   - Runs `npm run lint` and `tsc --noEmit` across client and server.
2. **Job 2: Backend Unit & Integration Tests**
   - Spins up `mongo:7.0` service container.
   - Executes `npm run test --workspace=server`.
   - Uploads test coverage report to artifact store.
3. **Job 3: End-to-End Cypress Tests**
   - Starts mock server and client dev servers.
   - Runs Cypress headless test suite covering all 7 P0 scenarios.
4. **Job 4: Build Verification & Secret Scanning**
   - Verifies zero hardcoded API keys or credentials in commit history (TruffleHog / GitGuardian scan).
   - Builds Docker container images.

#### Deployment Readiness Sign-Off Checklist (`docs/11-deployment-readiness.txt`)
- [ ] Production secrets configured in Vercel and Render dashboards; no `.env` checked into git.
- [ ] Database backup and point-in-time restore verified on MongoDB Atlas.
- [ ] Healthcheck endpoint (`/health`) returns HTTP 200, database connection state, and uptime.
- [ ] Pre-launch smoke test passes on public staging URL using clean browser profile.
- [ ] README.txt updated with live URLs, demo login credentials, architecture diagram, and known limitations.

---

## 6. Recommendations & Action Plan for Implementation Agents

1. **Immediate Next Step for Monorepo (Agent A0):**
   - Create root `package.json` with npm workspaces (`workspaces: ["client", "server"]`).
   - Add root build, dev, test, and seed scripts.
2. **Immediate Next Step for Backend (Agent A2):**
   - Scaffold `server/` with the exact directory tree detailed in Section 2.2.
   - Install dependencies (`express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`, `socket.io`, `express-validator`).
   - Implement `User` model, auth controller, and seed script with the Bhubaneswar demo dataset (Section 4).
3. **Immediate Next Step for Frontend (Agent A1):**
   - Upgrade `client/package.json` to include `react-router-dom`, `lucide-react`, `recharts`, `papaparse`, `leaflet`, `axios`, and `socket.io-client`.
   - Replace Vite placeholder in `client/src/main.ts` with React root, router, and design tokens from `stitch_smartroute_fleet_platform/smartroute_logistics_operations_system/DESIGN.md`.
4. **Immediate Next Step for QA & Testing (Agent A6):**
   - Set up Jest in `server/` and Vitest/Cypress in `client/`.
   - Implement the `MockMappingService` with Bhubaneswar POIs and the 5 deterministic traffic scenarios (Section 3) to enable offline testing without API keys.

---
*Report completed by teamwork_explorer_survey_3.*
