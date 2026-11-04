# SmartRoute API Contracts & Technical Specification (Milestone 1 & 2)

## 1. Architectural Conventions & Protocol Standards

- **Base URL Prefix:** `/api/v1`
- **Transport Security:** HTTP/2 over TLS with Bearer Token Authorization header: `Authorization: Bearer <JWT_TOKEN>`.
- **Stateless Session Tokens:** HS256 JWT tokens signed with `JWT_SECRET` (15m expiry) and `JWT_REFRESH_SECRET` (7d expiry).
- **Token Invalidation:** Active token revocation on `/api/v1/auth/logout` via server-side blacklist and refreshToken nullification.
- **Uniform Response Envelopes:**
  - **Success Response (HTTP 200, 201):**
    ```json
    {
      "success": true,
      "message": "Optional human-readable confirmation",
      "data": {}
    }
    ```
  - **Error Response (HTTP 400, 401, 403, 404, 409, 422, 500):**
    ```json
    {
      "success": false,
      "error": {
        "code": "STRING_ERROR_CODE",
        "message": "Human-readable summary of failure",
        "details": [
          { "field": "weightKg", "message": "Weight must be positive (> 0)" }
        ],
        "requestId": "uuidv4-trace-identifier"
      }
    }
    ```

---

## 2. Authentication & User Provisioning (`/api/v1/auth`)

| Endpoint | Method | Role | Description | Payload / Response Summary |
|---|---|---|---|---|
| `/auth/login` | `POST` | Public | Authenticates credentials, returns JWT tokens and sanitized user profile | Body: `{ email, password }`<br>Res (200): `{ token, refreshToken, user: { id, name, email, role, phone, driverId, assignedVehicle } }` |
| `/auth/refresh` | `POST` | Public | Exchanges active refresh token for a fresh 15m access token | Body: `{ refreshToken }`<br>Res (200): `{ token }` |
| `/auth/logout` | `POST` | Authenticated | Revokes current access token and clears stored refresh token | Res (200): `{ message: "Logged out successfully" }` |
| `/auth/users` | `POST` | `ADMIN` | Provisions system user; automatically creates Driver profile if role=`DRIVER` | Body: `{ name, email, password, role, phone?, licenseNumber? }`<br>Res (201): `{ user, driver }` |
| `/auth/me` | `GET` | Authenticated | Retrieves current authenticated user profile with linked driver entity | Res (200): `{ user: { id, name, email, role, phone, driverId, assignedVehicle } }` |

---

## 3. Fleet Vehicle Management (`/api/v1/vehicles`)

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/vehicles` | `GET` | `ADMIN`, `FLEET_MANAGER` | List fleet vehicles with filters (`status`, `availability`, `fuelType`, `type`, `page`, `limit`). |
| `/vehicles` | `POST` | `ADMIN`, `FLEET_MANAGER` | Register new fleet vehicle. Cross-validates combustion (`kmPerLitre > 0`) vs electric (`energyKWhPerKm > 0`). |
| `/vehicles/:id` | `GET` | `ADMIN`, `FLEET_MANAGER` | Get vehicle details with populated active driver. |
| `/vehicles/:id` | `PUT` | `ADMIN`, `FLEET_MANAGER` | Update vehicle payload capacities, availability, or fuel parameters. |
| `/vehicles/:id` | `DELETE` | `ADMIN` | Soft-deletes / retires vehicle (`availability = 'RETIRED'`), unpairing driver. |

---

## 4. Driver Profile Management (`/api/v1/drivers`)

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/drivers` | `GET` | `ADMIN`, `FLEET_MANAGER` | List registered drivers with linked User account and assigned vehicle. |
| `/drivers` | `POST` | `ADMIN`, `FLEET_MANAGER` | Create driver profile for existing User account with commercial license. |
| `/drivers/:id` | `GET` | `ADMIN`, `FLEET_MANAGER` | Retrieve driver profile by ID. |
| `/drivers/:id` | `PUT` | `ADMIN`, `FLEET_MANAGER` | Update driver availability, contact phone, or rating. |
| `/drivers/:id/assign` | `PUT` | `ADMIN`, `FLEET_MANAGER` | **1:1 Vehicle Assignment:** Mutual exclusivity enforcement. Atomically binds vehicle to driver, releasing prior pairings and setting vehicle to `ASSIGNED`. Returns `{ driver, vehicle }`. |
| `/drivers/:id/unassign` | `PUT` | `ADMIN`, `FLEET_MANAGER` | Unassigns vehicle from driver, setting vehicle back to `AVAILABLE`. |

---

## 5. Delivery Consignments & CSV Manifest Ingestion (`/api/v1/deliveries`)

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/deliveries` | `GET` | `ADMIN`, `FLEET_MANAGER` | Query delivery manifest with pagination (`batchId`, `status`, `priority`, `zone`, `search`, `page`, `limit`). |
| `/deliveries` | `POST` | `ADMIN`, `FLEET_MANAGER` | Create individual delivery consignment. Validates positive weight, SLA windows (`start < end`), and geo coordinates. Defaults to `DRAFT`. |
| `/deliveries/:id` | `GET` | Authenticated | Retrieve delivery waybill with full consignment details and immutable `timeline` from `AuditEvent`. |
| `/deliveries/:id` | `PUT` | `ADMIN`, `FLEET_MANAGER` | Amend consignment details (blocked if status is `COMPLETED` or `OUT_FOR_DELIVERY`). |
| `/deliveries/import-csv` | `POST` | `ADMIN`, `FLEET_MANAGER` | **PapaParse CSV Manifest Batch Ingestion:**<br>Accepts raw CSV text, multipart file, or JSON `{ rows, dryRun, batchId }`.<br>- When `dryRun: true`: Performs row syntax, field, and duplicate checks, returning `{ totalRows, validRows, invalidRows, errors: [{ row, field, message }] }` without DB mutations.<br>- When `dryRun: false`: Commits valid consignments into `DRAFT` status and logs `CSV_IMPORTED` audit event. Returns HTTP 201. |
| `/deliveries/:id/assign` | `PATCH` | `ADMIN`, `FLEET_MANAGER` | Assigns vehicle and driver to consignment, transitioning status to `ASSIGNED`. |
| `/deliveries/:id/status` | `PATCH` | Authenticated | **State Machine Transition:** Enforces valid flow `DRAFT` $\to$ `READY` $\to$ `ASSIGNED` $\to$ `OUT_FOR_DELIVERY` $\to$ `COMPLETED` / `FAILED`. Rejects invalid jumps with `INVALID_STATUS_TRANSITION`. Records immutable `AuditEvent`. |
| `/deliveries/:id/complete`| `POST` | `ADMIN`, `FLEET_MANAGER`, `DRIVER` | Marks delivery completed with Proof of Delivery (OTP verification, recipient signature SVG, notes). |
| `/deliveries/:id/fail` | `POST` | `ADMIN`, `FLEET_MANAGER`, `DRIVER` | Marks delivery failed with mandatory failure reason code (`WRONG_ADDRESS`, `CUSTOMER_UNAVAILABLE`, etc.). |
| `/deliveries/:id` | `DELETE` | `ADMIN`, `FLEET_MANAGER` | Deletes delivery (allowed only in `DRAFT` or `READY` status). |

---

## 6. Operational Delivery Batches (`/api/v1/batches`)

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/batches` | `GET` | `ADMIN`, `FLEET_MANAGER` | List operational dispatch batches with filters (`status`, `date`, `page`, `limit`). |
| `/batches` | `POST` | `ADMIN`, `FLEET_MANAGER` | Create operational cluster batch with central depot (Rasulgarh), delivery consignments, and vehicle/driver rosters. Auto-computes total stops and payload cargo weight. |
| `/batches/:id` | `GET` | `ADMIN`, `FLEET_MANAGER` | Retrieve batch with populated deliveries, vehicles, and drivers. |
| `/batches/:id` | `PUT` | `ADMIN`, `FLEET_MANAGER` | Update batch assignments and re-aggregate metrics. |
| `/batches/:id/status` | `PATCH` | `ADMIN`, `FLEET_MANAGER` | Transition batch status (`DRAFT`, `READY`, `PLANNED`, `IN_PROGRESS`, `CLOSED`). |
| `/batches/:id` | `DELETE` | `ADMIN`, `FLEET_MANAGER` | Deletes draft batch, unbinding delivery consignments. |

---

## 7. Route Optimization Engine (`/api/v1/routes`)

### 7.1 Vehicle Fuel Fields (required on all Vehicle documents)

| Field | Type | Required | Description |
|---|---|---|---|
| `fuelType` | `String` enum `['Petrol','Diesel','Electric']` | ✅ | Fuel category of the vehicle |
| `kmPerLitre` | `Number` | For ICE vehicles | Fuel efficiency (km per litre). Null for Electric. |
| `energyKWhPerKm` | `Number` | For EV vehicles | Energy consumption (kWh per km). Null for Petrol/Diesel. |

### 7.2 Endpoints

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/routes/optimize` | `POST` | `ADMIN`, `FLEET_MANAGER` | Runs the full 2-stage route optimization pipeline (Tiered BFD bin-packing → Nearest Neighbor → 2-Opt TSP) across all assigned vehicle bins. Persists DRAFT routes and returns aggregate metrics with fuel savings. |
| `/routes/:id/dispatch` | `POST` | `ADMIN`, `FLEET_MANAGER` | Transitions a DRAFT route to DISPATCHED, binds driver & vehicle, advances delivery statuses to `ASSIGNED`, and emits a Socket.IO `route:dispatched` event. |
| `/routes` | `GET` | `ADMIN`, `FLEET_MANAGER`, `DRIVER` | Lists routes with filters (`batchId`, `vehicleId`, `driverId`, `status`). Drivers see only their own routes (BOLA enforcement). |
| `/routes/:id` | `GET` | Authenticated | Retrieves full route with populated vehicle, driver, and batch details. |

### 7.3 `POST /routes/optimize` — Request Body

```json
{
  "batchId": "<ObjectId>",
  "vehicleIds": ["<ObjectId>", "..."],
  "options": {
    "vehicleTypePreference": "EV",
    "trafficScenario": "MORNING_RUSH",
    "maxIterations": 1000
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `batchId` | `ObjectId` | ✅ | Delivery batch to optimize |
| `vehicleIds` | `ObjectId[]` | ❌ | Explicit vehicle subset; falls back to batch vehicles, then all available fleet |
| `options.vehicleTypePreference` | `String` `'EV'` \| `'ICE'` | ❌ | Tiered BFD preference — EV vehicles are prioritised for bin allocation when this is set to `'EV'` |
| `options.trafficScenario` | `String` | ❌ | One of `FREE_FLOW`, `MORNING_RUSH`, `EVENING_PEAK`, `MONSOON_RAIN`, `WEEKEND`. Defaults to time-of-day auto-detect. |
| `options.maxIterations` | `Number` | ❌ | Maximum 2-Opt swap iterations (default: 1000) |

### 7.4 `POST /routes/optimize` — Response Payload

```json
{
  "success": true,
  "message": "Successfully optimized 2 route(s) for batch BATCH-001",
  "data": {
    "baseline": {
      "stops": [...],
      "totalDistanceKm": 142.5,
      "totalDurationMin": 310.0,
      "costInr": 1282.50,
      "co2Kg": 29.925,
      "fuelConsumed": 13.50
    },
    "optimized": {
      "stops": [...],
      "totalDistanceKm": 118.3,
      "totalDurationMin": 258.0,
      "costInr": 1064.70,
      "co2Kg": 24.843,
      "fuelConsumed": 11.21
    },
    "fuelCostDelta": 2.29,
    "unassignedDeliveries": [],
    "deltas": {
      "distanceSavedKm": 24.2,
      "timeSavedMin": 52.0,
      "costSavedInr": 217.80,
      "co2AvoidedKg": 5.082,
      "percentDistanceReduction": 16.98
    },
    "routes": [{ "routeCode": "RT-BATCH-001-OD01KA-1", "status": "DRAFT", "metrics": {...}, "stops": [...] }]
  }
}
```

| Response Field | Type | Description |
|---|---|---|
| `baseline.fuelConsumed` | `Number` | Total fuel consumed on the unoptimized Nearest Neighbor route (L for ICE, kWh for EV) |
| `optimized.fuelConsumed` | `Number` | Total fuel consumed on the 2-Opt optimized route (L for ICE, kWh for EV) |
| `fuelCostDelta` | `Number` | Fuel saved by optimization (`baseline.fuelConsumed − optimized.fuelConsumed`). Positive = savings. |
| `deltas.distanceSavedKm` | `Number` | km reduction achieved vs baseline |
| `deltas.costSavedInr` | `Number` | INR financial savings vs baseline |
| `deltas.co2AvoidedKg` | `Number` | kg CO₂ avoided vs baseline (EV = 0 tailpipe) |
| `routes[].metrics.fuelConsumed` | `Number` | Per-vehicle fuel consumed on the optimized route |
| `routes[].metrics.fuelUnit` | `String` | `'L'` for Petrol/Diesel, `'kWh'` for Electric |

---

## 8. Real-Time Telemetry Socket.IO Gateway

- **Path:** `/socket.io`
- **Events:**
  - Client $\to$ Server `route:join`: `{ routeId: string }`
  - Client $\to$ Server `driver:location`: `{ routeId, lat, lng, speed, heading, batterySoC, timestamp }`
  - Server $\to$ Client `driver:locationUpdated`: Emitted to `route:<routeId>` room
  - Server $\to$ Client `delivery:statusChanged`: `{ deliveryId, routeId, status, actorId, timestamp }`
