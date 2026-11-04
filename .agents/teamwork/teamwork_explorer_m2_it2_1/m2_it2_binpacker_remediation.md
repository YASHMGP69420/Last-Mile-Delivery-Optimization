# Technical Remediation Blueprint: Tiered Best-Fit Decreasing Allocation (VULN-OPT-01)

**Document ID**: `SR-REMED-M2-IT2-OPT-01`  
**Author**: `teamwork_explorer_m2_it2_1`  
**Target Milestone**: Milestone 2 Iteration 2 (Mapping, Matrix Services & Route Optimization Engine)  
**Parent Task ID**: `5d522c47-7e56-40f7-90ed-36c6e7d271c1`  
**Target Source File**: `server/src/services/optimization/binPacker.js`  
**Target Test File**: `server/tests/adversarial_optimizer_stress.test.js`  
**Date**: 2026-11-04  

---

## 1. Executive Summary & Defect Overview

During Milestone 2 adversarial stress testing and verification review, an algorithmic bypass vulnerability (**`VULN-OPT-01`**) was uncovered in `server/src/services/optimization/binPacker.js`.

### 1.1 Problem Statement
When a user specifies `vehicleTypePreference: 'EV'` (or `'ICE'`), `binPacker.js` sorts the vehicle array in Step 1 so that preferred vehicles appear first. However, Step 3 executes a single un-tiered Best-Fit Decreasing (BFD) loop across all bins simultaneously:
$$\text{remainingAfter} = \text{bin.remainingCapacityKg} - \text{weight}$$
Because the algorithm unconditionally selects the bin with the absolute smallest `remainingAfter`, any internal combustion engine (ICE) vehicle in the fleet that has a smaller remaining capacity than an available EV (e.g. Bajaj Maxima 600 kg vs Tata Ace EV 1000 kg) will be selected over the EV—even when the EV has ample capacity to carry the consignment.

### 1.2 Impact
- **Business Rule Violation**: Dispatchers requesting electric delivery fleets to meet green fleet ESG goals or zero-emission mandates in municipal Bhubaneswar zones (Rasulgarh, Jaydev Vihar) have parcels silently diverted to diesel/petrol vehicles.
- **Tailpipe Carbon & Operating Cost Discrepancy**: Consignments routed to diesel emit ~210 g CO2/km and cost ₹7.60/km instead of 0 g CO2/km and ₹1.44/km on electric propulsion.
- **Symmetric Defect**: The exact same bypass occurs when `vehicleTypePreference: 'ICE'` is requested and an EV in the fleet has a smaller remaining capacity than an ICE truck (causing an unexpected assignment to EV).

### 1.3 Remediation Objective
Formulate and deliver the exact **Tiered Best-Fit Decreasing (T-BFD)** algorithm:
1. Candidate bins must be partitioned into priority tiers based on `vehicleTypePreference`.
2. For each delivery (ordered by cold-chain/urgency priority, then descending weight), candidate bins in the **preferred tier** must be evaluated first.
3. The algorithm must only evaluate bins in the **fallback non-preferred tier** when **no** bin in the preferred tier can accommodate the consignment's weight.
4. If neither tier has sufficient capacity, the parcel must be cleanly segregated into `unassignedDeliveries` with `reason: 'CAPACITY_OVERFLOW'`.
5. Pre-existing invariants—such as individual consignment fleet-maximum limits (`EXCEEDS_VEHICLE_MAX_CAPACITY`), cold-chain priority tie-breaking, deterministic tie-breaking, floating-point tolerance ($10^{-6}$), and multi-vehicle packing—must be fully preserved.

---

## 2. Root Cause Analysis (RCA)

### 2.1 Code Audit of `server/src/services/optimization/binPacker.js`

In `server/src/services/optimization/binPacker.js`:

#### Step 1: Vehicle Sorting (lines 51–63)
```javascript
// 1. Sort vehicles according to strategy
const sortedVehicles = [...vehicles].sort((a, b) => {
  if (vehicleTypePreference === 'EV') {
    const aIsEv = a.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
    const bIsEv = b.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
    if (aIsEv !== bIsEv) return aIsEv - bIsEv;
  } else if (vehicleTypePreference === 'ICE') {
    const aIsIce = a.fuelType !== FUEL_TYPES.ELECTRIC ? 0 : 1;
    const bIsIce = b.fuelType !== FUEL_TYPES.ELECTRIC ? 0 : 1;
    if (aIsIce !== bIsIce) return aIsIce - bIsIce;
  }
  // Secondary sort: capacity descending
  return (b.capacityKg || 0) - (a.capacityKg || 0);
});
```

#### Step 3: Un-Tiered Best-Fit Decreasing Allocation (lines 109–123)
```javascript
// Find best bin: minimum remaining capacity that can still fit the delivery
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

### 2.2 Mathematical Mechanism of the Failure

Let vehicle fleet $V = \{ V_{\text{EV}}, V_{\text{ICE}} \}$, where:
- $V_{\text{EV}}$ has capacity $C_{\text{EV}} = 1000\text{ kg}$ and fuelType `Electric`.
- $V_{\text{ICE}}$ has capacity $C_{\text{ICE}} = 600\text{ kg}$ and fuelType `Diesel`.
- Consignment $P_1$ has weight $W_1 = 200\text{ kg}$.
- User specifies `vehicleTypePreference: 'EV'`.

In Step 1, $V$ is sorted as $[ V_{\text{EV}}, V_{\text{ICE}} ]$, and `bins` is initialized as:
$$\text{bins}[0] = V_{\text{EV}}\ (R_0 = 1000\text{ kg}),\quad \text{bins}[1] = V_{\text{ICE}}\ (R_1 = 600\text{ kg})$$

In Step 3, the allocation loop evaluates:
1. $i = 0\ (V_{\text{EV}})$:
   - Feasibility: $R_0 = 1000 \ge 200$ (True).
   - Remaining after fit: $\Delta_0 = 1000 - 200 = 800\text{ kg}$.
   - Condition $\Delta_0 < \text{minRemainingAfterFit}$ ($800 < \infty$) $\to$ `bestBinIndex = 0`, `minRemainingAfterFit = 800`.
2. $i = 1\ (V_{\text{ICE}})$:
   - Feasibility: $R_1 = 600 \ge 200$ (True).
   - Remaining after fit: $\Delta_1 = 600 - 200 = 400\text{ kg}$.
   - Condition $\Delta_1 < \text{minRemainingAfterFit}$ ($400 < 800$) $\to$ **`bestBinIndex = 1`**, `minRemainingAfterFit = 400`.

**Result**: Parcel $P_1$ is packed into $\text{bins}[1]$ (the Diesel vehicle).  
The preference sorting performed in Step 1 is rendered entirely ineffective because BFD's objective function $\min(C_i - W)$ minimizes empty leftover space across the entire fleet without any propulsion weighting or tiering.

### 2.3 Empirical Verification of Bug
Executing the scenario directly in Node.js:
```bash
node -e "const { packDeliveries } = require('./server/src/services/optimization/binPacker'); const ev = { _id: 'tata-ace-ev', capacityKg: 1000, fuelType: 'Electric' }; const diesel = { _id: 'bajaj-maxima', capacityKg: 600, fuelType: 'Diesel' }; const res = packDeliveries([{ _id: 'd1', weightKg: 200 }], [diesel, ev], { vehicleTypePreference: 'EV' }); console.log('EV test - Assigned to:', res.vehicleBins[0].vehicle._id, res.vehicleBins[0].vehicle.fuelType); const res2 = packDeliveries([{ _id: 'd1', weightKg: 400 }], [{ _id: 'ev', capacityKg: 1000, fuelType: 'Electric' }, { _id: 'diesel', capacityKg: 1200, fuelType: 'Diesel' }], { vehicleTypePreference: 'ICE' }); console.log('ICE test - Assigned to:', res2.vehicleBins[0].vehicle._id, res2.vehicleBins[0].vehicle.fuelType);"
```
Output:
```text
EV test - Assigned to: bajaj-maxima Diesel   <-- BUG: EV preferred, Diesel assigned
ICE test - Assigned to: ev Electric          <-- BUG: ICE preferred, EV assigned
```

---

## 3. Algorithmic Specification: Tiered Best-Fit Decreasing (T-BFD)

### 3.1 Tier Structure
Candidate vehicles are partitioned into two tiers depending on `vehicleTypePreference`:

| `vehicleTypePreference` | Tier 1 (Preferred) | Tier 2 (Fallback / Non-Preferred) |
|:---|:---|:---|
| `'EV'` | All bins where `fuelType === FUEL_TYPES.ELECTRIC` | All bins where `fuelType !== FUEL_TYPES.ELECTRIC` |
| `'ICE'` | All bins where `fuelType !== FUEL_TYPES.ELECTRIC` | All bins where `fuelType === FUEL_TYPES.ELECTRIC` |
| `'COST_OPTIMAL'` (or undefined) | All bins (single un-tiered evaluation) | None ($\emptyset$) |

### 3.2 Allocation Procedure (Per Delivery)
For each consignment $d \in \text{sortedDeliveries}$ (with weight $W = d.\text{weightKg}$):

1. **Fleet Feasibility Guard**:
   $$\text{if } W > \max_{v \in V}(v.\text{capacityKg}) \implies \text{mark } d \text{ as unassigned with reason } \text{'EXCEEDS\_VEHICLE\_MAX\_CAPACITY'}$$

2. **Phase 1: Preferred Tier Evaluation**:
   Evaluate candidate indices $k \in \text{preferredTierIndices}$:
   $$\text{feasible}_k = (\text{bin}_k.\text{remainingCapacityKg} \ge W - 10^{-6})$$
   $$\text{bestBinIndex} = \arg\min_{k \in \text{preferredTierIndices}, \text{feasible}_k} (\text{bin}_k.\text{remainingCapacityKg} - W)$$

3. **Phase 2: Fallback Tier Evaluation**:
   If and only if $\text{bestBinIndex} == -1$ (no preferred vehicle has sufficient remaining payload capacity) AND $\text{fallbackTierIndices}$ is non-empty:
   Evaluate candidate indices $j \in \text{fallbackTierIndices}$:
   $$\text{feasible}_j = (\text{bin}_j.\text{remainingCapacityKg} \ge W - 10^{-6})$$
   $$\text{bestBinIndex} = \arg\min_{j \in \text{fallbackTierIndices}, \text{feasible}_j} (\text{bin}_j.\text{remainingCapacityKg} - W)$$

4. **Phase 3: Assignment or Overflow**:
   - If $\text{bestBinIndex} \ne -1$:
     Assign consignment $d$ to $\text{bins}[\text{bestBinIndex}]$; update `totalWeightKg`, `remainingCapacityKg`, and `utilizationPercent`.
   - If $\text{bestBinIndex} == -1$:
     Segregate consignment $d$ into `unassignedDeliveries` with `reason: 'CAPACITY_OVERFLOW'`.

### 3.3 Complexity & Performance Analysis
- **Time Complexity**:
  - Vehicle sorting & tier partitioning: $O(V \log V)$ once up-front.
  - Delivery sorting: $O(D \log D)$ once up-front.
  - Allocation loop: For each delivery, scans at most $|\text{Tier}_1| + |\text{Tier}_2| = V$ bins. Total time is $O(D \cdot V)$.
  - Given typical fleet sizes in urban delivery ($V \le 20$, $D \le 100$), execution time is $< 0.1\text{ ms}$, maintaining the sub-5ms convergence profile on canonical batches.
- **Space Complexity**:
  - Tier partitioning requires two small arrays of integer indices ($|\text{Tier}_1| + |\text{Tier}_2| = V$).
  - Zero memory allocation inside the inner delivery allocation loop.

---

## 4. Preservation of Platform Invariants

The Tiered Best-Fit Decreasing algorithm strictly preserves all platform constraints:

1. **Payload Isolation (`unassignedDeliveries`)**:
   - Consignments exceeding single vehicle absolute limits are caught before tier search and tagged `EXCEEDS_VEHICLE_MAX_CAPACITY`.
   - Aggregate fleet overflow (when preferred tier AND fallback tier are exhausted) is tagged `CAPACITY_OVERFLOW`.
   - Empty fleet array returns all consignments tagged `NO_AVAILABLE_VEHICLES`.
2. **Cold-Chain & Urgent Priority Preservation**:
   - Step 2 sorts deliveries by `PRIORITY_ORDER` (`COLD_CHAIN: 0`, `URGENT: 1`, `STANDARD: 2`) before packing begins.
   - Temperature-sensitive consignments are evaluated first, ensuring they secure slots in the preferred fleet tier before standard parcels consume capacity.
3. **Multi-Vehicle Load Partitioning**:
   - When a vehicle fills up, subsequent packages fill the next best-fitting vehicle within the preferred tier.
   - Only when all preferred vehicles reach capacity do packages spill over to the non-preferred tier.
4. **Deterministic Tie-Breaking**:
   - Vehicles within a tier are sorted by `capacityKg` descending, preserving stability.
   - In `findBestFitBin`, the strict inequality `remainingAfter < minRemaining` guarantees that identical fits select the lowest-index vehicle deterministically across repeated runs.
5. **Numerical Stability**:
   - The floating-point tolerance check `bin.remainingCapacityKg >= weight - 1e-6` and `.toFixed(2)` updates are preserved.

---

## 5. Exact Line-by-Line Unified Diffs for Implementation Worker

### 5.1 Target 1: `server/src/services/optimization/binPacker.js`

```diff
--- server/src/services/optimization/binPacker.js
+++ server/src/services/optimization/binPacker.js
@@ -73,6 +73,29 @@
 
   const maxFleetVehicleCapacity = Math.max(...sortedVehicles.map(v => v.capacityKg || 0));
 
+  // Partition vehicle bin indices into preference tiers for Tiered Best-Fit Decreasing
+  let preferredTierIndices = [];
+  let fallbackTierIndices = [];
+
+  if (vehicleTypePreference === 'EV') {
+    for (let i = 0; i < bins.length; i++) {
+      if (bins[i].vehicle.fuelType === FUEL_TYPES.ELECTRIC) {
+        preferredTierIndices.push(i);
+      } else {
+        fallbackTierIndices.push(i);
+      }
+    }
+  } else if (vehicleTypePreference === 'ICE') {
+    for (let i = 0; i < bins.length; i++) {
+      if (bins[i].vehicle.fuelType !== FUEL_TYPES.ELECTRIC) {
+        preferredTierIndices.push(i);
+      } else {
+        fallbackTierIndices.push(i);
+      }
+    }
+  } else {
+    // Single tier for COST_OPTIMAL or unguided allocation
+    preferredTierIndices = bins.map((_, i) => i);
+  }
+
   // 2. Sort deliveries: Priority (Cold Chain -> Urgent -> Standard) -> Weight (Desc) -> Order Ref (Asc)
   const sortedDeliveries = [...deliveries].sort((a, b) => {
     const prioA = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 2;
@@ -90,6 +113,23 @@
   const unassignedDeliveries = [];
 
+  // Helper to find the best-fitting bin within a specific candidate tier of bin indices
+  const findBestFitBin = (tierIndices, weight) => {
+    let bestIdx = -1;
+    let minRemaining = Infinity;
+    for (const idx of tierIndices) {
+      const bin = bins[idx];
+      if (bin.remainingCapacityKg >= weight - 1e-6) {
+        const remainingAfter = bin.remainingCapacityKg - weight;
+        if (remainingAfter < minRemaining) {
+          minRemaining = remainingAfter;
+          bestIdx = idx;
+        }
+      }
+    }
+    return bestIdx;
+  };
+
   // 3. Bin-Packing Allocation (Tiered Best-Fit Decreasing)
   for (const delivery of sortedDeliveries) {
     const weight = delivery.weightKg || 0;
@@ -107,17 +147,12 @@
       continue;
     }
 
-    // Find best bin: minimum remaining capacity that can still fit the delivery
-    let bestBinIndex = -1;
-    let minRemainingAfterFit = Infinity;
-
-    for (let i = 0; i < bins.length; i++) {
-      const bin = bins[i];
-      if (bin.remainingCapacityKg >= weight - 1e-6) {
-        const remainingAfter = bin.remainingCapacityKg - weight;
-        if (remainingAfter < minRemainingAfterFit) {
-          minRemainingAfterFit = remainingAfter;
-          bestBinIndex = i;
-        }
-      }
-    }
+    // Tiered Best-Fit Decreasing: Evaluate preferred tier first
+    let bestBinIndex = findBestFitBin(preferredTierIndices, weight);
+
+    // Fall back to non-preferred tier only when preferred tier cannot accommodate consignment
+    if (bestBinIndex === -1 && fallbackTierIndices.length > 0) {
+      bestBinIndex = findBestFitBin(fallbackTierIndices, weight);
+    }
 
     if (bestBinIndex !== -1) {
```

---

### 5.2 Target 2: `server/tests/adversarial_optimizer_stress.test.js`

```diff
--- server/tests/adversarial_optimizer_stress.test.js
+++ server/tests/adversarial_optimizer_stress.test.js
@@ -443,8 +443,15 @@
       expect(evResult.vehicleBins[0].vehicle.vehicleId).toBe('OD-02-AK-1001');
       expect(evResult.unassignedDeliveries).toHaveLength(0);
+
+      // Symmetrically verify vehicleTypePreference: 'ICE'
+      const iceResult = packDeliveries([delivery], [evVehicle, dieselVehicle], { vehicleTypePreference: 'ICE' });
+      expect(iceResult.vehicleBins).toHaveLength(1);
+      expect(iceResult.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.DIESEL);
+      expect(iceResult.vehicleBins[0].vehicle.vehicleId).toBe('OD-02-BL-2002');
+      expect(iceResult.unassignedDeliveries).toHaveLength(0);
     });
 
-    test('TC-ADV-EV-3: Adversarial Capacity Inversion Challenge — Exposes raw BFD preference bypass when ICE vehicle has smaller capacity', () => {
+    test('TC-ADV-EV-3: Adversarial Capacity Inversion Challenge — Verifies Tiered BFD honors EV preference even when ICE vehicle has smaller capacity', () => {
       // Inverted capacity scenario:
       // Tata Ace EV has 1000 kg capacity
       // Bajaj Maxima Diesel has 600 kg capacity
@@ -474,13 +481,42 @@
       expect(res.vehicleBins).toHaveLength(1);
 
-      // Observation: In current binPacker.js, BFD minimizes remaining capacity across all bins
-      // (600 - 200 = 400 remaining) < (1000 - 200 = 800 remaining)
-      // Consequently, res.vehicleBins[0].vehicle is the Diesel vehicle, revealing that raw BFD overrides vehicleTypePreference
       const assignedVehicle = res.vehicleBins[0].vehicle;
       const isEvPreferenceHonored = assignedVehicle.fuelType === FUEL_TYPES.ELECTRIC;
 
       // Log empirical result for adversarial audit report
       console.log(`[TC-ADV-EV-3 Challenge Result] vehicleTypePreference: 'EV' with mixed fleet (EV: 1000kg, ICE: 600kg):
         - Assigned Vehicle: ${assignedVehicle.vehicleId} (${assignedVehicle.fuelType})
-        - Preference Honored: ${isEvPreferenceHonored} (BFD selected smaller capacity ICE over larger EV)`);
+        - Preference Honored: ${isEvPreferenceHonored} (Tiered BFD correctly selected preferred EV)`);
 
-      // We assert that the assigned vehicle is tracked accurately
-      expect(assignedVehicle.vehicleId).toBeDefined();
+      expect(assignedVehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
+      expect(assignedVehicle.vehicleId).toBe('OD-02-AK-1001');
+      expect(isEvPreferenceHonored).toBe(true);
+    });
+
+    test('TC-ADV-EV-4: Tiered BFD falls back to non-preferred tier when preferred tier capacity is exhausted', () => {
+      const evVehicle = {
+        _id: 'tata-ace-ev',
+        vehicleId: 'OD-02-AK-1001',
+        capacityKg: 500,
+        fuelType: FUEL_TYPES.ELECTRIC,
+      };
+
+      const dieselVehicle = {
+        _id: 'mahindra-bolero',
+        vehicleId: 'OD-02-BL-2002',
+        capacityKg: 1000,
+        fuelType: FUEL_TYPES.DIESEL,
+      };
+
+      const deliveries = [
+        { _id: 'd1', orderReference: '#D1-400', weightKg: 400, priority: PRIORITY_LEVELS.STANDARD },
+        { _id: 'd2', orderReference: '#D2-300', weightKg: 300, priority: PRIORITY_LEVELS.STANDARD },
+      ];
+
+      // When vehicleTypePreference: 'EV':
+      // d1 (400 kg) fits into EV (500 kg, leaving 100 kg).
+      // d2 (300 kg) cannot fit into EV (100 kg remaining), so it falls back to Diesel vehicle (1000 kg).
+      const res = packDeliveries(deliveries, [dieselVehicle, evVehicle], { vehicleTypePreference: 'EV' });
+      expect(res.vehicleBins).toHaveLength(2);
+      expect(res.vehicleBins[0].vehicle.fuelType).toBe(FUEL_TYPES.ELECTRIC);
+      expect(res.vehicleBins[0].deliveries[0]._id).toBe('d1');
+      expect(res.vehicleBins[1].vehicle.fuelType).toBe(FUEL_TYPES.DIESEL);
+      expect(res.vehicleBins[1].deliveries[0]._id).toBe('d2');
+      expect(res.unassignedDeliveries).toHaveLength(0);
+    });
```

---

## 6. Verification & Regression Testing Matrix

### 6.1 Step-by-Step Verification Procedure for Worker

1. **Verify Unit Algorithm Correctness (Standalone Node)**:
   ```powershell
   node -e "const { packDeliveries } = require('./server/src/services/optimization/binPacker'); const ev = { _id: 'tata-ace-ev', capacityKg: 1000, fuelType: 'Electric' }; const diesel = { _id: 'bajaj-maxima', capacityKg: 600, fuelType: 'Diesel' }; const res = packDeliveries([{ _id: 'd1', weightKg: 200 }], [diesel, ev], { vehicleTypePreference: 'EV' }); console.log('EV test - Assigned to:', res.vehicleBins[0].vehicle._id, res.vehicleBins[0].vehicle.fuelType); const res2 = packDeliveries([{ _id: 'd1', weightKg: 400 }], [{ _id: 'ev', capacityKg: 1000, fuelType: 'Electric' }, { _id: 'diesel', capacityKg: 1200, fuelType: 'Diesel' }], { vehicleTypePreference: 'ICE' }); console.log('ICE test - Assigned to:', res2.vehicleBins[0].vehicle._id, res2.vehicleBins[0].vehicle.fuelType);"
   ```
   *Expected Output*:
   ```text
   EV test - Assigned to: tata-ace-ev Electric
   ICE test - Assigned to: diesel Diesel
   ```

2. **Run Dedicated Adversarial Optimizer Stress Test**:
   ```powershell
   npm test --prefix server -- tests/adversarial_optimizer_stress.test.js
   ```
   *Expected Output*:
   - 16 tests passed (15 baseline + 1 new fallback test).
   - Telemetry confirms:
     - `TC-ADV-MONO-1`: 0 monotonic violations.
     - `TC-ADV-EV-3`: `Preference Honored: true (Tiered BFD correctly selected preferred EV)`.
     - `TC-ADV-CONV-1`: Sub-500ms execution on canonical 25-stop batch.

3. **Run Unit Optimization Test Suite**:
   ```powershell
   npm test --prefix server -- tests/optimization.test.js
   ```
   *Expected Output*:
   - 32/32 tests pass with exit code 0.

4. **Run E2E Test Runner**:
   ```powershell
   node tests/e2e/runner.js
   ```
   *Expected Output*:
   - All 22 suites pass (89/89 tests passed, exit code 0).

### 6.2 Invalidation Conditions
- Any assignment of an EV-preferred batch to an ICE vehicle when an eligible EV has remaining payload capacity.
- Any assignment of an ICE-preferred batch to an EV when an eligible ICE vehicle has remaining payload capacity.
- Any drop in 2-opt distance reduction performance or regression in `D_opt <= D_base`.
- Any regression in cold-chain priority ordering or unassigned delivery reasons.
