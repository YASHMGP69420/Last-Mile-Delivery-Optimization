# SmartRoute E2E Testing Infrastructure & Specification

## 1. Testing Philosophy & Governance

The SmartRoute End-to-End (E2E) Testing Framework provides rigorous, automated verification of the last-mile delivery optimization platform across its operational lifecycle. The framework adheres to four core testing principles:

1. **Opaque-Box Verification:**
   Tests interact exclusively across public system boundaries: REST HTTP endpoints (`/api/v1/*`), Socket.IO tracking gateway (`/socket.io`), and authoritative service interfaces. Internal database collections and state mutations are validated as observable outcomes of real API requests without internal function monkey-patching or synthetic bypasses.

2. **Requirement-Driven Expected Outputs:**
   Every assertion is derived directly from the authoritative source documents:
   - `ORIGINAL_REQUEST.md`: User-facing functional expectations and operational workflows.
   - `PROJECT.md`: 38-feature master inventory, architectural contracts, and Bhubaneswar operational context.
   - `docs/API_CONTRACTS.md`: Uniform response envelopes, HTTP status codes, error payloads, and state machine transition rules.
   - Mathematical properties and physical bounds (e.g., triangle inequality in 2-opt search, non-negative fuel/energy consumption, strictly positive package weights).

3. **Uniform Interface Conformance:**
   All API endpoints are validated against the standard envelope contracts:
   - **Success (200, 201):** `{ "success": true, "data": <payload>, "message": "<optional>" }`
   - **Failure (400, 401, 403, 404, 409, 422, 500):** `{ "success": false, "error": { "code": "<STRING_CODE>", "message": "<string>", "details": [...] } }`

4. **Progressive Testability & Isolation:**
   - Milestone 1 (M1) features execute fully against live Express routes backed by an isolated MongoDB test database.
   - Milestones 2 & 3 (M2, M3) feature suites gracefully validate schema contracts and algorithmic core logic when routes are under active construction, ensuring no premature false-negative blocking while maintaining contract enforcement.
   - All test suites are self-contained, independent of execution ordering, and perform automatic database sanitization.

---

## 2. Directory Layout

```
tests/
└── e2e/
    ├── runner.js                      # Central CLI test runner with exit code semantics
    ├── harness/
    │   ├── testServer.js              # Express app launcher, DB connection & tear-down, JWT helpers
    │   └── fixtures.js                # Bhubaneswar canonical stops, demo vehicles, drivers, valid/invalid CSVs
    ├── tier1-features/                # Core features tested in isolation
    │   ├── auth-rbac.test.js          # Authentication, JWT lifecycle, RBAC matrix (Admin, Manager, Driver)
    │   ├── vehicles.test.js           # Vehicle registry CRUD, ICE vs EV specs, payload capacity
    │   ├── drivers.test.js            # Driver profiles, commercial licensing, availability
    │   ├── deliveries.test.js         # Delivery consignment CRUD, time windows, weight constraints
    │   ├── csv-import.test.js         # CSV ingestion, PapaParse dry-run vs commit mode
    │   ├── batches.test.js            # Delivery batch creation, clustering, metrics aggregation
    │   ├── optimization-schema.test.js# Route optimization API contract & heuristic schemas
    │   ├── dispatch-flow.test.js      # Route dispatching, versioning snapshots, driver assignment
    │   └── analytics-kpis.test.js     # Master dashboard KPIs and report export contracts
    ├── tier2-boundaries/              # Boundary conditions & edge cases
    │   ├── payload-boundaries.test.js # Zero weights, negative weights, exact vehicle payload capacity, overflow
    │   ├── time-windows.test.js       # Inverted windows (start >= end), invalid 24h formats, missing windows
    │   ├── csv-edge-cases.test.js     # Empty CSV files, unrecognized headers, non-numeric weights, whitespace
    │   ├── duplicate-orders.test.js   # Intra-file order collisions, case-insensitive references, DB duplicates
    │   ├── concurrent-fleet.test.js   # 1:1 Driver-Vehicle mutual exclusivity, race condition prevention
    │   └── security-tokens.test.js    # Expired tokens, tampered signatures, alg:none bypasses, logout revocation
    ├── tier3-pairwise/                # Cross-feature integration & pairwise interactions
    │   ├── auth-fleet-pairwise.test.js# Role authorization matrix combined with fleet operations
    │   ├── csv-batch-pairwise.test.js # CSV ingestion directly composed into operational dispatch batch
    │   ├── batch-optimization-pairwise.test.js # Batch dataset evaluated by optimization engine
    │   └── driver-lifecycle-pairwise.test.js  # Driver vehicle assignment through full delivery lifecycle & POD
    └── tier4-workloads/               # Real-world operational scenarios & stress benchmarks
        ├── bhubaneswar-canonical-55.test.js  # Canonical 55-stop Rasulgarh hub & 5-cluster operational dataset
        ├── multi-cluster-dispatch.test.js    # Mixed fleet (EV + ICE) multi-cluster concurrent dispatch
        └── end-to-end-driver-fulfillment.test.js # Full driver journey: login -> route view -> stop POD -> exception
```

---

## 3. CLI Test Runner (`tests/e2e/runner.js`)

The standalone test runner executes test suites independently of third-party test runners, providing deterministic output, ANSI-formatted summaries, and strict process exit codes.

### Usage
```bash
node tests/e2e/runner.js [options]
```

### Options
| Flag | Description | Default |
|---|---|---|
| `--tier=<1\|2\|3\|4\|all>` or `-t <tier>` | Filter execution to a specific test tier | `all` |
| `--verbose` or `-v` | Output granular test step details and payload snapshots | `false` |
| `--bail` or `-b` | Immediately terminate run upon the first failed test | `false` |
| `--help` or `-h` | Display help screen and command options | — |

### Exit Code Semantics
- **Exit 0**: All executed test suites and assertions passed successfully.
- **Exit 1**: One or more assertions failed, or an unhandled runner exception occurred.

### Formatted Terminal Output Sample
```
================================================================================
  SMARTHROUTE 4-TIER E2E TEST RUNNER
  Environment: test | Node: v24.16.0 | Mode: tier=all
================================================================================

[TIER 1] Feature Isolation Tests
  √ auth-rbac.test.js (420 ms) - 6 passed
  √ vehicles.test.js (310 ms) - 5 passed
  √ drivers.test.js (285 ms) - 5 passed
  √ deliveries.test.js (340 ms) - 6 passed
  √ csv-import.test.js (290 ms) - 5 passed
  √ batches.test.js (315 ms) - 5 passed
  √ optimization-schema.test.js (150 ms) - 4 passed
  √ dispatch-flow.test.js (180 ms) - 4 passed
  √ analytics-kpis.test.js (140 ms) - 4 passed

[TIER 2] Boundary & Corner Cases
  √ payload-boundaries.test.js (250 ms) - 5 passed
  √ time-windows.test.js (220 ms) - 4 passed
  √ csv-edge-cases.test.js (310 ms) - 5 passed
  √ duplicate-orders.test.js (260 ms) - 4 passed
  √ concurrent-fleet.test.js (390 ms) - 4 passed
  √ security-tokens.test.js (330 ms) - 5 passed

[TIER 3] Cross-Feature Pairwise Integrations
  √ auth-fleet-pairwise.test.js (380 ms) - 4 passed
  √ csv-batch-pairwise.test.js (410 ms) - 4 passed
  √ batch-optimization-pairwise.test.js (290 ms) - 4 passed
  √ driver-lifecycle-pairwise.test.js (450 ms) - 4 passed

[TIER 4] Real-World Workloads & Operational Scenarios
  √ bhubaneswar-canonical-55.test.js (680 ms) - 3 passed
  √ multi-cluster-dispatch.test.js (590 ms) - 3 passed
  √ end-to-end-driver-fulfillment.test.js (620 ms) - 3 passed

--------------------------------------------------------------------------------
SUMMARY:
  Total Suites: 22 | Total Tests: 92 | Passed: 92 | Failed: 0 | Skipped: 0
  Duration: 7.45s
  Tier Breakdown:
    Tier 1 (Core Features):      44/44 passed
    Tier 2 (Boundaries):          26/26 passed
    Tier 3 (Pairwise):           16/16 passed
    Tier 4 (Workloads):           6/6 passed
================================================================================
RESULT: ALL TESTS PASSED (Exit Code: 0)
```

---

## 4. 38-Feature Inventory Mapping Table

| Feature ID | Feature Name | Milestone | Tier 1 (Features) | Tier 2 (Boundaries) | Tier 3 (Pairwise) | Tier 4 (Workloads) | Primary Test File |
|:--:|---|:--:|:--:|:--:|:--:|:--:|---|
| **1** | User Authentication | M1 | Yes | Yes | Yes | Yes | `tier1-features/auth-rbac.test.js`, `tier2-boundaries/security-tokens.test.js` |
| **2** | User Provisioning & RBAC | M1 | Yes | — | Yes | — | `tier1-features/auth-rbac.test.js`, `tier3-pairwise/auth-fleet-pairwise.test.js` |
| **3** | Token Refresh & Session Management | M1 | Yes | Yes | — | — | `tier1-features/auth-rbac.test.js`, `tier2-boundaries/security-tokens.test.js` |
| **4** | Vehicle Registry CRUD | M1 | Yes | Yes | Yes | Yes | `tier1-features/vehicles.test.js`, `tier2-boundaries/payload-boundaries.test.js` |
| **5** | Driver Profile CRUD | M1 | Yes | — | Yes | Yes | `tier1-features/drivers.test.js`, `tier3-pairwise/driver-lifecycle-pairwise.test.js` |
| **6** | Driver-Vehicle Pairing (1:1) | M1 | Yes | Yes | Yes | Yes | `tier1-features/drivers.test.js`, `tier2-boundaries/concurrent-fleet.test.js` |
| **7** | Delivery Consignment CRUD | M1 | Yes | Yes | Yes | Yes | `tier1-features/deliveries.test.js`, `tier2-boundaries/time-windows.test.js` |
| **8** | CSV Batch Import & Dry-Run Validation | M1 | Yes | Yes | Yes | — | `tier1-features/csv-import.test.js`, `tier2-boundaries/csv-edge-cases.test.js` |
| **9** | Delivery Lifecycle State Machine | M1 | Yes | Yes | Yes | Yes | `tier1-features/deliveries.test.js`, `tier3-pairwise/driver-lifecycle-pairwise.test.js` |
| **10** | Immutable Delivery & Audit Logging | M1 | Yes | — | Yes | Yes | `tier1-features/deliveries.test.js`, `tier3-pairwise/driver-lifecycle-pairwise.test.js` |
| **11** | Delivery Batch Management | M1 | Yes | Yes | Yes | Yes | `tier1-features/batches.test.js`, `tier3-pairwise/csv-batch-pairwise.test.js` |
| **12** | Design System & Scaffolding | M1 | — | — | — | — | Verified via Client Build & UI Component Guideline audits |
| **13** | Manifest Management UI & Waybill Drawer | M1 | — | — | — | — | Verified via Client Component Specifications |
| **14** | Bhubaneswar Canonical Seed Dataset | M1 | Yes | — | — | Yes | `tier4-workloads/bhubaneswar-canonical-55.test.js` |
| **15** | Address Geocoding Service | M2 | Yes | Yes | — | Yes | `tier1-features/deliveries.test.js`, `tier2-boundaries/csv-edge-cases.test.js` |
| **16** | Distance & Duration Matrix Engine | M2 | Yes | — | Yes | Yes | `tier1-features/optimization-schema.test.js`, `tier4-workloads/bhubaneswar-canonical-55.test.js` |
| **17** | Dual-Mode Mapping & Traffic Simulation | M2 | Yes | — | — | Yes | `tier1-features/optimization-schema.test.js` |
| **18** | Baseline Route Calculation | M2 | Yes | — | Yes | Yes | `tier1-features/optimization-schema.test.js`, `tier3-pairwise/batch-optimization-pairwise.test.js` |
| **19** | Multi-Vehicle Bin-Packing Allocation | M2 | Yes | Yes | Yes | Yes | `tier1-features/optimization-schema.test.js`, `tier4-workloads/multi-cluster-dispatch.test.js` |
| **20** | Nearest-Neighbor Route Construction | M2 | Yes | — | Yes | Yes | `tier1-features/optimization-schema.test.js`, `tier3-pairwise/batch-optimization-pairwise.test.js` |
| **21** | Bounded 2-Opt Local Search | M2 | Yes | — | Yes | Yes | `tier1-features/optimization-schema.test.js`, `tier3-pairwise/batch-optimization-pairwise.test.js` |
| **22** | Multi-Objective Scoring Engine | M2 | Yes | — | Yes | Yes | `tier1-features/optimization-schema.test.js` |
| **23** | Fuel & EV Energy Model | M2 | Yes | Yes | — | Yes | `tier1-features/optimization-schema.test.js`, `tier4-workloads/multi-cluster-dispatch.test.js` |
| **24** | Route Versioning & Dispatch Snapshotting | M2 | Yes | — | Yes | Yes | `tier1-features/dispatch-flow.test.js`, `tier3-pairwise/batch-optimization-pairwise.test.js` |
| **25** | Route Planner Workspace UI | M2 | — | — | — | — | Verified via Client Component Specifications |
| **26** | Socket.IO Tracking Gateway | M2 | Yes | — | — | Yes | `tier1-features/dispatch-flow.test.js`, `tier4-workloads/end-to-end-driver-fulfillment.test.js` |
| **27** | Consented Driver GPS Telemetry | M3 | Yes | — | — | Yes | `tier1-features/dispatch-flow.test.js`, `tier4-workloads/end-to-end-driver-fulfillment.test.js` |
| **28** | Live Fleet Tracking Cockpit UI | M3 | — | — | — | — | Verified via Client Component Specifications |
| **29** | Driver Mobile Home & Shift Dashboard | M3 | — | — | — | Yes | Verified via Client Component Specifications |
| **30** | Turn-by-Turn Navigation HUD | M3 | — | — | — | — | Verified via Client Component Specifications |
| **31** | 4-Step Proof of Delivery (POD) Wizard | M3 | Yes | — | Yes | Yes | `tier1-features/deliveries.test.js`, `tier4-workloads/end-to-end-driver-fulfillment.test.js` |
| **32** | Delivery Exception Handling | M3 | Yes | Yes | Yes | Yes | `tier1-features/deliveries.test.js`, `tier4-workloads/end-to-end-driver-fulfillment.test.js` |
| **33** | Operational Master Dashboard UI | M3 | Yes | — | — | Yes | `tier1-features/analytics-kpis.test.js` |
| **34** | Planned vs Actual Comparison Engine | M3 | Yes | — | — | Yes | `tier1-features/analytics-kpis.test.js` |
| **35** | Operational Analytics & Report Export | M3 | Yes | — | — | Yes | `tier1-features/analytics-kpis.test.js` |
| **36** | 4-Tier E2E Testing Suite | E2E | **Owner**| **Owner** | **Owner** | **Owner** | Central Framework Definition (`tests/e2e/runner.js`) |
| **37** | Adversarial Coverage Hardening | M4 | — | Yes | — | — | `tier2-boundaries/*` & `server/tests/adversarial*.js` |
| **38** | Security & Release Readiness Audit | M4 | — | Yes | Yes | — | `tier2-boundaries/security-tokens.test.js`, `tier3-pairwise/auth-fleet-pairwise.test.js` |

---

## 5. Test Harness Contracts & Database Lifecycle

To guarantee repeatable, isolated test runs:
- `tests/e2e/harness/testServer.js` exports:
  - `startTestEnvironment()`: Establishes Mongoose connection to `mongodb://127.0.0.1:27017/smartroute_test` (or `MONGODB_URI` environment override).
  - `cleanDatabase()`: Purges test collections (`users`, `vehicles`, `drivers`, `deliveries`, `deliverybatches`, `auditevents`) between runs.
  - `stopTestEnvironment()`: Gracefully closes database connections and HTTP listeners.
  - `getAuthHeaders(role)`: Generates valid signed JWT credentials and test actor models for `ADMIN`, `FLEET_MANAGER`, and `DRIVER` roles.
  - `request`: Configured Supertest agent targeting the Express application instance.
- `tests/e2e/harness/fixtures.js` provides deterministic test data:
  - Canonical Rasulgarh depot coordinates (`[85.863, 20.297]`).
  - Standard fleet definitions (Tata Ace EV, Mahindra Bolero Diesel, Hero Electric Nyx Bike).
  - 55 Bhubaneswar landmark addresses grouped into 5 clusters (Patia, Jaydev Vihar, Saheed Nagar, Khandagiri, Chandrasekharpur).
  - Valid and invalid CSV fixtures for parser edge-case and boundary testing.
