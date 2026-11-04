# SMARTROUTE — MILESTONE 1 BACKEND TECHNICAL IMPLEMENTATION PLAN
**Author:** Technical Architecture Explorer (`teamwork_explorer_m1_1`)  
**Date:** 2026-11-03  
**Target:** Milestone 1 (Backend Data Models, RBAC, REST APIs, CSV Batch Import & Seed Data)  
**Status:** READY FOR IMPLEMENTATION  

---

## 1. Executive Summary & Architecture Overview

Milestone 1 establishes the operational backbone of **SmartRoute**: a high-reliability, role-based last-mile logistics management system configured for Bhubaneswar, Odisha. The backend is designed as a modular Node.js/Express service interacting with MongoDB Atlas via Mongoose schemas.

### Core Architectural Principles
1. **Clean Monorepo Separation:** All backend code resides strictly in `server/`, keeping client and root configurations distinct.
2. **Unified REST API Contract:** All endpoints are mounted at `/api/v1/` and return standardized JSON response envelopes:
   - Success (200, 201): `{ "success": true, "data": <payload>, "message": "<optional>" }`
   - Error (400, 401, 403, 404, 409, 422, 500): `{ "success": false, "error": { "code": "<STRING_CODE>", "message": "<human_msg>", "details": [...], "requestId": "<uuid>" } }`
3. **Role-Based Access Control (RBAC):** Strict authorization enforcing permissions across three distinct actor roles: `ADMIN`, `FLEET_MANAGER`, and `DRIVER`.
4. **Finite State Machine & Immutability:** Deliveries follow a deterministic lifecycle (`DRAFT` → `READY` → `ASSIGNED` → `OUT_FOR_DELIVERY` → `COMPLETED`/`FAILED`). Every status transition generates an immutable `AuditEvent` / `DeliveryEvent`.
5. **1:1 Vehicle-Driver Mutual Exclusivity:** A driver can be assigned to at most one vehicle, and an active vehicle can have at most one assigned driver at any time.
6. **Robust CSV Batch Processing:** PapaParse-powered drag-and-drop CSV ingestion supporting two-phase dry-run validation with comprehensive row-level error reporting before committing to the database.

---

## 2. Directory Structure & Layout (`server/`)

The implementation agent will scaffold the backend according to the following layout:

```
server/
├── package.json
├── .env.example
├── src/
│   ├── app.js                          # Express application initialization & middleware pipeline
│   ├── server.js                       # HTTP server listener & DB connection entry point
│   ├── config/
│   │   ├── db.js                       # Mongoose connection & connection pool tuning
│   │   ├── env.js                      # Environment variables validation & parsing
│   │   └── constants.js                # System enums, roles, status codes, default values
│   ├── models/
│   │   ├── User.js                     # User identity, bcrypt credentials, roles
│   │   ├── Driver.js                   # Driver profile, license, phone, vehicle assignment
│   │   ├── Vehicle.js                  # Fleet vehicles, type, capacity, fuel consumption
│   │   ├── Delivery.js                 # Consignment, address, geo location, SLA windows, POD
│   │   ├── DeliveryBatch.js            # Cluster batching, depot coordinates, manifest aggregation
│   │   └── AuditEvent.js               # Immutable event log for auditability & state tracking
│   ├── middleware/
│   │   ├── auth.js                     # JWT verification, token blacklist, role guards
│   │   ├── validate.js                 # Request payload schema validation helper
│   │   └── errorHandler.js             # Centralized Express error handler & 404 handler
│   ├── routes/
│   │   ├── index.js                    # Router aggregation mounting on /api/v1
│   │   ├── authRoutes.js               # /api/v1/auth
│   │   ├── vehicleRoutes.js            # /api/v1/vehicles
│   │   ├── driverRoutes.js             # /api/v1/drivers
│   │   ├── deliveryRoutes.js           # /api/v1/deliveries
│   │   └── batchRoutes.js              # /api/v1/batches
│   ├── controllers/
│   │   ├── authController.js           # Login, logout, refresh, user provisioning
│   │   ├── vehicleController.js        # Vehicle CRUD, fleet status
│   │   ├── driverController.js         # Driver CRUD, 1:1 vehicle assignment
│   │   ├── deliveryController.js       # Delivery CRUD, PapaParse CSV import, state machine
│   │   └── batchController.js          # Batch creation, depot management, metric recalculation
│   ├── services/
│   │   ├── csvImportService.js         # PapaParse parsing, row validation & dry-run reporting
│   │   └── auditService.js             # Reusable AuditEvent logging utility
│   └── seed/
│       ├── seedBhubaneswar.js          # Canonical DB seeder (depot, roles, fleet, 55+ stops)
│       └── data/
│           ├── bhubaneswarStops.json   # 55+ Geocoded stops across 5 Bhubaneswar clusters
│           └── sampleManifest.csv      # Test CSV for import validation testing
└── tests/
    ├── unit/                           # Model validations, hooks & helper tests
    └── integration/                    # Supertest API endpoint test suites
```

---

## 3. Package Dependencies (`server/package.json`)

```json
{
  "name": "smartroute-server",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "seed": "node src/seed/seedBhubaneswar.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand",
    "lint": "eslint src/ --ext .js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.3.2",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "papaparse": "^5.4.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "supertest": "^6.3.4"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 4. Detailed Data Models Specification (`server/src/models/`)

### 4.1. `User.js`
- **Collection Name:** `users`
- **Purpose:** Primary actor identity, credential security, and role-based permissions.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `name` | `String` | Yes | No | — | Trimmed, min: 2, max: 100 characters |
  | `email` | `String` | Yes | Yes | — | Trimmed, lowercase, regex: `/^\S+@\S+\.\S+$/` |
  | `passwordHash` | `String` | Yes | No | — | Bcrypt hash with salt rounds ≥ 10. `select: false` |
  | `role` | `String` | Yes | No | `'DRIVER'` | Enum: `['ADMIN', 'FLEET_MANAGER', 'DRIVER']` |
  | `phone` | `String` | No | No | `null` | Trimmed, optional phone string |
  | `active` | `Boolean` | Yes | No | `true` | Soft-deletion flag |
  | `refreshToken` | `String` | No | No | `null` | Stored active refresh token / hash (`select: false`) |
- **Indexes:**
  - `{ email: 1 }` (unique: true)
  - `{ role: 1 }`
  - `{ active: 1 }`
- **Lifecycle Hooks:**
  - `pre('save', async function())`: If `passwordHash` was modified, hash plaintext password using `await bcrypt.hash(this.passwordHash, 12)`.
- **Instance Methods:**
  - `async comparePassword(candidatePassword)`: Returns `await bcrypt.compare(candidatePassword, this.passwordHash)`.
- **JSON Serialization Transform:**
  - Exclude `passwordHash`, `refreshToken`, and `__v`; virtualize `id = _id.toString()`.

---

### 4.2. `Vehicle.js`
- **Collection Name:** `vehicles`
- **Purpose:** Fleet vehicle registry, volumetric/payload limits, and powertrain efficiency metrics.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `vehicleId` | `String` | Yes | Yes | — | Registration license plate (e.g., `'OD-02-CD-5678'`), uppercase, trimmed |
  | `makeModel` | `String` | Yes | No | — | Vehicle commercial model (e.g. `'Tata Ace EV'`) |
  | `type` | `String` | Yes | No | — | Enum: `['Bike', 'Van', 'Truck']` |
  | `capacityKg` | `Number` | Yes | No | — | Strictly positive float (`> 0`). Max payload in kg |
  | `capacityM3` | `Number` | No | No | `null` | Positive float (`> 0`). Volumetric limit in m³ |
  | `fuelType` | `String` | Yes | No | — | Enum: `['Petrol', 'Diesel', 'Electric']` |
  | `kmPerLitre` | `Number` | Conditional | No | `null` | Strictly positive (`> 0`). Required if `fuelType` is `'Petrol'` or `'Diesel'` |
  | `energyKWhPerKm` | `Number` | Conditional | No | `null` | Strictly positive (`> 0`). Required if `fuelType` is `'Electric'` |
  | `availability` | `String` | Yes | No | `'AVAILABLE'` | Enum: `['AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE', 'RETIRED']` |
  | `assignedDriverId` | `ObjectId` | No | No | `null` | Ref: `'Driver'`, 1:1 active driver pairing |
  | `batterySoC` | `Number` | No | No | `null` | State of Charge % (`0 - 100`). Applicable to Electric |
- **Indexes:**
  - `{ vehicleId: 1 }` (unique: true)
  - `{ availability: 1 }`
  - `{ fuelType: 1 }`
  - `{ assignedDriverId: 1 }` (sparse: true)
- **Validation Hooks:**
  - `pre('validate')`: Fuel consumption sanity check:
    ```javascript
    if (this.fuelType === 'Electric') {
      if (!this.energyKWhPerKm || this.energyKWhPerKm <= 0) {
        this.invalidate('energyKWhPerKm', 'Electric vehicles must specify energyKWhPerKm > 0');
      }
      this.kmPerLitre = null;
    } else {
      if (!this.kmPerLitre || this.kmPerLitre <= 0) {
        this.invalidate('kmPerLitre', 'Combustion vehicles (Petrol/Diesel) must specify kmPerLitre > 0');
      }
      this.energyKWhPerKm = null;
    }
    ```

---

### 4.3. `Driver.js`
- **Collection Name:** `drivers`
- **Purpose:** Driver professional profile, license credentials, rating, and 1:1 vehicle pairing.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `userId` | `ObjectId` | Yes | Yes | — | Ref: `'User'`, 1:1 mapping with User account |
  | `licenseNumber` | `String` | Yes | Yes | — | Commercial driving license (e.g. `'OD-02-2018-0091821'`), uppercase, trimmed |
  | `phone` | `String` | Yes | No | — | Trimmed, validated contact number |
  | `assignedVehicleId` | `ObjectId` | No | No | `null` | Ref: `'Vehicle'`, 1:1 active vehicle pairing |
  | `availability` | `String` | Yes | No | `'AVAILABLE'` | Enum: `['AVAILABLE', 'ON_DUTY', 'IN_TRANSIT', 'ON_BREAK', 'OFF_DUTY']` |
  | `rating` | `Number` | Yes | No | `4.9` | Float, min: `1.0`, max: `5.0` |
  | `onTimeRuns` | `Number` | Yes | No | `0` | Non-negative integer counter |
  | `currentRouteId` | `ObjectId` | No | No | `null` | Ref: `'Route'`, active dispatched route |
- **Indexes:**
  - `{ userId: 1 }` (unique: true)
  - `{ licenseNumber: 1 }` (unique: true)
  - `{ assignedVehicleId: 1 }` (sparse: true)
  - `{ availability: 1 }`

---

### 4.4. `Delivery.js`
- **Collection Name:** `deliveries`
- **Purpose:** Individual parcel consignments, geographic coordinates, delivery SLA window, priority class, and proof-of-delivery records.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `orderReference` | `String` | Yes | Yes | — | External tracking order ID (e.g. `'#DEL-8492'`), uppercase, trimmed |
  | `batchId` | `ObjectId` | No | No | `null` | Ref: `'DeliveryBatch'` |
  | `customer.name` | `String` | Yes | No | — | Consignee name, trimmed |
  | `customer.phone` | `String` | Yes | No | — | Consignee contact number, trimmed |
  | `customer.email` | `String` | No | No | `null` | Consignee email address, trimmed, lowercase |
  | `address.street` | `String` | Yes | No | — | Street name, plot/building number |
  | `address.city` | `String` | Yes | No | `'Bhubaneswar'` | City name |
  | `address.zone` | `String` | Yes | No | `'Other'` | Enum: `['Patia (Z-1)', 'Jaydev Vihar (Z-2)', 'Saheed Nagar (Z-3)', 'Khandagiri (Z-4)', 'Chandrasekharpur', 'Other']` |
  | `address.postalCode` | `String` | Yes | No | — | Postal pincode (e.g. `'751024'`) |
  | `location.type` | `String` | Yes | No | `'Point'` | GeoJSON type enum: `['Point']` |
  | `location.coordinates` | `[Number]` | Yes | No | `[85.8645, 20.2961]` | GeoJSON `[longitude, latitude]` order |
  | `location.geocoded` | `Boolean` | Yes | No | `false` | True if coordinates verified/geocoded |
  | `location.geocodingConfidence` | `Number` | No | No | `0.0` | Value between `0.0` and `1.0` |
  | `location.geocodingSource` | `String` | Yes | No | `'SIMULATED'` | Enum: `['GOOGLE_MAPS', 'CACHE', 'MANUAL', 'SIMULATED']` |
  | `weightKg` | `Number` | Yes | No | — | Strictly positive float (`> 0`), e.g., `14.5` |
  | `volumeM3` | `Number` | No | No | `0.01` | Non-negative float (`>= 0`) |
  | `priority` | `String` | Yes | No | `'Standard'` | Enum: `['Standard', 'Urgent', 'Cold Chain']` |
  | `timeWindow.start` | `String` | Yes | No | — | Regex: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/` (e.g. `'09:00'`) |
  | `timeWindow.end` | `String` | Yes | No | — | Regex: `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/` (e.g. `'11:00'`) |
  | `serviceDurationMinutes` | `Number` | Yes | No | `10` | Non-negative integer (`>= 1`), minutes spent at stop |
  | `status` | `String` | Yes | No | `'DRAFT'` | Enum: `['DRAFT', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'COMPLETED', 'FAILED']` |
  | `assignedVehicleId` | `ObjectId` | No | No | `null` | Ref: `'Vehicle'` |
  | `assignedDriverId` | `ObjectId` | No | No | `null` | Ref: `'Driver'` |
  | `proofOfDelivery.otp` | `String` | No | No | `null` | 4-digit OTP string |
  | `proofOfDelivery.otpVerified` | `Boolean` | No | No | `false` | OTP validation status |
  | `proofOfDelivery.signatureSvg` | `String` | No | No | `null` | Captured recipient signature data |
  | `proofOfDelivery.photoUrl` | `String` | No | No | `null` | Photo URL / base64 of parcel drop |
  | `proofOfDelivery.photoCoordinates` | `Object` | No | No | `null` | `{ lat: Number, lng: Number }` |
  | `proofOfDelivery.temperatureReading` | `Number` | No | No | `null` | Temperature reading (°C for Cold Chain) |
  | `proofOfDelivery.handoverNotes` | `String` | No | No | `null` | Consignee notes |
  | `failureReason` | `String` | No | No | `null` | Enum: `['WRONG_ADDRESS', 'CUSTOMER_UNAVAILABLE', 'DAMAGED_PACKAGE', 'VEHICLE_BREAKDOWN', 'ACCESS_RESTRICTED', 'TIME_EXPIRED', 'OTHER']` |
  | `failureNotes` | `String` | No | No | `null` | Driver explanation for failure |
- **Indexes:**
  - `{ orderReference: 1 }` (unique: true)
  - `{ batchId: 1 }`
  - `{ status: 1 }`
  - `{ priority: 1 }`
  - `{ 'address.zone': 1 }`
  - `{ location: '2dsphere' }`
  - `{ assignedDriverId: 1 }`
  - `{ assignedVehicleId: 1 }`
- **State Machine Transition Rules:**
  Valid transitions:
  - `DRAFT` → `READY` (Manager validates geocode and consignment attributes)
  - `READY` → `ASSIGNED` (Allocated to vehicle & driver during route planning)
  - `ASSIGNED` → `OUT_FOR_DELIVERY` (Driver departs depot)
  - `OUT_FOR_DELIVERY` → `COMPLETED` (Driver captures valid POD: verified OTP or signature/photo)
  - `OUT_FOR_DELIVERY` → `FAILED` (Driver encounters exception; mandatory `failureReason`)
  - `FAILED` → `READY` (Manager re-queues delivery for next shift/dispatch)

---

### 4.5. `DeliveryBatch.js`
- **Collection Name:** `deliverybatches`
- **Purpose:** Operational grouping of deliveries assigned to a dispatch cluster and central depot.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `code` | `String` | Yes | Yes | — | Unique operational batch code (e.g. `'BBSR-EXP-08'`), uppercase, trimmed |
  | `name` | `String` | Yes | No | — | Descriptive batch name |
  | `date` | `String` | Yes | No | — | Date string in `YYYY-MM-DD` format |
  | `shift` | `String` | Yes | No | `'Shift A (08:00 - 17:00)'` | Operational shift window |
  | `depot.name` | `String` | Yes | No | `'Rasulgarh Logistics Hub'` | Central hub title |
  | `depot.address` | `String` | Yes | No | `'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar'` | Street address |
  | `depot.geo.lat` | `Number` | Yes | No | `20.2961` | Latitude of central depot |
  | `depot.geo.lng` | `Number` | Yes | No | `85.8645` | Longitude of central depot |
  | `deliveryIds` | `[ObjectId]` | Yes | No | `[]` | Array of references to `'Delivery'` |
  | `vehicleIds` | `[ObjectId]` | Yes | No | `[]` | Array of references to `'Vehicle'` |
  | `driverIds` | `[ObjectId]` | Yes | No | `[]` | Array of references to `'Driver'` |
  | `status` | `String` | Yes | No | `'DRAFT'` | Enum: `['DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED']` |
  | `metrics.totalDeliveries` | `Number` | Yes | No | `0` | Aggregated count of stops |
  | `metrics.totalWeightKg` | `Number` | Yes | No | `0.0` | Aggregated total cargo weight |
  | `metrics.assignedDeliveries` | `Number` | Yes | No | `0` | Count of assigned deliveries |
- **Indexes:**
  - `{ code: 1 }` (unique: true)
  - `{ date: 1 }`
  - `{ status: 1 }`

---

### 4.6. `AuditEvent.js` (or `DeliveryEvent.js`)
- **Collection Name:** `auditevents`
- **Purpose:** Immutable append-only audit trail logging all state changes, resource assignments, and system events.
- **Fields:**
  | Field | Type | Required | Unique | Default | Validation / Constraint |
  |---|---|---|---|---|---|
  | `deliveryId` | `ObjectId` | No | No | `null` | Ref: `'Delivery'`, indexed |
  | `batchId` | `ObjectId` | No | No | `null` | Ref: `'DeliveryBatch'`, indexed |
  | `routeId` | `ObjectId` | No | No | `null` | Ref: `'Route'`, indexed |
  | `type` | `String` | Yes | No | — | Enum: `['STATUS_CHANGE', 'ASSIGNMENT_CHANGE', 'ROUTE_OPTIMIZED', 'ROUTE_DISPATCHED', 'EXCEPTION_REPORTED', 'GEOCODE_UPDATED', 'POD_RECORDED', 'CSV_IMPORTED']` |
  | `actorId` | `ObjectId` | Yes | No | — | Ref: `'User'`, user executing the action |
  | `actorRole` | `String` | Yes | No | — | Enum: `['ADMIN', 'FLEET_MANAGER', 'DRIVER', 'SYSTEM']` |
  | `action` | `String` | Yes | No | — | Short action description |
  | `metadata` | `Mixed` | No | No | `{}` | Context snapshot (`fromStatus`, `toStatus`, `notes`, `ip`, `reason`) |
  | `at` | `Date` | Yes | No | `Date.now` | Immutable event timestamp |
- **Indexes:**
  - `{ deliveryId: 1, at: -1 }`
  - `{ routeId: 1, at: -1 }`
  - `{ actorId: 1, at: -1 }`
  - `{ at: -1 }`

---

## 5. Middleware Architecture Specification (`server/src/middleware/`)

### 5.1. Authentication & Role-Based Access Control (`auth.js`)
1. **JWT Generation:**
   - `generateAccessToken(user)`: Signs payload `{ sub: user._id, email: user.email, role: user.role, name: user.name }` with `JWT_SECRET`, expiring in `15m`.
   - `generateRefreshToken(user)`: Signs payload `{ sub: user._id }` with `JWT_REFRESH_SECRET`, expiring in `7d`.
2. **Token Blacklist:**
   - In-memory `Set` (or Redis cache) storing invalidated JWT tokens/jti upon logout.
   - Self-cleaning timer pruning tokens once expired.
3. **`authenticate(req, res, next)`:**
   - Parses `Authorization: Bearer <token>` from HTTP headers.
   - Rejects missing headers with 401 Unauthorized (`UNAUTHORIZED`).
   - Checks if token exists in blacklist; rejects revoked tokens with 401 (`TOKEN_REVOKED`).
   - Verifies signature and expiration with `jwt.verify`.
   - Attaches decoded user `{ id, email, role, name }` to `req.user`.
4. **`authorize(...allowedRoles)`:**
   - Middleware factory checking `allowedRoles.includes(req.user.role)`.
   - Returns 403 Forbidden (`INSUFFICIENT_PERMISSIONS`) if actor lacks required role.
5. **`requireAssignedDriver`:**
   - For driver-specific actions (e.g. status transition, stop completion), verifies that `delivery.assignedDriverId` matches the authenticated user's associated driver ID.

---

### 5.2. Error Handling & Normalization (`errorHandler.js`)
Centralized Express error middleware `(err, req, res, next)` returning a uniform JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "STRING_ERROR_CODE",
    "message": "Human-readable summary",
    "details": [ ... ],
    "requestId": "uuidv4"
  }
}
```

**Handled Error Categories:**
- **Mongoose `ValidationError`:** Maps to HTTP 400 with code `VALIDATION_ERROR`, populating `details` with individual field failure messages.
- **Mongoose `CastError` (invalid ObjectId):** Maps to HTTP 400 with code `INVALID_IDENTIFIER`.
- **MongoDB Duplicate Key (Code 11000):** Maps to HTTP 409 with code `DUPLICATE_KEY_CONFLICT`, reporting the offending unique key (e.g. `orderReference`, `vehicleId`, `email`).
- **JWT Errors (`JsonWebTokenError`, `TokenExpiredError`):** Maps to HTTP 401 with code `INVALID_TOKEN` or `TOKEN_EXPIRED`.
- **Custom `AppError`:** Preserves custom `statusCode` and `code`.
- **404 Route Not Found Middleware:** Returns HTTP 404 with code `ENDPOINT_NOT_FOUND`.
- **Fallback 500:** Maps unhandled exceptions to HTTP 500 with code `INTERNAL_SERVER_ERROR`.

---

### 5.3. Request Schema Validation (`validate.js`)
A lightweight, declarative validation runner that checks request body/query against required schemas and returns HTTP 400 with structured validation details when input rules are breached.

---

## 6. Controllers & REST Routes Specification

All routes are prefixed by `/api/v1/`.

### 6.1. Auth Module (`/api/v1/auth`)

| Method | Path | Roles | Description | Request Body | Response (200/201) |
|---|---|---|---|---|---|
| `POST` | `/login` | Public | Authenticates credentials, issues access & refresh tokens | `{ email, password }` | `{ success: true, data: { token, refreshToken, user: { id, name, email, role } } }` |
| `POST` | `/refresh` | Public | Exchanges valid refresh token for fresh access token | `{ refreshToken }` | `{ success: true, data: { token } }` |
| `POST` | `/logout` | Authenticated | Invalidates access token in blacklist | — | `{ success: true, message: "Logged out successfully" }` |
| `POST` | `/users` | `ADMIN` | Provisions new system user (and driver profile if role=DRIVER) | `{ name, email, password, role, phone?, licenseNumber? }` | `{ success: true, data: { user } }` |
| `GET` | `/me` | Authenticated | Retrieves current authenticated user profile | — | `{ success: true, data: { user } }` |

---

### 6.2. Vehicle Module (`/api/v1/vehicles`)

| Method | Path | Roles | Description | Request / Query | Response |
|---|---|---|---|---|---|
| `GET` | `/` | `ADMIN`, `FLEET_MANAGER` | List vehicles with filters | Query: `?status=&fuelType=&type=&page=1&limit=20` | `{ success: true, data: { vehicles: [...], total, page, totalPages } }` |
| `POST` | `/` | `ADMIN`, `FLEET_MANAGER` | Register new fleet vehicle | Body: `{ vehicleId, makeModel, type, capacityKg, capacityM3, fuelType, kmPerLitre, energyKWhPerKm }` | `{ success: true, data: { vehicle } }` (HTTP 201) |
| `GET` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Get vehicle details | Param: `id` | `{ success: true, data: { vehicle } }` |
| `PUT` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Update vehicle attributes | Body: `{ makeModel, capacityKg, capacityM3, availability, batterySoC }` | `{ success: true, data: { vehicle } }` |
| `DELETE` | `/:id` | `ADMIN` | Soft delete / retire vehicle | Param: `id` | `{ success: true, message: "Vehicle retired successfully" }` |

---

### 6.3. Driver Module (`/api/v1/drivers`)

| Method | Path | Roles | Description | Request / Query | Response |
|---|---|---|---|---|---|
| `GET` | `/` | `ADMIN`, `FLEET_MANAGER` | List drivers with populated user & vehicle | Query: `?availability=&search=&page=1&limit=20` | `{ success: true, data: { drivers: [...], total, page, totalPages } }` |
| `POST` | `/` | `ADMIN`, `FLEET_MANAGER` | Create driver profile for existing user | Body: `{ userId, licenseNumber, phone }` | `{ success: true, data: { driver } }` (HTTP 201) |
| `GET` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Get driver profile by ID | Param: `id` | `{ success: true, data: { driver } }` |
| `PUT` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Update driver availability/phone | Body: `{ phone, availability }` | `{ success: true, data: { driver } }` |
| `PUT` | `/:id/assign` | `ADMIN`, `FLEET_MANAGER` | **Assign vehicle (1:1 mutual exclusivity)** | Body: `{ vehicleId }` | `{ success: true, data: { driver, vehicle } }` |
| `PUT` | `/:id/unassign` | `ADMIN`, `FLEET_MANAGER` | Remove current vehicle pairing | — | `{ success: true, data: { driver, vehicle } }` |

#### 1:1 Vehicle-Driver Assignment Logic (`/drivers/:id/assign`):
1. Locate driver by `:id`. If driver already has `assignedVehicleId`, unassign previous vehicle.
2. Locate target vehicle by `vehicleId`. Verify vehicle exists and is not `RETIRED` or in `MAINTENANCE`.
3. If vehicle is currently assigned to a *different* driver:
   - Check if that other driver is on an active route. If yes, reject with 409 Conflict (`VEHICLE_IN_ACTIVE_TRANSIT`).
   - If not on active route, atomically dissociate vehicle from former driver.
4. Atomically update:
   - `Driver.findByIdAndUpdate(driverId, { assignedVehicleId: vehicleId, availability: 'AVAILABLE' })`
   - `Vehicle.findByIdAndUpdate(vehicleId, { assignedDriverId: driverId, availability: 'ASSIGNED' })`
5. Create immutable `AuditEvent` (`type: 'ASSIGNMENT_CHANGE'`).

---

### 6.4. Delivery Module (`/api/v1/deliveries`)

| Method | Path | Roles | Description | Request / Query | Response |
|---|---|---|---|---|---|
| `GET` | `/` | `ADMIN`, `FLEET_MANAGER` | Query delivery manifest | Query: `?batchId=&status=&priority=&zone=&page=1&limit=50&search=` | `{ success: true, data: { deliveries: [...], total, page, totalPages } }` |
| `POST` | `/` | `ADMIN`, `FLEET_MANAGER` | Create individual delivery consignment | Body: `{ orderReference, customer, address, weightKg, volumeM3, priority, timeWindow, batchId }` | `{ success: true, data: { delivery } }` (HTTP 201) |
| `GET` | `/:id` | `ADMIN`, `FLEET_MANAGER`, `DRIVER` | Get single delivery consignment | Param: `id` | `{ success: true, data: { delivery } }` |
| `PUT` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Amend delivery details (if DRAFT/READY) | Body: delivery fields to update | `{ success: true, data: { delivery } }` |
| `POST` | `/import-csv` | `ADMIN`, `FLEET_MANAGER` | **CSV Batch Upload with Dry-Run Validation** | Multipart file (`file`), Body/Query: `dryRun=true/false`, `batchId?` | `{ success: true, data: { dryRun, totalRows, validCount, errorCount, errors: [...], importedDeliveries: [...] } }` |
| `PATCH` | `/:id/status` | `ADMIN`, `FLEET_MANAGER`, `DRIVER` | **Lifecycle State Transition** | Body: `{ status, failureReason?, failureNotes?, pod?: { otp, signatureSvg, photoUrl, photoCoords, temperatureReading } }` | `{ success: true, data: { delivery } }` |
| `DELETE` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Delete delivery (only allowed if status=DRAFT) | Param: `id` | `{ success: true, message: "Delivery deleted" }` |

---

### 6.5. Batch Module (`/api/v1/batches`)

| Method | Path | Roles | Description | Request / Query | Response |
|---|---|---|---|---|---|
| `GET` | `/` | `ADMIN`, `FLEET_MANAGER` | List batches with pagination | Query: `?status=&date=&page=1&limit=20` | `{ success: true, data: { batches: [...], total, page, totalPages } }` |
| `POST` | `/` | `ADMIN`, `FLEET_MANAGER` | Create delivery batch with depot | Body: `{ code, name, date, shift, depot, deliveryIds, vehicleIds, driverIds }` | `{ success: true, data: { batch } }` (HTTP 201) |
| `GET` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Get batch with populated deliveries & vehicles | Param: `id` | `{ success: true, data: { batch } }` |
| `PUT` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Update batch assignments & recalculate metrics | Body: `{ name, shift, deliveryIds, vehicleIds, driverIds }` | `{ success: true, data: { batch } }` |
| `PATCH` | `/:id/status` | `ADMIN`, `FLEET_MANAGER` | Update batch status | Body: `{ status }` | `{ success: true, data: { batch } }` |
| `DELETE` | `/:id` | `ADMIN`, `FLEET_MANAGER` | Delete draft batch and unbind deliveries | Param: `id` | `{ success: true, message: "Batch deleted" }` |

---

## 7. PapaParse CSV Import & Dry-Run Engine Specification

### 7.1. CSV Header Contract
The CSV parser accepts standard comma-separated delivery manifests with the following headers:

| Header Name | Type | Required | Example | Validation Rule |
|---|---|---|---|---|
| `orderReference` | String | Yes | `#DEL-9001` | Unique string identifier; trimmed |
| `customerName` | String | Yes | `Aman Mohanty` | Non-empty string |
| `customerPhone` | String | Yes | `+91 98610 12345` | Valid contact number format |
| `street` | String | Yes | `Plot 22, Infocity Road` | Non-empty street address |
| `city` | String | No | `Bhubaneswar` | Defaults to `'Bhubaneswar'` if omitted |
| `zone` | String | Yes | `Patia (Z-1)` | Must match allowed enum or defaults to `'Other'` |
| `postalCode` | String | Yes | `751024` | Valid 6-digit postal code |
| `latitude` | Number | No | `20.3541` | Valid float between -90 and 90 (if omitted, geocode lookup triggered) |
| `longitude` | Number | No | `85.8174` | Valid float between -180 and 180 |
| `weightKg` | Number | Yes | `12.5` | Strictly positive float (`> 0`) |
| `volumeM3` | Number | No | `0.05` | Non-negative float (`>= 0`), defaults to 0.01 |
| `priority` | String | Yes | `Urgent` | Must be one of `Standard`, `Urgent`, `Cold Chain` |
| `timeWindowStart` | String | Yes | `09:00` | Format `HH:mm` (24-hour clock) |
| `timeWindowEnd` | String | Yes | `11:00` | Format `HH:mm`; must be strictly greater than start |
| `serviceDurationMinutes` | Number | No | `10` | Non-negative integer, defaults to 10 |

### 7.2. Dry-Run Processing Algorithm (`csvImportService.js`)
1. **Multer Streaming/Buffer Handling:** Reads uploaded file directly from memory buffer (no temporary file leaks).
2. **PapaParse Configuration:**
   ```javascript
   Papa.parse(csvString, {
     header: true,
     skipEmptyLines: true,
     transformHeader: (h) => h.trim()
   });
   ```
3. **Row-by-Row Validation:**
   - Tracks unique order references encountered in CSV to catch intra-file duplicates.
   - Queries DB for existing `orderReference` to prevent duplicate key collisions.
   - Validates positive numerical values for `weightKg` and `volumeM3`.
   - Validates `timeWindowStart` < `timeWindowEnd`.
   - Validates priority enum.
   - Validates geo coordinates if supplied; if omitted, checks if zone has simulated fallback coordinates.
4. **Error Collection:**
   Collects every error with `{ row: rowIndex + 2, field: 'fieldName', value: rawValue, message: 'Reason' }`.
5. **Dry-Run Mode (`dryRun: true`):**
   - Returns validation summary with all errors and sanitized preview of valid records.
   - **Zero database writes.**
6. **Commit Mode (`dryRun: false`):**
   - If `errorCount > 0`: By default, aborts the entire transaction and returns 400 Bad Request with the complete error list.
   - If `errorCount === 0`: Performs bulk insert (`Delivery.insertMany(validDeliveries)`). If `batchId` provided, links imported IDs and recalculates batch payload/volume metrics. Creates `AuditEvent` (`type: 'CSV_IMPORTED'`).

---

## 8. Canonical Bhubaneswar Seed Data Specification (`seedBhubaneswar.js`)

The seed script will populate realistic logistics fixtures for Bhubaneswar:

### 8.1. Central Depot
- **Depot Identifier:** `BHUBANESWAR-CENTRAL-HUB-01`
- **Location Name:** `Rasulgarh Logistics Hub`
- **Address:** `Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar, Odisha 751010`
- **Geo Coordinates:** `Latitude: 20.2961, Longitude: 85.8645`

### 8.2. Users & Credentials
| Name | Email | Password | Role | Phone / License |
|---|---|---|---|---|
| **Alex Rivera** | `admin@smartroute.io` | `AdminPass123!` | `ADMIN` | +91 98000 00001 (Super Admin) |
| **Priyanka Mishra** | `manager@smartroute.io` | `ManagerPass123!` | `FLEET_MANAGER` | +91 98000 00002 (Terminal Dispatcher) |
| **Bikram Das** | `bikram.das@smartroute.io` | `DriverPass123!` | `DRIVER` | +91 98610 24891 / `OD-02-2018-0091821` |
| **Subrat Jena** | `subrat.jena@smartroute.io` | `DriverPass123!` | `DRIVER` | +91 98451 22019 / `OD-02-2019-0044120` |
| **Rakesh Mohanty** | `rakesh.mohanty@smartroute.io` | `DriverPass123!` | `DRIVER` | +91 97782 10454 / `OD-02-2020-0081190` |
| **Manas Rout** | `manas.rout@smartroute.io` | `DriverPass123!` | `DRIVER` | +91 94370 88200 / `OD-02-2017-0033104` |

### 8.3. Fleet Vehicles & 1:1 Driver Assignment
| Vehicle ID | Make & Model | Type | Fuel | Capacity | Efficiency | Assigned Driver | Status |
|---|---|---|---|---|---|---|---|
| `OD-02-CD-5678` | Tata Ace EV | Van | Electric | 800 kg (2.5 m³) | 0.18 kWh/km | Bikram Das | `ASSIGNED` |
| `OD-02-B-1102` | Mahindra Bolero Maxi | Van | Diesel | 1,200 kg (3.8 m³) | 12.5 km/L | Subrat Jena | `ASSIGNED` |
| `OD-02-AB-1234` | Hero Electric Cargo | Bike | Electric | 150 kg (0.6 m³) | 0.05 kWh/km | Rakesh Mohanty | `ASSIGNED` |
| `OD-02-EF-9012` | Ashok Leyland 14ft | Truck | Diesel | 3,500 kg (12.0 m³) | 6.8 km/L | Manas Rout | `ASSIGNED` |
| `OD-02-GH-3456` | Tata Ace Gold EV | Van | Electric | 750 kg (2.2 m³) | 0.17 kWh/km | *Unassigned* | `AVAILABLE` |
| `OD-02-KL-7821` | Piaggio Ape E-Xtra | Van | Electric | 450 kg (1.4 m³) | 0.12 kWh/km | *Unassigned* | `AVAILABLE` |

### 8.4. 55+ Delivery Stops Across 5 Urban Clusters

The seed dataset incorporates 55 delivery stops distributed across Bhubaneswar's five primary delivery zones:

#### Zone 1: Patia & Infocity (North-West Tech Hub — 12 stops)
- `#DEL-8492`: Priyanka Mohapatra, Kalinga Software Park, Infocity Phase II (`20.3582, 85.8142`), 14.5 kg, Urgent, 09:00 - 09:30
- `#DEL-8485`: Campus Clinic, KIIT Campus 6, Patia Square (`20.3533, 85.8189`), 8.2 kg, Urgent, 10:30 - 11:00
- `#DEL-8501`: Mindtree Kalinga Campus, Chandaka SEZ (`20.3621, 85.8012`), 18.0 kg, Standard, 10:00 - 12:00
- `#DEL-8502`: Magnetics Infotech, DLF Cybercity Ground Floor (`20.3541, 85.8174`), 5.4 kg, Standard, 09:30 - 11:30
- `#DEL-8503`: Royal Arcade, Patia Station Road (`20.3570, 85.8240`), 22.0 kg, Standard, 11:00 - 13:00
- `#DEL-8504`: Silicon Hills Plaza, Silicon Institute Road (`20.3490, 85.8080`), 12.0 kg, Cold Chain, 09:00 - 10:30
- `#DEL-8505`: Maruti Villa Residential Enclave (`20.3512, 85.8231`), 7.5 kg, Standard, 12:00 - 14:00
- `#DEL-8506`: Sai Temple Lane, Patia (`20.3475, 85.8160`), 15.0 kg, Standard, 13:00 - 15:00
- `#DEL-8507`: Kanan Vihar Phase 2 Commercial Block (`20.3410, 85.8195`), 9.8 kg, Standard, 10:00 - 12:00
- `#DEL-8508`: Patia Big Bazaar Junction, Nandan Kanan Road (`20.3550, 85.8205`), 35.0 kg, Standard, 11:30 - 13:30
- `#DEL-8509`: Infocity Police Station Crossing (`20.3601, 85.8120`), 4.0 kg, Urgent, 09:15 - 10:00
- `#DEL-8510`: TCS Maitree Campus, Infocity SEZ (`20.3640, 85.8050`), 25.0 kg, Standard, 14:00 - 16:00

#### Zone 2: Chandrasekharpur (North-Central Mixed Commercial/Residential — 10 stops)
- `#DEL-8481`: IT Services Desk, Tech Mahindra Tower, CSPUR Main Road (`20.3284, 85.8211`), 28.0 kg, Standard, 09:45 - 10:15
- `#DEL-8511`: Sailashree Vihar Market Complex (`20.3340, 85.8150`), 11.5 kg, Standard, 10:00 - 12:00
- `#DEL-8512`: Niladri Vihar Sector 2 Commercial (`20.3390, 85.8245`), 16.2 kg, Standard, 11:00 - 13:00
- `#DEL-8513`: Damana Square Retail Arcade (`20.3240, 85.8190`), 30.0 kg, Standard, 12:00 - 14:00
- `#DEL-8514`: Nalco Nagar Residential Quarter 4 (`20.3210, 85.8260`), 8.0 kg, Standard, 13:00 - 15:00
- `#DEL-8515`: Care Hospital Annex, Chandrasekharpur (`20.3295, 85.8230`), 6.5 kg, Cold Chain, 09:30 - 11:00
- `#DEL-8516`: Aditya Care Enclave, Housing Board (`20.3260, 85.8175`), 14.0 kg, Standard, 14:00 - 16:00
- `#DEL-8517`: Kendriya Vidyalaya No. 1 Colony (`20.3315, 85.8188`), 19.0 kg, Standard, 10:30 - 12:30
- `#DEL-8518`: HIG Duplex Sector 1, CSPUR (`20.3370, 85.8220`), 10.2 kg, Standard, 11:30 - 13:30
- `#DEL-8519`: BDA Colony Market, Chandrasekharpur (`20.3225, 85.8202`), 21.0 kg, Standard, 15:00 - 17:00

#### Zone 3: Jaydev Vihar & Nayapalli (Central High-Density Bottleneck — 11 stops)
- `#DEL-8490`: Apollo Diagnostics, Apollo Hospital Annex (`20.3015, 85.8245`), 5.0 kg, Urgent (Cold Chain), 11:15 - 11:45
- `#DEL-8520`: Pal Heights Mall Commercial Desk, Jaydev Vihar (`20.2995, 85.8210`), 38.0 kg, Standard, 10:00 - 12:00
- `#DEL-8521`: Biju Patnaik Park Gate 2 (`20.2940, 85.8250`), 9.0 kg, Standard, 12:00 - 14:00
- `#DEL-8522`: Jaydev Vihar Overbridge Nexus (`20.2980, 85.8220`), 15.5 kg, Urgent, 11:00 - 11:30
- `#DEL-8523`: IRC Village Sector 3 Commercial Block (`20.3050, 85.8180`), 20.0 kg, Standard, 13:00 - 15:00
- `#DEL-8524`: Fortune Tower Central Office (`20.3030, 85.8270`), 32.0 kg, Standard, 09:30 - 11:30
- `#DEL-8525`: IDCO Exhibition Ground Gate 1 (`20.2920, 85.8280`), 14.0 kg, Standard, 14:00 - 16:00
- `#DEL-8526`: Nayapalli Behera Sahi Square (`20.2965, 85.8160`), 12.4 kg, Standard, 10:30 - 12:30
- `#DEL-8527`: Mayfair Lagoon Avenue (`20.3010, 85.8200`), 8.8 kg, Cold Chain, 11:30 - 13:00
- `#DEL-8528`: Regional Science Centre Crossing (`20.3080, 85.8255`), 17.0 kg, Standard, 14:30 - 16:30
- `#DEL-8529`: Nuasahi Nayapalli Market (`20.2935, 85.8190`), 24.0 kg, Standard, 15:00 - 17:00

#### Zone 4: Saheed Nagar & Master Canteen (East-Central Commercial Core — 11 stops)
- `#DEL-8489`: Rajesh Pattnaik, Utkal Galleria, Saheed Nagar (`20.2882, 85.8450`), 42.0 kg, Standard, 12:15 - 12:45
- `#DEL-8488`: Bhawani Retail, BMC Bhawani Mall (`20.2910, 85.8480`), 19.5 kg, Standard, 13:00 - 13:30
- `#DEL-8530`: Saheed Nagar Block B Market (`20.2895, 85.8430`), 16.0 kg, Standard, 10:00 - 12:00
- `#DEL-8531`: Master Canteen Railway Station Plaza (`20.2680, 85.8410`), 35.0 kg, Urgent, 09:30 - 10:30
- `#DEL-8532`: Janpath Boulevard Commercial Nexus (`20.2780, 85.8435`), 22.5 kg, Standard, 11:00 - 13:00
- `#DEL-8533`: Ram Mandir Square Arcade (`20.2820, 85.8440`), 18.0 kg, Standard, 12:00 - 14:00
- `#DEL-8534`: Kharvela Nagar Commercial Block 3 (`20.2740, 85.8420`), 27.0 kg, Standard, 13:30 - 15:30
- `#DEL-8535`: Ashoka Market Station Square (`20.2695, 85.8405`), 31.0 kg, Standard, 14:00 - 16:00
- `#DEL-8536`: Lalchand Jewellers Nexus, Janpath (`20.2805, 85.8442`), 4.5 kg, Urgent, 10:00 - 10:45
- `#DEL-8537`: Hotel Swosti Premium Point (`20.2925, 85.8390`), 13.0 kg, Cold Chain, 11:00 - 12:30
- `#DEL-8538`: Satya Nagar Kali Temple Lane (`20.2840, 85.8475`), 11.0 kg, Standard, 15:00 - 17:00

#### Zone 5: Khandagiri & Baramunda (South-West Commercial Corridor — 11 stops)
- `#DEL-8477`: Khandagiri Square Mart, Barabati Road (`20.2580, 85.7820`), 31.0 kg, Standard, 14:00 - 14:30
- `#DEL-8539`: Baramunda ISBT Cargo Complex (`20.2710, 85.7950`), 45.0 kg, Standard, 09:00 - 11:00
- `#DEL-8540`: Cosmopolis Residential Complex (`20.2620, 85.7890`), 15.0 kg, Standard, 10:30 - 12:30
- `#DEL-8541`: Udayagiri Caves Tourist Plaza (`20.2635, 85.7860`), 8.5 kg, Standard, 11:30 - 13:30
- `#DEL-8542`: Jagamara Square Commercial Center (`20.2540, 85.7980`), 26.0 kg, Standard, 12:00 - 14:00
- `#DEL-8543`: Gandamunda Main Road Junction (`20.2510, 85.7895`), 19.0 kg, Standard, 13:00 - 15:00
- `#DEL-8544`: Kolathia Housing Board Colony (`20.2480, 85.7840`), 12.0 kg, Standard, 14:00 - 16:00
- `#DEL-8545`: SUM Hospital Logistics Gate (`20.2760, 85.7780`), 10.5 kg, Cold Chain, 09:30 - 11:00
- `#DEL-8546`: Aiginia Wholesale Grain Market (`20.2660, 85.7910`), 50.0 kg, Standard, 10:00 - 12:00
- `#DEL-8547`: Tapoban High School Crossing (`20.2565, 85.7870`), 14.2 kg, Standard, 14:30 - 16:30
- `#DEL-8548`: Ghatikia Prime Enclave (`20.2705, 85.7810`), 16.8 kg, Standard, 15:00 - 17:00

### 8.5. Canonical Demonstration Batch (`BBSR-EXP-08`)
The seeder will create the primary demonstration batch linking the 7 canonical stops demonstrated in the Stitch Route Planner UI (`#DEL-8492`, `#DEL-8481`, `#DEL-8485`, `#DEL-8490`, `#DEL-8489`, `#DEL-8488`, `#DEL-8477`), assigned to vehicle `OD-02-CD-5678` (Tata Ace EV) and driver `Bikram Das`, set to status `READY`. This provides immediate fixture data to prove the **31.7% distance reduction** and **75-minute duration savings** in Milestone 2.

---

## 9. Implementation Sequencing & Task Checklist

The implementing agent should execute the implementation in the following 5 distinct phases:

### Phase 1: Environment, Server Scaffold & Config
1. Create `server/package.json` with exact dependencies. Run `npm install` inside `server/`.
2. Implement `server/src/config/env.js` (validating `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`).
3. Implement `server/src/config/db.js` with Mongoose connection logging and graceful shutdown.
4. Implement `server/src/config/constants.js` with all project enums and roles.
5. Create Express `app.js` configuring CORS, JSON body parser, morgan logging, and mount error handler.
6. Create `server.js` listening on port `PORT` (default 5000).

### Phase 2: Mongoose Data Models
1. `server/src/models/User.js` with bcrypt pre-save hash hook, `comparePassword` method, and unique email index.
2. `server/src/models/Vehicle.js` with fuel consumption pre-validate hook and unique `vehicleId` index.
3. `server/src/models/Driver.js` with 1:1 `userId` reference and unique `licenseNumber` index.
4. `server/src/models/Delivery.js` with GeoJSON `2dsphere` index, state machine validation, and SLA window regex.
5. `server/src/models/DeliveryBatch.js` with depot default Rasulgarh coordinates and metric aggregation methods.
6. `server/src/models/AuditEvent.js` with immutable timestamp and actor indexing.

### Phase 3: Middleware Implementation
1. `server/src/middleware/auth.js` (`authenticate`, `authorize`, `tokenBlacklist`, `requireAssignedDriver`).
2. `server/src/middleware/errorHandler.js` (mapping Mongoose validation, Mongo 11000 duplicate keys, JWT errors).
3. `server/src/middleware/validate.js` (schema validator).

### Phase 4: Controllers & Routes
1. `authController.js` & `authRoutes.js` (`login`, `refresh`, `logout`, `users`, `me`).
2. `vehicleController.js` & `vehicleRoutes.js` (CRUD, fuel validation).
3. `driverController.js` & `driverRoutes.js` (CRUD, 1:1 assignment/unassignment).
4. `deliveryController.js` & `deliveryRoutes.js` (CRUD, PapaParse CSV dry-run/commit, state transition).
5. `batchController.js` & `batchRoutes.js` (CRUD, metric rollup).
6. Wire all routes into `server/src/routes/index.js` mounted at `/api/v1/`.

### Phase 5: Seeding & Verification
1. Implement `server/src/seed/seedBhubaneswar.js`.
2. Execute `npm run seed` inside `server/` to populate database.
3. Verify that all 55 deliveries, 6 vehicles, 4 drivers, 3 user roles, and batch `BBSR-EXP-08` are seeded correctly.
4. Run integration sanity checks with Supertest or curl.

---

## 10. Verification & Independent Test Commands

The reviewer can independently verify the backend implementation using these commands:

```bash
# 1. Install backend dependencies
cd "c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\server"
npm install

# 2. Run Database Seeder
npm run seed

# 3. Start Development Server
npm run dev

# 4. Verification Check: Test Login (Public Endpoint)
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@smartroute.io\",\"password\":\"AdminPass123!\"}"

# 5. Verification Check: List Vehicles (Requires Bearer Token)
curl -X GET http://localhost:5000/api/v1/vehicles \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_4>"

# 6. Verification Check: Test CSV Dry Run
curl -X POST http://localhost:5000/api/v1/deliveries/import-csv?dryRun=true \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_4>" \
  -F "file=@src/seed/data/sampleManifest.csv"
```

*End of Milestone 1 Backend Technical Implementation Plan.*
