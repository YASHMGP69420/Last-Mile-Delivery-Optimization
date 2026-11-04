---
name: SmartRoute Logistics Operations System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#44474d'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#505f78'
  primary: '#000e23'
  on-primary: '#ffffff'
  primary-container: '#14243a'
  on-primary-container: '#7c8ba6'
  inverse-primary: '#b7c7e4'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000e20'
  on-tertiary: '#ffffff'
  tertiary-container: '#142438'
  on-tertiary-container: '#7b8ca3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b7c7e4'
  on-primary-fixed: '#0b1c32'
  on-primary-fixed-variant: '#38475f'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.75rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system embodies an authoritative, precision-focused, modern enterprise logistics aesthetic. Designed for fleet dispatchers, operations directors, and logistics analysts, it balances intense data density with immaculate visual clarity. The emotional tone evokes operational command, telemetry-grade precision, and high-efficiency workflow momentum.

Drawing from modern high-density enterprise SaaS and structural data-dense interfaces, the visual philosophy prioritizes content hierarchy, crisp boundary delineations, and low visual fatigue over prolonged monitoring shifts. Rather than decorative flare, the design builds trust through rigid structural alignment, micro-level legibility, and high-utility data visualization.

## Colors

The palette is engineered around high contrast, functional status telegraphing, and spatial clarity.

- **Primary (`#14243A`)**: Deep Navy. Serves as the foundation for primary navigation sidebars, high-priority system actions, master headers, and critical status callouts. Communicates operational command and enterprise stability.
- **Secondary (`#2563EB`)**: Electric Blue. The key interactive and vector accent color. Used for active route traces, active states, key focus rings, primary action buttons, and active telemetry markers.
- **Tertiary (`#64748B`)**: Slate. Controls secondary iconography, subtle telemetry labels, axis markers, meta attributes, and inactive elements.
- **Neutral (`#0F172A`)**: Midnight Slate. Reserved for heavy contrast typography on bright canvases, high-emphasis text, and dark mode base foundations.

### Surface & Border Architecture
- **Base Canvas**: `#F8FAFC` (Slate 50) delivers an ergonomic, low-glare backdrop for persistent dashboard operations.
- **Card & Sheet Surfaces**: `#FFFFFF` (Pure White) provides crisp separation for modular widgets, telemetry panels, and floating map inspectors.
- **Divider & Border Rules**: `#E2E8F0` (Slate 200) strictly divides tabular data rows, card shells, and dock zones without visual clutter.

### Status Indicators
- **Operational / Completed (`#16A34A`)**: On-time delivery, connected vehicle, optimized route, geofence cleared.
- **Warning / At Risk (`#F59E0B`)**: Delayed stop, low fuel threshold, traffic congestion, driver break required.
- **Critical / Interrupted (`#DC2626`)**: Route exception, vehicle breakdown, SLA breach alert, unassigned load.
- **In-Transit / Scheduled (`#2563EB`)**: En route, scheduled departure, active telemetry polling.

## Typography

Inter serves as the sole typography engine across headlines, analytical bodies, tabular metrics, and micro-labels. By enforcing strict proportional tabular lining figures (`tnum`) across all telemetry, speed, ETA, and coordinate displays, the typography prevents horizontal jitter during live telemetry updates.

- **Display & Headlines**: Tightly tracked (`-0.02em` to `-0.01em`) to create sharp, commanding visual entry points for operational centers and executive summary KPI dashboards.
- **Body & Data Tables**: Standardized on 13px (`body-sm`) and 14px (`body-md`) with neutral tracking to support dense, scan-heavy tabular layouts without sacrificing legibility.
- **Labels & Micro-data**: Standardized uppercase or medium-weight 11px/12px treatments for badges, geofence coordinates, vehicle identification tags (VINs), and table headers.

## Layout & Spacing

The layout model employs a high-density, multi-panel split view designed for operational dashboards, dispatch workspaces, and fleet telemetry centers.

### Layout Model
- **Workbench Layout**: A 3-zone system consisting of a persistent 64px/240px collapsible global navigation rail, a dynamic 360px–420px multi-stop dispatch drawer/data pane, and an edge-to-edge interactive GIS mapping canvas or tabular grid viewport.
- **Analytical Grid**: When operating in full data grid mode, a 12-column fluid grid system applies with `1rem` (16px) gutters on standard desktop views and `0.75rem` (12px) in high-density multi-pane modes.

### Responsiveness & Reflow Rules
- **Desktop (1440px+)**: Dual-pane or triple-pane operational layouts. Map and route queues sit simultaneously visible with zero occlusion.
- **Tablet / Small Laptop (1024px – 1439px)**: Dispatch panel transforms into an off-canvas slide-over dock over the map canvas. Table columns collapse secondary telemetry metrics behind expandable row accordions.
- **Mobile (<1023px)**: Bottom-sheet driven interface. Map canvas occupies the top 45% viewport, while bottom sheets anchor route manifests, stop completion checklists, and role-based action triggers.

## Elevation & Depth

This design system uses sharp structural containment instead of soft or decorative blur-heavy elevation styles. Visual depth is engineered through crisp structural borders, muted tinting, and precise ambient drops for overlay components.

- **Level 0 (Base Canvas & Map Plane)**: Completely flat at `#F8FAFC` or raw vector map skin.
- **Level 1 (Docked Cards, Data Grids, Table Rows)**: `#FFFFFF` surface enclosed by a 1px solid `#E2E8F0` border. No drop shadow. Depth is established purely via surface contrast against the base canvas.
- **Level 2 (Floating Map Controls, Popovers, Filter Menus)**: `#FFFFFF` surface, 1px solid `#E2E8F0`, with a refined, ultra-crisp ambient drop: `box-shadow: 0 4px 12px -2px rgba(20, 36, 58, 0.08), 0 2px 6px -1px rgba(20, 36, 58, 0.04)`.
- **Level 3 (Modal Dialogs, Emergency Exception Drawers, Waypoint Reordering Overlays)**: `#FFFFFF` surface with a focused perimeter shadow: `box-shadow: 0 20px 25px -5px rgba(20, 36, 58, 0.12), 0 8px 10px -6px rgba(20, 36, 58, 0.08)` backed by a 40% `#0F172A` scrim.

## Shapes

The design system adopts a disciplined "Soft" curvature level (Token: `1`), engineered to look industrial, engineered, and professional. 

- **Base Controls & Inputs**: Form fields, tabular action buttons, vehicle chips, and table cells utilize `0.25rem` (4px) rounding to maintain tight, crisp alignments in high-density spreadsheets and lists.
- **Cards & Floating Telemetry Panels**: Use `0.5rem` (8px) for outer card shells (`rounded-lg`), delivering subtle, refined separation from the global frame without feeling overly rounded or playful.
- **Modals & Flyout Sheets**: Utilize `0.75rem` (12px) for top-level structural containers (`rounded-xl`).
- **Telemetry Indicators & Status Badges**: Retain a deliberate 4px corner or functional pill format only when representing transient real-time state chips (e.g., "Active GPS", "SLA At Risk").

## Components

### Buttons
- **Primary**: Solid Deep Navy (`#14243A`) background, white text, 4px border radius. Hover: `#1E3557`. Focus: 2px offset ring in `#2563EB`. Height: 32px (compact data-dense) or 40px (standard action).
- **Secondary / Action**: Solid Electric Blue (`#2563EB`) background, white text. Used for immediate operational steps like "Optimize Route" or "Dispatch Load".
- **Outline / Filter**: White background, 1px `#E2E8F0` border, `#14243A` text. Hover: `#F1F5F9`.
- **Destructive**: 1px solid `#FCA5A5` with `#FEF2F2` background and `#DC2626` text. Hover: `#FEE2E2`.

### Chips & Telemetry Badges
- High-visibility, low-height (20px–24px) indicators using a 1px border and a subtle 10% opacity fill corresponding to status colors.
- *Active/Normal*: `#DCFCE7` fill, `#16A34A` text, `#BBF7D0` border.
- *Delayed/Caution*: `#FEF3C7` fill, `#B45309` text, `#FDE68A` border.
- *Critical/Alert*: `#FEE2E2` fill, `#B91C1C` text, `#FECACA` border.
- *In-Transit*: `#DBEAFE` fill, `#1D4ED8` text, `#BFDBFE` border.

### Data Tables & Route Lists
- **Table Density**: 36px row height for compact dispatch tables, 44px row height for vehicle registry lists.
- **Headers**: 11px uppercase `label-sm`, `#64748B` foreground, `#F8FAFC` background with a 1px bottom border in `#E2E8F0`.
- **Rows**: Alternating hover state in `#F8FAFC`. Selected rows render with a 2px vertical `#2563EB` left-border accent and `#EFF6FF` background tint.

### Inputs & Filters
- **Text Inputs**: Crisp 1px `#E2E8F0` border, `#FFFFFF` surface, 32px height for high density. On focus: `#2563EB` border with a 1px electric blue ambient glow.
- **Checkboxes & Radios**: 14px square/circle with `#CBD5E1` border. Checked state uses `#2563EB` with a crisp white check/dot.

### Cards & Dashboards Widgets
- Pure `#FFFFFF` background encased in a 1px `#E2E8F0` border. Padding defaults to `0.75rem` (`space-md`) for telemetry summary metrics, scaling to `1rem` (`space-lg`) for major route summary charts.

### Specialized Logistics Components
- **Interactive Waypoint Node**: Draggable sequenced pin displaying sequence number, customer window time (e.g., `09:30 - 10:15`), and dynamic color node based on SLA status.
- **Route Segment Ribbon**: Visual progress line displaying mileage, traffic-weighted delay intervals, and stop completion pips.
- **Telemetry HUD Float**: Minimalist floating glass-backed panel (`rgba(255, 255, 255, 0.95)` with `backdrop-filter: blur(8px)`) showing vehicle speed, remaining fuel, and live ETA tracking over the interactive map.