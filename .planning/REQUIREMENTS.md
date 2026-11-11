# Requirements: SmartRoute — Deployment & Production Readiness (v6)

**Defined:** 2026-11-11
**Core Value:** Calculate fuel-optimal, traffic-aware delivery routes end-to-end across dispatchers and field drivers while maintaining strict operational data integrity, real-time synchronization, and honest production telemetry.

## v6 Requirements

Requirements for Milestone **v6 — Deployment & Production Readiness**. Each requirement maps to an atomic phase (`11`–`14`) in [ROADMAP.md](./ROADMAP.md).

### Server Hardening & Runtime (`HARD`)

- [ ] **HARD-01**: Server fails fast on `NODE_ENV=production` boot when `MONGODB_URI`, `JWT_SECRET` (>=32 chars, non-default), `JWT_REFRESH_SECRET` (>=32 chars, non-default), or `CLIENT_ORIGIN` (when `SERVE_CLIENT !== 'true'`) is missing/invalid, and unifies `GEOAPIFY_SERVER_API_KEY` / `GEOAPIFY_API_KEY` lookup across `env.js`, `geoapify.service.js`, and `adminController.js`
- [ ] **HARD-02**: Express sets numeric `trust proxy` (`TRUST_PROXY`, default `1` in production) before rate limiters so proxied `X-Forwarded-For` client IPs resolve accurately without `ERR_ERL_*` errors, and duplicate `loginLimiter` stacking in `app.js` is removed
- [ ] **HARD-03**: Shared `parseAllowedOrigins()` helper parses comma-separated, trimmed, trailing-slash-normalized `CLIENT_ORIGIN` values consistently across Express (`app.js`) and Socket.IO (`index.js`)
- [ ] **HARD-04**: Tuned Helmet v7 Content Security Policy and `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` protect the served app while permitting Google Identity Services (`accounts.google.com`), Geoapify/OSM/CARTO map tiles, Google Fonts, `ws:`/`wss:`, and the inline theme boot script in `client/index.html` with zero console errors
- [ ] **HARD-05**: Root `/healthz` (process liveness) and `/readyz` (MongoDB `readyState === 1` returning `503` when disconnected or draining) plus idempotent `SIGTERM`/`SIGINT` graceful shutdown (`io.close()` -> `server.close()` -> `server.closeIdleConnections()` -> `disconnectDB()`, 10s safety timeout) drain active connections cleanly while keeping `/api/v1/health` and `/api/v1/health/ready`
- [ ] **HARD-06**: Production Mongoose config sets `autoIndex: NODE_ENV !== 'production'` and explicit `serverSelectionTimeoutMS` (`10000`–`15000` ms) for reliable Atlas failover

### Origin Topology & SPA Serving (`ORIG`)

- [ ] **ORIG-01**: Optional `SERVE_CLIENT=true` mode serves `client/dist` (`Cache-Control: public, max-age=31536000, immutable` on `/assets/*`, `no-cache` on `index.html`) and falls back non-`/api/*`, non-`/socket.io/*`, non-asset GET routes to `index.html` while keeping unknown `/api/*` requests returning JSON `404` and failing clearly if `client/dist/index.html` is missing
- [ ] **ORIG-02**: Client REST module (`client/src/api/client.ts`: `baseURL`, refresh token post, CSV export URL) and Socket.IO client (`client/src/utils/socketClient.ts`) honor build-time `VITE_API_URL` and derived/explicit `VITE_SOCKET_URL` for Split-Origin deploys while defaulting to relative `/` paths for Single-Origin and Vite dev proxy

### Containers & Reverse Proxy (`CONT`)

- [ ] **CONT-01**: Root `package.json` cleans duplicated/skewed dependencies (`express-rate-limit`, `jest`, `supertest`, `leaflet`, `react-leaflet`), aligns `"engines"` to Node `>=20.0.0`, and `.dockerignore` excludes `.env*`, `.git`, `**/node_modules`, `client/dist`, `.planning`, `tests`, and `scratch`
- [ ] **CONT-02**: Multi-stage `Dockerfile` (`node:20-bookworm-slim`) scopes `VITE_*` build `ARG`s to the `client-builder` stage, installs production workspace server deps, runs as non-root `USER node`, includes `/readyz` `HEALTHCHECK`, and starts PID 1 with `CMD ["node", "server/src/index.js"]`
- [ ] **CONT-03**: Turnkey `docker-compose.yml` + `deploy/nginx/default.conf` wires `mongo:6.0` (named volume + `mongosh` ping healthcheck), single-instance `app` (`depends_on: service_healthy`), and `nginx:1.27-alpine` (HTTP/1.1 WebSocket `Upgrade`/`Connection` headers, `86400s` read timeout on `/socket.io/`, `12m` max body size, gzip, and immutable `/assets/` caching)

### PaaS, CI, Bootstrap & Documentation (`OPS`)

- [ ] **OPS-01**: Idempotent first-admin CLI script (`server/src/scripts/bootstrapAdmin.js`, exposed as `npm --prefix server run seed:admin`) creates an initial non-demo `ADMIN` (`isDemoData: false`) from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` via `User` model hooks (rejecting missing/weak passwords in production) without running or altering `seedBhubaneswar.js`
- [ ] **OPS-02**: Turnkey PaaS manifests provide root `render.yaml` Blueprint (`SERVE_CLIENT=true`, `numInstances: 1`, `healthCheckPath: /readyz`, generated JWT secrets, `sync: false` external keys) and Vercel SPA rewrite + mirrored CSP/COOP security header config (`vercel.json` / `client/vercel.json`)
- [ ] **OPS-03**: Zero-dependency Node 20 post-deploy smoke script (`scripts/smoke-test.js`) validates `/healthz`, `/readyz`, `/api/v1/health`, `/api/v1/does-not-exist` JSON `404`, auth login behavior, CORS preflight headers, and SPA HTML delivery, and `.github/workflows/ci.yml` executes Docker build, `docker compose config -q`, and `SERVE_CLIENT=true` + smoke test checks against CI `mongo:6.0`
- [ ] **OPS-04**: Root `.env.example`, `client/.env.example`, and `server/.env.example` (where present) reconcile 1:1 with actual code variables, and root `README.md` provides verified runbooks for local dev, Single-Origin (Docker Compose / Render), Split-Origin (Vercel + Render + Atlas), `seed:admin`, and smoke verification

---

## Future Requirements (Deferred Beyond v6)

- **SCALE-01**: `@socket.io/redis-adapter` + Redis-backed `tokenBlacklist` and `express-rate-limit` store for horizontal multi-instance API scaling
- **OBS-01**: Prometheus metrics endpoint and OpenTelemetry/Grafana stack beyond structured health/startup/shutdown logs
- **ADMIN-01**: `D-17` Admin User Management UI (initial production admin covered via CLI `seed:admin` in v6)

---

## Out of Scope

| Feature | Reason |
| --- | --- |
| Redis cluster / horizontal multi-pod Socket.IO scaling | Single-instance hub workload runs cleanly without Redis infrastructure complexity (`numInstances: 1` explicitly configured in manifests) |
| Embedded Let's Encrypt / Certbot sidecars in `docker-compose.yml` | Conflicts with PaaS/Cloudflare/host TLS termination and local Compose smoke runs |
| Runtime `window.__ENV__` HTML sed-injection scripts | Breaks Helmet CSP hashes; Vite build `ARG`s + `SERVE_CLIENT=true` handle both topologies cleanly |
| GitHub Actions SSH/auto-deploy push workflows | Requires external live server SSH keys/tokens unavailable in-repo |
| New product features (`D-17` User UI, POD OTP) | Deferred outside v6 deployment readiness scope per `PROJECT.md` |

---

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| HARD-01 | Phase 11 | Pending |
| HARD-02 | Phase 11 | Pending |
| HARD-03 | Phase 11 | Pending |
| HARD-04 | Phase 11 | Pending |
| HARD-05 | Phase 11 | Pending |
| HARD-06 | Phase 11 | Pending |
| ORIG-01 | Phase 11 | Pending |
| ORIG-02 | Phase 11 | Pending |
| CONT-01 | Phase 12 | Pending |
| CONT-02 | Phase 12 | Pending |
| CONT-03 | Phase 12 | Pending |
| OPS-01 | Phase 13 | Pending |
| OPS-02 | Phase 13 | Pending |
| OPS-03 | Phase 13 | Pending |
| OPS-04 | Phase 14 | Pending |

**Coverage:**
- v6 requirements: 15 total
- Mapped to phases: 15 (Traceability will be finalized by `gsd-roadmapper`)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-11*
*Last updated: 2026-11-11 after v6 milestone research*
