---
phase: quick
plan: 261125-q3z-make-the-operations-buttons-side-bar-exp
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/layout/AdminSidebar.tsx
  - client/src/components/layout/__tests__/AdminSidebar.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Admin sidebar starts in a compact 60px dock showing centered icon buttons"
    - "Hovering cursor over the operations sidebar expands it smoothly to 240px displaying the icon names next to each icon"
    - "Moving cursor away from the sidebar retracts it smoothly back to the compact 60px dock"
    - "Sidebar uses a non-shifting layout container with absolute floating expansion and elevation shadow so map views and tables do not undergo reflow or layout shift"
    - "Tooltips are suppressed while expanded to prevent overlapping popup duplicate text"
    - "Comprehensive unit tests verify hover-expansion, label visibility, retract on leave, and accessible attributes"
  artifacts:
    - client/src/components/layout/AdminSidebar.tsx
    - client/src/components/layout/__tests__/AdminSidebar.test.tsx
  key_links:
    - "AdminSidebar used by AdminLayout across all /admin routes"
---

<objective>
Make the operations buttons sidebar expand smoothly with icon labels on hover and retract back to the compact dock when the cursor moves away.

Purpose: Improve usability and discoverability for operations managers by providing instant label clarification without forcing clicks, while maintaining zero layout shift for data tables and Leaflet maps.
Output: Updated AdminSidebar component with smooth CSS/state hover expansion and dedicated unit test suite.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/components/layout/AdminSidebar.tsx
@client/src/components/layout/AdminLayout.tsx
</context>

<tasks>
<task id="1" name="Implement hover-expand in AdminSidebar">
Update `client/src/components/layout/AdminSidebar.tsx`:
1. Wrap `<aside>` in a fixed-dimension anchor container `w-[60px] h-full shrink-0 relative z-40` to prevent layout shift.
2. Structure `<aside>` as `absolute top-0 left-0 h-full flex flex-col py-3 px-2.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` expanding from `w-[60px]` to `w-60` on hover.
3. Manage hover and focus state (`isExpanded`) via `onMouseEnter`/`onMouseLeave` and `onFocus`/`onBlur` with `aria-expanded={isExpanded}`.
4. Update `renderIconLink` and sign-out buttons so icons stay aligned left (`w-5 h-5 shrink-0`) and label text smoothly expands with `opacity` and `max-w` transitions.
5. Hide floating tooltips when expanded to prevent duplicate text popups.
6. Expand section dividers from `w-7` to `w-full` when expanded.
</task>

<task id="2" name="Add unit tests for AdminSidebar hover-expand">
Create `client/src/components/layout/__tests__/AdminSidebar.test.tsx`:
1. Test initial rendering in collapsed dock state (width classes, icons present).
2. Test mouse hover (`fireEvent.mouseEnter`) triggers expanded state, exposing icon labels.
3. Test mouse leave (`fireEvent.mouseLeave`) returns sidebar to retracted state.
4. Test keyboard focus expands the sidebar.
</task>

<task id="3" name="Verify TypeScript and Test Suite">
Run `npm run test --workspace=client` (tsc --noEmit) and `npm run test:unit --workspace=client`.
Ensure all tests pass cleanly.
</task>
</tasks>
