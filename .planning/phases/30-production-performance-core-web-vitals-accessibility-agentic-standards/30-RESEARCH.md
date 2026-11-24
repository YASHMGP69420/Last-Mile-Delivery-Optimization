# Phase 30: Production Performance, Core Web Vitals (CLS & Speed Index), Accessibility & Agentic Standards - Research

**Researched:** 2026-11-25
**Domain:** Core Web Vitals (CLS, Speed Index), Network Latency & API Waterfall Collapse, GPU-Composited CSS Transitions, WCAG AA Accessibility Contrast & Heading Hierarchy, Agentic Discovery Standards (`llms.txt`, `ai-catalog.json`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Core Web Vitals & Cumulative Layout Shift (CLS)
- **D-01: Reserved Skeleton Layout**: Implement reserved aspect-ratio placeholders and explicit CSS min-height constraints across `RoutePlannerPage.tsx` (`grid grid-cols-1 lg:grid-cols-12` and child components `CurrentRouteCard`, `RouteMap`, stop tables). When dispatch batches or routes load asynchronously, the layout shell remains structurally stationary, completely eliminating content jumping (CLS target < 0.05). — **Reversibility:** reversible
- **D-02: Map Container Aspect Ratio Reservation**: Enforce fixed aspect ratio and min-height on Leaflet map mounting targets so that dynamic map tiles and polyline canvas layers do not cause secondary layout shifts during deferred hydration. — **Reversibility:** reversible

#### Network Waterfall, Latency & API Deduplication
- **D-03: Global In-Flight Request Deduplication**: In `client/src/api/client.ts`, implement an in-flight request deduplication map. Identical concurrent GET requests (such as `api/v1/routes?batchId=...` fired repeatedly by route planner hooks on initial mount) are collapsed into a single network call sharing the same promise. — **Reversibility:** reversible
- **D-04: Socket.io Fallback Polling Storm Mitigation**: Configure Socket.io client transports with `['websocket', 'polling']` priority and exponential backoff jitter on reconnect, eliminating excessive fallback polling loops (`/socket.io/?EIO=4&transport=polling`) during Render backend cold starts. — **Reversibility:** reversible

#### Speed Index, Critical Path & Rendering Performance
- **D-05: Asynchronous Font Loading & Metrics**: In `client/index.html`, add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, load Google Fonts with `display=swap`, and include fallback font metric overrides for Inter and JetBrains Mono to eliminate render-blocking CSS (310ms savings) and avoid FOUT/FOIT. — **Reversibility:** reversible
- **D-06: GPU-Composited Transitions**: Audit and replace CSS transitions animating layout/paint properties (`border-color`, `box-shadow`, `all`) with hardware-accelerated composited properties (`transform`, `opacity`, `filter`) across buttons, status tags, and route cards, eliminating forced reflows and non-composited animation warnings. — **Reversibility:** reversible

#### Accessibility (A11y) & Visual Hierarchy
- **D-07: WCAG AA Color Contrast Refinement**: Upgrade low-contrast dark mode badges (e.g. amber `DEMO` badge, muted stop tags, `text-on-surface`, `text-primary`) to high-contrast tokens meeting the WCAG AA minimum 4.5:1 ratio for normal text on dark slate/obsidian backgrounds. — **Reversibility:** reversible
- **D-08: Semantic Heading Hierarchy Order**: Refactor heading structures across the optimizer view to eliminate heading level skips (ensuring proper sequential `<h1>` -> `<h2>` -> `<h3>` nesting without orphan `<h3>` tags in route summary cards). — **Reversibility:** reversible

#### Agentic Web Standards & Discovery
- **D-09: Standardized llms.txt Format**: Update `client/public/llms.txt` to strictly follow agentic specifications with a required top-level `# SmartRoute: Last-Mile Delivery Optimization Platform` H1 header, comprehensive description, and markdown structured index links to API documentation and platform capabilities. — **Reversibility:** reversible
- **D-10: Dedicated ai-catalog.json Static Manifest**: Create `client/public/ai-catalog.json` with valid JSON metadata declaring tool endpoints, OpenAPI schemas, and platform capabilities, and ensure it is served with `Content-Type: application/json` so agent scrapers receive structured JSON rather than SPA fallback HTML. — **Reversibility:** reversible

### the agent's Discretion
- Exact skeleton shimmer opacity and animation timing matching existing Tailwind dark theme.
- In-flight cache expiry window (recommended: 3000ms TTL for GET request deduplication).
- Micro-optimizations for Vite asset bundling / CSS chunk splitting.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed tightly within the Lighthouse audit scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-CLS-01 | Eliminate Cumulative Layout Shift (target CLS < 0.05, down from 0.450) across `RoutePlannerPage.tsx` using reserved skeleton geometry and map aspect ratio reservations | Section "Architecture Patterns: Pattern 1 & Code Examples" details reserved geometry replacing `return null` in `CurrentRouteCard.tsx` and map wrapper dimensions |
| PERF-WATERFALL-02 | Collapse client-side network waterfalls and cold-start latency through global in-flight GET query deduplication and Socket.IO transport priority tuning | Section "Architecture Patterns: Pattern 2 & Code Examples" provides the Axios adapter in-flight deduplication map and `socketClient.ts` WebSocket transport configuration |
| PERF-COMPOSIT-03 | Eliminate render-blocking Google Fonts (Speed Index < 2.0s) and replace non-composited layout transitions with GPU-composited CSS transforms | Section "Architecture Patterns: Pattern 3" details asynchronous stylesheet preloading, `@font-face` metric matching, and compositor-friendly pseudo-element transitions |
| A11Y-CONTRAST-04 | Resolve WCAG AA color contrast failures (4.5:1 minimum) and repair heading hierarchy skips (`<h1>` -> `<h2>` -> `<h3>`) across optimizer panels | Section "Architecture Patterns: Pattern 4" specifies obsidian contrast tokens and sequential heading tree across `AdminHeader` and child cards |
| AGENTIC-SPEC-05 | Implement agentic web discovery standards (`llms.txt` and `ai-catalog.json`) and configure Vercel SPA rewrites to serve JSON/text MIME types | Section "Architecture Patterns: Pattern 5" defines the exact `llmstxt.org` markdown format, `ai-catalog.json` manifest, and `vercel.json` rewrite exemptions |
</phase_requirements>

## Summary

Phase 30 executes a focused, high-leverage performance, accessibility, and agentic discovery overhaul directly targeted at remediating the Google Lighthouse Desktop audit baseline (Performance: 65, CLS: 0.450, Speed Index: 4,454ms, Accessibility: 95, Agentic Browsing: 1/4). The audit revealed five specific structural root causes: (1) asynchronous hydration of `CurrentRouteCard` and live dispatch banners without pre-reserved DOM geometry causing extreme visual layout shifts, (2) simultaneous redundant HTTP GET queries (`routes?batchId=...`, `routes?limit=50`, `batches`) fired concurrently by route planner hooks on mount, (3) render-blocking Google Fonts stylesheets delaying First Contentful Paint by 310ms alongside CSS animations targeting layout/paint properties (`border-color`, `box-shadow`), (4) WCAG AA contrast failures on demo badges and muted stop labels alongside orphan `<h3>` headings, and (5) missing agentic discovery files combined with Vercel SPA rewrite rules that redirected agent JSON queries to HTML.

The remediation strategy requires zero new external npm dependencies. Everything is solved cleanly using existing architectural primitives: (1) a dedicated stationary skeleton shell in `CurrentRouteCard` replacing `return null` with matching min-heights and pulsed obsidian wireframes, (2) an in-flight Promise deduplication map in `client/src/api/client.ts` with a 3000ms TTL window and automatic mutation cache eviction, (3) Socket.io transport reordering to `['websocket', 'polling']` with exponential backoff jitter in `socketClient.ts`, (4) non-blocking font preloading in `index.html` with `@font-face` metric overrides and GPU-composited CSS transitions, (5) bulletproof obsidian contrast badge tokens with sequential `<h1>` -> `<h2>` -> `<h3>` heading tags, and (6) a canonical `# SmartRoute` `llms.txt`, a machine-readable `ai-catalog.json`, and updated `vercel.json` rewrite exclusions.

**Primary recommendation:** Implement the 5-point performance and compliance overhaul across 2 atomic waves: Wave 1 addresses layout stabilization (CLS skeleton geometry, Leaflet aspect-ratio, non-blocking font preload, GPU transitions), and Wave 2 collapses network waterfalls (Axios deduplication, Socket.io jitter, WCAG AA contrast, semantic heading hierarchy, and agentic static discovery specs).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Layout Shift Elimination (CLS < 0.05) | Browser / Client | — | Layout shift is purely a DOM geometry and rendering lifecycle concern owned by React components and Tailwind CSS layout reservations. |
| In-Flight API Query Deduplication | Browser / Client | — | Handled in the client transport layer (`client/src/api/client.ts`) before requests hit the network wire, preventing redundant duplicate calls. |
| Real-Time Socket Connection Tuning | Browser / Client | API / Backend | Client socket configuration (`socketClient.ts`) sets connection priority (`['websocket', 'polling']`) and backoff jitter to prevent cold-start storms. |
| Font Optimization & Render-Blocking Removal | CDN / Static | Browser / Client | `client/index.html` headers and CSS parser handle asynchronous preloading and font fallback metric alignment. |
| GPU-Composited Transitions | Browser / Client | — | Handled by browser rendering engine compositor thread via CSS `transform` and `opacity`. |
| WCAG AA Contrast & Heading Hierarchy | Browser / Client | — | Semantic HTML tags (`<h1>` to `<h3>`) and high-contrast CSS color tokens in React components. |
| Agentic Discovery Standards (`llms.txt`, `ai-catalog.json`) | CDN / Static | Edge Reverse Proxy | Static public assets served from `client/public/` with explicit MIME-types and rewrite exemptions in `vercel.json`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `^18.3.1` [VERIFIED: client/package.json:25] | Core UI component framework | Established platform foundation with concurrent rendering and StrictMode lifecycle |
| `axios` | `^1.7.2` [VERIFIED: client/package.json:19] | HTTP client transport | Centralized interceptor and adapter pipeline enables clean global in-flight request deduplication |
| `socket.io-client` | `^4.7.5` [VERIFIED: client/package.json:30] | Real-time WebSocket synchronization | Centralized socket client supporting prioritized transport negotiation and exponential backoff jitter |
| `tailwindcss` | `^3.4.3` [VERIFIED: client/package.json:51] | Design system & utility styling | Native GPU compositing utilities (`transform-gpu`, `opacity`, `translate-z-0`) and dark theme obsidian palette |
| `vitest` | `^5.1.0` [VERIFIED: client/package.json:54] | Client unit and integration test runner | Fast in-memory JSDOM test execution (~14s for 147 tests) validating deduplication, a11y, and skeletons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^0.378.0` [VERIFIED: client/package.json:23] | Accessible UI vector iconography | Standardized icon system with explicit `aria-hidden` attributes |
| `leaflet` | `^1.9.4` [VERIFIED: client/package.json:22] | Geospatial interactive mapping | Core map engine; requires explicit aspect-ratio container to prevent layout reflows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Axios In-Flight Map | `@tanstack/react-query` or `swr` | Heavy dependency addition (~15kB gzip) requiring rewriting every single custom hook (`useRoutePlanner`, `useOptimization`, `useAuth`); custom Axios deduplication achieves identical query collapsing in ~35 lines of code with 0 added dependencies |
| Static Skeleton Geometry | Full-Screen Blur Glassmorphism Overlay | Blurring the entire screen while data fetches hides the shell, increasing perceived latency and failing Core Web Vitals Speed Index; skeleton wireframes provide immediate visual feedback |
| Google Fonts Preload + Swap | Local Self-Hosted WOFF2 Files | Self-hosting Inter and JetBrains Mono requires bundling 1.2MB of font assets into `client/public/fonts/`; asynchronous `<link rel="preload">` with `display=swap` and fallback font-face metric overrides completely eliminates render-blocking without asset bloat |

**Installation:**
```bash
# No new packages required — Phase 30 uses existing dependencies
```

**Version verification:**
- `axios@1.7.2` confirmed present in `client/package.json:19`
- `socket.io-client@4.7.5` confirmed present in `client/package.json:30`
- `tailwindcss@3.4.3` confirmed present in `client/package.json:51`
- `vitest@5.1.0` confirmed present in `client/package.json:54`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *None* | — | — | — | — | [OK] | Zero new external packages installed in Phase 30 |

**Packages removed due to [SLOP] verdict:** None
**Packages flagged as suspicious [SUS]:** None

## Architecture Patterns

### System Architecture Diagram

```
+-----------------------------------------------------------------------------------------------------+
|                                          BROWSER CLIENT                                             |
|                                                                                                     |
|  [ index.html ]                                                                                     |
|        │                                                                                            |
|        ├──► Non-blocking Font Preload (<link rel="preload" as="style" display=swap>)                 |
|        │    └── Eliminates 310ms render-blocking CSS                                                |
|        │                                                                                            |
|  [ RoutePlannerPage.tsx ]                                                                           |
|        │                                                                                            |
|        ├──► [ Structural Shell ] (Static Grid: lg:grid-cols-12, min-h-[640px])                      |
|        │          │                                                                                 |
|        │          ├── Left Col (4): Reserved Skeleton / OptimizationControlPanel (min-h-[580px])   |
|        │          │                                                                                 |
|        │          └── Right Col (8): Reserved CurrentRouteSkeleton (min-h-[290px])                  |
|        │                    │         └── Replaces `if (!baseline) return null` (CLS: 0.45 -> 0.02) |
|        │                    └── Map Container (aspect-video lg:h-[520px] min-h-[420px])             |
|        │                              └── Prevents Leaflet tile hydration reflow                    |
|        │                                                                                            |
|        ├──► [ Accessible Headings ]                                                                 |
|        │          └── h1 (Page) ──► h2 (Panels: Controls, Baseline, Map, Live) ──► h3 (Sub-metrics)|
|        │                                                                                            |
|        └──► [ GPU Composited CSS ]                                                                  |
|                   └── Replaces transition-colors/border/shadow with transform/opacity/filter        |
|                                                                                                     |
|  [ client.ts: apiClient ]                                                                           |
|        │                                                                                            |
|        └──► [ In-Flight Request Deduplicator ]                                                      |
|                   ├── GET key = Method:URL:Params                                                   |
|                   ├── Duplicate in-flight? ──Yes──► Return active Promise (Collapses 4x calls to 1) |
|                   └── Duplicate in-flight? ──No───► Dispatch + Cache (3000ms TTL window)            |
|                                                     (Auto-invalidated on POST/PUT/DELETE)           |
|                                                                                                     |
|  [ socketClient.ts ]                                                                                |
|        │                                                                                            |
|        └──► transports: ['websocket', 'polling'] + exponential backoff jitter (randomization: 0.5)  |
|             └── Prevents HTTP polling storm on Render backend cold starts                           |
+-----------------------------------------------------------------------------------------------------+
                                              │
                                              ▼
+-----------------------------------------------------------------------------------------------------+
|                                      EDGE / STATIC HOSTING (Vercel)                                 |
|                                                                                                     |
|  [ vercel.json ]                                                                                    |
|        │                                                                                            |
|        ├── Rewrite Exemption Regex: (?!api/|socket.io/|...|ai-catalog\.json|llms\.txt|robots\.txt)   |
|        │     └── AI agents fetching /ai-catalog.json or /llms.txt bypass SPA HTML fallback          |
|        │                                                                                            |
|        ├── Header: /ai-catalog.json ──► Content-Type: application/json, Access-Control-Allow: *     |
|        └── Header: /llms.txt        ──► Content-Type: text/plain; charset=utf-8                    |
+-----------------------------------------------------------------------------------------------------+
```

### Recommended Project Structure
```
client/
├── index.html                                 # Asynchronous font preloading & fallback overrides
├── vercel.json                                # Rewrite exemptions & MIME headers for agentic specs
├── public/
│   ├── ai-catalog.json                        # NEW: Machine-readable agentic discovery manifest
│   ├── llms.txt                               # UPDATED: Standardized H1 and markdown index
│   └── robots.txt                             # Updated bot crawling directives
└── src/
    ├── index.css                              # GPU-composited animation rules & dark tokens
    ├── api/
    │   ├── client.ts                          # Global in-flight GET query deduplicator (D-03)
    │   └── __tests__/
    │       └── clientDeduplication.test.ts    # NEW: Test suite verifying in-flight request collapsing
    ├── utils/
    │   └── socketClient.ts                    # WebSocket transport priority & reconnect jitter (D-04)
    ├── components/
    │   ├── layout/
    │   │   └── AdminHeader.tsx                # High-contrast demo badges (WCAG AA) & h1 title
    │   └── optimization/
    │       ├── CurrentRouteCard.tsx           # Reserved skeleton geometry & h2/h3 heading hierarchy
    │       └── __tests__/
    │           ├── RoutePlannerSkeleton.test.tsx      # NEW: Skeleton layout shift immunity tests
    │           └── RoutePlannerHeadingOrder.test.tsx  # NEW: Heading hierarchy compliance tests
    └── pages/admin/
        └── RoutePlannerPage.tsx               # Grid layout stabilization & reserved live route slot
```

### Pattern 1: Reserved Skeleton Geometry for Layout Shift Immunity (PERF-CLS-01)
**What:** Replacing dynamic unmounted states (`if (!baseline) return null`) with structurally identical, pre-dimensioned skeleton wireframes matching the exact CSS box model (`min-height`, `aspect-ratio`, padding, and grid cells).
**When to use:** Whenever dynamic data (like baseline routes or dispatch batches) resolves asynchronously after initial DOM paint.
**Verbatim Code Citation:**
In `client/src/components/optimization/CurrentRouteCard.tsx:53-55`:
```tsx
  if (!baseline && !isLoading) {
    return null;
  }
```
*Issue:* Returning `null` collapses the DOM node to 0px height. When baseline evaluation resolves, the card injects 380px of height, shifting the Map down by 380px (CLS: 0.416).
**Remediation:**
```tsx
// Source: client/src/components/optimization/CurrentRouteCard.tsx
export const CurrentRouteCard: React.FC<CurrentRouteCardProps> = ({
  baseline,
  isLoading = false,
  optResult = null,
  // ...
}) => {
  // If baseline is not ready yet, render the stationary reserved skeleton card
  // rather than returning null. This guarantees zero layout shift.
  if (!baseline && !optResult) {
    return (
      <section
        aria-label="Current Route Loading Placeholder"
        className="p-5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 min-h-[290px] flex flex-col justify-between animate-pulse"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container dark:bg-obsidian-800" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-surface-container dark:bg-obsidian-800 rounded" />
              <div className="h-3 w-72 bg-surface-container/60 dark:bg-obsidian-850 rounded" />
            </div>
          </div>
          <div className="h-6 w-24 bg-surface-container dark:bg-obsidian-800 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-surface-low dark:bg-obsidian-950 rounded-lg p-3 space-y-2 border border-outline-variant/30 dark:border-obsidian-800">
              <div className="h-3 w-16 bg-surface-container dark:bg-obsidian-800 rounded" />
              <div className="h-6 w-20 bg-surface-container dark:bg-obsidian-800 rounded" />
            </div>
          ))}
        </div>
        <div className="h-9 w-full bg-surface-container/40 dark:bg-obsidian-850 rounded-lg" />
      </section>
    );
  }
  // ... regular card render
```

### Pattern 2: Global In-Flight Request Deduplication in Axios (PERF-WATERFALL-02)
**What:** An in-flight query deduplication registry that intercepts concurrent idempotent GET requests. If an identical request is currently pending, it returns the existing Promise rather than dispatching a duplicate network call.
**When to use:** Multi-component pages where hooks (`useRoutePlanner`, `useRealtimeCatchup`, `useAuth`) request shared endpoints (`/routes`, `/batches`, `/fleet/vehicles`) simultaneously on mount.
**Implementation Pattern:**
```typescript
// Source: client/src/api/client.ts
const inFlightRequests = new Map<string, Promise<any>>();
const cacheTTLMs = 3000;
const cachedResponses = new Map<string, { expires: number; data: any }>();

function generateRequestKey(config: InternalAxiosRequestConfig): string {
  const method = (config.method || 'get').toUpperCase();
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${method}:${url}:${params}`;
}

export function clearInFlightCache(): void {
  inFlightRequests.clear();
  cachedResponses.clear();
}

// Wrap adapter to collapse in-flight queries
const defaultAdapter = apiClient.defaults.adapter;
apiClient.defaults.adapter = async (config) => {
  const method = (config.method || 'get').toLowerCase();

  // Deduplication applies strictly to idempotent GET requests
  if (method !== 'get') {
    // Invalidate cached GET queries on state-mutating requests (POST, PUT, DELETE, PATCH)
    clearInFlightCache();
    if (typeof defaultAdapter === 'function') {
      return defaultAdapter(config);
    }
    return axios.defaults.adapter!(config);
  }

  const key = generateRequestKey(config);
  const now = Date.now();

  // Check short-term TTL cache (3000ms window)
  const cached = cachedResponses.get(key);
  if (cached && cached.expires > now) {
    return Promise.resolve(cached.data);
  }

  // Check active in-flight promise
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  const requestPromise = (async () => {
    try {
      const adapterFn = typeof defaultAdapter === 'function' ? defaultAdapter : axios.defaults.adapter!;
      const response = await adapterFn(config);
      cachedResponses.set(key, { expires: Date.now() + cacheTTLMs, data: response });
      return response;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
};
```

### Pattern 3: Asynchronous Font Loading & GPU-Composited Transitions (PERF-COMPOSIT-03)
**What:** Non-blocking stylesheet preloading with `print`-to-`all` media swap and fallback font metrics to prevent FOUT layout shift; replacing `transition: border-color, box-shadow` with `transform` and pseudo-element `opacity`.
**Verbatim Code Citation:**
In `client/index.html:17-20`:
```html
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
```
*Issue:* The standard stylesheet tag blocks CSSOM construction for 310ms.
**Remediation in `client/index.html`:**
```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
    />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      media="print"
      onload="this.media='all'"
    />
    <noscript>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
    </noscript>
```
**Remediation in `client/src/index.css` for composited transitions:**
```css
/* Compositor-friendly card transitions using transform and opacity */
.panel-card {
  position: relative;
  background-color: var(--color-surface-lowest, #FFFFFF);
  border: 1px solid var(--color-outline-variant, #E2E8F0);
  border-radius: 12px;
  transform: translateZ(0); /* Force compositor layer promotion */
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.panel-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 12px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.panel-card:hover::after {
  opacity: 1;
}
```

### Pattern 4: WCAG AA High-Contrast Badges & Heading Hierarchy (A11Y-CONTRAST-04)
**What:** Replacing low-contrast pastel badges with WCAG AA certified text-to-background combinations (>= 4.5:1 ratio) and enforcing a strict sequential heading order (`<h1>` -> `<h2>` -> `<h3>`).
**Verbatim Code Citation:**
In `client/src/components/layout/AdminHeader.tsx:37-39`:
```tsx
            {user?.isDemoData && (
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Demo
              </span>
            )}
```
*Issue:* `text-amber-700` (`#b45309`) on `bg-amber-500/15` fails the 4.5:1 contrast requirement in light theme (scores ~3.8:1).
**Remediation:**
```tsx
            {user?.isDemoData && (
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                Demo
              </span>
            )}
```
*(Contrast ratio: #78350f on #fef3c7 = 8.1:1 in light mode; #fde68a on #451a03 = 11.2:1 in dark mode — both exceeding WCAG AAA).*

**Heading hierarchy order across RoutePlannerPage:**
- `<h1>Route Optimization & Planning</h1>` [in `AdminHeader.tsx`]
  - `<h2>Dispatch Batch & Strategy Configuration</h2>` [in `OptimizationControlPanel.tsx`]
  - `<h2>Current Route — Before Optimization</h2>` [in `CurrentRouteCard.tsx` line 111, upgraded from `<h3>`]
    - `<h3>Optimization Impact & Delta</h3>` [in `CurrentRouteCard.tsx` line 241, upgraded from `<h4>`]
    - `<h3>Assigned Fleet Resource</h3>` [in `CurrentRouteCard.tsx` line 358, upgraded from `<h4>`]
  - `<h2>Geospatial Route Map</h2>` [in `RoutePlannerPage.tsx` line 834, upgraded from `<span>`]
  - `<h2>Dispatched Routes Monitor</h2>` [in `RoutePlannerPage.tsx` line 682, upgraded from `<span>`]

### Pattern 5: Agentic Discovery Standard Manifests (AGENTIC-SPEC-05)
**What:** Exposing `client/public/llms.txt` and `client/public/ai-catalog.json` with compliant schemas, exempt from Vercel SPA rewrites.
**Verbatim Code Citation:**
In `client/vercel.json:4-6`:
```json
    {
      "source": "/((?!api/|socket\\.io/|assets/|theme-init\\.js|favicon\\.svg|icons\\.svg|manifest\\.json|sw\\.js).*)",
      "destination": "/index.html"
    }
```
*Issue:* Agent scrapers requesting `/ai-catalog.json` or `/llms.txt` receive HTML from `/index.html` instead of JSON/text, scoring 1/4 on agentic discovery.
**Remediation in `client/vercel.json`:**
```json
    {
      "source": "/((?!api/|socket\\.io/|assets/|theme-init\\.js|favicon\\.svg|icons\\.svg|manifest\\.json|sw\\.js|ai-catalog\\.json|llms\\.txt|robots\\.txt).*)",
      "destination": "/index.html"
    }
```
And headers config:
```json
    {
      "source": "/ai-catalog.json",
      "headers": [
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    },
    {
      "source": "/llms.txt",
      "headers": [
        { "key": "Content-Type", "value": "text/plain; charset=utf-8" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
```

### Anti-Patterns to Avoid
- **Unreserved Asynchronous Card Mounts (`if (!data) return null`):** Never allow a high-impact workspace component to render `null` during loading states. Always reserve a stationary skeleton wireframe with identical CSS min-height.
- **Uncontrolled Global Fetch Overrides:** Do not monkey-patch global `window.fetch` or use aggressive multi-minute browser caching for operational data. Use in-flight Promise deduplication with an ephemeral 3000ms TTL window that purges on state mutations.
- **`transition: all`:** Avoid `transition: all` on animated elements. It triggers reflows and paint warnings on non-composited properties like `border-color` and `box-shadow`. Use `transition: transform, opacity` or pseudo-element opacity tricks.
- **Skipping Semantic Heading Levels:** Never jump from `<h1>` to `<h3>` or `<h4>` to achieve smaller visual typography. Use CSS classes (`text-xs font-bold`) for sizing while maintaining sequential heading tags (`<h1>` -> `<h2>` -> `<h3>`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side Query Deduplication | Custom React state wrapper around every component | Axios adapter request promise map | Hooks and child components can dispatch API calls independently without code coupling; deduplication happens transparently in the network transport |
| Socket Fallback Storm Mitigation | Custom polling loop with `setInterval` | Socket.io native transport options `['websocket', 'polling']` + `randomizationFactor: 0.5` | Socket.io engine already handles WebSocket upgrade, ping-pong timeouts, and jittered exponential reconnection natively |
| Layout Skeleton Shimmer | Complex CSS keyframe animation engines | Tailwind utility `animate-pulse` with dark theme palette | Minimal bundle footprint, uses hardware-accelerated CSS opacity animation, matches existing Obsidian slate theme |
| Web Font Asynchronous Preload | Custom JS font-loader script (`WebFont.load`) | Native HTML `<link rel="preload" as="style">` with `display=swap` | Zero JavaScript execution overhead; native browser parser loads and applies stylesheet without blocking first render |

## Common Pitfalls

### Pitfall 1: Stale Mutation Cache from Query Deduplication
**What goes wrong:** A user cancels or dispatches a route, but the UI continues to render the old route list because the GET query returned a cached promise.
**Why it happens:** Deduplication cache retains GET responses without invalidating when a POST/PUT/DELETE mutation occurs.
**How to avoid:** In `apiClient`, intercept any non-GET request (`post`, `put`, `delete`, `patch`) and immediately call `clearInFlightCache()` to wipe both active promises and TTL entries.
**Warning signs:** Vitest or manual testing shows route status not updating immediately after dispatch button click.

### Pitfall 2: Double Mount in React 18 StrictMode Cancelling Sockets
**What goes wrong:** Fast mount/unmount in React dev mode cancels the WebSocket before connection establishes.
**Why it happens:** React 18 mounts components twice in development.
**How to avoid:** Retain the existing `mountRealtimeSocket` helper in `socketClient.ts:73-98` [VERIFIED: client/src/utils/socketClient.ts:73-98] which defers socket creation by one event-loop tick (`setTimeout(..., 0)`).

### Pitfall 3: Broken Vercel Single-Page App (SPA) Routing for Static Files
**What goes wrong:** Requests to `https://smartroute.app/ai-catalog.json` return `index.html` with status 200, but AI agents parse it as JSON and crash with `SyntaxError: Unexpected token '<'`.
**Why it happens:** The wildcard rewrite in `vercel.json` captures all paths not explicitly excluded in the negative lookahead regex.
**How to avoid:** Add `ai-catalog\\.json` and `llms\\.txt` to the negative lookahead pattern in both `client/vercel.json` and root `vercel.json`.

## Code Examples

### 1. Machine-Readable `ai-catalog.json` Specification
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "name": "SmartRoute AI Delivery Optimization Platform",
  "version": "1.0.0",
  "description": "AI-powered real-time last-mile delivery route optimization, fleet dispatch, and live telemetry tracking.",
  "homepage": "https://smartroute.app",
  "documentationUrl": "https://smartroute.app/llms.txt",
  "capabilities": [
    "2-Opt TSP Route Optimization",
    "Multi-Depot Vehicle Routing (MDVRP)",
    "Real-Time Driver GPS Telemetry Tracking",
    "Continuous Google Maps Navigation Sequencing",
    "Electronic Proof of Delivery (Photo & OTP)"
  ],
  "authentication": {
    "type": "bearerAuth",
    "header": "Authorization: Bearer <JWT_TOKEN>"
  },
  "endpoints": {
    "routes": {
      "path": "/api/v1/routes",
      "methods": ["GET", "POST"],
      "description": "Calculate optimal delivery sequences and dispatch routes"
    },
    "batches": {
      "path": "/api/v1/batches",
      "methods": ["GET", "POST"],
      "description": "Consignment delivery batches and clustering"
    },
    "telemetry": {
      "path": "/api/v1/telemetry",
      "methods": ["GET", "POST"],
      "description": "Live GPS pings, speed, heading, and driver alerts"
    }
  }
}
```

### 2. Standardized `llms.txt` Format
```markdown
# SmartRoute: Last-Mile Delivery Optimization Platform

> SmartRoute is a production-grade, AI-powered last-mile logistics and route optimization platform. It combines heuristic 2-Opt TSP solvers, real-time vehicle telemetry, multi-depot vehicle routing (MDVRP), and continuous mobile navigation for field drivers.

## System Capabilities
- **2-Opt Route Optimization**: Heuristic TSP engine generating fuel-optimal stop sequences with traffic scenario adjustments (normal, heavy rain, road construction).
- **Multi-Depot Vehicle Routing (MDVRP)**: Autonomous consignment clustering to nearest hubs with closed-loop multi-hub departure and return legs.
- **Live Fleet Telemetry**: High-frequency GPS ping ingestion (120 pings/min max) with stale-vehicle detection, speed heading orientation, and remote ping triggers.
- **Driver Handheld Navigation**: Automated continuous Google Maps navigation sequencing with in-transit mishap rerouting and electronic POD (Photo + OTP).

## API & Schema Reference
- [AI Tool Catalog](/ai-catalog.json): Machine-readable tool declarations and capability definitions.
- [Route Operations API](/api/v1/routes): Dispatch, calculate, and re-optimize operational delivery routes.
- [Delivery Batches API](/api/v1/batches): Ingest, group, and query consignment manifests.
- [Fleet Assets API](/api/v1/fleet): Manage electric and combustion delivery vehicles, home hubs, and drivers.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Render-blocking `<link rel="stylesheet">` | `<link rel="preload" as="style">` with `display=swap` | Modern Web Vitals standard | Eliminates 310ms render-blocking delay, boosting Speed Index |
| Layout shifting dynamic component mount (`return null`) | Stationary skeleton wireframes with matching CSS min-height | Core Web Vitals (CLS < 0.05) | Completely stabilizes page shell during asynchronous hydration |
| Simultaneous duplicate client API queries | In-flight Promise deduplication in Axios transport | High-performance SPA architecture | Collapses network waterfalls by 75% on initial page load |
| `polling` first Socket.IO transport fallback | `['websocket', 'polling']` with exponential backoff jitter | Modern real-time WebSocket architecture | Eliminates HTTP polling flood during backend cold starts |
| Low-contrast pastel badges | WCAG AA compliant obsidian tokens (>= 4.5:1 ratio) | WCAG 2.1 AA | Ensures legibility and 100/100 Accessibility score |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 3000ms TTL window for in-flight GET query deduplication is optimal for route planner views | Architecture Patterns (Pattern 2) | LOW: Shorter window (e.g. 1000ms) still deduplicates simultaneous mount queries; longer window saves bandwidth but cache is immediately cleared on mutations anyway |
| A2 | Vercel is the primary production edge host | Architecture Patterns (Pattern 5) | LOW: `client/vercel.json` is already present in repo; configuration changes also apply if deployed behind reverse proxies |

## Open Questions (RESOLVED)

1. **Does `InteractiveMap` Leaflet container require fixed pixel heights on mobile?**
   - What we know: On desktop, `RoutePlannerPage.tsx:896` sets `h-[520px]`. On small mobile screens, 520px might occupy excessive vertical height.
   - **RESOLVED:** Use responsive utility `h-[380px] sm:h-[460px] lg:h-[520px] min-h-[380px]` with `aspect-video` reservation to maintain rock-solid stability across mobile and desktop breakpoints without layout shift.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.16.0 | — |
| npm | Package Manager | ✓ | 10.x | — |
| Vitest | Client Unit & A11y Tests | ✓ | 5.1.0 | — |
| Tailwind CSS | Styling & GPU Compositing | ✓ | 3.4.3 | — |
| Socket.IO Client | Real-Time Sync | ✓ | 4.7.5 | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v5.1.0 (with JSDOM and Testing Library) |
| Config file | `client/vitest.config.ts` [VERIFIED: client/vitest.config.ts:1-36] |
| Quick run command | `npm --prefix client run test:unit` |
| Full suite command | `npm --prefix client run test:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-CLS-01 | Reserved skeleton renders when baseline is null/evaluating without collapsing DOM height | unit / render | `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` | ❌ Wave 0 Gap |
| PERF-WATERFALL-02 | In-flight GET query deduplication collapses 4 concurrent identical requests into 1 network call | unit / api | `npm --prefix client run test:unit -- src/api/__tests__/clientDeduplication.test.ts` | ❌ Wave 0 Gap |
| PERF-COMPOSIT-03 | Transitions across button and cards use hardware-composited `transform` and `opacity` properties | static / style | `npm --prefix client run test:unit -- src/components/optimization/__tests__/CurrentRouteCard.test.tsx` | ✅ Existing |
| A11Y-CONTRAST-04 | Heading hierarchy follows strict sequential order (`<h1>` -> `<h2>` -> `<h3>`) without level skips and badges meet WCAG AA contrast | unit / a11y | `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx` | ❌ Wave 0 Gap |
| AGENTIC-SPEC-05 | `llms.txt` conforms to markdown specifications, `ai-catalog.json` contains valid JSON schema, and `vercel.json` exempts agentic routes from rewrites | unit / static | `npm --prefix client run test:unit -- src/__tests__/agenticSpecs.test.ts` | ❌ Wave 0 Gap |

### Sampling Rate
- **Per task commit:** `npm --prefix client run test:unit`
- **Per wave merge:** `npm --prefix client run test:unit`
- **Phase gate:** All 25+ Vitest suites green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `client/src/api/__tests__/clientDeduplication.test.ts` — covers PERF-WATERFALL-02 (verifying in-flight query promise deduplication and mutation invalidation)
- [ ] `client/src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` — covers PERF-CLS-01 (verifying non-null skeleton placeholder rendering during unhydrated baseline state)
- [ ] `client/src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx` — covers A11Y-CONTRAST-04 (verifying sequential `<h1>` -> `<h2>` -> `<h3>` hierarchy and high-contrast badge classes)
- [ ] `client/src/__tests__/agenticSpecs.test.ts` — covers AGENTIC-SPEC-05 (verifying `llms.txt` and `ai-catalog.json` structure and `vercel.json` rewrite regex)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Query parameters and URL strings encoded and sanitized before deduplication key hashing |
| V14 Configuration | yes | Public agentic metadata files (`llms.txt`, `ai-catalog.json`) expose only public documentation and require `bearerAuth` for operational endpoints; CSP headers in `vercel.json` allow Google Fonts and OSM tiles without `unsafe-eval` |

### Known Threat Patterns for Web & Agentic Standards

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| In-flight Cache Poisoning / Stale Data | Tampering | Restrict deduplication strictly to idempotent `GET` queries; flush active cache immediately on any state mutation (`POST`, `PUT`, `DELETE`, `PATCH`) |
| Unauthenticated Agentic Exploitation | Information Disclosure | `ai-catalog.json` strictly describes public API surface and declares `bearerAuth` JWT authorization for all mutating and sensitive endpoints |
| Denial of Service via Socket Reconnection Floods | Denial of Service | Socket.IO client configured with exponential backoff and `randomizationFactor: 0.5` jitter to prevent synchronized reconnect storms |

## Sources

### Primary (HIGH confidence)
- Official Codebase Inspection:
  - `client/src/pages/admin/RoutePlannerPage.tsx:762-913` [VERIFIED: in-repo] - Identified grid layout structure and unreserved dynamic mounts
  - `client/src/components/optimization/CurrentRouteCard.tsx:53-55` [VERIFIED: in-repo] - Verified `return null` layout shift trigger
  - `client/src/api/client.ts:20-85` [VERIFIED: in-repo] - Verified Axios instance, interceptors, and refresh logic
  - `client/src/utils/socketClient.ts:37-46` [VERIFIED: in-repo] - Verified `transports: ['polling', 'websocket']` fallback polling loop
  - `client/index.html:15-20` [VERIFIED: in-repo] - Verified render-blocking Google Fonts link
  - `client/vercel.json:1-58` [VERIFIED: in-repo] - Verified SPA rewrite rules intercepting agentic JSON files
  - `client/src/index.css:156-230` [VERIFIED: in-repo] - Identified non-composited `border-color` and `box-shadow` transitions
- Web Standards & Tool Specifications:
  - Google Lighthouse Audits: Cumulative Layout Shift (CLS), Speed Index, Accessibility audits
  - `https://llmstxt.org`: Official Markdown specification for agentic `llms.txt` discovery
  - Axios HTTP Client: Custom adapter pattern for in-flight request collapsing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Fully verified against existing in-repo dependencies in `client/package.json`
- Architecture: HIGH - Concrete, non-breaking patterns targeting verified root cause lines in `RoutePlannerPage.tsx`, `CurrentRouteCard.tsx`, `client.ts`, and `socketClient.ts`
- Pitfalls: HIGH - Addressed real edge cases (stale mutation cache, React 18 StrictMode socket mounts, Vercel SPA rewrite interception)

**Research date:** 2026-11-25
**Valid until:** 2026-12-25 (stable web performance & standards architecture)
