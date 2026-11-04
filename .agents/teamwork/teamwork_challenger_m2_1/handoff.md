# Adversarial Stress Test & Verification Handoff Report — Milestone 2 Optimization Engine

**Agent**: `teamwork_challenger_m2_1`  
**Role**: Empirical Challenger (`critic`, `specialist`)  
**Target Milestone**: Milestone 2 (Mapping, Matrix Services & Route Optimization Engine)  
**Execution Date**: 2026-11-04  
**Parent Task ID**: `5d522c47-7e56-40f7-90ed-36c6e7d271c1`  

---

## 1. Observation

All stress tests were executed directly in the project test environment using Jest and Node.js. Test assertions and benchmarks were executed against `server/src/services/optimization/` (`matrixBuilder.js`, `binPacker.js`, `nearestNeighbor.js`, `twoOpt.js`, `costScorer.js`, `index.js`) and validated in `server/tests/adversarial_optimizer_stress.test.js`.

### 1.1 Full Test Suite Execution Results
Executing command:
```bash
npm test --prefix server
```
Direct output:
```text
PASS tests/adversarial_mapping_stress.test.js
PASS tests/adversarial.test.js (6.92 s)
PASS tests/routes.test.js
PASS tests/adversarial_csv_batch.test.js
PASS tests/deliveries.test.js
PASS tests/fleet.test.js
PASS tests/auth.test.js
PASS tests/optimization.test.js
PASS tests/adversarial_optimizer_stress.test.js

Test Suites: 9 passed, 9 total
Tests:       146 passed, 146 total
Snapshots:   0 total
Time:        24.263 s
Ran all test suites.
```

### 1.2 Dedicated Adversarial Stress Test Suite (`server/tests/adversarial_optimizer_stress.test.js`)
Executing command:
```bash
npm test --prefix server -- tests/adversarial_optimizer_stress.test.js
```
Console telemetry output:
```text
  console.log
    [TC-ADV-MONO-1] 50 Randomized Runs Complete:
            - Violations: 0 (Target: 0)
            - Runs Improved by 2-Opt: 48 / 50 (96.0%)
            - Total Distance Saved: 390.40 km
            - Max Distance Reduction: 26.61%

  console.log
    [TC-ADV-EV-3 Challenge Result] vehicleTypePreference: 'EV' with mixed fleet (EV: 1000kg, ICE: 600kg):
            - Assigned Vehicle: OD-02-DN-4004 (Diesel)
            - Preference Honored: false (BFD selected smaller capacity ICE over larger EV)

  console.log
    [TC-ADV-CONV-1] Canonical BBSR-EXP-01 (25 stops) Convergence Metrics:
            - Total Execution Duration: 5.34 ms (Threshold: < 500 ms)
            - 2-Opt Iterations: 7 (Threshold: < 1000)
            - Converged: true
            - Baseline Distance: 49.67 km
            - Optimized Distance: 43.901 km
            - Distance Saved: 5.77 km (11.61%)
            - Vehicle Assigned: Tata Ace EV (Electric)
            - Optimized Energy Cost: ₹63.22

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

### 1.3 Key Source Code Observations

1. **Monotonic Guard in `server/src/services/optimization/twoOpt.js` (lines 79–83)**:
```javascript
  // Invariant guarantee: total distance must never exceed initial baseline
  if (totalDistanceKm > initialDistance + 1e-6) {
    tour = [...initialTour];
    totalDistanceKm = initialDistance;
  }
```

2. **Degeneracy Handling in `server/src/services/optimization/twoOpt.js` (lines 22–34)**:
```javascript
  // Handle trivial routes (0 or 1 customer stops: length <= 3)
  if (!initialTour || initialTour.length <= 3) {
    const distance = computeTourDistance(initialTour || [], getDistance);
    const duration = computeTourDuration(initialTour || [], getDuration, points);
    return {
      tourIndices: initialTour ? [...initialTour] : [],
      stopSequence: initialTour && initialTour.length > 2 ? initialTour.slice(1, -1) : [],
      totalDistanceKm: parseFloat(distance.toFixed(3)),
      totalDurationMin: parseFloat(duration.toFixed(2)),
      iterations: 0,
      converged: true,
    };
  }
```

3. **Coordinate Bounds Validation in `server/src/services/optimization/matrixBuilder.js` (lines 64–70)**:
```javascript
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError(
        `Delivery ${delivery.orderReference || delivery._id || delivery.id} has invalid or un-geocoded coordinates`,
        422,
        'UNRESOLVED_GEOCODE'
      );
    }
```

4. **Vehicle Preference Bypass in `server/src/services/optimization/binPacker.js` (lines 51–63 vs 109–122)**:
```javascript
  // Step 1: Sorts vehicles by preference
  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (vehicleTypePreference === 'EV') {
      const aIsEv = a.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      const bIsEv = b.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      if (aIsEv !== bIsEv) return aIsEv - bIsEv;
    } ...
  });
...
  // Step 3: Global BFD evaluation across ALL bins regardless of preference tier:
    let bestBinIndex = -1;
    let minRemainingAfterFit = Infinity;

    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i];
      if (bin.remainingCapacityKg >= weight - 1e-6) {
        const remainingAfter = bin.remainingCapacityKg - weight;
        if (remainingAfter < minRemainingAfterFit) {
          minRemainingAfterFit = remainingAfter;
          bestBinIndex = i;
        }
      }
    }
```
Direct Node execution reproducing the defect:
```bash
node -e "const { packDeliveries } = require('./server/src/services/optimization/binPacker'); const ev = { _id: 'tata-ace-ev', capacityKg: 1000, fuelType: 'Electric' }; const diesel = { _id: 'bajaj-maxima', capacityKg: 600, fuelType: 'Diesel' }; const res = packDeliveries([{ _id: 'd1', weightKg: 200 }], [diesel, ev], { vehicleTypePreference: 'EV' }); console.log('Assigned to:', res.vehicleBins[0].vehicle._id, res.vehicleBins[0].vehicle.fuelType);"
```
Output:
```text
Assigned to: bajaj-maxima Diesel
```

---

## 2. Logic Chain

### 2.1 Tour Degeneracy & Coordinate Guard Integrity (Objective 1)
- **Premise**: Real-world logistics inputs frequently contain empty manifests, single deliveries, two deliveries, or malformed coordinates.
- **Evidence**:
  - `TC-ADV-DEG-1` confirmed that an empty delivery array passed to `buildMatrix` creates a 1x1 depot-only matrix and returns a valid closed tour `[0, 0]` with `totalDistanceKm = 0.0`, `stopSequence = []`, `iterations = 0`, and `converged = true`. Deltas cleanly evaluate to `0.0` distance saved and `0.0%` reduction without NaN or zero division.
  - `TC-ADV-DEG-2` confirmed that a single delivery returns an exact round-trip tour `[0, 1, 0]` with $D = d(0, 1) + d(1, 0) = 17.585\text{ km}$, terminating in 0 iterations.
  - `TC-ADV-DEG-3` confirmed that two deliveries produce a 4-node closed tour `[0, s1, s2, 0]` and that 2-opt successfully reverses sub-optimal pairs in 1 iteration when the alternative permutation is shorter.
  - `TC-ADV-DEG-4` confirmed that coordinates at `(0, 0)` are safely computed, out-of-bounds coordinates (lat < -90, lat > 90, lng < -180, lng > 180), NaN coordinates, infinite coordinates ($\pm \infty$), missing coordinates, and malformed depot coordinates are strictly rejected with `422 UNRESOLVED_GEOCODE` or `400 INVALID_DEPOT_COORDINATES` without unhandled promise rejections.
- **Inference**: The engine is fully degenerate-safe and resilient to malformed geographic inputs.

### 2.2 Monotonic Non-Increasing Distance Invariant (Objective 2)
- **Premise**: Any local search heuristic must never inflate the baseline travel distance: $D_{\text{optimized}} \le D_{\text{baseline}} + \epsilon$.
- **Evidence**:
  - `TC-ADV-MONO-1` generated 50 randomized Bhubaneswar batches (5 to 25 stops) clustered across Patia, Jaydev Vihar, Saheed Nagar, Khandagiri, and Chandrasekharpur.
  - Across all 50 batches, zero violations ($0 / 50$) of $D_{\text{optimized}} \le D_{\text{baseline}} + 10^{-6}$ occurred.
  - 48 out of 50 runs (96.0%) achieved strictly shorter travel distances, with total distance saved exceeding 390.40 km and maximum reduction reaching 26.61%.
  - `twoOpt.js` lines 79–83 enforces a hard programmatic rollback to `initialTour` if $D_{\text{optimized}} > D_{\text{baseline}} + 10^{-6}$, providing mathematical safety against edge cost asymmetries.
- **Inference**: The monotonic non-increasing distance invariant is verified and ironclad.

### 2.3 Capacity & Payload Overflow Boundaries (Objective 3)
- **Premise**: Payload constraints must strictly isolate oversized items and saturated capacity into `unassignedDeliveries`.
- **Evidence**:
  - `TC-ADV-CAP-1` verified that a 1500 kg consignment presented to a 1000 kg fleet is cleanly segregated into `unassignedDeliveries` with `reason: 'EXCEEDS_VEHICLE_MAX_CAPACITY'` without assigning to any vehicle bin.
  - `TC-ADV-CAP-2` verified that when fleet capacity (300 kg) is exhausted by 5 packages of 80 kg (400 kg total), 2 packages are assigned (160 kg) and the remaining 3 packages are segregated with `reason: 'CAPACITY_OVERFLOW'`.
  - `TC-ADV-CAP-3` confirmed that a 500.00 kg package achieves 100.0% utilization with 0.00 kg remaining capacity, while a subsequent 0.01 kg overflow is rejected.
  - `TC-ADV-CAP-4` verified that an empty fleet cleanly segregates 100% of deliveries with `reason: 'NO_AVAILABLE_VEHICLES'`.
- **Inference**: Payload capacity boundary enforcement is strictly preserved.

### 2.4 EV Preference & Priority Scheduling (Objective 4 & Algorithmic Defect)
- **Premise**: Users selecting `vehicleTypePreference: 'EV'` require consignments to be packed onto electric vehicles before internal combustion engine (ICE) vehicles.
- **Evidence**:
  - `TC-ADV-EV-1` confirmed that in the canonical fleet (Tata Ace EV 1000 kg vs Mahindra Bolero Diesel 1200 kg), a 400 kg package is assigned to Tata Ace EV.
  - `TC-ADV-EV-2` confirmed that EV routing outputs strictly 0.0 g CO2/km tailpipe emissions and ₹1.44/km operating cost vs ₹7.60/km for Diesel.
  - `TC-ADV-PRIO-1` confirmed that when 3 equidistant candidates (5.0 km) compete, Nearest-Neighbor visits `COLD_CHAIN` (3) first, `URGENT` (2) second, and `STANDARD` (1) third (`[0, 3, 2, 1, 0]`).
  - `TC-ADV-PRIO-2` confirmed that BinPacker prioritizes packing `COLD_CHAIN` before capacity exhausts.
  - **DEFECT (`VULN-OPT-01`)**: `TC-ADV-EV-3` proved that in `binPacker.js`, Step 1 vehicle sorting is completely disregarded by Step 3's Best-Fit Decreasing loop. When Tata Ace EV (1000 kg) is paired with Bajaj Maxima Diesel (600 kg), BFD assigns a 200 kg consignment to Bajaj Maxima Diesel because $600 - 200 = 400 < 1000 - 200 = 800$. The EV preference is silently subverted whenever an ICE vehicle in the fleet has smaller capacity than the EV.
- **Inference**: While priority scheduling and canonical fleet EV preference pass, multi-vehicle fleet bin packing contains an architectural defect that violates the propulsion preference strategy when vehicle capacities vary.

### 2.5 Large Batch Convergence & Performance (Objective 5)
- **Premise**: Real-time dispatch requires sub-500ms convergence on the canonical 25-stop Bhubaneswar morning express batch `BBSR-EXP-01`.
- **Evidence**:
  - `TC-ADV-CONV-1` ran the end-to-end pipeline (bin packing -> 26x26 matrix generation -> Nearest Neighbor TSP -> Bounded 2-Opt -> dual propulsion cost scoring -> savings deltas).
  - Algorithm converged in **7 iterations** (Limit: < 1000).
  - Wall-clock execution time was **5.34 ms**, which is **93.6 times faster** than the 500 ms SLA.
  - Baseline distance: 49.67 km; Optimized distance: 43.901 km; Net savings: 5.77 km (11.61% reduction); Energy cost: ₹63.22.
- **Inference**: Convergence speed and algorithmic scaling are exceptional and well within production thresholds.

---

## 3. Caveats

1. **Traffic Matrix Scope**: Stress testing utilized the deterministic 5-scenario simulation engine (`simulatedTrafficService.js`) with Haversine distance, urban road curvature factor (1.35x), and scenario multipliers (1.0x to 1.8x). Real Google Maps Platform live API requests were mocked to prevent external API quota consumption during continuous testing.
2. **Single-Depot Topology**: Tests were scoped to single-depot dispatch centered at Rasulgarh Central Hub (`20.2961, 85.8645`). Multi-depot vehicle routing (MDVRP) is out of scope for Milestone 2.
3. **Time Window Soft Enforcement**: In the current M2 implementation, consignment delivery time windows are tracked and accumulated in route ETAs, but hard time-window penalty rejection (TW-VRP) is deferred to Milestone 3 dispatch sequencing.

---

## 4. Conclusion & Recommended Remediation

### Explicit Verdict
**`VERDICT: REQUEST_CHANGES`**

### Rationale
Although the Route Optimization Engine successfully passes 4 of the 5 objectives and strictly satisfies the canonical demonstration batch on Rasulgarh `BBSR-EXP-01`, empirical stress testing uncovered a high-severity algorithmic defect (`VULN-OPT-01`) in `server/src/services/optimization/binPacker.js`.

Specifically, `binPacker.js` applies raw Best-Fit Decreasing across all fleet vehicles simultaneously without tiering by preferred propulsion type. Consequently, whenever an ICE vehicle in the fleet has smaller capacity than an available EV (e.g. Bajaj Maxima 600 kg vs Tata Ace EV 1000 kg), the algorithm silently routes deliveries to the diesel vehicle even when the user explicitly requests `vehicleTypePreference: 'EV'`.

### Remediation Blueprint for Worker
In `server/src/services/optimization/binPacker.js`, update lines 109–125 to tier candidate vehicle search by propulsion preference before evaluating non-preferred vehicles:

```javascript
    // Tiered Best-Fit Decreasing: Search preferred vehicles first
    let bestBinIndex = -1;
    let minRemainingAfterFit = Infinity;

    // Helper: evaluate bins for best fit
    const evaluateBins = (binList) => {
      let selectedIdx = -1;
      let minRemaining = Infinity;
      for (const idx of binList) {
        const bin = bins[idx];
        if (bin.remainingCapacityKg >= weight - 1e-6) {
          const remainingAfter = bin.remainingCapacityKg - weight;
          if (remainingAfter < minRemaining) {
            minRemaining = remainingAfter;
            selectedIdx = idx;
          }
        }
      }
      return { selectedIdx, minRemaining };
    };

    if (vehicleTypePreference === 'EV' || vehicleTypePreference === 'ICE') {
      const preferredIndices = [];
      const nonPreferredIndices = [];

      for (let i = 0; i < bins.length; i++) {
        const isPref = vehicleTypePreference === 'EV'
          ? bins[i].vehicle.fuelType === FUEL_TYPES.ELECTRIC
          : bins[i].vehicle.fuelType !== FUEL_TYPES.ELECTRIC;
        if (isPref) preferredIndices.push(i);
        else nonPreferredIndices.push(i);
      }

      // Check preferred tier first
      const prefFit = evaluateBins(preferredIndices);
      if (prefFit.selectedIdx !== -1) {
        bestBinIndex = prefFit.selectedIdx;
      } else {
        // Fall back to non-preferred tier only when preferred bins cannot fit
        const fallbackFit = evaluateBins(nonPreferredIndices);
        if (fallbackFit.selectedIdx !== -1) {
          bestBinIndex = fallbackFit.selectedIdx;
        }
      }
    } else {
      // Standard Best-Fit Decreasing across all bins
      const allIndices = bins.map((_, i) => i);
      const fit = evaluateBins(allIndices);
      bestBinIndex = fit.selectedIdx;
    }
```

---

## 5. Verification Method

To independently verify all findings and test suites:

1. **Run full regression suite (146 tests across 9 files)**:
   ```powershell
   npm test --prefix server
   ```
   *Expected Result*: All 9 test suites pass with code 0.

2. **Run dedicated adversarial stress test suite**:
   ```powershell
   npm test --prefix server -- tests/adversarial_optimizer_stress.test.js
   ```
   *Expected Result*: All 15 tests pass, with telemetry proving 0 monotonic violations across 50 runs, sub-6ms execution on 25-stop canonical batch, and console output capturing the `VULN-OPT-01` capacity inversion behavior in `TC-ADV-EV-3`.

3. **Verify the capacity inversion defect empirically in Node**:
   ```powershell
   node -e "const { packDeliveries } = require('./server/src/services/optimization/binPacker'); const ev = { _id: 'tata-ace-ev', capacityKg: 1000, fuelType: 'Electric' }; const diesel = { _id: 'bajaj-maxima', capacityKg: 600, fuelType: 'Diesel' }; const res = packDeliveries([{ _id: 'd1', weightKg: 200 }], [diesel, ev], { vehicleTypePreference: 'EV' }); console.log('Assigned to:', res.vehicleBins[0].vehicle._id, res.vehicleBins[0].vehicle.fuelType);"
   ```
   *Observed Bug*: Outputs `Assigned to: bajaj-maxima Diesel` instead of `tata-ace-ev Electric`.
