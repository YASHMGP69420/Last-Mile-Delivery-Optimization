# SmartRoute Admin Control Center Guide

## 1. Executive Summary

The **Admin Control Center** is the privileged executive workspace of SmartRoute, accessible exclusively by accounts holding the `ADMIN` role. It provides centralized operational governance, multi-depot configuration, system health diagnostics, policy tariffs, and append-only audit trail oversight.

Ordinary fleet dispatchers holding `FLEET_MANAGER` and field couriers holding `DRIVER` are strictly isolated from these privileged capabilities via backend Express RBAC middleware (`authorize(ROLES.ADMIN)`) and client route guards (`SuperAdminGuard`).

---

## 2. Navigating the Admin Control Center

The Admin Control Center is accessible via the sidebar under the **ADMIN CONTROL CENTER** section:

| Route | View Name | Core Operational Capabilities |
| :--- | :--- | :--- |
| `/admin/control-center` | **Admin Overview** | Executive KPIs, live infrastructure health diagnostics, operational counters, recent audit activity |
| `/admin/users` | **User & Access** | Provisioning users, role assignment, account status suspension, credential resets, self-lockout prevention |
| `/admin/permissions` | **Role Permissions** | Granular action-capability matrix across 7 system modules, real-time policy persistence |
| `/admin/organization` | **Organization & Depots** | Corporate legal metadata, operating regions, daily business hours, multi-depot staging nodes with geo coordinates |
| `/admin/fleet-control` | **Fleet Control** | Global vehicle & driver registry, emergency suspensions to `MAINTENANCE`, forced off-duty overrides |
| `/admin/operations` | **Operations Oversight** | Active in-progress route oversight, emergency route cancellations with resource recovery, failed consignment reopening |
| `/admin/optimization-settings`| **Optimization Engine** | Multi-objective weights (distance, travel time, fuel expense, priority, workload balance), algorithm profiles |
| `/admin/fuel-settings` | **Fuel & Tariffs** | Commercial petrol, diesel, CNG prices, EV charging tariffs, GHG emission factors (g CO2/km) |
| `/admin/integrations` | **Integrations & APIs** | Geoapify, Leaflet OSM, MongoDB, Socket.IO health checks, connection ping diagnostics, masked API credentials |
| `/admin/audit-logs` | **System Audit Logs** | Immutable append-only audit ledger with actor filtering, event classification, and JSON state diffs |
| `/admin/notifications` | **System Alerts** | Real-time weather and mechanical alerts, broadcast messaging to whole organization or specific roles |
| `/admin/data-management` | **Data Governance** | One-click JSON exports for consignments, fleets, drivers, and audit events; disaster recovery documentation |

---

## 3. Detailed View Walkthroughs

### 3.1 Admin Overview (`/admin/control-center`)
- **Executive KPIs**: Real-time counters for Total Users, Active Drivers, Total Vehicles, Available Vehicles, Active Deliveries, Completed Deliveries, Failed Deliveries, On-Time Success Rate, and Fleet Utilization.
- **Live Infrastructure Probes**: Actual socket and database diagnostics:
  - *Backend API*: Uptime seconds and RSS memory usage.
  - *MongoDB*: Connection status and active database name.
  - *Geoapify / Tiles*: API key presence and routing engine readiness.
  - *Realtime Dispatch*: WebSocket channel handshake status.
- **Recent Administrative Activity**: Live feed from `AuditEvent` displaying actor, action summary, and timestamp.

### 3.2 User and Access Management (`/admin/users`)
- **Account Provisioning**: Form to create new users with name, email, role (`ADMIN`, `FLEET_MANAGER`, `DRIVER`), phone, and department.
- **Access Suspension**: One-click toggling between `ACTIVE` and `SUSPENDED`. Requires mandatory administrative justification.
- **Self-Lockout Guard**: Backend rejects attempts by administrators to suspend their own account or revoke their own admin role (`SELF_LOCKOUT_PREVENTED`).
- **Credential Reset**: Generates a secure temporary password and invalidates active JWT refresh tokens.

### 3.3 Organization & Multi-Depot Infrastructure (`/admin/organization`)
- **Corporate Metadata**: Legal business name, business address, operating regions, timezone, and currency.
- **Multi-Depot Node Registration**: Add and configure secondary hubs:
  - Depot Name & Address.
  - Precise Latitude and Longitude coordinates.
  - Service territory and daily operating windows.
  - Instant online/offline status toggling. The optimization engine dynamically partitions consignments based on active depot coordinates.

### 3.4 Fleet-Wide Control & Emergency Suspensions (`/admin/fleet-control`)
- **Vehicle Grounding**: If a vehicle has mechanical defects, click **Suspend to Maintenance**. Requires mandatory reason (minimum 5 characters). Automatically sets vehicle availability to `MAINTENANCE` and blocks further dispatch.
- **Driver Override**: Force driver off-duty or restore availability with logged rationale.

### 3.5 Operations Control (`/admin/operations`)
- **Emergency Route Cancellation**: Cancels in-progress or dispatched route, unassigns vehicle and driver back to pool, and resets deliveries back to `READY` for re-batching.
- **Failed Consignment Reopening**: Transitions `FAILED` consignments back to `READY` status after customer contact, clearing previous failure flags.
- **Priority Escalation**: Elevates consignment priority (`Standard` → `Urgent` / `Cold Chain`) with audit logging.

### 3.6 Optimization Engine Configuration (`/admin/optimization-settings`)
- **Preset Profiles**: One-click selection between *Distance Optimized*, *Time Optimized*, *Fuel Optimized*, and *Balanced*.
- **Granular Weights**: Interactive sliders for Distance (0-1), Time (0-1), Fuel (0-1), Priority (0-1), and Workload (0-1).
- **Constraints**: Maximum route duration minutes and closed-loop depot return enforcement.

---

## 4. Verification & Audit Compliance

All administrative mutations automatically emit an immutable `AuditEvent` record with:
- `actorId`: Authenticated Admin ObjectId
- `actorRole`: `ADMIN`
- `action`: Human-readable summary
- `type`: `ADMIN_USER_ACTION`, `ADMIN_SETTING_CHANGED`, or `ADMIN_OPERATIONAL_OVERRIDE`
- `metadata`: Target entity, previous state, new state, and mandatory justification.
