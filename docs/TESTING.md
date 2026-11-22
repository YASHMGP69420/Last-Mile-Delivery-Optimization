<!-- generated-by: gsd-doc-writer -->
# SmartRoute Testing Guide & Quality Assurance Architecture

SmartRoute employs a multi-tiered quality assurance strategy spanning backend integration and unit tests, frontend component and unit tests, full-stack browser-driven end-to-end (E2E) flows, CLI workload regressions, and production smoke probes.

This document details the test framework setup, test execution workflows, suite architecture, mocking strategies, and CI/CD automation pipelines.

---

## Test Strategy Overview

SmartRoute isolates concerns across multiple testing boundaries to ensure rapid feedback during development while enforcing strict system guarantees for safety-critical routing operations:

```
+-------------------------------------------------------------------------+
|                        Production Smoke Tests                           |
|       scripts/smoke-test.js (Health Probes, Readiness, CORS, SPA)       |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                  End-to-End (E2E) Regression Suites                     |
|  1. Playwright Browser E2E: Admin Dispatch, Driver HUD, POD Capture     |
|  2. 4-Tier CLI Harness: Feature, Boundary, Pairwise, Real-world Matrix  |
+-------------------------------------------------------------------------+
                 ^                                         ^
+----------------------------------+     +--------------------------------+
|       Frontend Test Suite        |     |      Backend Test Suite        |
|  Vitest 5.1 + React Testing Lib  |     |   Jest 29.7 + Supertest 6.3    |
|  jsdom, Component Mocks, UI Flows|     |   Isolated MongoDB, DB Teardown|
+----------------------------------+     +--------------------------------+
```

| Tier | Framework / Tool | Scope | Directory / Config |
| :--- | :--- | :--- | :--- |
| **Backend Unit & Integration** | Jest `29.7.0`, Supertest `6.3.4` | REST endpoints, TSP/2-opt algorithms, CSV parsers, JWT/RBAC, DB persistence | `server/tests/`, `server/package.json` |
| **Frontend Unit & Component** | Vitest `5.1.0`, RTL `16.3.3`, jsdom | UI component rendering, state hooks, modals, table selection, utilities | `client/src/**/__tests__/`, `client/vitest.config.ts` |
| **Browser E2E Testing** | Playwright `1.65.0` | Full browser automation across multi-role journeys (Admin, Fleet Manager, Driver) | `client/tests/e2e/`, `client/playwright.config.ts` |
| **Workload / System E2E** | Custom Node.js CLI Runner | 4-tier functional, edge-case, pairwise, and 55-stop Bhubaneswar workloads | `tests/e2e/`, `tests/e2e/runner.js` |
| **Production Smoke Probes** | Native Node.js HTTP Runner | Post-deploy live health, readiness, CORS headers, SPA delivery, auth probe | `scripts/smoke-test.js` |

---

## Test Framework & Setup

### 1. Backend Infrastructure (`server/`)
The backend uses **Jest** with **Supertest** running in Node.js >= 20.0.0 against MongoDB.

* **Global Setup & Teardown (`server/tests/setup.js`)**:
  - Automatically loads `.env.test` using `dotenv`.
  - Connects to an isolated test database (`process.env.MONGODB_URI` defaulting to `mongodb://127.0.0.1:27017/smartroute_test`).
  - Clears all collections in an `afterEach` hook to maintain test isolation.
  - Closes the Mongoose connection in `afterAll`.
* **Database Isolation**: Tests execute against real MongoDB instances rather than in-memory mocks to validate Mongoose schemas, GeoJSON indexes (`2dsphere`), and unique constraints.

### 2. Frontend Infrastructure (`client/`)
The client uses **Vitest** configured with **jsdom** and **React Testing Library**.

* **Configuration (`client/vitest.config.ts`)**:
  - Configures `jsdom` environment with global test APIs (`describe`, `it`, `expect`, `vi`).
  - Path alias resolution mapped to `@` (`src/`).
  - Preloads global test polyfills from `client/src/test/setup.ts`.
* **Global Browser Setup (`client/src/test/setup.ts`)**:
  - In-memory `localStorage` and `sessionStorage` mock implementations.
  - Comprehensive `leaflet` and `react-leaflet` mocks (stubs for map controllers, layers, markers, polylines, divIcons, and coordinate transforms to prevent WebGL/canvas failures in headless environments).
  - Polyfills for `ResizeObserver`, `IntersectionObserver`, `matchMedia`, and `window.scrollTo`.
  - Error filtering to suppress benign React development/act warnings during assertions.

### 3. End-to-End Infrastructure (`client/tests/e2e` & `tests/e2e`)
* **Playwright Configuration (`client/playwright.config.ts`)**:
  - Uses `chromium`, `firefox`, and `webkit` browser targets.
  - Configured with `workers: 1` and `fullyParallel: false` to eliminate multi-role authentication and database race conditions.
  - Automatically boots backend and frontend servers via dual `webServer` blocks:
    - Backend: `npm --prefix ../server run start:e2e` (pre-seeded with test users) on `http://127.0.0.1:5004` (probed at `/api/v1/healthz`).
    - Frontend: `npm run dev` on `http://127.0.0.1:5173`.
  - Global auth setup (`auth.setup.ts`) and teardown (`auth.teardown.ts`) storing reusable storage states for `admin`, `manager`, and `driver` in `client/tests/e2e/.auth/`.
* **CLI E2E Harness (`tests/e2e/runner.js`)**:
  - In-process test server (`tests/e2e/harness/testServer.js`) running isolated Express and MongoDB instances.
  - 4 tiered directories executing synthetic and real-world order matrices.

---

## Running Tests

### Root Monorepo Commands

| Command | Description |
| :--- | :--- |
| `npm test` | Runs the backend Jest test suite across the monorepo workspace (`server`). |
| `npm run test:server` | Alias for backend Jest test suite. |
| `npm run test:coverage` | Generates full backend code coverage report. |
| `npm run test:e2e` | Runs the 4-tier CLI integration runner (`node tests/e2e/runner.js`). |
| `npm run smoke` | Executes the production smoke check script (`node scripts/smoke-test.js`). |

### Backend Test Execution (`server/`)

Execute from the root using `--prefix server` or directly inside the `server/` directory:

```bash
# Run all backend tests
npm --prefix server test

# Run tests in watch mode during development
npm --prefix server run test:watch

# Run with full coverage instrumentation
npm --prefix server run test:coverage

# Run a specific test suite file
npx --prefix server jest tests/driver_vehicle_crud.test.js --runInBand --detectOpenHandles --forceExit

# Filter tests by matching suite or test name pattern
npx --prefix server jest -t "Developer & Admin Hard Reset" --runInBand --forceExit
```

> [!IMPORTANT]
> **Windows Concurrency & MongoDB Locking Guidelines**:
> The backend `npm test` script explicitly includes `--runInBand`, `--detectOpenHandles`, and `--forceExit`. Due to MongoDB connection pooling and Windows TCP socket handling, running tests in parallel (`--maxWorkers > 1`) can lead to database collection drop locks or socket hangs. Always include `--runInBand` when running backend suites locally or in CI.

### Frontend Test Execution (`client/`)

Execute from the root using `--prefix client` or directly inside the `client/` directory:

```bash
# Run TypeScript compilation check (noEmit)
npm --prefix client test

# Run Vitest unit & component test suite once
npm --prefix client run test:unit

# Run Vitest in interactive watch mode
npx --prefix client vitest

# Run a single component test file
npx --prefix client vitest run src/components/admin/__tests__/DeveloperDangerZone.test.tsx

# Generate frontend unit test coverage
npx --prefix client vitest run --coverage
```

### End-to-End Test Execution

#### 1. Playwright Browser Automation

```bash
# Run all Playwright tests (headless Chromium)
npm --prefix client run test:e2e -- --project=chromium

# Run across all configured browsers (Chromium, Firefox, WebKit)
npm --prefix client run test:e2e

# Run with interactive UI mode
npx --prefix client playwright test --ui

# Debug a specific E2E spec with Playwright Inspector
npx --prefix client playwright test tests/e2e/driver-pod.spec.ts --debug

# View generated HTML report
npx --prefix client playwright show-report client/playwright-report
```

#### 2. Four-Tier CLI E2E Runner

```bash
# Run all 4 tiers sequentially
node tests/e2e/runner.js

# Run a specific tier (1 = Features, 2 = Boundaries, 3 = Pairwise, 4 = Workloads)
node tests/e2e/runner.js --tier=1
node tests/e2e/runner.js --tier=4

# Run with verbose output and early exit on failure
node tests/e2e/runner.js --verbose --bail
```

### Production Smoke Probes

```bash
# Execute local smoke check against a running server
node scripts/smoke-test.js --api-url http://127.0.0.1:5004 --expect-spa

# Execute against a deployed staging/production domain with retries
node scripts/smoke-test.js --api-url https://api.smartroute.internal --origin https://app.smartroute.internal --retries 15 --delay-ms 1000

# Execute full smoke check including authentication validation
node scripts/smoke-test.js --api-url http://127.0.0.1:5004 --email admin@smartroute.internal --password "YourAdminPasswordHere"
```

---

## Test Suites Architecture

### Backend Suites (`server/tests/`)

The backend contains extensive regression suites covering core logistics logic:

* **`driver_vehicle_crud.test.js`**:
  - Full CRUD operations for drivers and vehicles.
  - Validates bi-directional synchronization between `User` accounts and linked `Driver` entities (name, email, phone).
  - Enforces deletion safety checks, preventing removal of vehicles or drivers assigned to active in-flight routes.
* **`dev_purge.test.js`**:
  - Hard reset and database purge validation (`DELETE /api/v1/admin/dev-purge`).
  - Confirms rejection of unauthenticated, Driver, and Fleet Manager roles (401/403).
  - Validates complete transactional removal of operational collections (Deliveries, Batches, Routes, Shifts, Incidents, Telemetry) while strictly preserving Admin accounts and system seed data.
* **`sample_csv_datasets.test.js`**:
  - Validates ingestion of production sample CSVs (`orders.csv`, `drivers.csv`, `vehicles.csv`).
  - Verifies dry-run parsing, header normalization, Indian phone format regex validation (`+91 99999 XXXXX`), vehicle capacity constraints, and zero-error ingestion.
* **`adversarial_csv_batch.test.js`**:
  - Adversarial stress tests against malformed CSV inputs (missing required fields, negative parcel weights, inverted coordinate bounds, malformed timestamps, injection payloads).
* **`optimization.test.js` & `routes.test.js`**:
  - Validates Dijkstra/Haversine matrix building, 5-decimal coordinate normalization, and scenario caching.
  - Tests First-Fit Decreasing (FFD) multi-vehicle bin packing under capacity constraints.
  - Tests 2-opt Traveling Salesperson Problem (TSP) heuristic optimizations against canonical Bhubaneswar delivery clusters, validating route cost scores and CO2/INR delta computations.
* **`auth.test.js` & `auth_otp_google.test.js`**:
  - Covers password hashing, JWT issue/verify lifecycle, refresh token rotation, cookie transmission, Google OAuth verification, and passwordless OTP verification flows.

### Frontend Component Suites (`client/src/**/__tests__/`)

The client components are tested using React Testing Library and Vitest:

* **`DeveloperDangerZone.test.tsx`**:
  - Validates rendering of the database purge card with warning indicators.
  - Verifies two-step modal confirmation workflow, typed confirmation phrase matching, loading indicators, and cache invalidation.
* **`TableSelection.test.tsx`**:
  - Tests bulk row selection mechanics in common tables (select all, invert selection, individual toggle, sticky action toolbar rendering).
* **`ManifestTableBulkDelete.test.tsx`**:
  - Validates multi-order selection in delivery manifests, bulk deletion confirmation, and optimistic UI updates.
* **`FleetsPageBulkDelete.test.tsx` & `UserTableBulkDelete.test.tsx`**:
  - Tests multi-vehicle and multi-user bulk decommission/purge flows, handling partial success and API error alerts.
* **`cameraController.test.tsx` & `driverMarker.test.tsx`**:
  - Tests Leaflet camera interaction (smooth zoom, auto-follow toggle, panning bounds calculation) without DOM canvas dependencies.

### Playwright E2E Critical Journeys (`client/tests/e2e/`)

Playwright tests model full user journeys using pre-seeded authentication states:

1. **Batch & Optimization Journey (`batch-dispatch.spec.ts`)**:
   - Fleet manager uploads or selects orders.
   - Triggers multi-vehicle route optimization engine.
   - Inspects generated route polyline and stop sequence.
   - Dispatches batch, transitioning routes to `DISPATCHED`.
2. **Driver HUD & Proof of Delivery (`driver-pod.spec.ts`)**:
   - Driver logs in and opens Driver Cockpit.
   - Reviews assigned route stops and opens active stop.
   - Submits Proof of Delivery (POD) via mock camera capture and OTP customer confirmation.
   - Confirms stop status transitions to `DELIVERED` and triggers route progress update.
3. **Mid-Shift Reoptimization Journey (`midshift-reoptimize.spec.ts`)**:
   - Simulates mid-route traffic delay or canceled stop.
   - Validates live route recalculation, socket notification emission, and driver HUD dynamic sync.
4. **Admin Analytics Dashboard (`admin-analytics.spec.ts`)**:
   - Verifies dashboard KPI cards (fuel consumed, delivery efficiency, total cost saved, active fleet status).

---

## Mocking Strategies

To ensure reliable, deterministic execution without third-party network dependencies or billable API costs, SmartRoute employs strategic mocking:

### 1. Geoapify Map Tiles & Geocoding
* In backend tests, external geocoding calls are intercepted via module mocking or fall back to the built-in Bhubaneswar centroid database.
* In frontend Vitest (`client/src/test/setup.ts`), the `leaflet` library is mocked completely. Tile layers return no-op objects, preventing tile fetch requests from firing against Geoapify servers in jsdom.

### 2. Socket.IO Real-Time Clients
* Backend integration tests use real `socket.io-client` instances connecting to the local HTTP server port with JWT authentication to test room joining and location ping broadcasting (`server/tests/socket_auth.test.js`).
* Frontend component tests mock the `DriverSocketContext` and use fake timer hooks (`vi.useFakeTimers()`) to verify location ping debouncing (3000ms intervals) and offline fallback queuing without establishing real WebSockets (`client/src/context/__tests__/DriverSocketContextDebounce.test.tsx`).

### 3. Google Maps Deep-Links
* External navigation deep-links are built by pure utility functions (`client/src/utils/googleMaps.ts`).
* Tests in `googleMapsContinuousNav.test.ts` verify URL syntax:
  - Base endpoint: `https://www.google.com/maps/dir/?api=1&travelmode=driving`
  - Unset `origin` parameter: Verifies that static depot coordinates are omitted as an origin so the driver's phone directly launches GPS navigation from live satellite fix.
  - Multi-stop waypoints: Validates pipe-delimited encoding of intermediate stops (`waypoints=lat1,lng1|lat2,lng2`) and final destination coordinates.

---

## Writing New Tests

### Naming & Placement Conventions

* **Backend Test Files**:
  - Name format: `server/tests/{feature_name}.test.js`
  - Helper utilities: `server/tests/helpers/testUtils.js`
* **Frontend Test Files**:
  - Name format: `client/src/{area}/__tests__/{ComponentName}.test.tsx` or `*.test.ts`
  - Shared fixtures & mock builders: `client/src/test/mocks.ts`
  - Shared component test renderers: `client/src/test/test-utils.tsx`
* **Playwright E2E Specs**:
  - Name format: `client/tests/e2e/{journey-name}.spec.ts`
  - Shared test fixtures: `client/tests/e2e/fixtures.ts`

### Backend Test Example Pattern

```javascript
const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestVehicle } = require('./helpers/testUtils');

describe('Fleet Vehicle Registration (POST /api/v1/vehicles)', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;
  });

  test('creates vehicle successfully when payload is valid', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'OD-02-SR-9999',
        makeModel: 'Tata Ace EV',
        capacityKg: 1000,
        fuelType: 'Electric',
        kmPerLitre: 12.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plate).toBe('OD-02-SR-9999');
  });
});
```

### Frontend Component Test Example Pattern

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyActionComponent } from '../MyActionComponent';
import { createMockUser } from '../../../test/mocks';

describe('MyActionComponent', () => {
  it('triggers onConfirm when button is clicked', () => {
    const onConfirm = vi.fn();
    render(<MyActionComponent onConfirm={onConfirm} user={createMockUser()} />);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

---

## Coverage Requirements

* Backend coverage is generated via Jest's Istanbul collector (`npm --prefix server run test:coverage`).
* Frontend coverage is generated via Vitest's V8 provider (`npx --prefix client vitest run --coverage`).

| Test Layer | Provider | Target / Threshold Status |
| :--- | :--- | :--- |
| **Backend Core** | Istanbul / Jest | Regressions enforce validation for all routes, auth middleware, and optimization heuristics. |
| **Frontend Unit** | `@vitest/coverage-v8` | Critical components, auth context, and mapping utilities require active unit test coverage. |

Coverage reports are saved to `server/coverage/` and `client/coverage/` respectively and can be viewed locally via their `index.html` files.

---

## CI/CD Automation Integration

Continuous integration is orchestrated via **GitHub Actions** in `.github/workflows/ci.yml`. Every pull request and push to `main`, `master`, `develop`, or `feature/**` triggers three parallel and chained verification stages:

### 1. Job: `validate-and-test`
* **Environment**: `ubuntu-latest` with containerized MongoDB 6.0 service and Node.js 22.
* **Steps**:
  1. Monorepo dependency installation (`npm ci`).
  2. Supply chain security vulnerability check (`npm audit --audit-level=high`).
  3. Frontend TypeScript strict compilation (`npm --prefix client test`).
  4. Frontend Vitest unit suite (`npm --prefix client run test:unit`).
  5. Frontend production distribution build (`npm --prefix client run build`).
  6. Backend Jest test suite with `--runInBand` against the MongoDB container (`npm --prefix server test -- --runInBand`).
  7. Admin bootstrapping & live production smoke check (`npm run smoke` targeting an in-process instance).

### 2. Job: `docker-and-compose`
* **Trigger**: Requires `validate-and-test` to pass.
* **Steps**:
  1. Validates `docker-compose.yml` and `deploy/nginx/default.conf` configuration syntax.
  2. Builds multi-stage production Docker image (`smartroute:ci`).
  3. Spins up the stack with `docker compose up -d --build --wait`.
  4. Executes live smoke suite (`node scripts/smoke-test.js --api-url http://127.0.0.1:18080 --expect-spa --retries 30`).
  5. Clean teardown with volume removal (`docker compose down -v`).

### 3. Job: `e2e-tests`
* **Trigger**: Requires `validate-and-test` to pass.
* **Steps**:
  1. Starts MongoDB 6.0 container.
  2. Installs Playwright Chromium browser binaries and system dependencies (`npx playwright install chromium --with-deps`).
  3. Runs Playwright E2E tests (`npm --prefix client run test:e2e -- --project=chromium`).
  4. Uploads Playwright HTML reports (`playwright-report/`) as workflow artifacts with a 7-day retention period.
  5. Automatically uploads Playwright trace recordings (`test-results/`) on any test failure for diagnostic analysis.
