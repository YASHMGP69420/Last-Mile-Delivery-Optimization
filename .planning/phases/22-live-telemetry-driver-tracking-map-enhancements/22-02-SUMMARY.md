---
phase: 22-live-telemetry-driver-tracking-map-enhancements
plan: 02
subsystem: maps-telemetry
tags:
  - leaflet
  - map-legend
  - route-segmentation
  - status-pins
  - telemetry
status: complete
requires:
  - 22-01
provides:
  - TELEM-MAP-03
  - TELEM-MAP-04
affects:
  - client/src/components/maps/InteractiveMap.tsx
  - client/src/components/maps/markerIcons.ts
  - client/src/components/maps/MapLegend.tsx
  - client/src/pages/admin/TrackingPage.tsx
tech-stack:
  added: []
  patterns:
    - Status-differentiated divIcon markers
    - Dual-segment route polyline rendering (traversed dashed vs remaining solid)
    - Glassmorphic overlay category checklist filter
key-files:
  created:
    - client/src/components/maps/MapLegend.tsx
    - client/src/components/maps/__tests__/statusPinIcons.test.tsx
    - client/src/components/maps/__tests__/mapLegendFilters.test.tsx
  modified:
    - client/src/components/maps/markerIcons.ts
    - client/src/components/maps/InteractiveMap.tsx
    - client/src/pages/admin/TrackingPage.tsx
decisions:
  - "Completed stops render as small flat dimmed grey dots (20x20px, opacity 0.75) with checkmark glyph to declutter high-density active delivery routes (D-07)"
  - "Failed and Cancelled stops render as bold red pins (34x44px) with diagonal slash-through banner (D-08)"
  - "Next immediate active stop pulses in bright indigo (#6366f1) while upcoming pending stops remain vibrant emerald (#10b981) (D-09)"
  - "Route geometry splits into traversed (muted dashed line #64748b) and remaining (solid vibrant emerald #10b981) segments anchored from live driver telemetry (D-10)"
  - "MapLegend renders in bottom-left corner with glassmorphic styling and toggles marker visibility by category without losing logistics hub anchor (D-11, D-12)"
metrics:
  duration: 12m
  completed_date: "2026-11-20"
actuals:
  tokens: 12500
  tasks: 3
  commits: 3
  plan_head_before: aa4be56a1a1c4b435dac176b34f8950503d680f7
  plan_head_after: 90b0490be93a61cbda0daeeadc1e6096cf5f58d4
---

# Phase 22 Plan 02: Status-Differentiated Stop Pins, Dual-Color Route Segmentation, and Collapsible Map Legend Summary

**One-liner:** Delivered status-differentiated stop pins (dimmed completed dots, red alert slash pins, pulsing indigo next active stop), dual-polyline route segmentation (traversed dashed vs remaining solid emerald), and a collapsible glassmorphic map legend with dynamic marker visibility checkboxes.

---

## What Was Delivered

1. **Status-Differentiated Delivery Stop Pins (`markerIcons.ts`, `statusPinIcons.test.tsx`):**
   - Implemented `createStatusStopIcon` producing custom Leaflet `L.divIcon` markers based on delivery stop status:
     - **Completed (`COMPLETED`)**: Small flat dimmed grey dot (`#64748b`, 20x20px, opacity 0.75) with checkmark SVG glyph, reducing visual clutter on dense routes.
     - **Cancelled or Failed (`CANCELLED`, `FAILED`)**: Bold red pin (`#ef4444`, 34x44px) with drop-shadow and circular alert badge displaying diagonal slash-through lines.
     - **Next Active Stop (`isNextActive`)**: Bright indigo pin (`#6366f1`, 38x48px) with outer radar pulse ring (`animation: ping 2s cubic-bezier(0,0,0.2,1) infinite`), indigo inner badge (`#4f46e5`), and sequence number.
     - **Pending Stops**: Standard vibrant emerald pin (`#10b981`, 34x44px) with priority accent rings (cyan for cold chain, orange for urgent) and sequence numbers.
     - **Depot Stops**: Amber diamond logistics hub pin (`#d97706`).
   - Strict XSS escaping of all sequence numbers, customer references, and priority tags via `escapeHtml` (T-22-03).
   - Full automated test suite in `statusPinIcons.test.tsx` covering all status permutations and injection safety.

2. **Collapsible Glassmorphic Map Legend (`MapLegend.tsx`, `mapLegendFilters.test.tsx`):**
   - Built floating glassmorphic overlay component anchored in the bottom-left corner of the map canvas (`z-[1000]`).
   - Header button with collapse/expand toggle featuring `Layers` icon and chevron indicators.
   - 5 entity filter checkboxes with matching color badges:
     - `Live Drivers`: Blue navigation arrowhead.
     - `Next Active Stop`: Indigo circle with white border.
     - `Pending Deliveries`: Emerald circle with white border.
     - `Completed (Delivered)`: Slate grey circle with white border.
     - `Cancelled / Failed`: Rose red circle with white border.
   - Visual route polyline indicators:
     - Traversed Route: Dashed grey line indicator (`border-dashed border-slate-400`).
     - Remaining Route: Solid emerald line indicator (`border-solid border-emerald-500`).
   - Full automated test suite in `mapLegendFilters.test.tsx` asserting component rendering, collapse toggle, and filter callbacks.

3. **Dual-Segment Route Lines & Dynamic Marker Visibility Integration (`InteractiveMap.tsx`, `TrackingPage.tsx`):**
   - **Route Traversal Segmentation**: `TrackingPage` computes `traversedPath` (depot -> completed stops -> driver coordinates) and `remainingPath` (driver coordinates -> next stop -> pending stops) for the selected vehicle's active route.
   - **Dual Polyline Rendering**: `InteractiveMap` renders `traversedPath` as a muted dashed line (`#64748b` in dark mode / `#94a3b8` in light mode, `dashArray="6, 8"`, `weight={3}`, `opacity={0.8}`) and `remainingPath` as a solid emerald line (`#10B981` in dark mode / `#0B6E4F` in light mode, `weight={4}`, `opacity={0.95}`).
   - **Dynamic Marker Visibility Filtering**: Dispatches filter toggles from `MapLegend` directly into `InteractiveMap`'s marker render pipeline, showing or hiding markers by category in real time while preserving logistics hub depot pins.
   - **Upgraded Stop Markers**: Replaced legacy static stop icons with `createStatusStopIcon` across the map canvas.

---

## Verification & Test Results

- Status pin unit tests: `npm --prefix client run test:unit -- src/components/maps/__tests__/statusPinIcons.test.tsx` (7/7 passed)
- Map legend unit tests: `npm --prefix client run test:unit -- src/components/maps/__tests__/mapLegendFilters.test.tsx` (4/4 passed)
- Full client unit test suite: `npm --prefix client run test:unit` (10/10 test files, 76/76 tests passed)
- Production build & TypeScript check: `npm --prefix client run build` (passed cleanly, 0 errors)

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Self-Check: PASSED

- [x] `client/src/components/maps/MapLegend.tsx` exists on disk.
- [x] `client/src/components/maps/__tests__/statusPinIcons.test.tsx` exists on disk.
- [x] `client/src/components/maps/__tests__/mapLegendFilters.test.tsx` exists on disk.
- [x] Commits `73ee5fe`, `714e758`, and `90b0490` verified in git history.
