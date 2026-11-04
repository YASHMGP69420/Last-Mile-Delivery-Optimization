# Milestone 1 Adversarial Challenge Handoff Report

**Author:** `teamwork_challenger_m1_1` (Critic & Specialist)  
**Date:** 2026-11-03  
**Target:** Milestone 1 Core Backend Verification (`server/`)  
**Verdict:** **`VERDICT: REQUEST_CHANGES (failures found)`**

---

## 1. Observation

Adversarial test harness `server/tests/adversarial.test.js` was written and executed across 20 distinct challenge vectors. 16 tests passed and 4 tests failed.

### 1.1 Verbatim Failure 1: State Machine Bypass on `/complete` and `/fail`
- **Location:** `server/src/controllers/deliveryController.js:408-451` (`completeDelivery`) and `454-492` (`failDelivery`).
- **Command:** `npm test --workspace=server -- tests/adversarial.test.js`
- **Verbatim Error Output:**
  ```
  ● Empirical Adversarial Challenge Test Suite (server/tests/adversarial.test.js) › 3. Delivery State Machine Invariants & Illegal Transitions › TC-ADV-STATE-5: State Machine Bypass Check via POST /deliveries/:id/complete and /fail

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 200

      506 |
      507 |       // Empirical Check: Direct transition from DRAFT to COMPLETED via /complete MUST be rejected with 400
    > 508 |       expect(completeDraftRes.status).toBe(400);
          |                                       ^
      509 |       expect(failDraftRes.status).toBe(400);
      510 |     });
  ```
- **Code Observation:** In `deliveryController.js:430`, `delivery.status = DELIVERY_STATUS.COMPLETED; await delivery.save();` executes unconditionally without validating that `delivery.status === DELIVERY_STATUS.OUT_FOR_DELIVERY`.

### 1.2 Verbatim Failure 2: Mutation of Terminal COMPLETED Deliveries
- **Location:** `server/src/controllers/deliveryController.js:293-324` (`assignDelivery`) and `454-492` (`failDelivery`).
- **Command:** `npm test --workspace=server -- tests/adversarial.test.js`
- **Verbatim Error Output:**
  ```
  ● Empirical Adversarial Challenge Test Suite (server/tests/adversarial.test.js) › 3. Delivery State Machine Invariants & Illegal Transitions › TC-ADV-STATE-7: Illegal status transitions and reassignments on terminal COMPLETED delivery

    expect(received).toBe(expected) // Object.is equality

    Expected: 400
    Received: 200

      549 |
      550 |       // Both of these must be rejected with 400!
    > 551 |       expect(failCompletedRes.status).toBe(400);
          |                                       ^
      552 |       expect(assignCompletedRes.status).toBe(400);
  ```
- **Code Observation:** `VALID_TRANSITIONS[COMPLETED]` is defined as `[]` in `deliveryController.js:21`, but `failDelivery` and `assignDelivery` bypass `VALID_TRANSITIONS` entirely, permitting an already completed parcel to be mutated back to `FAILED` or `ASSIGNED`.

### 1.3 Verbatim Failure 3: Concurrent Vehicle Binding (1 Vehicle to Multiple Drivers)
- **Location:** `server/src/controllers/driverController.js:144-214` (`assignVehicle`) and `server/src/models/Driver.js:67`.
- **Command:** `npm test --workspace=server -- tests/adversarial.test.js`
- **Verbatim Error Output:**
  ```
  ● Empirical Adversarial Challenge Test Suite (server/tests/adversarial.test.js) › 4. 1:1 Driver-Vehicle Mutual Exclusivity & Assignment Integrity › TC-ADV-FLEET-3: Concurrent binding stress test — Two drivers requesting the same available vehicle

    expect(received).toBeNull()

    Received: "6aea2bc9728dac9638825064"

      655 |       const otherDriver = await Driver.findById(otherDriverId);
      656 |       // The other driver must NOT be linked to vehicleA!
    > 657 |       expect(otherDriver.assignedVehicleId).toBeNull();
          |                                             ^
  ```
- **Code Observation:** In `server/src/models/Driver.js:67`, `driverSchema.index({ assignedVehicleId: 1 }, { sparse: true });` is NOT marked `unique: true`. In `driverController.js:144`, reads and writes to `Vehicle` and `Driver` are non-atomic, allowing concurrent requests to both set `assignedVehicleId = vehicle._id`.

### 1.4 Verbatim Failure 4: Concurrent Driver Binding to Multiple Vehicles
- **Location:** `server/src/controllers/driverController.js:144-214` and `server/src/models/Vehicle.js:81`.
- **Command:** `npm test --workspace=server -- tests/adversarial.test.js`
- **Verbatim Error Output:**
  ```
  ● Empirical Adversarial Challenge Test Suite (server/tests/adversarial.test.js) › 4. 1:1 Driver-Vehicle Mutual Exclusivity & Assignment Integrity › TC-ADV-FLEET-4: Driver concurrent assignment to two vehicles — Driver binds Vehicle 1 and Vehicle 2 simultaneously

    expect(received).toBeNull()

    Received: "6aea2bca728dac963882508b"

      687 |       const vLose = await Vehicle.findById(losingVehicleId);
      688 |       // Losing vehicle must NOT have driverA assigned to it!
    > 689 |       expect(vLose.assignedDriverId).toBeNull();
          |                                      ^
  ```
- **Code Observation:** In `server/src/models/Vehicle.js:81`, `vehicleSchema.index({ assignedDriverId: 1 }, { sparse: true });` is NOT marked `unique: true`. The losing vehicle remains linked to the driver.

---

## 2. Logic Chain

1. **State Machine Integrity:** Feature 9 (`PROJECT.md`) defines a strict lifecycle: `DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED / FAILED`. The worker implemented `VALID_TRANSITIONS` lookup inside `PATCH /api/v1/deliveries/:id/status`, but created dedicated endpoints `POST /api/v1/deliveries/:id/complete` and `POST /api/v1/deliveries/:id/fail` without any lifecycle pre-condition checks. Consequently, any client can skip intermediate dispatch and route states and jump directly from `DRAFT` to `COMPLETED` or `FAILED`.
2. **Terminal Invariance:** `COMPLETED` is an immutable terminal state (`VALID_TRANSITIONS[COMPLETED] = []`). However, because `failDelivery` and `assignDelivery` omit status checks, completed deliveries can be overwritten.
3. **Fleet Mutual Exclusivity (1:1 Pairing):** Feature 6 (`PROJECT.md`) mandates strict 1:1 active vehicle-driver pairing. Under normal serial execution, `assignVehicle` manually updates pointers. Under concurrent requests (`Promise.all`), a race condition occurs because operations are not atomic. Furthermore, the MongoDB schemas (`Driver.js` and `Vehicle.js`) lack `unique: true` constraints on their foreign key indexes. Therefore, MongoDB accepts duplicate associations, resulting in database corruption.
4. **Impact Assessment:** These bugs compromise data integrity, allow dispatch-rule circumvention, and create physical conflicts in fleet operations. Hence, Milestone 1 cannot be approved without remediation.

---

## 3. Caveats

- Auth & RBAC controls are robust: non-admin access rejection (403), signature tampering (401), alg "none" attack (401), expired tokens (401), and token revocation (401) all passed without error.
- Password sanitization is robust: `passwordHash` is excluded from all user query responses, login, provisioning, and populated vehicle/driver queries.
- State transitions using `PATCH /status` operate as expected; the defect is isolated to `POST /complete`, `POST /fail`, and `PATCH /assign`.

---

## 4. Conclusion

**`VERDICT: REQUEST_CHANGES (failures found)`**

The Milestone 1 backend must be remediated by the worker before proceeding to Milestone 2:

### Required Remediation Items:
1. **Enforce State Machine in `completeDelivery` & `failDelivery` (`server/src/controllers/deliveryController.js`):**
   - In `completeDelivery`: verify `delivery.status === DELIVERY_STATUS.OUT_FOR_DELIVERY`. Otherwise reject with 400 (`INVALID_STATUS_TRANSITION`).
   - In `failDelivery`: verify `delivery.status === DELIVERY_STATUS.OUT_FOR_DELIVERY`. Reject transitions on `COMPLETED` deliveries with 400.
2. **Protect Terminal State in `assignDelivery` (`server/src/controllers/deliveryController.js`):**
   - In `assignDelivery`: verify that `delivery.status` is either `READY` or `ASSIGNED`. Disallow reassignment of `OUT_FOR_DELIVERY`, `COMPLETED`, or `FAILED` deliveries.
3. **Add Database Unique Indexes for 1:1 Mutual Exclusivity:**
   - In `server/src/models/Driver.js`:
     ```javascript
     driverSchema.index({ assignedVehicleId: 1 }, { unique: true, sparse: true });
     ```
   - In `server/src/models/Vehicle.js`:
     ```javascript
     vehicleSchema.index({ assignedDriverId: 1 }, { unique: true, sparse: true });
     ```
4. **Implement Atomic Concurrency Control in `assignVehicle` (`server/src/controllers/driverController.js`):**
   - Utilize atomic conditional queries (`Vehicle.findOneAndUpdate({ _id: vehicleId, assignedDriverId: { $in: [null, driver._id] } }, ...)`) to prevent race conditions during concurrent binding.

---

## 5. Verification Method

To reproduce and verify these findings independently:

```powershell
# Run the adversarial challenge test suite in the server workspace:
npm test --workspace=server -- tests/adversarial.test.js
```

### Invalidation Conditions (Definition of Fix):
The request for changes will be satisfied when:
1. `npm test --workspace=server -- tests/adversarial.test.js` passes with 20 passed, 0 failed.
2. The existing test suite `npm test --workspace=server` continues to pass with 27 passed, 0 failed.
