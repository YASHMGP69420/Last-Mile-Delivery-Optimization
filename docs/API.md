<!-- generated-by: gsd-doc-writer -->

# SmartRoute REST API & WebSocket Protocol Reference

SmartRoute provides a unified REST API and real-time WebSocket interface for last-mile delivery route optimization, fleet dispatching, driver handheld execution, and real-time GPS telemetry ingestion.

---

## Architecture & Conventions

### Base URLs & Versioning

All operational REST API endpoints are namespaced under the `/api/v1` prefix. Health probes and load-balancer probes are exposed directly at the server root as well as under `/api/v1`.

| Environment | Base URL | Purpose |
| :--- | :--- | :--- |
| **Development** | `http://localhost:5004/api/v1` | Local development backend |
| **Test / CI** | `http://127.0.0.1:5004/api/v1` | Automated integration and E2E suites |
| **Production** | `https://api.smartroute.com/api/v1` <!-- VERIFY: Production public API base URL (e.g. https://api.smartroute.com or load balancer ingress) --> | Production API cluster |
| **WebSocket** | `wss://api.smartroute.com/socket.io` <!-- VERIFY: Production WebSocket gateway URL --> | Real-time bi-directional events |

### Content Negotiation & Formats

- **Default Content-Type**: `application/json; charset=utf-8`
- **CSV Ingestion**: `text/csv` or `application/json` with `{ csvContent, dryRun, rows }` payload
- **Character Encoding**: UTF-8
- **Date-Time Representation**: ISO 8601 strings in UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Geographic Coordinates**: GeoJSON standard `[longitude, latitude]` for coordinate tuples; `{ lat, lng }` for legacy/object representation.

---

## Authentication & Session Management

SmartRoute enforces stateless JSON Web Token (JWT) authentication alongside refresh token rotation and server-side token blacklisting.

### Mechanism

1. **Access Tokens**: Short-lived JWTs (`15m` expiry) signed with `JWT_SECRET`. Passed via HTTP header:
   ```http
   Authorization: Bearer <access_token>
   ```
2. **Refresh Tokens**: Long-lived cryptographic tokens (`7d` expiry) stored hashed in MongoDB and issued to clients. Refreshing an access token rotates the refresh token using constant-time comparison to prevent replay attacks.
3. **Blacklisting**: Logged-out access tokens are added to an in-memory revocation blacklist until their expiration.
4. **Role-Based Access Control (RBAC)**: Enforced via `authorize(...roles)`. Three distinct system roles exist:
   - `ADMIN`: Complete system access, configuration, user provisioning, developer resets, and system audits.
   - `FLEET_MANAGER`: Batch creation, delivery import, vehicle/driver assignment, route optimization, and dispatch control.
   - `DRIVER`: Handheld HUD access, stop execution, GPS ping updates, incident reporting, and vehicle checklists.
5. **Broken Object Level Authorization (BOLA)**: Driver tokens are strictly verified against assigned route and delivery resources to prevent IDOR attacks.

---

## Error Handling & Standard Responses

All REST endpoints return predictable JSON payloads following the `ApiResponse<T>` envelope for success and the `AppError` schema for errors.

### Success Envelope

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Envelope (`AppError`)

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable error description",
    "details": [
      {
        "field": "customer.phone",
        "message": "Phone number must be at least 10 digits",
        "value": "123"
      }
    ],
    "requestId": "c1f7b92a-88db-4328-912b-df55f5288210"
  }
}
```

### HTTP Status Codes & Error Catalog

| Status | Code | Meaning & Trigger Condition |
| :--- | :--- | :--- |
| `200 OK` | — | Request succeeded; payload returned in `data`. |
| `201 Created` | — | Resource successfully created. |
| `400 Bad Request` | `VALIDATION_ERROR` | Schema or Mongoose validation failed. Details listed in `error.details`. |
| `400 Bad Request` | `INVALID_IDENTIFIER` | Malformed MongoDB `ObjectId` in URL parameter. |
| `400 Bad Request` | `MISSING_FIELDS` | Required payload properties omitted. |
| `400 Bad Request` | `INVALID_OTP` | Submitted verification PIN did not match consignment record. |
| `400 Bad Request` | `NO_VEHICLES_AVAILABLE` | Optimization triggered without active vehicles or capacity. |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or malformed `Authorization: Bearer` header. |
| `401 Unauthorized` | `INVALID_TOKEN` | Token signature verification failed or token is malformed. |
| `401 Unauthorized` | `TOKEN_EXPIRED` | Access token expired. Client should invoke `/api/v1/auth/refresh`. |
| `401 Unauthorized` | `TOKEN_REVOKED` | Token was invalidated via logout. |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Invalid email, phone, or password during login. |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | Authenticated user lacks required role for endpoint. |
| `403 Forbidden` | `FORBIDDEN` | Driver attempted to access or mutate an unassigned route/consignment. |
| `404 Not Found` | `NOT_FOUND` | Target record (delivery, route, vehicle, driver, user) not found. |
| `404 Not Found` | `ENDPOINT_NOT_FOUND` | HTTP verb and URL path do not match any registered route. |
| `409 Conflict` | `DUPLICATE_KEY_CONFLICT` | Unique key violation (e.g. email, vehicleId, licenseNumber). |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` | Request threshold exceeded for client IP address. |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | Unhandled runtime exception. Stack trace logged server-side with `requestId`. |
| `503 Service Unavailable` | `DEGRADED` / `DRAINING` | Database disconnected or server in graceful shutdown draining phase. |

---

## Rate Limiting

The API employs `express-rate-limit` to defend against denial of service and credential brute-forcing:

| Limiter | Target Routes | Window | Max Requests | Response Headers |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Limiter** | `/api/v1/auth/login`<br>`/api/v1/auth/demo-login`<br>`/api/v1/auth/register`<br>`/api/v1/auth/google`<br>`/api/v1/auth/otp/*` | 15 minutes | 30 requests / IP | `RateLimit-Limit: 30`<br>`RateLimit-Remaining: 29`<br>`RateLimit-Reset: <timestamp>` |
| **Operational Limiter** | `/api/v1/batches/*`<br>`/api/v1/routes/optimize` | 15 minutes | 300 requests / IP | `RateLimit-Limit: 300`<br>`RateLimit-Remaining: 299`<br>`RateLimit-Reset: <timestamp>` |

When the limit is breached, the server returns HTTP `429 Too Many Requests`:
```json
{
  "success": false,
  "message": "Too many authentication attempts from this IP, please try again after 15 minutes",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many authentication attempts from this IP, please try again after 15 minutes"
  }
}
```

---

## Health & Readiness Probes

SmartRoute provides Kubernetes, Docker, and reverse-proxy compatible health check probes.

### `GET /healthz`
Cluster orchestrator liveness probe. Fast-path check running before middleware and CORS evaluation.
- **200 OK**: `{ "success": true, "status": "OK", "timestamp": "2026-11-23T01:00:00.000Z" }`
- **503 Service Unavailable**: `{ "success": false, "status": "DRAINING", "timestamp": "..." }`

### `GET /readyz`
Cluster container readiness probe. Verifies MongoDB connection and drain status.
- **200 OK**: `{ "success": true, "status": "READY", "database": "CONNECTED", "timestamp": "..." }`
- **503 Service Unavailable**: `{ "success": false, "status": "DEGRADED", "database": "DISCONNECTED" }`

### `GET /api/v1/health`
API v1 operational heartbeat probe.
```json
{
  "success": true,
  "message": "SmartRoute API v1 operational",
  "timestamp": "2026-11-23T01:00:00.000Z"
}
```

### `GET /api/v1/health/ready`
Detailed system readiness status including database state and process uptime.
```json
{
  "success": true,
  "status": "READY",
  "timestamp": "2026-11-23T01:00:00.000Z",
  "uptimeSeconds": 14250,
  "services": {
    "api": "UP",
    "database": "CONNECTED"
  }
}
```

---

## Endpoints Overview

| Method | Path | Description | Auth Required | Roles |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | | | | |
| `POST` | `/api/v1/auth/login` | Authenticate with email/phone & password | No | Public |
| `POST` | `/api/v1/auth/demo-login` | Instant one-click authentication for pre-seeded demo personas | No | Public |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and issue new access token | No | Public |
| `POST` | `/api/v1/auth/logout` | Revoke active access token and clear stored refresh token | Yes | All roles |
| `GET` | `/api/v1/auth/me` | Fetch authenticated identity and assigned profile details | Yes | All roles |
| `POST` | `/api/v1/auth/google` | Sign in / register using Google OAuth ID token | No | Public |
| `GET` | `/api/v1/auth/otp/providers` | Query configured OTP delivery channels (Email / SMS) | No | Public |
| `POST` | `/api/v1/auth/otp/send` | Transmit verification PIN to user's registered phone or email | No | Public |
| `POST` | `/api/v1/auth/otp/verify` | Validate verification PIN | No | Public |
| `POST` | `/api/v1/auth/otp/login` | Authenticate via verified OTP code | No | Public |
| `POST` | `/api/v1/auth/register` | Register a new user account | No | Public |
| `POST` | `/api/v1/auth/users` | Administratively provision a new user | Yes | `ADMIN` |
| **Deliveries** | | | | |
| `GET` | `/api/v1/deliveries` | List consignments with filtering, pagination, and search | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/deliveries` | Create a single delivery order | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/deliveries/import-csv` | Bulk import deliveries from CSV text or JSON rows | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/deliveries/:id` | Get delivery details by ID | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `PUT` | `/api/v1/deliveries/:id` | Update delivery details | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/deliveries/:id/assign` | Assign delivery to vehicle/driver | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/deliveries/:id/status` | Update delivery status | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `POST` | `/api/v1/deliveries/:id/complete`| Complete delivery with Proof of Delivery (POD) | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `POST` | `/api/v1/deliveries/:id/fail` | Mark delivery failed with mandatory reason code | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `POST` | `/api/v1/deliveries/:id/send-pod-otp` | Transmit delivery verification PIN to recipient | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `POST` | `/api/v1/deliveries/:id/verify-pod-otp`| Verify recipient POD PIN | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `DELETE` | `/api/v1/deliveries/:id` | Delete delivery (only allowed in non-terminal states) | Yes | `ADMIN`, `FLEET_MANAGER` |
| **Batches** | | | | |
| `GET` | `/api/v1/batches` | List delivery batches | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/batches` | Create a new delivery batch container | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/batches/:id` | Get batch manifest and linked consignments | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PUT` / `PATCH` | `/api/v1/batches/:id` | Update batch properties | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/batches/:id/status` | Update batch lifecycle status (`DRAFT` → `READY` → `PLANNED`) | Yes | `ADMIN`, `FLEET_MANAGER` |
| `DELETE` | `/api/v1/batches/:id` | Delete batch and unlink non-terminal routes | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/batches/:id/duplicate` | Duplicate an existing batch and its consignments | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/batches/:id/deliveries` | Add deliveries to an existing batch | Yes | `ADMIN`, `FLEET_MANAGER` |
| `DELETE` | `/api/v1/batches/:id/deliveries/:deliveryId` | Remove a delivery from a batch | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/batches/:id/assign` | Bulk assign fleet vehicles and drivers to a batch | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/batches/:id/export` | Export batch manifest as CSV file | Yes | `ADMIN`, `FLEET_MANAGER` |
| **Routes & Optimization** | | | | |
| `POST` | `/api/v1/routes/optimize` | Execute 2-Opt TSP & Bin-Packing route optimization | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/evaluate-baseline` | Calculate unoptimized baseline route metrics | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `POST` | `/api/v1/routes/validate-dispatch` | Validate feasibility before dispatching routes | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/dispatch` | Batch dispatch planned routes directly | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/dispatch` | Dispatch a single route to driver handheld | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/push` | Push active route updates to driver handheld | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/reorder` | Update stop sequence order within an active route | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/reoptimize` | Dynamically re-optimize route for traffic or roadblock | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/incident` | Trigger route re-optimization from incident report | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/message` | Send dispatch notification message to driver | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/mishap-recover` | Reassign unvisited stops after breakdown or hazard | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/routes/:id/cancel` | Cancel an active route and reset associated deliveries | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/routes` | List planned and active routes | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| `GET` | `/api/v1/routes/:id` | Get full route manifest, waypoints, and polyline | Yes | `ADMIN`, `FLEET_MANAGER`, `DRIVER` |
| **Fleet: Vehicles** | | | | |
| `GET` | `/api/v1/vehicles` | List fleet vehicles with availability and status | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/vehicles` | Register a new vehicle | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/vehicles/import-csv` | Bulk import vehicles via CSV | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/vehicles/:id` | Get vehicle details | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PUT` | `/api/v1/vehicles/:id` | Update vehicle specifications or assignment | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/vehicles/:id/maintenance` | Record maintenance event and set status | Yes | `ADMIN`, `FLEET_MANAGER` |
| `DELETE` | `/api/v1/vehicles/:id` | Soft-retire or permanently delete (`?permanent=true`) vehicle | Yes | `ADMIN` |
| **Fleet: Drivers** | | | | |
| `GET` | `/api/v1/drivers` | List drivers with duty status, rating, and vehicle links | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/drivers` | Create driver profile and credentials | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/drivers/import-csv` | Bulk import driver profiles via CSV | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/drivers/:id` | Get driver profile by ID | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PUT` | `/api/v1/drivers/:id` | Update driver details | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PUT` | `/api/v1/drivers/:id/assign` | Assign vehicle to driver | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PUT` | `/api/v1/drivers/:id/unassign` | Unassign vehicle from driver | Yes | `ADMIN`, `FLEET_MANAGER` |
| `DELETE` | `/api/v1/drivers/:id` | Delete driver profile (`?forceReassign=true`) | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/drivers/reset-test-drivers` | Reset test drivers and vehicles to `AVAILABLE` | Yes | `ADMIN`, `FLEET_MANAGER` |
| **Driver Handheld HUD** | | | | |
| `GET` | `/api/v1/driver-hud/dashboard` | Aggregated cockpit summary (active route, KPI metrics) | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/shifts/start` | Clock-in and initiate driver duty shift | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/shifts/break` | Toggle shift break status | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/shifts/end` | Clock-out and complete driver duty shift | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/vehicle-check` | Submit mandatory pre-trip inspection checklist | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/route` | Fetch assigned active route with sequenced stops | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/route/claim` | Self-claim an unassigned dispatched route | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/location` | Post real-time mobile GPS coordinates | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/deliveries` | List active deliveries for driver's current run | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/deliveries/:id` | Fetch specific consignment details | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/deliveries/:id/arrived` | Mark arrival at customer stop | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/deliveries/:id/complete` | Complete stop with POD (OTP, signature, photo) | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/deliveries/:id/fail` | Record delivery failure with reason code | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/incidents` | List driver's reported incidents | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/driver-hud/incidents` | Report roadside mishap, breakdown, or traffic hazard | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/profile` | Retrieve driver user profile and performance metrics | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/driver-hud/notifications` | List notifications for driver | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/driver-hud/notifications/:id/read` | Mark driver notification as read | Yes | `DRIVER`, `ADMIN`, `FLEET_MANAGER` |
| **Telemetry & GPS Tracking** | | | | |
| `POST` | `/api/v1/telemetry` | Ingest vehicle GPS ping, speed, battery, heading | Yes | `DRIVER`, `FLEET_MANAGER`, `ADMIN` |
| `GET` | `/api/v1/telemetry/live` | Fleet-wide live position snapshot and active runs | Yes | Authenticated users |
| `GET` | `/api/v1/telemetry/history/:vehicleId` | Breadcrumb route history for target vehicle | Yes | `ADMIN`, `FLEET_MANAGER`, `DISPATCHER` |
| `GET` | `/api/v1/telemetry/alerts` | Safety, speeding, and geofence alerts | Yes | `ADMIN`, `FLEET_MANAGER`, `DISPATCHER` |
| `POST` | `/api/v1/telemetry/alerts/:id/ack` | Acknowledge safety alert | Yes | `ADMIN`, `FLEET_MANAGER` |
| **Administration & Governance** | | | | |
| `GET` | `/api/v1/admin/overview` | Executive system overview & live operational KPIs | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/analytics` | Fleet efficiency, fuel savings, and SLA metrics | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/admin/audit-logs` | Immutable audit log of operational and admin events | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/notifications` | Management alerts and incident list | Yes | `ADMIN`, `FLEET_MANAGER` |
| `POST` | `/api/v1/admin/notifications` | Broadcast operational notification | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/admin/notifications/:id/read` | Mark notification as read | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/admin/incidents` | Comprehensive fleet incident feed | Yes | `ADMIN`, `FLEET_MANAGER` |
| `PATCH` | `/api/v1/admin/incidents/:id` | Resolve incident and unblock route | Yes | `ADMIN`, `FLEET_MANAGER` |
| `GET` | `/api/v1/admin/users` | List registered user accounts | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/users` | Create user account | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/users/:id` | Update user profile | Yes | `ADMIN` |
| `PATCH` | `/api/v1/admin/users/:id/status` | Activate or deactivate user account | Yes | `ADMIN` |
| `DELETE` | `/api/v1/admin/users/:id` | Delete user account | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/users/:id/reset-password` | Force administrative password reset | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/permissions` | Inspect RBAC permission matrix | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/permissions` | Modify role permissions | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/organization` | Fetch company profile and operational zones | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/organization` | Update organization settings | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/depots` | Create new distribution depot | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/depots/:id` | Update depot address and coordinates | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/fleet-control` | Fleet control room state & vehicle overrides | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/fleet-control/override`| Force status override on vehicle | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/operations` | Operations oversight control | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/operations/override` | Force operational override on batch or delivery | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/optimization-settings`| Fetch engine weights, algorithm presets, & thresholds | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/optimization-settings`| Update optimization engine defaults | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/fuel-settings` | Fetch fuel prices and emission constants | Yes | `ADMIN` |
| `PUT` | `/api/v1/admin/fuel-settings` | Update fuel prices and carbon factors | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/integrations` | Inspect external third-party integration health | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/integrations/test` | Test external API credentials (e.g. SMS, Maps) | Yes | `ADMIN` |
| `GET` | `/api/v1/admin/data-export` | Trigger full system data dump export | Yes | `ADMIN` |
| `DELETE` | `/api/v1/admin/dev-purge` | Hard reset operational database (`confirmPurge: true`) | Yes | `ADMIN` |
| **Demo Dataset Management** | | | | |
| `GET` | `/api/v1/admin/demo-data/status` | Check count and state of demo entities | Yes | `ADMIN` |
| `POST` | `/api/v1/admin/demo-data/import` | Seed Bhubaneswar demo deliveries, fleet, and routes | Yes | `ADMIN` |
| `DELETE` | `/api/v1/admin/demo-data` | Purge all demo records without affecting live data | Yes | `ADMIN` |

---

## Detailed Endpoint Reference

### 1. Authentication

#### `POST /api/v1/auth/login`
Authenticates a user via email or phone and password. Returns access and refresh JWT tokens.

**Request Body:**
```json
{
  "email": "manager@smartroute.local",
  "password": "Password123!"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "664b1f81829e0018d9f10a11",
      "name": "Rajesh Sharma",
      "email": "manager@smartroute.local",
      "role": "FLEET_MANAGER",
      "phone": "+919876543210",
      "isDemoData": false,
      "driverId": null,
      "assignedVehicle": null
    }
  }
}
```

#### `POST /api/v1/auth/refresh`
Rotates the session refresh token and generates a new access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /api/v1/auth/logout`
Revokes the caller's active access token, adding it to the server blacklist, and removes the stored refresh token from the user profile.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `GET /api/v1/auth/me`
Retrieves identity and profile data for the authenticated session.

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "664b1f81829e0018d9f10a11",
      "name": "Rajesh Sharma",
      "email": "manager@smartroute.local",
      "role": "FLEET_MANAGER",
      "phone": "+919876543210",
      "emailVerified": true,
      "phoneVerified": true,
      "isDemoData": false,
      "driverId": null,
      "assignedVehicle": null
    }
  }
}
```

---

### 2. Consignment / Delivery Management

#### `POST /api/v1/deliveries`
Creates a single delivery order. Geocoding coordinates are automatically resolved if coordinates are omitted.

**Request Body:**
```json
{
  "orderReference": "ORD-2026-8941",
  "customer": {
    "name": "Soumya Ranjan",
    "phone": "+919861012345",
    "email": "soumya@example.com"
  },
  "address": {
    "street": "Plot 124, Saheed Nagar",
    "city": "Bhubaneswar",
    "zone": "Central",
    "postalCode": "751007"
  },
  "location": {
    "type": "Point",
    "coordinates": [85.8458, 20.2912]
  },
  "weightKg": 14.5,
  "volumeM3": 0.08,
  "priority": "Urgent",
  "timeWindow": {
    "start": "09:00",
    "end": "12:00"
  },
  "serviceDurationMinutes": 10
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Delivery created successfully",
  "data": {
    "id": "664b2190829e0018d9f10b24",
    "orderReference": "ORD-2026-8941",
    "status": "READY",
    "weightKg": 14.5,
    "priority": "Urgent",
    "proofOfDelivery": {
      "otpVerified": false
    }
  }
}
```

#### `POST /api/v1/deliveries/import-csv`
Performs validation and batch ingestion of consignments from CSV format.

**Request Body (`application/json` or `text/csv`):**
```json
{
  "dryRun": false,
  "csvContent": "OrderRef,CustomerName,Phone,Street,City,PostalCode,WeightKg,Priority,TimeStart,TimeEnd\nORD-101,Amit Das,+919811122233,Janpath Road,Bhubaneswar,751001,5.2,Standard,09:00,13:00\nORD-102,Pooja Mishra,+919822233344,Patia Main Rd,Bhubaneswar,751024,22.0,Cold Chain,10:00,12:00"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "CSV validated and imported successfully",
  "data": {
    "dryRun": false,
    "totalRows": 2,
    "validCount": 2,
    "errorCount": 0,
    "errors": [],
    "importedDeliveries": [
      {
        "id": "664b2251829e0018d9f10c01",
        "orderReference": "ORD-101",
        "weightKg": 5.2,
        "priority": "Standard"
      },
      {
        "id": "664b2251829e0018d9f10c02",
        "orderReference": "ORD-102",
        "weightKg": 22.0,
        "priority": "Cold Chain"
      }
    ]
  }
}
```

---

### 3. Batches & Route Optimization

#### `POST /api/v1/routes/optimize`
Runs the multi-objective 2-Opt Traveling Salesperson Problem (TSP) heuristic coupled with First-Fit Decreasing (FFD) capacity bin-packing.

**Request Body:**
```json
{
  "batchId": "664b2000829e0018d9f10a80",
  "vehicleIds": ["664b2050829e0018d9f10a92", "664b2050829e0018d9f10a95"],
  "options": {
    "trafficScenario": "MORNING_RUSH",
    "vehiclePreference": "EV_PREFERRED",
    "maxIterations": 1000,
    "weights": {
      "distanceWeight": 40,
      "timeWeight": 30,
      "fuelCostWeight": 20,
      "vipPriorityWeight": 10
    }
  }
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Successfully optimized 2 routes for batch BATCH-2026-05",
  "data": {
    "routes": [
      {
        "id": "664b2500829e0018d9f10e11",
        "routeCode": "RT-BATCH-2026-05-EV01-1",
        "status": "DRAFT",
        "stopsCount": 14,
        "metrics": {
          "totalDistanceKm": 28.4,
          "totalDurationMin": 85.2,
          "costInr": 142.0,
          "fuelConsumed": 5.68,
          "fuelUnit": "kWh",
          "co2Kg": 0.0,
          "totalPayloadKg": 280.5,
          "payloadUtilizationPercent": 70.1,
          "onTimeCertaintyPercent": 99.0
        },
        "optimized": {
          "stops": [
            {
              "sequence": 1,
              "deliveryId": "664b2190829e0018d9f10b24",
              "orderReference": "ORD-2026-8941",
              "recipientName": "Soumya Ranjan",
              "coordinates": [85.8458, 20.2912],
              "estimatedArrival": "09:22 AM",
              "distanceFromPrevKm": 4.2
            }
          ],
          "polylineCoords": [
            [85.8645, 20.2961],
            [85.8458, 20.2912],
            [85.8645, 20.2961]
          ]
        }
      }
    ],
    "unassignedDeliveries": [],
    "aggregates": {
      "baseline": {
        "totalDistanceKm": 42.1,
        "totalDurationMin": 135.0,
        "costInr": 315.75,
        "co2Kg": 9.2
      },
      "optimized": {
        "totalDistanceKm": 28.4,
        "totalDurationMin": 85.2,
        "costInr": 142.0,
        "co2Kg": 0.0
      },
      "deltas": {
        "distanceSavedKm": 13.7,
        "timeSavedMin": 49.8,
        "costSavedInr": 173.75,
        "percentDistanceSaved": 32.54,
        "percentCostSaved": 55.03
      }
    }
  }
}
```

#### `POST /api/v1/routes/:id/dispatch`
Transitions a route from `DRAFT` or `OPTIMIZED` to `DISPATCHED` status. Emits real-time WebSocket events to the assigned driver and management control room.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Route RT-BATCH-2026-05-EV01-1 dispatched successfully",
  "data": {
    "routeId": "664b2500829e0018d9f10e11",
    "routeCode": "RT-BATCH-2026-05-EV01-1",
    "status": "DISPATCHED",
    "driverId": "664b2090829e0018d9f10ac2",
    "dispatchedAt": "2026-11-23T01:30:00.000Z"
  }
}
```

---

### 4. Fleet Management (Vehicles & Drivers)

#### `GET /api/v1/vehicles`
Query fleet vehicles filtered by availability, propulsion type, or depot assignment.

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "664b2050829e0018d9f10a92",
      "vehicleId": "OD-02-EV-1001",
      "type": "Van",
      "fuelType": "Electric",
      "capacityKg": 500,
      "capacityM3": 3.5,
      "availability": "AVAILABLE",
      "batterySoC": 94,
      "energyKWhPerKm": 0.20,
      "assignedDriverId": "664b2090829e0018d9f10ac2"
    }
  ]
}
```

#### `POST /api/v1/drivers/:id/assign`
Links a driver to a specific fleet vehicle.

**Request Body:**
```json
{
  "vehicleId": "664b2050829e0018d9f10a92"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Vehicle OD-02-EV-1001 assigned to driver DL-OD02-2024-0012",
  "data": {
    "driverId": "664b2090829e0018d9f10ac2",
    "assignedVehicleId": "664b2050829e0018d9f10a92"
  }
}
```

---

### 5. Driver Execution & Handheld HUD

#### `POST /api/v1/driver-hud/vehicle-check`
Submits mandatory pre-trip inspection items before initiating deliveries.

**Request Body:**
```json
{
  "odometerKm": 14250,
  "batteryPercent": 95,
  "tirePressureOk": true,
  "brakesOk": true,
  "lightsOk": true,
  "cargoLashOk": true,
  "notes": "Vehicle inspected, all safety checks clear"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Pre-trip vehicle checklist submitted successfully"
}
```

#### `POST /api/v1/driver-hud/deliveries/:id/arrived`
Notifies dispatch and customer tracking that driver has arrived at customer waypoint.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Driver marked arrived at stop",
  "data": {
    "deliveryId": "664b2190829e0018d9f10b24",
    "status": "OUT_FOR_DELIVERY",
    "arrivedAt": "2026-11-23T02:15:00.000Z"
  }
}
```

#### `POST /api/v1/driver-hud/deliveries/:id/complete`
Submits comprehensive Proof of Delivery (POD) record, including PIN/OTP verification, SVG digital signature, and photo capture URL.

**Request Body:**
```json
{
  "recipientName": "Soumya Ranjan",
  "otp": "4819",
  "signatureSvg": "data:image/svg+xml;base64,PHN2ZyB4bWxucz...",
  "photoUrl": "https://storage.smartroute.com/pod/ORD-2026-8941.jpg", <!-- VERIFY: POD photo asset storage bucket / CDN endpoint -->
  "handoverNotes": "Delivered to recipient at front gate",
  "temperatureReading": 4.2
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Delivery completed successfully with POD",
  "data": {
    "id": "664b2190829e0018d9f10b24",
    "status": "COMPLETED",
    "proofOfDelivery": {
      "otpVerified": true,
      "signatureSvg": "data:image/svg+xml;base64,PHN2ZyB4bWxucz...",
      "photoUrl": "https://storage.smartroute.com/pod/ORD-2026-8941.jpg",
      "handoverNotes": "Delivered to recipient at front gate",
      "temperatureReading": 4.2
    }
  }
}
```

#### `POST /api/v1/driver-hud/deliveries/:id/fail`
Marks a consignment delivery attempt as failed with a structured classification reason.

**Request Body:**
```json
{
  "reason": "CUSTOMER_UNAVAILABLE",
  "notes": "Door locked, customer phone unreachable after 3 attempts"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Delivery marked as failed",
  "data": {
    "id": "664b2190829e0018d9f10b24",
    "status": "FAILED",
    "failureReason": "CUSTOMER_UNAVAILABLE",
    "failureNotes": "Door locked, customer phone unreachable after 3 attempts"
  }
}
```

#### `POST /api/v1/driver-hud/incidents`
Reports accidents, heavy congestion, or vehicle breakdown. Automatically alerts fleet dispatch and triggers re-optimization workflows.

**Request Body:**
```json
{
  "category": "VEHICLE_BREAKDOWN",
  "severity": "HIGH",
  "description": "Flat tire near Khandagiri Square",
  "locationCoordinates": [85.7865, 20.2604],
  "photoEvidenceUrl": "https://storage.smartroute.com/incidents/inc-481.jpg"
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Incident reported. Fleet operations notified.",
  "data": {
    "incidentId": "664b2880829e0018d9f10f44",
    "status": "OPEN",
    "severity": "HIGH"
  }
}
```

---

### 6. Telemetry & Tracking

#### `POST /api/v1/telemetry`
Ingests real-time telemetry coordinates and updates vehicle telemetry state.

**Request Body:**
```json
{
  "vehicleId": "664b2050829e0018d9f10a92",
  "coordinates": [85.8245, 20.2830],
  "speedKmh": 38.5,
  "headingDeg": 182,
  "batterySoC": 88,
  "accuracyMeters": 4.5
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Telemetry ping ingested",
  "data": {
    "pingId": "664b2990829e0018d9f10fa1",
    "timestamp": "2026-11-23T02:20:00.000Z"
  }
}
```

#### `GET /api/v1/telemetry/live`
Returns the active real-time coordinate snapshot of all operating vehicles.

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "vehicleId": "OD-02-EV-1001",
      "driverId": "664b2090829e0018d9f10ac2",
      "routeId": "664b2500829e0018d9f10e11",
      "coordinates": [85.8245, 20.2830],
      "speedKmh": 38.5,
      "headingDeg": 182,
      "batterySoC": 88,
      "status": "IN_TRANSIT",
      "lastPingAt": "2026-11-23T02:20:00.000Z"
    }
  ]
}
```

---

### 7. Administration & Developer Controls

#### `DELETE /api/v1/admin/dev-purge`
Restricted to administrators. Clears operational collections (deliveries, batches, routes, telemetry pings, audit events, and driver metrics) while preserving admin accounts and baseline organization settings.

**Request Body:**
```json
{
  "confirmPurge": true
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "All operational data successfully purged. Administrator accounts preserved.",
  "data": {
    "purgedCollections": ["deliveries", "deliverybatches", "routes", "telemetrypings", "auditevents"],
    "recordsDeleted": 842,
    "purgedAt": "2026-11-23T02:25:00.000Z"
  }
}
```

#### `POST /api/v1/admin/demo-data/import`
Populates prebuilt Bhubaneswar demo scenario (depot, delivery points across major zones, fleet vehicles, drivers).

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Prebuilt Bhubaneswar demo dataset imported cleanly.",
  "data": {
    "isSeeded": true,
    "demoCounts": {
      "deliveries": 45,
      "vehicles": 6,
      "drivers": 6,
      "batches": 2
    }
  }
}
```

#### `DELETE /api/v1/admin/demo-data`
Removes demo-tagged records (`isDemoData: true`) without touching production data.

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Removed 45 demo record(s). Production data untouched.",
  "data": {
    "deletedCount": 45
  }
}
```

---

## WebSocket Event Catalog

SmartRoute provides a real-time event stream powered by Socket.IO over `/socket.io`.

### Handshake & Authentication

Clients establish a connection by providing an active JWT in the `auth` object, `Authorization` header, or `token` query parameter:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5004', {
  path: '/socket.io',
  auth: {
    token: localStorage.getItem('token')
  },
  transports: ['websocket', 'polling']
});
```

### Room Subscriptions

Upon authentication, sockets are automatically joined to relevant rooms based on role:
- `management`: Global room for `ADMIN`, `FLEET_MANAGER`, and `DISPATCHER`. Receives all fleet alerts, dispatch updates, and delivery status changes.
- `admin`: Specialized room for `ADMIN` governance alerts.
- `fleet`: Operational monitoring room for fleet managers.
- `driver:<driverId>`: Scoped room for driver-specific assignments and messages.
- `route:<routeId>`: Scoped room for stops, progress, and GPS tracking of a specific route.

### Client-to-Server Events

| Event Name | Payload Structure | Description |
| :--- | :--- | :--- |
| `route:join` | `{ "routeId": "<ObjectId>" }` | Subscribes socket to progress and waypoint updates for a specific route. Drivers may only join routes assigned to them. |
| `route:leave` | `{ "routeId": "<ObjectId>" }` | Unsubscribes socket from route room. |
| `driver:join` | `{ "driverId": "<ObjectId>" }` | Subscribes socket to driver updates. Drivers can only join their own room. |
| `driver:leave` | `{ "driverId": "<ObjectId>" }` | Unsubscribes socket from driver room. |
| `driver:locationUpdated` | `{ "coordinates": [lng, lat], "speedKmh": 42.0, "headingDeg": 180, "batterySoC": 85 }` | Driver handheld streams GPS coordinates directly over WebSocket. Coordinates are authoritatively attributed to authenticated driver. |
| `telemetry:request_ping` | `{ "vehicleId": "<id>" }` | Management requests an immediate GPS refresh ping from target vehicle/driver handheld. |

### Server-to-Client Events

| Event Name | Channel / Room | Payload Summary |
| :--- | :--- | :--- |
| `route:dispatched` | `management`, `driver:<id>`, `route:<id>` | `{ routeId, routeCode, driverId, stops, dispatchedAt }` |
| `route:reordered` | `management`, `driver:<id>`, `route:<id>` | `{ routeId, reorderedStops, updatedPolyline, metrics }` |
| `route:cancelled` | `management`, `driver:<id>`, `route:<id>` | `{ routeId, reason, cancelledAt }` |
| `route:updated` | `management`, `route:<id>` | `{ routeId, status, metrics, unvisitedStopsCount }` |
| `delivery:updated` | `management`, `driver:<id>`, `route:<id>` | `{ deliveryId, status, arrivedAt, completedAt, failureReason }` |
| `delivery:status_changed` | `management`, `driver:<id>` | `{ deliveryId, previousStatus, newStatus, timestamp }` |
| `driver:stop_progressed` | `management`, `driver:<id>` | `{ routeId, completedStopSequence, remainingStopsCount }` |
| `telemetry:ping` | `management`, `driver:<id>`, `route:<id>` | `{ vehicleId, driverId, coordinates: [lng, lat], speedKmh, batterySoC, timestamp }` |
| `telemetry:alert` | `management`, `driver:<id>` | `{ alertType: "SPEEDING" \| "GEOFENCE_BREACH" \| "LOW_BATTERY", severity, vehicleId, message }` |
| `driver:incident` | `management`, `driver:<id>`, `route:<id>` | `{ incidentId, category, severity, description, coordinates }` |
| `batch:created` | Global broadcast | `{ batchId, code, depot, totalDeliveries }` |
| `batch:updated` | Global broadcast | `{ batchId, status, assignedVehicleIds, assignedDriverIds }` |
| `batch:deleted` | Global broadcast | `{ batchId, code, deletedAt }` |
| `fleet:vehicle_updated` | `management` | `{ vehicleId, status, batterySoC, assignedDriverId }` |
| `system:purged` | Global broadcast | `{ purgedAt, recordsDeleted }` |
| `demo:seeded` | Global broadcast | `{ status: { isSeeded: true, demoCounts } }` |
| `demo:deleted` | Global broadcast | `{ result: { deletedCount } }` |
