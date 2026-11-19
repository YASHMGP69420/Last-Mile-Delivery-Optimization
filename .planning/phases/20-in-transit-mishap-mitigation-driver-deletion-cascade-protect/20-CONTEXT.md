# Phase 20: In-Transit Mishap Mitigation & Driver Deletion Cascade Protection - Context

**Gathered:** 2026-11-20  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Prevent order and route orphaning during in-transit driver mishaps or account deletion; enforce pre-deletion resource guards with actionable conflicts, automate emergency cascade recovery (unassigning uncompleted orders back to the READY dispatch pool, cancelling stranded routes, and releasing vehicle/shift locks), and provide dispatcher re-routing controls with real-time audit trails.

</domain>

<decisions>
## Implementation Decisions

### Pre-Deletion & Status Guards
- **D-01:** Strict block with actionable resolution modal. When an Admin attempts to delete a user/driver (or change status to INACTIVE/SUSPENDED) in User Management, backend enforces `assertNoActiveDriverOrVehicleOperations`, returning `409 ACTIVE_OPERATION_CONFLICT` with active route code and stop counts. The Admin UI presents an actionable modal dialog showing the active assignment details and offering a one-click "Reassign Active Orders & Delete" action (passing `forceReassign=true`), alongside "Cancel". — **Reversibility:** costly — touches `adminController.js`, `driverController.js`, `UserTable.tsx`, and `UserManagementPage.tsx`.

### Order Rescue & Recovery Policy
- **D-02:** Urgent pool return policy. Completed deliveries on the disrupted route remain `COMPLETED` with POD signature and photo evidence intact (zero data loss). Uncompleted orders (`PENDING`, `OUT_FOR_DELIVERY`, or `FAILED`) are rescued: their status transitions back to `READY`, their `routeId`, `assignedDriverId`, and `assignedVehicleId` are cleared, and their priority is boosted to `'Urgent'` so the route optimizer automatically prioritizes them in the next batch. An `AUDIT_EVENT_TYPES.EXCEPTION_REPORTED` audit log is created per rescued delivery. — **Reversibility:** reversible — database status transition logic in delivery model and cascade service.

### Route, Shift & Vehicle Cascades
- **D-03:** Full resource release cascade. The affected active route's status updates to `CANCELLED` with `cancellationReason: 'DRIVER_REMOVED'` (or mishap reason `VEHICLE_BREAKDOWN` / `ACCIDENT_OR_SAFETY`), open `DriverShift` is force-closed (`clockOut: new Date()`, `status: 'FORCE_CLOSED'`), active `VehicleAssignment` is unlinked (`active: false`), and `Vehicle` status resets to `AVAILABLE` (or `MAINTENANCE` if vehicle breakdown). — **Reversibility:** costly — touches multiple operational Mongoose schemas (`Route`, `DriverShift`, `Vehicle`, `VehicleAssignment`).

### Real-time Dispatcher Alerting & Sockets
- **D-04:** Multi-channel broadcast. When a driver is deleted or an emergency mishap occurs, the backend emits Socket.IO events `route:cancelled`, `driver:incident`, and `deliveries:reassigned` to dispatch and tracking rooms; generates a high-severity `SystemNotification` for fleet managers and admins; and displays a live alert banner in the Control Center with a direct link to the rescued orders in the Deliveries queue. — **Reversibility:** reversible — notification and event broadcasting.

### the agent's Discretion
- Database transaction safety: Use Mongoose transactions (`session.withTransaction`) where supported to guarantee atomic execution of the cascade recovery across Deliveries, Routes, Shifts, and Vehicles.
- Error code naming: Standardize on `ACTIVE_OPERATION_CONFLICT` with payload `{ routeId, routeCode, activeDeliveryCount, driverName }`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Operational Integrity & Resource Guards
- `server/src/services/resourceGuardService.js` — Shared `assertNoActiveDriverOrVehicleOperations` active shift and route guard logic.
- `server/src/controllers/adminController.js` — `deleteUser` and user management API endpoints.
- `server/src/controllers/routeController.js` — Active route lifecycle, incident reporting, and reoptimization.
- `server/src/controllers/driverController.js` — Driver profile management and availability transitions.
- `server/src/models/Delivery.js` — Consignment lifecycle statuses (`DRAFT`, `READY`, `ASSIGNED`, `OUT_FOR_DELIVERY`, `COMPLETED`, `FAILED`).
- `server/src/models/Route.js` — Route schema, stop statuses, and cancellation reasons.
- `server/src/models/DriverShift.js` — Driver shift tracking and force-close mechanics.
- `server/src/services/socketService.js` — Real-time event broadcasting to management and tracking rooms.

### Admin & Operations UI
- `client/src/components/admin/UserTable.tsx` — User management table and deletion confirmation modal.
- `client/src/pages/admin/UserManagementPage.tsx` — Admin user management page and delete handler.
- `client/src/pages/admin/AdminControlCenterPage.tsx` — Real-time operations control center and active dispatch monitoring.

</canonical_refs>
