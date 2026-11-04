# Handoff Report: E2E Test Runner Startup Isolation & Clean State Guard

**Agent**: `teamwork_explorer_m2_it2_3`  
**Archetype**: `teamwork_explorer`  
**Milestone**: Milestone 2 Iteration 2  
**Parent Agent ID**: `5d522c47-7e56-40f7-90ed-36c6e7d271c1`  
**Date**: 2026-11-04  
**Primary Deliverable**: `m2_it2_e2e_isolation_remediation.md`  

---

## 1. Observation

1. **`tests/e2e/runner.js:125` Startup Hook Omission**:
   - In `tests/e2e/runner.js:125`, the runner initializes the test environment:
     ```javascript
     await harness.startTestEnvironment();

     const suites = await collectSuites();
     ```
   - Collection cleanup (`await harness.cleanDatabase()`) is only called at the very end of the runner at line 332:
     ```javascript
     await harness.cleanDatabase();
     await harness.stopTestEnvironment();
     ```
   - If a test run is aborted prematurely (via Ctrl+C, SIGTERM, `--bail`, or an unhandled crash), `await harness.cleanDatabase()` is never invoked, leaving all collections dirty in `mongodb://127.0.0.1:27017/smartroute_test`.

2. **First Suite Isolation Vulnerability (`tests/e2e/tier1-features/analytics-kpis.test.js`)**:
   - Analysis of all 22 test suites revealed that 21 suites implement:
     ```javascript
     beforeEach(async () => {
       await harness.cleanDatabase();
     });
     ```
   - `analytics-kpis.test.js` is the **only suite** in the entire repository that lacks a `beforeEach` cleanup hook.
   - Because `analytics-kpis.test.js` is alphabetically first in `tier1-features/`, it executes first in `runner.js`. In line 46, `TC-T1-ANL-3` executes:
     ```javascript
     const total = await harness.models.Delivery.countDocuments({});
     const completed = await harness.models.Delivery.countDocuments({ status: 'COMPLETED' });
     const failed = await harness.models.Delivery.countDocuments({ status: 'FAILED' });
     ```
   - When running on a previously uncleared database, `total` contains dirty documents from prior runs (such as the 55 canonical deliveries from Tier 4), compromising test determinism.

3. **Absence of Graceful Signal Handling (`SIGINT` / `SIGTERM`)**:
   - Direct inspection of `tests/e2e/runner.js` lines 344–352 revealed:
     ```javascript
     // Execute Runner
     run().catch(async (err) => {
       console.error(`${RED}${BOLD}Fatal unhandled runner exception:${RESET}`, err);
       try {
         await harness.stopTestEnvironment();
       } catch (_) {}
       process.exit(1);
     });
     ```
   - Zero listeners exist for `process.on('SIGINT')` or `process.on('SIGTERM')`.
   - In the event of an unhandled exception in `run().catch()`, `harness.stopTestEnvironment()` is called, but `harness.cleanDatabase()` is omitted.

4. **Tier 4 Heavy Workload Seeding Isolation**:
   - In `tests/e2e/tier4-workloads/`:
     - `bhubaneswar-canonical-55.test.js` (lines 14–16)
     - `end-to-end-driver-fulfillment.test.js` (lines 14–16)
     - `multi-cluster-dispatch.test.js` (lines 16–18)
   - All three suites define `beforeEach(async () => { await harness.cleanDatabase(); })`, but none define `afterEach(...)`.
   - When `TC-T4-MCD-2` finishes, 55 deliveries, users, vehicles, batches, and generated `Route` documents remain in MongoDB until line 332 executes.
   - In `server/src/seed/seedBhubaneswar.js` lines 27–34:
     ```javascript
     await Promise.all([
       User.deleteMany({}),
       Vehicle.deleteMany({}),
       Driver.deleteMany({}),
       Delivery.deleteMany({}),
       DeliveryBatch.deleteMany({}),
       AuditEvent.deleteMany({}),
     ]);
     ```
     `Route.deleteMany({})` is omitted, causing route optimization snapshots to persist across canonical seed runs unless cleaned by `harness.cleanDatabase()`.

5. **Interface Inspection of `tests/e2e/harness/testServer.js`**:
   - `startTestEnvironment()` returns `{ app, mongoose }` (lines 31–32) without exposing the underlying connection object.
   - `cleanDatabase()` (lines 35–42) takes no parameters and assumes global `mongoose.connection`.

---

## 2. Logic Chain

1. **Premise 1 (From Observation 1 & 2)**:
   - When a test run is aborted mid-execution, MongoDB retains populated records.
   - When `node tests/e2e/runner.js` is subsequently started, `harness.startTestEnvironment()` connects to the database, but does not clean it.
   - The first suite to run is `analytics-kpis.test.js`, which does not have a `beforeEach` hook. It directly reads the dirty database, causing assertion distortions in `TC-T1-ANL-3`.
   - When subsequent tests or seed routines run, attempts to insert unique keys (e.g. `vehicleId: "OD-02-AK-1001"`, `email: "admin@smartroute.io"`, or delivery order references) trigger `E11000 duplicate key error`.

2. **Premise 2 (From Observation 3)**:
   - Without `SIGINT` and `SIGTERM` handlers, any user cancellation (`Ctrl+C`) or CI job timeout terminates the Node.js process immediately, skipping the teardown block at line 332.
   - Adding explicit signal listeners with a shared graceful teardown routine ensures the database is purged regardless of how the runner exits.

3. **Premise 3 (From Observation 4 & 5)**:
   - In Tier 4, each test seeds 55 deliveries, batches, vehicles, and creates route documents.
   - Relying solely on `beforeEach` leaves heavy batches in MongoDB after the suite finishes. If the runner exits or bails after Tier 4, those heavy documents remain.
   - Adding `afterEach(async () => { await harness.cleanDatabase(); })` to Tier 4 suites and an inter-suite cleanup barrier in `runner.js` creates a deterministic boundary between heavy test cycles.
   - Updating `harness.startTestEnvironment()` to return `{ app, mongoose, connection: mongoose.connection }` and updating `cleanDatabase(connection = null)` satisfies the exact architectural requirement:
     ```javascript
     const { connection } = await harness.startTestEnvironment();
     await cleanDatabase(connection);
     ```

---

## 3. Caveats

1. **Parallel / Concurrent Runner Processes**:
   - `mongodb://127.0.0.1:27017/smartroute_test` is a single shared test database. If two test runner processes are launched simultaneously against the same database URI, they will interleave `cleanDatabase()` and `insertMany` operations. Concurrent test runs require unique database names per worker (e.g. `smartroute_test_${workerId}`). Standalone and CI sequential execution are fully protected.
2. **Read-Only Investigation Compliance**:
   - In accordance with the Teamwork Explorer identity and instructions, no files in `tests/` or `server/` were directly modified. All recommendations are delivered as exact, line-by-line diffs in `m2_it2_e2e_isolation_remediation.md`.

---

## 4. Conclusion

Finding 3 has been thoroughly investigated and diagnosed down to the exact lines in 7 files. A 4-layer defense-in-depth isolation strategy has been designed:
1. **Startup Isolation Hook**: `tests/e2e/runner.js:125` invokes `await cleanDatabase(connection)` immediately upon connection.
2. **Graceful Teardown Guard**: `runner.js` traps `SIGINT` and `SIGTERM` signals and catches unhandled exceptions, executing clean teardown before exit.
3. **Inter-Suite Isolation Barrier**: `runner.js` executes `await cleanDatabase(connection)` after each test suite, guaranteeing zero cross-suite pollution.
4. **Workload Self-Cleaning**: Missing `beforeEach` hook added to `analytics-kpis.test.js`, `afterEach` hooks added to Tier 4 heavy workload suites, and `Route.deleteMany({})` added to `seedBhubaneswar.js`.

The complete implementation plan with unified diffs is published in:
`c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\.agents\teamwork\teamwork_explorer_m2_it2_3\m2_it2_e2e_isolation_remediation.md`

---

## 5. Verification Method

To independently verify the proposed remediation:

1. **Verify Startup Isolation via Dirty State Pre-Seeding**:
   - Insert a conflicting vehicle record into `smartroute_test`:
     ```bash
     node -e "const mongoose = require('mongoose'); const Vehicle = require('./server/src/models/Vehicle'); mongoose.connect('mongodb://127.0.0.1:27017/smartroute_test').then(async () => { await Vehicle.create({ vehicleId: 'OD-02-AK-1001', makeModel: 'Dirty Test', type: 'Van', capacityKg: 1000, fuelType: 'Diesel', kmPerLitre: 10, availability: 'AVAILABLE' }); await mongoose.disconnect(); console.log('Dirty vehicle pre-seeded'); });"
     ```
   - Execute the test runner:
     ```bash
     node tests/e2e/runner.js
     ```
   - *Verification Criteria*: The runner must cleanly start, purge the pre-existing record via `await cleanDatabase(connection)`, and pass all 22 suites / 89 tests without duplicate key collisions.

2. **Verify Consecutive Full Runs**:
   ```bash
   node tests/e2e/runner.js && node tests/e2e/runner.js
   ```
   *Verification Criteria*: Both consecutive runs must achieve 89/89 passed (exit code 0).

3. **Verify Tier 4 Isolation**:
   ```bash
   node tests/e2e/runner.js --tier=4
   ```
   *Verification Criteria*: All 3 Tier 4 suites (9 tests) execute cleanly, and collections are immediately empty following completion.

4. **Invalidation Conditions**:
   - Any `E11000 duplicate key error` on `vehicleId_1` or `orderReference_1`.
   - `TC-T1-ANL-3` counting non-zero deliveries on startup.
   - Any regression across the 89 E2E tests or 109 server baseline tests.
