---
phase: quick
plan: 261125-qo6-only-make-the-backgorund-behind-the-expa
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/index.css
  - client/src/components/layout/AdminSidebar.tsx
  - client/src/components/layout/__tests__/AdminSidebar.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Only the area behind the expanded sidebar section exhibits the frosted glass blur effect (no full-screen fixed inset-0 scrim)"
    - "The application background to the right of the expanded sidebar remains sharp, unblurred, and completely interactive"
    - "The expanded sidebar surface applies backdrop-filter: blur(20px) with balanced frosted glass opacity (alpha 0.78-0.80 in light, 0.80-0.82 in dark) diffusing background elements into soft frosted color washes"
    - "Removing z-40 from the 60px wrapper div and moving z-40 to the sidebar itself prevents Chromium from bounding the stacking context layer to 60px"
    - "Removing overflow-hidden from aside prevents Chromium backdrop-filter clipping bug"
    - "All unit tests pass and verify that only the sidebar has the blur and no full-screen scrim exists"
  artifacts:
    - client/src/index.css
    - client/src/components/layout/AdminSidebar.tsx
    - client/src/components/layout/__tests__/AdminSidebar.test.tsx
  key_links:
    - "AdminSidebar used by AdminLayout across all /admin routes"
---

<objective>
Restrict the frosted glass background blur effect strictly to the area behind the expanded sidebar section, eliminating the full-screen backdrop scrim so the rest of the application remains unblurred.

Purpose: Honor the user's explicit directive to only blur the background directly behind the expanded section, ensuring the rest of the workspace remains clear while underlying content behind the sidebar is beautifully diffused.
Output: Updated index.css, AdminSidebar component without full-screen scrim, and verified test suite.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/index.css
@client/src/components/layout/AdminSidebar.tsx
@client/src/components/layout/__tests__/AdminSidebar.test.tsx
</context>

<tasks>
<task id="1" name="Remove full-screen scrim and fix stacking context in AdminSidebar">
In `client/src/components/layout/AdminSidebar.tsx`:
1. Remove the full-viewport `<div data-testid="sidebar-backdrop" ... />` fixed scrim.
2. Remove `z-40` from the outer wrapper `<div className="relative w-[60px] h-full shrink-0">` so it does not establish a 60px-confined stacking context in Chromium.
3. Apply `z-40` directly to `<aside>` so it participates in the layout's root stacking context and can sample the main content viewport behind its full 240px width.
4. Remove `overflow-hidden` from `<aside>` (leaving it on inner scroll/span containers) to prevent Chromium backdrop-filter clipping.
</task>

<task id="2" name="Calibrate glass-panel-expanded opacity and blur in index.css">
In `client/src/index.css`:
1. Set `.glass-panel-expanded` background to `rgba(255, 255, 255, 0.78)` in light mode and `rgba(15, 20, 31, 0.80)` in dark mode.
2. Ensure `backdrop-filter: blur(20px) saturate(180%)` and `-webkit-backdrop-filter: blur(20px) saturate(180%)`.
3. Retain specular highlight bevel and layered soft drop shadow.
</task>

<task id="3" name="Update unit tests and verify">
In `client/src/components/layout/__tests__/AdminSidebar.test.tsx`:
1. Remove tests looking for full-screen `sidebar-backdrop`.
2. Verify that `<aside>` expands with `glass-panel-expanded` and `w-60`.
3. Verify that no full-screen backdrop overlay exists in the DOM.
4. Run `npm run test --workspace=client` and `npm run test:unit --workspace=client`.
</task>
</tasks>
