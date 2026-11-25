---
phase: 30-production-performance-core-web-vitals-accessibility-agentic-standards
reviewed: 2026-11-25T15:25:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - client/index.html
  - client/public/.well-known/ai-catalog.json
  - client/public/.well-known/ard.json
  - client/public/ai-catalog.json
  - client/public/llms.txt
  - client/src/__tests__/agenticSpecs.test.ts
  - client/src/__tests__/performanceAssets.test.ts
  - client/src/api/__tests__/clientDeduplication.test.ts
  - client/src/api/client.ts
  - client/src/components/layout/AdminHeader.tsx
  - client/src/components/optimization/CurrentRouteCard.tsx
  - client/src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx
  - client/src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx
  - client/src/index.css
  - client/src/pages/admin/RoutePlannerPage.tsx
  - client/src/utils/socketClient.ts
  - client/vercel.json
  - vercel.json
findings:
  critical: 4
  warning: 7
  info: 3
  total: 14
  necessity: 1
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-11-25T15:25:00Z  
**Depth:** standard  
**Files Reviewed:** 18  
**Status:** issues_found  

## Summary

Standard-depth adversarial code review was conducted across all 18 source, configuration, asset, and test files introduced or modified in **Phase 30: Production Performance, Core Web Vitals, Accessibility & Agentic Standards**.

While the phase successfully introduced reserved skeleton card geometries to minimize Cumulative Layout Shift (CLS), ARD discovery manifests, and composited CSS transition rules, the adversarial review identified **4 Blocker/Critical defects**, **7 Warnings** (including 1 necessity finding), and **3 Info items**:

1. **CSP Directive Collision (CR-01):** The non-blocking Google Fonts print-swap pattern (`media="print" onload="this.media='all'"`) in `client/index.html` is actively blocked by the production Content Security Policy in both `client/vercel.json` and `vercel.json` due to `script-src-attr 'none'`. Browsers reject the inline `onload` attribute, leaving the stylesheet perpetually locked at `media="print"` and preventing web fonts from applying on screen.
2. **Dispatch State Synchronization Drop (CR-02):** In `RoutePlannerPage.tsx`, `onDispatchAssignment` successfully calls the backend dispatch endpoint for individual auto-assigned vehicle routes, but omits `setIsDispatched(true)`. As a result, the parent component does not register the dispatched state, the live dispatched routes strip does not refresh, and the UI remains stuck offering to dispatch.
3. **Stale Cache Masking Real-Time WebSocket Events (CR-03):** The new in-flight query deduplication cache in `client.ts` caches GET requests for 3000ms and only invalidates when a local state-mutating HTTP call occurs. When real-time WebSocket push events (`route:dispatched`, `route:updated`) arrive from other dispatchers or mobile drivers, `RoutePlannerPage.tsx` immediately re-queries `RoutesApi.list()`, which returns the stale pre-mutation response from the 3000ms client cache.
4. **URLSearchParams Query Cache Key Collisions (CR-04):** `serializeParams` inspects `Object.keys(params)` for objects, which returns an empty array `[]` for `URLSearchParams` instances. Different GET requests with distinct `URLSearchParams` receive identical cache keys, collapsing unrelated queries and returning cross-query cached data.
5. **Memory Leak in Cached Responses (WR-01):** Expired entries in `cachedResponses` are never deleted when unexpired; the map grows monotonically during long dispatcher shifts.

---

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: CSP Violation Blocks Non-Blocking Google Fonts Loading (`script-src-attr 'none'` vs `onload="this.media='all'"`)
**File:** `client/index.html:29` (Cross-referenced with `client/vercel.json:100` and `vercel.json:103`)  
**Issue:** `client/index.html` implements the Google Fonts asynchronous loading pattern:
```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
  media="print"
  onload="this.media='all'"
/>
```
However, the production Content Security Policy configured in `client/vercel.json` and `vercel.json` enforces:
```json
"script-src-attr 'none';"
```
Under W3C CSP Level 3, `script-src-attr 'none'` explicitly forbids execution of all inline event handler attributes (`onload`, `onclick`, `onerror`). In standard production browsers (Chrome, Edge, Firefox, Safari), the browser's CSP engine throws a violation error:
`Refused to execute inline event handler because it violates the following Content Security Policy directive: "script-src-attr 'none'"`
Because `onload` is blocked, `this.media='all'` never executes, leaving the font stylesheet locked to `media="print"`. Screen devices never apply Inter / JetBrains Mono fonts, falling back to system serif/sans-serif.  
**Fix:**
Remove the inline `onload` attribute and toggle the stylesheet media attribute via a module script or external theme initialization script:
```html
<!-- client/index.html -->
<link
  id="sr-webfonts"
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
  media="print"
/>
<script type="module">
  const fontLink = document.getElementById('sr-webfonts');
  if (fontLink) fontLink.media = 'all';
</script>
```
Alternatively, adjust CSP in `vercel.json` to allow the specific hash or permit `'self'`.

---

#### CR-02: Missing State Update in `onDispatchAssignment` Leaves Dispatch State Stale
**File:** `client/src/pages/admin/RoutePlannerPage.tsx:817-835`  
**Issue:** When an operator clicks "Dispatch" on an auto-assigned vehicle route within `CurrentRouteCard`, `onDispatchAssignment` is triggered:
```tsx
onDispatchAssignment={async (rId, vId, dId) => {
  try {
    await RoutesApi.dispatch(rId, {
      vehicleId: vId || vehicles[0]?.id || '',
      driverId: dId || drivers[0]?.id || '',
    });
    setToastMsg('Route Dispatched');
  } catch (e: any) { ... }
}}
```
While the network dispatch succeeds on the server, `setIsDispatched(true)` is never invoked (unlike in `onConfirmDispatch` at line 972). Consequently, `isDispatched` remains `false` in React state. The `useEffect` hook listening to `[isDispatched]` (line 113) never fires to reload active routes, the dispatched route does not appear in the active routes carousel, and the control bar continues displaying "Dispatch Current Route".  
**Fix:**
```tsx
onDispatchAssignment={async (rId, vId, dId) => {
  try {
    await RoutesApi.dispatch(rId, {
      vehicleId: vId || vehicles[0]?.id || '',
      driverId: dId || drivers[0]?.id || '',
    });
    setIsDispatched(true);
    setToastMsg('Route Dispatched and assigned to fleet vehicle');
  } catch (e: any) { ... }
}}
```

---

#### CR-03: Real-Time WebSocket Events Serve Stale Data Due to 3000ms Client Cache Without Invalidation
**Files:** `client/src/api/client.ts:78-85`, `client/src/pages/admin/RoutePlannerPage.tsx:147-160`  
**Issue:** `client.ts` caches all GET requests in `cachedResponses` with a 3000ms TTL (`CACHE_TTL_MS = 3000`). It invalidates the cache only when state-mutating calls (POST, PUT, DELETE, PATCH) are issued locally on that client. When other operators or mobile drivers trigger changes (e.g., dispatching or updating routes), the server emits real-time WebSocket events (`route:dispatched`, `route:updated`, `route:reordered`). Upon receiving these events, `RoutePlannerPage.tsx` invokes:
```ts
const onRouteChanged = () => {
  RoutesApi.list({ limit: 50 }).then(...);
};
```
Because `RoutesApi.list({ limit: 50 })` was likely fetched upon mount or within the last 3000ms, the `apiClient.defaults.adapter` intercepts the request and immediately returns the cached, pre-mutation route list. Real-time notifications are effectively swallowed by the client-side cache.  
**Fix:**
Expose a cache bypass option in `apiClient` (or clear the cache upon receiving real-time invalidations):
```ts
// In client/src/pages/admin/RoutePlannerPage.tsx
import { clearInFlightCache } from '../../api/client';

const onRouteChanged = () => {
  clearInFlightCache();
  RoutesApi.list({ limit: 50 }).then(...);
};
```
Additionally, modify `client.ts` adapter to respect `Cache-Control: no-cache` in request headers.

---

#### CR-04: `URLSearchParams` Objects Collide in `serializeParams` Query Deduplication Key
**File:** `client/src/api/client.ts:40-53`  
**Issue:** `serializeParams` checks `if (typeof params !== 'object') return String(params);` and then runs `Object.keys(params)`. When callers pass a `URLSearchParams` instance (a standard object format supported by Axios and Fetch), `Object.keys(new URLSearchParams('status=COMPLETED'))` returns `[]` because parameters are stored in internal slots rather than enumerable own properties. Thus, `serializeParams` produces `"{}"` for all `URLSearchParams` objects. Different requests (e.g. `apiClient.get('/deliveries', { params: new URLSearchParams({ page: '1' }) })` and `page: '2'`) generate the exact same `cacheKey`, leading to incorrect query collapsing and serving cross-page cached data.  
**Fix:**
```ts
function serializeParams(params: any): string {
  if (!params) return '';
  if (params instanceof URLSearchParams) return params.toString();
  if (typeof params !== 'object') return String(params);
  try {
    const keys = Object.keys(params).sort();
    const sortedObj: Record<string, any> = {};
    for (const k of keys) {
      sortedObj[k] = params[k];
    }
    return JSON.stringify(sortedObj);
  } catch {
    return String(params);
  }
}
```

---

### Warnings

#### WR-01: Unbounded Monotonic Growth and Memory Leak in `cachedResponses` Map
**File:** `client/src/api/client.ts:32`, `78-103`  
**Issue:** In `client.ts`, `cachedResponses` is a standard `Map<string, { expires: number; data: any }>`. When a cached entry expires (`now >= cached.expires`), the adapter ignores it and fetches fresh data, but never deletes the expired entry from `cachedResponses`. Unless a mutation occurs to trigger `clearInFlightCache()`, any query with unique parameters (e.g. telemetry timestamps, vehicle history ranges, search terms, pagination offsets) remains stored in memory indefinitely. During long operational dispatcher sessions, this produces unbounded memory growth.  
**Fix:**
Delete expired entries when queried, and enforce a maximum cache size:
```ts
const cached = cachedResponses.get(cacheKey);
const now = Date.now();
if (cached) {
  if (cached.expires > now) {
    return Promise.resolve({ ...cached.data, config });
  }
  cachedResponses.delete(cacheKey);
}
```

---

#### WR-02: `CurrentRouteCard` Unhandled Null/Undefined Dereference on `startingLocation` & `endingLocation`
**File:** `client/src/components/optimization/CurrentRouteCard.tsx:250`, `259`  
**Issue:** In `CurrentRouteCard.tsx`, the starting/ending location strip is guarded solely by `{metrics && (`. Inside, lines 250 and 259 access:
`metrics.startingLocation.name`
`metrics.startingLocation.address`
`metrics.endingLocation.name`
without optional chaining. When `BaselineEvaluationResult` is constructed from an optimized result or custom route without explicit starting/ending location metadata (or during transition states where `startingLocation` is null), this throws an unhandled `TypeError: Cannot read properties of undefined (reading 'name')`, crashing the React render tree.  
**Fix:**
Use optional chaining and fallbacks:
```tsx
<span>
  <strong>Starting:</strong> {metrics.startingLocation?.name || 'Depot'} ({metrics.startingLocation?.address || 'Origin'})
</span>
...
<span>
  <strong>Ending:</strong> {metrics.endingLocation?.name || 'Depot'} (Return Depot)
</span>
```

---

#### WR-03: Division by Zero Yields `NaN%` or `Infinity%` in Distance Savings Calculation
**File:** `client/src/components/optimization/CurrentRouteCard.tsx:304`  
**Issue:** Line 304 calculates percentage distance reduction:
```tsx
-{distSaved.toFixed(2)} km ({((distSaved / baseDist) * 100).toFixed(1)}%)
```
Unlike driving time (line 322: `baseDrivingTime || 1`), total duration (line 335: `baseDur || 1`), fuel (line 355: `baseFuel || 1`), and cost (line 370: `baseCost || 1`), `baseDist` has no fallback guard against zero. If `baseDist` is 0, the calculation produces `Infinity%` or `NaN%`.  
**Fix:**
```tsx
-{distSaved.toFixed(2)} km ({((distSaved / (baseDist || 1)) * 100).toFixed(1)}%)
```

---

#### WR-04: Missing CORS Header on `/llms.txt` in Vercel Configuration
**Files:** `client/vercel.json:44-55`, `vercel.json:47-58`  
**Issue:** `vercel.json` and `client/vercel.json` configure explicit `Access-Control-Allow-Origin: *` headers for `/ai-catalog.json` and `/.well-known/(.*)`. However, the header block for `/llms.txt` omits this CORS header. AI agents running inside browser sandboxes, ChatGPT plugins, or client-side LLM tool orchestrators will be blocked from reading `/llms.txt` due to CORS restrictions.  
**Fix:**
Add CORS header to the `/llms.txt` rule in both `vercel.json` and `client/vercel.json`:
```json
{
  "source": "/llms.txt",
  "headers": [
    {
      "key": "Content-Type",
      "value": "text/plain; charset=utf-8"
    },
    {
      "key": "Access-Control-Allow-Origin",
      "value": "*"
    },
    {
      "key": "Cache-Control",
      "value": "public, max-age=3600"
    }
  ]
}
```

---

#### WR-05: Inaccurate Content-Type in AI Catalog Specification (`application/openapi+json` for REST Collections)
**Files:** `client/public/.well-known/ai-catalog.json:17-41`, `client/public/ai-catalog.json:17-41`, `client/public/.well-known/ard.json:17-41`  
**Issue:** In `ai-catalog.json`, entries for `/api/v1/routes`, `/api/v1/batches`, `/api/v1/telemetry`, and `/api/v1/hubs` specify:
`"type": "application/openapi+json"`
These URLs point to operational REST API endpoints that return runtime JSON entities (`{ success: true, data: { ... } }`), not OpenAPI 3.0/3.1 document schemas. Autonomous agents parsing the ARD specification expecting an OpenAPI schema document at those URLs will fail schema validation.  
**Fix:**
Update `"type"` to `"application/json"` or `"application/vnd.smartroute.api+json"`, or point OpenAPI-typed entries to an actual OpenAPI JSON schema definition endpoint (e.g. `/api-docs/swagger.json`).

---

#### WR-06: Shared Manager Reconnection Listener Leak in `socketClient.ts`
**File:** `client/src/utils/socketClient.ts:57-65`  
**Issue:** In `createRealtimeSocket`, `(socket as any).io.on('reconnect', ...)` attaches an event listener directly to the Socket.IO `Manager` instance. By default, Socket.IO multiplexes connections to the same URL and reuses the shared `Manager`. Because `mountRealtimeSocket` teardown disconnects `socket` but never removes listeners from `(socket as any).io`, each time a component mounts and unmounts, an additional `'reconnect'` listener is appended to the shared Manager, leading to duplicate `smartroute:reconnect` window events.  
**Fix:**
Clean up the Manager listener during teardown or pass `multiplex: false` / `forceNew: true` in default options.

---

#### WR-07: Cargo-Culted Pattern — Triple Duplication of Identical AI Discovery Files
**Files:** `client/public/.well-known/ai-catalog.json`, `client/public/.well-known/ard.json`, `client/public/ai-catalog.json`, `client/index.html:14-16`  
**Category:** necessity  
**Issue:** The project maintains three separate 171-line identical JSON files (`.well-known/ai-catalog.json`, `.well-known/ard.json`, and `ai-catalog.json`). Furthermore, `client/index.html` links `<link rel="ai-catalog" href="/.well-known/ai-catalog.json" />` and `<link rel="ai-catalog" href="/ai-catalog.json" />` back to back. Because Vercel and Vite rewrites can trivially alias route paths, maintaining 3 parallel physical files introduces maintenance drift risk when endpoint contracts are updated.  
**Fix:** Keep a single canonical specification file at `client/public/.well-known/ai-catalog.json` and configure `vercel.json` rewrites or symlinks for `/ai-catalog.json` and `/.well-known/ard.json`.

---

### Info

#### IN-01: Global `select-none` on `AdminHeader` Prevents Text Selection
**File:** `client/src/components/layout/AdminHeader.tsx:21`  
**Issue:** `AdminHeader` applies `select-none` (`user-select: none`) across the entire header container (`<div className="space-y-4 select-none mb-6">`). This prevents dispatchers from highlighting or copying page titles, batch names, or order references.  
**Fix:** Remove `select-none` from the container, applying it only to icon-only buttons if desired.

---

#### IN-02: `animate-pulse` Ignores `prefers-reduced-motion` in Skeleton Placeholders
**Files:** `client/src/components/optimization/CurrentRouteCard.tsx:60`, `client/src/pages/admin/RoutePlannerPage.tsx:767`  
**Issue:** Skeleton placeholder sections use `animate-pulse` without `motion-reduce:animate-none`. Users who have enabled system reduced-motion preferences continue to experience continuous pulsing.  
**Fix:** Add `motion-reduce:animate-none` alongside `animate-pulse`.

---

#### IN-03: `handleCancelRoute` Unsafe Fallback to `selectedBatchId`
**File:** `client/src/pages/admin/RoutePlannerPage.tsx:72`  
**Issue:** In `handleCancelRoute`, `idToCancel` falls back through `targetId || activeRouteId || selectedLiveRoute?._id || selectedLiveRoute?.id || selectedBatchId`. Calling `RoutesApi.cancel(...)` with a batch ID will trigger a 404 from the server since the endpoint expects a route ID.  
**Fix:** Remove `selectedBatchId` from the fallback chain and require a valid route ID.

---

_Reviewed: 2026-11-25T15:25:00Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_  
