# Roadmap: SmartRoute — Last-Mile Delivery Optimization Platform

## Milestones

- ✅ **v5 Final PRD Completion & Audit Closure (Cumulative Phases 01–10)** — shipped `2026-11-11` ([`v5-ROADMAP.md`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.planning/milestones/v5-ROADMAP.md))
- 🚧 **v6 Deployment & Production Readiness (Phases 11–14)** — in progress

## Phases

<details>
<summary>✅ v5 Final PRD Completion & Audit Closure (Phases 01–10 + 4 Quick Tasks) — SHIPPED 2026-11-11</summary>

- [x] Phase 01: Operational Dispatch & Driver Workflow Stabilization — completed `2026-11-09`
- [x] Phase 02: Real Authentication, Google OAuth & OTP Verification — completed `2026-11-10`
- [x] Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI — completed `2026-11-10`
- [x] Phase 04: End-to-End Admin ↔ Fleet ↔ Driver Communication, State Sync & Dead-UI Cleanup — completed `2026-11-10`
- [x] Phase 05: Real Out-of-Band Email & SMS OTP Delivery + Zero Frontend OTP Leakage — completed `2026-11-10`
- [x] Phase 06: Control Center Dark Mode Unification & Uniform Sidebar Spacing — completed `2026-11-10`
- [x] Phase 07: Production Data Cleanup & Removable Prebuilt Demo Dataset Controls — completed `2026-11-10` (verified `2026-11-11`)
- [x] Phase 08: Driver Shift Odometer & Fuel/Charge Logs + Admin & Driver Savings Analytics — completed `2026-11-10`
- [x] Phase 09: Cross-Screen Operational Guards & Validation Polish (5/5 plans) — completed `2026-11-11`
- [x] Phase 10: Milestone 4 Audit Closure, PRD Analytics KPIs & Automatic Mid-Shift Re-Optimization (6/6 plans) — completed `2026-11-11`

</details>

### 🚧 v6 Deployment & Production Readiness (In Progress)

**Milestone Goal:** Make SmartRoute turnkey to containerize, configure, secure, verify, and deploy reliably across PaaS (Render/Railway/Vercel + MongoDB Atlas) and Docker/VPS environments.

- [x] **Phase 11: Server & Client Runtime Hardening** - Fail-fast production env/CORS/proxy/CSP hardening, health probes, graceful drain, `SERVE_CLIENT=true` SPA hosting, and split-origin client URL support (completed 2026-11-11)
- [ ] **Phase 12: Containerization & Nginx Reverse Proxy** - Workspace dependency cleanup, multi-stage non-root Dockerfile, and turnkey Nginx + MongoDB 6 Docker Compose stack
- [ ] **Phase 13: PaaS Manifests, Admin Bootstrap & CI/Smoke Verification** - Idempotent first-admin CLI, Render/Vercel manifests, zero-dependency smoke test script, and CI container/smoke gates
- [ ] **Phase 14: Audited Env Templates & Production Runbook** - 1:1 reconciled `.env.example` templates and verified Single-Origin, Split-Origin, and operational runbooks

## Phase Details

### Phase 11: Server & Client Runtime Hardening
**Goal**: Express, Socket.IO, Mongoose, and the Vite client enforce production security boundaries, proxy-aware rate limiting, readiness draining, and both Single-Origin (`SERVE_CLIENT=true`) and Split-Origin topologies.
**Depends on**: Nothing (first phase of v6; builds on shipped v5 codebase)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05, HARD-06, ORIG-01, ORIG-02
**Success Criteria** (what must be TRUE):
  1. Server refuses to boot in `NODE_ENV=production` when `MONGODB_URI`, strong `JWT_SECRET` / `JWT_REFRESH_SECRET` (>=32 chars, non-default), or required `CLIENT_ORIGIN` is missing or invalid, while resolving Geoapify keys consistently across `env.js`, `geoapify.service.js`, and `adminController.js`.
  2. Proxied requests carrying `X-Forwarded-For` are rate-limited by true client IP without `ERR_ERL_*` validation errors or duplicate `loginLimiter` stacking, and both Express HTTP and Socket.IO enforce normalized comma-separated `CLIENT_ORIGIN` allowlists.
  3. Helmet CSP and `same-origin-allow-popups` COOP headers protect served responses while permitting Google Identity Services popups, Geoapify/OSM/CARTO map tiles, Google Fonts, `ws:`/`wss:` sockets, and the inline boot script in `client/index.html` with zero console errors.
  4. `GET /healthz` reports liveness, `GET /readyz` returns `200` only when MongoDB `readyState === 1` (`503` when disconnected or draining) while preserving `/api/v1/health*`, and `SIGTERM`/`SIGINT` drains Socket.IO, HTTP keep-alive connections, and Mongoose cleanly within a 10s timeout alongside production Mongoose `autoIndex: false` and explicit `serverSelectionTimeoutMS`.
  5. With `SERVE_CLIENT=true`, the server serves `client/dist` with immutable `/assets/*` caching, `no-cache` on `index.html`, SPA fallback for browser routes, and strict JSON `404` on unknown `/api/*` paths; in Split-Origin builds (`VITE_API_URL` / `VITE_SOCKET_URL`), REST calls, token refresh, CSV exports, and Socket.IO target the configured API origin while defaulting to relative `/` paths.
**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — Production env fail-fast, Geoapify key unification, shared multi-origin CORS & Mongoose hardening
- [x] 11-02-PLAN.md — Client `/theme-init.js` CSP decoupling & Split-Origin `VITE_API_URL` / `VITE_SOCKET_URL` resolution
- [x] 11-03-PLAN.md — Express/Socket.IO proxy trust, Helmet CSP/COOP, probes, graceful drain, `SERVE_CLIENT=true` SPA hosting & integration suite

### Phase 12: Containerization & Nginx Reverse Proxy
**Goal**: Operators can build a lean, non-root production Docker image and launch a turnkey Single-Origin Nginx + App + MongoDB 6 Compose stack with working WebSocket upgrades and healthchecks.
**Depends on**: Phase 11
**Requirements**: CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. Root `package.json` removes skewed duplicate dependencies (`express-rate-limit`, `jest`, `supertest`, `leaflet`, `react-leaflet`) and aligns `"engines"` to Node `>=20.0.0`, while `.dockerignore` excludes `.env*`, `.git`, `**/node_modules`, `client/dist`, `.planning`, `tests`, and `scratch`.
  2. Multi-stage `Dockerfile` (`node:20-bookworm-slim`) scopes `VITE_*` build `ARG`s to `client-builder` without leaking runtime secrets, installs production workspace server deps, runs as non-root `USER node` on PID 1 (`CMD ["node", "server/src/index.js"]`), and passes its `/readyz` `HEALTHCHECK`.
  3. `docker compose up` starts `mongo:6.0` (persisted volume + `mongosh` ping healthcheck), single-instance `app` waiting on `service_healthy`, and `nginx:1.27-alpine` proxying HTTP/1.1 WebSocket upgrades (`86400s` read timeout on `/socket.io/`), `12m` max uploads, gzip, and immutable `/assets/` caching.
**Plans**: 2/3 plans executed

Plans:
- [x] 12-01-PLAN.md — Monorepo workspace dependency cleanup, Node >=20.0.0 engines alignment, and root .dockerignore
- [x] 12-02-PLAN.md — Multi-stage non-root Dockerfile (node:20-bookworm-slim) with builder-scoped VITE_* ARGs and /readyz HEALTHCHECK
- [ ] 12-03-PLAN.md — Production Nginx reverse proxy (deploy/nginx/default.conf) and turnkey Docker Compose stack (docker-compose.yml)

### Phase 13: PaaS Manifests, Admin Bootstrap & CI/Smoke Verification
**Goal**: Operators can provision an initial non-demo production admin, deploy declaratively to Render or Vercel, and verify live or CI deployments automatically via a zero-dependency smoke test.
**Depends on**: Phase 11, Phase 12
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. Running `npm --prefix server run seed:admin` idempotently creates an initial non-demo `ADMIN` (`isDemoData: false`) from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` via `User` model hooks (rejecting missing or weak passwords in production) without running or altering `seedBhubaneswar.js`.
  2. Declarative `render.yaml` (`SERVE_CLIENT=true`, `numInstances: 1`, `healthCheckPath: /readyz`, generated JWT secrets, `sync: false` external keys) and Vercel SPA rewrite + mirrored CSP/COOP header configuration (`vercel.json` / `client/vercel.json`) validate cleanly for Single-Origin and Split-Origin PaaS deploys.
  3. Running `node scripts/smoke-test.js` verifies `/healthz`, `/readyz`, `/api/v1/health`, `/api/v1/does-not-exist` JSON `404`, auth login behavior, CORS preflight headers, and SPA HTML delivery, and `.github/workflows/ci.yml` executes Docker build, `docker compose config -q`, and `SERVE_CLIENT=true` smoke checks against CI `mongo:6.0`.
**Plans**: TBD

### Phase 14: Audited Env Templates & Production Runbook
**Goal**: Operators have 1:1 code-verified environment variable templates and accurate step-by-step deployment runbooks covering local dev, Docker Compose, Render, and Vercel + Atlas.
**Depends on**: Phase 11, Phase 12, Phase 13
**Requirements**: OPS-04
**Success Criteria** (what must be TRUE):
  1. Root `.env.example`, `client/.env.example`, and `server/.env.example` (where present) reconcile 1:1 with all actual variables consumed across server config, Vite `import.meta.env`, Compose, and `bootstrapAdmin.js` with zero stale or conflicting keys.
  2. Root `README.md` provides copy-paste-verified runbooks for local development, Single-Origin (Docker Compose / Render `SERVE_CLIENT=true`), Split-Origin (Vercel + Render + Atlas), OAuth/Geoapify domain setup, `seed:admin`, and `scripts/smoke-test.js` verification.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 → 12 → 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Server & Client Runtime Hardening | v6 | 3/3 | Complete    | 2026-11-11 |
| 12. Containerization & Nginx Reverse Proxy | v6 | 2/3 | In Progress | - |
| 13. PaaS Manifests, Admin Bootstrap & CI/Smoke Verification | v6 | 0/TBD | Not started | - |
| 14. Audited Env Templates & Production Runbook | v6 | 0/TBD | Not started | - |
