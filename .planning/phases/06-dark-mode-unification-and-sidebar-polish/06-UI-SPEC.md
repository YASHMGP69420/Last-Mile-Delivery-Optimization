# Phase 06 UI Design Contract (`UI-SPEC.md`)

**Phase:** 06 — Control Center Dark Mode Unification & Uniform Sidebar Spacing  
**Date:** 2026-11-10  
**Status:** Verified UI Contract Ready for Execution

---

## 1. Visual Diagnosis (Root Causes Verified in Code & Screenshots)

### A. "White Streaks" Across Dark Mode (`media_1794325473432_cf1d4430.png`)
1. **CSS Variable Alpha-Value Bug in Tailwind v3 (`client/tailwind.config.js` & `client/src/index.css`)**:
   - Currently `tailwind.config.js` binds semantic tokens (`surface`, `on-surface`, `outline`, `primary`, `emerald`) directly to raw hex CSS variables (e.g. `'var(--color-outline-variant, #C5C6CD)'`).
   - Whenever any component applies an opacity modifier (`border-outline-variant/60`, `divide-outline-variant/60`, `border-outline-variant/80`, `bg-surface-low/80`, `ring-primary/25`, `placeholder:text-on-surface-variant/50` — across 35+ files), Tailwind v3 skips emitting `border-color` / `background-color` cleanly or falls back to `border-color: currentColor` (`#F8FAFC` pure white in `.dark`).
   - Meanwhile `AdminControlCenterPage` avoids this only because its dashboard cards manually pair `dark:border-obsidian-750` / `dark:bg-obsidian-900` alongside those broken opacity classes.
   - Result on `ManifestTable.tsx`, `DeliveriesPage.tsx`, `Input.tsx`, `Button.tsx`, `DriverHeader.tsx`, `DriverBottomNav.tsx`, and other views: `divide-y` and `border` inherit `#F8FAFC`, rendering harsh white horizontal streaks and white outlines in dark mode.
2. **Missing Dark Color Scheme & Base Border Default**:
   - `.dark` in `client/src/index.css` does not declare `color-scheme: dark`, causing native `<input type="checkbox">` squares in `ManifestTable.tsx` (lines 114 & 186) and native form controls to render stark white.
   - `@layer base` does not reset default `*, ::before, ::after { border-color: ... }`, allowing bare `border` / `border-b` / `divide-y` utilities to default to `currentColor` (`#F8FAFC`).
3. **Hardcoded Light-Mode Fallbacks Missing `dark:` Variants**:
   - `StatusBadge.tsx` (fallback badge), `OptimizationControlPanel.tsx` (`bg-slate-100 border-slate-200`), `DriverCockpitPage.tsx`, `DriverDeliveriesPage.tsx` still contain light-only `bg-slate-100` / `border-slate-200` pills without `dark:` obsidian pairs.

### B. Sidebar Spacing & Vertical Fit (`media_1794325478469_749e4248.png`)
1. **`AdminSidebar.tsx` Asymmetric Padding & Uneven Gaps**:
   - Top section wrapper uses `px-1.5` (line 76) while bottom footer wrapper uses `px-2` (line 91).
   - Outer top flex wrapper applies `space-y-2` (`8px`) around `<div className="w-8 h-[1px] my-0.5" />` (`2px`), whereas inner icon lists apply `space-y-1.5` (`6px`). This produces an inconsistent `~18px` gap between `Dispatch Batches` and `Route Optimizer` compared to `6px` between sibling icons.
   - Top and bottom groups rely on `justify-between` without `overflow-y-auto`, creating an excessive blank gap in the center on tall screens while risking crowding on shorter laptop viewports (`< 720px` height).
   - `bg-outline-variant/60` on the middle divider & `border-outline-variant/60` on the bottom divider also suffer from the CSS-var opacity bug.

---

## 2. Control Center Canonical Dark Palette Contract

All dark-mode surfaces, borders, dividers, text, and focus rings MUST derive from **Control Center's Obsidian Palette** across the entire application (Admin, Fleet Operations, Driver Handheld, Auth):

| Token Role | Light Hex (`[data-theme="light"]`) | Dark Obsidian Hex (`.dark`) | Dark RGB Channel (`--*-rgb`) | Usage |
| --- | --- | --- | --- | --- |
| `surface` / `surface-canvas` | `#F8FAFC` / `#F1F5F9` | `#0b1324` (`obsidian-900`) | `11 19 36` | App shell background |
| `surface-lowest` | `#FFFFFF` | `#111a2f` | `17 26 47` | Primary cards, tables, modals, inputs |
| `surface-low` | `#F8FAFC` | `#0e172c` (`obsidian-850`) | `14 23 44` | Table headers, footers, secondary pills |
| `surface-container` | `#E2E8F0` | `#131e36` (`obsidian-800`) | `19 30 54` | Hover fills, segmented containers |
| `surface-high` | `#CBD5E1` | `#182542` (`obsidian-750`) | `24 37 66` | Elevated states, active list rows |
| `surface-highest` | `#94A3B8` | `#1f2f52` (`obsidian-700`) | `31 47 82` | Strongest container hover/highlights |
| `on-surface` | `#0F172A` | `#F8FAFC` | `248 250 252` | Primary headings & data cells |
| `on-surface-variant` | `#475569` | `#94A3B8` | `148 163 184` | Labels, metadata, table subtext |
| `on-surface-muted` | `#64748B` | `#64748B` | `100 116 139` | Captions, placeholders |
| `outline` | `#CBD5E1` | `#2c416e` (`obsidian-600`) | `44 65 110` | Interactive borders on hover/focus |
| `outline-variant` | `#E2E8F0` | `#1e2c47` | `30 44 71` | Card borders, table row dividers (`divide-*`), hairlines |
| `outline-subtle` | `#F1F5F9` | `#182542` | `24 37 66` | Faint row hairlines & nested dividers |
| `primary` / `emerald` | `#059669` | `#10b981` | `16 185 129` | Active nav, primary CTA, emerald highlights |
| `primary-hover` | `#047857` | `#059669` | `5 150 105` | Primary CTA hover |

### Tailwind Alpha-Value Contract (`client/tailwind.config.js` + `client/src/index.css`)
- Define space-separated RGB channel variables `--color-<name>-rgb` alongside existing hex variables in `index.css`.
- Map Tailwind `colors` in `tailwind.config.js` via `'rgb(var(--color-<name>-rgb) / <alpha-value>)'` for `primary`, `emerald`, `surface.*`, `on-surface.*`, and `outline.*` so **every `/opacity` utility (`border-outline-variant/60`, `divide-outline-variant/60`, `bg-surface-low/80`, `bg-primary/10`) resolves accurately** in both Light and Dark mode.
- Set `@layer base` defaults:
  - `*, ::before, ::after { border-color: rgb(var(--color-outline-variant-rgb) / 1); }`
  - `.dark { color-scheme: dark; }`
  - Custom styled checkbox rule or `accent-emerald-500` in dark mode so table checkboxes never flash bright white squares.

---

## 3. Sidebar & Chrome Uniformity Contract

### `AdminSidebar.tsx` Geometry & Spacing Spec
- **Outer Container**: `w-[60px] shrink-0 h-full flex flex-col items-center py-3 px-2 rounded-xl glass-surface select-none z-30` (exact symmetric `8px` horizontal padding `px-2` everywhere).
- **Navigation Scroll Region**: `flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-center`
  - **Primary Group (`primaryNav`)**: `flex flex-col items-center gap-2 w-full` (exact uniform `8px` vertical rhythm)
  - **Mid-Section Divider**: `w-7 h-px bg-outline-variant shrink-0 my-2.5` (exact `10px` top/bottom breathing clearance, `1px` crisp obsidian/slate line)
  - **Operations Group (`operationsNav`)**: `flex flex-col items-center gap-2 w-full` (`8px` vertical rhythm matching `primaryNav`)
- **Bottom Utility Footer (`secondaryNav` + `Sign Out`)**:
  - `w-full shrink-0 pt-2.5 mt-2 border-t border-outline-variant flex flex-col items-center gap-2` (matches the exact `8px` internal spacing & symmetrical `10px` top clearance of the mid divider!)
- **Icon Hit Targets**: `w-10 h-10` (`40px × 40px`) centered (`mx-auto`), `rounded-xl`, icons `w-[18px] h-[18px]` (`stroke-[1.9]`), tooltip anchored cleanly at `left-14` (`56px`).
- **Scrollbar Hiding**: Add `.no-scrollbar::-webkit-scrollbar { display: none; }` + `scrollbar-width: none` in `index.css` so compact laptop screens scroll smoothly without introducing a scrollbar track inside the `60px` dock.

### Header & Bottom Nav Consistency
- **`AdminHeader.tsx`**, **`DriverHeader.tsx`**, **`DriverBottomNav.tsx`**:
  - Replace broken opacity border rules naturally via the fixed RGB token system (`border-outline-variant/60` -> `#1e2c47` @ 60% in dark mode).
  - Verify balanced vertical alignment and `shrink-0` across desktop and mobile viewports.

---

## 4. Acceptance Criteria
1. **Zero White Streaks in Dark Mode**: Tables (`ManifestTable.tsx`, `Table.tsx`, `AuditLogsPage.tsx`, `BatchesPage.tsx`), inputs (`Input.tsx`), buttons (`Button.tsx`), cards, modals, and checkboxes across every Admin, Fleet, Driver, and Auth screen render seamlessly on Control Center's obsidian (`#0b1324` / `#111a2f` / `#1e2c47`) dark theme.
2. **Uniform & Responsive Sidebar**: `AdminSidebar.tsx` has symmetric padding (`px-2`), uniform `8px` (`gap-2`) icon spacing across all groups, clean `10px` (`my-2.5` / `pt-2.5`) divider clearance, `40px × 40px` centered hit targets, and fits cleanly without clipping on both short (`640px`) and tall (`1080px+`) viewport heights.
3. **Light Mode Intact**: All light-mode surfaces (`#F8FAFC` / `#FFFFFF` / `#E2E8F0`) retain crisp contrast and opacity modifiers.
4. **Build Verification**: `npm --prefix client test` (`tsc --noEmit`) and `npm --prefix client run build` pass with zero errors.
