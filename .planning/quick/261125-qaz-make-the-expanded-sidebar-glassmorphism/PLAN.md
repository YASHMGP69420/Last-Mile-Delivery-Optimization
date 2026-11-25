---
phase: quick
plan: 261125-qaz-make-the-expanded-sidebar-glassmorphism
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
    - "When expanded on hover or focus, the operations sidebar exhibits genuine translucent glassmorphism with high-blur diffusion (blur(24px)), specular highlights, and layered elevation shadows"
    - "Dark mode features deep obsidian frosted glass with translucent background (alpha ~0.72) and specular white/12 rim highlight"
    - "Light mode features clean frosted glass (alpha ~0.75) with inner specular bevel and soft ambient shadow"
    - "Expanded navigation items feature frosted glass hover highlights and luminous emerald active states without contrast degradation"
    - "Retracted state remains compact, clean, and seamlessly matches the dashboard design system"
    - "All unit tests pass and verify the glassmorphism classes and behaviors"
  artifacts:
    - client/src/index.css
    - client/src/components/layout/AdminSidebar.tsx
    - client/src/components/layout/__tests__/AdminSidebar.test.tsx
  key_links:
    - "AdminSidebar used in AdminLayout across all administrative views"
---

<objective>
Transform the expanded operations buttons sidebar into a premium glassmorphic floating panel with frosted blur, specular highlights, layered shadows, and high contrast.

Purpose: Provide a modern glassmorphism aesthetic on hover that reveals the blurred operational map/data behind it while keeping text and icons crisply legible.
Output: Updated CSS classes, AdminSidebar component, and verified test suite.
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
<task id="1" name="Add glass-panel-expanded CSS in index.css">
In `client/src/index.css`, define `.glass-panel-expanded`:
- Backdrop filter: `blur(24px) saturate(180%)`
- Background: `rgba(255, 255, 255, 0.75)` in light, `rgba(15, 20, 31, 0.72)` in dark
- Border: `1px solid rgba(255, 255, 255, 0.5)` in light, `1px solid rgba(255, 255, 255, 0.12)` in dark
- Layered shadow with specular top rim:
  - Light: `0 25px 50px -12px rgba(15, 23, 42, 0.15), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)`
  - Dark: `0 25px 50px -12px rgba(0, 0, 0, 0.75), inset 0 1px 0 0 rgba(255, 255, 255, 0.14)`
- Compositor layer promotion: `transform: translateZ(0); will-change: transform;`
</task>

<task id="2" name="Apply glassmorphism to expanded AdminSidebar">
In `client/src/components/layout/AdminSidebar.tsx`:
1. Use `.glass-panel-expanded` when `isExpanded` is true (or when hovered via CSS).
2. Refine item hover backgrounds to frosted `hover:bg-black/5 dark:hover:bg-white/10`.
3. Refine active items with subtle emerald glow `shadow-[0_2px_12px_rgba(16,185,129,0.25)]`.
4. Refine dividers to translucent lines `dark:bg-white/10 bg-outline-variant/60`.
</task>

<task id="3" name="Update unit tests and verify">
Update `client/src/components/layout/__tests__/AdminSidebar.test.tsx` to assert `.glass-panel-expanded` or glassmorphic classes on hover.
Run `npm run test --workspace=client` and `npm run test:unit --workspace=client`.
</task>
</tasks>
