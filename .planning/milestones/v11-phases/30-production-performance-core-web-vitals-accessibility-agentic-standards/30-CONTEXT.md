# Phase 30: Production Performance, Core Web Vitals (CLS & Speed Index), Accessibility & Agentic Standards - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 30 delivers a comprehensive performance, Core Web Vitals, accessibility, and agentic standards overhaul targeting the production Route Optimizer (`/admin/optimizer`) and core frontend experience. It directly addresses the Google Lighthouse audit findings (Performance 65, CLS 0.450, Speed Index 4,454ms, Accessibility 95, Agentic Browsing 1/4) by stabilizing layout rendering, eliminating critical-path network waterfalls, optimizing font loading and CSS transitions, enforcing WCAG AA contrast compliance, and publishing valid agentic discovery metadata.

</domain>

<decisions>
## Implementation Decisions

### Core Web Vitals & Cumulative Layout Shift (CLS)
- **D-01: Reserved Skeleton Layout**: Implement reserved aspect-ratio placeholders and explicit CSS min-height constraints across `RoutePlannerPage.tsx` (`grid grid-cols-1 lg:grid-cols-12` and child components `CurrentRouteCard`, `RouteMap`, stop tables). When dispatch batches or routes load asynchronously, the layout shell remains structurally stationary, completely eliminating content jumping (CLS target < 0.05). — **Reversibility:** reversible
- **D-02: Map Container Aspect Ratio Reservation**: Enforce fixed aspect ratio and min-height on Leaflet map mounting targets so that dynamic map tiles and polyline canvas layers do not cause secondary layout shifts during deferred hydration. — **Reversibility:** reversible

### Network Waterfall, Latency & API Deduplication
- **D-03: Global In-Flight Request Deduplication**: In `client/src/api/client.ts`, implement an in-flight request deduplication map. Identical concurrent GET requests (such as `api/v1/routes?batchId=...` fired repeatedly by route planner hooks on initial mount) are collapsed into a single network call sharing the same promise. — **Reversibility:** reversible
- **D-04: Socket.io Fallback Polling Storm Mitigation**: Configure Socket.io client transports with `['websocket', 'polling']` priority and exponential backoff jitter on reconnect, eliminating excessive fallback polling loops (`/socket.io/?EIO=4&transport=polling`) during Render backend cold starts. — **Reversibility:** reversible

### Speed Index, Critical Path & Rendering Performance
- **D-05: Asynchronous Font Loading & Metrics**: In `client/index.html`, add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, load Google Fonts with `display=swap`, and include fallback font metric overrides for Inter and JetBrains Mono to eliminate render-blocking CSS (310ms savings) and avoid FOUT/FOIT. — **Reversibility:** reversible
- **D-06: GPU-Composited Transitions**: Audit and replace CSS transitions animating layout/paint properties (`border-color`, `box-shadow`, `all`) with hardware-accelerated composited properties (`transform`, `opacity`, `filter`) across buttons, status tags, and route cards, eliminating forced reflows and non-composited animation warnings. — **Reversibility:** reversible

### Accessibility (A11y) & Visual Hierarchy
- **D-07: WCAG AA Color Contrast Refinement**: Upgrade low-contrast dark mode badges (e.g. amber `DEMO` badge, muted stop tags, `text-on-surface`, `text-primary`) to high-contrast tokens meeting the WCAG AA minimum 4.5:1 ratio for normal text on dark slate/obsidian backgrounds. — **Reversibility:** reversible
- **D-08: Semantic Heading Hierarchy Order**: Refactor heading structures across the optimizer view to eliminate heading level skips (ensuring proper sequential `<h1>` -> `<h2>` -> `<h3>` nesting without orphan `<h3>` tags in route summary cards). — **Reversibility:** reversible

### Agentic Web Standards & Discovery
- **D-09: Standardized llms.txt Format**: Update `client/public/llms.txt` to strictly follow agentic specifications with a required top-level `# SmartRoute: Last-Mile Delivery Optimization Platform` H1 header, comprehensive description, and markdown structured index links to API documentation and platform capabilities. — **Reversibility:** reversible
- **D-10: Dedicated ai-catalog.json Static Manifest**: Create `client/public/ai-catalog.json` with valid JSON metadata declaring tool endpoints, OpenAPI schemas, and platform capabilities, and ensure it is served with `Content-Type: application/json` so agent scrapers receive structured JSON rather than SPA fallback HTML. — **Reversibility:** reversible

### the agent's Discretion
- Exact skeleton shimmer opacity and animation timing matching existing Tailwind dark theme.
- In-flight cache expiry window (recommended: 3000ms TTL for GET request deduplication).
- Micro-optimizations for Vite asset bundling / CSS chunk splitting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Production Diagnostics & Audit
- Google Lighthouse Desktop Audit (Chrome 157, Vercel Production Deployment) — [Run Summary in user prompt]
- Web.dev Core Web Vitals Guidance (CLS, Speed Index, FCP): `https://web.dev/cls/`

### Agentic Discovery Standards
- `https://llmstxt.org` specification for `llms.txt` and `llms-full.txt`
- Agent Marketplace discovery manifest schema for `ai-catalog.json`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/common/LoadingSpinner.tsx`: Base loading spinner component.
- `client/src/pages/admin/RoutePlannerPage.tsx`: Primary route planning orchestrator containing batch selector, map, and baseline comparisons.
- `client/src/hooks/useRoutePlanner.ts`: State management and API fetching hook for routes, batches, and fleet assets.
- `client/src/api/client.ts`: Central Axios / Fetch API client with JWT interceptor.
- `client/public/llms.txt`: Existing raw llms description file.

### Established Patterns
- Obsidian dark theme design system (`bg-slate-900`, `bg-slate-950`, `border-slate-800`, `emerald-500`, `indigo-500`).
- Strict TypeScript typings on all client hooks, components, and API responses.
- 25 passing client test suites (Vitest) and 32 passing server test suites (Jest).

### Integration Points
- `client/index.html`: Font preconnect, font-display swap, and critical stylesheet inlining.
- `client/src/api/client.ts`: Deduplication interceptor layer.
- `client/src/pages/admin/RoutePlannerPage.tsx`: Reserved grid skeletons.
- `client/public/ai-catalog.json` & `client/public/llms.txt`: Static agentic discovery endpoints.

</code_context>

<specifics>
## Specific Ideas
- Target Lighthouse performance score >= 90 (up from 65).
- Target CLS <= 0.05 (down from 0.450).
- Target Speed Index <= 2.0s (down from 4.454s).
- Target Accessibility score = 100 (up from 95).
- Target Agentic Browsing score = 4/4 (up from 1/4).

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed tightly within the Lighthouse audit scope.

</deferred>

---

*Phase: 30-production-performance-core-web-vitals-accessibility-agentic-standards*
*Context gathered: 2026-11-25*
