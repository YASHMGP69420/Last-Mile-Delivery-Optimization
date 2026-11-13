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

## Current State (Milestone 8 Complete)
- **Codebase Size:** 16,564 LOC (`server/src`) + 19,067 LOC (`client/src`)
- **Automated Verification:** 29/29 Jest suites (343/343 tests), `tsc --noEmit` (0 errors), Vite build (`1812` modules), `docker compose config -q` (exit 0)
- **Frontend Tests:** 38/39 Vitest unit tests pass (1 pre-existing Router nesting failure deferred)
- **E2E Infrastructure:** Playwright configured with 4 critical flow specs, auth fixtures for 3 roles

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
*Last updated: 2026-11-14 after v8 milestone*
