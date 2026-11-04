# Remediation Plan: Finding 2 — Defensive Input Guard Gap in `googleMapsService.js`

**Milestone:** 2 (Iteration 2)  
**Author:** `teamwork_explorer_m2_it2_2`  
**Target Source:** `server/src/services/mapping/googleMapsService.js`  
**Target Test:** `server/tests/adversarial_mapping_stress.test.js`  
**Timestamp:** 2026-11-04T11:03:00Z  

---

## 1. Executive Summary

During Milestone 2 review and adversarial stress auditing, a defensive input validation gap was identified in `server/src/services/mapping/googleMapsService.js` (Finding 2). 

The facade entry point `googleMapsService.getDistanceMatrix` executes:
```javascript
const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
```
without verifying that `origins` and `destinations` are valid, non-empty arrays.

### Defect Impact:
1. **Unhandled TypeError**: If `origins` or `destinations` is `null`, `undefined`, or a non-array object, `.map()` immediately throws an unhandled `TypeError` (`"Cannot read properties of null (reading 'map')"` or `"origins.map is not a function"`). This diverges from `simulatedTrafficService.js`, which cleanly validates inputs and throws descriptive errors: `"Origins must be a non-empty array"` and `"Destinations must be a non-empty array"`.
2. **Silent Empty Payload / Cache Bypass Vulnerability**: If `origins` is an empty array `[]` and `GOOGLE_MAPS_API_KEY` is configured in the environment, `allCached` evaluates to `true` (since the loop over `normOrigins` executes 0 iterations). The service immediately returns `{ source: 'CACHE', status: 'OK', matrix: [], rows: [] }` rather than rejecting the invalid request.
3. **Chunking Malformation**: If `skipCache: true` is supplied with an empty array under an active API key, the chunking loop attempts to construct URL queries with empty strings, triggering unhandled upstream Google API errors.

### Remediation Objective:
Formulate an exact, zero-regression technical patch that adds defensive array validation matching `simulatedTrafficService.js:116-121` at the entry of `googleMapsService.getDistanceMatrix`, and harden adversarial test `TC-ADV-MAP-RESIL-8` to lock in parity across both services.

---

## 2. Problem Analysis & Architectural Trace

### 2.1 Interface Contract Definition
According to `PROJECT.md` (Interface Contracts §3):
```typescript
IMappingService.getDistanceMatrix(origins: Coordinate[], destinations: Coordinate[]): Promise<MatrixResult>
```
The contract specifies that both `origins` and `destinations` must be arrays of coordinates.

### 2.2 Inconsistent Behavior Comparison

| Input Condition | `simulatedTrafficService.js` (Reference) | `googleMapsService.js` (Current) | `googleMapsService.js` (Remediated) |
|---|---|---|---|
| `origins = null` | Throws `Error('Origins must be a non-empty array')` | Throws `TypeError: Cannot read properties of null (reading 'map')` | Throws `Error('Origins must be a non-empty array')` |
| `origins = undefined` | Throws `Error('Origins must be a non-empty array')` | Throws `TypeError: Cannot read properties of undefined (reading 'map')` | Throws `Error('Origins must be a non-empty array')` |
| `origins = []` (no API key) | Throws `Error('Origins must be a non-empty array')` | Falls back to simulated service -> throws `'Origins must be a non-empty array'` | Throws `Error('Origins must be a non-empty array')` |
| `origins = []` (with API key) | Throws `Error('Origins must be a non-empty array')` | Returns `{ source: 'CACHE', matrix: [], rows: [] }` (Silent bypass!) | Throws `Error('Origins must be a non-empty array')` |
| `origins = {}` (not array) | Throws `Error('Origins must be a non-empty array')` | Throws `TypeError: origins.map is not a function` | Throws `Error('Origins must be a non-empty array')` |
| `destinations = null` | Throws `Error('Destinations must be a non-empty array')` | Throws `TypeError: Cannot read properties of null (reading 'map')` | Throws `Error('Destinations must be a non-empty array')` |
| `destinations = []` (with API key) | Throws `Error('Destinations must be a non-empty array')` | Returns `{ source: 'CACHE', matrix: [[]], rows: [{ elements: [] }] }` | Throws `Error('Destinations must be a non-empty array')` |

### 2.3 Comprehensive Call-Site Audit

Every call site across the SmartRoute codebase was audited to ensure zero regressions:

1. **`server/src/services/mapping/index.js` (Line 12)**:
   ```javascript
   getDistanceMatrix: googleMapsService.getDistanceMatrix,
   ```
   *Impact*: Acts as the primary facade export. Adding input validation ensures any external consumer of the `mapping` module receives consistent error messages.

2. **`server/src/services/optimization/matrixBuilder.js` (Lines 82-90)**:
   ```javascript
   const origins = points.map(p => ({ lat: p.lat, lng: p.lng }));
   const destinations = origins;
   const matrixResult = await googleMapsService.getDistanceMatrix(origins, destinations, { ... });
   ```
   *Impact*: `points` always contains `CANONICAL_DEPOT` at index 0 (`points.length >= 1`). Valid matrix assembly is guaranteed non-empty. Invalid depot coordinates are rejected earlier at lines 42-45 with HTTP 400 `INVALID_DEPOT_COORDINATES`.

3. **`server/src/controllers/routeController.js`**:
   `optimizeRoute` verifies `eligibleDeliveries.length === 0` and returns HTTP 400 `NO_DELIVERIES_TO_OPTIMIZE` prior to invoking `matrixBuilder.js`. Zero possibility of an empty batch reaching mapping.

4. **Existing Test Suites**:
   - `server/tests/optimization.test.js`: All matrix tests (`TC-MAP-SIM-5`, `TC-MAP-GMS-1`, `TC-MAP-GMS-2`, `TC-OPT-MAT-1`) pass non-empty arrays.
   - `server/tests/adversarial_mapping_stress.test.js`: Lines 122, 280, 318, 344, 370, 396, 456, 512, 564 all pass non-empty coordinate arrays.
   - `server/tests/adversarial_mapping_stress.test.js:576-590` (`TC-ADV-MAP-RESIL-8`): Specifically tests invalid/empty arrays. Currently only expects `rejects.toThrow()`. Hardening this assertion locks in descriptive parity.

---

## 3. Exact Technical Fix Specification

### 3.1 Target File: `server/src/services/mapping/googleMapsService.js`

**Location**: Lines 78–85

#### Before:
```javascript
/**
 * Retrieves Distance Matrix with dual-mode fallback and caching.
 * @param {Array} origins
 * @param {Array} destinations
 * @param {Object} options - { scenario, trafficScenario, forceSimulation, skipCache }
 * @returns {Promise<Object>}
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  const scenario = options.scenario || options.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!options.skipCache;
  const forceSimulation = !!options.forceSimulation;

  const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
  const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
```

#### After:
```javascript
/**
 * Retrieves Distance Matrix with dual-mode fallback and caching.
 * @param {Array} origins
 * @param {Array} destinations
 * @param {Object} options - { scenario, trafficScenario, forceSimulation, skipCache }
 * @returns {Promise<Object>}
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('Origins must be a non-empty array');
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('Destinations must be a non-empty array');
  }

  const opts = options || {};
  const scenario = opts.scenario || opts.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!opts.skipCache;
  const forceSimulation = !!opts.forceSimulation;

  const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
  const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
```

#### Downstream Reference Update:
Lines 89 and 211 pass `options` to `simulatedTrafficService.getDistanceMatrix`. Using `opts` guarantees that passing `null` as options does not throw `TypeError: Cannot read properties of null`:
- Line 89: `return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);`
- Line 211: `return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);`

#### Line-by-Line Unified Diff:
```diff
--- a/server/src/services/mapping/googleMapsService.js
+++ b/server/src/services/mapping/googleMapsService.js
@@ -78,9 +78,17 @@ const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
 async function getDistanceMatrix(origins, destinations, options = {}) {
+  if (!Array.isArray(origins) || origins.length === 0) {
+    throw new Error('Origins must be a non-empty array');
+  }
+  if (!Array.isArray(destinations) || destinations.length === 0) {
+    throw new Error('Destinations must be a non-empty array');
+  }
+
+  const opts = options || {};
-  const scenario = options.scenario || options.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
-  const skipCache = !!options.skipCache;
-  const forceSimulation = !!options.forceSimulation;
+  const scenario = opts.scenario || opts.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
+  const skipCache = !!opts.skipCache;
+  const forceSimulation = !!opts.forceSimulation;
 
   const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
   const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
@@ -88,3 +96,3 @@ async function getDistanceMatrix(origins, destinations, options = {}) {
   if (forceSimulation || !apiKey || apiKey.trim() === '' || apiKey === 'mock_key') {
-    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, options);
+    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);
   }
@@ -210,3 +218,3 @@ async function getDistanceMatrix(origins, destinations, options = {}) {
     console.warn(`[GoogleMapsService] Network/Quota Error (${err.message}). Falling back to simulated traffic service.`);
-    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, options);
+    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);
   }
```

---

## 4. Adversarial Test Hardening Plan

### 4.1 Target File: `server/tests/adversarial_mapping_stress.test.js`

**Location**: Lines 576–590 (`TC-ADV-MAP-RESIL-8`)

#### Before:
```javascript
    test('TC-ADV-MAP-RESIL-8: Empty or invalid input arrays handling in simulatedTrafficService vs facade', async () => {
      // 1. simulatedTrafficService rejects empty/null arrays with descriptive errors
      await expect(simulatedTrafficService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
        .rejects.toThrow('Destinations must be a non-empty array');

      // 2. googleMapsService facade throws on null origins
      await expect(googleMapsService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow();
    });
```

#### After:
```javascript
    test('TC-ADV-MAP-RESIL-8: Empty or invalid input arrays handling in simulatedTrafficService vs facade', async () => {
      // 1. simulatedTrafficService rejects empty/null arrays with descriptive errors
      await expect(simulatedTrafficService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
        .rejects.toThrow('Destinations must be a non-empty array');

      // 2. googleMapsService facade rejects empty/null/invalid arrays with exact matching descriptive errors
      await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix('not-an-array', [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], 12345))
        .rejects.toThrow('Destinations must be a non-empty array');

      // 3. Defensive check prevents silent empty return even when GOOGLE_MAPS_API_KEY is present
      const prevKey = process.env.GOOGLE_MAPS_API_KEY;
      try {
        process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyMockKeyForDefensiveTesting';
        await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
          .rejects.toThrow('Origins must be a non-empty array');
        await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
          .rejects.toThrow('Destinations must be a non-empty array');
      } finally {
        process.env.GOOGLE_MAPS_API_KEY = prevKey;
      }
    });
```

#### Line-by-Line Unified Diff:
```diff
--- a/server/tests/adversarial_mapping_stress.test.js
+++ b/server/tests/adversarial_mapping_stress.test.js
@@ -586,5 +586,28 @@ describe('Empirical Adversarial Stress Test Suite: Mapping & Distance Matrix Sub
-      // 2. googleMapsService facade throws on null origins
-      await expect(googleMapsService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
-        .rejects.toThrow();
+      // 2. googleMapsService facade rejects empty/null/invalid arrays with exact matching descriptive errors
+      await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
+        .rejects.toThrow('Origins must be a non-empty array');
+      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
+        .rejects.toThrow('Destinations must be a non-empty array');
+      await expect(googleMapsService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
+        .rejects.toThrow('Origins must be a non-empty array');
+      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
+        .rejects.toThrow('Destinations must be a non-empty array');
+      await expect(googleMapsService.getDistanceMatrix('not-an-array', [{ lat: 20, lng: 85 }]))
+        .rejects.toThrow('Origins must be a non-empty array');
+      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], 12345))
+        .rejects.toThrow('Destinations must be a non-empty array');
+
+      // 3. Defensive check prevents silent empty return even when GOOGLE_MAPS_API_KEY is present
+      const prevKey = process.env.GOOGLE_MAPS_API_KEY;
+      try {
+        process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyMockKeyForDefensiveTesting';
+        await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
+          .rejects.toThrow('Origins must be a non-empty array');
+        await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
+          .rejects.toThrow('Destinations must be a non-empty array');
+      } finally {
+        process.env.GOOGLE_MAPS_API_KEY = prevKey;
+      }
     });
```

---

## 5. Implementation Worker Runbook

The remediation worker should execute the following sequence:

1. **Apply Source Patch**:
   - Edit `server/src/services/mapping/googleMapsService.js`.
   - Insert array validations and options fallback at lines 78–85.
   - Update `options` -> `opts` in fallback calls.

2. **Apply Test Hardening**:
   - Edit `server/tests/adversarial_mapping_stress.test.js`.
   - Update `TC-ADV-MAP-RESIL-8` at lines 576–590 with the hardened assertions.

3. **Execute Targeted Verification**:
   ```powershell
   npm test --workspace=server -- tests/adversarial_mapping_stress.test.js
   ```
   *Expected Outcome*: 22/22 tests PASS in < 3s with exit code 0.

4. **Execute Full Suite Verification**:
   ```powershell
   npm test --workspace=server
   ```
   *Expected Outcome*: All server test suites PASS.

---

## 6. Zero-Regression & Safety Checklist

- [x] **No API Signature Breaking Changes**: `getDistanceMatrix(origins, destinations, options)` signature, parameter order, and return type remain unchanged.
- [x] **No Valid Input Breaking Changes**: Any valid array of coordinates continues through `simulatedTrafficService.normalizeCoord` and caching as before.
- [x] **Strict Parity**: Error strings `'Origins must be a non-empty array'` and `'Destinations must be a non-empty array'` match character-for-character with `simulatedTrafficService.js:117,120`.
- [x] **Vulnerability Neutralized**: `allCached` cannot evaluate to true on empty input arrays because empty arrays are rejected before reaching cache evaluation.
- [x] **Layout Compliant**: No files created in `server/src/` by this explorer agent; all documentation isolated in `.agents/teamwork/teamwork_explorer_m2_it2_2/`.
