# Phase 21: Driver Handheld Delivery Sync & Demo Account Isolation - Context

**Gathered:** 2026-11-20  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Ensure resilient, real-time delivery assignment and stop status updates on driver handhelds (Driver Cockpit and Route views) via hybrid WebSocket reconciliation and multi-room broadcast, eliminate synchronization lag or stale views, and enforce strict demo account boundaries preventing demo dispatchers from assigning or pushing to non-demo drivers.

</domain>

<decisions>
## Implementation Decisions

### Handheld Real-Time State Reconciliation & Sync Resilience
- **D-01:** Hybrid socket + reconnect re-fetch + visibility hook. Maintain the existing Socket.IO rooms (`driver:${driverId}`, `route:${routeId}`), but enhance `DriverSocketContext.tsx`, `DriverCockpitPage.tsx`, and `DriverRoutePage.tsx` with automatic background re-fetch whenever the window/PWA regains focus (`visibilitychange`), on socket `reconnect`, and immediately upon receiving `route:dispatched` / `route:updated` events. Debounce re-fetch calls by 500ms to avoid flooding on rapid tab switching. — **Reversibility:** costly — touches `DriverSocketContext.tsx`, `DriverCockpitPage.tsx`, and `DriverRoutePage.tsx`.

### Stop Progression Dual-Model Atomic Sync & Multi-Room Broadcast
- **D-02:** Dual-model atomic sync + multi-room broadcast. When a driver marks a stop as *Arrived*, *Completed* (with POD/OTP), or *Failed* in `driverHudController.js`, update both embedded `Route.stops[i].status` and the top-level `Delivery.status` in tandem. Broadcast `delivery:status_changed`, `route:updated`, and `driver:stop_progressed` to both the route room and the `management` room simultaneously, ensuring instantaneous reflection across driver HUD, dispatcher Control Center, and Live Fleet Board without requiring manual page refreshes. — **Reversibility:** costly — touches `driverHudController.js`, `socketService.js`, and model status sync hooks.

### Demo Account Dispatch & Push Isolation
- **D-03:** Strict end-to-end sandbox boundary.
  - **Backend Enforcement:** In `dispatchExecutionService.js`, `routeController.js` (`pushRouteToHandheld`), and `batchController.js`: if `req.user.isDemoData === true` (or email ends in `@smartroute.local`), block assignment or push to any driver without `isDemoData: true`, returning HTTP `403 DEMO_ISOLATION_VIOLATION`. Conversely, non-demo dispatchers cannot push or assign to demo drivers.
  - **Frontend Filtering:** In `BatchComposerPanel.tsx`, `RoutePlannerPage.tsx`, and driver assignment selects, automatically filter the driver/vehicle dropdowns so demo dispatchers only see demo drivers (`OD02-DEMO-*` / `Rajesh`, `Bikash`, `Sunil`). — **Reversibility:** costly — touches backend dispatch pipeline, route controllers, and frontend batch/route planner components.

### Driver Handheld Demo Mode Visual Cues
- **D-04:** Amber demo status banner. When logged in as a demo driver (`user.isDemoData === true`), render a sticky, high-visibility amber pill/banner atop the Driver Cockpit and Route pages (`"Demo Driver Session — Simulated Handheld"`), making the demo sandbox mode unambiguous to QA testers and operators. — **Reversibility:** reversible — frontend component styling in `DriverCockpitPage.tsx` and `DriverRoutePage.tsx`.

### the agent's Discretion
- Error response standardization: Return structured error code `DEMO_ISOLATION_VIOLATION` with message explaining whether a demo dispatcher attempted a production driver push or vice versa.
- Throttle/debounce parameter tuning: 500ms debounce on window focus re-fetch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Handheld Driver Views & Real-Time Context
- `client/src/context/DriverSocketContext.tsx` — Driver handheld WebSocket connection, room subscriptions, and telemetry sync.
- `client/src/pages/driver/DriverCockpitPage.tsx` — Driver Cockpit handheld active stop view and progression controls.
- `client/src/pages/driver/DriverRoutePage.tsx` — Driver manifest route overview.
- `server/src/controllers/driverHudController.js` — Driver HUD endpoints (`getActiveRoute`, `getDeliveries`, stop status updates).
- `server/src/middleware/socketAuth.js` — Socket authentication and room authorization (`driver:join`, `route:join`).
- `server/src/services/socketService.js` — Multi-room WebSocket broadcast.

### Dispatching & Demo Isolation
- `server/src/controllers/routeController.js` — Route dispatch and handheld push (`pushRouteToHandheld`).
- `server/src/services/dispatch/dispatchExecutionService.js` — Dispatch execution engine and driver assignment validation.
- `server/src/controllers/batchController.js` — Batch creation and dispatch controls.
- `server/src/services/demoDataService.js` — Demo accounts and demo driver specifications.
- `client/src/components/deliveries/BatchComposerPanel.tsx` — Batch composer driver/vehicle assignment selectors.
- `client/src/pages/admin/RoutePlannerPage.tsx` — Route planner driver assignment dropdowns.

</canonical_refs>
