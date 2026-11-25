---
phase: 30-production-performance-core-web-vitals-accessibility-agentic-standards
plan: "01"
subsystem: performance-core-web-vitals
tags:
  - performance
  - core-web-vitals
  - cls
  - speed-index
  - skeleton
  - font-preload
  - gpu-compositing
requires: []
provides:
  - Stationary reserved skeleton in CurrentRouteCard matching 290px min-height
  - Reserved aspect-ratio container and min-height on Leaflet map in RoutePlannerPage
  - Non-blocking asynchronous font loading in index.html with display=swap and media print-swap
  - GPU-composited CSS transitions on interactive cards and buttons via transform: translateZ(0) and pseudo-element opacity
affects:
  - client/src/components/optimization/CurrentRouteCard.tsx
  - client/src/pages/admin/RoutePlannerPage.tsx
  - client/index.html
  - client/src/index.css
tech-stack:
  added: []
  patterns:
    - Stationary layout skeleton reservation (CLS < 0.05)
    - Leaflet canvas aspect-ratio reservation (D-02)
    - Asynchronous stylesheet preload with media=print to media=all swap (D-05)
    - Hardware-accelerated GPU layer promotion via transform: translateZ(0) (D-06)
    - Pseudo-element opacity transition replacing box-shadow/border-color reflows
key-files:
  created:
    - client/src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx
    - client/src/__tests__/performanceAssets.test.ts
  modified:
    - client/src/components/optimization/CurrentRouteCard.tsx
    - client/src/pages/admin/RoutePlannerPage.tsx
    - client/index.html
    - client/src/index.css
decisions:
  - "D-01: Replace collapsing null return in CurrentRouteCard with a stationary 290px skeleton shell matching the exact card box model."
  - "D-02: Enforce responsive min-height and aspect-video reservation on the Leaflet map container to eliminate dynamic tile and polyline hydration reflows."
  - "D-05: Preload Google Fonts asynchronously with rel=preload, as=style, display=swap, and media=print swap to eliminate 310ms render-blocking stylesheet delay."
  - "D-06: Promote high-frequency interactive cards (.panel-card, .glass-surface, .spring-press) to dedicated GPU compositor layers and animate hover highlights via pseudo-element opacity."
status: complete
requirements:
  - PERF-CLS-01
  - PERF-COMPOSIT-03
metrics:
  duration: 15m
  completed_date: "2026-11-25"
actuals:
  tokens: 4225
  tasks: 2
  commits: 2
commits: 2
plan_head_before: d92017d0dc58a1e7665b761bc52fb1b02fb5a60f
plan_head_after: b496a4edb864a787327ef35bf9487140f2f45ea3
---

# Phase 30 Plan 01: Route Optimizer Layout Geometry & Non-Blocking Assets Summary

Eliminated Cumulative Layout Shift (target CLS < 0.05) across the Route Optimizer workspace through stationary skeleton reservation, responsive aspect-ratio map containers, non-blocking asynchronous Google Fonts preloading, and GPU-composited CSS transitions.

## Performance & Verification

- **Automated Tests Passing:**
  - `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` (3/3 tests passed)
  - `npm --prefix client run test:unit -- src/__tests__/performanceAssets.test.ts` (5/5 tests passed)
  - Full client test suite: `npm --prefix client run test:unit` (27 test files, 155 tests passed, 0 failures)
- **Zero New Dependencies Added:** Leveraged native Tailwind CSS utilities, HTML5 `<link rel="preload">`, and hardware-accelerated CSS properties.

## Key Changes Implemented

### 1. Stationary Reserved Skeleton Wireframe (PERF-CLS-01 / D-01)
- Refactored `client/src/components/optimization/CurrentRouteCard.tsx` to replace `if (!baseline && !isLoading) return null;` with a stationary `<section aria-label="Current Route Loading Placeholder">`.
- Reserved exact `min-h-[290px]` height, pulsed obsidian wireframe colors, 4-cell metric placeholder grid (`h-20`), title bar, and action bar placeholders.
- Prevents DOM collapse during initial mount and baseline evaluation, eliminating the 380px layout jump when route calculations resolve.

### 2. Map Container Aspect Ratio & Workspace Shell Reservation (PERF-CLS-01 / D-02)
- Refactored `client/src/pages/admin/RoutePlannerPage.tsx` main grid wrapper to enforce `min-h-[640px]`.
- Enforced responsive container geometry on the Leaflet map wrapper (`h-[380px] sm:h-[460px] lg:h-[520px] min-h-[380px] aspect-video`), preventing layout shift during dynamic tile hydration and polyline canvas rendering.
- Added a reserved min-height skeleton slot (`min-h-[50px]`) for live dispatched routes during initial data hydration.

### 3. Asynchronous Non-Blocking Google Font Loading (PERF-COMPOSIT-03 / D-05)
- Updated `client/index.html` to eliminate 310ms render-blocking stylesheet latency.
- Implemented `<link rel="preload" as="style">` with `display=swap` and `<link rel="stylesheet" media="print" onload="this.media='all'">` alongside `<noscript>` fallback.
- Added preconnect hints for `https://fonts.googleapis.com` and `https://fonts.gstatic.com` with `crossorigin`.

### 4. GPU-Composited Transitions & Layer Promotion (PERF-COMPOSIT-03 / D-06)
- Audited `client/src/index.css` and replaced non-composited `border-color` and `box-shadow` transitions on `.panel-card`, `.glass-surface`, `.glass-floating`, `.spring-press`, and `.card-hover-lift`.
- Promoted interactive cards to dedicated GPU compositor layers using `transform: translateZ(0)` and `will-change: transform`.
- Moved hover highlight glow and borders to pseudo-elements (`::after`) animated via `transition: opacity 0.15s ease`, preventing forced reflows and paint thrashing.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None - all changes strictly confined to styling, HTML asset hints, and client-side skeleton rendering.

## Self-Check: PASSED

1. Created files exist:
   - `client/src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` (FOUND)
   - `client/src/__tests__/performanceAssets.test.ts` (FOUND)
2. Commits exist:
   - `40d22f7`: feat(30-01): implement reserved skeleton geometry and map aspect ratio reservation (FOUND)
   - `b496a4e`: perf(30-01): eliminate render-blocking fonts and refactor transitions to GPU composited properties (FOUND)
