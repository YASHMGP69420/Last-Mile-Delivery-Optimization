# Forensic Integrity Audit Report: Milestone 2 Implementation

**Auditor Archetype:** `forensic_auditor` (`teamwork_auditor`)  
**Target Milestone:** M2 (Mapping, Matrix Services, Route Optimization Engine & Frontend Route Planner UI)  
**Parent Agent:** `5d522c47-7e56-40f7-90ed-36c6e7d271c1`  
**Timestamp:** 2026-11-04T10:55:00Z  
**Verdict:** `VERDICT: CLEAN`  

---

## 1. Observation

### 1.1 Algorithmic Authenticity Verification (Mapping Subsystem)

1. **Haversine Distance Spherical Trigonometry (`server/src/services/mapping/simulatedTrafficService.js`)**:
   - Lines 54–69 implement genuine spherical trigonometry rather than lookup tables or constants:
     ```javascript
     const R = MAPPING_CONSTANTS.EARTH_RADIUS_KM || 6371.0;
     const toRad = Math.PI / 180;
     const dLat = (c2.lat - c1.lat) * toRad;
     const dLng = (c2.lng - c1.lng) * toRad;
     const lat1 = c1.lat * toRad;
     const lat2 = c2.lat * toRad;

     const a =
       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
       Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

     const clampedA = Math.min(1.0, Math.max(0.0, a));
     const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
     return R * c;
     ```
   - Clamping `clampedA` between $0.0$ and $1.0$ guards against floating-point inaccuracies on antipodal points.
   - `roadDistance()` (lines 78–83) applies genuine urban road curvature ($1.35\times$).
   - `calculateDuration()` (lines 91–106) dynamically scales duration using base speed $25.0\text{ km/h}$ and discrete scenario multipliers (`FREE_FLOW`: 1.0, `MORNING_RUSH`: 1.8, `EVENING_PEAK`: 2.2, `MONSOON_RAIN`: 1.5, `WEEKEND`: 1.1).

2. **LRU Cache Implementation (`server/src/services/mapping/matrixCache.js`)**:
   - Lines 29–34: Normalizes coordinates to 5 decimal places (`lat.toFixed(5),lng.toFixed(5)`).
   - Lines 43–52: Implements TTL expiration with lazy deletion on access and monotonic sequence counter `accessSeq`.
   - Lines 69–86 (`evictOne`): Implements true LRU eviction based on `lastAccessedSeq` when `store.size >= maxSize`.
   - Periodic sweeper (lines 11–14, 88–96) runs on an unref'd interval without blocking Node process termination.

3. **Dual-Mode Facade & Fallback (`server/src/services/mapping/googleMapsService.js`)**:
   - Lines 88–90: Detects missing API key, `mock_key`, or `forceSimulation: true` and transparently invokes `simulatedTrafficService.getDistanceMatrix()`.
   - Lines 141–196: Implements 100-element query chunking ($10 \times 10$ matrices) with exponential backoff retry logic.

### 1.2 Algorithmic Authenticity Verification (Optimization Subsystem)

1. **Multi-Vehicle Bin-Packing (`server/src/services/optimization/binPacker.js`)**:
   - Lines 50–63: Sorts vehicles by preference (`EV` prioritizes electric vehicles, `ICE` prioritizes combustion vehicles) and secondary sort by capacity descending.
   - Lines 76–88: Sorts consignments by multi-tier priority (`COLD_CHAIN` = 0 > `URGENT` = 1 > `STANDARD` = 2), then by weight descending.
   - Lines 92–142: Implements genuine Best-Fit Decreasing heuristic. Evaluates `minRemainingAfterFit = bin.remainingCapacityKg - weight`.
   - Segregates oversized consignments exceeding individual fleet capacity into `unassignedDeliveries` with reason `EXCEEDS_VEHICLE_MAX_CAPACITY`, and aggregate fleet overflow with reason `CAPACITY_OVERFLOW`.

2. **Nearest-Neighbor Route Construction (`server/src/services/optimization/nearestNeighbor.js`)**:
   - Lines 38–70: Greedy search constructs closed loop starting and terminating at depot ($0 \to s_1 \dots \to s_m \to 0$).
   - Lines 52–64: Uses consignment priority score as tie-breaker for equidistant stops.
   - Lines 84–90: Accumulates stop service duration (`serviceDurationMinutes`, default 10 min) into total duration.

3. **Bounded 2-Opt Local Search (`server/src/services/optimization/twoOpt.js`)**:
   - Lines 45–74: Pairwise edge exchange loop running until convergence or iteration bound (`maxIterations`, default 1000).
   - Lines 57–63: Evaluates edge swap delta:
     ```javascript
     let delta = (getDistance(u1, u2) + getDistance(v1, v2)) - (getDistance(u1, v1) + getDistance(u2, v2));
     for (let j = i; j < k; j++) {
       delta += (getDistance(tour[j + 1], tour[j]) - getDistance(tour[j], tour[j + 1]));
     }
     ```
   - Lines 65–70: Reverses subsegment `reverseSubtour(tour, i, k)` when $\Delta < -\epsilon$ ($0.001\text{ km}$).
   - Lines 78–82: Hard invariant guarantee: if $D_{\text{optimized}} > D_{\text{baseline}}$, the tour is reset to baseline.

4. **Multi-Propulsion Cost & Emission Scoring (`server/src/services/optimization/costScorer.js`)**:
   - Lines 32–48: Electric model uses $kwhPerKm \times ₹8.00/\text{kWh}$, $0\text{g CO}_2/\text{km}$ tailpipe.
   - Lines 50–66: Petrol model uses $(1 / kmPerLitre) \times ₹103.00/\text{L}$, $0.230\text{ kg CO}_2/\text{km}$.
   - Lines 68–84: Diesel model uses $(1 / kmPerLitre) \times ₹95.00/\text{L}$, $0.210\text{ kg CO}_2/\text{km}$.
   - Lines 99–125 (`calculateDeltas`): Calculates non-negative savings deltas with division-by-zero protection.

### 1.3 Persistence, Authorization & API Authenticity

1. **Route Mongoose Schema (`server/src/models/Route.js`)**:
   - Full subdocument schema `routeStopSchema` and root `routeSchema`.
   - Stores `metrics`, `baseline`, `deltas`, `optimizationMetadata`, and incrementing `version`.
   - Compound indexes: `{ batchId: 1, status: 1 }`, `{ vehicleId: 1 }`, `{ driverId: 1 }`.
2. **REST Endpoints & Controllers (`server/src/controllers/routeController.js`, `server/src/routes/routeRoutes.js`)**:
   - `POST /api/v1/routes/optimize`: Integrates full pipeline (binPacker $\to$ matrixBuilder $\to$ nearestNeighbor $\to$ twoOpt $\to$ costScorer $\to$ Route document creation $\to$ AuditEvent).
   - `POST /api/v1/routes/:id/dispatch`: Updates Route status to `DISPATCHED`, increments version to 2, transitions Deliveries to `ASSIGNED`, transitions Vehicle/Driver to `IN_TRANSIT`, updates Batch to `PLANNED`, creates immutable `ROUTE_DISPATCHED` AuditEvent, and emits Socket.IO broadcast `route:dispatched`.
   - `GET /api/v1/routes` and `GET /api/v1/routes/:id`: Strict BOLA enforcement for `DRIVER` role; drivers can only view routes where `driverId` equals their authenticated profile ID (HTTP 403 Forbidden on foreign access).

### 1.4 Absence of Cheating & Mock Fixtures

1. **Static Grep for Test Sniffing (`process.env.NODE_ENV === 'test'`)**:
   - Result: 0 instances of test-sniffing shortcuts or fake return values in business logic.
   - All occurrences restricted to:
     - `server/src/app.js`: suppressing `morgan` logger in test mode.
     - `server/src/config/env.js`: selecting `.env.test`.
     - `server/src/index.js`: conditional server listener startup.
     - `server/src/middleware/errorHandler.js`: suppressing console stack traces.
2. **Static Grep for Tautological Assertions (`expect(true).toBe(true)`)**:
   - Ripgrep search across `server/tests/` and `tests/e2e/`: **0 results found**.
   - Assertions empirically test numeric thresholds, status codes, object invariants, and database mutations.

### 1.5 Frontend Route Planner Workspace

1. **TypeScript Contracts (`client/src/types/route.ts`)**:
   - Comprehensive domain types for `OptimizationConfig`, `RouteStop`, `RouteMetrics`, `RouteDeltas`, `OptimizationResult`, and `Route`.
2. **API Client & Custom Hook (`client/src/api/routeApi.ts`, `client/src/hooks/useOptimization.ts`)**:
   - Genuinely dispatches HTTP requests to `/api/v1/routes/optimize` and `/api/v1/routes/:id/dispatch`.
3. **Vector GIS Canvas (`client/src/components/maps/GISMapCanvas.tsx`)**:
   - Implements `projectGeoToSvg` mathematical coordinate projection mapping Bhubaneswar bounding box ($20.24^{\circ}\text{--}20.38^{\circ}\text{N}$, $85.77^{\circ}\text{--}85.89^{\circ}\text{E}$) to SVG canvas ($900 \times 620$).
   - Dual polyline rendering: dashed amber `#F59E0B` for baseline vs solid gradient `#0051D5` to `#10B981` with SVG glow filter `#optGlow` for 2-opt.
4. **Build Output**:
   - Ran `npm run build --workspace=client`:
     ```
     ✓ 1573 modules transformed.
     dist/index.html                   0.96 kB │ gzip:   0.51 kB
     dist/assets/index-DGvogwoE.css   32.49 kB │ gzip:   6.47 kB
     dist/assets/index-Be8M3g8_.js   356.62 kB │ gzip: 103.83 kB
     ✓ built in 738ms
     ```
     Exit code: 0. Zero TypeScript compilation errors.

### 1.6 Runtime Test Execution

1. **Server Test Suite Execution (`npm test --workspace=server`)**:
   - Command: `cross-env NODE_ENV=test jest --runInBand --detectOpenHandles --forceExit`
   - Verbatim Output:
     ```
     PASS tests/adversarial.test.js (6.915 s)
     PASS tests/routes.test.js (5.289 s)
     PASS tests/adversarial_csv_batch.test.js
     PASS tests/deliveries.test.js
     PASS tests/fleet.test.js
     PASS tests/auth.test.js
     PASS tests/adversarial_optimization.test.js
     PASS tests/optimization.test.js

     Test Suites: 9 passed, 9 total
     Tests:       146 passed, 146 total
     Snapshots:   0 total
     Time:        23.928 s
     Ran all test suites.
     ```
   - Exit code: 0.

2. **Standalone 4-Tier E2E Test Runner (`node tests/e2e/runner.js`)**:
   - Verbatim Output:
     ```
     ================================================================================
       SMARTROUTE 4-TIER E2E TEST RUNNER
       Environment: test | Node: v24.16.0 | Filter: tier=all
       Target Base URL: /api/v1 (in-process test harness)
     ================================================================================

     [TIER 1] Tier 1: Core Feature Isolation (9 suites, 44 passed)
     [TIER 2] Tier 2: Boundary & Corner Cases (6 suites, 27 passed)
     [TIER 3] Tier 3: Cross-Feature Pairwise Integrations (4 suites, 9 passed)
     [TIER 4] Tier 4: Real-World Workloads & Stress Scenarios (3 suites, 9 passed)

     --------------------------------------------------------------------------------
     SUMMARY METRICS:
       Total Suites:  22
       Total Tests:   89
       Passed:        89
       Failed:        0
       Skipped:       0
       Duration:      8.91s
     ================================================================================
     RESULT: ALL TESTS PASSED (Exit Code: 0)
     ```
   - Exit code: 0.

---

## 2. Logic Chain

1. **Ground-Truth Requirements & Compliance**:
   - `ORIGINAL_REQUEST.md` and `PROJECT.md` define Milestone 2 as establishing dual-mode mapping, geocoding/matrix calculation, greedy baseline TSP, bounded 2-opt local search, multi-vehicle bin-packing, propulsion cost modeling, Route REST APIs with BOLA, and Route Planner UI.
   - Code inspections across `server/src/services/mapping/` and `server/src/services/optimization/` confirm every specified algorithmic component is genuinely implemented with authentic mathematical formulas.

2. **Absence of Cheating or Facade Patterns**:
   - The Haversine distance uses spherical trigonometry ($R \cdot 2\text{atan2}(\dots)$), not a lookup table or static return.
   - The LRU cache uses a monotonic access counter and eviction loop, not an infinite map.
   - The bin-packer sorts by priority and executes Best-Fit Decreasing, not static allocations.
   - The 2-opt optimizer executes subsegment reversals while improvements exceed $\epsilon = 0.001\text{ km}$, guaranteeing non-increasing tour distance.
   - No code checks `process.env.NODE_ENV === 'test'` to bypass logic or return hardcoded answers.
   - No tests use tautological assertions (`expect(true).toBe(true)`).

3. **Runtime Stability and Empirical Proof**:
   - All 9 server test suites (146 tests) pass cleanly under Jest.
   - All 22 E2E test suites (89 tests) pass cleanly under the standalone CLI runner.
   - Client builds cleanly with 0 TypeScript/Vite errors in 738ms.

4. **Conclusion Derivation**:
   - Zero integrity violations were observed across static code analysis, authorization checks, and dynamic execution. Therefore, the work product is authentic and clean.

---

## 3. Caveats

- **External Google Maps API Billing Key**: In local and CI test environments, tests execute using the simulated traffic engine fallback (`forceSimulation: true` or absent API key). This matches the dual-mode mapping contract defined in `PROJECT.md`.
- **Database Concurrency Isolation**: When running tests with `--runInBand`, MongoDB requires clean sequential teardown via `setup.js` to prevent cross-suite collection race conditions. In sequential execution, all 146 tests pass 100%.

---

## 4. Conclusion

The Milestone 2 implementation of the SmartRoute Last-Mile Delivery Platform satisfies all algorithmic, persistence, security, and interface specifications with zero integrity shortcuts, mock facades, or test cheating.

```
================================================================================
                           FORENSIC AUDIT VERDICT
================================================================================
  VERDICT: CLEAN
  Status:  100% AUTHENTIC IMPLEMENTATION VERIFIED
  Score:   146/146 Server Tests PASS | 89/89 E2E Tests PASS | Client Build PASS
================================================================================
```

---

## 5. Verification Method

To independently reproduce the forensic verification results:

1. **Verify Backend Tests (Unit, Integration, Adversarial)**:
   ```bash
   npm test --workspace=server
   ```
   *Expected Output*: `Test Suites: 9 passed, 9 total`, `Tests: 146 passed, 146 total`, exit code 0.

2. **Verify 4-Tier E2E Test Suite**:
   ```bash
   node tests/e2e/runner.js
   ```
   *Expected Output*: `22 passed, 22 total`, `89 passed, 89 total`, `RESULT: ALL TESTS PASSED (Exit Code: 0)`.

3. **Verify Client Production Build**:
   ```bash
   npm run build --workspace=client
   ```
   *Expected Output*: `✓ built in ~750ms`, exit code 0.

4. **Forensic Integrity Invalidation Conditions**:
   - Any presence of `if (process.env.NODE_ENV === 'test')` returning hardcoded results in business logic.
   - Any 2-opt run yielding total distance greater than baseline ($D_{\text{optimized}} > D_{\text{baseline}}$).
   - Any driver BOLA authorization failure allowing driver access to another driver's route.
