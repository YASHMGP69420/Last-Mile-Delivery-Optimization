---
phase: 28-multi-depot-vehicle-routing-mdvrp-multi-hub-management
plan: "03"
subsystem: frontend-hubs-management
tags:
  - multi-hub
  - warehouse-pins
  - fleets-page
  - batches-page
  - tracking-page
  - leaflet
dependency_graph:
  requires:
    - 28-01
    - 28-02
  provides:
    - multi-hub-management-ui
    - warehouse-map-pins
    - hub-filtering
  affects:
    - client/src/pages/admin/FleetsPage.tsx
    - client/src/pages/BatchesPage.tsx
    - client/src/pages/admin/TrackingPage.tsx
    - client/src/components/maps/InteractiveMap.tsx
tech_stack:
  added: []
  patterns:
    - leaflet-warehouse-marker
    - hub-tab-switcher
    - cascade-guards-modal
    - multi-depot-dispatch-filtering
key_files:
  created:
    - client/src/types/hub.ts
    - client/src/pages/admin/__tests__/FleetsPageHubs.test.tsx
  modified:
    - client/src/types/index.ts
    - client/src/api/client.ts
    - client/src/components/maps/markerIcons.ts
    - client/src/components/maps/InteractiveMap.tsx
    - client/src/components/maps/__tests__/statusPinIcons.test.tsx
    - client/src/pages/admin/FleetsPage.tsx
    - client/src/pages/BatchesPage.tsx
    - client/src/pages/admin/TrackingPage.tsx
decisions:
  - "D-04 Dedicated Hubs Management Tab: Implemented within Fleet Management (FleetsPage.tsx) allowing administrators and managers to view, create, edit, toggle, and delete hubs with cascade guards."
  - "D-04 Warehouse SVG Map Pins: Styled Leaflet DivIcon warehouse markers with roof, bay doors, and gold canonical badge, rendered with escapeHtml sanitization (T-28-11)."
  - "D-04 Dispatch & Live Fleet Hub Filtering: Added hub filter dropdowns to BatchesPage and TrackingPage to instantly filter batches, vehicles, and active GPS markers by origin hub."
metrics:
  duration: 15m
  completed: "2026-11-23"
status: complete
actuals:
  tokens: 11250
  tasks: 3
  commits: 3
  plan_head_before: aceebfe6ee42f36a1b845f97ed7ad71a7c879806
  plan_head_after: b97bb05d992d8b415a8d47d99585870a8f1311c5
---

# Phase 28 Plan 03: Multi-Hub Management UI, Leaflet Warehouse Pins & Dispatch Filtering Summary

Multi-hub administrative interface, custom Leaflet warehouse SVG map pins, and hub filtering across dispatch boards and live fleet tracking.

## Overview

Plan 28-03 delivers the administrative and operational user interface for multi-hub management across SmartRoute:
1. **Frontend Hub Contracts & REST Service**: Created `client/src/types/hub.ts` and exported `HubsApi` in `client/src/api/client.ts`, with endpoints for hub listing, retrieval, registration, editing, cascade deletion, active toggling, and cluster preview.
2. **Custom Leaflet Warehouse SVG Pin Icons**: Built `createWarehouseHubIcon` in `markerIcons.ts` featuring a stylized warehouse building with roof and bay doors, gold canonical badges for the primary hub, and HTML/XSS sanitization via `escapeHtml`. Integrated into `InteractiveMap.tsx` with popups and bounds fitting.
3. **Dedicated Hubs Management Tab in FleetsPage**: Added a tab switcher ('Vehicles' vs 'Hubs & Depots') with count badges in `FleetsPage.tsx`, interactive Hubs table with operating hours, status toggles, and CRUD modals (Register Hub, Edit Hub, Delete Hub with cascade protection explanations).
4. **Vehicle Home Hub Assignment**: Added Home Hub selector dropdowns to vehicle registration and edit modals, defaulting to the canonical primary hub (Rasulgarh), and displayed assigned Home Hub in the Vehicles table.
5. **Hub Filtering on Batches & Live Tracking**: Added hub filter dropdowns to `BatchesPage.tsx` and `TrackingPage.tsx`, showing assigned hub badges on batch cards, enabling manual hub selection in Create Batch modal, rendering active warehouse pins on live tracking maps, and filtering live vehicle markers by hub.

---

## Tasks Completed

| Task | Description | Status | Commits |
|------|-------------|--------|---------|
| 1 | Frontend Hub types, API client service, and custom Leaflet warehouse SVG marker icon | Complete | `13ac253` |
| 2 | Dedicated Hubs management tab in FleetsPage with CRUD modals and vehicle home hub selector | Complete | `da42447` |
| 3 | Hub filter dropdown on BatchesPage and TrackingPage with live map warehouse pin rendering | Complete | `b97bb05` |

---

## Verification Results

### Unit Tests
- `client/src/components/maps/__tests__/statusPinIcons.test.tsx`: 11 passed (11)
  - Validates `createWarehouseHubIcon` Leaflet DivIcon dimensions (44x44), anchor (22, 22), SVG glyph structure, gold canonical badge, dark/light contrast classes, and XSS attribute sanitization.
- `client/src/pages/admin/__tests__/FleetsPageHubs.test.tsx`: 5 passed (5)
  - Validates tab switching between Vehicles and Hubs & Depots.
  - Validates rendering of seeded Bhubaneswar logistics hubs with primary badges.
  - Validates opening Register Hub modal and submitting validated form payload.
  - Validates selecting and updating Home Hub in Vehicle edit modal.
  - Validates cascade protection dialog when attempting hub deletion.
- Full client unit test suite (`npm --prefix client run test:unit`): 23 test files passed, 127 tests passed.

### Typecheck
- Full client TypeScript compilation (`npm --prefix client test` -> `tsc --noEmit`): 0 errors, passed cleanly.

---

## Known Stubs
None. All components are wired directly to `HubsApi`, `FleetApi`, and live state stores.

## Threat Flags
None. All inputs are bounded and sanitized with `escapeHtml` (T-28-11), role authorization checks remain enforced on all administrative endpoints (T-28-09), and numeric coordinates are validated (T-28-10).

---

## Self-Check: PASSED
- [x] `client/src/types/hub.ts` created and re-exported
- [x] `client/src/api/client.ts` exports `HubsApi`
- [x] `createWarehouseHubIcon` implemented in `markerIcons.ts` and tested
- [x] `InteractiveMap.tsx` renders warehouse markers with popups
- [x] `FleetsPage.tsx` has Hubs tab, CRUD modals, and vehicle home hub assignment
- [x] `BatchesPage.tsx` has Hub filter dropdown and assigned hub badges
- [x] `TrackingPage.tsx` has Hub filter dropdown, passes hubs to map, and filters vehicles
- [x] Commits recorded: `13ac253`, `da42447`, `b97bb05`
