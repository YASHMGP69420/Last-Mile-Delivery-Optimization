# SmartRoute – Chief Operations Admin User Guide

This guide is designed for users holding the `ADMIN` role. It explains system oversight, user provisioning, global fleet configuration, audit logging, and platform administration.

---

## 1. Logging into the Admin Cockpit

1. Open your browser and navigate to `http://localhost:5174/login`.
2. Enter your administrator credentials:
   - **Email**: `admin@example.com` (or `admin@smartroute.io`)
   - **Password**: `admin123` (or `Admin@123`)
   - *Quick Login*: Click the **Admin** button under the demo shortcuts for instant single-click authentication.
3. Upon authentication, you will be redirected to the central administrative cockpit (`/admin/deliveries`).

---

## 2. Navigating the Admin Workspace

The left-hand navigation sidebar provides direct access to all operational modules:

* **Deliveries Manifest** (`/admin/deliveries`): Complete listing of active, draft, assigned, and completed parcels.
* **Operational Batches** (`/admin/batches`): Centralized dispatch groups and scheduling.
* **Fleets** (`/admin/fleets`): Fleet divisions, vehicle registry, capacity ratings, and fuel types.
* **Drivers** (`/admin/drivers`): Driver records, commercial licenses, and vehicle-driver pairings.
* **Route Optimizer** (`/admin/optimizer`): Algorithmic 2-Opt TSP engine, map visualization, and dispatch controls.
* **Live Telemetry** (`/admin/tracking`): Real-time fleet HUD and GIS tracking canvas.
* **Operations Analytics** (`/admin/analytics`): System-wide KPIs, cost savings, and CSV report export.

---

## 3. Theme Customization (Light, Dark, and Auto Modes)

SmartRoute features native dark and light mode customization:

1. Locate the **Theme Toggle** in the top navigation bar (`AdminHeader`) next to your user role badge.
2. Select between:
   - **Light**: Crisp high-contrast daylight theme.
   - **Auto**: Synchronizes automatically with your OS preference (`prefers-color-scheme`).
   - **Dark**: Low-glare night cockpit theme with deep slate surfaces.
3. Your selected theme persists across page refreshes and browser sessions via `localStorage`.

---

## 4. User Provisioning & Role Management

Administrators have exclusive authorization to create new administrative and operational user accounts:

### Endpoint: `POST /api/v1/auth/users`
```bash
curl -X POST http://localhost:5004/api/v1/auth/users \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Siddharth Patnaik",
    "email": "siddharth@smartroute.internal",
    "password": "TemporaryPassword123",
    "role": "FLEET_MANAGER",
    "phone": "+91 94370 99999"
  }'
```

Available Roles:
* `ADMIN`: Full system-wide read, write, update, delete, and audit access.
* `FLEET_MANAGER`: Operational access to deliveries, batches, fleets, drivers, routes, and analytics.
* `DRIVER`: Handheld mobile view, assigned route navigation, and Proof of Delivery submission.

---

## 5. Audit Logging & Compliance Oversight

SmartRoute automatically captures an immutable audit record for every major operational event:

* `ROUTE_OPTIMIZED`: Recorded whenever an optimization run executes with iterations and distance saved.
* `ROUTE_DISPATCHED`: Recorded when a route is dispatched, locking deliveries to `ASSIGNED` status.
* `STATUS_CHANGE`: Recorded when delivery statuses progress (`DRAFT` $\to$ `READY` $\to$ `ASSIGNED` $\to$ `COMPLETED` / `FAILED`).
* `ASSIGNMENT_CHANGE`: Recorded when vehicles are paired with or unassigned from drivers.
* `POD_RECORDED`: Captures recipient signature, OTP, and photo evidence.
* `EXCEPTION_REPORTED`: Captures failed deliveries and driver-reported operational exceptions.
* `CSV_IMPORTED`: Tracks bulk consignment and vehicle ingestion.

Audit events record:
1. `type`: Event classification.
2. `actorId`: User ID who initiated the operation.
3. `actorRole`: Role under which the operation was authorized.
4. `action`: Human-readable summary.
5. `metadata`: Associated batch, route, vehicle, or delivery references.
6. `createdAt`: High-precision ISO timestamp.
