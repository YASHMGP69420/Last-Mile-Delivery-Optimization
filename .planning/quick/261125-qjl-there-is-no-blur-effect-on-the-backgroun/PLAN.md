---
phase: quick
plan: 261125-qjl-there-is-no-blur-effect-on-the-backgroun
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
    - "When the operations sidebar is expanded, a smooth background blur scrim overlay renders over the application background"
    - "The expanded sidebar surface has high-density frosted glass opacity (alpha 0.94-0.95) so background text underneath does not bleed through"
    - "The expanded sidebar preserves genuine glassmorphic qualities (backdrop-filter: blur(24px), specular highlight rim, layered elevation shadow)"
    - "Removing position: relative and compositor transforms from .glass-panel-expanded prevents Chromium backdrop-filter isolation bugs"
    - "Retracting the sidebar smoothly fades out the background blur overlay without blocking clicks or interactions"
    - "All unit tests pass and verify the blur backdrop overlay and glass styling"
  artifacts:
    - client/src/index.css
    - client/src/components/layout/AdminSidebar.tsx
    - client/src/components/layout/__tests__/AdminSidebar.test.tsx
  key_links:
    - "AdminSidebar used by AdminLayout across all /admin routes"
---

<objective>
Fix the background blur effect and eliminate background text bleed-through when the operations sidebar expands.

Purpose: Resolve Chromium backdrop-filter isolation by introducing an active background blur scrim overlay across the page and opacifying the expanded glassmorphic sidebar surface to 94-95% opacity with specular rim highlights, ensuring background text never shows through.
Output: Updated index.css, AdminSidebar component with background blur overlay, and passing unit tests.
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
<task id="1" name="Update .glass-panel-expanded in index.css">
In `client/src/index.css`:
1. Remove `position: relative;` from `.glass-panel-expanded` so it does not override `position: absolute;` on `<aside>`.
2. Remove `transform: translateZ(0); will-change: transform;` which breaks `backdrop-filter` in Chromium on Windows.
3. Increase background opacity to `rgba(255, 255, 255, 0.94)` in light mode and `rgba(15, 20, 31, 0.95)` in dark mode to prevent underlying text from showing through.
4. Maintain `backdrop-filter: blur(24px) saturate(180%)`, specular highlight bevel, and deep elevation shadows.
</task>

<task id="2" name="Add background blur scrim overlay in AdminSidebar.tsx">
In `client/src/components/layout/AdminSidebar.tsx`:
1. Add a background blur scrim overlay `<div aria-hidden="true" data-testid="sidebar-backdrop" ... />` fixed across the viewport:
   - When `isExpanded`: `opacity-100 backdrop-blur-sm bg-black/15 dark:bg-black/35 pointer-events-none`
   - When not expanded: `opacity-0 pointer-events-none`
2. Ensure `<aside>` floats at `z-50` with `absolute top-0 left-0 h-full`.
</task>

<task id="3" name="Update unit tests and verify">
In `client/src/components/layout/__tests__/AdminSidebar.test.tsx`:
1. Verify `sidebar-backdrop` exists and becomes active (`opacity-100`, `backdrop-blur-sm`) when sidebar expands.
2. Verify sidebar has `glass-panel-expanded` class and blocks background text bleed.
3. Run `npm run test --workspace=client` and `npm run test:unit --workspace=client`.
</task>
</tasks>
