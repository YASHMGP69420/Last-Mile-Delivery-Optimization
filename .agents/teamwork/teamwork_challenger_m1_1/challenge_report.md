# Empirical Adversarial Challenge Report: Milestone 1 Backend

**Agent:** `teamwork_challenger_m1_1` (Critic & Specialist)  
**Date:** 2026-11-03  
**Target:** Milestone 1 Core Scaffolding, Identity & Fleet Operations (`server/`)  
**Test Harness:** `server/tests/adversarial.test.js` (20 test cases executed)  
**Result Summary:** 16 PASS, 4 FAIL (Critical Defects Found)

---

## 1. Challenge Summary

**Overall Risk Assessment:** **CRITICAL**

While the core JWT authentication, RBAC route guards, and password sanitization logic demonstrate high compliance, empirical challenge testing identified **critical structural flaws** in:
1. **Delivery Finite State Machine Bypass:** The lifecycle flow (`DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED/FAILED`) is strictly enforced only on `PATCH /status`, but completely bypassed on `POST /complete`, `POST /fail`, and `PATCH /assign`.
2. **Terminal State Mutation:** Consignments in `COMPLETED` status can be illegally mutated to `FAILED` or re-assigned to drivers and vehicles.
3. **1:1 Vehicle-Driver Mutual Exclusivity Race Conditions:** Under concurrent requests, the system fails to prevent duplicate bindings. Two drivers can simultaneously bind to the same vehicle, and multiple vehicles can simultaneously point to the same driver. This is caused by lack of atomic compare-and-swap operations in the controller and absence of unique indexes in Mongoose schemas.

---

## 2. Empirical Challenges & Vulnerabilities Found

### [Critical] Challenge 1: Delivery Lifecycle State Machine Bypass via `/complete` and `/fail`

- **Assumption Challenged:** Worker assumed that verifying transitions in `PATCH /api/v1/deliveries/:id/status` was sufficient to enforce Feature 9 ("Enforce DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED/FAILED").
- **Attack Scenario:**
  1. An actor creates a delivery in `DRAFT` status.
  2. The actor immediately calls `POST /api/v1/deliveries/:id/complete` with `{ otp: '1234' }`.
  3. Controller `completeDelivery` (`server/src/controllers/deliveryController.js:408-451`) sets `delivery.status = DELIVERY_STATUS.COMPLETED` and saves without validating current status.
  4. Similarly, calling `POST /api/v1/deliveries/:id/fail` directly transitions a `DRAFT` consignment to `FAILED`.
- **Blast Radius:** Any unassigned, un-dispatched draft consignment can be marked completed or failed immediately, bypassing batch composition, dispatch snapshotting, route optimization, driver assignment, and delivery proof verification.
- **Empirical Evidence (`TC-ADV-STATE-5`):**
  - Command: `npm test --workspace=server -- tests/adversarial.test.js`
  - Output: `Expected: 400 Bad Request`, `Received: 200 OK`.
- **Mitigation:**
  In `completeDelivery`:
  ```javascript
  if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
    throw new AppError(`Cannot complete delivery in status '${delivery.status}'. Consignment must be in 'OUT_FOR_DELIVERY' status.`, 400, 'INVALID_STATUS_TRANSITION');
  }
  ```
  In `failDelivery`:
  ```javascript
  if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
    throw new AppError(`Cannot fail delivery in status '${delivery.status}'. Consignment must be in 'OUT_FOR_DELIVERY' status.`, 400, 'INVALID_STATUS_TRANSITION');
  }
  ```

---

### [High] Challenge 2: Mutation and Re-assignment of Terminal `COMPLETED` Deliveries

- **Assumption Challenged:** Deliveries in terminal state `COMPLETED` (`VALID_TRANSITIONS[COMPLETED] = []`) cannot be altered or reassigned.
- **Attack Scenario:**
  1. Consignment completes delivery and enters `COMPLETED` state.
  2. Actor calls `POST /api/v1/deliveries/:id/fail` with `{ failureReason: 'CUSTOMER_UNAVAILABLE' }`.
  3. Controller overwrites `status` from `COMPLETED` to `FAILED` and logs an exception audit event.
  4. Actor calls `PATCH /api/v1/deliveries/:id/assign` with `{ vehicleId, driverId }`.
  5. Controller `assignDelivery` (`deliveryController.js:293-324`) overwrites `status` from `COMPLETED` to `ASSIGNED`.
- **Blast Radius:** Corruption of completed operational manifests, ledger inaccuracy, fraudulent dispute submissions, and falsification of delivery KPIs.
- **Empirical Evidence (`TC-ADV-STATE-7`):**
  - Command: `npm test --workspace=server -- tests/adversarial.test.js`
  - Output: `Expected: 400 Bad Request`, `Received: 200 OK`.
- **Mitigation:**
  In `assignDelivery`:
  ```javascript
  if (![DELIVERY_STATUS.READY, DELIVERY_STATUS.ASSIGNED].includes(delivery.status)) {
    throw new AppError(`Cannot assign delivery in status '${delivery.status}'`, 400, 'DELIVERY_LOCKED');
  }
  ```
  In `failDelivery`:
  ```javascript
  if (delivery.status === DELIVERY_STATUS.COMPLETED) {
    throw new AppError('Cannot fail an already completed delivery', 400, 'DELIVERY_TERMINAL');
  }
  ```

---

### [Critical] Challenge 3: 1:1 Vehicle-Driver Mutual Exclusivity Broken under Concurrent Binding

- **Assumption Challenged:** Sequential checks in `driverController.assignVehicle` prevent multiple drivers from binding the same vehicle.
- **Attack Scenario:**
  1. Vehicle `OD-02-EXA-1` is `AVAILABLE` with `assignedDriverId: null`.
  2. Two drivers (Driver A and Driver B) or managers concurrently submit assignment requests via `Promise.all([ PUT /drivers/A/assign, PUT /drivers/B/assign ])`.
  3. Both requests execute `const vehicle = await Vehicle.findById(vehicleId)` before either has completed `await vehicle.save()`.
  4. Both requests pass the check `if (vehicle.assignedDriverId)` because it was null at read time.
  5. Both drivers save `assignedVehicleId = vehicle._id`.
- **Blast Radius:** In MongoDB, Driver A and Driver B both reference `vehicleA`. When Driver A starts a route, telemetry and parcel tracking cross-contaminate Driver B's shift. Physical impossibility of one vehicle being driven by two drivers simultaneously.
- **Empirical Evidence (`TC-ADV-FLEET-3`):**
  - Command: `npm test --workspace=server -- tests/adversarial.test.js`
  - Output:
    ```
    Expected: null
    Received: "6aea2bc9728dac9638825064"
    ```
    Both `driverA` and `driverB` hold the same `assignedVehicleId`.
- **Mitigation:**
  1. Add a unique sparse index in `server/src/models/Driver.js`:
     ```javascript
     driverSchema.index({ assignedVehicleId: 1 }, { unique: true, sparse: true });
     ```
  2. In `driverController.js`, use atomic conditional updates (`findOneAndUpdate`) with optimistic concurrency:
     ```javascript
     const updatedVehicle = await Vehicle.findOneAndUpdate(
       { _id: vehicleId, assignedDriverId: { $in: [null, driver._id] }, availability: { $nin: ['RETIRED', 'MAINTENANCE'] } },
       { assignedDriverId: driver._id, availability: VEHICLE_STATUS.ASSIGNED },
       { new: true }
     );
     if (!updatedVehicle) {
       throw new AppError('Vehicle is no longer available or was concurrently assigned', 409, 'CONCURRENCY_CONFLICT');
     }
     ```

---

### [High] Challenge 4: Single Driver Concurrent Multi-Vehicle Binding

- **Assumption Challenged:** Driver can only be associated with at most one active vehicle at any given time.
- **Attack Scenario:**
  1. Driver A concurrently submits assignment requests for Vehicle 1 and Vehicle 2 simultaneously.
  2. The application assigns Driver A to Vehicle 1 and Vehicle 2 in parallel.
  3. While Driver A's record records the winning vehicle, the losing vehicle's `assignedDriverId` is NOT cleared and remains pointing to Driver A.
- **Blast Radius:** Vehicle registry reports Driver A as the active driver for multiple vehicles. Fleet dashboard shows multiple vehicles checked out to a single operator.
- **Empirical Evidence (`TC-ADV-FLEET-4`):**
  - Command: `npm test --workspace=server -- tests/adversarial.test.js`
  - Output:
    ```
    Expected: null
    Received: "6aea2bca728dac963882508b"
    ```
    Losing vehicle still retains `assignedDriverId: driverA._id`.
- **Mitigation:**
  1. Add a unique sparse index in `server/src/models/Vehicle.js`:
     ```javascript
     vehicleSchema.index({ assignedDriverId: 1 }, { unique: true, sparse: true });
     ```
  2. Implement an atomic assignment transaction or multi-document Mongoose session to guarantee bi-directional unlinking.

---

## 3. Stress Test Results Breakdown

| Test ID | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **TC-ADV-AUTH-1** | Driver / Manager accessing Admin routes | 403 `INSUFFICIENT_PERMISSIONS` | 403 `INSUFFICIENT_PERMISSIONS` | **PASS** |
| **TC-ADV-AUTH-2** | Driver accessing vehicle/driver/delivery CRUD | 403 `INSUFFICIENT_PERMISSIONS` | 403 `INSUFFICIENT_PERMISSIONS` | **PASS** |
| **TC-ADV-AUTH-3** | Tampered JWT signature & `alg: none` | 401 `INVALID_TOKEN` | 401 `INVALID_TOKEN` | **PASS** |
| **TC-ADV-AUTH-4** | Expired JWT & malformed auth headers | 401 `TOKEN_EXPIRED` / `UNAUTHORIZED` | 401 `TOKEN_EXPIRED` / `UNAUTHORIZED` | **PASS** |
| **TC-ADV-AUTH-5** | Re-using token after `POST /auth/logout` | 401 `TOKEN_REVOKED` | 401 `TOKEN_REVOKED` | **PASS** |
| **TC-ADV-PWD-1** | `POST /auth/login` response payload | `passwordHash` strictly absent | No passwordHash or bcrypt hash in JSON | **PASS** |
| **TC-ADV-PWD-2** | `POST /auth/users` response payload | `passwordHash` strictly absent | No passwordHash or bcrypt hash in JSON | **PASS** |
| **TC-ADV-PWD-3** | `GET /auth/me` response payload | `passwordHash` / `refreshToken` absent | Strictly sanitized user profile | **PASS** |
| **TC-ADV-PWD-4** | Populated `User` references in queries | No passwordHash in populated docs | Excluded via schema `select: false` | **PASS** |
| **TC-ADV-STATE-1** | Direct illegal transitions via `PATCH /status` | 400 `INVALID_STATUS_TRANSITION` | 400 `INVALID_STATUS_TRANSITION` | **PASS** |
| **TC-ADV-STATE-2** | Transitions from terminal `COMPLETED` via `PATCH /status` | 400 `INVALID_STATUS_TRANSITION` | 400 `INVALID_STATUS_TRANSITION` | **PASS** |
| **TC-ADV-STATE-3** | Modifying (PUT) `COMPLETED` or `OUT_FOR_DELIVERY` delivery | 400 `DELIVERY_LOCKED` | 400 `DELIVERY_LOCKED` | **PASS** |
| **TC-ADV-STATE-4** | Deleting active or completed deliveries | 400 `DELIVERY_NOT_DELETABLE` | 400 `DELIVERY_NOT_DELETABLE` | **PASS** |
| **TC-ADV-STATE-5** | Direct `POST /complete` on `DRAFT` consignment | 400 `INVALID_STATUS_TRANSITION` | **200 OK (Allowed direct transition)** | **FAIL** |
| **TC-ADV-STATE-6** | `POST /fail` without `failureReason` | 400 `MISSING_FAILURE_REASON` | 400 `MISSING_FAILURE_REASON` | **PASS** |
| **TC-ADV-STATE-7** | Reassigning or failing a `COMPLETED` delivery | 400 Bad Request | **200 OK (Allowed mutation of terminal state)** | **FAIL** |
| **TC-ADV-FLEET-1** | Assigning `RETIRED` or `MAINTENANCE` vehicle | 400 `VEHICLE_UNAVAILABLE` | 400 `VEHICLE_UNAVAILABLE` | **PASS** |
| **TC-ADV-FLEET-2** | Stealing vehicle from driver in `IN_TRANSIT` | 409 `VEHICLE_IN_ACTIVE_TRANSIT` | 409 `VEHICLE_IN_ACTIVE_TRANSIT` | **PASS** |
| **TC-ADV-FLEET-3** | Concurrent binding of 1 vehicle by 2 drivers | One succeeds, one rejected or cleanly unlinked | **Both drivers simultaneously linked to same vehicle** | **FAIL** |
| **TC-ADV-FLEET-4** | Concurrent binding of 2 vehicles by 1 driver | Exactly one vehicle paired, other freed | **Multiple vehicles retain link to single driver** | **FAIL** |

---

## 4. Unchallenged Areas

- **Real-Time GPS Streaming & WebSockets (`/socket.io`):** Scope of Milestone 2 / 3.
- **Route Optimization Heuristics & Geocoding:** Scope of Milestone 2.
- **Proof-of-Delivery Photo Upload to Object Storage (S3/GCS):** Mocked via data URL in M1.
