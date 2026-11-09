---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
<!-- refreshed: 2026-11-09 -->
</External Integrations>
<Architecture>
**Analysis Date:** 2026-11-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Client Presentation Layer                             │
│                  React 18 SPA (TypeScript + Vite + Tailwind)                │
├──────────────────────────────────────┬──────────────────────────────────────┤
│      Admin Operations Portal         │          Driver Cockpit HUD          │
│   `client/src/pages/admin/*`         │      `client/src/pages/driver/*`     │
│   - Route Optimizer & Comparison     │      - Active Turn-by-Turn Stop Hero │
│   - Batch Composer & CSV Ingest      │      - Proof of Delivery (POD) Modal │
│   - Live Fleet Tracking & Governance │      - Pre-Trip Vehicle Checklist    │
└──────────────────┬───────────────────┴──────────────────┬───────────────────┘
                   │ REST (Axios `/api/v1`)               │ WebSockets (Socket.IO)
                   ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 API Gateway & Real-Time Gateway (Express + Socket.IO)       │
│                  `server/src/app.js` & `server/src/index.js`                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Middleware: Auth JWT (`middleware/auth.js`), Validation, Helmet, RateLimiter│
├─────────────────────────────────────────────────────────────────────────────┤
│ Route Endpoints (`server/src/routes/index.js`):                             │
│ `/auth`, `/deliveries`, `/batches`, `/routes`, `/vehicles`, `/drivers`,    │
│ `/admin`, `/driver-hud`, `/telemetry`, `/health`                            │
└──────────────┬──────────────────────────┬─────────────────────────┬─────────┘
               │                          │                         │
               ▼                          ▼                         ▼
┌──────────────────────────────┐ ┌───────────────────┐ ┌──────────────────────┐
│     Controllers Layer        │ │ Real-Time Gateway │ │  Audit & Telemetry   │
│ `server/src/controllers/*`   │ │ `socketService.js`│ │ `auditService.js`    │
│ - `routeController.js`       │ │ - Room dispatch   │ │ `telemetryService.js`│
│ - `deliveryController.js`    │ │ - Live stop update│ └──────────┬───────────┘
│ - `driverHudController.js`   │ └────────┬──────────┘            │
└──────────────┬───────────────┘          │                       │
               │                          │                       │
               ▼                          │                       │
┌─────────────────────────────────────────┴─┐                     │
│      Domain & Algorithmic Engine Layer    │                     │
├───────────────────────────────────────────┤                     │
│ Optimization Engine:                      │                     │
│ `server/src/services/optimization/*`      │                     │
│ - `optimizerEngine.js` (Master orchestrator)                     │
│ - `nearestNeighbor.js` (Initial tour)     │                     │
│ - `twoOpt.js` / `orOpt.js` (Local search) │                     │
│ - `binPacker.js` (Capacity packing)       │                     │
│ - `costScorer.js` / `fuelModel.js`        │                     │
│ Mapping & Routing Engine:                 │                     │
│ `server/src/services/mapping/*`           │                     │
│ - `googleMapsService.js` (Distance Matrix)│                     │
│ - `simulatedTrafficService.js` (Fallback) │                     │
│ - `matrixCache.js` (In-memory TTL cache)  │                     │
└──────────────────────┬────────────────────┘                     │
                       │                                          │
                       ▼                                          │
┌─────────────────────────────────────────────────────────────────┴───────────┐
│                    Persistence & Data Access Layer                          │
│                      Mongoose ODM (`server/src/models/*`)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Collections: Deliveries, DeliveryBatches, Routes, Vehicles, Drivers,        │
│              AuditEvents, TelemetryPings, SystemNotifications, Users        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │           MongoDB Atlas           │
                     └───────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Server Application Entry | Bootstraps Express server, initializes Socket.IO gateway, establishes MongoDB connection | `server/src/index.js` |
| Express App Configuration | Configures security headers, CORS policies, JSON parsers, rate limiters, mounts route tree, handles 404/500 errors | `server/src/app.js` |
| Route Router & Dispatch | Orchestrates baseline evaluation, 2-Opt/Or-Opt optimization, driver route assignments, dispatch lifecycle, and export | `server/src/controllers/routeController.js` |
| Optimization Master Engine | Pure algorithmic orchestrator executing tour construction, local search heuristics, scoring, and baseline comparison | `server/src/services/optimization/optimizerEngine.js` |
| Heuristic Search Engines | Constructs greedy initial tours and executes iterative 2-Opt and Or-Opt segment swaps to eliminate route crossovers | `server/src/services/optimization/twoOpt.js`, `server/src/services/optimization/orOpt.js`, `server/src/services/optimization/nearestNeighbor.js` |
| Bin Packing Engine | Partitions consignment stops across available vehicles honoring payload weight and volume capacity constraints | `server/src/services/optimization/binPacker.js` |
| Cost & Emission Scorer | Computes vehicle-specific operational costs (INR), fuel consumption (petrol/diesel/kWh), and carbon footprints (kg CO2) | `server/src/services/optimization/costScorer.js`, `server/src/services/optimization/fuelModel.js` |
| Distance Matrix Provider | Fetches real-world driving distance/duration matrices with intelligent fallback to simulated traffic and caching | `server/src/services/mapping/googleMapsService.js`, `server/src/services/mapping/simulatedTrafficService.js`, `server/src/services/mapping/matrixCache.js` |
| Real-Time Socket Service | Manages room-based Socket.IO fanout (`driver:<id>`, `route:<id>`, `/socket/tracking`) for dispatches, status shifts, and telemetry | `server/src/services/socketService.js` |
| Delivery Controller & Ingest | Handles consignment CRUD, status progression, geocoding validation, and CSV batch manifest uploads via PapaParse | `server/src/controllers/deliveryController.js`, `server/src/services/csvImportService.js` |
| Driver HUD Controller | Powers mobile driver workflow: assigned route retrieval, stop status updates (ARRIVED, COMPLETED, FAILED), and POD capture | `server/src/controllers/driverHudController.js` |
| Dispatch Eligibility Service | Enforces pre-dispatch gating rules: driver duty availability, vehicle capacity checks, and stop sequence validation | `server/src/services/dispatchEligibilityService.js` |
| Audit Trail Service | Records immutable compliance audit logs for every operational override, route optimization, dispatch, and status transition | `server/src/services/auditService.js` |
| Authentication & RBAC | Manages JWT token generation, refresh tokens, role gating (ADMIN, FLEET_MANAGER, DRIVER), and token blacklisting | `server/src/middleware/auth.js`, `server/src/controllers/authController.js` |
| Client Application Root | Configures React Router, ThemeProvider, AuthProvider, and role-guarded route trees | `client/src/App.tsx` |
| Client API Gateway | Centralized Axios client with request Bearer interceptors, automatic token expiration handling, and semantic error formatting | `client/src/api/client.ts` |
| Driver Socket Context | Manages client-side Socket.IO connection, room subscriptions, real-time push alerts, and Web Audio API chime synthesis | `client/src/context/DriverSocketContext.tsx` |

## Pattern Overview

**Overall:** N-Tier Layered Architecture with Pure Algorithmic Domain Separation and Real-Time Event-Driven Dual Client Portals.

**Key Characteristics:**
- **Separation of Algorithmic Core from Transport:** Optimization algorithms (`twoOpt.js`, `nearestNeighbor.js`, `binPacker.js`) are written as pure functions with zero database or HTTP dependencies, taking matrices and vehicle specs as inputs and returning deterministic outputs.
- **Dual-Actor Client Interface:** A unified React SPA serves two distinct operational personas via layout and role routing: desktop-dense Admin Command Center (`client/src/components/layout/AdminLayout.tsx`) and mobile-optimized Driver Cockpit (`client/src/components/layout/DriverLayout.tsx`).
- **Resilient Multi-Provider Mapping with Graceful Degradation:** Distance calculations prioritize external Google Maps APIs, with automated fallback to mathematical Haversine/road-factor models under simulated rush-hour scenarios when offline or rate-limited.
- **Event-Driven Push Sync:** Socket.IO bridges backend operational dispatches directly into driver mobile devices and admin live tracking dashboards without requiring polling loops.
- **Immutable Audit Logging:** Every state-altering operational event (status updates, manual overrides, CSV imports, dispatches) is recorded in an append-only `AuditEvent` store.

## Layers

**Client Presentation Layer:**
- Purpose: Delivers administrative fleet control tools and mobile driver navigation workflows.
- Location: `client/src`
- Contains: React components, pages, custom hooks, React contexts, and API integration services.
- Depends on: Backend REST API (`/api/v1`) and Socket.IO gateway (`/socket.io`).
- Used by: Operations managers, dispatchers, system administrators, and delivery drivers.

**API Gateway & Security Layer:**
- Purpose: Terminates HTTP connections, enforces rate limits, validates CORS, parses payloads, and authenticates JWT tokens.
- Location: `server/src/app.js`, `server/src/index.js`, `server/src/middleware/auth.js`, `server/src/middleware/rateLimiter.js`
- Contains: Express configuration, security middleware, and centralized error handling.
- Depends on: `jsonwebtoken`, `helmet`, `express-rate-limit`, `cors`.
- Used by: Client application and external API consumers.

**Controller & Application Orchestration Layer:**
- Purpose: Validates request parameters, coordinates domain services, interacts with database models, and shapes API responses.
- Location: `server/src/controllers`
- Contains: HTTP handlers for deliveries, routes, drivers, vehicles, batches, telemetry, and administrative control.
- Depends on: Services, Mongoose models, and utilities.
- Used by: Route routers mounted in `server/src/routes/index.js`.

**Domain & Optimization Service Layer:**
- Purpose: Contains core logistics business logic, heuristic VRP solvers, mapping matrix computation, and telemetry processing.
- Location: `server/src/services`
- Contains: Optimization heuristics (`services/optimization/*`), mapping adapters (`services/mapping/*`), audit recording (`services/auditService.js`), and socket emitters (`services/socketService.js`).
- Depends on: Utility functions and mathematical helpers.
- Used by: Controllers (`routeController.js`, `deliveryController.js`, `driverHudController.js`).

**Persistence & Data Model Layer:**
- Purpose: Defines schemas, data validation, indices, and database access for operational entities.
- Location: `server/src/models`, `server/src/config/db.js`
- Contains: Mongoose schemas (`Route.js`, `Delivery.js`, `DeliveryBatch.js`, `Vehicle.js`, `Driver.js`, `AuditEvent.js`, `TelemetryPing.js`).
- Depends on: MongoDB database engine.
- Used by: Application services and controllers.

## Data Flow

### Primary Request Path (Route Optimization & Dispatch Flow)

1. **Optimization Request Initiated:** Operator configures batch and parameters in `RoutePlannerPage.tsx` and triggers `POST /api/v1/routes/optimize` (`client/src/pages/admin/RoutePlannerPage.tsx`).
2. **Controller Request Parsing:** `routeController.optimizeRoute` receives stop IDs, vehicle ID, and algorithm choice (`server/src/controllers/routeController.js:154`).
3. **Distance Matrix Computation:** `buildMatrix` resolves depot and delivery coordinates, querying `googleMapsService.getDistanceMatrix` or falling back to `simulatedTrafficService.roadDistance` with TTL cache (`server/src/services/optimization/matrixBuilder.js`).
4. **Algorithmic Tour Search:** `optimizerEngine.runRouteOptimization` builds the baseline tour via `originalOrder.js`, executes `nearestNeighbor.js`, refines using `optimize2Opt` and `optimizeOrOpt`, and scores financial and fuel deltas via `costScorer.js` (`server/src/services/optimization/optimizerEngine.js:32`).
5. **Preview & Comparison:** Optimization results, candidate polyline, and savings metrics are returned to client for visual review in `RouteComparisonDrawer.tsx` (`client/src/components/optimization/RouteComparisonDrawer.tsx`).
6. **Dispatch Confirmation:** Operator triggers `POST /api/v1/routes/:id/dispatch` (`server/src/controllers/routeController.js`).
7. **Eligibility Validation:** `dispatchEligibilityService.validateDispatchEligibility` checks vehicle payload limits, driver duty status, and sequence continuity (`server/src/services/dispatchEligibilityService.js`).
8. **Persistence & Status Transition:** Route status updates to `DISPATCHED`, vehicle status changes to `IN_TRANSIT`, driver updates to `IN_TRANSIT`, deliveries change to `OUT_FOR_DELIVERY` (`server/src/models/Route.js`, `server/src/models/Delivery.js`).
9. **Audit Trail Generation:** `auditService.recordAuditEvent` writes an immutable dispatch record (`server/src/services/auditService.js`).
10. **Real-time Push Broadcast:** `socketService.emitRouteDispatched` emits `route:dispatched` to `driver:<driverId>` room and tracking namespace (`server/src/services/socketService.js:18`).
11. **Mobile Driver Ingestion:** Driver HUD client receives WebSocket event, plays synthesized Web Audio chime, and updates `CurrentStopHeroCard.tsx` (`client/src/context/DriverSocketContext.tsx:31`).

### Driver Stop Completion & POD Flow

1. **Stop Status Update:** Driver arrives and submits proof of delivery via `PATCH /api/v1/driver-hud/stops/:stopId/status` (`client/src/components/driver/PODModal.tsx`).
2. **HUD Controller Processing:** `driverHudController.updateStopStatus` validates stop transition, stores signature/photo data, and updates delivery document (`server/src/controllers/driverHudController.js`).
3. **Audit & Event Emission:** Records POD audit event and calls `socketService.emitStopStatusUpdated` to notify operator live dashboard (`server/src/services/socketService.js`).
4. **Route Progress Evaluation:** Checks if all stops are terminal (`COMPLETED` or `FAILED`). If all are terminal, route transitions to `COMPLETED`, vehicle transitions to `AVAILABLE`, and driver returns to `AVAILABLE`.

**State Management:**
- **Client State:** React Context (`AuthContext` for token/user, `DriverSocketContext` for live socket events and push alerts, `ThemeContext` for dark/light theme). Local component states for form and table filters. Persistent session tokens stored in browser `localStorage`.
- **Server State:** Stateless HTTP application server; session state carried via signed JWT Bearer tokens; active WebSocket client rooms maintained in memory by Socket.IO; shared data persisted in MongoDB.

## Key Abstractions

**Optimization Engine Interface:**
- Purpose: Standardized parameter contracts for tour construction and heuristic search algorithms.
- Examples: `server/src/services/optimization/optimizerEngine.js`, `server/src/services/optimization/twoOpt.js`, `server/src/services/optimization/nearestNeighbor.js`
- Pattern: Strategy Pattern & Pure Pipeline.

**Distance Matrix Provider Adapter:**
- Purpose: Uniform distance and duration computation interface decoupling mapping vendors from routing logic.
- Examples: `server/src/services/mapping/index.js`, `server/src/services/mapping/googleMapsService.js`, `server/src/services/mapping/simulatedTrafficService.js`
- Pattern: Adapter Pattern with In-Memory Proxy Caching (`matrixCache.js`).

**Dispatch Eligibility Validator:**
- Purpose: Encapsulates pre-flight business rules verifying payload weight, capacity, shift status, and driver availability before route lock-in.
- Examples: `server/src/services/dispatchEligibilityService.js`
- Pattern: Specification / Validator Pattern.

**Unified Centralized API Client:**
- Purpose: Typed HTTP communication gateway featuring automatic authentication header injection, token refresh handling, and user-friendly error translation.
- Examples: `client/src/api/client.ts`, `client/src/utils/errorUtils.ts`
- Pattern: Service Gateway & HTTP Interceptor Pattern.

## Entry Points

**Backend HTTP & WebSocket Server:**
- Location: `server/src/index.js`
- Triggers: Node execution (`node src/index.js` or `npm run dev`)
- Responsibilities: Loads environment variables, connects to MongoDB via `connectDB()`, instantiates Express HTTP server, registers Socket.IO gateway, configures event rooms, and starts listening on port 5004.

**Express Application Router:**
- Location: `server/src/app.js`
- Triggers: Imported by `server/src/index.js` or test runners (`supertest`)
- Responsibilities: Instantiates Express app, configures Helmet and CORS, configures JSON body parsers, registers rate limiting on auth endpoints, mounts `/api/v1` routes, and attaches global error handlers.

**Client Single Page Application Root:**
- Location: `client/src/main.tsx` & `client/src/App.tsx`
- Triggers: Vite browser entry from `client/index.html`
- Responsibilities: Renders React DOM, wraps application in `ThemeProvider` and `AuthProvider`, establishes `BrowserRouter` hierarchy, enforces role-based route guards (`SuperAdminGuard`), and routes requests between `/admin/*`, `/driver/*`, and `/login`.

**Canonical Database Seeder CLI:**
- Location: `server/src/seed/seedBhubaneswar.js`
- Triggers: Invoked via `npm run seed` (`node src/seed/seedBhubaneswar.js`)
- Responsibilities: Clears collections, seeds Bhubaneswar canonical depots, 55 test consignments, default vehicle fleets (Bikes, Vans, Trucks), demo drivers, operational settings, and demo credentials.

## Architectural Constraints

- **Threading:** Backend operates on Node.js single-threaded event loop. Algorithmic optimization loops (`2-Opt`, `Or-Opt`) are executed synchronously within the request context; long tours with large stop counts (>100 stops) can block the event loop if iteration limits (`maxIterations: 1000`) are exceeded.
- **Global State:**
  - `server/src/services/socketService.js`: Holds singleton `ioInstance` module reference.
  - `server/src/middleware/auth.js`: Holds in-memory `tokenBlacklist` Set for revoked JWTs.
  - `server/src/services/mapping/matrixCache.js`: Maintains in-memory key-value cache with TTL expiration.
- **Circular Imports:** Avoided through unidirectional layering (`routes` -> `controllers` -> `services` -> `models` -> `config`).
- **Monorepo Workspace Boundaries:** `server` and `client` maintain distinct `package.json` configurations and dependency graphs; root `package.json` provides monorepo orchestration scripts (`concurrently`).

## Anti-Patterns

### In-Memory JWT Blacklist in Multi-Process Deployments

**What happens:** Logged out tokens are added to a local in-memory JavaScript `Set` inside `server/src/middleware/auth.js`.
**Why it's wrong:** If the server restarts or runs in a multi-process/clustered deployment (e.g. PM2 or Kubernetes replicas), blacklisted tokens are lost or not shared across workers, allowing revoked tokens to continue accessing other instances.
**Do this instead:** Store revoked token IDs or revocation timestamps in Redis or a MongoDB `TokenBlacklist` collection with TTL indexing.

### Controller Monolith in Route Controller

**What happens:** `server/src/controllers/routeController.js` exceeds 1,500 lines, implementing HTTP handling, complex query aggregations, ETA math, baseline calculations, and dispatch updates in a single file.
**Why it's wrong:** High coupling makes unit testing difficult, leads to duplicated business logic, and increases the likelihood of regression during maintenance.
**Do this instead:** Decompose `routeController.js` into focused domain services (e.g., `routeEvaluationService.js`, `routeDispatchService.js`, `routeQueryService.js`), keeping the controller limited to parameter extraction and HTTP status handling.

## Error Handling

**Strategy:** Centralized operational error taxonomy using custom `AppError` class, mapped directly through Express global error middleware.

**Patterns:**
- **Custom Error Taxonomy:** `AppError` (`server/src/middleware/errorHandler.js`) encapsulates HTTP status code, operational flag, machine-readable error codes (e.g., `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `DISPATCH_INELIGIBLE`), and detailed field validations.
- **Mongoose Error Translation:** Centralized error handler catches Mongoose `ValidationError` and `CastError` (ObjectId invalid format), normalizing them into standard JSON error responses with unique UUID `requestId`.
- **Client Semantic Translation:** Client Axios interceptor (`client/src/api/client.ts`) runs error payloads through `getFriendlyErrorMessage` (`client/src/utils/errorUtils.ts`) to produce user-actionable error banners instead of raw technical traces.

## Cross-Cutting Concerns

**Logging:** Backend uses `morgan('dev')` for HTTP request logging in non-test modes, with prefixed console logging for socket events and seed executions.
**Validation:** Dual-layer validation; client-side schema checks before submission, backed by Mongoose schema constraints, custom route validators (`server/src/middleware/validate.js`), and pre-dispatch business validation (`server/src/services/dispatchEligibilityService.js`).
**Authentication & Authorization:** Stateless Bearer JWT tokens with sub, email, and role claims. Role-Based Access Control (`ROLES.ADMIN`, `ROLES.FLEET_MANAGER`, `ROLES.DRIVER`) enforced by `authorize()` middleware in `server/src/middleware/auth.js` and `SuperAdminGuard` in `client/src/App.tsx`.

---

*Architecture analysis: 2026-11-09*
