# Project: SmartRoute — Last-Mile Delivery Optimization Platform

## Architecture
SmartRoute is a high-reliability, role-based last-mile delivery optimization platform designed for logistics operations in Bhubaneswar. The architecture follows a modular monorepo structure with strict separation of concerns:
- **Client (Frontend)**: React 18, Vite, Tailwind CSS, TypeScript, Lucide Icons, Recharts, PapaParse, and Leaflet/custom vector map canvas. Implements Google Stitch design templates with dark-slate command theme (`#14243A`, `#0051D5`), Inter typography, and proportional tabular lining figures (`tnum`).
- **Server (Backend API)**: Node.js, Express, MongoDB Atlas with Mongoose schemas, JWT authentication with bcrypt password hashing, and Socket.IO for real-time telemetry streaming.
- **Pure Service Layers**:
  - `MappingService`: Dual-mode provider (Google Maps Platform with automated fallback to a 5-scenario deterministic simulated traffic matrix).
  - `OptimizationService`: Multi-vehicle clustering bin-packing heuristic, Nearest-Neighbor sequence construction, bounded 2-opt local search, multi-objective cost scoring, and EV/ICE fuel consumption modeling.
  - `TelemetryService`: Consented driver GPS streaming restricted to active routes, room-based WebSocket broadcasting, and automated 30-day location retention pruning.
  - `AnalyticsService`: Real-time KPI aggregation, planned vs actual variance analysis, and CSV/PDF export.
- **E2E Testing Track**: Independent opaque-box test runner validating system boundary contracts across a 4-tier testing hierarchy (Features, Boundaries, Pairwise Combinations, and Real-World Workloads).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | User Authentication | JWT credentials authentication, bcrypt hashing, login/logout | M1 | Survey 1, 3 |
| 2 | User Provisioning & RBAC | Role-based authorization for ADMIN, FLEET_MANAGER, DRIVER | M1 | Survey 1, 3 |
| 3 | Token Refresh & Session Management | Token renewal, active token blacklist upon logout | M1 | Survey 1 |
| 4 | Vehicle Registry CRUD | Vehicle models, capacities (kg/m3), fuel type (ICE/EV), efficiency ratings | M1 | Survey 1, 3 |
| 5 | Driver Profile CRUD | Driver credentials, phone, license, shift status, availability | M1 | Survey 1, 3 |
| 6 | Driver-Vehicle Pairing | Enforce 1:1 active vehicle assignment constraint | M1 | Survey 1, 3 |
| 7 | Delivery Consignment CRUD | Individual delivery management, weight, volume, priority, time windows | M1 | Survey 1, 2 |
| 8 | CSV Batch Import & Dry-Run Validation | PapaParse drag-and-drop import, row validation, error CSV download | M1 | Survey 1, 2, 3 |
| 9 | Delivery Lifecycle State Machine | Enforce DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED/FAILED | M1 | Survey 1, 3 |
| 10 | Immutable Delivery & Audit Logging | DeliveryEvent and AuditEvent collections capturing all actor state transitions | M1 | Survey 1, 3 |
| 11 | Delivery Batch Management | Batching unassigned deliveries into operational dispatch clusters | M1 | Survey 1, 2 |
| 12 | Design System & Scaffolding | Stitch design tokens, Inter typography, responsive desktop/mobile shells | M1 | Survey 2, 3 |
| 13 | Manifest Management UI & Waybill Drawer | High-density 10-column parcel table, filter chips, waybill detail drawer | M1 | Survey 2 |
| 14 | Bhubaneswar Canonical Seed Dataset | Rasulgarh depot, 5 delivery clusters (50+ stops), demo users, vehicles | M1 | Survey 1, 3 |
| 15 | Address Geocoding Service | Lat/long resolution with in-memory caching and unresolved flagging | M2 | Survey 1, 3 |
| 16 | Distance & Duration Matrix Engine | N×N road network travel distance and duration calculation | M2 | Survey 1, 3 |
| 17 | Dual-Mode Mapping & Traffic Simulation | Google Maps adapter + 5 deterministic traffic scenarios fallback | M2 | Survey 1, 3 |
| 18 | Baseline Route Calculation | Evaluate unoptimized stop sequence metrics for benchmark comparison | M2 | Survey 1, 3 |
| 19 | Multi-Vehicle Bin-Packing Allocation | Allocate batch stops across fleet honoring payload; explicit unassigned list | M2 | Survey 1, 3 |
| 20 | Nearest-Neighbor Route Construction | Greedy heuristic starting from depot, prioritizing urgent and time windows | M2 | Survey 1, 3 |
| 21 | Bounded 2-Opt Local Search | Pairwise edge swaps optimizing route score while preserving hard constraints | M2 | Survey 1, 3 |
| 22 | Multi-Objective Scoring Engine | Configurable weights for distance, time, fuel cost, priority & window penalties | M2 | Survey 1, 3 |
| 23 | Fuel & EV Energy Model | Combustion fuel cost (km/l) and EV kWh/km consumption with CO2 calculation | M2 | Survey 1, 3 |
| 24 | Route Versioning & Dispatch Snapshotting | Immutable route version snapshot upon dispatch; rerouting increments version | M2 | Survey 1, 3 |
| 25 | Route Planner Workspace UI | 35%/65% split, strategy sliders, dual-polyline map, 5 impact metric cards | M2 | Survey 2 |
| 26 | Socket.IO Tracking Gateway | Authenticated WebSocket handshake, route-specific room multiplexing | M2 | Survey 1, 3 |
| 27 | Consented Driver GPS Telemetry | Driver location streaming restricted to active dispatched routes | M3 | Survey 1, 3 |
| 28 | Live Fleet Tracking Cockpit UI | 3-tier view: fleet directory, live vector map, CAN-Bus vehicle inspector | M3 | Survey 2 |
| 29 | Driver Mobile Home & Shift Dashboard | Mobile landing, On Duty toggle, battery SoC, upcoming stop manifest bento | M3 | Survey 2 |
| 30 | Turn-by-Turn Navigation HUD | Maneuver instructions, lane guidance pills, consignee call/SMS triggers | M3 | Survey 2 |
| 31 | 4-Step Proof of Delivery (POD) Wizard | Recipient SMS OTP, geostamped photo, signature canvas, condition checklist | M3 | Survey 2 |
| 32 | Delivery Exception Handling | Driver stop failure reporting with mandatory reason code and manager alert | M3 | Survey 1, 2 |
| 33 | Operational Master Dashboard UI | 6 KPI cards, hourly dispatch chart, fleet utilization gauge, activity feed | M3 | Survey 2 |
| 34 | Planned vs Actual Comparison Engine | Real-time variance tracking for distance, duration, and fuel spend | M3 | Survey 1, 3 |
| 35 | Operational Analytics & Report Export | Recharts visualizations, date/vehicle filters, CSV/PDF download | M3 | Survey 1, 2, 3 |
| 36 | 4-Tier E2E Testing Suite | Opaque-box requirement-driven test suite (Tiers 1-4) with automated runner | E2E | Survey 3 |
| 37 | Adversarial Coverage Hardening | White-box stress testing, edge-case coverage (Tier 5), defect remediation | M4 | Survey 3 |
| 38 | Security & Release Readiness Audit | OWASP Top 10 hardening, BOLA audit, secret scanning, deployment verification | M4 | Survey 3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven test harness, test runner, Tiers 1-4 test suites, `TEST_READY.md` | Initial Scaffolding | DONE |
| M1 | Core Scaffolding, Identity & Fleet Operations | Monorepo scaffolding, User/Auth/RBAC, Vehicle & Driver CRUD, Deliveries & Batches, CSV Import, Manifest UI, Seed Data | none | DONE |
| M2 | Mapping, Matrix Services & Route Optimization Engine | Geocoding & distance matrix, dual-mode traffic simulator, baseline vs 2-opt optimizer, multi-vehicle bin-packing, Route Planner UI | M1 | IN_PROGRESS |
| M3 | Real-Time Telemetry, Driver Execution & Operational Analytics | Socket.IO tracking, Driver mobile HUD & POD wizard, Live Fleet Cockpit, Analytics Dashboard, CSV/PDF reports | M2 | PLANNED |
| M4 | E2E Integration, Coverage Hardening & Victory Verification | 100% E2E test pass (Tiers 1-4), Tier 5 adversarial hardening, security audit, deployment readiness | M3, E2E | PLANNED |

---

## Interface Contracts

### 1. Client ↔ Server REST API
- **Base URL:** `/api/v1`
- **Standard Envelope:**
  - Success: `{ "success": true, "data": <payload>, "message": "<optional>" }`
  - Error: `{ "success": false, "error": { "code": "<STRING_CODE>", "message": "<human_message>", "details": [<array_or_object>] } }`
- **Auth Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Core Endpoints:**
  - `POST /api/v1/auth/login` -> `{ token, user }`
  - `POST /api/v1/auth/users` -> Provision user (Admin only)
  - `GET, POST /api/v1/vehicles`, `GET, PUT /api/v1/vehicles/:id`
  - `GET, POST /api/v1/drivers`, `PUT /api/v1/drivers/:id/assign`
  - `GET, POST /api/v1/deliveries`, `POST /api/v1/deliveries/import-csv`
  - `POST /api/v1/batches`, `GET /api/v1/batches/:id`
  - `POST /api/v1/routes/optimize` -> `{ baseline, optimized, unassignedDeliveries, deltas }`
  - `POST /api/v1/routes/:id/dispatch` -> `{ route, version, status: 'DISPATCHED' }`
  - `POST /api/v1/deliveries/:id/complete` -> `{ otp, signature, photo, checklist }`
  - `POST /api/v1/deliveries/:id/fail` -> `{ reasonCode, notes }`
  - `GET /api/v1/analytics/kpis`, `GET /api/v1/analytics/export`

### 2. Socket.IO Real-Time Tracking Contract
- **Namespace/Path:** `/socket/tracking`
- **Handshake Auth:** `{ auth: { token: "<JWT_TOKEN>" } }`
- **Client -> Server Events:**
  - `route:join`: `{ routeId: "<id>" }` (Driver or Fleet Manager joins room)
  - `driver:location`: `{ routeId, lat, lng, speed, heading, batterySoC, timestamp }`
- **Server -> Client Broadcasts:**
  - `driver:locationUpdated`: Emitted to `route:<routeId>` room
  - `delivery:statusChanged`: `{ deliveryId, routeId, status, actorId, timestamp }`
  - `route:dispatched`: `{ routeId, driverId, vehicleId }`

### 3. Service Layer Contracts
- `IMappingService.getDistanceMatrix(origins: Coordinate[], destinations: Coordinate[]): Promise<MatrixResult>`
- `IOptimizationService.optimizeBatch(batch: DeliveryBatch, vehicles: Vehicle[], config: OptimizationConfig): Promise<OptimizationResult>`
- `ITelemetryService.recordLocation(locationEvent: LocationInput): Promise<LocationEvent>`

---

## Code Layout
```
c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\
├── package.json                          # Monorepo root scripts & dev dependencies
├── server/                               # Backend Node.js / Express API
│   ├── package.json
│   ├── src/
│   │   ├── config/                       # Database connection, env validation, constants
│   │   ├── models/                       # User, Vehicle, Driver, Delivery, DeliveryBatch, Route, AuditEvent, LocationEvent
│   │   ├── middleware/                   # auth.js (JWT/RBAC), errorHandler.js, validate.js
│   │   ├── routes/                       # Express router modules
│   │   ├── controllers/                  # Controller handlers
│   │   ├── services/
│   │   │   ├── mapping/                  # googleMapsService.js & simulatedTrafficService.js
│   │   │   ├── optimization/             # matrixBuilder.js, nearestNeighbor.js, twoOpt.js, costScorer.js, binPacker.js
│   │   │   ├── telemetry/                # trackingService.js
│   │   │   ├── analytics/                # analyticsService.js
│   │   │   └── reports/                  # reportGenerator.js (CSV/PDF)
│   │   ├── sockets/                      # trackingSocket.js
│   │   └── seed/                         # seedBhubaneswar.js (Rasulgarh hub, 5 delivery clusters)
│   └── tests/
│       ├── unit/                         # Unit tests for models & algorithms
│       └── integration/                  # Route integration tests
├── client/                               # Frontend React / TypeScript / Vite
│   ├── package.json
│   ├── src/
│   │   ├── api/                          # Axios clients for REST endpoints
│   │   ├── components/
│   │   │   ├── common/                   # Buttons, Modals, Inputs, StatusBadges, Drawers
│   │   │   ├── layout/                   # AdminSidebar, AdminHeader, DriverHeader, DriverBottomNav
│   │   │   ├── maps/                     # GISMapCanvas, VehicleMarker, StopMarker, RoutePolyline
│   │   │   ├── optimization/             # ParameterSliders, RouteComparisonBanner, ImpactMetricsCard
│   │   │   ├── deliveries/               # ManifestTable, BatchComposerPanel, CsvImportModal
│   │   │   └── driver/                   # TurnByTurnHud, ActiveStopCard, SignaturePad, CameraCapture, PodChecklist
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── admin/                    # DashboardPage, DeliveriesPage, RoutePlannerPage, LiveTrackingPage, AnalyticsPage
│   │   │   └── driver/                   # DriverHomePage, DriverNavigationPage, DriverPodPage
│   │   ├── context/                      # AuthContext, SocketContext
│   │   └── types/                        # TypeScript domain interfaces
│   └── tests/                            # Client unit and component tests
└── tests/
    └── e2e/                              # 4-tier E2E opaque-box test suites
        ├── runner.js                     # CLI test runner with exit code semantics
        ├── tier1-features/               # >=5 test cases per core feature
        ├── tier2-boundaries/             # Boundary and corner test cases
        ├── tier3-pairwise/               # Cross-feature integration test cases
        └── tier4-workloads/              # Real-world operational scenarios & stress benchmarks
```
