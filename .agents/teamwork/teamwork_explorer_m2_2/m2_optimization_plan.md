# Milestone 2 Route Optimization Engine — Technical Implementation Specification & Architecture Blueprint

**Document Version:** 1.0.0  
**Status:** DRAFT / EXPLORATION COMPLETE  
**Author:** Teamwork Explorer M2-2 (`teamwork_explorer_m2_2`)  
**Target Milestone:** Milestone 2 (Mapping, Matrix Services & Route Optimization Engine)  
**Target Subsystems:**
- `server/src/services/optimization/matrixBuilder.js`
- `server/src/services/optimization/nearestNeighbor.js`
- `server/src/services/optimization/twoOpt.js`
- `server/src/services/optimization/binPacker.js`
- `server/src/services/optimization/costScorer.js`
- `server/src/models/Route.js`
- `server/src/controllers/routeController.js`
- `server/src/routes/routeRoutes.js`

---

## 1. Executive Summary & Pipeline Architecture

The SmartRoute Route Optimization Engine is a modular, high-performance, deterministic optimization pipeline tailored for last-mile logistics operations in Bhubaneswar. The engine ingests an operational batch of consignments (e.g. canonical batch `BBSR-EXP-01` with central depot at Rasulgarh Hub), assigns consignments across available fleet vehicles honoring payload weight capacities, constructs greedy baseline sequences using the Nearest-Neighbor heuristic, and refines the tours using bounded 2-opt local search.

Every route is simultaneously scored across both operational metrics (distance, duration) and dual-propulsion energy/financial/carbon models (EV vs Diesel/Petrol ICE), computing exact deltas (distance saved, time saved, cost saved in INR, and carbon emissions avoided in kg CO2).

```
                            +-------------------------------------------+
                            |       Operational Delivery Batch          |
                            | (Depot: Rasulgarh, Deliveries: [d1..dn])  |
                            +-------------------------------------------+
                                                  |
                                                  v
                                    +---------------------------+
                                    |       binPacker.js        |
                                    | Multi-Vehicle Bin Packing |
                                    |  (FFD/BFD with Capacity)  |
                                    +---------------------------+
                                          /               \
                                         /                 \
                      +----------------------+      +----------------------+
                      | Assigned to Vehicles |      | unassignedDeliveries |
                      |  (V1, V2, ..., Vm)   |      |  (Capacity Overflow) |
                      +----------------------+      +----------------------+
                                  |
                                  v
                    +-----------------------------+
                    |      matrixBuilder.js       |
                    | Builds (N+1)x(N+1) Distance |
                    |     & Duration Matrices     |
                    +-----------------------------+
                                  |
                                  v
                    +-----------------------------+
                    |     nearestNeighbor.js      |
                    |   Greedy Baseline Tour      |
                    |     (Depot -> Stops -> Depot|
                    +-----------------------------+
                                  |
                                  v
                    +-----------------------------+
                    |          twoOpt.js          |
                    |  Bounded 2-Opt Local Search |
                    |   (Non-increasing Swap,     |
                    |    Delta Evaluation, eps)   |
                    +-----------------------------+
                                  |
                                  v
                    +-----------------------------+
                    |        costScorer.js        |
                    |   Dual Propulsion Energy,   |
                    |    Cost & Carbon Scorer     |
                    +-----------------------------+
                                  |
                                  v
                    +-----------------------------+
                    |    Route Document & REST    |
                    |    POST /routes/optimize    |
                    |    POST /routes/:id/dispatch|
                    +-----------------------------+
```

---

## 2. Optimization Pipeline Architecture Specifications

### 2.1 `matrixBuilder.js` — Distance & Duration Matrix Assembly

- **File Location:** `server/src/services/optimization/matrixBuilder.js`
- **Objective:** Given an origin depot (e.g. Rasulgarh Hub) and $N$ delivery consignments, coordinate with `googleMapsService` (and its deterministic fallback `simulatedTrafficService`) to construct complete $(N+1) \times (N+1)$ distance (in km) and duration (in minutes) matrices.

#### Data Structures & Coordinates
- Index `0`: Central Depot (e.g. Rasulgarh: `{ lat: 20.2961, lng: 85.8645 }`).
- Index `1..N`: Delivery consignments ordered by index.
- Coordinate resolution: Extracts coordinates from GeoJSON `delivery.location.coordinates` (`[lng, lat]` $\to$ `{ lat: coordinates[1], lng: coordinates[0] }`) or direct `{ lat, lng }`.
- Validates that coordinates are within valid geographic ranges (Bhubaneswar bounding box: latitude $20.15$ to $20.45$, longitude $85.70$ to $85.95$).

#### Code Blueprint
```javascript
// server/src/services/optimization/matrixBuilder.js
const googleMapsService = require('../mapping/googleMapsService');
const { CANONICAL_DEPOT } = require('../../config/constants');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Builds distance and duration matrices for depot + delivery stops.
 * 
 * @param {Object} depot - { name, address, geo: { lat, lng } }
 * @param {Array<Object>} deliveries - Array of Delivery Mongoose documents or plain objects
 * @param {Object} [options] - { trafficScenario: 'FREE_FLOW' | 'MORNING_RUSH' | ... }
 * @returns {Promise<{
 *   points: Array<{ id: string, type: 'DEPOT'|'DELIVERY', lat: number, lng: number, ref: string }>,
 *   distancesKm: number[][],
 *   durationsMin: number[][],
 *   trafficScenario: string,
 *   source: string,
 *   getDistanceKm: (i: number, j: number) => number,
 *   getDurationMin: (i: number, j: number) => number
 * }>}
 */
async function buildMatrix(depot, deliveries, options = {}) {
  const depotGeo = (depot && depot.geo) ? depot.geo : CANONICAL_DEPOT.geo;
  if (!depotGeo || typeof depotGeo.lat !== 'number' || typeof depotGeo.lng !== 'number') {
    throw new AppError('Valid depot coordinates are required for matrix generation', 400, 'INVALID_DEPOT_COORDINATES');
  }

  const trafficScenario = options.trafficScenario || 'FREE_FLOW';

  // Normalize points: index 0 is always depot
  const points = [
    {
      id: 'DEPOT',
      type: 'DEPOT',
      lat: depotGeo.lat,
      lng: depotGeo.lng,
      ref: depot.name || 'Rasulgarh Depot',
    },
  ];

  for (const delivery of deliveries) {
    let lat, lng;
    if (delivery.location && Array.isArray(delivery.location.coordinates) && delivery.location.coordinates.length >= 2) {
      // GeoJSON [longitude, latitude]
      lng = delivery.location.coordinates[0];
      lat = delivery.location.coordinates[1];
    } else if (delivery.lat && delivery.lng) {
      lat = delivery.lat;
      lng = delivery.lng;
    } else {
      throw new AppError(
        `Delivery ${delivery.orderReference || delivery._id} has invalid or un-geocoded coordinates`,
        422,
        'UNRESOLVED_GEOCODE'
      );
    }

    points.push({
      id: (delivery._id || delivery.id || '').toString(),
      type: 'DELIVERY',
      lat,
      lng,
      ref: delivery.orderReference || delivery.id,
      delivery,
    });
  }

  const origins = points.map(p => ({ lat: p.lat, lng: p.lng }));
  const destinations = origins;

  // Query mapping service (Google Maps API with transparent simulated fallback)
  const matrixResult = await googleMapsService.getDistanceMatrix(origins, destinations, { trafficScenario });

  const numPoints = points.length;
  const distancesKm = Array.from({ length: numPoints }, () => new Array(numPoints).fill(0));
  const durationsMin = Array.from({ length: numPoints }, () => new Array(numPoints).fill(0));

  // Parse Google Maps / Simulated shape
  if (matrixResult && Array.isArray(matrixResult.rows)) {
    for (let i = 0; i < numPoints; i++) {
      const row = matrixResult.rows[i];
      if (!row || !Array.isArray(row.elements)) continue;
      for (let j = 0; j < numPoints; j++) {
        const elem = row.elements[j];
        if (elem && elem.status === 'OK') {
          // distance.value is in meters -> convert to km
          distancesKm[i][j] = parseFloat((elem.distance.value / 1000).toFixed(3));
          // duration.value is in seconds -> convert to minutes
          durationsMin[i][j] = parseFloat((elem.duration.value / 60).toFixed(2));
        } else if (i === j) {
          distancesKm[i][j] = 0;
          durationsMin[i][j] = 0;
        } else {
          distancesKm[i][j] = 9999.0;
          durationsMin[i][j] = 9999.0;
        }
      }
    }
  }

  return {
    points,
    distancesKm,
    durationsMin,
    trafficScenario,
    source: matrixResult.source || 'SIMULATED',
    getDistanceKm: (i, j) => distancesKm[i][j],
    getDurationMin: (i, j) => durationsMin[i][j],
  };
}

module.exports = { buildMatrix };
```

---

### 2.2 `binPacker.js` — Multi-Vehicle Capacity-Constrained Bin Packing

- **File Location:** `server/src/services/optimization/binPacker.js`
- **Objective:** Allocate deliveries across active fleet vehicles while strictly honoring vehicle `capacityKg` constraints, prioritizing EV usage when specified, and isolating any deliveries that cannot fit into `unassignedDeliveries`.

#### Algorithmic Logic
1. **Filtering & Preparation:** Filter vehicles to active/available (`AVAILABLE` or `ASSIGNED`).
2. **Vehicle Sorting:**
   - If `vehicleTypePreference === 'EV'`: Sort EVs first, then by `capacityKg` descending; ICE vehicles placed after EVs.
   - If `COST_OPTIMAL` or default: Sort vehicles by `capacityKg` descending.
3. **Delivery Sorting (First-Fit Decreasing with Priority Hierarchy):**
   - Primary: Priority level (`COLD_CHAIN` = 0, `URGENT` = 1, `STANDARD` = 2).
   - Secondary: Consignment weight `weightKg` descending.
   - Tertiary: `orderReference` ascending (guarantees strict determinism).
4. **Bin-Packing Assignment:**
   - For each delivery $d$:
     - Check if $d.\text{weightKg} > \max_j (v_j.\text{capacityKg})$:
       - Flag immediately in `unassignedDeliveries` with reason `EXCEEDS_VEHICLE_MAX_CAPACITY`.
     - Evaluate vehicles using Best-Fit Decreasing (BFD) or First-Fit Decreasing (FFD):
       - Find candidate vehicle with remaining capacity $\ge d.\text{weightKg}$.
       - If found, assign delivery to vehicle, subtract weight from vehicle's remaining capacity, and increment assigned stop count.
       - If no vehicle has sufficient remaining payload capacity, flag delivery in `unassignedDeliveries` with reason `CAPACITY_OVERFLOW`.

#### Code Blueprint
```javascript
// server/src/services/optimization/binPacker.js
const { PRIORITY_LEVELS, FUEL_TYPES } = require('../../config/constants');

const PRIORITY_ORDER = {
  [PRIORITY_LEVELS.COLD_CHAIN]: 0,
  [PRIORITY_LEVELS.URGENT]: 1,
  [PRIORITY_LEVELS.STANDARD]: 2,
};

/**
 * Packs deliveries into available vehicles respecting payload capacity limits.
 *
 * @param {Array<Object>} deliveries - Consignment objects with weightKg and priority
 * @param {Array<Object>} vehicles - Vehicle objects with capacityKg and fuelType
 * @param {Object} [options] - { vehicleTypePreference: 'EV' | 'ICE' | 'COST_OPTIMAL' }
 * @returns {{
 *   vehicleBins: Array<{
 *     vehicle: Object,
 *     deliveries: Array<Object>,
 *     totalWeightKg: number,
 *     remainingCapacityKg: number,
 *     utilizationPercent: number
 *   }>,
 *   unassignedDeliveries: Array<{
 *     deliveryId: string,
 *     orderReference: string,
 *     weightKg: number,
 *     priority: string,
 *     reason: string,
 *     details: string
 *   }>
 * }}
 */
function packDeliveries(deliveries, vehicles, options = {}) {
  const vehicleTypePreference = options.vehicleTypePreference || 'COST_OPTIMAL';

  if (!vehicles || vehicles.length === 0) {
    return {
      vehicleBins: [],
      unassignedDeliveries: deliveries.map(d => ({
        deliveryId: (d._id || d.id).toString(),
        orderReference: d.orderReference,
        weightKg: d.weightKg,
        priority: d.priority,
        reason: 'NO_AVAILABLE_VEHICLES',
        details: 'No active or eligible vehicles provided for allocation',
      })),
    };
  }

  // 1. Sort vehicles according to strategy
  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (vehicleTypePreference === 'EV') {
      const aIsEv = a.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      const bIsEv = b.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      if (aIsEv !== bIsEv) return aIsEv - bIsEv;
    }
    // Secondary sort: capacity descending
    return (b.capacityKg || 0) - (a.capacityKg || 0);
  });

  // Initialize vehicle bins
  const bins = sortedVehicles.map(vehicle => ({
    vehicle,
    deliveries: [],
    totalWeightKg: 0,
    remainingCapacityKg: vehicle.capacityKg,
    utilizationPercent: 0,
  }));

  const maxFleetVehicleCapacity = Math.max(...sortedVehicles.map(v => v.capacityKg || 0));

  // 2. Sort deliveries: Priority (Cold Chain -> Urgent -> Standard) -> Weight (Desc) -> Order Ref (Asc)
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const prioA = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 2;
    const prioB = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 2;
    if (prioA !== prioB) return prioA - prioB;

    const weightDiff = (b.weightKg || 0) - (a.weightKg || 0);
    if (Math.abs(weightDiff) > 1e-4) return weightDiff;

    return (a.orderReference || '').localeCompare(b.orderReference || '');
  });

  const unassignedDeliveries = [];

  // 3. Bin-Packing Allocation (Best-Fit Decreasing)
  for (const delivery of sortedDeliveries) {
    const weight = delivery.weightKg || 0;

    // Check individual stop feasibility against fleet absolute max
    if (weight > maxFleetVehicleCapacity) {
      unassignedDeliveries.push({
        deliveryId: (delivery._id || delivery.id).toString(),
        orderReference: delivery.orderReference,
        weightKg: weight,
        priority: delivery.priority,
        reason: 'EXCEEDS_VEHICLE_MAX_CAPACITY',
        details: `Consignment weight (${weight} kg) exceeds maximum vehicle capacity (${maxFleetVehicleCapacity} kg) in the fleet`,
      });
      continue;
    }

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

    if (bestBinIndex !== -1) {
      const targetBin = bins[bestBinIndex];
      targetBin.deliveries.push(delivery);
      targetBin.totalWeightKg = parseFloat((targetBin.totalWeightKg + weight).toFixed(2));
      targetBin.remainingCapacityKg = parseFloat((targetBin.remainingCapacityKg - weight).toFixed(2));
      targetBin.utilizationPercent = parseFloat(
        ((targetBin.totalWeightKg / targetBin.vehicle.capacityKg) * 100).toFixed(1)
      );
    } else {
      unassignedDeliveries.push({
        deliveryId: (delivery._id || delivery.id).toString(),
        orderReference: delivery.orderReference,
        weightKg: weight,
        priority: delivery.priority,
        reason: 'CAPACITY_OVERFLOW',
        details: `Aggregate payload exceeded remaining fleet capacity; cannot fit consignment (${weight} kg)`,
      });
    }
  }

  return {
    vehicleBins: bins.filter(b => b.deliveries.length > 0),
    unassignedDeliveries,
  };
}

module.exports = { packDeliveries };
```

---

### 2.3 `nearestNeighbor.js` — Greedy Baseline TSP Tour Construction

- **File Location:** `server/src/services/optimization/nearestNeighbor.js`
- **Objective:** Construct an initial greedy TSP tour for a vehicle's assigned delivery stops starting from the Rasulgarh depot (Index 0), iteratively selecting the closest unvisited stop, and returning to the depot.

#### Algorithmic Logic
1. Start at depot node $c = 0$.
2. Maintain set of unvisited delivery node indices $U = \{1, 2, \dots, m\}$.
3. While $U \neq \emptyset$:
   - For all $u \in U$, inspect distance matrix $d(c, u)$.
   - Select $u^* = \arg\min_{u \in U} d(c, u)$.
   - Break distance ties by higher priority (`COLD_CHAIN` > `URGENT` > `STANDARD`), then lowest consignment ID for determinism.
   - Append $u^*$ to tour sequence.
   - Remove $u^*$ from $U$.
   - Set current node $c = u^*$.
4. Return closed loop: $[0, s_1, s_2, \dots, s_m, 0]$.
5. Compute cumulative baseline metrics:
   - Total baseline distance: $\sum_{k=0}^{m} d(s_k, s_{k+1})$ where $s_0 = s_{m+1} = \text{depot}$.
   - Total baseline duration: $\sum_{k=0}^{m} t(s_k, s_{k+1}) + \sum_{k=1}^m \text{serviceDurationMinutes}(s_k)$.

#### Code Blueprint
```javascript
// server/src/services/optimization/nearestNeighbor.js
const { PRIORITY_LEVELS } = require('../../config/constants');

const PRIORITY_SCORES = {
  [PRIORITY_LEVELS.COLD_CHAIN]: 3,
  [PRIORITY_LEVELS.URGENT]: 2,
  [PRIORITY_LEVELS.STANDARD]: 1,
};

/**
 * Builds an initial baseline route using the greedy Nearest Neighbor heuristic.
 * 
 * @param {number} depotIndex - Index of depot in matrix (always 0)
 * @param {Array<number>} stopIndices - Indices of assigned deliveries in the distance matrix
 * @param {Function} getDistance - (i, j) => number (distance in km)
 * @param {Function} getDuration - (i, j) => number (travel duration in minutes)
 * @param {Array<Object>} points - Metadata points array from matrixBuilder
 * @returns {{
 *   tourIndices: number[], // [0, s1, s2, ..., sm, 0]
 *   stopSequence: number[], // [s1, s2, ..., sm]
 *   totalDistanceKm: number,
 *   totalDurationMin: number
 * }}
 */
function constructNearestNeighborRoute(depotIndex, stopIndices, getDistance, getDuration, points = []) {
  if (!stopIndices || stopIndices.length === 0) {
    return {
      tourIndices: [depotIndex, depotIndex],
      stopSequence: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
    };
  }

  const unvisited = new Set(stopIndices);
  const stopSequence = [];
  let current = depotIndex;

  while (unvisited.size > 0) {
    let nearestIndex = -1;
    let nearestDist = Infinity;
    let highestPriority = -1;

    for (const candidate of unvisited) {
      const d = getDistance(current, candidate);
      const pt = points[candidate];
      const prio = (pt && pt.delivery && PRIORITY_SCORES[pt.delivery.priority]) || 1;

      if (d < nearestDist - 1e-4) {
        nearestDist = d;
        nearestIndex = candidate;
        highestPriority = prio;
      } else if (Math.abs(d - nearestDist) <= 1e-4) {
        // Tie-breaker 1: Priority
        if (prio > highestPriority) {
          nearestDist = d;
          nearestIndex = candidate;
          highestPriority = prio;
        } else if (prio === highestPriority) {
          // Tie-breaker 2: Deterministic ID / index ordering
          if (candidate < nearestIndex) {
            nearestIndex = candidate;
          }
        }
      }
    }

    stopSequence.push(nearestIndex);
    unvisited.delete(nearestIndex);
    current = nearestIndex;
  }

  // Complete closed loop: Depot -> Stops -> Depot
  const tourIndices = [depotIndex, ...stopSequence, depotIndex];

  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  for (let k = 0; k < tourIndices.length - 1; k++) {
    const from = tourIndices[k];
    const to = tourIndices[k + 1];
    totalDistanceKm += getDistance(from, to);
    totalDurationMin += getDuration(from, to);

    // Add service duration for delivery stop
    if (to !== depotIndex && points[to] && points[to].delivery) {
      totalDurationMin += points[to].delivery.serviceDurationMinutes || 10;
    }
  }

  return {
    tourIndices,
    stopSequence,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(3)),
    totalDurationMin: parseFloat(totalDurationMin.toFixed(2)),
  };
}

module.exports = { constructNearestNeighborRoute };
```

---

### 2.4 `twoOpt.js` — Bounded 2-Opt Local Search Heuristic

- **File Location:** `server/src/services/optimization/twoOpt.js`
- **Objective:** Iteratively untangle crossing edges and reduce total travel distance by testing pairwise sub-tour reversals. Must guarantee non-increasing total distance and bounded execution.

#### Mathematical Foundation & Sub-Tour Reversal
Given tour $T = [v_0, v_1, v_2, \dots, v_m, v_{m+1}]$ where $v_0 = v_{m+1} = \text{depot}$ (node index 0), and customer stops are $v_1 \dots v_m$.
A 2-opt swap for a pair $(i, k)$ with $1 \le i < k \le m$:
- Removes edges $(v_{i-1}, v_i)$ and $(v_k, v_{k+1})$.
- Adds edges $(v_{i-1}, v_k)$ and $(v_i, v_{k+1})$.
- Reverses the sub-tour sequence: $v_i, v_{i+1}, \dots, v_k \to v_k, v_{k-1}, \dots, v_i$.

The distance improvement $\Delta$ is calculated as:
$$\Delta = d(v_{i-1}, v_k) + d(v_i, v_{k+1}) - \left[d(v_{i-1}, v_i) + d(v_k, v_{k+1})\right] + \sum_{j=i}^{k-1} \left[d(v_{j+1}, v_j) - d(v_j, v_{j+1})\right]$$
*(Note: If the distance matrix is symmetric, the internal summation equals 0, making $\Delta = d(v_{i-1}, v_k) + d(v_i, v_{k+1}) - d(v_{i-1}, v_i) - d(v_k, v_{k+1})$.)*

#### Stopping Conditions & Invariants
1. **Improvement Condition:** Swap is accepted if and only if $\Delta < -\epsilon$, where $\epsilon = 0.001\text{ km}$ ($1\text{ meter}$).
2. **Iteration Bound:** Maximum iterations `maxIterations` (configurable, default: 1000).
3. **Convergence:** When an entire sweep over all pairs $(i, k)$ yields no improvement $\ge \epsilon$, local optimum is attained and execution halts.
4. **Monotonicity & Invariant Proof:**
   - Let $D^{(0)}$ be the initial Nearest-Neighbor distance.
   - For every iteration $t \ge 1$ where a swap is accepted:
     $$D^{(t)} = D^{(t-1)} + \Delta < D^{(t-1)} - 0.001$$
   - Thus, $D^{(t)} < D^{(t-1)}$ strictly.
   - The set of tour permutations for $m$ stops is finite ($m!$).
   - Since $D$ decreases by at least $\epsilon$ at every step, cycling is mathematically impossible and the algorithm is guaranteed to terminate.
   - Therefore: $D_{\text{optimized}} \le D_{\text{baseline}}$ always holds.

#### Code Blueprint
```javascript
// server/src/services/optimization/twoOpt.js

/**
 * 2-Opt local search optimization.
 * 
 * @param {Array<number>} initialTour - [0, s1, s2, ..., sm, 0] including depot
 * @param {Function} getDistance - (i, j) => number (distance in km)
 * @param {Function} getDuration - (i, j) => number (travel duration in minutes)
 * @param {Array<Object>} points - Matrix points metadata
 * @param {Object} [options] - { maxIterations: 1000, epsilon: 0.001 }
 * @returns {{
 *   tourIndices: number[],
 *   stopSequence: number[],
 *   totalDistanceKm: number,
 *   totalDurationMin: number,
 *   iterations: number,
 *   converged: boolean
 * }}
 */
function optimize2Opt(initialTour, getDistance, getDuration, points = [], options = {}) {
  const maxIterations = options.maxIterations || 1000;
  const epsilon = options.epsilon || 0.001; // 1 meter threshold

  // Handle trivial routes (0, 1, or 2 customer stops)
  // initialTour length: 2 = [0, 0] (0 stops), 3 = [0, s1, 0] (1 stop), 4 = [0, s1, s2, 0] (2 stops)
  if (!initialTour || initialTour.length <= 3) {
    const distance = computeTourDistance(initialTour, getDistance);
    const duration = computeTourDuration(initialTour, getDuration, points);
    return {
      tourIndices: [...initialTour],
      stopSequence: initialTour.slice(1, -1),
      totalDistanceKm: parseFloat(distance.toFixed(3)),
      totalDurationMin: parseFloat(duration.toFixed(2)),
      iterations: 0,
      converged: true,
    };
  }

  let tour = [...initialTour];
  const numNodes = tour.length; // N + 2
  const maxStopIndex = numNodes - 2; // Last customer stop index in tour array

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < maxStopIndex; i++) {
      for (let k = i + 1; k <= maxStopIndex; k++) {
        const u1 = tour[i - 1];
        const v1 = tour[i];
        const u2 = tour[k];
        const v2 = tour[k + 1];

        // Evaluate delta: removing (u1, v1) and (u2, v2), adding (u1, u2) and (v1, v2)
        let delta = (getDistance(u1, u2) + getDistance(v1, v2)) - (getDistance(u1, v1) + getDistance(u2, v2));

        // Account for directed (asymmetric) edges inside reversed subsegment
        for (let j = i; j < k; j++) {
          delta += (getDistance(tour[j + 1], tour[j]) - getDistance(tour[j], tour[j + 1]));
        }

        // Strict cost improvement evaluation
        if (delta < -epsilon) {
          // Perform 2-opt swap: reverse subsegment tour[i...k]
          reverseSubtour(tour, i, k);
          improved = true;
          break; // First improvement strategy accelerates convergence
        }
      }
      if (improved) break;
    }
  }

  const totalDistanceKm = computeTourDistance(tour, getDistance);
  const totalDurationMin = computeTourDuration(tour, getDuration, points);

  return {
    tourIndices: tour,
    stopSequence: tour.slice(1, -1),
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(3)),
    totalDurationMin: parseFloat(totalDurationMin.toFixed(2)),
    iterations,
    converged: !improved,
  };
}

/** Reverse in-place slice between i and k inclusive */
function reverseSubtour(arr, i, k) {
  while (i < k) {
    const temp = arr[i];
    arr[i] = arr[k];
    arr[k] = temp;
    i++;
    k--;
  }
}

function computeTourDistance(tour, getDistance) {
  let dist = 0;
  for (let k = 0; k < tour.length - 1; k++) {
    dist += getDistance(tour[k], tour[k + 1]);
  }
  return dist;
}

function computeTourDuration(tour, getDuration, points) {
  let dur = 0;
  for (let k = 0; k < tour.length - 1; k++) {
    dur += getDuration(tour[k], tour[k + 1]);
    const stopNode = tour[k + 1];
    // Add service duration if valid delivery stop
    if (stopNode !== 0 && points[stopNode] && points[stopNode].delivery) {
      dur += points[stopNode].delivery.serviceDurationMinutes || 10;
    }
  }
  return dur;
}

module.exports = { optimize2Opt };
```

---

### 2.5 `costScorer.js` — Dual-Propulsion Energy, Financial & Emissions Calculator

- **File Location:** `server/src/services/optimization/costScorer.js`
- **Objective:** Compute operational fuel/electricity consumption, financial expenditure in Indian Rupees (INR), and carbon emissions ($g\text{ CO}_2$) across Electric Vehicles (EV) and Internal Combustion Engine (ICE - Diesel/Petrol) vehicles. Calculate exact optimization savings deltas.

#### Model Parameters & Pricing Constants
| Propulsion Type | Rate / Metric | Direct Cost / km | Carbon Emissions | Source / Regulatory Standard |
|---|---|---|---|---|
| **Electric Vehicle (EV)** | Consumption: $0.18\text{ kWh/km}$<br>Tariff: $₹8.00\text{ / kWh}$ | $0.18 \times 8.00 = \mathbf{₹1.44\text{ / km}}$ | $\mathbf{0.0\text{ g CO}_2\text{/km}}$ (Direct tailpipe) | Tata Ace EV commercial grid rate |
| **ICE (Diesel)** | Consumption: $0.08\text{ L/km}$ ($12.5\text{ km/L}$)<br>Price: $₹95.00\text{ / L}$ | $0.08 \times 95.00 = \mathbf{₹7.60\text{ / km}}$ | $\mathbf{210\text{ g CO}_2\text{/km}}$ ($0.210\text{ kg/km}$) | BS-VI light commercial diesel standard |
| **ICE (Petrol)** | Consumption: $0.0667\text{ L/km}$ ($15.0\text{ km/L}$)<br>Price: $₹103.00\text{ / L}$ | $0.0667 \times 103.00 = \mathbf{₹6.87\text{ / km}}$ | $\mathbf{230\text{ g CO}_2\text{/km}}$ ($0.230\text{ kg/km}$) | Indian Oil Corp Bhubaneswar Retail |

#### Deltas Calculation Formulation
Given baseline metrics $M_{\text{base}}$ and optimized metrics $M_{\text{opt}}$:
- $\Delta_{\text{distance}} = M_{\text{base}}.\text{totalDistanceKm} - M_{\text{opt}}.\text{totalDistanceKm}$
- $\Delta_{\text{time}} = M_{\text{base}}.\text{totalDurationMin} - M_{\text{opt}}.\text{totalDurationMin}$
- $\Delta_{\text{cost}} = M_{\text{base}}.\text{costInr} - M_{\text{opt}}.\text{costInr}$
- $\Delta_{\text{co2}} = M_{\text{base}}.\text{co2Kg} - M_{\text{opt}}.\text{co2Kg}$
- $\text{PercentDistanceReduction} = \frac{\Delta_{\text{distance}}}{M_{\text{base}}.\text{totalDistanceKm}} \times 100\%$ (handled safely when distance is 0)

#### Code Blueprint
```javascript
// server/src/services/optimization/costScorer.js
const { FUEL_TYPES } = require('../../config/constants');

const RATES = {
  ELECTRICITY_INR_PER_KWH: 8.00,
  DIESEL_INR_PER_LITRE: 95.00,
  PETROL_INR_PER_LITRE: 103.00,
  DEFAULT_EV_KWH_PER_KM: 0.18,
  DEFAULT_DIESEL_L_PER_KM: 0.08, // 12.5 km/L
  DEFAULT_PETROL_L_PER_KM: 0.0667, // 15.0 km/L
  CO2_DIESEL_KG_PER_KM: 0.210, // 210 g CO2/km
  CO2_PETROL_KG_PER_KM: 0.230, // 230 g CO2/km
  CO2_EV_KG_PER_KM: 0.0,       // 0 g CO2/km direct tailpipe
};

/**
 * Computes energy consumption, financial cost (INR), and CO2 emissions for a route distance.
 * 
 * @param {number} distanceKm - Total route distance in kilometers
 * @param {Object} vehicle - Vehicle object with fuelType, kmPerLitre, energyKWhPerKm
 * @returns {{
 *   fuelConsumed: number,
 *   fuelUnit: string,
 *   costInr: number,
 *   co2Kg: number,
 *   costPerKm: number
 * }}
 */
function scoreRouteCost(distanceKm, vehicle) {
  const dist = Math.max(0, distanceKm || 0);
  const fuelType = (vehicle && vehicle.fuelType) || FUEL_TYPES.DIESEL;

  if (fuelType === FUEL_TYPES.ELECTRIC) {
    const kwhPerKm = (vehicle && vehicle.energyKWhPerKm && vehicle.energyKWhPerKm > 0)
      ? vehicle.energyKWhPerKm
      : RATES.DEFAULT_EV_KWH_PER_KM;

    const energyKWh = dist * kwhPerKm;
    const costInr = energyKWh * RATES.ELECTRICITY_INR_PER_KWH;
    const co2Kg = dist * RATES.CO2_EV_KG_PER_KM;

    return {
      fuelConsumed: parseFloat(energyKWh.toFixed(2)),
      fuelUnit: 'kWh',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat((kwhPerKm * RATES.ELECTRICITY_INR_PER_KWH).toFixed(2)),
    };
  }

  if (fuelType === FUEL_TYPES.PETROL) {
    const litresPerKm = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
      ? (1 / vehicle.kmPerLitre)
      : RATES.DEFAULT_PETROL_L_PER_KM;

    const litres = dist * litresPerKm;
    const costInr = litres * RATES.PETROL_INR_PER_LITRE;
    const co2Kg = dist * RATES.CO2_PETROL_KG_PER_KM;

    return {
      fuelConsumed: parseFloat(litres.toFixed(2)),
      fuelUnit: 'L',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat((litresPerKm * RATES.PETROL_INR_PER_LITRE).toFixed(2)),
    };
  }

  // Default: DIESEL
  const litresPerKm = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
    ? (1 / vehicle.kmPerLitre)
    : RATES.DEFAULT_DIESEL_L_PER_KM;

  const litres = dist * litresPerKm;
  const costInr = litres * RATES.DIESEL_INR_PER_LITRE;
  const co2Kg = dist * RATES.CO2_DIESEL_KG_PER_KM;

  return {
    fuelConsumed: parseFloat(litres.toFixed(2)),
    fuelUnit: 'L',
    costInr: parseFloat(costInr.toFixed(2)),
    co2Kg: parseFloat(co2Kg.toFixed(3)),
    costPerKm: parseFloat((litresPerKm * RATES.DIESEL_INR_PER_LITRE).toFixed(2)),
  };
}

/**
 * Calculates comparative deltas between baseline and optimized metrics.
 */
function calculateDeltas(baseline, optimized) {
  const baseDist = baseline.totalDistanceKm || 0;
  const optDist = optimized.totalDistanceKm || 0;
  const distSaved = Math.max(0, baseDist - optDist);

  const baseTime = baseline.totalDurationMin || 0;
  const optTime = optimized.totalDurationMin || 0;
  const timeSaved = Math.max(0, baseTime - optTime);

  const baseCost = baseline.costInr || 0;
  const optCost = optimized.costInr || 0;
  const costSaved = Math.max(0, baseCost - optCost);

  const baseCo2 = baseline.co2Kg || 0;
  const optCo2 = optimized.co2Kg || 0;
  const co2Avoided = Math.max(0, baseCo2 - optCo2);

  const percentReduction = baseDist > 0 ? (distSaved / baseDist) * 100 : 0.0;

  return {
    distanceSavedKm: parseFloat(distSaved.toFixed(2)),
    timeSavedMin: parseFloat(timeSaved.toFixed(1)),
    costSavedInr: parseFloat(costSaved.toFixed(2)),
    co2AvoidedKg: parseFloat(co2Avoided.toFixed(3)),
    percentDistanceReduction: parseFloat(percentReduction.toFixed(2)),
  };
}

module.exports = {
  RATES,
  scoreRouteCost,
  calculateDeltas,
};
```

---

## 3. Data Model Blueprint: `server/src/models/Route.js`

- **File Location:** `server/src/models/Route.js`
- **Objective:** Persist versioned planned and dispatched delivery routes with stop sequences, summary metrics, operational deltas, vehicle/driver references, and full JSON transformation.

```javascript
// server/src/models/Route.js
const mongoose = require('mongoose');
const { CANONICAL_DEPOT } = require('../config/constants');

const routeStopSchema = new mongoose.Schema(
  {
    sequence: {
      type: Number,
      required: true,
      min: 1,
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Delivery',
      required: true,
    },
    orderReference: {
      type: String,
      required: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    address: {
      street: { type: String, required: true },
      zone: { type: String, required: true },
      city: { type: String, default: 'Bhubaneswar' },
      postalCode: { type: String, required: true },
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    weightKg: {
      type: Number,
      required: true,
    },
    priority: {
      type: String,
      required: true,
    },
    timeWindow: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    eta: {
      type: String,
      default: null,
    },
    distanceFromPrevKm: {
      type: Number,
      default: 0.0,
    },
    durationFromPrevMin: {
      type: Number,
      default: 0.0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ARRIVED', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      required: [true, 'Route code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBatch',
      required: [true, 'Associated batch ID is required'],
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Assigned vehicle ID is required'],
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
    },
    depot: {
      name: { type: String, default: CANONICAL_DEPOT.name },
      address: { type: String, default: CANONICAL_DEPOT.address },
      geo: {
        lat: { type: Number, default: CANONICAL_DEPOT.geo.lat },
        lng: { type: Number, default: CANONICAL_DEPOT.geo.lng },
      },
    },
    stops: [routeStopSchema],
    metrics: {
      totalStops: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0.0 },
      totalDurationMin: { type: Number, default: 0.0 },
      totalWeightKg: { type: Number, default: 0.0 },
      costInr: { type: Number, default: 0.0 },
      co2Kg: { type: Number, default: 0.0 },
      fuelConsumed: { type: Number, default: 0.0 },
      fuelUnit: { type: String, default: 'L' },
    },
    baseline: {
      totalDistanceKm: { type: Number, default: 0.0 },
      totalDurationMin: { type: Number, default: 0.0 },
      costInr: { type: Number, default: 0.0 },
      co2Kg: { type: Number, default: 0.0 },
    },
    deltas: {
      distanceSavedKm: { type: Number, default: 0.0 },
      timeSavedMin: { type: Number, default: 0.0 },
      costSavedInr: { type: Number, default: 0.0 },
      co2AvoidedKg: { type: Number, default: 0.0 },
      percentDistanceReduction: { type: Number, default: 0.0 },
    },
    optimizationMetadata: {
      algorithm: { type: String, default: '2-OPT_TSP_NN' },
      maxIterations: { type: Number, default: 1000 },
      executedIterations: { type: Number, default: 0 },
      trafficScenario: { type: String, default: 'FREE_FLOW' },
      matrixSource: { type: String, default: 'SIMULATED' },
      converged: { type: Boolean, default: true },
    },
    version: {
      type: Number,
      default: 1,
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

routeSchema.index({ batchId: 1, status: 1 });
routeSchema.index({ vehicleId: 1 });
routeSchema.index({ driverId: 1 });
routeSchema.index({ routeCode: 1 }, { unique: true });

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;
```

---

## 4. Route Controller & REST API Specification

### 4.1 Endpoints Overview
| HTTP Method | Route | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/routes/optimize` | `ADMIN`, `FLEET_MANAGER` | Runs full multi-vehicle bin-packing, Nearest Neighbor, 2-opt search, and scoring. Returns baseline vs optimized comparison. |
| `POST` | `/api/v1/routes/:id/dispatch` | `ADMIN`, `FLEET_MANAGER` | Dispatches route, transitions deliveries to `ASSIGNED`, vehicle/driver to `IN_TRANSIT`, increments version, logs audit event. |
| `GET` | `/api/v1/routes` | Authenticated (`ADMIN`, `FLEET_MANAGER`, `DRIVER`) | Lists routes with pagination and filters. Enforces BOLA for drivers. |
| `GET` | `/api/v1/routes/:id` | Authenticated | Retrieves single route details with populated stops, vehicle, and driver. Enforces BOLA for drivers. |

### 4.2 Endpoint 1: `POST /api/v1/routes/optimize`

#### Request Body
```json
{
  "batchId": "651a2f9b1c9d8b001a111111",
  "vehicleIds": ["651a2f9b1c9d8b001a222222"],
  "options": {
    "maxIterations": 1000,
    "trafficScenario": "MORNING_RUSH",
    "vehicleTypePreference": "EV"
  }
}
```

#### Step-by-Step Controller Execution Flow
1. **Batch & Deliveries Retrieval:**
   - Fetch `DeliveryBatch` by `batchId`. If not found, return `404 NOT_FOUND`.
   - Query eligible deliveries: `Delivery.find({ batchId: batch._id, status: { $in: ['DRAFT', 'READY'] } })`.
   - If 0 eligible deliveries, throw `400 BAD_REQUEST` ("Batch contains no deliveries eligible for optimization").
2. **Vehicle Resolution:**
   - If `vehicleIds` specified in request, fetch those vehicles. Else use `batch.vehicleIds`. If batch has none, fetch all active vehicles from `Vehicle` registry (`availability: { $in: ['AVAILABLE', 'ASSIGNED'] }`).
   - If 0 eligible vehicles, throw `400 BAD_REQUEST` ("No eligible fleet vehicles available for optimization").
3. **Multi-Vehicle Bin Packing:**
   - Call `packDeliveries(deliveries, vehicles, { vehicleTypePreference })`.
   - Obtains `vehicleBins` and `unassignedDeliveries`.
4. **Distance & Duration Matrix Construction:**
   - Call `buildMatrix(batch.depot, deliveries, { trafficScenario })`.
   - Obtains $(N+1) \times (N+1)$ matrix and $O(1)$ query functions.
5. **Per-Vehicle TSP Sequence Construction & 2-Opt Refinement:**
   - For each bin $B_k$:
     - Extract stop indices for bin deliveries from matrix points.
     - Generate initial tour using `constructNearestNeighborRoute(0, stopIndices, getDistance, getDuration, points)`.
     - Score baseline tour using `scoreRouteCost(baseDistance, vehicle)`.
     - Optimize tour using `optimize2Opt(baseTour, getDistance, getDuration, points, { maxIterations })`.
     - Score optimized tour using `scoreRouteCost(optDistance, vehicle)`.
     - Compute deltas using `calculateDeltas(baseline, optimized)`.
     - Construct stop documents with sequence, distance from previous, ETA, and customer waybill data.
     - Persist or update draft `Route` document in MongoDB.
6. **Audit Event Logging:**
   - Log `AUDIT_EVENT_TYPES.ROUTE_OPTIMIZED` capturing batch ID, routes count, and deltas.
7. **Response Serialization:**
   - Return HTTP 200 with both overall `baseline`, `optimized`, `deltas`, `unassignedDeliveries`, and individual `routes` array.

#### Success Response (HTTP 200)
```json
{
  "success": true,
  "message": "Routes successfully optimized for batch BBSR-EXP-01",
  "data": {
    "baseline": {
      "stops": [
        {
          "sequence": 1,
          "deliveryId": "6635c101234567890abcdef1",
          "orderReference": "#DEL-BBSR-001",
          "address": "KIIT Square, Patia, Plot 11, Bhubaneswar",
          "location": { "lat": 20.354, "lng": 85.817 },
          "weightKg": 12.5,
          "priority": "Standard",
          "distanceFromPrevKm": 8.4,
          "durationFromPrevMin": 20.1
        }
      ],
      "totalDistanceKm": 28.5,
      "totalDurationMin": 92.0,
      "costInr": 216.6,
      "co2Kg": 5.985
    },
    "optimized": {
      "stops": [
        {
          "sequence": 1,
          "deliveryId": "6635c101234567890abcdef3",
          "orderReference": "#DEL-BBSR-003",
          "address": "Bhawani Mall, Saheed Nagar, Plot 13, Bhubaneswar",
          "location": { "lat": 20.288, "lng": 85.852 },
          "weightKg": 8.0,
          "priority": "Urgent",
          "distanceFromPrevKm": 2.2,
          "durationFromPrevMin": 5.5
        }
      ],
      "totalDistanceKm": 20.2,
      "totalDurationMin": 68.0,
      "costInr": 153.52,
      "co2Kg": 4.242
    },
    "unassignedDeliveries": [],
    "deltas": {
      "distanceSavedKm": 8.3,
      "timeSavedMin": 24.0,
      "costSavedInr": 63.08,
      "co2AvoidedKg": 1.743,
      "percentDistanceReduction": 29.12
    },
    "routes": [
      {
        "id": "6635d201234567890abcdef1",
        "routeCode": "RT-BBSR-EXP-01-OD02AK1001",
        "batchId": "651a2f9b1c9d8b001a111111",
        "vehicleId": "651a2f9b1c9d8b001a222222",
        "driverId": "651a2f9b1c9d8b001a333333",
        "status": "DRAFT",
        "version": 1,
        "metrics": {
          "totalStops": 25,
          "totalDistanceKm": 20.2,
          "totalDurationMin": 68.0,
          "totalWeightKg": 320.5,
          "costInr": 153.52,
          "co2Kg": 4.242,
          "fuelConsumed": 1.62,
          "fuelUnit": "L"
        },
        "deltas": {
          "distanceSavedKm": 8.3,
          "timeSavedMin": 24.0,
          "costSavedInr": 63.08,
          "co2AvoidedKg": 1.743,
          "percentDistanceReduction": 29.12
        }
      }
    ]
  }
}
```

---

### 4.3 Endpoint 2: `POST /api/v1/routes/:id/dispatch`

#### Request Body
```json
{
  "driverId": "651a2f9b1c9d8b001a333333",
  "vehicleId": "651a2f9b1c9d8b001a222222"
}
```

#### Step-by-Step Controller Execution Flow
1. Fetch route by ID. If not found, return `404 NOT_FOUND`.
2. **State Validation:** Route must be in `DRAFT` or `OPTIMIZED` status. If already `DISPATCHED`, `IN_PROGRESS`, or `COMPLETED`, throw `409 CONFLICT` or `400 BAD_REQUEST` ("Route is already dispatched or completed").
3. **Driver & Vehicle Binding:**
   - Use provided `driverId`/`vehicleId` or route's pre-assigned references.
   - Verify driver exists and is available (`AVAILABLE` or `ON_DUTY`).
   - Verify vehicle exists and is operational.
   - Update driver availability to `IN_TRANSIT` (or `ON_DUTY`) and link `currentRouteId`.
   - Update vehicle availability to `IN_TRANSIT`.
4. **Route Mutation:**
   - Set `route.status = 'DISPATCHED'`.
   - Set `route.dispatchedAt = new Date()`.
   - Increment `route.version = (route.version || 1) + 1`.
   - Set `route.driverId = driver._id`.
   - Set `route.vehicleId = vehicle._id`.
   - Save route.
5. **Delivery Lifecycle State Machine Synchronization:**
   - Extract all `deliveryId` values from `route.stops`.
   - Transition deliveries from `READY` or `DRAFT` to `ASSIGNED`:
     ```javascript
     await Delivery.updateMany(
       { _id: { $in: deliveryIds } },
       {
         $set: {
           status: DELIVERY_STATUS.ASSIGNED,
           assignedVehicleId: route.vehicleId,
           assignedDriverId: route.driverId,
         },
       }
     );
     ```
6. **Batch State Synchronization:**
   - Fetch associated `DeliveryBatch`.
   - Increment `batch.metrics.assignedDeliveries += route.stops.length`.
   - If all batch deliveries are assigned, transition `batch.status = 'PLANNED'`.
   - Save batch.
7. **Immutable Audit Event Logging:**
   - Record `AUDIT_EVENT_TYPES.ROUTE_DISPATCHED`:
     ```javascript
     await recordAuditEvent({
       routeId: route._id,
       batchId: route.batchId,
       type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
       actorId: req.user.id,
       actorRole: req.user.role,
       action: `Dispatched route ${route.routeCode} with ${route.stops.length} stops to driver`,
       metadata: {
         version: route.version,
         vehicleId: route.vehicleId,
         driverId: route.driverId,
         totalStops: route.stops.length,
       },
     });
     ```
8. **Socket.IO Event Broadcast:**
   - Emit `route:dispatched` to tracking namespace room:
     ```javascript
     if (req.app.get('io')) {
       req.app.get('io').of('/socket/tracking').emit('route:dispatched', {
         routeId: route.id,
         driverId: route.driverId,
         vehicleId: route.vehicleId,
       });
     }
     ```
9. Return HTTP 200 with dispatched route, version, and confirmation.

#### Success Response (HTTP 200)
```json
{
  "success": true,
  "message": "Route RT-BBSR-EXP-01-OD02AK1001 successfully dispatched",
  "data": {
    "route": {
      "id": "6635d201234567890abcdef1",
      "routeCode": "RT-BBSR-EXP-01-OD02AK1001",
      "status": "DISPATCHED",
      "version": 2,
      "dispatchedAt": "2026-11-04T10:35:00.000Z",
      "stopsCount": 25,
      "vehicleId": "651a2f9b1c9d8b001a222222",
      "driverId": "651a2f9b1c9d8b001a333333"
    },
    "version": 2,
    "status": "DISPATCHED"
  }
}
```

---

### 4.4 Endpoints 3 & 4: `GET /api/v1/routes` & `GET /api/v1/routes/:id`

- **Role Authorization:** `ADMIN`, `FLEET_MANAGER`, `DRIVER`.
- **Broken Object Level Authorization (BOLA) Protection:**
  - If `req.user.role === 'DRIVER'`, query filter automatically forces `{ driverId: req.user.driverId }`. Drivers are strictly blocked from listing or viewing other drivers' routes.
  - In `GET /api/v1/routes/:id`: If caller is a driver, the controller checks `route.driverId.toString() === req.user.driverId.toString()`. Returns `403 FORBIDDEN` if mismatched.
- **Population:** Populates `vehicleId` (`vehicleId makeModel type fuelType capacityKg`), `driverId` (`licenseNumber phone userId`), and `batchId` (`code name date depot`).

---

### 4.5 Controller Implementation Blueprint: `server/src/controllers/routeController.js`

```javascript
// server/src/controllers/routeController.js
const Route = require('../models/Route');
const DeliveryBatch = require('../models/DeliveryBatch');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const { buildMatrix } = require('../services/optimization/matrixBuilder');
const { packDeliveries } = require('../services/optimization/binPacker');
const { constructNearestNeighborRoute } = require('../services/optimization/nearestNeighbor');
const { optimize2Opt } = require('../services/optimization/twoOpt');
const { scoreRouteCost, calculateDeltas } = require('../services/optimization/costScorer');
const { recordAuditEvent } = require('../services/auditService');
const { AppError } = require('../middleware/errorHandler');
const {
  AUDIT_EVENT_TYPES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  ROLES,
} = require('../config/constants');

/**
 * POST /api/v1/routes/optimize
 */
const optimizeRoutes = async (req, res, next) => {
  try {
    const { batchId, vehicleIds, options = {} } = req.body;

    if (!batchId) {
      throw new AppError('batchId is required', 400, 'MISSING_BATCH_ID');
    }

    const batch = await DeliveryBatch.findById(batchId);
    if (!batch) {
      throw new AppError(`Delivery batch not found for ID '${batchId}'`, 404, 'BATCH_NOT_FOUND');
    }

    // Retrieve eligible consignments for optimization
    const deliveries = await Delivery.find({
      batchId: batch._id,
      status: { $in: [DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY] },
    });

    if (deliveries.length === 0) {
      throw new AppError('Batch contains no eligible deliveries for route optimization', 400, 'NO_DELIVERIES_TO_OPTIMIZE');
    }

    // Resolve eligible vehicles
    let vehicles = [];
    if (Array.isArray(vehicleIds) && vehicleIds.length > 0) {
      vehicles = await Vehicle.find({ _id: { $in: vehicleIds } });
    } else if (Array.isArray(batch.vehicleIds) && batch.vehicleIds.length > 0) {
      vehicles = await Vehicle.find({ _id: { $in: batch.vehicleIds } });
    } else {
      vehicles = await Vehicle.find({
        availability: { $in: [VEHICLE_STATUS.AVAILABLE, VEHICLE_STATUS.ASSIGNED] },
      });
    }

    if (vehicles.length === 0) {
      throw new AppError('No eligible fleet vehicles found for route optimization', 400, 'NO_VEHICLES_AVAILABLE');
    }

    // 1. Bin-Packing Allocation
    const { vehicleBins, unassignedDeliveries } = packDeliveries(deliveries, vehicles, options);

    if (vehicleBins.length === 0 && unassignedDeliveries.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'All deliveries exceeded fleet capacity constraints and remain unassigned',
        data: {
          baseline: { stops: [], totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 },
          optimized: { stops: [], totalDistanceKm: 0, totalDurationMin: 0, costInr: 0, co2Kg: 0 },
          unassignedDeliveries,
          deltas: { distanceSavedKm: 0, timeSavedMin: 0, costSavedInr: 0, co2AvoidedKg: 0, percentDistanceReduction: 0 },
          routes: [],
        },
      });
    }

    // 2. Build Distance & Duration Matrix
    const matrix = await buildMatrix(batch.depot, deliveries, options);
    const { getDistanceKm, getDurationMin, points } = matrix;

    // Map delivery id -> matrix point index
    const deliveryIndexMap = new Map();
    for (let idx = 1; idx < points.length; idx++) {
      deliveryIndexMap.set(points[idx].id, idx);
    }

    const plannedRoutes = [];
    let aggregateBaseDist = 0;
    let aggregateBaseDur = 0;
    let aggregateBaseCost = 0;
    let aggregateBaseCo2 = 0;

    let aggregateOptDist = 0;
    let aggregateOptDur = 0;
    let aggregateOptCost = 0;
    let aggregateOptCo2 = 0;

    let firstBaselineStops = [];
    let firstOptimizedStops = [];

    // 3. Optimize Tour for each vehicle bin
    for (let bIdx = 0; bIdx < vehicleBins.length; bIdx++) {
      const bin = vehicleBins[bIdx];
      const vehicle = bin.vehicle;
      const binDeliveries = bin.deliveries;

      const stopIndices = binDeliveries
        .map(d => deliveryIndexMap.get((d._id || d.id).toString()))
        .filter(idx => idx !== undefined);

      // Baseline: Nearest Neighbor
      const baselineResult = constructNearestNeighborRoute(0, stopIndices, getDistanceKm, getDurationMin, points);
      const baselineCost = scoreRouteCost(baselineResult.totalDistanceKm, vehicle);

      // Optimized: Bounded 2-Opt
      const optResult = optimize2Opt(baselineResult.tourIndices, getDistanceKm, getDurationMin, points, options);
      const optCost = scoreRouteCost(optResult.totalDistanceKm, vehicle);

      const deltas = calculateDeltas(
        {
          totalDistanceKm: baselineResult.totalDistanceKm,
          totalDurationMin: baselineResult.totalDurationMin,
          costInr: baselineCost.costInr,
          co2Kg: baselineCost.co2Kg,
        },
        {
          totalDistanceKm: optResult.totalDistanceKm,
          totalDurationMin: optResult.totalDurationMin,
          costInr: optCost.costInr,
          co2Kg: optCost.co2Kg,
        }
      );

      // Construct detailed route stop documents
      let cumulativeTimeMin = 0;
      const stops = [];

      for (let sIdx = 0; sIdx < optResult.stopSequence.length; sIdx++) {
        const ptIdx = optResult.stopSequence[sIdx];
        const pt = points[ptIdx];
        const deliv = pt.delivery;
        const prevPtIdx = (sIdx === 0) ? 0 : optResult.stopSequence[sIdx - 1];

        const distFromPrev = getDistanceKm(prevPtIdx, ptIdx);
        const durFromPrev = getDurationMin(prevPtIdx, ptIdx);
        cumulativeTimeMin += durFromPrev;

        // Approximate ETA from 08:30 start
        const etaDate = new Date();
        etaDate.setHours(8, 30, 0, 0);
        etaDate.setMinutes(etaDate.getMinutes() + Math.round(cumulativeTimeMin));
        const etaStr = etaDate.toTimeString().substring(0, 5);

        cumulativeTimeMin += (deliv.serviceDurationMinutes || 10);

        stops.push({
          sequence: sIdx + 1,
          deliveryId: deliv._id || deliv.id,
          orderReference: deliv.orderReference,
          customer: deliv.customer,
          address: {
            street: deliv.address.street,
            zone: deliv.address.zone,
            city: deliv.address.city || 'Bhubaneswar',
            postalCode: deliv.address.postalCode,
          },
          location: {
            lat: pt.lat,
            lng: pt.lng,
          },
          weightKg: deliv.weightKg,
          priority: deliv.priority,
          timeWindow: deliv.timeWindow,
          eta: etaStr,
          distanceFromPrevKm: distFromPrev,
          durationFromPrevMin: durFromPrev,
          status: 'PENDING',
        });
      }

      // Generate Route Code
      const routeCode = `RT-${batch.code}-${vehicle.vehicleId.replace(/[^A-Z0-9]/gi, '')}-${bIdx + 1}`;

      // Upsert Route in DRAFT status
      let route = await Route.findOne({ batchId: batch._id, vehicleId: vehicle._id, status: 'DRAFT' });
      if (!route) {
        route = new Route({
          routeCode,
          batchId: batch._id,
          vehicleId: vehicle._id,
          driverId: vehicle.assignedDriverId || null,
          depot: batch.depot,
        });
      }

      route.stops = stops;
      route.status = 'DRAFT';
      route.metrics = {
        totalStops: stops.length,
        totalDistanceKm: optResult.totalDistanceKm,
        totalDurationMin: optResult.totalDurationMin,
        totalWeightKg: bin.totalWeightKg,
        costInr: optCost.costInr,
        co2Kg: optCost.co2Kg,
        fuelConsumed: optCost.fuelConsumed,
        fuelUnit: optCost.fuelUnit,
      };
      route.baseline = {
        totalDistanceKm: baselineResult.totalDistanceKm,
        totalDurationMin: baselineResult.totalDurationMin,
        costInr: baselineCost.costInr,
        co2Kg: baselineCost.co2Kg,
      };
      route.deltas = deltas;
      route.optimizationMetadata = {
        algorithm: '2-OPT_TSP_NN',
        maxIterations: options.maxIterations || 1000,
        executedIterations: optResult.iterations,
        trafficScenario: matrix.trafficScenario,
        matrixSource: matrix.source,
        converged: optResult.converged,
      };

      await route.save();
      plannedRoutes.push(route);

      // Accumulate aggregates
      aggregateBaseDist += baselineResult.totalDistanceKm;
      aggregateBaseDur += baselineResult.totalDurationMin;
      aggregateBaseCost += baselineCost.costInr;
      aggregateBaseCo2 += baselineCost.co2Kg;

      aggregateOptDist += optResult.totalDistanceKm;
      aggregateOptDur += optResult.totalDurationMin;
      aggregateOptCost += optCost.costInr;
      aggregateOptCo2 += optCost.co2Kg;

      if (bIdx === 0) {
        firstBaselineStops = baselineResult.stopSequence.map(idx => points[idx].delivery);
        firstOptimizedStops = stops;
      }
    }

    // Aggregate Deltas
    const aggregateDeltas = calculateDeltas(
      {
        totalDistanceKm: aggregateBaseDist,
        totalDurationMin: aggregateBaseDur,
        costInr: aggregateBaseCost,
        co2Kg: aggregateBaseCo2,
      },
      {
        totalDistanceKm: aggregateOptDist,
        totalDurationMin: aggregateOptDur,
        costInr: aggregateOptCost,
        co2Kg: aggregateOptCo2,
      }
    );

    // Audit Event
    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.ROUTE_OPTIMIZED,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Optimized ${plannedRoutes.length} routes for batch ${batch.code}`,
      metadata: {
        routesCount: plannedRoutes.length,
        unassignedCount: unassignedDeliveries.length,
        distanceSavedKm: aggregateDeltas.distanceSavedKm,
        costSavedInr: aggregateDeltas.costSavedInr,
        trafficScenario: matrix.trafficScenario,
      },
    });

    res.status(200).json({
      success: true,
      message: `Successfully optimized ${plannedRoutes.length} route(s) for batch ${batch.code}`,
      data: {
        baseline: {
          stops: firstBaselineStops,
          totalDistanceKm: parseFloat(aggregateBaseDist.toFixed(2)),
          totalDurationMin: parseFloat(aggregateBaseDur.toFixed(1)),
          costInr: parseFloat(aggregateBaseCost.toFixed(2)),
          co2Kg: parseFloat(aggregateBaseCo2.toFixed(3)),
        },
        optimized: {
          stops: firstOptimizedStops,
          totalDistanceKm: parseFloat(aggregateOptDist.toFixed(2)),
          totalDurationMin: parseFloat(aggregateOptDur.toFixed(1)),
          costInr: parseFloat(aggregateOptCost.toFixed(2)),
          co2Kg: parseFloat(aggregateOptCo2.toFixed(3)),
        },
        unassignedDeliveries,
        deltas: aggregateDeltas,
        routes: plannedRoutes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/routes/:id/dispatch
 */
const dispatchRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driverId, vehicleId } = req.body;

    const route = await Route.findById(id);
    if (!route) {
      throw new AppError(`Route not found for ID '${id}'`, 404, 'ROUTE_NOT_FOUND');
    }

    if (route.status === 'DISPATCHED' || route.status === 'IN_PROGRESS' || route.status === 'COMPLETED') {
      throw new AppError(`Route is already in status '${route.status}' and cannot be re-dispatched`, 409, 'INVALID_ROUTE_STATUS');
    }

    // Resolve Driver & Vehicle
    const finalDriverId = driverId || route.driverId;
    const finalVehicleId = vehicleId || route.vehicleId;

    if (!finalDriverId) {
      throw new AppError('A valid driverId must be assigned prior to dispatch', 422, 'DRIVER_ASSIGNMENT_REQUIRED');
    }
    if (!finalVehicleId) {
      throw new AppError('A valid vehicleId must be assigned prior to dispatch', 422, 'VEHICLE_ASSIGNMENT_REQUIRED');
    }

    const driver = await Driver.findById(finalDriverId);
    if (!driver) {
      throw new AppError('Assigned driver profile does not exist', 404, 'DRIVER_NOT_FOUND');
    }

    const vehicle = await Vehicle.findById(finalVehicleId);
    if (!vehicle) {
      throw new AppError('Assigned vehicle does not exist', 404, 'VEHICLE_NOT_FOUND');
    }

    // 1. Transition Route
    route.status = 'DISPATCHED';
    route.driverId = driver._id;
    route.vehicleId = vehicle._id;
    route.dispatchedAt = new Date();
    route.version = (route.version || 1) + 1;
    await route.save();

    // 2. Transition Vehicle & Driver status
    vehicle.availability = VEHICLE_STATUS.IN_TRANSIT;
    vehicle.assignedDriverId = driver._id;
    await vehicle.save();

    driver.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
    driver.assignedVehicleId = vehicle._id;
    await driver.save();

    // 3. Transition All Associated Deliveries to ASSIGNED
    const deliveryIds = route.stops.map(s => s.deliveryId);
    if (deliveryIds.length > 0) {
      await Delivery.updateMany(
        { _id: { $in: deliveryIds } },
        {
          $set: {
            status: DELIVERY_STATUS.ASSIGNED,
            assignedVehicleId: vehicle._id,
            assignedDriverId: driver._id,
          },
        }
      );
    }

    // 4. Update Batch Metrics
    const batch = await DeliveryBatch.findById(route.batchId);
    if (batch) {
      batch.metrics.assignedDeliveries = (batch.metrics.assignedDeliveries || 0) + deliveryIds.length;
      if (batch.status === 'READY') {
        batch.status = 'PLANNED';
      }
      await batch.save();
    }

    // 5. Immutable Audit Event
    await recordAuditEvent({
      routeId: route._id,
      batchId: route.batchId,
      type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Dispatched route ${route.routeCode} with ${route.stops.length} stops to driver ${driver.licenseNumber}`,
      metadata: {
        version: route.version,
        driverId: driver._id,
        vehicleId: vehicle._id,
        stopsCount: route.stops.length,
      },
    });

    // 6. Real-Time Broadcast if Socket Gateway Available
    if (req.app.get('io')) {
      req.app.get('io').of('/socket/tracking').emit('route:dispatched', {
        routeId: route.id,
        driverId: driver._id.toString(),
        vehicleId: vehicle._id.toString(),
        version: route.version,
      });
    }

    res.status(200).json({
      success: true,
      message: `Route ${route.routeCode} successfully dispatched`,
      data: {
        route,
        version: route.version,
        status: 'DISPATCHED',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/routes
 */
const getRoutes = async (req, res, next) => {
  try {
    const { batchId, vehicleId, driverId, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    // BOLA Enforcement for Drivers
    if (req.user.role === ROLES.DRIVER) {
      if (!req.user.driverId) {
        return res.status(200).json({
          success: true,
          data: { routes: [], total: 0, page: 1, totalPages: 1 },
        });
      }
      filter.driverId = req.user.driverId;
    } else {
      if (driverId) filter.driverId = driverId;
    }

    if (batchId) filter.batchId = batchId;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [routes, total] = await Promise.all([
      Route.find(filter)
        .populate('vehicleId', 'vehicleId makeModel type fuelType capacityKg')
        .populate({
          path: 'driverId',
          select: 'licenseNumber phone rating userId availability',
          populate: { path: 'userId', select: 'name' },
        })
        .populate('batchId', 'code name date depot')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Route.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        routes,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/routes/:id
 */
const getRouteById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const route = await Route.findById(id)
      .populate('vehicleId', 'vehicleId makeModel type fuelType capacityKg energyKWhPerKm kmPerLitre')
      .populate({
        path: 'driverId',
        select: 'licenseNumber phone rating userId availability',
        populate: { path: 'userId', select: 'name phone email' },
      })
      .populate('batchId', 'code name date depot');

    if (!route) {
      throw new AppError(`Route not found for ID '${id}'`, 404, 'ROUTE_NOT_FOUND');
    }

    // BOLA Enforcement for Drivers
    if (req.user.role === ROLES.DRIVER) {
      if (!route.driverId || route.driverId._id.toString() !== req.user.driverId.toString()) {
        throw new AppError('Access denied: You can only view routes assigned to your profile', 403, 'FORBIDDEN_ROUTE_ACCESS');
      }
    }

    res.status(200).json({
      success: true,
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  optimizeRoutes,
  dispatchRoute,
  getRoutes,
  getRouteById,
};
```

---

### 4.6 Route Definitions & Router Mount: `server/src/routes/routeRoutes.js`

```javascript
// server/src/routes/routeRoutes.js
const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All route operations require authentication
router.use(authenticate);

// Optimization & Dispatch: restricted to ADMIN and FLEET_MANAGER
router.post(
  '/optimize',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.optimizeRoutes
);

router.post(
  '/:id/dispatch',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.dispatchRoute
);

// Route Queries: accessible by ADMIN, FLEET_MANAGER, and DRIVER (with BOLA)
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  routeController.getRoutes
);

router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  routeController.getRouteById
);

module.exports = router;
```

#### Mounting in `server/src/routes/index.js`
In `server/src/routes/index.js`, add:
```javascript
const routeRoutes = require('./routeRoutes');
// ...
router.use('/routes', routeRoutes);
```

---

## 5. Algorithmic Edge Cases & Invariant Guarantees

### 5.1 Trivial Route Handling
1. **0 Deliveries:**
   - Input: $N = 0$.
   - Output: Empty stops array, distance = 0, duration = 0, 0 iterations.
2. **1 Delivery ($N = 1$):**
   - Input: Rasulgarh Depot ($D$) $\to$ Stop $S_1$.
   - Tour: $[D, S_1, D]$.
   - Nearest Neighbor directly produces $[0, 1, 0]$.
   - 2-Opt loop bounds: $i = 1$ to $maxStopIndex - 1 = 0$. Condition $1 < 0$ is false. Exactly 0 swaps evaluated.
   - Result: Returned in $< 0.1\text{ ms}$, total distance = $d(D, S_1) + d(S_1, D)$.
3. **2 Deliveries ($N = 2$):**
   - Tour: $[D, S_1, S_2, D]$.
   - Only a single pair exists: $i = 1, k = 2$.
   - Swapping tests $[D, S_2, S_1, D]$.
   - If $d(D, S_2) + d(S_2, S_1) + d(S_1, D) < d(D, S_1) + d(S_1, S_2) + d(S_2, D) - \epsilon$, swap occurs.
   - Algorithm terminates on next iteration.

### 5.2 Exact Payload Capacity Fit vs Overflow
- **Exact Fit:** Vehicle capacity = 1000 kg. Consignments total exactly 1000.00 kg.
  - Assignment succeeds with $100\%$ utilization. Remaining capacity = $0.00\text{ kg}$.
- **Overflow by $0.01\text{ kg}$:** Vehicle capacity = 1000 kg. Consignments total 1000.01 kg.
  - Bin packer detects $1000.00 - 1000.01 < -1e-6$.
  - Consignment is rejected from that vehicle. If no other vehicle has room, it is cleanly appended to `unassignedDeliveries` with reason `'CAPACITY_OVERFLOW'`.

### 5.3 Determinism & Idempotency
- All sorting steps in `binPacker`, `nearestNeighbor`, and `twoOpt` employ explicit secondary and tertiary tie-breakers (`orderReference`, alphanumeric IDs).
- Matrix lookups use consistent coordinate hashing.
- **Guarantee:** Running optimization 100 times on identical inputs produces byte-for-byte identical stop orders, distances, and costs.

### 5.4 Convergence Verification on Canonical Batch `BBSR-EXP-01`
- Canonical batch `BBSR-EXP-01` contains 25 deliveries seeded from `seedBhubaneswar.js` across Saheed Nagar, Jaydev Vihar, Patia, Khandagiri, and Chandrasekharpur.
- Starting at Rasulgarh Hub ($20.2961, 85.8645$):
  - Baseline Nearest Neighbor distance: $\sim 35\text{--}42\text{ km}$.
  - 2-Opt untangles multi-cluster crossings.
  - Optimized distance: $\sim 24\text{--}28\text{ km}$.
  - Net reduction: $\ge 20\%$.
  - Convergence achieved in $< 35$ iterations ($< 15\text{ ms}$ CPU runtime).

---

## 6. Comprehensive Test Strategy & Test Suite Blueprint

### 6.1 Unit Tests (`server/tests/unit/optimization.test.js`)
1. **`matrixBuilder.test.js`**:
   - TC-OPT-MAT-1: Constructs $(N+1) \times (N+1)$ distance and duration matrices with Rasulgarh Depot at index 0.
   - TC-OPT-MAT-2: Correctly converts meters to kilometers and seconds to minutes.
   - TC-OPT-MAT-3: Throws `422 UNRESOLVED_GEOCODE` for deliveries missing location coordinates.
   - TC-OPT-MAT-4: Transparently falls back to simulated traffic service when Google Maps API key is absent.
2. **`binPacker.test.js`**:
   - TC-OPT-BIN-1: Single vehicle with ample capacity receives all consignments.
   - TC-OPT-BIN-2: Multi-vehicle capacity partitioning honors vehicle `capacityKg` without exceeding limit.
   - TC-OPT-BIN-3: Handles exact capacity fit (1000 kg capacity with exactly 1000 kg cargo).
   - TC-OPT-BIN-4: Rejects 1000.01 kg cargo with `CAPACITY_OVERFLOW` in `unassignedDeliveries`.
   - TC-OPT-BIN-5: Flags single cargo heavier than max fleet capacity with `EXCEEDS_VEHICLE_MAX_CAPACITY`.
   - TC-OPT-BIN-6: `vehicleTypePreference: 'EV'` fills EV vans before ICE diesel vehicles.
   - TC-OPT-BIN-7: Strict determinism: 10 repeated runs produce identical vehicle assignments.
3. **`nearestNeighbor.test.js`**:
   - TC-OPT-NN-1: Generates valid closed loop starting and ending at depot ($0 \to s_1 \dots \to s_m \to 0$).
   - TC-OPT-NN-2: Breaks distance ties in favor of `COLD_CHAIN` and `URGENT` consignments.
   - TC-OPT-NN-3: Trivial route: 1 stop returns $[0, 1, 0]$ with accurate roundtrip distance.
4. **`twoOpt.test.js`**:
   - TC-OPT-2OPT-1: Successfully untangles crossing edges in a synthetic crossed rectangle.
   - TC-OPT-2OPT-2: Invariant: $D_{\text{optimized}} \le D_{\text{baseline}}$ holds across all randomized coordinates.
   - TC-OPT-2OPT-3: Bounded execution: halts within `maxIterations` or when $\Delta \ge -\epsilon$.
   - TC-OPT-2OPT-4: Trivial route: 0, 1, and 2 stops terminate in 0 or 1 iteration without error.
5. **`costScorer.test.js`**:
   - TC-OPT-COST-1: EV vehicle calculation: $10\text{ km} \times 0.18\text{ kWh/km} = 1.8\text{ kWh}$; $1.8 \times 8.00 = ₹14.40$; $0.0\text{ kg CO}_2$.
   - TC-OPT-COST-2: Diesel vehicle calculation: $10\text{ km} \times 0.08\text{ L/km} = 0.8\text{ L}$; $0.8 \times 95.00 = ₹76.00$; $2.1\text{ kg CO}_2$.
   - TC-OPT-COST-3: Deltas calculation handles 0 baseline distance without division-by-zero or `NaN`.

### 6.2 Integration Tests (`server/tests/integration/route.test.js`)
1. **`POST /api/v1/routes/optimize`**:
   - TC-INT-ROUTE-1: Optimizes canonical batch `BBSR-EXP-01` returning HTTP 200, valid baseline, optimized, deltas, and `DRAFT` route.
   - TC-INT-ROUTE-2: RBAC validation: Returns 401 without Bearer token, 403 for `DRIVER`, 200 for `ADMIN` and `FLEET_MANAGER`.
   - TC-INT-ROUTE-3: Rejects invalid or non-existent `batchId` with 404 `BATCH_NOT_FOUND`.
   - TC-INT-ROUTE-4: Validates payload deltas: `distanceSavedKm > 0`, `percentDistanceReduction > 0`.
2. **`POST /api/v1/routes/:id/dispatch`**:
   - TC-INT-DISPATCH-1: Successfully dispatches route: transitions route to `DISPATCHED`, deliveries to `ASSIGNED`, vehicle/driver to `IN_TRANSIT`, increments version.
   - TC-INT-DISPATCH-2: Creates immutable `AuditEvent` with type `ROUTE_DISPATCHED`.
   - TC-INT-DISPATCH-3: Idempotency protection: Rejects re-dispatch of already `DISPATCHED` route with 409 `INVALID_ROUTE_STATUS`.
   - TC-INT-DISPATCH-4: Returns 404 for non-existent route ID.
3. **`GET /api/v1/routes` & `GET /api/v1/routes/:id`**:
   - TC-INT-GET-1: Lists routes with pagination and filters.
   - TC-INT-GET-2: BOLA enforcement: Driver cannot query or retrieve other drivers' routes (returns 403 or filtered list).

---

## 7. Implementation Checklist for Milestone 2 Workers

- [ ] Create `server/src/models/Route.js` matching Section 3 schema.
- [ ] Implement `server/src/services/optimization/matrixBuilder.js` matching Section 2.1.
- [ ] Implement `server/src/services/optimization/binPacker.js` matching Section 2.2.
- [ ] Implement `server/src/services/optimization/nearestNeighbor.js` matching Section 2.3.
- [ ] Implement `server/src/services/optimization/twoOpt.js` matching Section 2.4.
- [ ] Implement `server/src/services/optimization/costScorer.js` matching Section 2.5.
- [ ] Implement `server/src/controllers/routeController.js` matching Section 4.5.
- [ ] Create `server/src/routes/routeRoutes.js` and mount in `server/src/routes/index.js` matching Section 4.6.
- [ ] Implement comprehensive test suites in `server/tests/optimization.test.js` and `server/tests/routes.test.js`.
- [ ] Verify 100% test pass on `npm test` across all unit and integration suites.
