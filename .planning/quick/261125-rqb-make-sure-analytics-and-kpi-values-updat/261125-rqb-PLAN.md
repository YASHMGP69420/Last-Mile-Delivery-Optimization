---
phase: quick
plan: 261125-rqb-make-sure-analytics-and-kpi-values-updat
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/pages/admin/AnalyticsPage.tsx
  - client/src/pages/admin/AdminControlCenterPage.tsx
  - client/src/pages/admin/__tests__/AnalyticsPageRealtime.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "AnalyticsPage subscribes to real-time WebSocket events (delivery:updated, deliveries:updated, delivery:created, delivery:deleted, route:progress, route:dispatched, route:updated, route:cancelled, fleet:vehicle_updated, batch:created, batch:updated, batch:deleted, demo:seeded, demo:deleted, system:purged)"
    - "AnalyticsPage and AdminControlCenterPage automatically refresh KPI cards and metrics as operational work happens without manual page reload"
    - "Incoming WebSocket event updates are debounced by 300ms to collapse bursts into a single atomic refresh"
    - "Background metric hydration is silent (existing values remain visible without destructive full-page spinner flashes)"
    - "Socket events invalidate the client GET cache to guarantee that fresh live database aggregations are fetched immediately"
    - "All unit tests pass and verify the real-time analytics update workflow"
  artifacts:
    - client/src/pages/admin/AnalyticsPage.tsx
    - client/src/pages/admin/AdminControlCenterPage.tsx
    - client/src/pages/admin/__tests__/AnalyticsPageRealtime.test.tsx
  key_links:
    - "WebSocket subscriptions mounted via mountRealtimeSocket and useRealtimeCatchup"
---

<objective>
Enable real-time automatic updates for all analytics and KPI values across the operational platform as work progresses (deliveries completed, routes dispatched, stops updated, vehicle statuses changed).

Purpose: Ensure dispatchers, fleet managers, and administrators see live, accurate KPI and analytics metrics reflecting active field operations in real time without having to manually refresh or reload the page.
Output: Real-time socket integration in AnalyticsPage and AdminControlCenterPage, debounced burst handling, silent background hydration, cache eviction, and automated unit tests.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/pages/admin/AnalyticsPage.tsx
@client/src/pages/admin/AdminControlCenterPage.tsx
@client/src/utils/socketClient.ts
@client/src/api/client.ts
@client/src/hooks/useRealtimeCatchup.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Real-Time WebSocket Integration, Debounce & Silent Background Hydration in AnalyticsPage</name>
  <files>client/src/pages/admin/AnalyticsPage.tsx</files>
  <action>
    1. In client/src/pages/admin/AnalyticsPage.tsx, import `mountRealtimeSocket` from `../../utils/socketClient`, `useRealtimeCatchup` from `../../hooks/useRealtimeCatchup`, and `clearInFlightCache` from `../../api/client`.
    2. Add `isRefreshing` state distinct from `isLoading` (initial mount only). During subsequent background updates triggered by socket events, keep `isLoading` false so charts and KPI cards do not disappear behind a full-screen loading spinner.
    3. Wire `useRealtimeCatchup(fetchData)` to automatically catch up across tab switches, screen wake, or socket reconnects.
    4. In `useEffect`, mount the real-time socket using `mountRealtimeSocket(token, (socket) => { ... })` and listen to operational events:
       - `delivery:updated`, `deliveries:updated`, `delivery:created`, `delivery:deleted`
       - `route:progress`, `route:dispatched`, `route:updated`, `route:cancelled`
       - `batch:created`, `batch:updated`, `batch:deleted`
       - `fleet:vehicle_updated`, `vehicle:updated`, `driver:updated`
       - `demo:seeded`, `demo:deleted`, `system:purged`
    5. Implement a 300ms debounce timer for the socket event handler:
       - Clear previous timer on new burst events.
       - Clear in-flight and cached responses with `clearInFlightCache()` right before fetching to bypass the 3-second GET cache.
       - Execute `fetchData({ silent: true })`.
    6. Add a subtle pulsing green dot next to the "Analytics" title indicating "Live Sync Active".
  </action>
  <verify>
    <automated>npm run test --workspace=client</automated>
  </verify>
  <done>
    AnalyticsPage connects to WebSocket, listens for operational events with 300ms debounce, clears client cache, and performs silent background hydration without full-page spinner.
  </done>
</task>

<task type="auto">
  <name>Task 2: Real-Time Debounce & In-Flight Cache Invalidation in AdminControlCenterPage</name>
  <files>client/src/pages/admin/AdminControlCenterPage.tsx</files>
  <action>
    1. In client/src/pages/admin/AdminControlCenterPage.tsx, import `clearInFlightCache` from `../../api/client`.
    2. In the `mountRealtimeSocket` callback:
       - Wrap `fetchData` in a 300ms debounce using a timer ref so rapid stop transitions collapse into a single request.
       - Before invoking `fetchData()`, call `clearInFlightCache()` so that `AdminApi.getOverview()` and `AdminApi.getAnalytics()` fetch fresh server aggregations immediately instead of returning cached data from up to 3000ms ago.
       - Add missing events `deliveries:updated`, `vehicle:updated`, and `driver:updated` to the listener and cleanup lists.
  </action>
  <verify>
    <automated>npm run test --workspace=client</automated>
  </verify>
  <done>
    AdminControlCenterPage debounces live socket events by 300ms and evicts client-side GET cache so fresh KPI metrics are reflected immediately.
  </done>
</task>

<task type="auto">
  <name>Task 3: Unit Testing & Verification of Real-Time Analytics & KPI Updates</name>
  <files>client/src/pages/admin/__tests__/AnalyticsPageRealtime.test.tsx</files>
  <action>
    1. Author comprehensive unit test suite in `client/src/pages/admin/__tests__/AnalyticsPageRealtime.test.tsx`:
       - Verify initial mount fetches analytics and delivery data.
       - Verify real-time socket subscription to operational events (`delivery:updated`, `route:progress`, etc.).
       - Verify incoming socket events trigger debounced data re-fetching and update displayed KPIs.
       - Verify burst events (e.g. 5 events within 100ms) collapse into a single debounced fetch call.
       - Verify silent background hydration preserves rendered metric cards during updates.
    2. Run unit tests, type checking, and production build.
  </action>
  <verify>
    <automated>npm run test:unit --workspace=client -- src/pages/admin/__tests__/AnalyticsPageRealtime.test.tsx</automated>
  </verify>
  <done>
    All real-time analytics unit tests pass green, type checking passes with 0 errors, and production build succeeds.
  </done>
</task>

</tasks>
