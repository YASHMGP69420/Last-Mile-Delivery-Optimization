---
phase: 30-production-performance-core-web-vitals-accessibility-agentic-standards
plan: "02"
subsystem: performance-a11y-agentic
tags:
  - performance
  - api-deduplication
  - socket-io
  - accessibility
  - wcag-aa
  - headings
  - agentic-discovery
  - llms-txt
  - ai-catalog
requires:
  - 30-01
provides:
  - Global Axios GET query deduplication with 3000ms TTL and mutation cache invalidation
  - Socket.IO client prioritizing WebSocket with 0.5 exponential backoff jitter
  - WCAG AA compliant Demo badge tokens (8.1:1 light, 11.2:1 dark)
  - Strict sequential h1 -> h2 -> h3 heading hierarchy across Route Optimizer
  - Standardized agentic llms.txt starting with required H1
  - Machine-readable ai-catalog.json discovery manifest with bearerAuth security
  - Vercel SPA rewrite exemptions for agentic discovery files with dedicated Content-Type headers
affects:
  - client/src/api/client.ts
  - client/src/utils/socketClient.ts
  - client/src/components/layout/AdminHeader.tsx
  - client/src/components/optimization/CurrentRouteCard.tsx
  - client/src/pages/admin/RoutePlannerPage.tsx
  - client/public/llms.txt
  - client/public/ai-catalog.json
  - client/vercel.json
  - vercel.json
tech-stack:
  added: []
  patterns:
    - Global in-flight Promise collapsing on identical concurrent GET requests
    - Short-term TTL response caching (3000ms) with automatic mutation purges
    - WebSocket-first transport priority with 50% reconnect jitter
    - WCAG AA high-contrast tokens exceeding 4.5:1 ratio
    - Strict semantic heading order (single h1 -> h2 -> h3)
    - Agentic discovery standards (llms.txt, ai-catalog.json)
key-files:
  created:
    - client/src/api/__tests__/clientDeduplication.test.ts
    - client/src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx
    - client/src/__tests__/agenticSpecs.test.ts
    - client/public/llms.txt
    - client/public/ai-catalog.json
  modified:
    - client/src/api/client.ts
    - client/src/utils/socketClient.ts
    - client/src/components/layout/AdminHeader.tsx
    - client/src/components/optimization/CurrentRouteCard.tsx
    - client/src/pages/admin/RoutePlannerPage.tsx
    - client/vercel.json
    - vercel.json
decisions:
  - "D-03: Collapse concurrent identical GET requests into a single in-flight Promise and cache non-expired responses with 3000ms TTL, purged immediately on state mutations."
  - "D-04: Prioritize WebSocket transport over polling in createRealtimeSocket and inject 0.5 randomizationFactor jitter to prevent connection storms during Render backend cold starts."
  - "D-07: Upgrade Demo badge styling to high-contrast tokens (bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700) exceeding WCAG AA 4.5:1."
  - "D-08: Enforce sequential h1 -> h2 -> h3 heading hierarchy across the Route Optimizer view without skipped levels."
  - "D-09: Publish standardized llms.txt starting with required H1 format and structured markdown links to capabilities and APIs."
  - "D-10: Deploy machine-readable ai-catalog.json manifest with bearerAuth security and configure Vercel SPA rewrite exemptions with dedicated JSON/text Content-Type headers."
status: complete
requirements:
  - PERF-WATERFALL-02
  - A11Y-CONTRAST-04
  - AGENTIC-SPEC-05
metrics:
  duration: 18m
  completed_date: "2026-11-25"
actuals:
  tokens: 9139
  tasks: 3
  commits: 3
commits: 3
plan_head_before: f0be74088c2fe02f3c0b4cea0b1d22470cbdfde1
plan_head_after: b02bccc890b1baaee6a12a14aa71cb26876dd991
---

# Phase 30 Plan 02: Network Waterfall Elimination, WCAG AA Accessibility & Agentic Standards Summary

Eliminated redundant API query waterfalls on initial mount via Axios in-flight deduplication, tuned Socket.IO transport priority with exponential backoff jitter, enforced WCAG AA contrast and semantic heading hierarchy, and published machine-readable agentic discovery specifications.

## Performance & Verification

- **Automated Tests Passing:**
  - `npm --prefix client run test:unit -- src/api/__tests__/clientDeduplication.test.ts` (7/7 tests passed)
  - `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx` (4/4 tests passed)
  - `npm --prefix client run test:unit -- src/__tests__/agenticSpecs.test.ts` (4/4 tests passed)
  - Full client test suite: `npm --prefix client run test:unit` (30 test files, 170 tests passed, 0 failures)
- **Zero New Dependencies Added:** Leveraged native Axios adapter hooking, Socket.IO options, and static JSON/markdown discovery specs.

## Key Changes Implemented

### 1. Global In-Flight API Query Deduplication & Caching (PERF-WATERFALL-02 / D-03)
- Implemented an in-flight request deduplication map and 3000ms TTL response cache wrapping `apiClient.defaults.adapter` in `client/src/api/client.ts`.
- Concurrent identical GET requests are collapsed into a single in-flight Promise, resolving simultaneously when the single network request completes.
- State-mutating operations (`post`, `put`, `delete`, `patch`) and session timeouts/logouts immediately purge both in-flight and cached registries, preventing stale state or cross-user leakage (mitigating T-30-03).
- Exported `clearInFlightCache()` for test isolation and cache busting.

### 2. Socket.IO Transport Priority & Cold-Start Jitter (PERF-WATERFALL-02 / D-04)
- Updated `createRealtimeSocket` in `client/src/utils/socketClient.ts` to prioritize `['websocket', 'polling']` over polling-first handshakes.
- Injected `randomizationFactor: 0.5` alongside `reconnectionDelay: 1200` and `reconnectionDelayMax: 5000` to prevent thundering-herd reconnect storms when the Render backend wakes from cold sleep (mitigating T-30-04).

### 3. WCAG AA Color Contrast Refinements (A11Y-CONTRAST-04 / D-07)
- Upgraded the workspace `Demo` badge in `client/src/components/layout/AdminHeader.tsx` to high-contrast tokens:
  `bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700`.
- Meets and exceeds WCAG AA 4.5:1 minimum ratio (achieves 8.1:1 in light mode and 11.2:1 in dark mode).

### 4. Strict Semantic Heading Hierarchy (A11Y-CONTRAST-04 / D-08)
- Refactored `AdminHeader.tsx` so the workspace branding renders as the document's single top-level `<h1>` tag (`SmartRoute`) and the page title renders as an `<h2>`.
- Promoted `CurrentRouteCard.tsx` primary card section header from `<h3>` to `<h2>` and subsections ("Performance Comparison...", "Auto-Assigned Fleet") from `<h4>` to `<h3>`.
- Promoted "Geospatial Route Map" and "Dispatched Routes" panel titles from `<span>` to `<h2>` in `client/src/pages/admin/RoutePlannerPage.tsx`.
- Guaranteed sequential `h1` -> `h2` -> `h3` hierarchy without skipped levels.

### 5. Agentic Web Standards & Discovery Manifests (AGENTIC-SPEC-05 / D-09, D-10)
- Created `client/public/llms.txt` following standard specifications starting with `# SmartRoute: Last-Mile Delivery Optimization Platform`, indexing core capabilities, API routes, and agent discovery links.
- Created `client/public/ai-catalog.json` defining a valid machine-readable discovery manifest with OpenAPI-style endpoints and declared `bearerAuth` security schemes (mitigating T-30-05 by exposing only documented public operational endpoints).
- Updated SPA rewrite rules in `vercel.json` and `client/vercel.json` to exempt `llms.txt`, `ai-catalog.json`, `robots.txt`, and `sitemap.xml`, serving dedicated `Content-Type: application/json` and `text/plain; charset=utf-8` headers with 1-hour caching.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None - all mitigations in T-30-03, T-30-04, and T-30-05 verified.

## Self-Check: PASSED
- [x] client/src/api/__tests__/clientDeduplication.test.ts exists and passes
- [x] client/src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx exists and passes
- [x] client/src/__tests__/agenticSpecs.test.ts exists and passes
- [x] client/public/llms.txt exists and matches schema
- [x] client/public/ai-catalog.json exists and is valid JSON
- [x] commits 7ed6309, b580d30, b02bccc verified in git history
