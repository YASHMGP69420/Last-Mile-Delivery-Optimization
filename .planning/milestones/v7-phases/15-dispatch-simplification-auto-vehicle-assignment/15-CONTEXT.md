# Phase 15: Dispatch Simplification & Auto Vehicle Assignment — Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove manual vehicle selection from Fleet Vehicle Management and Driver Management pages. Remove vehicle and driver selection from the Batch Composer and Consignment Drawer. Vehicle assignment happens automatically during route optimization using capacity-first bin-packing across all available fleet vehicles. Drivers are auto-assigned by availability and can be overridden via a "Change Driver" link in the optimization result card.

</domain>

<decisions>
## Implementation Decisions

### Vehicle Auto-Selection During Optimization
- **D-01:** Vehicle selection strategy is **best-fit** — pick the smallest vehicle that can carry the total batch weight, avoiding over-provisioning large trucks for small loads. — **Reversibility:** reversible
- **D-02:** After optimization runs, the dispatcher sees the auto-selected vehicle in the **optimization result card** showing plate number, make/model, and capacity used as a percentage (e.g. "MH12-AB-1234 · Tata Ace · 72% load"). — **Reversibility:** reversible
- **D-03:** **Soft lock with override** — the result card shows the auto-selected vehicle plus a "Change Vehicle" link that lets the dispatcher swap to a different available vehicle before dispatching. — **Reversibility:** reversible
- **D-04:** When no single available vehicle fits the full batch weight, the system **auto-splits the batch across multiple vehicles** using zone-based grouping to ensure same-day delivery. This leverages the existing bin-packer multi-bin output that the UI currently hides. The result card shows multiple sub-routes, one per vehicle. — **Reversibility:** costly — UI currently only surfaces the first bin's route; surfacing multi-bin results touches the optimization result card, route list, and dispatch flow.
- **D-05:** Drivers are **auto-assigned** to each vehicle bin by availability status (AVAILABLE → ON_DUTY), with a "Change Driver" link in each sub-route card in the result to override before dispatching. — **Reversibility:** reversible

### Batch Composer Changes
- **D-06:** The **vehicle dropdown is removed** from `BatchComposerPanel`. Batch creation requires only: batch code, batch name, shift, and selected deliveries. No vehicle or driver selection at batch creation time. — **Reversibility:** reversible
- **D-07:** The **driver dropdown is also removed** from `BatchComposerPanel`. Driver assignment is deferred to the optimization step. — **Reversibility:** reversible

### Consignment / Delivery Drawer Changes
- **D-08:** The **vehicle and driver dropdowns are removed entirely** from `ConsignmentDrawer`. After dispatch, vehicle and driver are shown as **read-only info** (the batch status chip showing batch code and route status e.g. "BBSR-EXP-4821 · Dispatched"). — **Reversibility:** reversible
- **D-09:** Replace the assignment section in ConsignmentDrawer with a **"Batch" status chip**: batch code + route status (Pending / Dispatched). No action buttons. — **Reversibility:** reversible

### Fleet & Driver Management Pages
- **D-10:** Remove the **"Assign Vehicle" button and assign-vehicle modal** from `DriversPage`. The driver table row no longer shows an assign action. The "Assigned Vehicle" column may remain as a read-only display (populated by the optimizer) or be removed — agent discretion. — **Reversibility:** reversible
- **D-11:** Remove the **"Assigned Driver" column** from the vehicles table in `FleetsPage` (this field is now managed by the optimizer, not manually). — **Reversibility:** reversible
- **D-12:** Remove the **"Assign Vehicle" dropdown** from the driver onboarding form (`newDriver.assignedVehicleId` field + post-create `assignVehicle` call). Drivers are onboarded without pre-assigning a vehicle. — **Reversibility:** reversible

### the agent's Discretion
- Whether to keep the read-only "Assigned Vehicle" display column in `DriversPage` or remove it entirely (populated by optimizer after dispatch).
- Exact UI styling of the "Change Vehicle" and "Change Driver" links in the result card (button vs link vs dropdown inline).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Batch & Vehicle Assignment Logic
- `server/src/controllers/routeController.js` — `optimizeRoutes` function (lines 352–): vehicle resolution logic (lines 403–417), bin-packer call (line 427), multi-bin route building loop
- `server/src/services/optimization/binPacker.js` — Capacity-first bin-packing; already supports multi-bin output
- `client/src/components/deliveries/BatchComposerPanel.tsx` — Remove `selectedVehicleId` state, vehicle dropdown (line 68–69), driver dropdown (line 71–72); remove vehicle+driver from `BatchesApi.create` call (lines 160–161)

### Consignment Drawer
- `client/src/components/deliveries/ConsignmentDrawer.tsx` — Remove `assignVehicleId` / `assignDriverId` state (lines 186–259); remove dropdowns (lines 630–671); replace with batch status chip

### Fleet & Driver Management Pages
- `client/src/pages/admin/DriversPage.tsx` — Remove assign modal (lines 18–22), `handleAssign` / `handleUnassign` functions (lines 84–115), assign-vehicle field in onboard form (line 32)
- `client/src/pages/admin/FleetsPage.tsx` — Remove "Assigned Driver" column (line 501–505)

### API Layer
- `client/src/api/client.ts` — `FleetApi.assignVehicle` / `FleetApi.unassignVehicle` (lines 276–281) may no longer be called from UI (keep backend endpoint, remove frontend call sites)
- `client/src/api/routeApi.ts` — `RoutesApi.optimize` / `reoptimize` — no changes needed; backend already supports auto vehicle selection

### Optimization Result UI
- `client/src/pages/admin/` — Identify the optimization result card component (likely in `DeliveriesPage.tsx` or `BatchManagementPage.tsx`) where the auto-selected vehicle, capacity %, and "Change Vehicle" / "Change Driver" links must be added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/services/optimization/binPacker.js` — Already produces `vehicleBins[]` with multi-vehicle support; optimizer already falls back to all AVAILABLE vehicles when batch has no vehicleIds (line 410–412 in routeController)
- `BatchComposerPanel.tsx:35–43` — `getPreferredVehicleId` / `getPreferredDriverId` helpers — these can be repurposed as the auto-select fallback logic displayed in the result card
- `ConsignmentDrawer.tsx` — The batch code is already tracked in delivery data; the status chip just needs to surface it

### Established Patterns
- Optimization result card already shows `totalDistanceKm`, `costInr`, `co2Kg` — extend it with `vehicleId`, `makeModel`, `capacityUsedPct`
- "Change X" inline override pattern can follow the existing "Re-optimize" button pattern in `TrackingPage.tsx`

### Integration Points
- Backend `routeController.optimizeRoutes` already auto-picks vehicles from AVAILABLE fleet when `batch.vehicleIds` is empty — **no backend change needed for vehicle auto-selection**
- Backend driver auto-assignment needs a new service or the controller needs to resolve the best available driver per bin when `batch.driverIds` is empty
- Multi-bin UI: the optimize response already returns `plannedRoutes[]` for each bin — the front end currently only reads the first; must surface all bins

</code_context>

<specifics>
## Specific Ideas

- Auto-split across vehicles should group stops by **zone/area** so drivers aren't criss-crossing the city — the existing nearest-neighbor optimizer naturally clusters by proximity, so bin routing already achieves this
- "Change Driver" and "Change Vehicle" should be lightweight inline pickers (a compact dropdown or popover), not full modals
- The batch status chip in ConsignmentDrawer should use the existing `Badge`/`Chip` component pattern already present in the design system

</specifics>

<deferred>
## Deferred Ideas

- **Zone-aware manual batch splitting UI** — letting dispatchers manually split a large batch into zones before optimizing; belongs in a future "Advanced Dispatch Controls" phase
- **Driver workload balancing dashboard** — showing historical delivery counts per driver for fair assignment; separate analytics phase
- **Vehicle maintenance scheduling integration** — blocking vehicles that are due for service from auto-selection; separate maintenance-tracking phase

</deferred>

---

*Phase: 15 — Dispatch Simplification & Auto Vehicle Assignment*
*Context gathered: 2026-11-12*
