# SmartRoute Role & Permission Policy Matrix

## 1. Overview

SmartRoute enforces a strict 3-tier Role-Based Access Control (RBAC) model. Privileges are enforced at both the client route guard level and independently at the Express API middleware level.

---

## 2. Global Role Capability Comparison

| System Capability | Super Admin (`ADMIN`) | Fleet Manager (`FLEET_MANAGER`) | Driver (`DRIVER`) |
| :--- | :---: | :---: | :---: |
| **Access Admin Control Center** (`/admin/control-center`) | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **User Account Provisioning & Suspension** | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **Role & Permission Policy Configuration** | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **Multi-Depot Management & Staging Hubs** | **YES** | Read-Only | Read-Only (Assigned Hub) |
| **Optimization Algorithm Weights Configuration** | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **Fuel & Energy Tariff Policy Settings** | **YES** | Read-Only | NO (403 Forbidden) |
| **Infrastructure Diagnostics & Integration Testing** | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **System Audit Logs & Export** | **YES** | Read-Only (Operational) | NO (403 Forbidden) |
| **Broadcast System Alerts** | **YES** | Dispatch Alerts Only | View Assigned Alerts |
| **Data Governance & Disaster Recovery Exports** | **YES** | NO (403 Forbidden) | NO (403 Forbidden) |
| **Emergency Route Cancellation** | **YES** | YES | NO (403 Forbidden) |
| **Reopen Failed Consignments** | **YES** | YES | NO (403 Forbidden) |
| **Vehicle Maintenance Suspension** | **YES** | YES | Inspection Trigger Only |
| **Vehicle Registry Management (CRUD)** | **YES** | YES | Read-Only (Assigned Vehicle) |
| **Driver Personnel Roster (CRUD)** | **YES** | YES | Read-Only (Own Profile) |
| **Delivery Batches Ingestion & CSV Import** | **YES** | YES | NO (403 Forbidden) |
| **Run TSP Route Optimization & Dispatch** | **YES** | YES | View Assigned Dispatches |
| **Live Telemetry & Fleet Tracking** | **YES** | YES | View Own Dispatches |
| **Driver HUD / Mobile Cockpit Access** | Simulation/Test Mode | Simulation/Test Mode | **YES (Primary Field UI)** |
| **Shift Clock In / Out & Attendance** | Override Authority | Schedule Viewing | **YES (Own Shift)** |
| **Pre-Trip Vehicle Safety Checklist Submission**| Audit & Review | Review & Action | **YES (Own Assigned Van)** |
| **Proof of Delivery (POD) Electronic Capture** | Review & Audit | Review & Audit | **YES (Own Route Stops)** |
| **Report Field Delivery Exceptions / Failures** | Review & Action | Review & Action | **YES (Own Route Stops)** |
| **Field Incident Reporting** | Review & Dispatch | Review & Dispatch | **YES (Submit Incidents)** |

---

## 3. Broken Object-Level Authorization (BOLA) Protection

To prevent horizontal privilege escalation between field couriers:
- Drivers can **only** view, update, or complete consignments that belong to their active route or have `assignedDriverId` equal to their driver ID.
- Attempts by Driver A to query or mutate Driver B's deliveries return `403 BOLA_VIOLATION`.
- Driver listing routes is automatically filtered at the database query level to `{ driverId: req.user.driverId }`.
