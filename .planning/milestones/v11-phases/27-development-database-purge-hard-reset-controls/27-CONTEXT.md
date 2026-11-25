# Phase 27: Development Database Purge & Hard Reset Controls - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Developer & Admin Hard Reset / Database Purge mechanism. Provides an authorized, explicit, non-production / dev-testing control to permanently delete all operational records across consignments/deliveries, delivery batches, vehicles, drivers, route assignments, vehicle assignments, driver shifts, driver incidents, vehicle checklists, maintenance records, and telemetry tracking/alerts, while strictly safeguarding the active admin and system administrator user accounts to prevent developer lockouts.

</domain>

<decisions>
## Implementation Decisions

### Safety Safeguards & Confirmation UX
- **D-01:** Implement a 2-step destructive confirmation modal with a high-visibility warning banner and a safety countdown timer (e.g., 3-5 second delay on the final confirm button) before enabling the purge execution. No manual text typing required. — **Reversibility:** reversible — UI modal interaction pattern.
- **D-02:** Backend endpoint must require authenticated `ADMIN` role (`authorize(ROLES.ADMIN)`). Guard the operation so it only executes when confirmation payload is present (`{ confirmPurge: true }`). — **Reversibility:** reversible — backend route guard.

### User Account Retention Boundary
- **D-03:** Preserve the current active Admin session and all `ADMIN` role accounts. Wipe all operational collections, plus all `DRIVER` profile records and driver `User` logins (`role: ROLES.DRIVER`), preventing orphan driver accounts while ensuring developers and administrators are never locked out of the system. — **Reversibility:** costly — affects user collection purge filter.

### UI Placement & Danger Zone Design
- **D-04:** Place the "Purge All Operational Data" action inside `AdminControlCenterPage.tsx` directly in or adjacent to the existing developer/demo controls, styled as a prominent, high-contrast red "Developer Danger Zone" card. — **Reversibility:** reversible — component layout.

### Post-Purge Real-Time State & Socket Broadcast
- **D-05:** Upon successful database purge, the backend will emit a WebSocket event (`system:purged` / `demo:deleted`) via `socketService`. All connected client sessions will immediately zero out dashboard metrics, clear active map markers/routes, clear table data, and display a prominent green confirmation toast notification. — **Reversibility:** reversible — real-time event pipeline.

### the agent's Discretion
- Cascade deletion order across Mongoose models to cleanly avoid foreign key / dangling reference errors.
- Collection purge list: `deliveries`, `deliverybatches`, `vehicles`, `drivers`, `routes`, `routeassignments`, `vehicleassignments`, `telemetrypings`, `telemetryalerts`, `drivershifts`, `driverincidents`, `vehiclechecklists`, `maintenancerecords`, `deliveryevents`, `systemnotifications`, and driver users (`User.deleteMany({ role: ROLES.DRIVER })`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Models & Operational Schemas
- `server/src/models/Delivery.js` — Consignment & delivery status model
- `server/src/models/DeliveryBatch.js` — Delivery batch model
- `server/src/models/Driver.js` — Driver profiles & license records
- `server/src/models/Vehicle.js` — Fleet vehicles & battery/fuel tracking
- `server/src/models/Route.js` — Generated dispatch routes and stop sequences
- `server/src/models/User.js` — Authentication accounts (Admin vs Driver accounts)
- `server/src/services/demoDataService.js` — Reference implementation for demo data deletion and multi-model cleanup
- `server/src/services/socketService.js` — Real-time event broadcasting to active frontend clients

### Frontend Admin UI & Integration
- `client/src/pages/admin/AdminControlCenterPage.tsx` — Admin dashboard host page for the Danger Zone control
- `client/src/components/dashboard/DemoDatasetPanel.tsx` — Existing admin dataset control panel pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/demoDataService.js`: Contains entity resolution logic and collection models already imported and configured. Can be extended or complemented with `purgeAllOperationalData()`.
- `client/src/components/common/Modal.tsx` & `Button.tsx`: Base UI primitives for the destructive confirmation dialog.
- `client/src/components/common/DeleteWithUndoButton.tsx`: Confirmation state pattern reference.

### Established Patterns
- Admin routes are protected with `protect` and `authorize(ROLES.ADMIN)`.
- Real-time synchronization uses `socketService.emitToRole` or `io.emit`.

### Integration Points
- Backend: `DELETE /api/v1/admin/dev-purge` in `server/src/routes/adminRoutes.js` and `server/src/controllers/adminController.js`.
- Frontend: `AdminApi.purgeAllOperationalData()` in `client/src/api/client.ts`.
- UI: Danger Zone card in `AdminControlCenterPage.tsx`.

</code_context>

<specifics>
## Specific Ideas
- The user emphasized: "keep a button to delete everything all orders, drivers and vehicle vehicle assignments fleet tracking and batches everything make it purely for dev purposes".
- Danger Zone card should have clear warning text highlighting that this hard resets all operational data.
- The 2-step confirmation modal should count down (e.g. 3... 2... 1...) before the red "Confirm Purge" button unlocks to prevent accidental quick double-clicking.

</specifics>

<deferred>
## Deferred Ideas
None — discussion stayed strictly within the phase scope.

</deferred>

---

*Phase: 27-Development Database Purge & Hard Reset Controls*
*Context gathered: 2026-11-22*
