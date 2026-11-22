# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v10 — Mishap Resilience, Handheld Delivery Sync, Live Telemetry & Fleet Tracking

**Shipped:** 2026-11-22  
**Phases:** 4 (`20`–`23`) | **Plans:** 8 | **Tasks:** 24

### What Was Built
- In-transit mishap cascade recovery (`mishapRecoveryService.js`) and pre-deletion resource interlock guards preventing order/route orphaning with actionable 409 conflict dialogs (`MISHAP-01..04`).
- Atomic dual-model stop progression sync across `Delivery` and `Route.stops` within MongoDB transactions, real-time multi-room Socket.IO broadcasts, and strict demo account sandbox isolation (`DRIVER-SYNC-01..02`, `DEMO-ISOLATION-01..02`).
- Live driver navigation marker oriented by incoming heading, live speed badge pill, 'Find Driver' auto-follow camera engine, status-differentiated map pins (dimmed dots, bold red slashes, pulsing active indigo), dual polyline segmentation, and collapsible glassmorphic Map Legend (`TELEM-MAP-01..04`).
- Fleet Tracking cockpit overhaul featuring 30-minute auto-hide grace period with live countdown and polyline clearing for completed routes, dedicated Archived directory tab, in-place vehicle status dropdown (`AVAILABLE` / `MAINTENANCE` / `RETIRED`) with reason modal, and remote manager GPS ping action (`FLEET-TRACK-01`, `FLEET-MAINT-01`, `TELEM-SYNC-01`).
- 1-tap continuous multi-waypoint Google Maps navigation in driver handheld views across all remaining uncompleted stops and amber stale telemetry visual indicators (`NAV-MULTI-01`, `TELEM-SYNC-01`).

### What Worked
- MongoDB multi-collection transactions wrapped via `withTransaction` completely eliminated data skew between `Route.stops` and `Delivery` collections during rapid field delivery updates.
- Decoupling completed routes from active map canvas clutter via the 30-minute grace period preserved dispatcher focus while retaining historical accountability.
- Chaining uncompleted stops into Google Maps continuous navigation URLs solved driver navigation friction in a single lightweight utility.

### What Was Inefficient
- Minor PowerShell syntax divergence (`&&` vs `;`) during compound command invocations.
- Vitest unit tests in jsdom required careful mocking of auth session network requests to minimize unhandled axios rejection logs in test output.

### Patterns Established
- Resource conflict responses should always return rich context (affected route codes, active delivery counts, driver names) so client modals can offer one-click atomic cascade remediations.
- Dynamic navigation URLs should always feature defensive truncation limits (capped at 15 waypoints) to respect mobile query string boundaries without degrading the user experience.

---

## Milestone: v9 — Telemetry, Driver HUD & Stabilized E2E CI Gating

**Shipped:** 2026-11-19  
**Phases:** 2 (`18`–`19`) | **Plans:** 8 | **Tasks:** 14

### What Was Built
- Supply chain audit pinning, 3-state circuit breaker mapping failover architecture, authenticated Socket.IO driver telemetry streaming with BOLA security, consolidated tamper-evident POD audit trails, and dual webServer Playwright orchestration running 4 critical user flows across isolated test databases in GitHub Actions.

### What Worked
- Dual webServer configuration in Playwright with `/healthz` readiness probe eliminated connection race conditions between Vite and Express during CI.
- Isolated `smartroute_e2e` database seeded deterministically guaranteed zero test state flakiness.

---

## Milestone: v6 — Deployment & Production Readiness

**Shipped:** 2026-11-11  
**Phases:** 4 (`11`–`14`) | **Plans:** 12 | **Tasks:** 27

### What Was Built
- Hardened Express 4, Socket.IO 4, Mongoose 8, and Vite 5 (`HARD-01..06`, `ORIG-01..02`) with fail-fast production env checks, Geoapify key unification, numeric `TRUST_PROXY`, shared Express/Socket.IO multi-origin CORS, external `/theme-init.js` with strict Helmet CSP + `COOP: same-origin-allow-popups`, `/healthz` & `/readyz`, idempotent `SIGTERM`/`SIGINT` drain, `SERVE_CLIENT=true` SPA isolation, and Split-Origin `VITE_API_URL`/`VITE_SOCKET_URL`.
- Cleaned monorepo dependency skew in `package.json`, declared missing server `axios@^1.7.2`, locked down `.dockerignore`, authored multi-stage non-root `Dockerfile` (`node:20-bookworm-slim`, `USER node`), and wired `docker-compose.yml` + `deploy/nginx/default.conf` (`CONT-01..03`).
- Built idempotent non-demo first-admin CLI (`server/src/scripts/bootstrapAdmin.js` `seed:admin`), `render.yaml` Blueprint, dual-root `vercel.json` / `client/vercel.json`, zero-dependency Node 20 `scripts/smoke-test.js`, and CI `SERVE_CLIENT=true` + `docker-and-compose` gates (`OPS-01..03`).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Quick Tasks | Key Change |
| --- | --- | --- | --- |
| v1–v5 (Cumulative) | 10 | 4 archived | Introduced Milestone Audit closure gate + live headless Chromium E2E CDP verification |
| v6 (Deployment) | 4 | 0 | Added plan-checker isolate-build dependency audits, cross-phase wiring checks, and 1:1 env/doc parity tests |
| v7–v8 (Dispatch & Admin) | 2 | 0 | Automated vehicle assignment and Admin user management with Dependabot security gating |
| v9 (E2E & Telemetry) | 2 | 0 | Dual webServer Playwright CI gating and 3-state mapping circuit breaker |
| v10 (Resilience & Fleet) | 4 | 0 | Atomic mishap cascade recovery, handheld stop sync, and fleet tracking overhaul |

### Cumulative Quality

| Milestone | Automated Suites | E2E Checks | Source LOC |
| --- | --- | --- | --- |
| v5 | 25/25 Jest (287/287 passed), `tsc` + Vite clean | 18/18 live Chromium CDP passed | 34,951 LOC (`server/src` + `client/src`) |
| v6 | 29/29 Jest (330/330 passed), `tsc` + Vite clean, `docker compose config -q` | Live in-process `SERVE_CLIENT=true` + `scripts/smoke-test.js` CI gates | 35,631 LOC (`server/src` + `client/src`) |
| v9 | 29/29 Jest (343/343 passed), 39/39 Vitest, `tsc` clean | 12/12 Playwright tests green in headless Chromium (48.4s) | 37,000 LOC (`server/src` + `client/src`) |
| v10 | 32/32 Jest (367/367 passed), 91/91 Vitest, `tsc` clean | 12/12 Playwright tests green in headless Chromium | 40,600 LOC (`server/src` + `client/src`) |

### Top Lessons (Verified Across Milestones)
1. Live multi-context browser verification catches state synchronization and CSS theme regressions that headless API tests miss.
2. Shared domain services (`savingsAnalyticsService`, `resourceGuardService`, `activeRouteReoptimizer`, `mishapRecoveryService`) keep RBAC roles aligned across dashboards.
