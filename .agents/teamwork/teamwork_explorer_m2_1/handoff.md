# Handoff Report: Milestone 2 Mapping & Distance Matrix Subsystem

**Agent ID**: `teamwork_explorer_m2_1`  
**Timestamp**: 2026-11-04T10:20:00Z  
**Target Milestone**: M2 — Mapping, Matrix Services & Route Optimization Engine  
**Recipient**: Parent Orchestrator (`5d522c47-7e56-40f7-90ed-36c6e7d271c1`) and Implementation Worker  
**Handoff Type**: Hard (Investigation complete, technical blueprint produced)  

---

## 1. Observation

1. **Existing Mapping Service Stub**:
   - Inspected `server/src/services/mapping/googleMapsService.js` (lines 34-48):
     ```javascript
     async function getDistanceMatrix(origins, destinations) {
       if (!process.env.GOOGLE_MAPS_API_KEY) {
         // fallback to simulated traffic service
         const sim = require('./simulatedTrafficService');
         return sim.getDistanceMatrix(origins, destinations);
       }
       const url = buildUrl(origins, destinations);
       const response = await axios.get(url);
       if (response.data.status !== 'OK') {
         const err = new Error('Google Maps distance matrix error');
         err.code = response.data.status;
         throw err;
       }
       return response.data;
     }
     ```
   - Observed that `simulatedTrafficService.js` does NOT exist in `server/src/services/mapping/`.
   - Calling `getDistanceMatrix` with `process.env.GOOGLE_MAPS_API_KEY` unset results in `MODULE_NOT_FOUND: Cannot find module './simulatedTrafficService'`.
   - If `GOOGLE_MAPS_API_KEY` is present but the API returns any non-OK status (e.g. `OVER_QUERY_LIMIT`, `REQUEST_DENIED`, or times out), the function throws an unhandled error instead of gracefully falling back to simulation.
   - There is no caching layer implemented; repeated calls with identical coordinates result in redundant API queries.

2. **Seed Data & Canonical Coordinates**:
   - Examined `server/src/config/constants.js` (lines 80-87):
     ```javascript
     const CANONICAL_DEPOT = {
       name: 'Rasulgarh Logistics Hub',
       address: 'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar',
       geo: {
         lat: 20.2961,
         lng: 85.8645,
       },
     };
     ```
   - Examined `server/src/seed/seedBhubaneswar.js` (lines 166-257):
     - Cluster 1: Patia (`Z-1`), baseLat: `20.354`, baseLng: `85.817`
     - Cluster 2: Jaydev Vihar (`Z-2`), baseLat: `20.301`, baseLng: `85.823`
     - Cluster 3: Saheed Nagar (`Z-3`), baseLat: `20.288`, baseLng: `85.852`
     - Cluster 4: Khandagiri (`Z-4`), baseLat: `20.258`, baseLng: `85.787`
     - Cluster 5: Chandrasekharpur, baseLat: `20.325`, baseLng: `85.818` (and Old Town / Lingaraj: `20.2382, 85.8338`)

3. **Current Test Suite Baseline**:
   - Executed `npm test --workspace=server` via Jest runner:
     - 5 test suites ran: `adversarial.test.js`, `adversarial_csv_batch.test.js`, `deliveries.test.js`, `fleet.test.js`, `auth.test.js`.
     - Result: `Test Suites: 5 passed, 5 total; Tests: 63 passed, 63 total`.
     - Exit code: 0.

4. **Mathematical Verification of Canonical Distances**:
   - Executed standalone reference verification script calculating Haversine ($R = 6371$ km), 1.35x curvature, and base durations (25 km/h) from Rasulgarh Hub:
     - **Saheed Nagar (20.288, 85.852)**: Haversine = $1.5845$ km ($1585$ m), Road Distance (1.35x) = $2.1391$ km ($2139$ m), Base Time = $308$ s ($5.13$ min).
     - **Jaydev Vihar (20.301, 85.823)**: Haversine = $4.3622$ km ($4362$ m), Road Distance (1.35x) = $5.8889$ km ($5889$ m), Base Time = $848$ s ($14.13$ min).
     - **Patia / KIIT (20.354, 85.817)**: Haversine = $8.1229$ km ($8123$ m), Road Distance (1.35x) = $10.9659$ km ($10966$ m), Base Time = $1579$ s ($26.32$ min).
     - **Khandagiri (20.258, 85.787)**: Haversine = $9.1264$ km ($9126$ m), Road Distance (1.35x) = $12.3207$ km ($12321$ m), Base Time = $1774$ s ($29.57$ min).
     - **Old Town (20.2382, 85.8338)**: Haversine = $7.1906$ km ($7191$ m), Road Distance (1.35x) = $9.7074$ km ($9707$ m), Base Time = $1398$ s ($23.30$ min).

---

## 2. Logic Chain

1. **Missing Component Causes Crash (Ref: Observation 1)**:
   Because `googleMapsService.js` attempts to `require('./simulatedTrafficService')` when `GOOGLE_MAPS_API_KEY` is not set, any call to the service immediately throws a module resolution error. Therefore, `simulatedTrafficService.js` must be implemented before any route optimization or distance matrix operations can function.

2. **Need for Transparent Error Handling (Ref: Observation 1)**:
   In production logistics, third-party mapping APIs periodically suffer quota limits (`OVER_QUERY_LIMIT`), permission rejections (`REQUEST_DENIED`), and intermittent network latency/timeouts. Rather than throwing uncaught errors that abort batch route optimization runs, `googleMapsService.js` must catch all external API errors and automatically fall back to `simulatedTrafficService.js` with an informative warning log.

3. **Need for In-Memory LRU Matrix Caching (Ref: Observation 1 & 4)**:
   Distance calculations between fixed delivery stops and depot locations are queried repeatedly during route construction (Nearest-Neighbor) and local search improvements (2-Opt). Repeated queries over Google Maps API incur financial cost and latency; repeated Haversine calculations incur CPU cycles. An in-memory cache keyed by normalized coordinate pairs (`${lat.toFixed(5)},${lng.toFixed(5)}`) with a 1-hour TTL and bounded LRU eviction (10,000 max entries) ensures fast lookups ($\mathcal{O}(1)$), zero API quota waste, and bounded memory consumption.

4. **Realistic Bhubaneswar Urban Topography Model (Ref: Observation 2 & 4)**:
   Direct Euclidean or spherical distance underestimates actual road mileage by 20% to 40% due to urban layout, flyovers, and rail crossings. Applying an empirical curvature factor of 1.35x to great-circle Haversine distances yields accurate road kilometers. Combining this with a 25 km/h base speed and 5 realistic traffic multipliers (`FREE_FLOW` 1.0x, `MORNING_RUSH` 1.8x, `EVENING_PEAK` 2.2x, `MONSOON_RAIN` 1.5x, `WEEKEND` 1.1x) produces authentic, explainable duration estimates for all times of day in Bhubaneswar.

5. **Interface Uniformity (Ref: Observation 1 & 4)**:
   To ensure downstream algorithms (Nearest-Neighbor, 2-Opt, Route Cost Scorer) do not need provider-specific branches, both `simulatedTrafficService.js` and `googleMapsService.js` must return the identical matrix envelope containing:
   - `matrix[i][j]`: `{ distanceMeters, distanceKm, durationSeconds, durationMinutes, status }`
   - `rows`: standard Google-compatible element arrays.
   - `source`: `'GOOGLE_MAPS'`, `'CACHE'`, or `'SIMULATED'`.

---

## 3. Caveats

1. **Google Maps Live API Calls**: Live Google Maps calls require an active, billed Google Cloud project with the Distance Matrix API enabled. In test and local development environments without an API key, the service transparently defaults to simulation mode.
2. **Batch Chunking Overhead**: For large fleets ($>100$ origin-destination pairs), Google limits each HTTP request to 100 elements. The specification dictates chunking into $10 \times 10$ sub-batches. When online, this executes multiple parallel HTTP requests.
3. **Simulation Curvature Generality**: The 1.35x curvature multiplier is an empirical average across urban Bhubaneswar. While individual street routes may vary between 1.2x and 1.5x, 1.35x provides an optimal balance for bulk vehicle routing optimization.

---

## 4. Conclusion

The Mapping & Distance Matrix Subsystem design is complete, verified, and documented in `m2_mapping_plan.md`.

The implementation requirements for the worker are partitioned into 4 discrete deliverables:
1. `server/src/config/constants.js` & `server/src/config/env.js`: Register traffic scenario enums, multipliers, and mapping constants.
2. `server/src/services/mapping/matrixCache.js`: LRU cache with 1h TTL, 10,000 entry max bound, 5-minute sweep, and coordinate normalization.
3. `server/src/services/mapping/simulatedTrafficService.js`: Haversine formula ($R = 6371$ km) + 1.35x curvature + 25 km/h base speed + 5 traffic scenario multipliers.
4. `server/src/services/mapping/googleMapsService.js` & `index.js`: Dual-mode facade with timeout, retry backoff, 100-element chunking, cache integration, and transparent fallback.
5. `server/tests/`: Unit and integration test suites validating all formulas, bounds, scenarios, and fallback behaviors.

---

## 5. Verification Method

To independently verify the implementation once applied:

1. **Run Full Server Test Suite**:
   ```bash
   cd server
   npm test
   ```
   **Expected Result**: All existing 63 tests continue to PASS; all new unit/integration tests for `simulatedTrafficService`, `matrixCache`, and `googleMapsService` pass with 0 failures.

2. **Verify Mathematical Accuracy**:
   Inspect unit test assertions for canonical pairs (e.g., Rasulgarh $\to$ Saheed Nagar = $1.5845 \pm 0.005$ km Haversine; Road Distance = $2.1391 \pm 0.005$ km; Free Flow Duration = $308 \pm 2$ s).

3. **Verify Fallback Behavior**:
   Run tests with `process.env.GOOGLE_MAPS_API_KEY = ''` and verify `googleMapsService.getDistanceMatrix` succeeds without throwing, returning `source: 'SIMULATED'`.

4. **Verify Invalidation Conditions**:
   The design is invalidated if:
   - Any scenario multiplier differs from the specification (`FREE_FLOW`: 1.0, `MORNING_RUSH`: 1.8, `EVENING_PEAK`: 2.2, `MONSOON_RAIN`: 1.5, `WEEKEND`: 1.1).
   - Unset or failing Google Maps API key causes an unhandled rejection rather than transparent simulation.
   - Cache memory is unbounded and grows past 10,000 entries under continuous load.
