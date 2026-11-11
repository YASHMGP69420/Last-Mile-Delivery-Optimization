# Project Research Summary

**Project:** SmartRoute — Last-Mile Delivery & Fleet Operations Platform (v6 Deployment & Production Readiness)
**Domain:** Production Deployment, Containerization, Reverse-Proxy Routing & Hardening (npm Workspaces Monorepo: React 18 / Vite 5 + Express 4 + Socket.IO 4 + MongoDB 6)
**Researched:** 2026-11-11
**Confidence:** HIGH

## Executive Summary

SmartRoute is already a full-featured single-hub logistics platform (`Express 4.22.3`, `Socket.IO 4.8.4`, `Mongoose 8.24.8`, `Helmet 7.2.0`, `express-rate-limit 7.5.1`, and `Vite 5.2.11` on `Node 20` + `MongoDB 6.0`) that requires **zero new runtime npm dependencies** to become production-ready. Experts deploy this class of stateful real-time monorepo using a **Single-Origin Primary** topology—either Docker Compose (`nginx:1.27-alpine` + `node:20-bookworm-slim` app + `mongo:6.0`) or a single persistent Node container (`SERVE_CLIENT=true` on Render/Railway)—with an optional **Split-Origin** PaaS variant (Vercel CDN frontend + Render/Railway persistent Node backend + MongoDB Atlas). Serving the SPA, `/api/v1/*`, and `/socket.io/*` from one origin eliminates cross-origin CORS preflights, simplifies Google Identity Services OAuth, and ensures WebSocket upgrades work reliably.

Across all four research streams, the recommended approach is surgical hardening at integration boundaries rather than architectural rewrites: fail-fast production environment validation (`server/src/config/env.js`), unified multi-origin CORS (`app.js` + `index.js`), proxy-aware rate limiting (`trust proxy` hop count), tuned Helmet v7 CSP + COOP (`same-origin-allow-popups`), root `/healthz` & `/readyz` probes with graceful `SIGTERM`/`SIGINT` drain, build-time `VITE_API_URL`/`VITE_SOCKET_URL` wiring in the client for split-origin support, a multi-stage monorepo `Dockerfile` + Nginx reverse proxy, declarative PaaS manifests (`render.yaml`, `vercel.json`), and an idempotent first-admin CLI decoupled from demo seeding.

The highest-severity deployment risks uncovered directly in the codebase are: (1) `client/src/api/client.ts` and `client/src/utils/socketClient.ts` hardcoding `/api/v1` and `/`, which breaks split-origin Vercel + Render deploys (and Vercel rewrites cannot proxy WebSockets); (2) `server/src/config/env.js` falling back to committed dev JWT secrets in production alongside a `GEOAPIFY_API_KEY` vs `GEOAPIFY_SERVER_API_KEY` mismatch between `adminController.js` and `geoapify.service.js`; (3) missing `trust proxy` and `contentSecurityPolicy: false` in `server/src/app.js`, which break `express-rate-limit` v7 behind proxies and leave JWTs exposed (while naive Helmet defaults break Google Sign-In, Geoapify/OSM tiles, fonts, and the inline theme script); and (4) empty production databases having zero `ADMIN` users since `seedBhubaneswar.js` only imports `isDemoData: true` records. Mitigating these in dependency order—code hardening first, container/proxy stack second, PaaS/CI/bootstrap automation third, and audited docs/templates last—yields a repeatable, verified production release.

---

## Key Findings

### Recommended Stack

SmartRoute's existing server and client dependencies already cover HTTP security, rate limiting, WebSockets, and bundling. Production readiness relies on container base images, reverse-proxy directives, PaaS specs, and Node 20 built-ins rather than adding third-party packages. See [STACK.md](./STACK.md) for exact versions and snippets.

**Core technologies:**
- **Node.js `node:20-bookworm-slim`:** Multi-stage Docker builder and runtime — matches CI (`node-version: 20`) and avoids Alpine `musl` incompatibilities with `npm ci` workspace symlinks and native binaries while keeping runtime images lean (~80–100 MB compressed).
- **Nginx `nginx:1.27-alpine`:** Docker Compose edge reverse proxy — handles HTTP/1.1 WebSocket upgrades (`Upgrade`, `Connection`, `86400s` timeouts) for `/socket.io/`, gzip compression, `12m` upload headroom (`express.json({ limit: '10mb' })`), and immutable asset caching.
- **MongoDB `mongo:6.0` / Atlas M0+:** Primary datastore — matches CI (`mongo:6.0`) and Mongoose `8.24.8`; uses `mongosh` ping healthchecks (`mongo` binary removed in 6.0) and requires `autoIndex: false` + `serverSelectionTimeoutMS: 10000–15000` in production.
- **Helmet `7.2.0` + Express `4.22.3` + `express-rate-limit` `7.5.1`:** Existing HTTP security stack — requires numeric `app.set('trust proxy', 1)` (never `true`), shared comma-separated CORS, and explicit CSP/COOP directives.
- **Node 20 Built-Ins (`fetch`, `server.closeIdleConnections()`, `process.env`):** Zero-dependency post-deploy smoke testing (`scripts/smoke-test.js`), fail-fast env validation, and clean HTTP keep-alive draining on `SIGTERM`/`SIGINT`.
- **Render Blueprint + Vercel SPA (PaaS):** Persistent single-instance Web Service (`render.yaml`) for Express + Socket.IO; optional `vercel.json` CDN hosting for `client/dist` only (never Vercel Serverless for Socket.IO).

### Expected Features

See [FEATURES.md](./FEATURES.md) for full acceptance criteria and dependency graphs.

**Must have (table stakes):**
- Reverse-proxy trust (`trust proxy` numeric hop count) + removal of duplicate `loginLimiter` in `app.js`
- Shared multi-origin CORS helper (`CLIENT_ORIGIN` comma-separated, trimmed, slash-normalized) across Express & Socket.IO
- Tuned Helmet v7 CSP & `COOP: same-origin-allow-popups` supporting Google Identity Services, Geoapify/OSM tiles, Google Fonts, and the inline theme script in `client/index.html`
- Root `/healthz` (liveness) & `/readyz` (MongoDB readiness, `503` while draining/disconnected) + `SIGTERM`/`SIGINT` graceful shutdown
- Optional single-origin SPA serving (`SERVE_CLIENT=true`) with strict `/api` 404 JSON isolation
- Split-origin client URL resolution (`VITE_API_URL` & `VITE_SOCKET_URL`) in `client/src/api/client.ts` and `client/src/utils/socketClient.ts`
- Fail-fast `NODE_ENV=production` validation in `env.js` + `GEOAPIFY_API_KEY` / `GEOAPIFY_SERVER_API_KEY` unification
- Multi-stage `Dockerfile` (non-root `node` user, `CMD ["node", "server/src/index.js"]`), `.dockerignore`, and `docker-compose.yml` + Nginx config
- Idempotent first-admin CLI (`bootstrapAdmin.js`) decoupled from `seedBhubaneswar.js`
- Audited `.env.example` templates and accurate production `README.md`

**Should have (differentiators):**
- Declarative PaaS manifests (`render.yaml` with `healthCheckPath: /readyz` + `vercel.json` SPA rewrites & security headers)
- Zero-dependency Node 20 automated post-deploy smoke script (`scripts/smoke-test.js`)
- CI `Dockerfile` build, `docker compose config -q`, and `SERVE_CLIENT=true` smoke check in `.github/workflows/ci.yml`
- Proper cache headers (`Cache-Control: public, max-age=31536000, immutable` on `/assets/*`; `no-cache` on `index.html`)

**Defer (v2+ / explicitly out of scope):**
- `@socket.io/redis-adapter`, sticky load balancing, and Redis-backed `tokenBlacklist` / rate limiting (single-instance stateful footprint suffices for v6; explicitly pin `numInstances: 1` / `replicas: 1`)
- Certbot/Let's Encrypt sidecars inside `docker-compose.yml` (terminate TLS at PaaS or host edge)
- Runtime `window.__ENV__` HTML injection (breaks CSP hashes; use build-time `VITE_*` + `SERVE_CLIENT=true`)
- Automated SSH CD push workflows, Prometheus/Grafana stack, and `D-17` Admin User UI

### Architecture Approach

SmartRoute deploys as a **Platform-Agnostic Single-Origin Primary** system (with **Split-Origin** supported via build-time client URLs and comma-separated CORS). All browser paths (`/`, `/assets/*`, `/api/v1/*`, `/socket.io/*`, `/healthz`, `/readyz`) terminate at a reverse proxy (Nginx in Docker Compose or PaaS Edge in Render/Railway), which forwards HTTP/1.1 + WebSocket upgrades to the persistent `node:20-bookworm-slim` process on port `5004`. See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and middleware ordering.

**Major components:**
1. **Edge / Reverse Proxy (`nginx/nginx.conf` or PaaS Edge):** Terminates TLS, forwards `X-Forwarded-*`, upgrades `/socket.io/` (`Upgrade`, `Connection`, `proxy_buffering off`, `86400s` timeouts), gzips responses, and enforces `12m` max body size.
2. **Hardened Express + Socket.IO Gateway (`server/src/app.js`, `index.js`, `config/env.js`, `config/cors.js`):** Validates prod secrets on boot, shares one `CLIENT_ORIGIN` validator, exposes `/healthz` & `/readyz`, isolates `/api/*` JSON 404s before optional `SERVE_CLIENT=true` SPA fallback, and drains `io` → `http.Server` → `Mongoose` on `SIGTERM`/`SIGINT`.
3. **Topology-Aware Client Bundle (`client/src/api/client.ts`, `utils/socketClient.ts`):** Defaults to relative `/api/v1` and `/` for single-origin & Vite dev proxy, while honoring build-time `VITE_API_URL` and `VITE_SOCKET_URL` for split-origin Vercel + Render deploys.
4. **Operations & Verification Tooling (`Dockerfile`, `docker-compose.yml`, `render.yaml`, `vercel.json`, `bootstrapAdmin.js`, `scripts/smoke-test.js`):** Reproducible container builds, PaaS blueprints, clean first-admin provisioning (`isDemoData: false`), and automated post-deploy smoke verification.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 10 pitfalls, warning signs, and recovery steps.

1. **Hardcoded `/api/v1` and `/` in Client + Vercel WebSocket Trap:** `client/src/api/client.ts` and `socketClient.ts` ignore `VITE_API_URL`, and Vercel rewrites cannot proxy WebSockets. **Avoid:** Wire `VITE_API_URL` and derived/explicit `VITE_SOCKET_URL` directly to the Render API origin; keep `vercel.json` strictly for SPA rewrites and headers.
2. **Vite Build-Time `VITE_*` Baking & Docker Secret Leakage:** Passing `VITE_*` only at container runtime leaves blank/localhost strings in `client/dist`, while passing `JWT_SECRET` or `GEOAPIFY_SERVER_API_KEY` as Docker `ARG`s leaks secrets into image history. **Avoid:** Scope `ARG VITE_*` strictly to the `client-builder` stage and keep `.env*` in `.dockerignore`.
3. **Missing `trust proxy` Breaking `express-rate-limit` v7 + Duplicate `loginLimiter`:** Without `app.set('trust proxy', 1)`, proxies trigger `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and bucket every fleet user under one IP (while `true` triggers `ERR_ERL_PERMISSIVE_TRUST_PROXY`). **Avoid:** Use numeric `TRUST_PROXY` (default `1` in prod) and remove the duplicate `loginLimiter` in `app.js`.
4. **Helmet v7 CSP/COOP Breaking Google OAuth, Maps, Fonts & Inline Theme:** Default `same-origin` COOP breaks Google Sign-In popups and strict CSP blocks Geoapify/OSM tiles, Google Fonts, and `client/index.html`'s dark-mode IIFE. **Avoid:** Configure explicit CSP allowlists (hash or allow the static theme script), set `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }`, disable `upgradeInsecureRequests` unless `FORCE_HTTPS_CSP=true`, and mirror headers in `vercel.json`.
5. **Dev Fallbacks, `GEOAPIFY_API_KEY` Drift & Workspace Lockfile Skew:** Production boots with hardcoded dev JWT secrets if `JWT_SECRET` is omitted; `adminController.js` checks `GEOAPIFY_API_KEY` while `geoapify.service.js` reads `GEOAPIFY_SERVER_API_KEY`; root `package.json` duplicates `express-rate-limit@^8.7.3` vs server `^7.2.0`. **Avoid:** Add fail-fast prod env checks, unify Geoapify key resolution in `env.js`, clean root `package.json` skew, and copy all workspace manifests into Docker stages.

---

## Implications for Roadmap

Based on dependencies across the codebase, container stack, PaaS targets, and verification gates, a **4-phase roadmap** minimizes rework and catches integration failures early:

### Phase 1: Server & Client Production Runtime Hardening
**Rationale:** Every downstream artifact (Docker, Nginx, Render, Vercel, Smoke tests) depends on the Express/Socket.IO server and Vite client honoring production env contracts, proxy headers, CSP/COOP, health probes, graceful shutdown, and split-origin URLs.
**Delivers:**
- Fail-fast `NODE_ENV=production` validation in `server/src/config/env.js` + `GEOAPIFY_SERVER_API_KEY` unification (updating `adminController.js`)
- Shared `server/src/config/cors.js` (`CLIENT_ORIGIN` comma-separated parser) wired into `app.js` and `index.js`
- `app.js` hardening: numeric `TRUST_PROXY`, removal of duplicate `loginLimiter`, tuned Helmet v7 CSP + `same-origin-allow-popups` COOP, `/healthz` & `/readyz` probes, `app.use('/api', notFoundHandler)` boundary, and conditional `SERVE_CLIENT=true` static/SPA fallback
- `index.js` & `db.js` hardening: idempotent `SIGTERM`/`SIGINT` graceful drain (`io.close()` → `server.close()` → `server.closeIdleConnections()` → `disconnectDB()`), `autoIndex: NODE_ENV !== 'production'`, and `serverSelectionTimeoutMS: 10000–15000`
- Client split-origin support in `client/src/api/client.ts` (`VITE_API_URL`) and `client/src/utils/socketClient.ts` (`VITE_SOCKET_URL` / derived origin)
- Jest + Supertest integration tests covering `/healthz`, `/readyz`, `/api/*` 404 JSON vs `SERVE_CLIENT=true` HTML fallback, multi-origin CORS, `X-Forwarded-For` rate limiting, Helmet CSP/COOP headers, and prod env validation failures
**Addresses:** Reverse-proxy trust, multi-origin CORS, Helmet CSP/COOP, `/healthz` & `/readyz`, graceful shutdown, `SERVE_CLIENT=true`, split-origin client URLs, fail-fast env validation.
**Avoids:** Pitfalls #1, #3, #4, #5 (CORS drift), #7, #8, #9.

### Phase 2: Multi-Stage Containerization & Nginx Reverse Proxy
**Rationale:** Once runtime behavior and `SERVE_CLIENT=true` / `VITE_*` wiring are verified in tests, packaging them into a deterministic multi-stage Docker image and Compose stack validates real reverse-proxy WebSocket upgrades, gzip/cache headers, and workspace lockfile resolution.
**Delivers:**
- Root `package.json` dependency skew cleanup (`express-rate-limit`, `jest`, `supertest`, `leaflet`, `react-leaflet`) and `"engines": { "node": ">=20.0.0", "npm": ">=10.0.0" }` alignment
- Strict `.dockerignore` excluding `.env*`, `.git`, `**/node_modules`, `client/dist`, `.planning`, `tests`, `scratch`
- Multi-stage `Dockerfile` (`node:20-bookworm-slim`) with `VITE_*` `ARG`s scoped to `client-builder`, production-only workspace install, non-root `USER node`, `/readyz` `HEALTHCHECK`, and `CMD ["node", "server/src/index.js"]`
- `nginx/nginx.conf` (`proxy_http_version 1.1`, `Upgrade`/`Connection`, `proxy_read_timeout 86400s`, `client_max_body_size 12m`, gzip, `/assets/` immutable caching) and `docker-compose.yml` (`mongo:6.0` with `mongosh` ping healthcheck + `app` + `nginx`, `replicas: 1`)
**Uses:** `node:20-bookworm-slim`, `nginx:1.27-alpine`, `mongo:6.0` (from STACK.md).
**Implements:** Primary Single-Origin Docker Compose topology (from ARCHITECTURE.md).
**Avoids:** Pitfalls #2, #5 (Nginx WS timeouts), #6, #7 (Nginx route precedence), #9 (Compose healthcheck & `SIGTERM` PID 1).

### Phase 3: PaaS Manifests, Admin Bootstrap & CI/Smoke Verification
**Rationale:** With the container and server runtime proven, automate production provisioning (`bootstrapAdmin.js`), add turnkey cloud manifests (`render.yaml`, `vercel.json`), and lock in regression protection via a zero-dep smoke script and CI Docker/smoke gates.
**Delivers:**
- Idempotent `server/src/scripts/bootstrapAdmin.js` (`npm run bootstrap:admin` / `seed:admin`) creating initial non-demo `ADMIN` from `BOOTSTRAP_ADMIN_*` env vars without touching `seedBhubaneswar.js`
- `render.yaml` Blueprint (single-origin `SERVE_CLIENT=true`, `numInstances: 1`, `healthCheckPath: /readyz`, generated JWT secrets, `sync: false` external keys)
- `vercel.json` (SPA fallback rewrite + mirrored CSP/COOP security headers + `/assets/*` immutable caching)
- Zero-dependency Node 20 `scripts/smoke-test.js` verifying `/healthz`, `/readyz`, `/api/v1/health`, `/api/v1/does-not-exist` JSON 404, auth login check, CORS headers, and SPA HTML delivery
- `.github/workflows/ci.yml` extension running `docker build`, `docker compose config -q`, and a `SERVE_CLIENT=true` + `scripts/smoke-test.js` check against CI `mongo:6.0`
**Addresses:** Turnkey PaaS manifests, automated smoke verification, CI Docker/env-contract gates, idempotent first-admin bootstrap.
**Avoids:** Pitfalls #1 (Vercel rewrite trap), #2 (CI placeholder leaks), #4 (Vercel CSP/COOP parity), #10 (empty DB lockout & accidental multi-instance scaling).

### Phase 4: Audited Env Templates & Production Deployment Runbook
**Rationale:** Documentation and `.env.example` templates should be finalized only after every variable name, script name, manifest path, and smoke command from Phases 1–3 is concrete and verified, guaranteeing copy-paste accuracy.
**Delivers:**
- Audited `.env.example`, `server/.env.example`, and `client/.env.example` mapped 1:1 to `env.js` and Vite `import.meta.env` keys (removing stale/conflicting `GEOAPIFY_API_KEY` ambiguity)
- Updated `README.md` (and `docs/DEPLOYMENT_GUIDE.md` reconciliation) covering Single-Origin (Docker Compose + Nginx, Render `SERVE_CLIENT=true`), Split-Origin (Vercel + Render + MongoDB Atlas), Google Cloud Console Authorized Origins, Geoapify referrer restrictions, first-admin bootstrap, demo dataset import/purge, and single-instance horizontal scaling prerequisites
**Addresses:** Audited `.env.example` & production `README.md` (table stakes).
**Avoids:** Operator misconfiguration, stale test counts/credentials in docs, and `SEED` vs `bootstrapAdmin` confusion.

### Phase Ordering Rationale

- **Runtime code before containers/manifests:** `Dockerfile`, `nginx.conf`, and `render.yaml` depend directly on `SERVE_CLIENT=true`, `/healthz`, `/readyz`, `TRUST_PROXY`, and `VITE_API_URL` existing in `server/` and `client/`.
- **Containers before CI/Smoke/Docs:** Finalizing `Dockerfile` and `docker-compose.yml` in Phase 2 lets Phase 3's CI job and `scripts/smoke-test.js` exercise the exact production artifacts, and Phase 4 documents verified commands rather than speculative ones.
- **Bootstrap & PaaS manifests together:** `render.yaml` pre-deploy/post-deploy instructions and smoke tests both rely on `bootstrapAdmin.js` existing and being idempotent.

### Research Flags

Phases likely needing deeper verification during planning/execution:
- **Phase 1 (CSP Hash & Live OAuth/Map Verification):** Compute the exact SHA-256 hash of `client/index.html`'s inline theme script (or verify `'unsafe-inline'` tradeoff) and validate zero CSP/COOP console errors in headless/live Chromium with Google Sign-In (`accounts.google.com/gsi/client`), Geoapify tiles, and OSM fallback tiles.
- **Phase 2 (Workspace Dependency Cleanup & Nginx Static Delivery Choice):** Verify `npm ci --omit=dev --workspace=server` inside `Dockerfile` after removing duplicate root `package.json` entries (`express-rate-limit@^8.7.3`, etc.), and confirm whether `nginx` serves `client/dist` via a `Dockerfile` target or proxies `/` to `app:5004` (`SERVE_CLIENT=true`) with Nginx `gzip` + asset caching.
- **Phase 3 (Monorepo Vercel Root Directory & CI Docker Execution Time):** Confirm `vercel.json` placement (`client/vercel.json` vs root `vercel.json` depending on Vercel Root Directory setting) and ensure CI Docker build caching keeps `.github/workflows/ci.yml` fast.

Phases with standard, well-documented patterns (minimal extra research needed):
- **Phase 4 (Env Audit & Runbook):** Straightforward 1:1 reconciliation against finalized Phase 1–3 files.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All runtime versions (`Express 4.22.3`, `Helmet 7.2.0`, `express-rate-limit 7.5.1`, `Socket.IO 4.8.4`, `Mongoose 8.24.8`, `Vite 5.2.11`) directly verified from workspace manifests and lockfile; Docker/Nginx/Node 20 patterns well established. |
| Features | **HIGH** | Every table-stakes item and gap traced directly to exact lines in `server/src/*`, `client/src/*`, `.github/workflows/ci.yml`, and `.env.example`. |
| Architecture | **HIGH** | Single-origin vs split-origin request flows, middleware order, and external integration boundaries verified against codebase and official Helmet/GIS/Render/Vercel specs. |
| Pitfalls | **HIGH** | All 10 pitfalls grounded in real observed bugs/risks in the repo (e.g., hardcoded `/api/v1` in `client.ts`, `GEOAPIFY_API_KEY` mismatch in `adminController.js`, duplicate `loginLimiter`, missing `SIGTERM` handler). |

**Overall confidence:** **HIGH**

### Gaps to Address

- **Nginx Static Serving Strategy in Docker Compose:** `STACK.md` proposes copying `client/dist` into `nginx` (`root /usr/share/nginx/html`), whereas `ARCHITECTURE.md` notes stock `nginx:1.27-alpine` proxying `/` to `app:5004` (`SERVE_CLIENT=true`) avoids a second Nginx Dockerfile. Decide one canonical pattern during Phase 2 planning (recommended: multi-target `Dockerfile` with an `nginx` target copying `client/dist` for maximum static performance, OR stock `nginx:1.27-alpine` + `SERVE_CLIENT=true` for single-build simplicity).
- **Root `package.json` Unused Dependency Cleanup:** Verify whether anything in root scripts, tests, or `client`/`server` imports root `express-rate-limit@^8.7.3`, `jest@^30.5.2`, `supertest@^7.3.2`, `leaflet`, or `react-leaflet` before pruning them in Phase 2.
- **Live Cloud PaaS Verification Limits:** Local planning/CI can verify `Dockerfile`, `docker-compose.yml`, `render.yaml` YAML syntax, `vercel.json` JSON validity, and `scripts/smoke-test.js` against local Docker/Compose, while actual Render/Vercel/Atlas cloud provisioning requires live operator credentials during release rollout.

---

## Sources

### Primary (HIGH confidence — Direct Workspace Inspection)
- Root & Workspace Manifests: `package.json`, `server/package.json`, `client/package.json`, `.env.example`, `client/.env.example`, `.github/workflows/ci.yml`, `README.md`, `docs/DEPLOYMENT_GUIDE.md`
- Backend Source: `server/src/app.js`, `server/src/index.js`, `server/src/config/env.js`, `server/src/config/db.js`, `server/src/routes/index.js`, `server/src/routes/authRoutes.js`, `server/src/middleware/rateLimiter.js`, `server/src/middleware/auth.js`, `server/src/middleware/errorHandler.js`, `server/src/models/User.js`, `server/src/controllers/authController.js`, `server/src/controllers/adminController.js`, `server/src/services/mapping/geoapify.service.js`, `server/src/services/demoDataService.js`, `server/src/seed/seedBhubaneswar.js`
- Frontend Source: `client/index.html`, `client/vite.config.ts`, `client/src/App.tsx`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/src/components/auth/GoogleSignInButton.tsx`, `client/src/components/maps/InteractiveMap.tsx`

### Secondary (MEDIUM confidence — Official Ecosystem & Platform Docs)
- Helmet v7 (`helmetjs.github.io`) — default `Cross-Origin-Opener-Policy: same-origin` & `upgrade-insecure-requests` behaviors
- Google Identity Services (`developers.google.com`) — CSP (`accounts.google.com/gsi/*`) and `COOP: same-origin-allow-popups` requirements
- `express-rate-limit` v7 — strict `trust proxy` validation (`ERR_ERL_PERMISSIVE_TRUST_PROXY`, `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`)
- Socket.IO v4 + Nginx — HTTP/1.1 `Upgrade`/`Connection` and `proxy_read_timeout 86400s` reverse-proxy configuration
- Render Blueprint (`render.yaml`) & Vercel (`vercel.json`) — `healthCheckPath`, `rewrites` SPA routing, and external WebSocket rewrite limitations

---
*Research completed: 2026-11-11*
*Ready for roadmap: yes*
