# Phase 18: Production CI Stabilization & Real-Time Telemetry/Driver HUD Integration - Context

**Gathered:** 2026-11-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 18 bridges the remaining gaps between production stability, supply chain vulnerability management, CI execution reliability, and end-to-end real-time driver tracking telemetry. It delivers:
1. Long-term CI and dependency resilience (Vite 8, Vitest 5, React Router 7 lockfile stability, non-flaky timing assertions).
2. Resilient multi-provider mapping failover (circuit-breaker between Geoapify, Google Maps, and deterministic local matrix simulation).
3. Live driver HUD telemetry integration connecting real Socket.IO geolocation updates with active route maneuver execution and consolidated proof-of-delivery (POD) tracking.

</domain>

<decisions>
## Implementation Decisions

### 1. Supply Chain & CI Environment Hardening
- **D-01:** Standardize all monorepo test runners on deterministic one-shot execution (`vitest run` in client, `jest --runInBand` in server) with supply-chain audits pinned to `--audit-level=high`.
- **D-02:** Replace hardcoded wall-clock timeout expectations in adversarial benchmark tests with adaptive timeouts or relative metrics to prevent false-positive CI pipeline aborts under parallel load. — **Reversibility:** reversible — test calibration only.

### 2. Dual-Mode / Triple-Mode Mapping Failover Architecture
- **D-03:** Wrap `geoapify.service.js` and `googleMapsService.js` in a resilient `MappingProviderFactory` with an in-memory circuit breaker that auto-falls back to `simulatedTrafficService.js` upon quota exhaustion (429/OVER_QUERY_LIMIT) or network timeout (>3500ms). — **Reversibility:** costly — touches server mapping service callers.

### 3. Real-Time Telemetry & Driver Mobile HUD Coordination
- **D-04:** Wire `DriverCockpitPage.tsx` and `DriverRoutePage.tsx` to active Socket.IO room events (`route:join`, `driver:locationUpdated`), streaming battery state of charge (SoC), speed, and heading coordinates directly to the Live Tracking Control Center.
- **D-05:** Unify Proof of Delivery (POD) audit event records to unambiguously reflect whether delivery closure completed with OTP verification, signature canvas data, or photo evidence.

### Agent Discretion
- Selection of specific frontend telemetry reconnect backoff intervals (exponential vs fixed jitter).
- Organization of shared TypeScript interfaces between client tracking markers and server Socket.IO broadcast payloads.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mapping & Routing Engine
- `server/src/services/mapping/geoapify.service.js` — Primary production matrix provider
- `server/src/services/mapping/googleMapsService.js` — Secondary maps provider
- `server/src/services/mapping/simulatedTrafficService.js` — Deterministic local fallback matrix
- `server/src/services/mapping/matrixCache.js` — In-memory route distance/duration cache

### Telemetry & Real-Time Gateway
- `server/src/services/telemetryService.js` — Consented driver GPS logging & retention pruning
- `server/src/sockets/trackingSocket.js` — Socket.IO room authorization and event broadcasts
- `client/src/context/SocketContext.tsx` — Client socket connection lifecycle & reconnection guards

### Test Infrastructure & CI
- `.github/workflows/ci.yml` — Multi-stage CI pipeline definitions (supply chain, typecheck, tests, smoke, docker, e2e)
- `server/tests/adversarial_csv_batch.test.js` — High-volume ingestion & boundary benchmark tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `InteractiveMap.tsx` (`client/src/components/maps/`): Leaflet vector canvas with vehicle, stop, and route polyline overlay renderers.
- `PODModal.tsx` (`client/src/components/driver/`): Multi-step proof-of-delivery modal handling optional OTP, signature pad, and image uploads.
- `trackingService.js` & `telemetryValidationService.js`: Server-side coordinate and state validation with 30-day pruning policies.

### Established Patterns
- Envelope response format: `{ success: true, data: ..., error: ... }` across all REST endpoints.
- Role-based authorization via `authenticateToken` middleware and route-level guards (`SuperAdminGuard`).
- BOLA isolation: Drivers are strictly restricted to accessing deliveries and routes assigned to their personal credentials.

### Integration Points
- REST endpoints under `/api/v1/telemetry/*` and `/api/v1/routes/*`.
- Socket.IO gateway namespace `/socket/tracking`.

</code_context>

<specifics>
## Specific Ideas
- Seamless end-to-end operation: dispatcher assigns batch -> system optimizes sequence -> driver receives instant real-time notification in HUD -> driver begins route -> live vehicle coordinates show on dispatcher master map.

</specifics>

<deferred>
## Deferred Ideas
- Offline-first IndexedDB telemetry caching for field drivers when network connectivity drops completely (future phase).

</deferred>

---

*Phase: 18-Production CI Stabilization & Real-Time Telemetry/Driver HUD Integration*
*Context gathered: 2026-11-15*
