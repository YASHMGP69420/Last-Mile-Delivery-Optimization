# SmartRoute — Last-Mile Delivery Optimization Platform

## What This Is
SmartRoute is an enterprise last-mile logistics and fleet dispatch platform tailored for urban distribution hubs (Rasulgarh Logistics Hub, Bhubaneswar). It pairs a desktop Operations Control Center (VRP Nearest-Neighbor + 2-Opt route optimization, batch orchestration, CSV dry-run ingestion, PRD fleet analytics, live Socket.IO GPS tracking, automatic mid-shift re-optimization, and RBAC governance) with a daylight-first, responsive field driver mobile handheld cockpit.

## Core Value
Calculate fuel-optimal, traffic-aware delivery routes end-to-end across dispatchers and field drivers while maintaining strict operational data integrity, real-time synchronization, and honest production telemetry.

## Requirements

### Validated
- ✓ Operational dispatch, direct driver messaging, push-to-handheld, atomic assignments & handheld viewport containment — Milestone 1 (Phase 01)
- ✓ Real Google Identity Services OAuth + out-of-band Email/SMS OTP registration & passwordless sign-in with zero frontend OTP leakage — Milestone 2 (Phases 02 & 05)
- ✓ GSAP micro-interactions, subtle glassmorphism, route transitions, and native smooth scrolling with Leaflet isolation — Milestone 2 (Phase 03 & Quick `261111-47e`)
- ✓ End-to-end Admin ↔ Fleet Manager ↔ Driver Socket.IO room sync, `DRIVER` `/admin/*` guard, and Industrial Carbon & Zinc dark-mode unification + white daylight handheld default — Milestones 2–5 (Phases 04, 06, 09, 10 & Quick `261111-4v5`)
- ✓ Production data cleanup & Admin-only prebuilt demo dataset controls (`isDemoData` propagation across 7 core + 10 secondary models and zero-orphan cascade purge) — Milestones 3 & 5 (Phases 07 & 10)
- ✓ Driver shift odometer + fuel/charge telemetry, vehicle pre-trip readiness guards, 409 active-operation & active-batch interlocks, and visual popup confirmations — Milestones 3–5 (Phases 08, 09, 10 & Quick `261111-4fq`)
- ✓ Synchronized `GET /api/v1/admin/analytics` (`ADMIN` & `FLEET_MANAGER`) with PRD KPIs and Planned vs Actual (`Route` vs `DriverShift`) performance — Milestone 5 (Phase 10)
- ✓ Automatic mid-shift re-optimization on `ROUTE_OBSTRUCTION` driver incidents and dispatcher `POST /api/v1/routes/:id/reoptimize` under `HEAVY_TRAFFIC` with dual Socket.IO `route:reordered`/`route:updated` sync — Milestone 5 (Phase 10)
- ✓ Production server & client hardening (`NODE_ENV=production` fail-fast secrets, Geoapify key unification, numeric `TRUST_PROXY`, shared Express/Socket.IO CORS, Helmet CSP + `COOP: same-origin-allow-popups` + `/theme-init.js`, `/healthz` + `/readyz` + `SIGTERM`/`SIGINT` drain, Mongoose `autoIndex: false`, `SERVE_CLIENT=true`, Split-Origin `VITE_API_URL`/`VITE_SOCKET_URL`) — Milestone 6 (Phase 11)
- ✓ Turnkey containerization (`node:20-bookworm-slim` multi-stage non-root `Dockerfile`, `.dockerignore`, root `package.json` dependency cleanup + server `axios`, `docker-compose.yml` + `nginx:1.27-alpine` WebSocket/asset proxy + `mongo:6.0`) — Milestone 6 (Phase 12)
- ✓ PaaS & CI deployment automation (`bootstrapAdmin.js` `seed:admin` decoupled from `seedBhubaneswar.js`, `render.yaml`, dual `vercel.json` / `client/vercel.json`, zero-dependency `scripts/smoke-test.js`, `.github/workflows/ci.yml` `SERVE_CLIENT=true` + `docker-and-compose` gates) — Milestone 6 (Phase 13)
- ✓ Audited `.env.example`, `server/.env.example`, `client/.env.example` 1:1 code parity, updated root `README.md` + `docs/DEPLOYMENT_GUIDE.md` runbooks, and automated `env_docs_audit.test.js` parity suite — Milestone 6 (Phase 14)
- ✓ Dispatch simplification & auto vehicle assignment — removed manual vehicle/driver dropdowns from UI, route optimizer auto-assigns vehicles/drivers with multi-bin (multi-vehicle) batch support — Milestone 7 (Phase 15)
- ✓ Vitest + React Testing Library frontend test framework with CI integration — Milestone 8 (Phase 16-01)
- ✓ 5 backend tests closing BE-01 through BE-05 gaps for Nyquist compliance — Milestone 8 (Phase 16-02)
- ✓ ADMIN-only user management UI with paginated searchable list, validated CRUD forms, and last-admin protection — Milestone 8 (Phase 16-03)
- ✓ Optional POD OTP verification with feature flag (SMS only, skippable, uses existing otpService) — Milestone 8 (Phase 16-04)
- ✓ Playwright E2E test infrastructure with 4 critical flow specs and API-driven fixtures — Milestone 8 (Phase 16-05)
- ✓ Dependabot security monitoring for all npm manifests and documented supply-chain checkpoint policy — Milestone 8 (Phase 16-06)
- ✓ Phase 15 plan blockers/warnings fixed via metadata edits (1 blocker, 5 warnings resolved) — Milestone 8 (Phase 16-07)
- ✓ Production CI supply-chain audit pinning (`npm audit --audit-level=high`) and adaptive benchmark timeouts — Milestone 9 (Phase 18-01)
- ✓ Resilient multi-provider mapping failovers with 3-state circuit breaker (CLOSED/OPEN/HALF_OPEN) and 3500ms timeout SLA — Milestone 9 (Phase 18-02)
- ✓ Real-time Socket.IO driver telemetry streaming (`driver:locationUpdated`), BOLA security guards, route room subscriptions, and driver HUD sync — Milestone 9 (Phase 18-03)
- ✓ Consolidated proof-of-delivery audit trails (`AUDIT_EVENT_TYPES.POD_RECORDED`, `verificationMethods: ['OTP', 'SIGNATURE', 'PHOTO']`) and responsive tablet/desktop driver layouts — Milestone 9 (Phase 18-04, 18-05)
- ✓ Playwright dual `webServer` orchestration (:5004 + :5173) with Express `/api/v1/healthz` readiness probe and Node 20.11+ ESM `import.meta.dirname` path resolution — Milestone 9 (Phase 19-01)
- ✓ Isolated test database seeding (`smartroute_e2e`), resilient `bootstrapAdmin.js` fallbacks, and multi-role auth storage states (`.auth/admin.json`, `manager.json`, `driver.json`) — Milestone 9 (Phase 19-02)
- ✓ 100% automated E2E test execution (12/12 green in 48.4s) in headless Chromium across 4 critical user flows (Admin Analytics, Batch Dispatch, Driver POD, Mid-Shift Re-Optimization) — Milestone 9 (Phase 19-02)
- ✓ Gated GitHub Actions CI workflow with Playwright browser installation, automated PR gating, and diagnostic artifact capture — Milestone 9 (Phase 19-03)
- ✓ Pre-deletion resource guards, 409 conflict detection & atomic orphan recovery cascade service (`MISHAP-01`, `MISHAP-03`) — Milestone 10 (Phase 20)
- ✓ Actionable conflict resolution modal, admin cascade execution & Control Center live alert banner (`MISHAP-02`, `MISHAP-04`) — Milestone 10 (Phase 20)
- ✓ Dual-model stop progression sync across `Delivery` and `Route.stops` with multi-room Socket.IO broadcasts (`DRIVER-SYNC-01`, `DRIVER-SYNC-02`) — Milestone 10 (Phase 21)
- ✓ Demo account sandbox isolation guards (HTTP 403 `DEMO_ISOLATION_VIOLATION`) and sticky amber indicators (`DEMO-ISOLATION-01`, `DEMO-ISOLATION-02`) — Milestone 10 (Phase 21)
- ✓ Live driver navigation arrowhead marker oriented by heading, speed badge pill, and camera auto-follow engine (`TELEM-MAP-01`, `TELEM-MAP-02`) — Milestone 10 (Phase 22)
- ✓ Status-differentiated map pins, dual route polyline segmentation, and glassmorphic Map Legend (`TELEM-MAP-03`, `TELEM-MAP-04`) — Milestone 10 (Phase 22)
- ✓ Fleet tracking 30-minute completed route auto-hide grace period, in-place vehicle maintenance dropdown with service notes, and remote GPS ping (`FLEET-TRACK-01`, `FLEET-MAINT-01`, `TELEM-SYNC-01`) — Milestone 10 (Phase 23)
- ✓ Continuous multi-stop Google Maps navigation for driver handhelds and stale telemetry visual indicators (`NAV-MULTI-01`, `TELEM-SYNC-01`) — Milestone 10 (Phase 23)

### Out of Scope / Deferred
- `D-17` Admin User Management frontend UI (backend Last-Admin protection remains active and Jest-tested)
- POD OTP verification workflow (`PODModal` signature + notes active)
- Autonomous vehicle integration, drone delivery, GPS hardware manufacturing, cross-border compliance

## Key Decisions

| Decision | Outcome | Notes |
| --- | --- | --- |
| Google OAuth via `google-auth-library` & out-of-band Email/SMS OTP | ✓ Good | Verified ID tokens and zero frontend OTP preview leakage |
| Native CSS smooth scroll + `overscroll-contain` (`UI-SCR-05`) | ✓ Good | Zero Locomotive Scroll conflicts with Leaflet touch/zoom |
| Industrial Carbon & Zinc dark mode + white default for mobile handheld (`261111-4v5`) | ✓ Good | High contrast across desktop & daylight field operations |
| Server-side `isDemoData` derivation & `demoRouteIds` cascade cleanup | ✓ Good | Eliminated demo route orphan leaks (`TC-DEMO-1..3`) |
| Shared `getAnalyticsSummary` (`ADMIN` + `FLEET_MANAGER`) excluding `DRAFT` | ✓ Good | Single source of truth for Control Center & PRD Analytics |
| Terminal-stop-locked `activeRouteReoptimizer` + live `_isLiveSocketAlert` preservation | ✓ Good | Real-time mid-shift rerouting verified in two-browser E2E |
| Externalized `/theme-init.js` + `COOP: same-origin-allow-popups` + gated `FORCE_HTTPS_CSP` | ✓ Good | Strict CSP without CRLF/LF hash drift across Windows & Linux Docker |
| Single-Origin `SERVE_CLIENT=true` + Compose Nginx + Split-Origin Vercel/Render parity | ✓ Good | Pinned single-instance WebSockets (`numInstances: 1`) + decoupled `seed:admin` |
| 3-state circuit breaker failover (`mappingProviderFactory.js`) with 3500ms timeout | ✓ Good | Instant trip on HTTP 429 quota exhaustion without burning retries |
| Authenticated Socket.IO driver telemetry with strict BOLA ownership check | ✓ Good | Sub-50ms streaming latency, zero driver ID spoofing, fallback to REST |
| Consolidated POD audit schema (`AUDIT_EVENT_TYPES.POD_RECORDED`, `verificationMethods`) | ✓ Good | Unified audit trails across both mobile HUD and central dispatch |
| Dual `webServer` Playwright orchestration (:5004 + :5173) & isolated `smartroute_e2e` DB | ✓ Good | 12/12 Chromium E2E tests pass 100% with zero port or db collisions |
| 409 Interlock on active driver deletion with atomic `mishapRecoveryService` cascade | ✓ Good | Guarantees zero orphaned consignments, shifts, or vehicles on mishaps |
| Dual-model transactional sync across `Delivery` and `Route.stops` collections | ✓ Good | Atomic consistency across mobile handheld and dispatch dashboards |
| Strict demo account dispatch isolation (`DEMO_ISOLATION_VIOLATION`) | ✓ Good | Impossible to assign production vehicles/drivers to demo accounts |
| Heading-oriented SVG navigation arrowhead and auto-follow camera engine | ✓ Good | Real-time driver visibility with smooth panTo and manual disengagement |
| 30-minute auto-hide grace period & polyline clearing for completed fleet routes | ✓ Good | Unclutters active dispatch canvas while retaining full audit history in Archived tab |
| 1-tap continuous multi-waypoint Google Maps navigation in driver handheld | ✓ Good | Drivers navigate all remaining stops sequentially without app switching |

## Current State (Milestone 10 Complete)
- **Codebase Size:** ~18,500 LOC (`server/src`) + ~22,100 LOC (`client/src`)
- **Automated Verification:** 32/32 Jest suites (367/367 tests), `tsc --noEmit` (0 errors), Vite build (`1806` modules), `docker compose config -q` (exit 0)
- **Frontend Unit Tests:** 91/91 Vitest unit tests passing 100% across 13 test files
- **E2E Test Suites:** 12/12 Playwright tests passing 100% in headless Chromium across 4 critical user flows
- **CI Gating:** Automated GitHub Actions pipeline enforcing `--audit-level=high`, Jest `--runInBand`, Vitest, and Playwright Chromium with diagnostic artifact retention

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-22 after v10 milestone*
