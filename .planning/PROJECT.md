# SmartRoute — Last-Mile Delivery Optimization Platform

## What This Is
SmartRoute is an enterprise last-mile logistics and fleet dispatch platform tailored for urban distribution hubs (Rasulgarh Logistics Hub, Bhubaneswar). It pairs a desktop Operations Control Center (VRP Nearest-Neighbor + 2-Opt route optimization, batch orchestration, CSV dry-run ingestion, PRD fleet analytics, live Socket.IO GPS tracking, automatic mid-shift re-optimization, and RBAC governance) with a daylight-first, responsive field driver mobile handheld cockpit.

## Core Value
Calculate fuel-optimal, traffic-aware delivery routes end-to-end across dispatchers and field drivers while maintaining strict operational data integrity, real-time synchronization, and honest production telemetry.

## Current Milestone: v6 Deployment & Production Readiness

**Goal:** Make SmartRoute turnkey to containerize, configure, secure, verify, and deploy reliably across PaaS (Render/Railway/Vercel + MongoDB Atlas) and Docker/VPS environments.

**Target features:**
- Server production hardening (`trust proxy`, comma-separated multi-origin CORS for Express + Socket.IO, tuned Helmet CSP for Geoapify & Google OAuth, `/healthz` + `/readyz` readiness probes, graceful `SIGTERM`/`SIGINT` shutdown, optional `SERVE_CLIENT=true` SPA static serving)
- Multi-stage production `Dockerfile`, `.dockerignore`, and `docker-compose.yml` (Nginx WebSocket/SPA reverse proxy + MongoDB 6 + healthchecks)
- Platform manifests (`render.yaml`, `vercel.json`), fail-fast production env validation, and CI build verification in `.github/workflows/ci.yml`
- Complete root `README.md`, audited `.env.example` guides, idempotent first-admin bootstrap script, and post-deploy verification smoke script

## Requirements

### Active
- [ ] Harden Express/Socket.IO server for reverse-proxy, multi-origin CORS, CSP, readiness probes, graceful shutdown, and optional `SERVE_CLIENT=true` static hosting
- [ ] Add multi-stage Docker + Docker Compose stack (Nginx + app + MongoDB) and PaaS manifests (`render.yaml`, `vercel.json`) with CI build verification
- [ ] Add production `README.md`, audited `.env.example` guides, idempotent first-admin bootstrap script, and post-deploy smoke test

### Validated
- ✓ Operational dispatch, direct driver messaging, push-to-handheld, atomic assignments & handheld viewport containment — Milestone 1 (Phase 01)
- ✓ Real Google Identity Services OAuth + out-of-band Email/SMS OTP registration & passwordless sign-in with zero frontend OTP leakage — Milestone 2 (Phases 02 & 05)
- ✓ GSAP micro-interactions, subtle glassmorphism, route transitions, and native smooth scrolling with Leaflet isolation — Milestone 2 (Phase 03 & Quick `261111-47e`)
- ✓ End-to-end Admin ↔ Fleet Manager ↔ Driver Socket.IO room sync, `DRIVER` `/admin/*` guard, and Industrial Carbon & Zinc dark-mode unification + white daylight handheld default — Milestones 2–5 (Phases 04, 06, 09, 10 & Quick `261111-4v5`)
- ✓ Production data cleanup & Admin-only prebuilt demo dataset controls (`isDemoData` propagation across 7 core + 10 secondary models and zero-orphan cascade purge) — Milestones 3 & 5 (Phases 07 & 10)
- ✓ Driver shift odometer + fuel/charge telemetry, vehicle pre-trip readiness guards, 409 active-operation & active-batch interlocks, and visual popup confirmations — Milestones 3–5 (Phases 08, 09, 10 & Quick `261111-4fq`)
- ✓ Synchronized `GET /api/v1/admin/analytics` (`ADMIN` & `FLEET_MANAGER`) with PRD KPIs and Planned vs Actual (`Route` vs `DriverShift`) performance — Milestone 5 (Phase 10)
- ✓ Automatic mid-shift re-optimization on `ROUTE_OBSTRUCTION` driver incidents and dispatcher `POST /api/v1/routes/:id/reoptimize` under `HEAVY_TRAFFIC` with dual Socket.IO `route:reordered`/`route:updated` sync — Milestone 5 (Phase 10)

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

## Current State (Milestone 6 Initialization)
- **Codebase Size:** 16,018 LOC (`server/src`) + 18,933 LOC (`client/src`)
- **Automated Verification:** 25/25 Jest suites (287/287 tests), `tsc --noEmit` (0 errors), Vite build (`1706` modules), 18/18 live headless Chromium CDP E2E checks

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
*Last updated: 2026-11-11 after starting v6 milestone*
