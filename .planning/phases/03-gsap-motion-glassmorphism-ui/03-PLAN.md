---
phase: 03
slug: gsap-motion-glassmorphism-ui
title: "GSAP Motion, Subtle Glassmorphism & Page Transitions UI"
status: planned
date: 2026-11-10
requirements:
  - UI-GLS-01: Subtle glassmorphism tokens and surfaces across floating chrome, headers, modals, and drawers
  - UI-GSAP-02: GSAP + @gsap/react staggered bouncy/spongy entrances respecting prefers-reduced-motion
  - UI-TRN-03: GPU-accelerated page switch animations across Admin and Driver SPAs
  - UI-SPR-04: Spongy/bouncy spring micro-interactions on interactive buttons, nav pills, and dialogs
  - UI-SCR-05: Native touch scroll preservation on Driver Handheld and Leaflet map containers
---

# Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI — Execution Plan

## Goal & Architectural Approach
Enhance the perceived speed, visual polish, and tactile responsiveness of SmartRoute across both **Admin Operations** and **Driver Mobile Handheld** views using **GSAP (`gsap` + `@gsap/react`)** and **subtle glassmorphism**, strictly governed by `.planning/phases/03-gsap-motion-glassmorphism-ui/03-UI-SPEC.md`.

### Key Safety Guardrails
- **No Locomotive Scroll Hijacking (`UI-SCR-05`)**: Native `overflow-y-auto` + `overscroll-contain` is preserved across all nested scroll containers (`DriverLayout`, `AdminLayout`, `Modal`, `Drawer`) so touchscreen scrolling and multi-touch gestures stay lag-free.
- **Leaflet Map Isolation**: `InteractiveMap` and `DriverRoutePage`'s map container (`isolate relative z-0`) NEVER receive persistent CSS/GSAP `transform` animations on their own wrapper, avoiding Leaflet tile coordinate drift or blurry canvas text.
- **Accessibility (`prefers-reduced-motion`)**: All GSAP timelines run inside `gsap.matchMedia()` checking `(prefers-reduced-motion: no-preference)`, automatically skipping motion for users who prefer reduced motion.

---

## Wave 1: Dependencies, Glassmorphism Tokens & Reusable Motion Primitives

### Task 1.1: Install GSAP Dependencies
- **Action**: Install `gsap` and `@gsap/react` in the `client` workspace:
  `npm install --workspace=client gsap @gsap/react`
- **Verification**: `client/package.json` includes `gsap` and `@gsap/react`; `npm --prefix client test` (`tsc --noEmit`) passes.

### Task 1.2: Subtle Glassmorphism & Spring Curve CSS Tokens (`UI-GLS-01`, `UI-SPR-04`)
- **File**: `client/src/index.css`
- **Changes**:
  - Add Light & Dark glassmorphism custom properties (`--surface-glass`, `--surface-glass-strong`, `--border-glass`, `--shadow-glass`, `--ease-spring-press`).
  - Add `.glass-surface` and `.glass-floating` utility classes (`backdrop-filter: blur(14px..18px) saturate(160%..180%)`).
  - Add `.spring-press` (`transition: transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)`) and `.card-hover-lift` micro-interaction classes with `@media (prefers-reduced-motion: reduce)` reset rules.

### Task 1.3: Reusable GSAP Motion Primitives (`UI-GSAP-02`, `UI-TRN-03`)
- **New File**: `client/src/components/common/MotionPrimitives.tsx`
- **Components & Hooks**:
  1. `PageTransition`: Wraps `<Outlet />` (keyed by `useLocation().pathname` inside `AdminLayout` and non-map `DriverLayout` routes — bypassing transform animations on `/driver/route` map view so Leaflet remains pixel-locked while still animating floating overlay cards!). Animates `opacity: 0 -> 1`, `y: 12 -> 0`, `scale: 0.988 -> 1` (`duration: 0.28`, `ease: 'power3.out'`).
  2. `useStaggerEntrance(containerRef, selector, deps)`: Custom `@gsap/react` (`useGSAP`) hook that animates cards/rows sequentially (`y: 16 -> 0`, `opacity: 0 -> 1`, `scale: 0.97 -> 1`, `ease: 'back.out(1.4)'`, `stagger: 0.045`), automatically gated by `gsap.matchMedia()`.

---

## Wave 2: Shell Chrome Glassmorphism, Buttons, Modals & Drawers

### Task 2.1: Springy Interactive Controls (`Button.tsx`, `DriverBottomNav.tsx`)
- **Files**:
  - `client/src/components/common/Button.tsx`
  - `client/src/components/layout/DriverBottomNav.tsx`
- **Changes**:
  - Upgrade `Button.tsx` with spongy spring press physics (`spring-press hover:-translate-y-[1px] active:scale-[0.95]`).
  - Upgrade `DriverBottomNav.tsx` with `.glass-floating` surface, tactile tab bounce on active selection, and `active:scale-90` spring squish.

### Task 2.2: Glassmorphic Headers, Sidebars, Modals & Drawers (`UI-GLS-01`, `UI-SPR-04`)
- **Files**:
  - `client/src/components/layout/AdminHeader.tsx`
  - `client/src/components/layout/AdminSidebar.tsx`
  - `client/src/components/layout/DriverHeader.tsx`
  - `client/src/components/common/Modal.tsx`
  - `client/src/components/common/Drawer.tsx`
- **Changes**:
  - Apply `.glass-surface` to `AdminHeader`, `AdminSidebar`, and `DriverHeader`.
  - Add GSAP spring entrance animation (`scale: 0.93 -> 1`, `y: 16 -> 0`, `ease: 'back.out(1.6)'`) on `Modal.tsx` dialog mount, and crisp slide-in spring (`x: 36 -> 0`, `ease: 'power3.out'`) on `Drawer.tsx`, using `.glass-floating` panels.

---

## Wave 3: Route Transitions & Staggered View Animations (Admin & Driver)

### Task 3.1: Layout Route Transitions (`AdminLayout.tsx`, `DriverLayout.tsx`)
- **Files**:
  - `client/src/components/layout/AdminLayout.tsx`
  - `client/src/components/layout/DriverLayout.tsx`
- **Changes**:
  - Wrap `<Outlet />` in `<PageTransition>` keyed cleanly by route pathname so switching between Control Center, Deliveries, Batches, Optimizer, Fleets, Drivers, Analytics, Cockpit, Manifest, Vehicle Check, and Profile feels instantaneous and fluid.
  - Ensure `/driver/route` passes `skipTransform` (or animates only its floating top/bottom cards) so the Leaflet map stays untouched and responsive.

### Task 3.2: Admin Dashboard & Driver HUD Staggered Entrances
- **Files**:
  - `client/src/components/dashboard/OperationsCommandStrip.tsx`
  - `client/src/pages/admin/AdminControlCenterPage.tsx`
  - `client/src/pages/driver/DriverCockpitPage.tsx`
  - `client/src/pages/driver/DriverDeliveriesPage.tsx`
  - `client/src/pages/driver/DriverRoutePage.tsx`
- **Changes**:
  - Apply `useStaggerEntrance` to KPI strips, dashboard cards, driver cockpit cards, and manifest card lists (`stagger: 0.045`, `ease: 'back.out(1.4)'`).
  - Apply `.glass-floating` to `DriverRoutePage` floating top info bar, bottom active stop action card, and stops drawer, with bouncy entrance for the active stop card.

---

## Verification Plan

### Automated Verification
1. **TypeScript Typecheck**:
   ```bash
   npm --prefix client test
   ```
   Must pass with 0 TypeScript errors.
2. **Production Bundle Build**:
   ```bash
   npm --prefix client run build
   ```
   Must transform all modules cleanly with 0 warnings/errors from GSAP imports.
3. **Backend Regression Pass**:
   ```bash
   npm --prefix server test
   ```
   Ensure zero regressions across all 18 suites (245/245 tests).

### Manual & Ergonomic Checklist
- Verify switching routes between Admin sidebar/header tabs triggers crisp, smooth spring page transitions without scroll flicker.
- Verify clicking buttons, modals, and `DriverBottomNav` tabs exhibits spongy/bouncy micro-feedback.
- Verify `/driver/route` Leaflet map zoom/pan and floating **Google Maps** / **Complete Stop** buttons stay 100% responsive and unclipped (`isolate z-0` preserved).
- Toggle OS/browser `prefers-reduced-motion: reduce` and confirm all motion is cleanly suppressed.
