# SmartRoute — Milestone 1 Remediation Plan & Code Diffs

**Author**: `teamwork_explorer_m1_it2_1` (Investigation & Synthesis Explorer)  
**Target Milestone**: Milestone 1 Iteration 2 (Backend Hardening & Defect Remediation)  
**Date**: 2026-11-03  
**Status**: Ready for Implementation by Worker (`teamwork_worker_m1`)  

---

## 1. Executive Summary & Root Cause Overview

Following adversarial review and stress testing of Milestone 1, five critical and major vulnerabilities were identified in the delivery lifecycle and consignment management subsystem. This remediation plan details the exact root causes, invariant rules, and production-ready code diffs to be applied by the worker.

| # | Issue | File & Location | Severity | Target Behavior / Invariant |
|---|---|---|---|---|
| 1 | **State Machine Bypass in `/complete` and `/fail`** | `server/src/controllers/deliveryController.js:410-493` | Critical | Enforce `delivery.status === 'OUT_FOR_DELIVERY'`, reject otherwise with HTTP 400 (`CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY` / `CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY`). |
| 2 | **Terminal State Mutation Protection** | `server/src/controllers/deliveryController.js:208, 293-324` | High | Consignments in terminal states (`COMPLETED`, `FAILED`) cannot be re-assigned, amended, completed, or failed again. |
| 3 | **POD Null-Check in `updateDeliveryStatus`** | `server/src/controllers/deliveryController.js:353-365` | Major | Prevent uncaught `TypeError` (HTTP 500) when `pod` is omitted or null in `PATCH /deliveries/:id/status`. |
| 4 | **BOLA / Driver Ownership Check** | `server/src/controllers/deliveryController.js:327, 410, 454` & `server/src/middleware/auth.js:68` | Major | Restrict `DRIVER` role actions to their own assigned consignments matching `driverProfileId`, `user.sub`, or DB `Driver` record. Reject cross-driver actions with HTTP 403 `FORBIDDEN`. |
| 5 | **Time Window Validation on Updates** | `server/src/controllers/deliveryController.js:201-244` & `server/src/models/Delivery.js:106` | Minor | Ensure `startTime < endTime` on `PUT /deliveries/:id` updates and via Mongoose schema validation. |

---

## 2. Issue 1: State Machine Bypass in `/complete` and `/fail`

### 2.1 Problem Analysis & Invariant
Feature 9 of `PROJECT.md` mandates the strict delivery lifecycle finite state machine:
$$\text{DRAFT} \longrightarrow \text{READY} \longrightarrow \text{ASSIGNED} \longrightarrow \text{OUT\_FOR\_DELIVERY} \longrightarrow \text{COMPLETED / FAILED}$$

While `PATCH /api/v1/deliveries/:id/status` validated transitions against `VALID_TRANSITIONS`, dedicated operational completion and exception endpoints (`POST /api/v1/deliveries/:id/complete` and `POST /api/v1/deliveries/:id/fail`) unconditionally mutated `delivery.status` to `COMPLETED` or `FAILED` regardless of current status. A client could take a newly created `DRAFT` consignment and immediately complete it or fail it, bypassing batch allocation, vehicle assignment, and active dispatch.

### 2.2 Concrete Implementation Diff

#### Target File: `server/src/controllers/deliveryController.js`

**A. In `completeDelivery` (lines ~410-435):**
```javascript
<<<< CURRENT CODE:
const completeDelivery = async (req, res, next) => {
  try {
    const { otp, signatureSvg, notes, photoUrl, photoCoordinates, temperatureReading } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    if (!delivery.proofOfDelivery) {
      delivery.proofOfDelivery = {};
    }
==== REPLACEMENT CODE:
const completeDelivery = async (req, res, next) => {
  try {
    const { otp, signatureSvg, notes, photoUrl, photoCoordinates, temperatureReading } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Enforce lifecycle state machine: must be OUT_FOR_DELIVERY
    if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
      throw new AppError(
        `Consignment can only be completed when in 'OUT_FOR_DELIVERY' status. Current status: '${delivery.status}'`,
        400,
        'CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY'
      );
    }

    // Enforce Driver ownership check (BOLA prevention)
    await verifyDriverOwnership(delivery, req.user);

    if (!delivery.proofOfDelivery) {
      delivery.proofOfDelivery = {};
    }
>>>>
```

**B. In `failDelivery` (lines ~454-475):**
```javascript
<<<< CURRENT CODE:
const failDelivery = async (req, res, next) => {
  try {
    const reason = req.body.failureReason || req.body.reason;
    if (!reason) {
      throw new AppError('Delivery failure requires reason or failureReason code', 400, 'MISSING_FAILURE_REASON');
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    const currentStatus = delivery.status;
    delivery.status = DELIVERY_STATUS.FAILED;
==== REPLACEMENT CODE:
const failDelivery = async (req, res, next) => {
  try {
    const reason = req.body.failureReason || req.body.reason;
    if (!reason) {
      throw new AppError('Delivery failure requires reason or failureReason code', 400, 'MISSING_FAILURE_REASON');
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Enforce lifecycle state machine: must be OUT_FOR_DELIVERY
    if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
      throw new AppError(
        `Consignment can only be failed when in 'OUT_FOR_DELIVERY' status. Current status: '${delivery.status}'`,
        400,
        'CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY'
      );
    }

    // Enforce Driver ownership check (BOLA prevention)
    await verifyDriverOwnership(delivery, req.user);

    const currentStatus = delivery.status;
    delivery.status = DELIVERY_STATUS.FAILED;
>>>>
```

---

## 3. Issue 2: Terminal State Mutation Protection

### 3.1 Problem Analysis & Invariant
In `PROJECT.md`, `COMPLETED` and `FAILED` represent terminal audit states. Once a delivery reaches `COMPLETED`, no driver, vehicle, or status reassignment is permitted (`VALID_TRANSITIONS[COMPLETED] = []`).
However:
1. `PATCH /api/v1/deliveries/:id/assign` (`assignDelivery`) did not inspect `delivery.status` at all, allowing an already `COMPLETED` or `FAILED` delivery to be reassigned and have its status reverted to `ASSIGNED`.
2. `PUT /api/v1/deliveries/:id` (`updateDelivery`) only locked `[COMPLETED, OUT_FOR_DELIVERY]`, omitting `FAILED`.

### 3.2 Concrete Implementation Diff

#### Target File: `server/src/controllers/deliveryController.js`

**A. In `assignDelivery` (lines ~293-306):**
```javascript
<<<< CURRENT CODE:
const assignDelivery = async (req, res, next) => {
  try {
    const { vehicleId, driverId } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    delivery.assignedVehicleId = vehicleId || delivery.assignedVehicleId;
    delivery.assignedDriverId = driverId || delivery.assignedDriverId;
    delivery.status = DELIVERY_STATUS.ASSIGNED;
    await delivery.save();
==== REPLACEMENT CODE:
const assignDelivery = async (req, res, next) => {
  try {
    const { vehicleId, driverId } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Terminal state protection: deliveries in COMPLETED or FAILED cannot be re-assigned
    if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED].includes(delivery.status)) {
      throw new AppError(
        `Cannot re-assign delivery in terminal status '${delivery.status}'`,
        400,
        'DELIVERY_TERMINAL'
      );
    }

    delivery.assignedVehicleId = vehicleId || delivery.assignedVehicleId;
    delivery.assignedDriverId = driverId || delivery.assignedDriverId;
    delivery.status = DELIVERY_STATUS.ASSIGNED;
    await delivery.save();
>>>>
```

**B. In `updateDelivery` (lines ~208-211):**
```javascript
<<<< CURRENT CODE:
    if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.OUT_FOR_DELIVERY].includes(delivery.status)) {
      throw new AppError(`Cannot amend delivery in status '${delivery.status}'`, 400, 'DELIVERY_LOCKED');
    }
==== REPLACEMENT CODE:
    if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED, DELIVERY_STATUS.OUT_FOR_DELIVERY].includes(delivery.status)) {
      throw new AppError(`Cannot amend delivery in terminal/active status '${delivery.status}'`, 400, 'DELIVERY_LOCKED');
    }
>>>>
```

---

## 4. Issue 3: POD Null-Check in `updateDeliveryStatus`

### 4.1 Problem Analysis
In `server/src/controllers/deliveryController.js` lines 353-365:
```javascript
    if (targetStatus === DELIVERY_STATUS.COMPLETED) {
      if (!delivery.proofOfDelivery) {
        delivery.proofOfDelivery = {};
      }
      if (pod.otp !== undefined) delivery.proofOfDelivery.otp = pod.otp; // <-- Throws TypeError if pod is undefined or null
```
When `PATCH /api/v1/deliveries/:id/status` is submitted with `{ "status": "COMPLETED" }` without a `pod` key or with `pod: null`, this crashes with:
`TypeError: Cannot read properties of undefined (reading 'otp')`, returning HTTP 500 instead of a clean response.

### 4.2 Concrete Implementation Diff

#### Target File: `server/src/controllers/deliveryController.js` (lines ~352-366)

```javascript
<<<< CURRENT CODE:
    // Validation for OUT_FOR_DELIVERY -> COMPLETED (requires POD)
    if (targetStatus === DELIVERY_STATUS.COMPLETED) {
      if (!delivery.proofOfDelivery) {
        delivery.proofOfDelivery = {};
      }
      if (pod.otp !== undefined) delivery.proofOfDelivery.otp = pod.otp;
      if (pod.otpVerified !== undefined) delivery.proofOfDelivery.otpVerified = pod.otpVerified;
      else if (pod.otp) delivery.proofOfDelivery.otpVerified = true;
      if (pod.signatureSvg !== undefined) delivery.proofOfDelivery.signatureSvg = pod.signatureSvg;
      if (pod.photoUrl !== undefined) delivery.proofOfDelivery.photoUrl = pod.photoUrl;
      if (pod.photoCoordinates) delivery.proofOfDelivery.photoCoordinates = pod.photoCoordinates;
      if (pod.temperatureReading !== undefined) delivery.proofOfDelivery.temperatureReading = pod.temperatureReading;
      if (pod.notes || pod.handoverNotes) delivery.proofOfDelivery.handoverNotes = pod.notes || pod.handoverNotes;
    }
==== REPLACEMENT CODE:
    // Validation for OUT_FOR_DELIVERY -> COMPLETED (handles optional/nullable POD)
    if (targetStatus === DELIVERY_STATUS.COMPLETED) {
      if (!delivery.proofOfDelivery) {
        delivery.proofOfDelivery = {};
      }
      if (pod && typeof pod === 'object') {
        if (pod.otp !== undefined) delivery.proofOfDelivery.otp = pod.otp;
        if (pod.otpVerified !== undefined) delivery.proofOfDelivery.otpVerified = pod.otpVerified;
        else if (pod.otp) delivery.proofOfDelivery.otpVerified = true;
        if (pod.signatureSvg !== undefined) delivery.proofOfDelivery.signatureSvg = pod.signatureSvg;
        if (pod.photoUrl !== undefined) delivery.proofOfDelivery.photoUrl = pod.photoUrl;
        if (pod.photoCoordinates) delivery.proofOfDelivery.photoCoordinates = pod.photoCoordinates;
        if (pod.temperatureReading !== undefined) delivery.proofOfDelivery.temperatureReading = pod.temperatureReading;
        if (pod.notes || pod.handoverNotes) delivery.proofOfDelivery.handoverNotes = pod.notes || pod.handoverNotes;
      }
    }
>>>>
```

---

## 5. Issue 4: BOLA / Driver Ownership Check

### 5.1 Problem Analysis
`server/src/routes/deliveryRoutes.js` permits users with role `DRIVER` to execute `updateDeliveryStatus`, `completeDelivery`, and `failDelivery`.
However, none of these controller actions checked whether `delivery.assignedDriverId` actually matches the authenticated driver. Any authenticated driver could complete, fail, or transition deliveries belonging to other drivers or unassigned deliveries.

### 5.2 Resolution Strategy & Multi-Identifier Matching
In SmartRoute:
- `req.user.id` / `req.user.sub`: The `User` model `_id`.
- `req.user.driverProfileId`: May be attached to the JWT payload or user object.
- `delivery.assignedDriverId`: References the `Driver` model `_id` (`mongoose.Schema.Types.ObjectId, ref: 'Driver'`).

To cover all deployment environments (including seeders, automated test harnesses, and standard REST requests), the ownership validation helper `verifyDriverOwnership`:
1. If `req.user.role !== ROLES.DRIVER`, bypasses check (Admins and Fleet Managers can manage all deliveries).
2. If `delivery.assignedDriverId` is null/undefined, rejects with HTTP 403 `FORBIDDEN`.
3. Checks if `delivery.assignedDriverId.toString()` directly matches `req.user.driverProfileId`.
4. Checks if `delivery.assignedDriverId.toString()` directly matches `req.user.id` or `req.user.sub`.
5. Queries MongoDB: `await Driver.findOne({ userId: req.user.id || req.user.sub })`, and compares `delivery.assignedDriverId.toString() === driver._id.toString()`.
6. If no match is found, throws `AppError('Drivers can only update deliveries assigned to them', 403, 'FORBIDDEN')`.

### 5.3 Concrete Implementation Diff

#### Target File: `server/src/middleware/auth.js` (lines ~67-75)
Ensure `req.user.sub` and `req.user.driverProfileId` are consistently available:
```javascript
<<<< CURRENT CODE:
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    req.token = token;
==== REPLACEMENT CODE:
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
      driverProfileId: decoded.driverProfileId || null,
    };
    req.token = token;
>>>>
```

#### Target File: `server/src/controllers/deliveryController.js`

**A. Import `Driver` model at top of file (around line 4):**
```javascript
<<<< CURRENT CODE:
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const AuditEvent = require('../models/AuditEvent');
const { AppError } = require('../middleware/errorHandler');
==== REPLACEMENT CODE:
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Driver = require('../models/Driver');
const AuditEvent = require('../models/AuditEvent');
const { AppError } = require('../middleware/errorHandler');
>>>>
```

**B. Add `verifyDriverOwnership` helper function (around line 23):**
```javascript
/**
 * Verifies driver ownership of a consignment to prevent BOLA / IDOR attacks.
 * ADMIN and FLEET_MANAGER roles bypass this check.
 */
const verifyDriverOwnership = async (delivery, user) => {
  if (user && user.role === ROLES.DRIVER) {
    if (!delivery.assignedDriverId) {
      throw new AppError('Drivers can only update deliveries assigned to them', 403, 'FORBIDDEN');
    }

    const assignedDriverStr = delivery.assignedDriverId.toString();

    // 1. Direct match against driverProfileId or user sub/id
    if (user.driverProfileId && assignedDriverStr === user.driverProfileId.toString()) {
      return;
    }
    if ((user.id && assignedDriverStr === user.id.toString()) || (user.sub && assignedDriverStr === user.sub.toString())) {
      return;
    }

    // 2. Lookup Driver document associated with user._id
    const driver = await Driver.findOne({ userId: user.id || user.sub });
    if (!driver || assignedDriverStr !== driver._id.toString()) {
      throw new AppError('Drivers can only update deliveries assigned to them', 403, 'FORBIDDEN');
    }
  }
};
```

**C. Mount `verifyDriverOwnership` in `updateDeliveryStatus`, `completeDelivery`, and `failDelivery`:**
- In `updateDeliveryStatus` (right after finding `delivery`):
  ```javascript
  await verifyDriverOwnership(delivery, req.user);
  ```
- In `completeDelivery` (right after state machine check):
  ```javascript
  await verifyDriverOwnership(delivery, req.user);
  ```
- In `failDelivery` (right after state machine check):
  ```javascript
  await verifyDriverOwnership(delivery, req.user);
  ```

---

## 6. Issue 5: Time Window Validation on Updates

### 6.1 Problem Analysis
In `createDelivery` (`deliveryController.js:102-106`), time windows are validated:
```javascript
if (timeWindow && timeWindow.start && timeWindow.end) {
  if (timeWindow.start >= timeWindow.end) {
    throw new AppError('Invalid time window: start time must precede end time', 400, 'INVALID_TIME_WINDOW');
  }
}
```
However, in `updateDelivery` (`PUT /api/v1/deliveries/:id`), `timeWindow` updates were merged without this check. Inverted time windows (e.g. `start: '17:00', end: '09:00'`) were persisted, which would corrupt Milestone 2 route optimization heuristic scoring.

### 6.2 Concrete Implementation Diff

#### Target File: `server/src/controllers/deliveryController.js` (lines ~227-234)

```javascript
<<<< CURRENT CODE:
    if (weightKg !== undefined) delivery.weightKg = weightKg;
    if (volumeM3 !== undefined) delivery.volumeM3 = volumeM3;
    if (priority) delivery.priority = priority;
    if (timeWindow) delivery.timeWindow = { ...delivery.timeWindow.toObject(), ...timeWindow };
==== REPLACEMENT CODE:
    if (weightKg !== undefined) {
      if (weightKg <= 0) {
        throw new AppError('Consignment weight must be strictly positive (> 0)', 400, 'INVALID_WEIGHT');
      }
      delivery.weightKg = weightKg;
    }
    if (volumeM3 !== undefined) delivery.volumeM3 = volumeM3;
    if (priority) delivery.priority = priority;

    if (timeWindow) {
      const mergedStart = timeWindow.start || (delivery.timeWindow && delivery.timeWindow.start);
      const mergedEnd = timeWindow.end || (delivery.timeWindow && delivery.timeWindow.end);
      if (mergedStart && mergedEnd && mergedStart >= mergedEnd) {
        throw new AppError('Invalid time window: start time must precede end time', 400, 'INVALID_TIME_WINDOW');
      }
      delivery.timeWindow = {
        start: mergedStart,
        end: mergedEnd,
      };
    }
>>>>
```

#### Target File: `server/src/models/Delivery.js` (around line 191)
Add Mongoose schema-level invariant validation:
```javascript
deliverySchema.pre('validate', function (next) {
  if (this.timeWindow && this.timeWindow.start && this.timeWindow.end) {
    if (this.timeWindow.start >= this.timeWindow.end) {
      this.invalidate('timeWindow', 'Invalid time window: start time must precede end time');
    }
  }
  next();
});
```

---

## 7. Test Suite Extensions & Verification Protocol

### 7.1 Regression Assertions in `server/tests/deliveries.test.js`
The worker should add the following automated tests to `server/tests/deliveries.test.js`:

```javascript
describe('Milestone 1 Hardened Invariants & Security Validations', () => {
  let otherDriverUser;
  let otherDriverToken;
  let otherDriver;

  beforeEach(async () => {
    const otherUser = await createTestUser('DRIVER');
    otherDriverUser = otherUser.user;
    otherDriverToken = otherUser.token;
    otherDriver = await createTestDriver(otherDriverUser);
  });

  test('TC-REM-1: Direct POST /complete on DRAFT consignment rejected with 400 CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-01-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'DRAFT',
    });

    const res = await request(app)
      .post(`/api/v1/deliveries/${deliv._id}/complete`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ otp: '1234' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY');
  });

  test('TC-REM-2: Direct POST /fail on DRAFT consignment rejected with 400 CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-02-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'DRAFT',
    });

    const res = await request(app)
      .post(`/api/v1/deliveries/${deliv._id}/fail`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ failureReason: 'CUSTOMER_UNAVAILABLE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY');
  });

  test('TC-REM-3: Re-assigning a COMPLETED delivery rejected with 400 DELIVERY_TERMINAL', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-03-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'COMPLETED',
    });

    const res = await request(app)
      .patch(`/api/v1/deliveries/${deliv._id}/assign`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ vehicleId: testVehicle._id, driverId: testDriver._id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DELIVERY_TERMINAL');
  });

  test('TC-REM-4: PATCH /status to COMPLETED with omitted pod does NOT crash with 500 TypeError', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-04-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'OUT_FOR_DELIVERY',
      assignedDriverId: testDriver._id,
    });

    const res = await request(app)
      .patch(`/api/v1/deliveries/${deliv._id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
  });

  test('TC-REM-5: Driver BOLA check rejects cross-driver delivery completion with 403 FORBIDDEN', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-05-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'OUT_FOR_DELIVERY',
      assignedDriverId: testDriver._id, // Assigned to Driver A
    });

    // Driver B attempts to complete Driver A's delivery
    const res = await request(app)
      .post(`/api/v1/deliveries/${deliv._id}/complete`)
      .set('Authorization', `Bearer ${otherDriverToken}`)
      .send({ otp: '9999' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('TC-REM-6: Inverted time window in PUT /deliveries/:id rejected with 400 INVALID_TIME_WINDOW', async () => {
    const deliv = await Delivery.create({
      orderReference: `#DEL-REM-06-${Date.now()}`,
      customer: { name: 'Test Consignee', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 5,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
      status: 'DRAFT',
    });

    const res = await request(app)
      .put(`/api/v1/deliveries/${deliv._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ timeWindow: { start: '17:00', end: '09:00' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TIME_WINDOW');
  });
});
```

### 7.2 Expected Adversarial Suite Impact
Applying these changes directly remediates the failures identified in `server/tests/adversarial.test.js`:
- `TC-ADV-STATE-5`: State Machine Bypass Check via POST /deliveries/:id/complete and /fail -> **PASS (HTTP 400 returned)**
- `TC-ADV-STATE-7`: Illegal status transitions and reassignments on terminal COMPLETED delivery -> **PASS (HTTP 400 returned)**

---

## 8. Step-by-Step Implementation Checklist for Worker

1. [ ] **Update `server/src/middleware/auth.js`**:
   - Ensure `req.user.sub` and `req.user.driverProfileId` are set on decoded tokens.
2. [ ] **Update `server/src/controllers/deliveryController.js`**:
   - Import `Driver` model (`const Driver = require('../models/Driver');`).
   - Add `verifyDriverOwnership(delivery, user)` helper function.
   - In `completeDelivery`: add state check (`delivery.status !== 'OUT_FOR_DELIVERY'` -> 400 `CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY`) and driver ownership check.
   - In `failDelivery`: add state check (`delivery.status !== 'OUT_FOR_DELIVERY'` -> 400 `CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY`) and driver ownership check.
   - In `assignDelivery`: check terminal states (`[COMPLETED, FAILED]` -> 400 `DELIVERY_TERMINAL`).
   - In `updateDelivery`: check terminal/active states (`[COMPLETED, FAILED, OUT_FOR_DELIVERY]` -> 400 `DELIVERY_LOCKED`), validate positive weight, and validate `start < end` time window.
   - In `updateDeliveryStatus`: add safe guard `if (pod && typeof pod === 'object')` and call `verifyDriverOwnership(delivery, req.user)`.
3. [ ] **Update `server/src/models/Delivery.js`**:
   - Add `pre('validate')` hook ensuring `timeWindow.start < timeWindow.end`.
4. [ ] **Extend `server/tests/deliveries.test.js`**:
   - Add the 6 regression test cases (`TC-REM-1` to `TC-REM-6`).
5. [ ] **Run Verification**:
   - `npm test --workspace=server -- tests/deliveries.test.js`
   - `npm test --workspace=server -- tests/adversarial.test.js`
