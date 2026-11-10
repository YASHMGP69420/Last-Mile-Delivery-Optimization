# Phase 06 Execution Plan: Control Center Dark Mode Unification & Sidebar Spacing Polish

**Milestone:** 3 — Dark Mode Unification & Layout Chrome Polish  
**Spec:** [06-UI-SPEC.md](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.planning/phases/06-dark-mode-unification-and-sidebar-polish/06-UI-SPEC.md)

---

## Wave 1: Root CSS Variable Alpha-Channel Fix & Global Dark Mode Obsidian Tokens

**Objective:** Eliminate the Tailwind v3 CSS-var opacity bug causing white border/divider streaks across the app, align all dark mode tokens with Control Center's obsidian palette, and enable `color-scheme: dark` + base border defaults.

### Tasks

1. **Convert Semantic CSS Tokens to RGB Channels in `client/src/index.css`**
   - Add `--color-*-rgb` variables for both `[data-theme="light"]` and `.dark, [data-theme="dark"]` matching Control Center's exact hex colors (`#0b1324`, `#111a2f`, `#0e172c`, `#131e36`, `#182542`, `#1f2f52`, `#1e2c47`, `#2c416e`, `#10b981`, `#F8FAFC`, `#94A3B8`, `#64748B`), while retaining the existing hex vars for raw CSS consumers.
   - Add `@layer base` rule:
     - `*, ::before, ::after { border-color: rgb(var(--color-outline-variant-rgb) / 1); }`
     - `.dark { color-scheme: dark; }`
   - Refine `.dark` `--border-glass` to subtle slate (`rgba(148, 163, 184, 0.14)`) and add `.no-scrollbar` utility class for compact sidebar scrolling.

2. **Bind `<alpha-value>` RGB Tokens in `client/tailwind.config.js`**
   - Update `emerald`, `primary`, `surface.*`, `on-surface.*`, and `outline.*` in `theme.extend.colors` to `'rgb(var(--color-*-rgb) / <alpha-value>)'` so all `/10`, `/25`, `/40`, `/50`, `/60`, `/70`, `/80` opacity modifiers emit valid CSS `rgb(... / alpha)` rules instead of dropping `border-color` to `currentColor` (`#F8FAFC` white).

---

## Wave 2: Hardcoded Light-Surface Audit & Sidebar/Chrome Spacing Polish

**Objective:** Fix dark-mode checkboxes, hardcoded light-only pills (`StatusBadge`, `DriverCockpitPage`, `DriverDeliveriesPage`, `OptimizationControlPanel`, `ManifestTable`, `AdminHeader`, `Button`), and apply the uniform `AdminSidebar` spacing & responsive fit contract.

### Tasks

1. **Fix `client/src/components/layout/AdminSidebar.tsx` Uniform Spacing & Fit**
   - Unify horizontal padding (`px-2`), uniform `w-10 h-10` rounded-xl buttons centered cleanly, uniform `gap-2` (`8px`) across primary, operations, and bottom utility icon groups, symmetric `my-2.5` / `pt-2.5` divider spacing, and wrap top/mid nav groups in `flex-1 min-h-0 overflow-y-auto no-scrollbar` so icons fit cleanly on any viewport height.
   - Fix tooltip positioning (`left-14`) and `shrink-0` sizing.

2. **Dark-Mode Checkbox & Component Polish**
   - **`ManifestTable.tsx` & `Table.tsx`**: Style checkboxes cleanly (`accent-emerald-500 bg-surface-lowest dark:bg-obsidian-800 border-outline-variant`), ensure table headers/footers/dividers inherit clean obsidian tones (`bg-surface-low`, `divide-outline-variant/60` now resolving to `rgb(30 44 71 / 0.6)`!).
   - **`StatusBadge.tsx`, `OptimizationControlPanel.tsx`, `DriverCockpitPage.tsx`, `DriverDeliveriesPage.tsx`**: Add dark obsidian equivalents to remaining `bg-slate-100` / `bg-gray-100` / `border-slate-200` pills (`dark:bg-obsidian-800 dark:text-slate-300 dark:border-obsidian-700`).
   - **`Button.tsx` & `Input.tsx`**: Verify `outline` button and `Input` rings/borders inherit dark obsidian surfaces cleanly (`dark:focus:ring-offset-obsidian-900` on `Button.tsx` so focus rings don't halo white in dark mode!).

---

## Wave 3: Verification, Visual CSS Inspection & Push

1. Run `npm --prefix client test` (`tsc --noEmit`) and `npm --prefix client run build`.
2. Inspect built CSS (`client/dist/assets/*.css`) to confirm `.divide-outline-variant\/60`, `.border-outline-variant\/60`, and `.border-outline-variant\/80` now compile to valid `rgb(var(--color-outline-variant-rgb) / ...)` instead of being dropped!
3. Run `npm --prefix server test` (regression guard), write `06-VERIFICATION.md`, update `ROADMAP.md` & `STATE.md`, and push directly to `origin/master`.
