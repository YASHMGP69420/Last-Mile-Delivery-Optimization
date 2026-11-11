---
phase: 10-prd-completion-and-audit-closure
plan: 06
subsystem: ui
tags: [rbac, role-guard, dark-mode, carbon-zinc, tailwind, modals]

# Dependency graph
requires:
  - phase: 10-prd-completion-and-audit-closure
    plan: 03
    provides: Control Center dark-mode parity and dead API cleanup baseline
provides:
  - DRIVER role redirect guard in AdminLayout.tsx (/admin/* -> /driver)
  - Architectural rounded-lg Remove consignment chip with dark hover contrast in BatchesPage.tsx
  - Carbon & Zinc dark-compatible translucent semantic alerts, badges, summary cards, and error tables across RoutePlannerPage.tsx, DriversPage.tsx, DispatchConfirmationModal.tsx, CsvImportModal.tsx, DriverHeader.tsx, and PODModal.tsx
affects:
  - v4-MILESTONE-AUDIT.md UI/role-guard tech-debt closure
  - Phase 10 verification and milestone audit

# Actuals (#2632) & Measured Commit Ledger (#3968)
actuals:
  tokens: 5957
  tasks: 2
  commits: 2
commits: 2
plan_head_before: ad48cd9cc5c0804759731ba4567b83f22002dd96
plan_head_after: f1b79c0a7e4bec34c994bc414e2707f17bdba194

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Translucent semantic alert pattern: bg-{color}-500/10 border-{color}-500/30 text-{color}-800 dark:text-{color}-200 with icon text-{color}-600 dark:text-{color}-400"
    - "Layout-level SPA role guard in AdminLayout redirecting user.role === 'DRIVER' to /driver"

key-files:
  created: []
  modified:
    - client/src/components/layout/AdminLayout.tsx
    - client/src/pages/BatchesPage.tsx
    - client/src/pages/admin/RoutePlannerPage.tsx
    - client/src/pages/admin/DriversPage.tsx
    - client/src/components/optimization/DispatchConfirmationModal.tsx
    - client/src/components/deliveries/CsvImportModal.tsx
    - client/src/components/layout/DriverHeader.tsx
    - client/src/components/driver/PODModal.tsx

key-decisions:
  - "None - followed plan as specified"

patterns-established:
  - "All secondary modals, headers, and admin alert banners use translucent bg-*-500/10 and bg-*-500/15 semantic tokens rather than light-only bg-*-50/100 backgrounds"

requirements-completed:
  - D-05

coverage:
  - id: D1
    description: "AdminLayout.tsx immediately redirects authenticated DRIVER users from /admin/* to /driver"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "npm --prefix client test (tsc --noEmit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "BatchesPage.tsx Remove consignment button uses rounded-lg with Carbon & Zinc dark hover contrast"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "npm --prefix client test && npm --prefix client run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "RoutePlannerPage, DriversPage, DispatchConfirmationModal, CsvImportModal, DriverHeader, and PODModal alerts/badges use Carbon & Zinc dark-compatible translucent semantic tokens"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "npm --prefix client test && npm --prefix client run build"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-11-11
status: complete
---

# Phase 10 Plan 06: AdminLayout DRIVER Role Guard & Secondary Modal Dark-Mode Polish Summary

**Enforced `DRIVER` role redirect away from `/admin/*` in `AdminLayout.tsx`, switched `BatchesPage.tsx` Remove consignment chip and `PODModal.tsx` close button to `rounded-lg`, and unified all secondary page/modal alert banners, summary cards, error tables, and status badges onto Carbon & Zinc dark-compatible `bg-*-500/10` translucent tokens.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T02:36:25Z
- **Completed:** 2026-11-11T02:39:22Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added an immediate `user.role === 'DRIVER'` redirect to `/driver` in `client/src/components/layout/AdminLayout.tsx` as SPA defense-in-depth alongside backend RBAC.
- Replaced `rounded-full hover:bg-red-50` on the consignment removal button in `client/src/pages/BatchesPage.tsx` with `rounded-lg hover:bg-red-500/10 text-red-600 dark:text-rose-400`.
- Remediated light-only `bg-*-50` / `bg-*-100` alert banners, action hover states, dry-run summary cards, error tables, and status badges across `RoutePlannerPage.tsx`, `DriversPage.tsx`, `DispatchConfirmationModal.tsx`, `CsvImportModal.tsx`, `DriverHeader.tsx`, and `PODModal.tsx` using Carbon & Zinc dark-compatible `bg-*-500/10` / `bg-*-500/15` tokens.
- Verified zero TypeScript errors (`npm --prefix client test` / `tsc --noEmit`) and clean Vite production bundle (`npm --prefix client run build`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DRIVER redirect in AdminLayout, fix BatchesPage:746 radius, and remediate RoutePlannerPage & DriversPage dark alerts** - `86edda6` (fix)
2. **Task 2: Fix dark-mode alert and badge contrast across DispatchConfirmationModal, CsvImportModal, DriverHeader, and PODModal** - `f1b79c0` (fix)

**Plan metadata:** pending final metadata commit

## Files Created/Modified
- `client/src/components/layout/AdminLayout.tsx` - Redirects `user.role === 'DRIVER'` to `/driver`.
- `client/src/pages/BatchesPage.tsx` - Updates Remove consignment button to `rounded-lg` with `hover:bg-red-500/10` and `dark:text-rose-400`.
- `client/src/pages/admin/RoutePlannerPage.tsx` - Updates info, capacity overflow warning, and optimization error banners to translucent `bg-blue-500/10`, `bg-amber-500/10`, and `bg-red-500/10`.
- `client/src/pages/admin/DriversPage.tsx` - Updates Assign/Unassign hover states and error banner to `bg-blue-500/10` / `bg-red-500/10` with dark-mode text contrast.
- `client/src/components/optimization/DispatchConfirmationModal.tsx` - Updates `dispatchModeBadge`, Pre-Dispatch Clearance Verified, Dispatch Blocked, Ineligible Deliveries Warning, and Courier/Vehicle PASS/FAIL badges to dark-compatible translucent tokens.
- `client/src/components/deliveries/CsvImportModal.tsx` - Updates CSV error banner, Valid Rows / Row Errors summary cards, row-level error table, and all-valid banner to dark-compatible translucent tokens.
- `client/src/components/layout/DriverHeader.tsx` - Updates Sign out hover state and real-time dispatch notification banners (`WARNING`, `ROUTE_DISPATCHED`, default info) to `bg-*-500/10` dark-compatible classes.
- `client/src/components/driver/PODModal.tsx` - Updates modal close button to `rounded-lg` and camera fallback warning banner to `bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200`.

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 client files from `10-06-PLAN.md` pass TypeScript checking (`npm --prefix client test`) and Vite production bundling (`npm --prefix client run build`).
- Ready for phase verification / UAT once remaining parallel plans (if any) are finalized.

---
*Phase: 10-prd-completion-and-audit-closure*
*Completed: 2026-11-11*

## Self-Check: PASSED
