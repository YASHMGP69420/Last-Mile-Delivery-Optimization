# Phase 24: Driver Handheld Real-Time State Debounce & Seamless Background Hydration — Research

## Problem Definition
Drivers using the mobile handheld interface (`DriverCockpitPage.tsx`, `DriverRoutePage.tsx`, `DriverDeliveriesPage.tsx`) experience continuous unprompted page reloads, visual card flashing, reset animations, and redundant network/socket bursts.

## Root Cause Analysis
Codebase analysis identified 4 interlocking feedback loops causing this behavior:

### 1. Socket Event Burst Storm without Debouncing (`DriverSocketContext.tsx`)
Backend `socketService.js` emits up to 4 socket events nearly simultaneously during any delivery status or stop change:
- `delivery:updated`
- `delivery:status_changed`
- `route:updated`
- `driver:stop_progressed`

In `DriverSocketContext.tsx`:
```typescript
const handleDeliveryUpdated = (payload: any) => {
  if (!belongsToThisDriver(payload)) return;
  triggerRefresh();
};
// Similarly for handleStopProgressed and handleDeliveryStatusChanged
```
Each handler immediately calls `triggerRefresh()`, which runs `setRefreshKey(prev => prev + 1)`. When 4 events arrive within 5ms of each other, `refreshKey` increments 4 times in rapid succession, firing 4 independent component re-fetch cascades across all mounted pages.

### 2. Aggressive `setIsLoading(true)` Toggling GSAP Motion Resets
In `DriverCockpitPage.tsx`:
```typescript
const cockpitRef = useRef<HTMLDivElement>(null);
useStaggerEntrance(cockpitRef, '.gsap-cockpit-card', [isLoading]);

const refreshAll = useCallback(async () => {
  setIsLoading(true);
  await Promise.all([fetchDashboard(), fetchRoute()]);
  setIsLoading(false);
}, [fetchDashboard, fetchRoute]);
```
`useStaggerEntrance` watches `isLoading`. Whenever a background refresh occurs (e.g. from `refreshKey` increment or window focus), `setIsLoading(true)` temporarily hides or unmounts the cards and resets GSAP timeline animations. When data returns, `setIsLoading(false)` causes the cards to violently re-animate into view, producing an apparent "reload" or "flicker" loop.
The same pattern exists in:
- `DriverRoutePage.tsx`: `useStaggerEntrance(hudRef, '.gsap-route-hud', [isLoading, Boolean(route)])` with `setIsLoading(true)` in `fetchRoute`.
- `DriverDeliveriesPage.tsx`: `useStaggerEntrance(listRef, '.gsap-manifest-card', [isLoading, activeTab])` with `setIsLoading(true)` in `fetchDeliveries`.

### 3. Duplicate Window Event Listeners (`visibilitychange` & `focus`)
- In `DriverSocketContext.tsx`, `useRealtimeCatchup(refreshIdentityAndTelemetry)` is registered at line 173.
- In addition, an ad-hoc `useEffect` (lines 470–490) manually attaches `visibilitychange` and `focus` event listeners calling `refreshIdentityAndTelemetry()`.
- In `DriverCockpitPage.tsx`, another `useRealtimeCatchup(refreshAll, { debounceMs: 400 })` is registered at line 88.
- In `DriverRoutePage.tsx`, an ad-hoc `useEffect` (lines 69–90) manually registers `visibilitychange` and `focus` calling `fetchRoute()`.
When a driver wakes their phone screen or switches tabs, 4 separate listeners fire concurrently. Furthermore, `refreshIdentityAndTelemetry` calls `triggerRefresh()`, which triggers `refreshKey` changes, firing the page hooks again in a feedback loop.

### 4. Duplicate Initial Mount Invocations in `DriverCockpitPage.tsx`
`DriverCockpitPage.tsx` contains two separate initial mount effects:
- Line 76: `useEffect(() => { refreshAll(); }, [refreshAll]);`
- Line 83: `useEffect(() => { refreshAll(); }, [refreshKey, refreshAll]);`
On component mount, both effects run simultaneously, issuing two redundant pairs of API requests (`getDashboard` and `getActiveRoute`).

---

## Technical Architecture & Implementation Strategy

### 1. Atomic Debounce for `triggerRefresh` in `DriverSocketContext.tsx`
Introduce a ref-based debounce timer (300ms window) in `triggerRefresh`:
```typescript
const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

const triggerRefresh = useCallback(() => {
  if (refreshTimerRef.current) {
    clearTimeout(refreshTimerRef.current);
  }
  refreshTimerRef.current = setTimeout(() => {
    setRefreshKey((prev) => prev + 1);
  }, 300);
}, []);
```
When burst socket events arrive within 300ms, they collapse into a single state update.

### 2. Deduplicate Lifecycle Catchup Listeners
- Remove the redundant manual `useEffect` (lines 470–490) in `DriverSocketContext.tsx`. The existing `useRealtimeCatchup(refreshIdentityAndTelemetry, { debounceMs: 500 })` handles window visibility and focus cleanly.
- In `DriverRoutePage.tsx`, replace the manual window listeners (lines 69–90) with `useRealtimeCatchup(fetchRoute, { debounceMs: 500 })`.

### 3. Silent Background Hydration (Preserving GSAP State)
Introduce a `silent` boolean parameter or conditional check in fetch functions:
- In `DriverCockpitPage.tsx`:
  - `refreshAll(silent = false)`: Only call `setIsLoading(true)` if `!dashboardData && !routeData`.
  - In background refreshes triggered by `refreshKey` or `useRealtimeCatchup`, pass `silent = true`.
  - Remove the duplicate initial `useEffect` (lines 76–78), leaving only the `refreshKey` / initial load effect.
- In `DriverRoutePage.tsx`:
  - `fetchRoute(silent = false)`: Only call `setIsLoading(true)` if `!route`.
  - Background refreshes from `refreshKey` and catchup pass `silent = true`.
- In `DriverDeliveriesPage.tsx`:
  - `fetchDeliveries(silent = false)`: Only call `setIsLoading(true)` if `deliveries.length === 0`.
  - Background refreshes pass `silent = true`.

---

## Verification Plan
1. **Unit Tests**:
   - Add unit test in `DriverSocketContext.test.tsx` verifying that multiple rapid calls to `triggerRefresh()` only increment `refreshKey` once after 300ms.
   - Verify `DriverCockpitPage` does not toggle `isLoading` to true when data is already populated.
   - Run Vitest: `npm --prefix client run test:unit`.
2. **Build Validation**:
   - Run `npm --prefix client run build` to ensure TypeScript compilation and asset bundling succeed with zero errors.
