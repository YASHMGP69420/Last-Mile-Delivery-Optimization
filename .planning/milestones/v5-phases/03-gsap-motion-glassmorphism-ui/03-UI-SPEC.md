---
phase: 03
slug: gsap-motion-glassmorphism-ui
title: "GSAP Motion, Subtle Glassmorphism & Page Transitions UI"
status: locked
created_at: 2026-11-10T18:43:00Z
---

# Phase 03 — UI Design Contract (`03-UI-SPEC.md`)

## 1. Visual Aesthetic & Glassmorphism Tokens

SmartRoute maintains its **Daylight White** (`#F1F5F9` canvas / `#FFFFFF` elevated cards / `#059669` primary accent) and **Obsidian Dark** (`#0b1324` canvas / `#111a2f` cards / `#10b981` accent) core visual language while introducing **subtle tactile glassmorphism** on floating chrome, headers, modals, and drawers.

### Glassmorphism CSS Custom Properties (`client/src/index.css`)
- **Light Mode (`:root`, `[data-theme="light"]`)**:
  - `--surface-glass`: `rgba(255, 255, 255, 0.78)`
  - `--surface-glass-strong`: `rgba(255, 255, 255, 0.90)`
  - `--border-glass`: `rgba(255, 255, 255, 0.65)`
  - `--shadow-glass`: `0 8px 30px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)`
- **Dark Mode (`.dark`, `[data-theme="dark"]`)**:
  - `--surface-glass`: `rgba(17, 26, 47, 0.76)`
  - `--surface-glass-strong`: `rgba(17, 26, 47, 0.90)`
  - `--border-glass`: `rgba(255, 255, 255, 0.08)`
  - `--shadow-glass`: `0 10px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)`

### Utility Classes
- `.glass-surface`: `background-color: var(--surface-glass); backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%); border: 1px solid var(--border-glass); box-shadow: var(--shadow-glass);`
- `.glass-floating`: `background-color: var(--surface-glass-strong); backdrop-filter: blur(18px) saturate(180%); -webkit-backdrop-filter: blur(18px) saturate(180%); border: 1px solid var(--border-glass); box-shadow: var(--shadow-glass);`

**Application Rules**:
- Apply `.glass-surface` to `AdminHeader`, `AdminSidebar`, `DriverHeader`, `DriverBottomNav`, and modal/drawer surfaces.
- Apply `.glass-floating` to `DriverRoutePage` floating top bar, bottom active stop action card, and `PODModal`.
- Keep `.panel-card` solid/crisp with subtle specular top border highlight and micro-lift hover (`translateY(-2px)`).

---

## 2. Motion Architecture (GSAP + `@gsap/react`)

All animations use **GSAP (`gsap` + `@gsap/react`)** (`useGSAP`) paired with GPU-composited CSS properties (`transform`, `opacity`) to ensure 60/120fps performance without layout thrashing.

### Spring & Bouncy Timing Curves
- **Spongy Press (`--ease-spring-press`)**: `cubic-bezier(0.34, 1.56, 0.64, 1)` (CSS) / `back.out(1.7)` (GSAP)
- **Tactile Entrance**: `duration: 0.42`, `ease: 'back.out(1.4)'`, `stagger: 0.05`
- **Page Switch Transition**: `duration: 0.28`, `from: { opacity: 0, y: 12, scale: 0.985 }`, `to: { opacity: 1, y: 0, scale: 1, ease: 'power3.out' }`
- **Modal / Drawer Spring Pop**: `duration: 0.34`, `from: { opacity: 0, scale: 0.93, y: 14 }`, `to: { opacity: 1, scale: 1, y: 0, ease: 'back.out(1.6)' }`

### Micro-Interactions (`.spring-btn` & Card Motion)
- Interactive buttons (`Button.tsx`, `DriverBottomNav` tabs, quick action cards) get tactile spongy feedback:
  - Hover lift: `hover:-translate-y-0.5`
  - Active squish: `active:scale-[0.95]` with `transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]`
- **Staggered List & KPI Entrances**:
  - `OperationsCommandStrip`, `LiveDriverFleetBoard`, `RecentActivityStream`, `DriverCockpitPage` cards, `DriverDeliveriesPage` manifest cards animate in sequentially (`stagger: 0.045`, `y: 14 -> 0`, `opacity: 0 -> 1`).

---

## 3. Scroll & Map Safety Invariants

- **NO Locomotive Scroll Hijacking**: Native `overflow-y-auto` with `overscroll-contain` and `-webkit-overflow-scrolling: touch` is preserved on all Driver Handheld routes and Admin tables/drawers.
- **Leaflet Map Protection**: Map containers (`InteractiveMap.tsx`, `DriverRoutePage.tsx`) NEVER receive `transform` animations on their own wrapper during steady state (preventing Leaflet tile coordinate desync and blurry text), and remain `isolate relative z-0`.
- **Accessibility Compliance**: All GSAP timelines check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` via `gsap.matchMedia()` and instantaneously skip motion when reduced motion is preferred.
