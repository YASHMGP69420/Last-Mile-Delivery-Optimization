# Milestones

## v6 Deployment & Production Readiness (Shipped: 2026-11-11)

**Phases completed:** 4 phases, 12 plans, 27 tasks (`2026-11-11`, `67` commits since `v5`, `35,631` source LOC)
**Closeout type:** `verified_closeout` (Known verification overrides: 0 newly acknowledged, 1 carried forward [`01-UAT.md`])

**Key accomplishments:**
- Fail-fast production environment validation (`HARD-01`), unified `GEOAPIFY_SERVER_API_KEY` resolution across service and admin endpoints, shared multi-origin Express/Socket.IO CORS delegation (`HARD-03`), and production Mongoose connection hardening (`HARD-06`).
- Extracted synchronous `/theme-init.js` out of `client/index.html` for strict `'self'` CSP and wired build-time `VITE_API_URL` / `VITE_SOCKET_URL` resolution across Axios REST and Socket.IO clients.
- Hardened Express (`createApp()`), Socket.IO entrypoint (`index.js`), health probes (`/healthz`, `/readyz`), idempotent `SIGTERM`/`SIGINT` connection draining, Helmet v7 CSP/COOP (`same-origin-allow-popups`), and `SERVE_CLIENT=true` SPA serving, verified across all 27 server Jest suites (317 tests) and client TypeScript/Vite build.
- Pruned skewed root dependencies, aligned monorepo engines to Node >=20.0.0 / npm >=10.0.0 with explicit `server` `axios@^1.7.2`, refreshed `package-lock.json` hoisting with Linux optional binaries preserved, and locked down `.dockerignore` for Docker builds.
- Created multi-stage non-root production `Dockerfile` (`node:20-bookworm-slim`, builder-scoped `VITE_*` ARGs, production workspace server install, `USER node`, native Node 20 `fetch('/readyz')` `HEALTHCHECK`, exec-form `CMD ["node", "server/src/index.js"]`).
- Authored `deploy/nginx/default.conf` (WebSocket `/socket.io/` upgrades, `86400s` timeouts, `12m` body limit, gzip, `$http_host` forwarding, immutable `/assets/` caching) and root `docker-compose.yml` (`mongo:6.0` + single-instance `app` + `nginx:1.27-alpine`), validated offline via `docker compose config -q` and missing-secret rejection.
- Implemented the idempotent, non-demo production first-admin bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`) and exposed `seed:admin` / `bootstrap:admin` in `server/package.json` with pre-DB credential validation and `User.create` bcrypt hook delegation.
- Authored declarative Single-Origin Render Blueprint (`render.yaml`) and dual-root Split-Origin Vercel SPA manifests (`vercel.json` and `client/vercel.json`) aligned 1:1 with Phase 11 runtime hardening, Helmet CSP/COOP directives, and static asset caching.
- Delivered the zero-dependency Node 20 post-deploy smoke verifier (`scripts/smoke-test.js`), root monorepo helper scripts, upgraded `.github/workflows/ci.yml` with live `SERVE_CLIENT=true` + `docker-and-compose` smoke gates, and passing integration/contract tests (`server/tests/ops_bootstrap_smoke.test.js`) alongside the full 325-test server suite and client TypeScript/Vite build.
- Reconciled `.env.example` (49 keys), `server/.env.example` (36 keys), and `client/.env.example` (5 keys) 1:1 with v6 runtime, Docker Compose, admin bootstrap, and smoke-test consumers with zero disallowed JWT secrets or weak admin passwords.
- Rewrote root `README.md` as the canonical v6 deployment and operations runbook (`Node >= 20.0.0`, `seed:admin`, Docker Compose, Render Blueprint, Vercel + Atlas Split-Origin, OAuth/Geoapify, and `scripts/smoke-test.js`) and aligned `docs/DEPLOYMENT_GUIDE.md` with shipped v6 infrastructure
- Added `server/tests/env_docs_audit.test.js` (5/5 passing) enforcing 1:1 env template parity, secret hygiene, and v6 runbook accuracy, and verified full green server Jest (29 suites / 330 tests), client `tsc --noEmit`, and Vite production build (`1706` modules) with real `.env` files untouched.

---

## v5 Final PRD Completion & Audit Closure (Shipped: 2026-11-11)

**Phases completed:** 10 phases, 19 plans, 27 tasks (`2026-11-04` -> `2026-11-11`, `110+` commits, `34,951` source LOC)
**Closeout type:** `verified_closeout` (Known verification overrides: 1 newly acknowledged [`01-UAT.md` status: `passed`, 0 open scenarios], 0 carried forward)

**Key accomplishments:**
- Operational dispatch stabilization, real Google OAuth & Email/SMS OTP authentication, GSAP motion glassmorphism, Socket.IO room sync, Industrial Carbon & Zinc dark mode + white mobile default
- Zero-orphan demo dataset isolation (`isDemoData` across 7 core + 10 secondary models) & Admin demo controls (`TC-DEMO-1..3` + `07-VERIFICATION.md`)
- Vehicle telemetry baseline schemas, shared tank-cap & odometer continuity validators, MAINTENANCE/RETIRED shift clock-in blocks, and terminal delivery BOLA/state locks
- Unified consignment create/edit/CSV validation parity with minute-parsed time windows, batch active-route close/delete locks, and Last-Admin + vehicle RETIRE protection
- Shared `resourceGuardService` active-shift/route interlocks (`409 ACTIVE_OPERATION_CONFLICT`), Admin `lastOdometerKm` typo override & positive vehicle/maintenance validation, driver phone validation parity, and vehicle CSV dry-run DB duplicate detection
- Driver handheld telemetry continuity hints without prefill, unit-aligned L vs % inspection validation, cockpit maintenance/inspection guards, and terminal route stop locks
- Added Admin Fleet Vehicle Edit/Maintenance/Retire modals and CSV collision guards, Create/Edit Consignment validation parity, and non-blocking multi-vehicle batch composition across the Admin & Operations SPA
- Indexed `isDemoData` added across all 9 remaining secondary operational Mongoose schemas and propagated server-side from demo batches, vehicles, and drivers onto `Route`, `VehicleAssignment`, `RouteAssignment`, and `AuditEvent` documents.
- Hardened `demoDataService.deleteDemoDataset()` for zero-orphan multi-collection cascade purge after optimization/dispatch, verified via `TC-DEMO-3`, and authored `.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md`.
- Shared `GET /api/v1/admin/analytics` endpoint (`ADMIN` + `FLEET_MANAGER`) backed by `getAnalyticsSummary()` returning synchronized fleet savings, PRD KPIs, and Planned vs Actual (`Route` vs `DriverShift`) metrics while keeping `/admin/overview` strictly `ADMIN`-only.
- Implemented `HEAVY_TRAFFIC` (`2.0x`) scaling, reusable `reoptimizeActiveRoute` with terminal-stop locking and live GPS anchoring, dual `route:reordered`/`route:updated` Socket.IO broadcasts, automatic `ROUTE_OBSTRUCTION` rerouting in `reportIncident`, dispatcher `POST /api/v1/routes/:id/reoptimize`, and `TC-REOPT-1..3` integration tests.
- Wired `HEAVY_TRAFFIC`, `AdminApi.getAnalytics()`, and `RoutesApi.reoptimize()`, synchronized `FLEET_MANAGER` Control Center savings without `DRAFT` route inflation, upgraded `AnalyticsPage.tsx` with all PRD KPIs and Planned vs Actual (`Route` vs `DriverShift`) comparison in Carbon & Zinc dark mode, and connected live `route:reordered`/`route:updated` Socket.IO sync and reroute triggers across `TrackingPage.tsx` and `DriverSupportPage.tsx`.

---
