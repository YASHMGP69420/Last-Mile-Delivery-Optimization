# Technical Remediation Blueprint: E2E Test Runner Startup Isolation & Clean State Guard

**Target Finding**: Finding 3 (Test Runner Startup Isolation & Clean State Guard)  
**Author**: `teamwork_explorer_m2_it2_3`  
**Milestone**: Milestone 2 Iteration 2  
**Target Files**:
1. `tests/e2e/runner.js`
2. `tests/e2e/harness/testServer.js`
3. `tests/e2e/tier1-features/analytics-kpis.test.js`
4. `tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js`
5. `tests/e2e/tier4-workloads/end-to-end-driver-fulfillment.test.js`
6. `tests/e2e/tier4-workloads/multi-cluster-dispatch.test.js`
7. `server/src/seed/seedBhubaneswar.js`

---

## 1. Executive Summary & Problem Analysis

### 1.1 The Problem
In the existing E2E testing framework, `tests/e2e/runner.js:332` executes database collection cleanup (`await harness.cleanDatabase()`) exclusively at the *end* of a successful test run. However:
1. **Startup Blindspot**: If a prior test execution is terminated prematurely (via Ctrl+C / SIGINT, SIGTERM, `--bail` early exit, or an unhandled crash), the database `mongodb://127.0.0.1:27017/smartroute_test` is left populated with residual documents from whichever tier was in progress.
2. **First-Suite Fragility**: On subsequent runs, `runner.js:125` invokes `await harness.startTestEnvironment()` without an initial purge. The first test suite executed (`tests/e2e/tier1-features/analytics-kpis.test.js`) is the only suite among all 22 test suites lacking a `beforeEach(async () => { await harness.cleanDatabase(); })` hook. Consequently, `TC-T1-ANL-3` evaluates delivery counts directly against dirty database records left over from prior runs.
3. **Collision Disruption**: Residual records from heavy batch seeding cycles (such as Tier 4 canonical Bhubaneswar seeding of 55 deliveries, vehicle registration `OD-02-AK-1001`, and driver pairing records) trigger unique index collisions:
   - `MongoServerError: E11000 duplicate key error collection: smartroute_test.vehicles index: vehicleId_1 dup key: { vehicleId: "OD-02-AK-1001" }`
   - Active driver 1:1 pairing blocks (`DRIVER_ALREADY_ASSIGNED` / `VEHICLE_UNAVAILABLE`)
   - Order reference collisions on `Delivery.orderReference`
4. **Missing Signal & Abrupt Teardown Guards**: There are currently zero signal listeners (`SIGINT`, `SIGTERM`) registered in `runner.js`. An operator or CI runner interrupting a test run causes immediate process death, permanently leaving dirty state in MongoDB. Furthermore, `run().catch(...)` calls `stopTestEnvironment()` without cleaning collections.
5. **Heavy Tier 4 Seeding Accumulation**: Tier 4 tests (`bhubaneswar-canonical-55.test.js`, `end-to-end-driver-fulfillment.test.js`, `multi-cluster-dispatch.test.js`) generate 55 consignments, routes, and audit records during each test case. None of these suites implement `afterEach` teardown, leaving data in the database until the next test's `beforeEach` runs. Furthermore, `seedBhubaneswar.js` clears users, vehicles, drivers, deliveries, batches, and audit events, but omits `Route.deleteMany({})`.

---

## 2. Technical Remediation Architecture

The technical remediation implements a defense-in-depth isolation architecture across four layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Runner Startup Guard (tests/e2e/runner.js:125)                │
│   • Connects to MongoDB via harness.startTestEnvironment()             │
│   • Immediately purges all collections: await cleanDatabase(connection)│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Layer 2: Graceful Signal & Exception Teardown Guard                     │
│   • SIGINT / SIGTERM listeners execute cleanDatabase + stopEnvironment │
│   • run().catch() handler cleans database before stopping environment  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Layer 3: Inter-Suite Isolation Barrier (runner.js:295)                 │
│   • After each suite finishes, executes cleanDatabase(connection)       │
│   • Guarantees complete isolation between suites regardless of author  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Layer 4: Workload Self-Cleaning (Tier 4 & Tier 1)                      │
│   • analytics-kpis.test.js receives missing beforeEach hook            │
│   • Tier 4 heavy suites receive afterEach hooks for instant purge      │
│   • seedBhubaneswar.js includes Route.deleteMany({}) in canonical purge│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Line-by-Line Remediation Diffs

### 3.1 Target File 1: `tests/e2e/harness/testServer.js`

#### Description
1. Update `startTestEnvironment()` to return `{ app, mongoose, connection: mongoose.connection }`.
2. Update `cleanDatabase()` to accept an optional `connection` parameter (`cleanDatabase(connection = null)`), defaulting to `mongoose.connection` if omitted for backwards compatibility.

#### Exact Diff
```diff
--- a/tests/e2e/harness/testServer.js
+++ b/tests/e2e/harness/testServer.js
@@ -31,7 +31,7 @@ async function startTestEnvironment() {
   }
   isInitialized = true;
-  return { app, mongoose };
+  return { app, mongoose, connection: mongoose.connection };
 }
 
-async function cleanDatabase() {
-  if (mongoose.connection.readyState !== 0) {
-    const collections = mongoose.connection.collections;
+async function cleanDatabase(connection = null) {
+  const conn = connection || mongoose.connection;
+  if (conn && conn.readyState !== 0) {
+    const collections = conn.collections;
     for (const key in collections) {
       await collections[key].deleteMany({});
     }
   }
 }
```

---

### 3.2 Target File 2: `tests/e2e/runner.js`

#### Description
1. Destructure `cleanDatabase` from `harness` at top of file.
2. In `run()`, capture `{ connection }` from `startTestEnvironment()` and execute `await cleanDatabase(connection);` immediately at startup.
3. At the end of each test suite iteration in `runner.js`, invoke `await cleanDatabase(connection);` as an inter-suite isolation barrier.
4. Register `process.on('SIGINT')` and `process.on('SIGTERM')` signal handlers for graceful teardown.
5. In `run().catch()`, ensure `await harness.cleanDatabase()` is called before `await harness.stopTestEnvironment()`.

#### Exact Diff
```diff
--- a/tests/e2e/runner.js
+++ b/tests/e2e/runner.js
@@ -21,4 +21,5 @@ const path = require('path');
 const assert = require('node:assert/strict');
 const harness = require('./harness/testServer');
+const { cleanDatabase } = harness;
 const fixtures = require('./harness/fixtures');
 
@@ -124,4 +125,5 @@ async function run() {
   console.log(`${CYAN}${BOLD}================================================================================${RESET}\n`);
 
-  await harness.startTestEnvironment();
+  const { connection } = await harness.startTestEnvironment();
+  await cleanDatabase(connection);
 
   const suites = await collectSuites();
@@ -293,4 +295,7 @@ async function run() {
     }
 
+    // Inter-suite isolation barrier
+    await cleanDatabase(connection);
+
     if (bail && suiteFailCount > 0) break;
   }
@@ -343,7 +348,27 @@ async function run() {
 }
 
+// Graceful signal termination handlers
+let isShuttingDown = false;
+async function handleTermination(signal) {
+  if (isShuttingDown) {
+    process.exit(signal === 'SIGINT' ? 130 : 143);
+  }
+  isShuttingDown = true;
+  console.log(`\n\n${YELLOW}${BOLD}[Runner] Received ${signal} — executing clean database teardown...${RESET}`);
+  try {
+    await harness.cleanDatabase();
+    await harness.stopTestEnvironment();
+    console.log(`${GREEN}[Runner] Database and connections cleanly torn down.${RESET}`);
+  } catch (err) {
+    console.error(`${RED}[Runner] Teardown error on ${signal}:${RESET}`, err.message);
+  }
+  process.exit(signal === 'SIGINT' ? 130 : 143);
+}
+
+process.on('SIGINT', () => handleTermination('SIGINT'));
+process.on('SIGTERM', () => handleTermination('SIGTERM'));
+
 // Execute Runner
 run().catch(async (err) => {
   console.error(`${RED}${BOLD}Fatal unhandled runner exception:${RESET}`, err);
   try {
+    await harness.cleanDatabase();
     await harness.stopTestEnvironment();
   } catch (_) {}
```

---

### 3.3 Target File 3: `tests/e2e/tier1-features/analytics-kpis.test.js`

#### Description
Add `beforeEach(async () => { await harness.cleanDatabase(); });` to `analytics-kpis.test.js` so that this initial suite guarantees its own isolation even when executed standalone (`node tests/e2e/runner.js -t 1`).

#### Exact Diff
```diff
--- a/tests/e2e/tier1-features/analytics-kpis.test.js
+++ b/tests/e2e/tier1-features/analytics-kpis.test.js
@@ -10,3 +10,7 @@ module.exports = {
 
-  async run({ it, harness, assert }) {
+  async run({ it, beforeEach, harness, assert }) {
+    beforeEach(async () => {
+      await harness.cleanDatabase();
+    });
+
     it('TC-T1-ANL-1: Analytics KPIs endpoint schema contract check (GET /api/v1/analytics/kpis)', async () => {
```

---

### 3.4 Target File 4: `tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js`

#### Description
Add `afterEach(async () => { await harness.cleanDatabase(); });` so that after each 55-consignment seed test completes, the heavy database state is immediately cleaned up rather than lingering in memory.

#### Exact Diff
```diff
--- a/tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js
+++ b/tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js
@@ -12,5 +12,9 @@ module.exports = {
 
-  async run({ it, beforeEach, harness, fixtures, assert }) {
+  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
     beforeEach(async () => {
       await harness.cleanDatabase();
     });
+
+    afterEach(async () => {
+      await harness.cleanDatabase();
+    });
 
```

---

### 3.5 Target File 5: `tests/e2e/tier4-workloads/end-to-end-driver-fulfillment.test.js`

#### Description
Add `afterEach(async () => { await harness.cleanDatabase(); });` to guarantee clean state between driver fulfillment lifecycle assertions and the subsequent reconciliation test.

#### Exact Diff
```diff
--- a/tests/e2e/tier4-workloads/end-to-end-driver-fulfillment.test.js
+++ b/tests/e2e/tier4-workloads/end-to-end-driver-fulfillment.test.js
@@ -12,5 +12,9 @@ module.exports = {
 
-  async run({ it, beforeEach, harness, fixtures, assert }) {
+  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
     beforeEach(async () => {
       await harness.cleanDatabase();
     });
+
+    afterEach(async () => {
+      await harness.cleanDatabase();
+    });
 
```

---

### 3.6 Target File 6: `tests/e2e/tier4-workloads/multi-cluster-dispatch.test.js`

#### Description
Add `afterEach(async () => { await harness.cleanDatabase(); });` to clean up Route and Delivery records immediately after multi-vehicle dispatch optimization finishes.

#### Exact Diff
```diff
--- a/tests/e2e/tier4-workloads/multi-cluster-dispatch.test.js
+++ b/tests/e2e/tier4-workloads/multi-cluster-dispatch.test.js
@@ -14,5 +14,9 @@ module.exports = {
 
-  async run({ it, beforeEach, harness, fixtures, assert }) {
+  async run({ it, beforeEach, afterEach, harness, fixtures, assert }) {
     beforeEach(async () => {
       await harness.cleanDatabase();
     });
+
+    afterEach(async () => {
+      await harness.cleanDatabase();
+    });
 
```

---

### 3.7 Target File 7: `server/src/seed/seedBhubaneswar.js`

#### Description
Add `Route.deleteMany({})` to `seedBhubaneswar.js` collection purge to ensure any lingering route optimization snapshots are cleanly cleared along with other collections.

#### Exact Diff
```diff
--- a/server/src/seed/seedBhubaneswar.js
+++ b/server/src/seed/seedBhubaneswar.js
@@ -7,2 +7,3 @@ const Delivery = require('../models/Delivery');
 const DeliveryBatch = require('../models/DeliveryBatch');
+const Route = require('../models/Route');
 const AuditEvent = require('../models/AuditEvent');
@@ -32,3 +33,4 @@ const seedDatabase = async () => {
       Delivery.deleteMany({}),
       DeliveryBatch.deleteMany({}),
+      Route.deleteMany({}),
       AuditEvent.deleteMany({}),
     ]);
```

---

## 4. Verification and Validation Procedure

The remediation worker can verify the implementation using the following rigorous sequence:

### Step 1: Pre-Condition Collision Reproduction Check
1. Manually insert or seed a conflicting vehicle record into the test database:
   ```bash
   node -e "const mongoose = require('mongoose'); const Vehicle = require('./server/src/models/Vehicle'); mongoose.connect('mongodb://127.0.0.1:27017/smartroute_test').then(async () => { await Vehicle.create({ vehicleId: 'OD-02-AK-1001', makeModel: 'Dirty Test', type: 'Van', capacityKg: 1000, fuelType: 'Diesel', kmPerLitre: 10, availability: 'AVAILABLE' }); await mongoose.disconnect(); console.log('Dirty record inserted'); });"
   ```
2. Execute the E2E test runner:
   ```bash
   node tests/e2e/runner.js
   ```
3. **Expected Result**: Without the startup hook, `runner.js` collides when creating or seeding vehicle `OD-02-AK-1001`. With `await cleanDatabase(connection);` at startup, the dirty record is purged before any suite executes, and all 89 tests pass with exit code 0.

### Step 2: Consecutive Full Suite Runs
Execute two back-to-back full E2E test runs to verify inter-suite and inter-run isolation:
```bash
node tests/e2e/runner.js && node tests/e2e/runner.js
```
**Expected Result**: Both runs complete with 89/89 passed, 0 failed, exit code 0.

### Step 3: Tier 4 Workload Isolation Check
Run Tier 4 workloads in isolation:
```bash
node tests/e2e/runner.js --tier=4
```
**Expected Result**: All 9 Tier 4 tests pass cleanly with 0 collisions and instantaneous collection purge on completion.

### Step 4: Full Server Unit & Integration Check
Verify that backend unit and integration tests remain intact:
```bash
npm run test:server
```
**Expected Result**: 100% pass across baseline test suites.
