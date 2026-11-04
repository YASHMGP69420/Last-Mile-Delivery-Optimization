# Milestone 2 Iteration 2 Explorer Handoff: Google Maps Input Guard Remediation Plan

**Author:** `teamwork_explorer_m2_it2_2`  
**Role:** Explorer, Investigator  
**Target:** Finding 2 (Advisory/Defensive Input Guard Gap in `googleMapsService.js`)  
**Parent Agent:** `5d522c47-7e56-40f7-90ed-36c6e7d271c1`  
**Timestamp:** 2026-11-04T11:05:00Z  

---

## 1. Observation

Direct observations and evidence from code analysis and test execution:

1. **Defensive Validation Discrepancy between Facade and Implementation**:
   - `server/src/services/mapping/simulatedTrafficService.js`, lines 116–121:
     ```javascript
     if (!Array.isArray(origins) || origins.length === 0) {
       throw new Error('Origins must be a non-empty array');
     }
     if (!Array.isArray(destinations) || destinations.length === 0) {
       throw new Error('Destinations must be a non-empty array');
     }
     ```
   - `server/src/services/mapping/googleMapsService.js`, lines 78–85:
     ```javascript
     async function getDistanceMatrix(origins, destinations, options = {}) {
       const scenario = options.scenario || options.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
       const skipCache = !!options.skipCache;
       const forceSimulation = !!options.forceSimulation;

       const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
       const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
     ```
     `origins` and `destinations` are mapped without prior array or non-empty validation.

2. **Verbatim Error on Null/Undefined/Non-Array Input**:
   - In `teamwork_reviewer_m2_1/handoff.md:49-63`:
     ```
     ● Empirical Adversarial Stress Test Suite: Mapping & Distance Matrix Subsystem › 3. Resilience, Error Handling & Facade Fallbacks › TC-ADV-MAP-RESIL-8: Empty or invalid input arrays throw descriptive validation errors

     expect(received).rejects.toThrow(expected)

     Expected substring: "Origins must be a non-empty array"
     Received message:   "Cannot read properties of null (reading 'map')"

           81 |   const forceSimulation = !!options.forceSimulation;
           82 |
         > 83 |   const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
              |                               ^
           84 |   const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);
     ```

3. **Silent Bypass Behavior with Active API Key on Empty Arrays (`[]`)**:
   - In `server/src/services/mapping/googleMapsService.js`, lines 93–130:
     If `origins = []`, `normOrigins.length === 0`.
     The loop `for (let i = 0; i < normOrigins.length; i++)` performs 0 iterations.
     `allCached` remains `true`.
     Lines 119–130 execute:
     ```javascript
     if (allCached) {
       return {
         source: 'CACHE',
         scenario,
         origins: normOrigins,
         destinations: normDestinations,
         origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
         destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
         matrix: cachedMatrix,
         rows: cachedRows,
         status: 'OK',
       };
     }
     ```
     This silently returns `{ source: 'CACHE', status: 'OK', matrix: [], rows: [] }` rather than rejecting the invalid request.

4. **Call Site and Caller Invariant Verification**:
   - `server/src/services/mapping/index.js:12` exposes `googleMapsService.getDistanceMatrix` as the primary facade entry point `getDistanceMatrix`.
   - `server/src/services/optimization/matrixBuilder.js:86` calls `googleMapsService.getDistanceMatrix(origins, destinations, ...)`. `points` is guaranteed to contain `CANONICAL_DEPOT` at index 0 (`points.length >= 1`), so valid route optimization requests never pass empty arrays.
   - `server/src/controllers/routeController.js` validates `eligibleDeliveries.length === 0` and returns HTTP 400 before invoking `matrixBuilder.js`.

5. **Adversarial Test Suite State (`server/tests/adversarial_mapping_stress.test.js`)**:
   - Running `npm test --workspace=server -- tests/adversarial_mapping_stress.test.js` passes 22/22 tests, because `TC-ADV-MAP-RESIL-8` was temporarily relaxed to `expect(googleMapsService.getDistanceMatrix(null, ...)).rejects.toThrow()`, which masked the `TypeError`.

---

## 2. Logic Chain

1. **Interface Symmetry & Defense-in-Depth (Observation 1.1 & 1.4)**:
   - `googleMapsService` and `simulatedTrafficService` are dual providers under the same `IMappingService` contract (`PROJECT.md:104`).
   - `googleMapsService.getDistanceMatrix` is exported as the top-level facade in `server/src/services/mapping/index.js`.
   - Therefore, consumers invoking `mapping.getDistanceMatrix` expect identical error handling and contract validation whether the request is simulated or processed by Google Maps.

2. **Root Cause of TypeError and Vulnerability (Observations 1.1, 1.2, 1.3)**:
   - Line 83 invokes `.map()` directly on `origins`. When `origins` is null, undefined, or not an array, JavaScript runtime throws `TypeError`.
   - When `origins` is `[]`, `.map()` succeeds, creating `normOrigins = []`.
   - If an API key is present, lines 93–119 iterate over `normOrigins`. With 0 items, `allCached` never gets set to `false`. The method terminates early with a 200/OK cache payload of empty matrices.
   - Thus, input validation must occur before normalization, cache evaluation, or API key branching.

3. **Placement and Behavior of Defensive Guard (Observations 1.1 & 1.3)**:
   - Inserting:
     ```javascript
     if (!Array.isArray(origins) || origins.length === 0) {
       throw new Error('Origins must be a non-empty array');
     }
     if (!Array.isArray(destinations) || destinations.length === 0) {
       throw new Error('Destinations must be a non-empty array');
     }
     ```
     at the very start of `googleMapsService.getDistanceMatrix` guarantees:
     - Null, undefined, empty array, or non-array values reject immediately with the exact same error string as `simulatedTrafficService.js`.
     - Zero possibility of reaching cache evaluation or Google Maps query loops with empty inputs.
     - Because `getDistanceMatrix` is an `async` function, thrown errors are automatically wrapped in a rejected Promise, matching Jest `.rejects.toThrow(...)` expectations.

4. **Zero Regression for Valid Callers (Observation 1.4)**:
   - Legitimate callers (`matrixBuilder.js`, `optimization.test.js`, valid test scenarios) always supply non-empty arrays with coordinates.
   - Valid inputs pass the check in $O(1)$ time and proceed through existing normalization and caching without modification.

5. **Adversarial Test Suite Hardening (Observations 1.2 & 1.5)**:
   - Strengthening `TC-ADV-MAP-RESIL-8` in `server/tests/adversarial_mapping_stress.test.js` to assert exact error strings across `[]`, `null`, `undefined`, invalid types, and an active `GOOGLE_MAPS_API_KEY` prevents regression.

---

## 3. Caveats

1. **Read-Only Explorer Scope Honored**: As mandated by explorer constraints, no edits were made directly to `server/src/`. All technical designs and line-by-line diffs are documented in `m2_it2_mapping_guard_remediation.md` for execution by the remediation worker.
2. **Mocked API Key in Testing**: Google Maps Platform live API calls are mocked in the test environment (using Axios mocks / spies). Live calls against Google's billing endpoint were not executed.
3. **Finding 1 Decoupling**: Finding 1 (BinPacker `vehicleTypePreference` best-fit comparator inversion) is tracked separately and does not affect mapping services.

---

## 4. Conclusion

The technical remediation plan for Finding 2 is complete, verified, and ready for worker implementation:

- **Root Cause**: Missing array and emptiness validation in `googleMapsService.getDistanceMatrix` before calling `.map()`.
- **Target File**: `server/src/services/mapping/googleMapsService.js` (lines 78–85).
- **Solution**: Prepend defensive validation guards matching `simulatedTrafficService.js:116-121` and normalize options handling with `opts = options || {}`.
- **Test Hardening**: Expand `server/tests/adversarial_mapping_stress.test.js:576-590` (`TC-ADV-MAP-RESIL-8`) to verify exact error message parity and guard against silent empty CACHE return under active API keys.
- **Remediation Specification**: Written to `m2_it2_mapping_guard_remediation.md` with exact line numbers and unified diffs.

---

## 5. Verification Method

To independently verify the proposed remediation after worker application:

1. **Execute Mapping Adversarial Stress Test Suite**:
   ```powershell
   npm test --workspace=server -- tests/adversarial_mapping_stress.test.js
   ```
   *Expected Outcome*: 22/22 tests PASS in < 3.0s, including hardened `TC-ADV-MAP-RESIL-8`.

2. **Execute Optimization Test Suite**:
   ```powershell
   npm test --workspace=server -- tests/optimization.test.js
   ```
   *Expected Outcome*: 32/32 tests PASS.

3. **Execute Full Server Test Suite**:
   ```powershell
   npm test --workspace=server
   ```
   *Expected Outcome*: All test suites pass.

4. **Invalidation Conditions**:
   - `googleMapsService.getDistanceMatrix(null, ...)` throwing `TypeError` instead of `Error('Origins must be a non-empty array')`.
   - `googleMapsService.getDistanceMatrix([], ...)` returning `{ source: 'CACHE', status: 'OK' }` when `GOOGLE_MAPS_API_KEY` is set.
   - Any regression in `matrixBuilder.js` or `optimization.test.js`.
