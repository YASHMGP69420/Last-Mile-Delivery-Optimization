# SmartRoute Roadmap

## Milestone 1: Core System & Operational Stabilization (Completed)

- [x] **Phase 01: Operational Dispatch & Driver Workflow Stabilization** (Completed 2026-11-09)
  - FIX-MSG-01: Direct driver messaging without requiring active route lookup or failing with 'Route not found'
  - REM-BRK-02: Remove driver break option and shift break controls from UI and API endpoints
  - FIX-PSH-03: Enable seamless 'Push to Driver Handheld' from Route Planner and Optimization panel
  - FIX-ASN-04: Eliminate duplicate and cascading vehicle/driver assignments across planner and batches
  - FIX-UI-05: Driver mobile handheld UI viewport containment, unclipped bottom action card, and normalized touch targets

## Milestone 2: Production Authentication & High-Craft Motion UI (Completed)

- [x] **Phase 02: Real Authentication, Google OAuth & OTP Verification** (Completed 2026-11-10)
  - Goal: Replace mock/demo authentication with real verified Google Identity Services Sign-In and passwordless Email/Phone OTP verification for registration and sign-in.
  - Requirements: `AUTH-GGL-01`, `AUTH-GGL-02`, `AUTH-OTP-01`, `AUTH-OTP-02`, `AUTH-REG-03`, `AUTH-LGN-04`, `AUTH-CLN-05`
- [x] **Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI** (Completed 2026-11-10)
  - Goal: Add subtle glassmorphism, bouncy/spongy GSAP micro-interactions, and GPU-accelerated page switch animations across Admin and Driver SPAs while keeping native touch scrolling and Leaflet map interactions fast.
  - Requirements: `UI-GLS-01`, `UI-GSAP-02`, `UI-TRN-03`, `UI-SPR-04`, `UI-SCR-05`
- [x] **Phase 04: End-to-End Admin ↔ Fleet ↔ Driver Communication, State Sync & Dead-UI Cleanup** (Completed 2026-11-10)
  - Goal: Fix broken Admin/Fleet↔Driver messaging, completion/POD/vehicle state sync, Socket.IO room isolation, continuous telemetry, and prune broken/orphaned/AI-artifact UI elements across Admin, Fleet, and Driver screens.
- [x] **Phase 05: Real Out-of-Band Email & SMS OTP Delivery + Zero Frontend OTP Leakage** (Completed 2026-11-10)
  - Goal: Remove `devPreviewCode` frontend/HTTP OTP exposure completely, implement real Email SMTP (`nodemailer`) and SMS (Twilio / Fast2SMS / Webhook) delivery with rollback & cooldown enforcement, and expose provider readiness in the login UI.
  - Requirements: `OTP-SEC-01`, `OTP-EML-02`, `OTP-SMS-03`, `OTP-CAP-04`

## Milestone 3: Dark Mode Unification & Layout Chrome Polish (Completed)

- [x] **Phase 06: Control Center Dark Mode Unification & Uniform Sidebar Spacing** (Completed 2026-11-10)
  - Goal: Eliminate dark-mode white border/divider streaks across all screens by converting Tailwind CSS color tokens to `<alpha-value>` RGB channels matching Control Center's obsidian palette, adding `color-scheme: dark`, auditing remaining light-only classes, and making `AdminSidebar` spacing uniform and responsive.
  - Specs: [06-UI-SPEC.md](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.planning/phases/06-dark-mode-unification-and-sidebar-polish/06-UI-SPEC.md)
- [x] **Phase 07: Production Data Cleanup & Removable Prebuilt Demo Dataset Controls** (Completed 2026-11-10)
  - Goal: Wipe all seeded/test dummy data from the database so the platform starts production-clean, refactor legacy seeders, and provide an isolated, Admin-only "Import Prebuilt Demo Data" and "Delete Demo Data" workflow designed for clean removal before final launch.
- [x] **Phase 08: Driver Shift Odometer & Fuel/Charge Logs + Admin & Driver Savings Analytics** (Completed 2026-11-10)
  - Goal: Prompt drivers for odometer reading and remaining fuel/charge at shift/delivery start and at shift end, compute actual distance and energy/fuel usage, and display total fuel saved, km saved, and completed deliveries across Admin Control Center, Drivers Accounts, and Driver Profile.

## Milestone 4: Operational Validation Guards & Reliability Polish

- [x] **Phase 09: Cross-Screen Operational Guards & Validation Polish** (completed 2026-11-11)
  - Goal: Enforce cross-shift & pre-trip vehicle odometer continuity (`lastOdometerKm`), fuel/charge & tank sanity checks, create/edit consignment parity, active-operation safety interlocks, CSV dry-run DB duplicate detection, active-batch guards, and Last-Admin lockout protection.
  - **Plans:** 5 plans
  - Plans:
    - [x] 09-01-PLAN.md — Vehicle telemetry continuity, tank caps, shift readiness & driver HUD terminal delivery locks
    - [x] 09-02-PLAN.md — Consignment create/edit parity, batch active-route guards, delivery CSV dry-run & Last-Admin protection
    - [x] 09-03-PLAN.md — Fleet vehicle/driver active-operation safety interlocks, Admin odometer override & vehicle CSV collisions
    - [x] 09-04-PLAN.md — Driver handheld UI telemetry hints without prefill, unit alignment, cockpit guards & terminal stop locks
    - [x] 09-05-PLAN.md — Admin Fleet modals, Create/Edit Consignment parity & non-blocking multi-vehicle batch composer

## Milestone 5: Final PRD Completion & Audit Closure

- [ ] **Phase 10: Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization**
  - Goal: Close the Phase 07 demo route cleanup leak and missing `07-VERIFICATION.md`, sync `FLEET_MANAGER` savings & `AdminLayout` role guard + secondary dark-mode alert contrast fixes, add all missing PRD KPIs and Planned-vs-Actual comparison to `AnalyticsPage`, and add automatic mid-shift route recalculation on `ROUTE_OBSTRUCTION` driver incidents (plus `POST /routes/:id/reoptimize`).
  - **Plans:** 6 plans
  - Plans:
    - [x] 10-01-PLAN.md — Secondary schema `isDemoData` tagging & route/dispatch `isDemoData` propagation (`D-01`)
    - [x] 10-02-PLAN.md — Zero-orphan `deleteDemoDataset()` cascade purge, `TC-DEMO-3` & `07-VERIFICATION.md` (`D-02`, `D-03`)
    - [x] 10-03-PLAN.md — Backend `GET /api/v1/admin/analytics` PRD KPIs, Planned vs Actual & `analytics_prd.test.js` (`D-04`, `D-06`, `D-07`)
    - [x] 10-04-PLAN.md — `HEAVY_TRAFFIC` multiplier, `activeRouteReoptimizer`, `reportIncident` auto-reroute & `POST /routes/:id/reoptimize` (`D-08`, `D-09`, `D-10`)
    - [ ] 10-05-PLAN.md — Frontend `AdminControlCenterPage` `FLEET_MANAGER` sync, `AnalyticsPage` KPIs/Planned-vs-Actual, `TrackingPage`/`DriverSupportPage` live reroute & dead `RoutesApi.reset` removal (`D-04`, `D-05`, `D-06`, `D-07`, `D-08`, `D-10`)
    - [ ] 10-06-PLAN.md — `AdminLayout` `DRIVER` redirect, `BatchesPage` button radius & secondary modal dark-mode alert contrast (`D-05`)

