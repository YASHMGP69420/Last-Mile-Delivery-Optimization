# SmartRoute Admin Control Center REST API Documentation

All Admin endpoints require an `Authorization: Bearer <TOKEN>` header with role `ADMIN`.

Base Path: `/api/v1/admin`

---

## 1. Executive Overview & Health

### `GET /api/v1/admin/overview`
Returns consolidated KPIs, real-time infrastructure probe diagnostics, and recent audit activity.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalUsers": 12,
      "fleetManagersCount": 3,
      "activeDriversCount": 8,
      "totalVehicles": 10,
      "availableVehicles": 7,
      "maintenanceVehicles": 1,
      "totalDeliveries": 45,
      "activeDeliveries": 12,
      "completedDeliveries": 30,
      "failedDeliveries": 3,
      "onTimeDeliveryRate": 90.9,
      "totalFleetUtilization": 30.0
    },
    "systemHealth": {
      "frontend": { "status": "OPERATIONAL" },
      "backend": { "status": "OPERATIONAL", "uptimeSeconds": 1420 },
      "mongodb": { "status": "CONNECTED", "databaseName": "smartroute" },
      "geoapify": { "status": "HEALTHY", "provider": "Geoapify Route & Matrix API" },
      "socketIo": { "status": "OPERATIONAL" }
    },
    "recentActivity": []
  }
}
```

---

## 2. User & Access Governance

### `GET /api/v1/admin/users`
Query parameters: `role`, `status`, `search`, `page`, `limit`.

### `POST /api/v1/admin/users`
Creates a new user account with designated role.
**Request Body**:
```json
{
  "name": "Sunil Patra",
  "email": "sunil.patra@smartroute.io",
  "password": "TemporaryPassword2026!",
  "role": "FLEET_MANAGER",
  "phone": "+91 94370 55555",
  "department": "Rasulgarh Dispatch Hub"
}
```

### `PATCH /api/v1/admin/users/:id/status`
Suspends, deactivates, or activates account. Self-suspension is strictly forbidden.
**Request Body**:
```json
{
  "status": "SUSPENDED",
  "reason": "Security credential review"
}
```

### `POST /api/v1/admin/users/:id/reset-password`
Generates or sets a temporary password and revokes existing refresh tokens.

---

## 3. Organization & Multi-Depot Infrastructure

### `GET /api/v1/admin/organization`
Retrieves corporate settings, business hours, and operational depots.

### `PUT /api/v1/admin/organization`
Updates corporate metadata, contact emails, and daily operating windows.

### `POST /api/v1/admin/depots`
Registers a new operational depot with latitude/longitude coordinates.
**Request Body**:
```json
{
  "name": "Patia North Cross-Dock",
  "address": "Infocity Square, Patia, Bhubaneswar",
  "location": { "lat": 20.3533, "lng": 85.8192 },
  "serviceRegion": "Patia & North Corridor",
  "operatingHours": { "start": "06:00", "end": "22:00" }
}
```

### `PUT /api/v1/admin/depots/:id`
Updates depot active status or service region.

---

## 4. Fleet-Wide Control Center

### `GET /api/v1/admin/fleet-control`
Lists all vehicles, drivers, and maintenance states.

### `POST /api/v1/admin/fleet-control/override`
Applies administrative override to fleet resources.
**Request Body**:
```json
{
  "resourceType": "VEHICLE",
  "resourceId": "65e01234567890abcdef1234",
  "action": "SUSPEND_MAINTENANCE",
  "reason": "Brake pressure degradation reported during morning run"
}
```

---

## 5. Operations Oversight & Interventions

### `GET /api/v1/admin/operations`
Lists active routes, unassigned consignments, and failed deliveries.

### `POST /api/v1/admin/operations/override`
**Cancel Route**:
```json
{
  "targetType": "ROUTE",
  "targetId": "65e01234567890abcdef9999",
  "action": "CANCEL_ROUTE",
  "reason": "Waterlogging on NH-16 underpass"
}
```
**Reopen Failed Delivery**:
```json
{
  "targetType": "DELIVERY",
  "targetId": "65e01234567890abcdef8888",
  "action": "REOPEN_FAILED",
  "reason": "Customer confirmed availability for evening re-dispatch"
}
```

---

## 6. Optimization & Fuel Settings

### `GET /api/v1/admin/optimization-settings`
### `PUT /api/v1/admin/optimization-settings`
Configures algorithm weights and default profiles (`Distance Optimized`, `Time Optimized`, `Fuel Optimized`, `Balanced`).

### `GET /api/v1/admin/fuel-settings`
### `PUT /api/v1/admin/fuel-settings`
Updates fuel prices, EV kWh tariffs, and carbon emission factors.

---

## 7. Integrations, Audit Logs & Data Export

### `GET /api/v1/admin/integrations`
### `POST /api/v1/admin/integrations/test`
**Request Body**: `{ "service": "GEOAPIFY" }` or `{ "service": "MONGODB" }`.

### `GET /api/v1/admin/audit-logs`
Query parameters: `actorRole`, `type`, `startDate`, `endDate`, `page`, `limit`.

### `GET /api/v1/admin/data-export`
Query parameters: `dataset` (`deliveries`, `fleets`, `drivers`, `audit-logs`).
