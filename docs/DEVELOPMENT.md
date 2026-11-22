<!-- generated-by: gsd-doc-writer -->
# SmartRoute Development Guide

Welcome to the SmartRoute engineering guide. This document provides setup instructions, architectural conventions, coding standards, and testing workflows for contributors working on the SmartRoute last-mile delivery optimization platform.

---

## 1. Local Setup

### Prerequisites

Ensure your local development environment meets the following baseline requirements:

| Dependency | Minimum Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS recommended) | `node -v` | Node.js 22.x used in CI pipelines |
| **npm** | `>= 10.0.0` | `npm -v` | Supports native npm workspaces |
| **MongoDB** | `>= 6.0.0` | `mongosh --version` | Local instance or containerized replica set/standalone |
| **Docker** *(Optional)* | `>= 24.0.0` | `docker --version` | Needed for containerized dev stack and compose testing |

---

### Step-by-Step Environment Initialization

#### 1. Clone the Repository
```bash
git clone https://github.com/your-org/smartroute.git
cd smartroute
```

#### 2. Install Monorepo Dependencies
Run `npm install` from the repository root. This resolves and symlinks dependencies for both the `server` and `client` workspaces:
```bash
npm install
```

#### 3. Configure Environment Variables
Copy the root `.env.example` file to create your local `.env`:
```bash
cp .env.example .env
```

Review and adjust variables for your local setup. Key defaults include:
- `PORT=5004`
- `MONGODB_URI=mongodb://127.0.0.1:27017/smartroute`
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate strong random secrets for local testing)
- `MAP_PROVIDER=geoapify` (or `carto` / `osrm`)
- `VITE_API_URL=http://localhost:5004/api/v1`

#### 4. Bootstrap Administrator Account
Initialize the baseline administrative credentials required to access the admin portal:
```bash
npm run seed:admin
```
*(Default credentials output to console or configured via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`)*

#### 5. Seed Bhubaneswar Demo Fleet & Deliveries *(Optional)*
Populate the database with representative geographic orders, vehicles, and drivers across Bhubaneswar:
```bash
npm run seed
```

#### 6. Start Development Servers
Launch both the backend API and frontend Vite development server concurrently with synchronized log prefixes:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5004`
- **Frontend SPA**: `http://localhost:5173`

---

## 2. Monorepo Architecture & Build Commands

SmartRoute is structured as an npm workspaces monorepo:
```text
smartroute/
├── package.json          # Monorepo root scripts & dev dependencies (concurrently)
├── .env.example          # Unified environment template
├── server/               # Express.js REST API & Socket.IO server
│   ├── package.json
│   └── src/
├── client/               # Vite React 18 + TypeScript PWA frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── src/
├── scripts/              # Platform smoke and verification scripts
└── sample_data/          # High-density CSV testing fixtures
    └── csv/
```

### Workspace Commands Syntax
Commands can be targeted directly to individual packages using npm's workspace flag:
```bash
# Execute npm scripts in specific workspace
npm run <script> --workspace=server
npm run <script> --workspace=client

# Install a dependency into a specific workspace
npm install <package> --workspace=server
npm install -D <package> --workspace=client
```

---

### Command Reference

The following table summarizes all npm scripts configured in the project:

| Category | Command | Target / Scope | Description |
| :--- | :--- | :--- | :--- |
| **Development** | `npm run dev` | Monorepo Root | Starts backend server and frontend client concurrently using `concurrently` |
| **Development** | `npm run dev:server` | `server` | Starts backend using `nodemon` on port `5004` with hot reload |
| **Development** | `npm run dev:client` | `client` | Starts Vite HMR dev server on port `5173` |
| **Build & Check** | `npm run build` | `client` | Compiles TypeScript (`tsc`) and builds optimized client bundle with Vite |
| **Build & Check** | `npm run test --workspace=client` | `client` | Runs TypeScript type checking without emitting files (`tsc --noEmit`) |
| **Build & Check** | `npm run preview --workspace=client` | `client` | Serves client production build locally for verification |
| **Testing** | `npm run test` | `server` | Runs backend Jest unit and integration tests with open-handle detection |
| **Testing** | `npm run test:watch --workspace=server` | `server` | Runs Jest in interactive watch mode for TDD workflows |
| **Testing** | `npm run test:coverage` | `server` | Generates backend code coverage reports via Jest |
| **Testing** | `npm run test:unit --workspace=client` | `client` | Runs frontend unit and component tests via Vitest |
| **Testing** | `npm run test:e2e --workspace=client` | `client` | Runs Playwright browser regression test suite |
| **Testing** | `npm run test:e2e` | Monorepo Root | Executes root end-to-end integration runner (`node tests/e2e/runner.js`) |
| **Testing** | `npm run smoke` | Monorepo Root | Executes live HTTP/API and SPA smoke test (`scripts/smoke-test.js`) |
| **Seeding** | `npm run seed:admin` | `server` | Bootstraps or updates the default administrative user account |
| **Seeding** | `npm run seed` | `server` | Seeds Bhubaneswar demo dataset (zones, vehicles, drivers, deliveries) |
| **Seeding** | `npm run seed:test-users --workspace=server`| `server` | Seeds predictable test users for automated testing |
| **Maintenance** | `npm run clean:port --workspace=server` | `server` | PowerShell helper to kill lingering processes bound to port 5004 |
| **Setup** | `npm run install:all` | Monorepo Root | Installs dependencies across root, server, and client packages |

---

## 3. Code Style & Tooling

### TypeScript Compilation & Type Safety
The frontend client enforces strict TypeScript compiler options (`client/tsconfig.json`):
- **Target**: `ES2020` with `ESNext` modules
- **Module Resolution**: `bundler`
- **Strict Mode**: Enabled (`"strict": true`, `"noFallthroughCasesInSwitch": true`)
- **Path Aliases**: `@/*` mapped to `./src/*`
- **Type Checking Command**:
  ```bash
  npm run test --workspace=client
  # Executes: tsc --noEmit
  ```

Run type checking before committing any changes to the client codebase.

### Tailwind CSS & Theme Architecture
Styling is managed via Tailwind CSS (`client/tailwind.config.js` and `client/src/index.css`) with CSS custom variables enabling light and dark modes:
- **Dark Mode Strategy**: Class-based (`darkMode: 'class'`).
- **Color System**:
  - `obsidian`: Rich dark slate palette (`obsidian-950` to `obsidian-600`) for navigation headers, cards, and HUD backgrounds.
  - `emerald`: Operational success, active routes, and EV fleet indicators (`emerald-500`, `emerald-600`).
  - `primary` & `secondary`: Theme-aware CSS variable bindings (`rgb(var(--color-primary-rgb) / <alpha-value>)`).
  - `surface`: Multi-tier surface backgrounds (`surface-canvas`, `surface-lowest`, `surface-card`).
- **PWA Viewport Optimization**: Use `h-[100dvh]` rather than `100vh` to avoid mobile browser navigation bar jumps.

---

## 4. Backend Engineering Practices

### Express Router & Controller Conventions
Backend routes are organized modularly under `server/src/routes/` and mapped in `server/src/app.js`:
- Prefix all operational endpoints with `/api/v1`.
- Protect routes with authentication and role authorization middleware (`server/src/middleware/auth.js`):
  ```javascript
  const express = require('express');
  const router = express.Router();
  const { authenticate, authorize } = require('../middleware/auth');
  const { ROLES } = require('../config/constants');
  const exampleController = require('../controllers/exampleController');

  router.use(authenticate);
  router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), exampleController.list);
  router.post('/', authorize(ROLES.ADMIN), exampleController.create);

  module.exports = router;
  ```
- Controllers must use standard response envelopes:
  ```javascript
  res.status(200).json({
    success: true,
    data: result,
    message: 'Operation completed successfully',
  });
  ```

### Mongoose Schemas, Indexes & Deletion Rules
- **Schema Standards**: Use explicit validation messages, trims, and timestamps (`timestamps: true`).
- **Index Definitions**:
  - Compound indexes for frequently queried filters and sorting:
    ```javascript
    routeSchema.index({ status: 1, date: -1 });
    deliverySchema.index({ batchId: 1, status: 1 });
    ```
  - Partial filter expressions for unique constraints on nullable fields:
    ```javascript
    vehicleSchema.index(
      { assignedDriverId: 1 },
      { unique: true, partialFilterExpression: { assignedDriverId: { $type: 'objectId' } } }
    );
    ```
- **Soft vs. Hard Deletion**:
  - **Operational Data (Deliveries, Routes, Vehicles, Drivers)**: Retain records wherever possible by setting status flags (`status: 'CANCELLED'` or `active: false` on `User`/`Driver`).
  - **Demo Data Tagging**: All seeded demo records include `isDemoData: { type: Boolean, default: false, index: true }` allowing isolated cleanup.
  - **Hard Cascade Deletion**: Reserved exclusively for development resets executed via `devPurgeService.js` (see Section 6).

### Audit Logging with `AuditEvent`
All critical business operations (route dispatch, status changes, delivery reassignment, driver incidents, and administrative overrides) must create an immutable `AuditEvent` entry (`server/src/models/AuditEvent.js`):
```javascript
const AuditEvent = require('../models/AuditEvent');
const { AUDIT_EVENT_TYPES, ROLES } = require('../config/constants');

await AuditEvent.create({
  deliveryId: delivery._id,
  routeId: route._id,
  actorId: req.user.id,
  actorRole: req.user.role,
  action: '[DELIVERY] STATUS_CHANGE_TO_COMPLETED',
  type: AUDIT_EVENT_TYPES.DELIVERY_COMPLETED,
  metadata: {
    podMethod: 'OTP',
    recipientName: delivery.customerName,
  },
  at: new Date(),
});
```

### Centralized Socket.IO Event Emission
Do not call raw `io.emit()` in controllers. Use the centralized `socketService.js` (`server/src/services/socketService.js`) to target specific rooms:
- **Target Rooms**:
  - `management`: Admins, dispatchers, and fleet managers.
  - `driver:${driverId}`: Specific driver mobile HUD.
  - `route:${routeId}`: Clients tracking a specific active route.
  - `delivery:${deliveryId}`: Customers or tracking views for a single package.
- **Emission Method Example**:
  ```javascript
  const socketService = require('../services/socketService');

  // Broadcast dispatch updates to both management and assigned driver
  socketService.emitRouteDispatched({
    routeId: route._id,
    driverId: route.driverId,
    route,
  });
  ```

### Error Handling & Custom `AppError`
Always instantiate operational errors using `AppError` from `server/src/middleware/errorHandler.js`:
```javascript
const { AppError } = require('../middleware/errorHandler');

if (!delivery) {
  throw new AppError('Delivery stop not found', 404, 'DELIVERY_NOT_FOUND');
}
```

The centralized error middleware catches unhandled rejections, Mongoose `ValidationError`, `CastError`, MongoDB unique duplicate key error (`11000`), and JWT expiration, returning a consistent JSON error envelope:
```json
{
  "success": false,
  "message": "Validation failed: Customer phone number is required",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed: Customer phone number is required",
    "details": [{ "field": "customerPhone", "message": "Customer phone number is required" }],
    "requestId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
  }
}
```

---

## 5. Frontend Engineering Practices

### Architecture & Component Structure
The client is structured by functional domains:
```text
client/src/
├── api/             # Axios client, token refresh mutex, domain APIs
├── components/
│   ├── admin/       # Management & danger zone controls
│   ├── common/      # Generic buttons, modals, badges, inputs
│   ├── driver/      # Driver HUD components & vehicle checklist
│   ├── layout/      # App layouts (AdminLayout, DriverLayout)
│   └── maps/        # Leaflet interactive map, custom SVG markers, camera controls
├── context/         # AuthContext, DriverSocketContext, ThemeContext
├── hooks/           # useRealtimeCatchup, useRoutePlanner, useOptimization
├── pages/           # Admin views, Driver cockpit views, public tracking
├── types/           # Domain TypeScript type declarations
└── utils/           # GIS helpers, Google Maps deep links, socket factory
```

### Core Custom Hooks & Contexts
- **`useAuth()`** (`client/src/context/AuthContext.tsx`): Manages authentication state, JWT storage, role validation, login, logout, and automatic session restoration.
- **`useDriverSocketContext()`** (`client/src/context/DriverSocketContext.tsx`): Establishes the authenticated Socket.IO connection, handles room subscriptions (`joinDriverRoom`, `joinRouteRoom`), and provides real-time state synchronization.
- **`useRealtimeCatchup(onCatchup, options)`** (`client/src/hooks/useRealtimeCatchup.ts`): Provides automatic debounced data re-fetching when:
  1. The browser tab regains visibility (`visibilitychange`).
  2. The window regains focus (`focus`).
  3. The device comes back online (`online`).
  4. The Socket.IO connection reconnects (`smartroute:reconnect`).
- **`useTheme()`** (`client/src/context/ThemeContext.tsx`): Toggles between `dark` and `light` modes, persisting preferences to `localStorage` and updating the `html` element class.

### Leaflet GIS Map Layers & Custom SVG Markers
Map views are implemented using React-Leaflet (`client/src/components/maps/`):
- **Tile Layers**: Configurable via `VITE_MAP_PROVIDER` (Geoapify or CartoDB Positron/Dark Matter).
- **Polyline Rendering**:
  - `routePath`: Optimized road network polyline (solid emerald/blue).
  - `baselineRoutePath`: Unoptimized baseline path (dashed gray for savings comparison).
  - `traversedPath` vs. `remainingPath`: Dual-segment live color rendering separating completed stops from upcoming deliveries.
- **Custom SVG Markers (`L.divIcon`)**:
  - Sanitized via `escapeHtml()` to protect against XSS (`client/src/components/maps/markerIcons.ts`).
  - `createDriverIcon`: Displays directional vehicle heading arrow matching live degrees, pulsed motion rings, real-time speed badge, and stale telemetry indicator.
  - `createStatusStopIcon`: Displays sequence index numbers, priority badges, and status colors (`PENDING`, `IN_TRANSIT`, `DELIVERED`, `FAILED`).
- **Camera Controls**: `CameraController.tsx` supports auto-follow driver mode, dynamic bounding box fitting (`FitBounds`), and manual pan overrides.

### Mobile PWA Driver HUD Design Principles
The driver interface (`client/src/pages/driver/` and `client/src/components/layout/DriverLayout.tsx`) is designed for in-cab mobile operations:
1. **Viewport Containment**: Uses `h-[100dvh]` with `overscroll-contain` to prevent scrolling bounce on iOS Safari and mobile Chrome.
2. **Ergonomic Touch Targets**: Minimum 44x44px button tap areas for touch interaction with one hand or driving gloves.
3. **High-Contrast Readability**: Optimized typography for daylight glare and dark night mode.
4. **Persistent Bottom Navigation**: Instant one-tap access to Cockpit, Deliveries, Route Map, Vehicle Check, and Support.
5. **Resilient Offline HUD**: Local UI states maintain responsiveness during momentary network dead zones.

### API Client Patterns & Refresh Token Mutex
All HTTP requests route through the centralized Axios client (`client/src/api/client.ts`):
- Automatically attaches `Authorization: Bearer <token>` from `localStorage`.
- **Single-Flight Refresh Token Mutex**: When multiple concurrent requests encounter a `401 TOKEN_EXPIRED`, the client queues them behind a single `refreshPromise` calling `/api/v1/auth/refresh`. Once the new token arrives, all queued requests are automatically retried without user interruption.
- Exports grouped API modules: `AdminApi`, `RouteApi`, `DeliveryApi`, `DriverApi`, `VehicleApi`.

---

## 6. Developer Testing & Danger Zone Workflows

### Developer Danger Zone: Database Purge Workflow
During development and integration testing, you often need to reset the operational state to a clean slate without losing admin accounts.

- **Backend Endpoint**: `DELETE /api/v1/admin/dev-purge`
  - Protected by `authenticate` and `authorize(ROLES.ADMIN)`.
  - Requires request body `{ confirmPurge: true }`.
  - Invokes `devPurgeService.purgeAllOperationalData(actorId)`.
  - **Wipes**: Deliveries, Batches, Routes, Vehicle Assignments, Telemetry Pings, Alerts, Driver Shifts, Incidents, Checklists, Maintenance Records, and Driver user accounts.
  - **Preserves**: All Administrator accounts (`role: 'ADMIN'`) and active sessions.
  - Emits real-time `socketService.emitSystemPurged(result)` event to trigger immediate UI cache clearing across active management clients.
- **Frontend UI**: `client/src/components/admin/DeveloperDangerZoneCard.tsx`
  - Accessible in Admin settings.
  - Features a two-step confirmation modal with an enforced 3-second safety countdown before the "Execute Hard Purge" button activates.

### High-Density CSV Ingestion Testing
Sample datasets for stress-testing and route optimization verification are provided in `sample_data/csv/`:
- **`sample_data/csv/orders.csv`**: 50+ diverse delivery orders in Bhubaneswar across Patia, Chandrasekharpur, Saheed Nagar, and Jayadev Vihar, including weights, volumes, cold chain priorities, and delivery time windows.
- **`sample_data/csv/drivers.csv`**: Pre-configured test drivers with phone numbers, commercial license numbers, and availability states.
- **`sample_data/csv/vehicles.csv`**: Electric and combustion fleet profiles with payload capacities, battery capacities, and fuel efficiencies (Tata Ace, Treo Zor EV, Bolero).

Upload these files through the Admin Batch Upload and Fleet Management views to verify bulk parsing, geocoding, and clustering performance.

---

## 7. Git Workflow & Contribution Process

### Branch Conventions
All work should take place on dedicated branches cut from the default branch (`main` or `develop`):
- `feature/<short-description>`: New features or capabilities (e.g. `feature/ev-charge-scheduling`)
- `fix/<short-description>`: Bug fixes (e.g. `fix/polyline-bearing-calculation`)
- `refactor/<short-description>`: Code restructuring or cleanup
- `test/<short-description>`: Additional automated test suites or fixtures
- `chore/<short-description>`: Dependency bumps or build tooling adjustments

### Atomic Commits
Keep commits focused, atomic, and described using Conventional Commits syntax:
```text
feat(route): add reverse geocoding fallback for depot dispatch
fix(socket): prevent duplicate room joins on reconnect
test(client): add unit test coverage for useRealtimeCatchup hook
docs: update development guide with danger zone purge instructions
```

### Pull Request & CI Verification Checklist
Before submitting a pull request, run the local verification suite:
1. **Frontend Type Check**:
   ```bash
   npm run test --workspace=client
   ```
2. **Frontend Unit Tests**:
   ```bash
   npm run test:unit --workspace=client
   ```
3. **Frontend Production Build**:
   ```bash
   npm run build
   ```
4. **Backend Test Suite**:
   ```bash
   npm run test
   ```
5. **Automated Smoke Test**:
   ```bash
   npm run smoke
   ```

When opened, your pull request will run through the GitHub Actions CI pipeline (`.github/workflows/ci.yml`), validating dependencies (`npm audit`), frontend type checking, unit tests, backend regression tests, multi-stage Docker builds, and live smoke checks. Ensure all CI jobs pass before requesting code review.
