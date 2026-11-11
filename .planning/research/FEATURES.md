# Feature Research

**Domain:** Production Deployment & Operations Readiness for an Express 4 + Socket.IO 4 + Vite React 18 + MongoDB 6 Monorepo (`SmartRoute v6`)
**Researched:** 2026-11-11
**Confidence:** HIGH (verified directly against existing `server/src/*`, `client/src/*`, `.github/workflows/ci.yml`, `.env.example`, and official Helmet/Render/Vercel patterns)

---

## Feature Landscape

### Table Stakes (Non-Negotiable for Production Deployment)

Features operators, PaaS platforms, and browsers assume exist. Missing any of these breaks real-world deployments behind proxies, TLS terminators, or multi-origin hosts.

| Feature | Why Expected | Complexity | Notes & Existing Codebase Dependencies |
|---------|--------------|------------|----------------------------------------|
| **Reverse-Proxy Trust (`trust proxy`)** | PaaS load balancers (Render, Railway, Nginx) terminate TLS and set `X-Forwarded-For` / `X-Forwarded-Proto`. Without `app.set('trust proxy', 1)`, `express-rate-limit` v7 throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and logs/rate-limits the proxy IP instead of client IPs. | LOW | **Deps:** `server/src/app.js` (mount `loginLimiter`), `server/src/middleware/rateLimiter.js` (`authRateLimiter`, `operationalRateLimiter` on `/api/v1/auth/*` and `/api/v1/batches/*`). Make hop count configurable via `TRUST_PROXY` env (default `1` in prod, `false` in local/test). **Acceptance:** Request with `X-Forwarded-For: 203.0.113.10` resolves `req.ip === '203.0.113.10'` and triggers no `express-rate-limit` validation error. |
| **Shared Multi-Origin CORS (Express + Socket.IO)** | Split-origin (Vercel frontend + Render API) and custom domains require multiple allowed origins (preview URLs, custom domain, `www`/apex). Currently `allowedOrigins` is duplicated in `server/src/app.js` and `server/src/index.js` and only reads a single `CLIENT_ORIGIN` string. | LOW | **Deps:** Extract shared `parseAllowedOrigins()` helper used by both `app.js` (`cors()`) and `index.js` (`new Server(server, { cors })`). Support comma-separated `CLIENT_ORIGINS` / `CLIENT_ORIGIN` with whitespace trimming and trailing-slash normalization. **Acceptance:** Preflight `OPTIONS` and Socket.IO polling handshake from any origin in `CLIENT_ORIGIN` return `Access-Control-Allow-Origin: <origin>` + `Vary: Origin`; unlisted origins receive CORS rejection in `NODE_ENV=production`. |
| **Tuned Helmet CSP & COOP for Geoapify + Google OAuth** | `server/src/app.js` currently disables `contentSecurityPolicy: false`. Leaving CSP off exposes the served SPA to XSS, whereas enabling default Helmet CSP breaks Leaflet tiles (`maps.geoapify.com`, `tile.openstreetmap.org`), Google Fonts, inline theme boot script in `client/index.html`, and Google Identity Services (`accounts.google.com/gsi/client`). Default Helmet COOP (`same-origin`) also breaks Google Sign-In popups. | MEDIUM | **Deps:** `client/index.html` (inline `<script>` theme loader + `fonts.googleapis.com` / `fonts.gstatic.com`), `client/src/components/auth/GoogleSignInButton.tsx` (`https://accounts.google.com/gsi/client`), `client/src/components/map/InteractiveMap.tsx` (`maps.geoapify.com`, `tile.openstreetmap.org`). Set `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }`, allow `ws:`/`wss:` + API/Geoapify/Google in `connect-src`, `https://accounts.google.com` in `script-src`/`frame-src`, and hash/allow the inline theme snippet in `client/index.html`. **Acceptance:** Served SPA loads with zero CSP/COOP console violations in Chromium for map tiles, fonts, Socket.IO upgrade, and Google Sign-In button. |
| **Root Liveness (`/healthz`) & Readiness (`/readyz`) Probes** | Docker `HEALTHCHECK`, Nginx upstream checks, Kubernetes, and Render `healthCheckPath` expect root-level fast probes (`/healthz` for process liveness, `/readyz` returning `503` until MongoDB `readyState === 1`). Currently probes only live at `/api/v1/health` and `/api/v1/health/ready`. | LOW | **Deps:** Keep `/api/v1/health` and `/api/v1/health/ready` in `server/src/routes/index.js` for backward compatibility, and expose `/healthz` (always `200` unless shutting down -> `503`) and `/readyz` (`200` when `mongoose.connection.readyState === 1` and not draining, else `503`) in `app.js` before rate-limiters/auth/SPA fallback. **Acceptance:** `GET /healthz` returns `200`; `GET /readyz` returns `503` when DB disconnected or draining, `200` when DB connected. |
| **Graceful Shutdown (`SIGTERM` / `SIGINT`)** | Container orchestrators (Docker, Render) send `SIGTERM` before killing a process on deploy/restart. Without graceful shutdown, in-flight HTTP requests fail with `502`, Socket.IO driver telemetry drops abruptly, and MongoDB sockets leak. | LOW | **Deps:** `server/src/index.js`, `server/src/config/db.js` (`disconnectDB`). Track `isShuttingDown` flag (flip `/readyz` to `503`), call `io.close()`, `server.close()`, and `disconnectDB()`, with a hard `10s` safety timeout (`unref()`) forcing `process.exit(1)` if hung. **Acceptance:** Sending `SIGTERM` logs drain sequence, rejects new readiness checks with `503`, closes HTTP/Socket/Mongo cleanly, and exits `0`. |
| **Optional Single-Origin SPA Serving (`SERVE_CLIENT=true`)** | Single-origin deployments (Render Web Service, Docker monolithic app container) serve `client/dist` directly from Express so API, WebSockets, and UI share one origin with zero CORS friction. | LOW | **Deps:** `server/src/app.js` (mount `express.static` + SPA `GET *` fallback to `client/dist/index.html` **after** `/api/v1`, `/healthz`, `/readyz`, and **before** `notFoundHandler`, explicitly skipping `/api/*` and `/socket.io/*` so missing API endpoints still return JSON `404`). Fail clearly if `SERVE_CLIENT=true` and `client/dist/index.html` is missing. **Acceptance:** With `SERVE_CLIENT=true`, `GET /dashboard` returns `200 text/html`; `GET /api/v1/does-not-exist` still returns `404 JSON`. |
| **Split-Origin Client API & Socket URL Configuration** | `client/src/api/client.ts` currently hardcodes `baseURL: '/api/v1'`, `axios.post('/api/v1/auth/refresh')`, and `exportCsvUrl` `/api/v1/...`, while `client/src/utils/socketClient.ts` hardcodes `io('/')`. In split-origin deployments (Vercel frontend + Render backend), requests hit Vercel instead of the Render API unless `VITE_API_URL` (and Socket origin) are wired. | MEDIUM | **Deps:** `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/.env.example`. Resolve API base from `import.meta.env.VITE_API_URL || '/api/v1'` (stripping trailing slash) for `apiClient`, `refreshAccessToken()`, and `exportCsvUrl()`, and derive Socket.IO target origin from `import.meta.env.VITE_SOCKET_URL` or the origin of `VITE_API_URL` (defaulting to `'/'` for single-origin/Vite dev proxy). **Acceptance:** When built with `VITE_API_URL=https://api.example.com/api/v1`, REST calls, token refresh, CSV export URLs, and Socket.IO target `https://api.example.com`; when unset, all target same-origin `/`. |
| **Fail-Fast Production Environment Validation** | `server/src/config/env.js` currently falls back to hardcoded insecure defaults (`smartroute_super_secret_jwt_key_2026_bhubaneswar`, localhost MongoDB). Running production with fallback JWT secrets or mismatched Geoapify env names (`GEOAPIFY_API_KEY` in `adminController.js` vs `GEOAPIFY_SERVER_API_KEY` in `geoapify.service.js`) silently creates severe security and config bugs. | LOW | **Deps:** `server/src/config/env.js`, `server/src/controllers/adminController.js`, `server/src/services/mapping/geoapify.service.js`. In `NODE_ENV=production`, validate at boot: `MONGODB_URI` present (not localhost unless explicitly allowed), `JWT_SECRET` & `JWT_REFRESH_SECRET` >= 32 chars and not default placeholders, `CLIENT_ORIGIN` set (unless `SERVE_CLIENT=true`), and unify `GEOAPIFY_SERVER_API_KEY` / `GEOAPIFY_API_KEY` lookup. **Acceptance:** Booting with `NODE_ENV=production` and missing/weak `JWT_SECRET` exits non-zero immediately with actionable stderr message; `NODE_ENV=test`/`development` preserves local dev ergonomics. |
| **Multi-Stage Production `Dockerfile` & `.dockerignore`** | Required for reproducible container builds without shipping `node_modules` devDependencies, `.git`, `.planning`, `tests/`, or local `.env` files into the runtime image. | MEDIUM | **Deps:** Root `package.json` (`workspaces: ["server", "client"]`), `server/package.json`, `client/package.json`. Multi-stage build: Stage 1 builds `client/dist` (`npm ci` + `npm --prefix client run build`); Stage 2 installs production workspace deps (`npm ci --omit=dev --workspace=server`) and runs as non-root `node` user with `HEALTHCHECK` against `/readyz`. Note root `package.json` also lists `express-rate-limit`/`leaflet`/`react-leaflet`—verify workspace install covers `server` runtime deps cleanly. **Acceptance:** `docker build` succeeds cleanly on clean checkout, image excludes `.env`/tests/docs, runs as non-root user, and serves `/healthz` + SPA when `SERVE_CLIENT=true`. |
| **Docker Compose Stack (Nginx + App + MongoDB 6)** | Turnkey single-command local production simulation and VPS deployment. Must proxy WebSockets (`/socket.io/` with `Upgrade`/`Connection` headers + long read timeout), `/api/`, and SPA static assets or upstream app container while waiting on healthy MongoDB. | MEDIUM | **Deps:** `docker-compose.yml`, `deploy/nginx/default.conf` (or `nginx.conf`), MongoDB 6.0 service with named volume and `mongosh` ping healthcheck, app service `depends_on: mongodb: condition: service_healthy`. Nginx must set `proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `proxy_read_timeout 86400s` for Socket.IO. **Acceptance:** `docker compose up -d --build` reaches healthy state; browser loads SPA, logs in, and upgrades Socket.IO to `websocket` via Nginx with `0` console errors. |
| **Audited `.env.example` & Production `README.md`** | Operators cannot configure deployments if `.env.example` omits variables (`SERVE_CLIENT`, `TRUST_PROXY`, `ADMIN_*`, `VITE_SOCKET_URL`), duplicates/conflicts (`GEOAPIFY_API_KEY` vs `GEOAPIFY_SERVER_API_KEY`), or if `README.md` cites outdated test counts (`151 passed`), old `seedBhubaneswar.js` credentials (`admin123` no longer seeded), and outdated deploy steps. | LOW | **Deps:** `.env.example`, `client/.env.example`, `README.md`. Reconcile every env variable actually read by `server/src/config/env.js`, controllers, and `client/src/*`; document Single-Origin (Docker/Render) vs Split-Origin (Vercel + Render + Atlas) flows, first-admin bootstrap, and demo dataset import. **Acceptance:** Every env var in `.env.example` maps 1:1 to code usage; README commands work copy-paste on fresh clone. |
| **Idempotent First-Admin Bootstrap Script** | `server/src/seed/seedBhubaneswar.js` was intentionally refactored to only import `isDemoData: true` records without hardcoded admin passwords. A fresh production MongoDB Atlas database therefore starts with **zero** `ADMIN` users and no UI registration path to elevate to `ADMIN`. | LOW | **Deps:** `server/src/models/User.js` (pre-save bcrypt hook, `role: ROLES.ADMIN`, `emailVerified: true`, `isDemoData: false`), `server/package.json` (`seed:admin`). Script reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` from env (refuses weak/missing password in production), checks if an `ADMIN` with that email (or any active non-demo `ADMIN`) already exists, creates idempotently if absent, and never touches `isDemoData`. **Acceptance:** Running `npm --prefix server run seed:admin` twice creates exactly 1 `ADMIN` user (`isDemoData: false`), second run is a safe no-op (`exit 0`), and credentials authenticate via `POST /api/v1/auth/login`. |

---

### Differentiators (High-Value Operational Reliability)

Features that separate a fragile "it works on my laptop" repo from a confident, repeatable turnkey release.

| Feature | Value Proposition | Complexity | Notes & Existing Codebase Dependencies |
|---------|-------------------|------------|----------------------------------------|
| **Turnkey PaaS Manifests (`render.yaml` + `vercel.json`)** | Enables 1-click Render Blueprint deployment (single-origin Node/Docker service with `healthCheckPath: /readyz`, auto-generated `JWT_SECRET`/`JWT_REFRESH_SECRET`) and zero-404 React Router deep-linking on Vercel (`vercel.json` rewrites + security headers). | LOW | **Deps:** `render.yaml` at repo root, `client/vercel.json` (plus `vercel.json` or root-directory guidance for monorepo Vercel imports). Include `sync: false` for secrets like `MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`, `GOOGLE_CLIENT_ID`. **Acceptance:** `render.yaml` passes YAML/Blueprint schema validation; `vercel.json` rewrites `/admin/analytics` and `/driver/route` to `/index.html` without rewriting `/assets/*`. |
| **Automated Post-Deploy Smoke Verification Script** | Replaces manual curl/browser guesswork after deploying to Render/Docker/Vercel. Confirms live deployment health, DB readiness, auth rejection on invalid creds (or real login when creds supplied), CORS headers, and SPA HTML delivery in one command. | LOW | **Deps:** `scripts/smoke-test.js` (zero extra deps — uses Node 20 native `fetch`, matching `"node": ">=18.0.0"`). Supports `--api-url` and optional `--client-url`, checks `/healthz`, `/readyz`, `/api/v1/health`, `/api/v1/auth/login` (`400`/`401` on bad payload, optional `200` with `SMOKE_EMAIL`/`SMOKE_PASSWORD`), CORS preflight headers, and SPA `index.html` content check. **Acceptance:** Exits `0` against running Compose/Render stack with clear pass/fail table; exits non-zero on degraded DB or `5xx`. |
| **CI Production Build, Docker & Env-Contract Gates** | `.github/workflows/ci.yml` currently runs `tsc`, `vite build`, and `jest` tests, but never verifies that `Dockerfile` builds, `docker-compose.yml` validates, or `SERVE_CLIENT=true` / production env validation works. Catching broken Dockerfiles or missing build args in CI prevents failed deploys. | LOW | **Deps:** `.github/workflows/ci.yml`. Add a `docker-build-and-smoke` (or `deploy-checks`) job running `docker build`, `docker compose config -q`, and a containerized `/healthz` check (or starting Express against the CI `mongo:6.0` service with `SERVE_CLIENT=true` + running `scripts/smoke-test.js`). **Acceptance:** CI fails on broken `Dockerfile`, invalid `docker-compose.yml`, missing `client/dist` build, or failed smoke probe. |
| **Nginx Static Asset Cache-Control & Compression** | Properly caching hashed Vite assets (`/assets/*.js`, `/assets/*.css` with `immutable`, 1y TTL) while setting `no-cache` on `index.html` prevents stale SPA bundle mismatches after deploys. Same headers can apply in Express `SERVE_CLIENT` mode. | LOW | **Deps:** `deploy/nginx/default.conf` and `express.static` options in `server/src/app.js` (`maxAge: '1y', immutable: true` for `/assets`, `no-cache` for `index.html`). **Acceptance:** `index.html` returns `Cache-Control: no-cache`; `/assets/*.js` returns `Cache-Control: public, max-age=31536000, immutable`. |

---

### Anti-Features (Explicitly Out of Scope — Avoid Building)

Features that commonly cause scope creep, fragility, or operational hazards in this milestone.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Redis Socket.IO Adapter & Horizontal Multi-Pod Clustering** | "What if we scale to 10 API instances?" | Adds Redis infrastructure, connection secrets, and split-state complexity when SmartRoute's single-hub Bhubaneswar workload and target PaaS (Render single instance / single Docker VPS) run single-node cleanly, and `express-rate-limit` is already in-memory. | Document single-instance stateful assumption; keep Socket.IO `polling` + `websocket` behind Nginx/Render sticky single instance. Defer Redis adapter until multi-instance scaling is actually required. |
| **Custom TLS / Let's Encrypt Certbot Automation Inside `docker-compose.yml`** | "Production needs HTTPS!" | Certbot sidecars fail in local Compose tests, conflict with Cloudflare/Render/ALB TLS termination, and break port-80/443 bindings across heterogeneous VPS setups. | Terminate TLS at PaaS (Render/Vercel) or host reverse proxy (Caddy/host Nginx/Cloudflare), while container Nginx listens on `:80` and forwards `X-Forwarded-Proto`. |
| **Runtime-Injected `window.__ENV__` Script Generation** | "Build once, configure Vite env vars at runtime." | Unnecessary complexity for Render/Vercel/Docker Compose where build args (`VITE_*`) are standard; adds custom shell entrypoint sed-patching `index.html` which breaks SRI/CSP hashes. | Standard Vite build-time `VITE_*` variables + Single-Origin `SERVE_CLIENT=true` (where `VITE_API_URL` isn't even needed because relative `/api/v1` and `/` work across all environments). |
| **Automated CD Auto-Deploy Hooks / SSH Push Scripts in GitHub Actions** | "Push to main should SSH into VPS and deploy." | Requires live cloud credentials, SSH keys, and host targets that do not exist in-repo and cannot be verified in this milestone. | Provide verified CI build/Docker/smoke gates + declarative `render.yaml` / `vercel.json` / `docker-compose.yml` for Git-connected PaaS auto-deploys. |
| **Application Feature Changes (D-17 Admin User UI, POD OTP, Prometheus/Grafana Stack)** | "While we're doing ops, let's add metrics dashboards or admin user UI." | Direct scope creep violating `PROJECT.md` Out-of-Scope boundaries; adds UI/DB risk to a milestone focused strictly on deployment & readiness. | Keep focus 100% on deployment hardening, containers, manifests, docs, bootstrap seed, and smoke test. |

---

## Feature Dependencies

```
[Audited Env Contract & Fail-Fast env.js]
    ├──required by──> [Multi-Origin CORS + trust proxy + Helmet CSP/COOP]
    ├──required by──> [Idempotent First-Admin Bootstrap (seed:admin)]
    └──required by──> [Dockerfile & docker-compose.yml]
                          └──required by──> [CI Docker/Smoke Gate]

[Split-Origin Client URL Wiring (VITE_API_URL / Socket origin)]
    └──required by──> [vercel.json (Split-Origin Frontend)]

[SERVE_CLIENT=true Static SPA Serving]
    ├──depends on──> [Tuned Helmet CSP + COOP (Geoapify + Google OAuth + inline theme)]
    └──required by──> [Single-Origin Render Blueprint (render.yaml) & Docker Monolith]

[/healthz + /readyz Probes] + [Graceful SIGTERM/SIGINT Shutdown]
    └──required by──> [Docker HEALTHCHECK + Nginx upstream + Render healthCheckPath]
                          └──required by──> [Post-Deploy Smoke Test Script]
```

### Dependency Notes

- **CSP/COOP depends on `SERVE_CLIENT=true` context:** In split-origin mode, Vercel serves `index.html` and Express only serves JSON APIs; in single-origin mode (`SERVE_CLIENT=true` or Nginx), Express serves `index.html`, making Helmet CSP & COOP (`same-origin-allow-popups`) immediately user-facing for Leaflet tiles and Google Sign-In.
- **`trust proxy` must precede `express-rate-limit`:** `app.set('trust proxy', ...)` must be configured at the top of `server/src/app.js` before `loginLimiter` and `routes` (`authRateLimiter`, `operationalRateLimiter`) handle proxied requests.
- **SPA fallback must sit between routes and `notFoundHandler`:** In `server/src/app.js`, mounting `SERVE_CLIENT` static middleware + wildcard `GET *` fallback after `/api/v1` and `/healthz`/`/readyz` but **before** `notFoundHandler` ensures React Router deep links work while unknown `/api/*` paths still return structured JSON `404`.
- **Nginx WebSocket headers are mandatory for Socket.IO:** `client/src/utils/socketClient.ts` uses `transports: ['polling', 'websocket']`; Nginx must proxy `/socket.io/` with HTTP/1.1 `Upgrade` and `Connection "upgrade"` headers or live driver GPS & dispatch updates fall back to long-polling or fail with `400`/`502`.
- **`seed:admin` depends on `User` model hooks:** `server/src/models/User.js` already hashes `passwordHash` in its `pre('save')` hook and enforces `ROLES.ADMIN` — `seed:admin` should use `User.create` / `save` (not `insertOne`) so schema validation and bcrypt hashing execute identically to production auth.

---

## Milestone Scope Definition (SmartRoute v6)

### Include in v6 (Table Stakes + High-ROI Differentiators)

- [ ] **Server Hardening (`server/src/app.js`, `server/src/index.js`, `server/src/config/env.js`):** `trust proxy`, shared comma-separated `CLIENT_ORIGIN` CORS helper for Express + Socket.IO, Helmet CSP + `same-origin-allow-popups` COOP, `/healthz` + `/readyz`, `SIGTERM`/`SIGINT` graceful shutdown, `SERVE_CLIENT=true` SPA serving, fail-fast production env validation, and `GEOAPIFY_API_KEY` / `GEOAPIFY_SERVER_API_KEY` unification.
- [ ] **Split-Origin Client Support (`client/src/api/client.ts`, `client/src/utils/socketClient.ts`):** Wire `VITE_API_URL` (and Socket origin) cleanly while preserving relative `/api/v1` and `/` defaults for Single-Origin & Vite dev proxy.
- [ ] **Containerization (`Dockerfile`, `.dockerignore`, `docker-compose.yml`, `deploy/nginx/default.conf`):** Multi-stage build, non-root runtime, MongoDB 6 healthcheck, Nginx reverse proxy with WebSocket upgrade + SPA caching.
- [ ] **PaaS Manifests (`render.yaml`, `client/vercel.json`):** Declarative Render Blueprint (`healthCheckPath: /readyz`, generated secrets) and Vercel SPA rewrite config.
- [ ] **Bootstrap, Smoke Verification & CI (`server/src/seed/seedAdmin.js`, `scripts/smoke-test.js`, `.github/workflows/ci.yml`):** Idempotent `seed:admin`, zero-dependency Node smoke script, and CI build/Docker/smoke verification.
- [ ] **Documentation & Env Guides (`.env.example`, `client/.env.example`, `README.md`):** Audited env templates and accurate production deployment instructions for Single-Origin and Split-Origin topologies.

### Defer Beyond v6

- [ ] **Redis Socket.IO Adapter & Sticky Load Balancing:** Defer until multi-instance horizontal scaling is required.
- [ ] **Prometheus/OpenTelemetry Metrics & Log Aggregation Stack:** Defer until multi-hub observability is needed; structured startup/shutdown/health JSON suffices for v6.
- [ ] **Admin User Management UI (`D-17`):** Explicitly out of scope; CLI `seed:admin` covers initial production provisioning.

---

## Feature Prioritization Matrix

| Feature | Operational Value | Implementation Cost | Priority |
|---------|-------------------|---------------------|----------|
| `trust proxy` + Multi-origin CORS + Fail-fast `env.js` | HIGH | LOW | **P1** |
| `/healthz` & `/readyz` + Graceful `SIGTERM`/`SIGINT` shutdown | HIGH | LOW | **P1** |
| Helmet CSP + COOP (`same-origin-allow-popups`) + `SERVE_CLIENT=true` | HIGH | MEDIUM | **P1** |
| Split-origin `VITE_API_URL` / Socket origin in `client/src` | HIGH | LOW | **P1** |
| Multi-stage `Dockerfile`, `.dockerignore`, `docker-compose.yml` + Nginx | HIGH | MEDIUM | **P1** |
| Idempotent `seed:admin` script | HIGH | LOW | **P1** |
| Audited `.env.example` + accurate `README.md` | HIGH | LOW | **P1** |
| `render.yaml` + `vercel.json` manifests | MEDIUM | LOW | **P1** |
| Post-deploy `scripts/smoke-test.js` | HIGH | LOW | **P1** |
| CI Docker/Compose & smoke check job in `.github/workflows/ci.yml` | MEDIUM | LOW | **P2** |
| Nginx asset cache headers & gzip | MEDIUM | LOW | **P2** |

---

## Deployment Topology Comparison

| Aspect | Single-Origin (Docker Compose + Nginx or Render `SERVE_CLIENT=true`) | Split-Origin (Vercel Frontend + Render API + MongoDB Atlas) |
|--------|----------------------------------------------------------------------|-------------------------------------------------------------|
| **Client API/Socket URLs** | Relative `/api/v1` and `/` (zero rebuild needed per domain) | Requires build-time `VITE_API_URL` (and derived/explicit Socket origin) |
| **CORS & Auth Friction** | Minimal (same-origin requests; CORS only needed if extra domains hit API) | Requires `CLIENT_ORIGIN` listing Vercel prod + preview URLs |
| **WebSocket Upgrade** | Handled by Nginx (`proxy_http_version 1.1`, `Upgrade`) or direct Render Node service | Direct to Render API host (`wss://api...`); Vercel does not proxy WebSockets |
| **SPA Deep-Link Routing** | Nginx `try_files $uri /index.html` or Express `SERVE_CLIENT` wildcard | Handled by `vercel.json` `rewrites` to `/index.html` |
| **Static Asset Performance** | Served via Nginx (with `gzip` + `immutable` cache) or Express static | Served via Vercel global Edge CDN |

---

## Sources

- **Codebase Inspection (HIGH confidence):**
  - `server/src/app.js`, `server/src/index.js`, `server/src/config/env.js`, `server/src/config/db.js`, `server/src/routes/index.js`, `server/src/middleware/rateLimiter.js`, `server/src/models/User.js`, `server/src/seed/seedBhubaneswar.js`, `server/src/controllers/adminController.js`, `server/src/services/mapping/geoapify.service.js`
  - `client/index.html`, `client/vite.config.ts`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/src/components/auth/GoogleSignInButton.tsx`, `client/src/components/map/InteractiveMap.tsx`
  - `.env.example`, `client/.env.example`, `.github/workflows/ci.yml`, `README.md`, `docs/DEPLOYMENT_GUIDE.md`
- **External Platform & Security Documentation (HIGH confidence):**
  - Helmet v7 & Google Identity Services CSP (`script-src`/`frame-src`/`connect-src` `https://accounts.google.com`) and COOP (`same-origin-allow-popups`)
  - Render Blueprint (`render.yaml`) specification (`healthCheckPath`, `envVars`, `generateValue`, `sync: false`)
  - Vercel `vercel.json` SPA rewrite specification (`"source": "/(.*)"` -> `"destination": "/index.html"`)

---
*Feature research for: SmartRoute v6 Deployment & Production Readiness*
*Researched: 2026-11-11*
