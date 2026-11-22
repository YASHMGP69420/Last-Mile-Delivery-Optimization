# Phase 28: Multi-Depot Vehicle Routing (MDVRP) & Multi-Hub Management - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-Depot Vehicle Routing (MDVRP) and Multi-Hub Management. Extends the existing single-depot routing engine to support multiple logistics hubs/warehouses across urban clusters. Provides a dedicated Hub database model with administrative CRUD, vehicle home hub assignments, nearest-hub consignment clustering, closed-loop multi-depot TSP route generation, custom warehouse icons on Leaflet maps, and hub filtering across batches and real-time fleet tracking views.

</domain>

<decisions>
## Implementation Decisions

### Hub / Depot Data Model & Management
- **D-01:** Create a dedicated `Hub` database model (`name`, `code`, `address`, `location: { lat, lng }`, `contactPhone`, `operatingHours`, `isActive`) with full Admin and Fleet Manager CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE /api/v1/hubs`). Seed initial Bhubaneswar logistics hubs (e.g., Rasulgarh Logistics Hub, Patia Infocity Hub, Khandagiri Distribution Terminal). — **Reversibility:** costly — introduces new top-level operational model.

### Consignment & Vehicle Hub Assignment
- **D-02:** Vehicles store an assigned `homeHubId` (reference to `Hub`, defaulting to Rasulgarh primary hub). Delivery batches and routing engine automatically cluster consignments to the nearest active hub based on geodistance during batch creation, while supporting manual dispatcher override. — **Reversibility:** reversible — schema extension with default fallback.

### Route Topology & Return Behavior
- **D-03:** Routes adhere to a strict closed-loop tour topology: each dispatch route begins at its assigned origin hub, serves optimized delivery stops via 2-Opt TSP, and returns to that exact same origin hub for end-of-route vehicle inspection and recharging. — **Reversibility:** reversible — routing heuristic constraint.

### Map Visuals & Dispatcher Filtering
- **D-04:** Dedicated "Hubs" management tab/view within Fleet Management (`/admin/fleets?tab=hubs` or `/admin/hubs`) with creation/edit modals. Interactive Leaflet maps (Route Planner, Live Fleet Tracking, Hub Terminal) render distinct warehouse SVG pin icons for all active hubs and provide a quick Hub Filter dropdown on Batches and Tracking boards. — **Reversibility:** reversible — frontend component addition.

### the agent's Discretion
- Graceful backward compatibility: When existing batches or routes lack a `hubId`, fallback seamlessly to `CANONICAL_DEPOT` (Rasulgarh) without breaking historical routes.
- Extend `devPurgeService` to optionally re-seed initial hubs upon hard reset or preserve primary hubs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Models & Schemas
- `server/src/models/Route.js` — Route schema with depot fields
- `server/src/models/DeliveryBatch.js` — Batch schema with depot fields
- `server/src/models/Vehicle.js` — Vehicle fleet schema for `homeHubId`
- `server/src/config/constants.js` — Canonical depot definition and constants
- `server/src/services/dispatchEligibilityService.js` — TSP route calculation and stop sequencing
- `server/src/controllers/routeController.js` — Route generation & dispatch endpoints
- `server/src/controllers/batchController.js` — Batch creation & optimization endpoints

### Frontend Components & Maps
- `client/src/pages/admin/FleetsPage.tsx` — Fleet management page for Hubs tab integration
- `client/src/components/maps/LiveRouteMap.tsx` — Leaflet route map renderer
- `client/src/components/maps/statusPinIcons.ts` — SVG map pin generators
- `client/src/api/client.ts` — API client service layer

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/dispatchEligibilityService.js`: Contains `calculateStopSequenceMetrics` and TSP local search; can accept variable depot coordinates.
- `client/src/components/maps/statusPinIcons.ts`: Pattern for generating Leaflet `divIcon` pins with custom SVG glyphs (add warehouse/hub icon).
- `client/src/components/common/Modal.tsx`, `Table.tsx`, `Button.tsx`: Admin CRUD UI primitives.

### Established Patterns
- Admin routes use `protect` and `authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER)`.
- Real-time updates emit through `socketService.js`.

### Integration Points
- Backend: `server/src/routes/hubRoutes.js` and `server/src/controllers/hubController.js`.
- Route Controller: Replace hardcoded `CANONICAL_DEPOT` fallback with dynamic hub lookup.
- Frontend: Add `HubsApi` in `client/src/api/client.ts` and Hubs tab in `FleetsPage.tsx`.

</code_context>

<specifics>
## Specific Ideas
- Initial seeded hubs in Bhubaneswar:
  1. Rasulgarh Logistics Hub (Central / East) - `20.2961, 85.8645`
  2. Patia Infocity Hub (North / IT Corridor) - `20.3533, 85.8178`
  3. Khandagiri Distribution Terminal (West / Industrial) - `20.2588, 85.7825`
- Map icon: Blue warehouse/building badge with high contrast in both dark and light modes.

</specifics>

<deferred>
## Deferred Ideas
- Inter-hub trunking / transfer routes (moving stock between warehouses) — belongs in a dedicated supply-chain logistics phase.
- Dynamic en-route hub re-allocation.

</deferred>

---

*Phase: 28-Multi-Depot Vehicle Routing (MDVRP) & Multi-Hub Management*
*Context gathered: 2026-11-23*
