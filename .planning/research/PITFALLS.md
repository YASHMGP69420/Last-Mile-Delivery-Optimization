# Pitfalls Research: SmartRoute Deployment & Production Readiness (v6)

**Domain:** Last-mile delivery platform (npm workspaces monorepo: React/Vite + Express + Socket.IO + MongoDB + Google OAuth + Geoapify + Helmet + express-rate-limit) across Docker Compose, Render/Railway, and Vercel + Render topologies
**Researched:** 2026-11-11
**Confidence:** HIGH (grounded in direct codebase inspection + verified library/platform behavior)

---

## Critical Pitfalls

### Pitfall 1: Hardcoded Same-Origin API & Socket.IO URLs + Vercel WebSocket Rewrite Trap

**What goes wrong:**
In a split-origin deployment (e.g., `client` on Vercel at `https://smartroute.vercel.app` and `server` on Render at `https://smartroute-api.onrender.com`), every REST call and Socket.IO connection fails or silently receives Vercel's HTML `index.html` instead of JSON / WebSocket upgrades. Attempting to paper over this with a `vercel.json` rewrite for `/socket.io/*` also fails because Vercel rewrites do not proxy WebSocket upgrade handshakes to external origins.

**Why it happens:**
- [`client/src/api/client.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/api/client.ts#L5-L49) hardcodes `baseURL: '/api/v1'` on `apiClient` and `axios.post('/api/v1/auth/refresh', ...)` on line 47 — it completely ignores `import.meta.env.VITE_API_URL` even though [`.env.example`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.env.example#L28) and [`.github/workflows/ci.yml`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.github/workflows/ci.yml#L44) already define `VITE_API_URL`.
- [`client/src/utils/socketClient.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/utils/socketClient.ts#L7-L19) hardcodes `io('/', { path: '/socket.io', ... })`.
- Local dev masks both issues because [`client/vite.config.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/vite.config.ts#L17-L27) proxies `/api` and `/socket.io` (`ws: true`) to `http://127.0.0.1:5004`.

**How to avoid:**
1. Update `client/src/api/client.ts` to resolve `const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');` and use `${API_BASE_URL}/auth/refresh` for token refresh (using `apiClient` or the resolved `API_BASE_URL` consistently).
2. Update `client/src/utils/socketClient.ts` to resolve `VITE_SOCKET_URL` (or derive the origin from `VITE_API_URL` by stripping `/api/v1`, falling back to `'/'` only when `VITE_API_URL` is unset or relative for single-origin Docker/Nginx/Render `SERVE_CLIENT=true`).
3. Keep `vercel.json` limited to SPA fallback rewrites (`/(.*) -> /index.html`) and security headers; point Vercel's `VITE_API_URL` directly at `https://<render-service>.onrender.com/api/v1` (with matching `CLIENT_ORIGIN` on Render).

**Warning signs:**
- Network tab shows `GET /api/v1/...` or `GET /socket.io/?EIO=4&transport=polling` returning HTTP `200` with `Content-Type: text/html` (the SPA shell) or `404` on Vercel.
- `DriverSocketContext` stays stuck in `reconnecting` / `disconnected` in split-origin staging.

**Phase to address:**
Phase 1 (Server & Client Production Wiring) and Phase 3 (PaaS Manifests: `render.yaml`, `vercel.json`).

---

### Pitfall 2: Vite Build-Time `VITE_*` Baking & Multi-Stage Docker Secret Leakage

**What goes wrong:**
Setting `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, or `VITE_GEOAPIFY_TILE_API_KEY` only as runtime container environment variables (in `docker-compose.yml` `environment:` or Render runtime env) leaves the compiled SPA with empty or CI-placeholder values. Conversely, passing server secrets (`JWT_SECRET`, `GEOAPIFY_SERVER_API_KEY`, `MONGODB_URI`, `SMTP_PASS`) as Docker `ARG`s or `VITE_*` variables bakes credentials permanently into image layer history or public browser JS bundles.

**Why it happens:**
Vite (`^5.2.11`) statically inlines `import.meta.env.VITE_*` strings during `npm run build` (`vite build`). Once `client/dist/` is produced, Node/Nginx runtime env vars cannot alter compiled JS chunks. Additionally, [`.github/workflows/ci.yml`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.github/workflows/ci.yml#L43-L46) sets placeholder build values (`VITE_API_URL: http://localhost:5004/api/v1`, `VITE_GEOAPIFY_TILE_API_KEY: ci_placeholder_tile_key`) which will break production if that build artifact is ever promoted.

**How to avoid:**
1. Declare `ARG VITE_API_URL=/api/v1`, `ARG VITE_SOCKET_URL=`, `ARG VITE_MAP_PROVIDER=geoapify`, `ARG VITE_GEOAPIFY_TILE_API_KEY=`, and `ARG VITE_GOOGLE_CLIENT_ID=` **exclusively inside the `client-builder` stage** of the multi-stage `Dockerfile` (converting them to `ENV` only inside that builder stage).
2. Never pass `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`, or SMTP/SMS secrets as `ARG`s in any Dockerfile stage.
3. Restrict `VITE_GEOAPIFY_TILE_API_KEY` by HTTP Referrer in the Geoapify console, because it is intentionally bundled into client JS ([`InteractiveMap.tsx`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/maps/InteractiveMap.tsx#L187)).

**Warning signs:**
- Maps silently fall back to CSS-inverted `tile.openstreetmap.org` despite `VITE_GEOAPIFY_TILE_API_KEY` being set in `docker-compose.yml` `environment:`.
- `GoogleSignInButton.tsx` renders its unconfigured warning (`VITE_GOOGLE_CLIENT_ID` empty) even though the env var is set on the running container.
- `grep -r "localhost:5004" client/dist/` returns hits in a production container image.

**Phase to address:**
Phase 2 (Multi-Stage Docker & Compose) and Phase 3 (CI Build Verification & PaaS Manifests).

---

### Pitfall 3: Missing `trust proxy` Breaking `express-rate-limit` v7 Behind Proxies

**What goes wrong:**
[`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L9-L65) never calls `app.set('trust proxy', ...)`, while [`server/package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/package.json#L21) uses `express-rate-limit` `^7.2.0`. Behind Nginx, Render, or Railway (all of which send `X-Forwarded-For`):
1. With Express's default `trust proxy = false`, `express-rate-limit` v7+ logs/throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and assigns **every user across the entire fleet** to the same single IP bucket (`127.0.0.1` or Docker bridge `172.x`), locking out all dispatchers and drivers after 30 login attempts in 15 minutes.
2. Naively setting `app.set('trust proxy', true)` (boolean `true`) causes `express-rate-limit` v7+ to throw `ERR_ERL_PERMISSIVE_TRUST_PROXY` because attackers can spoof leftmost `X-Forwarded-For` headers to bypass rate limits.

**Why it happens:**
`express-rate-limit` v7 added strict proxy validation (`validate.xForwardedForHeader` and `validate.trustProxy`), and SmartRoute additionally stacks two separate auth limiters on `/api/v1/auth/login`: `loginLimiter` (`max: 100`) in [`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L52-L65) and `authRateLimiter` (`max: 30`) in [`server/src/middleware/rateLimiter.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/middleware/rateLimiter.js#L7-L16) mounted via [`authRoutes.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/routes/authRoutes.js#L9-L15).

**How to avoid:**
1. Set a numeric proxy hop count via env (`TRUST_PROXY`, default `1` in production when behind Nginx/Render/Railway, `0` when exposed directly): `app.set('trust proxy', env.TRUST_PROXY)` (parsed as integer `0`, `1`, `2`, etc., or explicit subnet — never boolean `true` in production).
2. Remove the duplicate `loginLimiter` in `server/src/app.js` and keep `authRateLimiter` in `rateLimiter.js` as the single auth rate-limit policy.

**Warning signs:**
- Server logs contain `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false` or `ERR_ERL_PERMISSIVE_TRUST_PROXY`.
- Multiple users on different mobile networks receive `429 Too many authentication attempts` simultaneously.

**Phase to address:**
Phase 1 (Server Production Hardening).

---

### Pitfall 4: Helmet v7 CSP & COOP Breaking Google Sign-In, Geoapify Tiles, Fonts & Inline Theme Script

**What goes wrong:**
[`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L12-L17) currently disables both `contentSecurityPolicy: false` and `crossOriginResourcePolicy: false`. Simply enabling default `helmet()` breaks four core SmartRoute UI features simultaneously:
1. **Google Identity Services (`GoogleSignInButton.tsx`):** Default `script-src 'self'` blocks `https://accounts.google.com/gsi/client`; default `frame-src 'self'` blocks Google's sign-in iframe; default `Cross-Origin-Opener-Policy: same-origin` breaks `postMessage` / popup credential handoff.
2. **Inline Theme Bootstrap (`client/index.html` lines 10–38):** Default `script-src 'self'` blocks the inline `smartroute-theme` IIFE, causing dark-mode FOUC or failing theme initialization.
3. **Map Tiles & Custom Markers (`InteractiveMap.tsx`):** Default `img-src 'self' data:` blocks `https://maps.geoapify.com` and `https://*.tile.openstreetmap.org`; inline SVG marker styles and Leaflet CSS need `style-src` / `img-src data: blob:`.
4. **Typography (`client/index.html` lines 39–44):** Default CSP blocks `https://fonts.googleapis.com` (`style-src`) and `https://fonts.gstatic.com` (`font-src`).

**Why it happens:**
Helmet `^7.1.0` enables strict `Content-Security-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and `Cross-Origin-Resource-Policy: same-origin` by default. Note also that in a split-origin deployment (Vercel + Render), Helmet headers on Render only protect API responses — `vercel.json` must carry the frontend CSP/COOP headers for `index.html`.

**How to avoid:**
1. Configure Helmet in `server/src/app.js` with an explicit directive allowlist:
   - `scriptSrc`: `["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://apis.google.com']` (or replace `'unsafe-inline'` with the SHA-256 hash of `client/index.html`'s inline theme script — preferred if static).
   - `styleSrc`: `["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com']`.
   - `fontSrc`: `["'self'", 'data:', 'https://fonts.gstatic.com']`.
   - `imgSrc`: `["'self'", 'data:', 'blob:', 'https://maps.geoapify.com', 'https://*.tile.openstreetmap.org', 'https://*.googleusercontent.com', 'https://*.gstatic.com']`.
   - `frameSrc`: `["'self'", 'https://accounts.google.com', 'https://gsi.gstatic.com']`.
   - `connectSrc`: `["'self'", 'ws:', 'wss:', 'https://accounts.google.com', 'https://*.googleapis.com', ...allowedOrigins]` (include Geoapify API if client ever queries it, plus `VITE_API_URL` / `ws:` / `wss:` origins).
2. Set `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` and `crossOriginResourcePolicy: { policy: 'cross-origin' }` (needed for split-origin API/assets).
3. Mirror these CSP & COOP headers in `vercel.json` for split-origin deployments.

**Warning signs:**
- Browser console shows `Refused to load the script 'https://accounts.google.com/gsi/client'` or `Cross-Origin-Opener-Policy policy would block the window.closed call`.
- Blank grey Leaflet map canvas with `Refused to load the image 'https://maps.geoapify.com/...'`.

**Phase to address:**
Phase 1 (Server Production Hardening) and Phase 3 (Vercel Manifest Headers).

---

### Pitfall 5: Nginx WebSocket Upgrade Stripping, 60s Idle Disconnects & Express/Socket.IO CORS Drift

**What goes wrong:**
1. Behind Nginx in Docker Compose, Socket.IO (`transports: ['polling', 'websocket']`) fails to upgrade to WebSockets (`400 Bad Request` or `WebSocket connection failed`) and/or drops live connections every 60 seconds with `transport close`.
2. In production, [`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L20-L40) and [`server/src/index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L12-L33) duplicate `allowedOrigins` using a single `CLIENT_ORIGIN` string (not comma-separated) and bypass CORS whenever `NODE_ENV !== 'production'`. Adding a second origin (custom domain + `www.`, or Vercel preview + prod URL) breaks either REST or Socket.IO if one list is updated and the other isn't.

**Why it happens:**
- Nginx defaults to `proxy_http_version 1.0`, strips hop-by-hop `Connection` headers, and enforces `proxy_read_timeout 60s`. Socket.IO's default `pingInterval` + `pingTimeout` can stay quiet across idle stretches, causing Nginx to close the TCP stream before the next heartbeat.
- `CLIENT_ORIGIN` is currently treated as a scalar string (`process.env.CLIENT_ORIGIN || 'http://localhost:5173'`) rather than a comma-separated list, and trailing slashes (`https://app.example.com/`) fail exact `includes(origin)` comparisons because browser `Origin` headers never include a trailing slash.

**How to avoid:**
1. In Nginx `location /socket.io/`:
   - Set `proxy_http_version 1.1;`
   - Set `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection "upgrade";`
   - Set `proxy_read_timeout 86400s;` and `proxy_send_timeout 86400s;`
   - Forward `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`.
2. Create a single shared `getAllowedOrigins()` helper in `server/src/config/env.js` that splits `CLIENT_ORIGIN` on commas, trims whitespace, strips trailing slashes, and only appends localhost dev origins when `NODE_ENV !== 'production'`. Import it in both `app.js` and `index.js`.

**Warning signs:**
- Socket.IO falls back permanently to `?transport=polling` in Network tab (101 Switching Protocols never appears).
- Driver cockpit / TrackingPage cycles between `connected` and `reconnecting` every ~60s on idle tabs.
- `Socket.IO CORS blocked` errors in server logs when accessing via `www.` or custom domain while REST works (or vice versa).

**Phase to address:**
Phase 1 (Multi-Origin CORS Helper) and Phase 2 (Nginx Reverse Proxy Config).

---

### Pitfall 6: `npm workspaces` Hoisting & Root/Workspace Lockfile Skew in Docker Builds

**What goes wrong:**
Running `npm ci` inside `server/` alone inside a `Dockerfile` fails (`npm ci` cannot find `package-lock.json` at `server/`), or running `npm ci --omit=dev` without `client/package.json` fails lockfile verification / misses hoisted dependencies. Even worse, SmartRoute currently has **version skew between root and server `package.json`**:
- Root [`package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/package.json#L22-L35) declares `"express-rate-limit": "^8.7.3"`, `"jest": "^30.5.2"`, `"supertest": "^7.3.2"`, `"leaflet": "^1.9.4"`, `"react-leaflet": "^4.1.0"`.
- [`server/package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/package.json#L21-L37) declares `"express-rate-limit": "^7.2.0"`, `"jest": "^29.7.0"`, `"supertest": "^6.3.4"`.
- [`server/package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/package.json#L10) also contains a Windows-only PowerShell script (`clean:port`) and root `server` + `client` share a single root `package-lock.json` (`400KB`).

**Why it happens:**
npm workspaces hoist shared packages to `/app/node_modules`, leaving workspace-specific version mismatches nested under `/app/server/node_modules` (e.g., `express-rate-limit@7.x` nested under `server/` while `8.x` sits at root!). Copying only `/app/node_modules` between Docker stages silently drops nested `server/node_modules` or breaks module resolution; omitting `.dockerignore` copies Windows `node_modules/` into Linux Alpine containers.

**How to avoid:**
1. Create a strict `.dockerignore` excluding `**/node_modules`, `.git`, `.env`, `.env.*`, `client/dist`, `.planning`, `tests`, `scratch`, `*.log`.
2. In every `Dockerfile` build/prod stage, copy **root `package.json`**, **root `package-lock.json`**, **`server/package.json`**, and **`client/package.json`** first so npm workspace resolution matches the lockfile deterministically.
3. In the production runtime stage, run `npm ci --omit=dev --workspace=server` (or `npm ci --omit=dev` followed by copying only `server/` + `client/dist/` if `SERVE_CLIENT=true` is used), and ensure **both** `/app/node_modules` and `/app/server/node_modules` (if created) are preserved.
4. Audit/reconcile the redundant `express-rate-limit` / `leaflet` / `jest` entries in root `package.json` vs `server/package.json` before cutting the release image.

**Warning signs:**
- `Cannot find module 'express'` or `Cannot find module 'express-rate-limit'` inside the production Docker image despite `npm ci` succeeding.
- `npm ci` errors with `Missing: ... from lock file` when only `server/package.json` was copied.
- Unexpected `express-rate-limit` v8 vs v7 validation behavior inside container builds.

**Phase to address:**
Phase 2 (Multi-Stage `Dockerfile` & `.dockerignore`).

---

### Pitfall 7: SPA Catch-All Swallowing `/api/v1/*` 404s & `/socket.io` Handshakes (`SERVE_CLIENT=true`)

**What goes wrong:**
When `SERVE_CLIENT=true` enables Express to serve `client/dist` in single-origin deployments (or when Nginx serves `client/dist` with `try_files`), mounting the SPA `index.html` catch-all indiscriminately causes missing API routes (e.g., `GET /api/v1/does-not-exist`) or malformed `/socket.io` requests to return `200 OK` with `index.html` HTML instead of JSON `404 ENDPOINT_NOT_FOUND`.

**Why it happens:**
[`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L67-L72) currently mounts `/api/v1` and then immediately mounts `notFoundHandler` (`app.use(notFoundHandler)`). If a developer later appends `app.get('*', ...)` after `notFoundHandler`, it's unreachable; if they move `app.get('*', ...)` *before* `notFoundHandler`, every unknown `/api/v1/*` path hits `index.html` instead of `notFoundHandler`! Similarly in Nginx, `location /` with `try_files $uri /index.html` overrides API handling if `/api/` and `/socket.io/` location blocks aren't matched cleanly.

**How to avoid:**
1. In `server/src/app.js`, keep `/healthz`, `/readyz`, and `/api/v1` mounted first, then scope JSON 404s explicitly to API paths (`app.use('/api', notFoundHandler)`), and **only then** (when `SERVE_CLIENT === 'true'`) mount `express.static(clientDist)` and `app.get(/^(?!\/api\/|\/socket\.io\/|\/healthz$|\/readyz$).*/, (req, res) => res.sendFile(indexHtml))`. Keep `errorHandler` last.
2. In Nginx, define explicit `location /api/` and `location /socket.io/` blocks (proxy to `server:5004`) above `location / { try_files $uri $uri/ /index.html; }`, and set `Cache-Control: no-store` on `index.html` while setting long-lived immutable caching on `/assets/`.

**Warning signs:**
- `curl -i https://app.example.com/api/v1/nonexistent` returns `HTTP/1.1 200 OK` and `<!doctype html>` instead of `404` JSON (`ENDPOINT_NOT_FOUND`).
- Post-deploy smoke test fails JSON parsing on error responses.
- Browser loads stale JS chunks after a deploy because `index.html` was cached aggressively by Nginx/CDN.

**Phase to address:**
Phase 1 (`SERVE_CLIENT=true` Express Routing), Phase 2 (Nginx Config), and Phase 4 (Smoke Verification Script).

---

### Pitfall 8: Dev/CI Default Secrets, `GEOAPIFY_API_KEY` vs `GEOAPIFY_SERVER_API_KEY` Drift & Non-Fail-Fast Startup

**What goes wrong:**
1. **Insecure silent fallbacks:** [`server/src/config/env.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/env.js#L17-L26) defaults `JWT_SECRET` to `'smartroute_super_secret_jwt_key_2026_bhubaneswar'` and `JWT_REFRESH_SECRET` to `'smartroute_super_secret_refresh_key_2026_bhubaneswar'`. If a deploy forgets to set `JWT_SECRET`, the server boots normally with a publicly committed key—allowing anyone to forge `ADMIN` JWTs.
2. **Real codebase env-name mismatch:** [`geoapify.service.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/services/mapping/geoapify.service.js#L20) reads `env.GEOAPIFY_SERVER_API_KEY`, whereas [`adminController.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/controllers/adminController.js#L89) (lines 89, 1114–1115, 1146) checks `process.env.GEOAPIFY_API_KEY`! Setting only `GEOAPIFY_SERVER_API_KEY` makes routing work while Admin Control Center reports Geoapify as `CONFIGURED_SIMULATED` (`Not set`); setting only `GEOAPIFY_API_KEY` makes Admin report `HEALTHY` while routing silently uses simulated fallback matrices.
3. **`.env` loading inside containers:** `env.js` probes `../.env` and `../../.env`. If `.env` accidentally leaks into the Docker build context, container runtime env vars can be shadowed or local dev URIs (`127.0.0.1:27017`) can leak.

**Why it happens:**
`env.js` was built for zero-config local development and test suites, not strict production fail-fast validation, and `.env.example` lists both `GEOAPIFY_API_KEY` and `GEOAPIFY_SERVER_API_KEY` without consolidating them in `env.js`.

**How to avoid:**
1. Add a `validateProdConfig()` check invoked on server startup when `NODE_ENV === 'production'` that **exits non-zero** if:
   - `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing, `< 32` characters, or equals the dev/placeholder defaults.
   - `MONGODB_URI` is missing or points to `127.0.0.1` / `localhost` when not explicitly permitted.
   - `CLIENT_ORIGIN` is empty (unless `SERVE_CLIENT=true` single-origin is explicitly set).
2. Unify `GEOAPIFY_SERVER_API_KEY` in `env.js` as `process.env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_API_KEY || ''`, and update `adminController.js` to read `env.GEOAPIFY_SERVER_API_KEY` instead of raw `process.env.GEOAPIFY_API_KEY`.
3. Exclude `.env` and `.env.*` (except `.env.example`) in `.dockerignore`, and in `env.js` skip loading `.env` files if `NODE_ENV === 'production'` (or only load when `fs.existsSync` and never override existing `process.env` — `dotenv.config()` already respects existing `process.env` by default).

**Warning signs:**
- Admin Control Center shows Geoapify `FALLBACK_SIMULATION` / `Not set` while route optimization actually calls Geoapify (or vice versa).
- Production app boots cleanly even with empty env vars in a test container.

**Phase to address:**
Phase 1 (Fail-Fast Production Env Validation & Geoapify Env Unification) and Phase 2 (`.dockerignore`).

---

### Pitfall 9: Missing Graceful `SIGTERM`/`SIGINT` Shutdown & Liveness vs Readiness Probe Confusion

**What goes wrong:**
[`server/src/index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L47-L74) registers no `SIGTERM`/`SIGINT` handlers, never closes `server` or `io`, and never calls `disconnectDB()`. During Render/Railway rolling deploys or `docker compose up -d` restarts, Docker sends `SIGTERM` and waits 10s before `SIGKILL`: open HTTP keep-alive connections and MongoDB writes are severed mid-flight, and Socket.IO clients don't receive clean disconnect frames. Additionally, SmartRoute's only health endpoints (`/api/v1/health` and `/api/v1/health/ready` in [`server/src/routes/index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/routes/index.js#L18-L40)) are nested under `/api/v1`, and [`server/src/config/db.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/db.js#L14-L16) sets `serverSelectionTimeoutMS: 5000` (which causes `startServer()` to `process.exit(1)` if MongoDB Atlas takes >5s on cold start or container boot race).

**Why it happens:**
Dev servers are killed manually via Ctrl+C on Windows without testing rolling zero-downtime restarts or container orchestration (`depends_on: condition: service_healthy`).

**How to avoid:**
1. Expose root `/healthz` (process liveness — always 200 while HTTP server is up, bypassing API rate limiters & noisy logs) and `/readyz` (readiness — verifies `mongoose.connection.readyState === 1` + optional `mongoose.connection.db.admin().ping()`, returning `503` when DB is disconnected). Keep `/api/v1/health` and `/api/v1/health/ready` intact for backwards compatibility.
2. Point Docker/Render **liveness** checks at `/healthz`, and Nginx/Compose `depends_on` / load-balancer **readiness** checks at `/readyz` (never use DB readiness for container restart liveness, or a transient Atlas election triggers an infinite restart loop).
3. Implement idempotent `shutdown(signal)` in `server/src/index.js`: stop accepting new HTTP connections (`server.close()`), close Socket.IO (`io.close()`), call `await disconnectDB()`, and set a `setTimeout(..., 10000).unref()` safety force-exit.
4. Increase `serverSelectionTimeoutMS` in `db.js` (e.g., `10000`–`15000`ms) for cross-region Atlas TLS handshakes, and disable `autoIndex: true` in production (`autoIndex: env.NODE_ENV !== 'production'`).

**Warning signs:**
- `docker compose stop` or `restart` always hangs for 10 seconds before exiting with code `137` (`SIGKILL`).
- Render deploy fails with `MongooseServerSelectionError` during initial Atlas connection.
- Container enters CrashLoopBackOff during temporary MongoDB Atlas primary failover.

**Phase to address:**
Phase 1 (Probes, DB Production Options & Graceful Shutdown) and Phase 2 (Docker Compose Healthchecks).

---

### Pitfall 10: In-Memory JWT Blacklist & Socket.IO Rooms Breaking on >1 Instance + Missing First-Admin Bootstrap

**What goes wrong:**
1. **Multi-instance state split:** [`server/src/middleware/auth.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/middleware/auth.js#L6) stores logged-out JWTs in an in-memory `const tokenBlacklist = new Set();`, `express-rate-limit` uses its default `MemoryStore`, and [`socketService.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/services/socketService.js) emits to local-process rooms only (no Redis adapter). Scaling Render/Docker to `>= 2` instances silently breaks logout revocation, per-IP rate limits, Socket.IO polling→websocket handshakes (without sticky sessions), and cross-instance `route:reordered` / `telemetry:ping` broadcasts.
2. **Empty production DB lock-out:** [`seedBhubaneswar.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/seed/seedBhubaneswar.js) intentionally refactored away hardcoded admin passwords and only imports `isDemoData: true` demo data. On a fresh MongoDB Atlas database, there is **no `ADMIN` account** to log in with, and public registration/Google OAuth only creates `DRIVER` or non-admin accounts (unless explicitly bootstrapped).

**Why it happens:**
Single-node local dev has one Node process and pre-seeded test/dev users; production starts with a clean database and PaaS dashboards make "Scale to 2 instances" one click away.

**How to avoid:**
1. Pin single-instance execution explicitly in `render.yaml` (`numInstances: 1`) and `docker-compose.yml` (`replicas: 1`), and document in `README.md` that horizontal scaling requires `@socket.io/redis-adapter`, sticky sessions, and a shared Redis store for `tokenBlacklist` + rate limiting.
2. Build an **idempotent first-admin bootstrap CLI script** (e.g., `server/src/scripts/bootstrapAdmin.js`) reading `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, and `BOOTSTRAP_ADMIN_NAME` from env (failing fast if missing or weak, never hardcoding a password, never setting `isDemoData: true`, and safely updating/no-oping if the admin already exists).

**Warning signs:**
- Fresh production deployment returns `401 Invalid credentials` on login with no UI path to create the first `ADMIN`.
- After scaling to 2 instances, driver Socket.IO handshakes return `400 Session ID unknown` or dispatch notifications only reach half the connected browsers.

**Phase to address:**
Phase 3 (`render.yaml` single-instance guardrail) and Phase 4 (Idempotent First-Admin Bootstrap Script & `README.md`).

---

## Technical Debt Patterns

Shortcuts that seem reasonable during deployment prep but create real production incidents:

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `helmet({ contentSecurityPolicy: false })` | Avoids tuning CSP for Google GSI & Geoapify | Leaves XSS surface wide open on fleet/admin JWTs in `localStorage` | Never in production |
| Setting `app.set('trust proxy', true)` | Silences `trust proxy = false` warning quickly | `express-rate-limit` v7 throws `ERR_ERL_PERMISSIVE_TRUST_PROXY`; trivial IP spoofing | Never |
| Passing `VITE_*` inside runtime `environment:` only | Familiar single `.env` mental model | Frontend builds with empty/localhost URLs and broken tiles/Google OAuth | Never (must be build-time `ARG`/env) |
| Using `seedBhubaneswar.js` to initialize production DB | Gets an instant login account in staging | Pollutes production analytics/fleet with `isDemoData: true` Bhubaneswar fixtures | Only in ephemeral demo environments |
| Disabling `authRateLimiter` validation (`validate: false`) | Suppresses `X-Forwarded-For` error logs | All fleet users share one rate-limit counter or allow brute-force bypass | Never |
| Leaving `autoIndex: true` in `db.js` | Automatic index creation on new deploys | Blocks/slows startup as `Telemetry` & `AuditLog` collections grow | Acceptable in early single-node MVP (<100k docs); disable or run explicit `syncIndexes()` at scale |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Google Identity Services (`accounts.google.com/gsi/client`)** | Forgetting to add production Vercel/Render/custom domain to **Authorized JavaScript Origins** in Google Cloud Console, or blocking `accounts.google.com` via Helmet CSP/COOP | Add every exact origin (no trailing slash) in Google Cloud Console (`https://app.example.com`, `https://smartroute.vercel.app`); set `VITE_GOOGLE_CLIENT_ID` at client build time AND `GOOGLE_CLIENT_ID` on server runtime; tune Helmet COOP (`same-origin-allow-popups`) & CSP (`script-src`, `frame-src`, `connect-src`, `img-src`) |
| **Geoapify (Tiles + Routing Matrix)** | Setting only `GEOAPIFY_API_KEY` or only `GEOAPIFY_SERVER_API_KEY`, leaving `adminController.js` and `geoapify.service.js` out of sync; or forgetting to restrict `VITE_GEOAPIFY_TILE_API_KEY` by referrer | Unify `GEOAPIFY_SERVER_API_KEY` (with `GEOAPIFY_API_KEY` alias fallback) across `env.js` and `adminController.js`; keep server routing key server-only and restrict the public `VITE_GEOAPIFY_TILE_API_KEY` to production domains in Geoapify dashboard |
| **MongoDB Atlas** | Leaving `0.0.0.0/0` unconfigured in Atlas Network Access (Render/Railway outbound IPs are dynamic on standard tiers) or missing `?retryWrites=true&w=majority` & DB name in SRV URI | Configure Atlas Network Access for Render/Railway egress (or VPC peering / `0.0.0.0/0` with strong SCRAM auth + TLS), include explicit database name in `MONGODB_URI`, and set `serverSelectionTimeoutMS: 10000`–`15000` |
| **Email / SMS OTP (`otpDeliveryService.js`)** | Deploying without SMTP/SMS vars and discovering `503 EMAIL_OTP_UNCONFIGURED` at login; or using Gmail SMTP port `587`/`465` on hosts that block outbound SMTP | Verify PaaS allows outbound port 587/465 (or use HTTPS APIs / Brevo / Resend SMTP); test `GET /api/v1/auth/otp/status` or `/readyz` during smoke checks; configure `OTP_TTL_MINUTES` & `SMTP_FROM` cleanly |
| **Vercel + Render Split-Origin** | Trying to proxy `/socket.io` via `vercel.json` rewrites or forgetting Render free-tier sleep cold starts (`30–60s` > Axios `15000ms` timeout in `client.ts`) | Connect `VITE_API_URL` and `VITE_SOCKET_URL` directly to Render; on paid/always-on Render tiers `/readyz` stays warm, while on sleeping free tiers warn users/smoke scripts about initial 50s wake-up vs `client.ts` `timeout: 15000` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Single-container Node serving uncompressed static assets + API + Socket.IO** | Slow initial `client/dist` JS/CSS load (`1706` modules) on mobile 4G driver devices | Put Nginx (with `gzip on` + immutable `/assets/` cache headers) or Vercel CDN in front of Node; avoid relying on uncached Express static serving in heavy traffic | Noticeable on 3G/4G field handhelds from day 1 |
| **Nginx default `proxy_read_timeout 60s` on Socket.IO** | Reconnect storms (`driver:join`, `route:join`) every 60s across all idle dispatchers | Set `proxy_read_timeout 86400s` on `/socket.io/` and keep Socket.IO heartbeats healthy | Immediately at ~20+ idle clients |
| **`express.json({ limit: '10mb' })` + synchronous CSV/VRP requests on single event loop** | Event-loop stalls delay Socket.IO heartbeats (`pingTimeout`), causing false disconnects | Keep CSV batch sizes bounded; verify `/healthz` stays fast under load; consider worker offloading if batch sizes exceed a few hundred stops | >500–1,000 stops per optimization request |
| **MongoDB `autoIndex: true` on every boot** | Slow container startup / readiness probe timeout during rolling deploys | Set `autoIndex: process.env.NODE_ENV !== 'production'` and run index sync explicitly | >100k `Telemetry` / `AuditLog` documents |
| **In-memory `tokenBlacklist` `Set()` unbounded growth** | Gradual memory creep if users log out frequently across long uptimes | Store revoked `jti`/token hashes in MongoDB with a TTL index matching `JWT_EXPIRES_IN` (15m) or Redis | Months of continuous uptime without restart |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Booting production with fallback `JWT_SECRET` (`smartroute_super_secret_jwt_key_2026_bhubaneswar`)** | Critical — attacker can sign forged `ADMIN` tokens offline | Fail fast at startup if `NODE_ENV === 'production'` and secret is default, missing, or `< 32` chars |
| **Missing `.dockerignore` copying `.env` or `.git` into image** | Critical — `docker history` or container filesystem exposes local secrets & repo history | Include `.env`, `.env.*`, `.git`, `**/node_modules`, `.planning` in `.dockerignore` |
| **Running Docker container as `root`** | High — container escape / RCE gives root inside container | Switch to `USER node` in final runtime `Dockerfile` stage with read-only or minimal writable dirs |
| **Leaving `NODE_ENV` unset in Docker/PaaS** | High — [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L32) and [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L23) allow **ALL** CORS origins when `NODE_ENV !== 'production'`, and `morgan('dev')` runs | Explicitly set `ENV NODE_ENV=production` in Dockerfile runtime stage and PaaS manifests |
| **Putting `GEOAPIFY_SERVER_API_KEY` or `SMTP_PASS` into `VITE_*` env vars** | High — Vite bundles every `VITE_*` variable into public client JS | Only `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_MAP_PROVIDER`, `VITE_GEOAPIFY_TILE_API_KEY`, and `VITE_GOOGLE_CLIENT_ID` belong in `VITE_*` |
| **Using `localStorage` JWTs without strict CSP** | High — any XSS vulnerability can exfiltrate `token` and `refreshToken` | Enforce strict Helmet/Vercel CSP (no arbitrary external scripts) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Aggressive Nginx/CDN caching of `index.html`** | After a deploy, browsers load cached `index.html` pointing to deleted hashed JS/CSS filenames -> blank white screen | Set `Cache-Control: no-cache, no-store, must-revalidate` on `index.html` and `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` |
| **Render free-tier cold start exceeding `client.ts` `timeout: 15000`** | First login attempt on sleeping backend fails with generic network timeout error | Document always-on tier requirement in `README.md` / `render.yaml`, and ensure `errorUtils.ts` surfaces clear "Server waking up / unreachable" messaging |
| **Inline theme script blocked by CSP in `client/index.html`** | Desktop dark-mode Operations Control Center flashes bright white on every reload | Whitelist the inline theme script via SHA-256 CSP hash (or move to a tiny static file loaded synchronously) |
| **Missing `VITE_GOOGLE_CLIENT_ID` at build time** | Login page shows fallback warning box or broken Google button instead of clean disabled/hidden state | Verify `VITE_GOOGLE_CLIENT_ID` in CI/deploy checklist and show clear operator status when intentionally omitted |

---

## "Looks Done But Isn't" Checklist

- [ ] **Split-origin API & Socket.IO:** `client/src/api/client.ts` and `client/src/utils/socketClient.ts` actually read `VITE_API_URL` / `VITE_SOCKET_URL` (currently hardcoded to `/api/v1` and `/`) — verify in built `dist/assets/*.js` and live two-origin smoke test.
- [ ] **Geoapify unification:** Both `geoapify.service.js` and `adminController.js` read the same unified `env.GEOAPIFY_SERVER_API_KEY` — verify `/api/v1/admin/overview` reports `HEALTHY` when only `GEOAPIFY_SERVER_API_KEY` is set.
- [ ] **Helmet + Google Sign-In + Maps:** Enabling Helmet CSP and COOP does not break Google Sign-In popup/iframe, Geoapify dark/light tiles, OSM fallback tiles, Google Fonts, or `smartroute-theme` dark-mode bootstrap — verify zero CSP console errors in Chromium.
- [ ] **Express `trust proxy` + Rate Limiter:** Sending `X-Forwarded-For: 1.2.3.4` through Nginx/proxy increments rate limits per real client IP without `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` or `ERR_ERL_PERMISSIVE_TRUST_PROXY` in server logs.
- [ ] **SPA Catch-All Scoping:** `GET /api/v1/does-not-exist` returns `404` JSON (`ENDPOINT_NOT_FOUND`), NOT `200` `index.html`, under both `SERVE_CLIENT=true` and Docker Compose Nginx.
- [ ] **WebSocket Upgrade Through Nginx:** Network tab shows `101 Switching Protocols` on `/socket.io/?EIO=4&transport=websocket` and connection stays open >90 seconds without `transport close`.
- [ ] **Docker Image Cleanliness:** `docker run --rm <image> env` and `ls -la /app` confirm no `.env`, `.git`, `tests/`, or `devDependencies` (`jest`, `nodemon`, `typescript`, `vite`) exist in the runtime image.
- [ ] **Graceful Shutdown & Probes:** `/healthz` returns `200`, `/readyz` returns `503` when Mongo is stopped and `200` when connected, and `docker compose stop` exits cleanly with code `0` in `<3s` (not `137` after 10s).
- [ ] **Fresh DB Admin Access:** Running the idempotent first-admin bootstrap script against a clean MongoDB creates an `ADMIN` user without touching `isDemoData` fixtures, and running it twice is a clean no-op/update.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Built Docker/Vercel frontend with wrong `VITE_API_URL` or missing `VITE_GOOGLE_CLIENT_ID`** | LOW | Rebuild the frontend image / redeploy Vercel with corrected build args/env vars (no DB migration needed) |
| **Production booted with default `JWT_SECRET`** | MEDIUM | Rotate `JWT_SECRET` & `JWT_REFRESH_SECRET` to 32+ char random secrets, restart server (forces all active sessions to re-authenticate cleanly), audit `AuditLog` for anomalous `ADMIN` actions |
| **Locked out all fleet users due to missing `trust proxy`** | LOW | Deploy `app.set('trust proxy', 1)` (automatically clears in-memory rate-limit counters on restart) |
| **Accidentally seeded `seedBhubaneswar.js` demo data into production** | LOW | Log in as `ADMIN` and trigger `DELETE /api/v1/admin/demo-data` (or run `node server/src/seed/seedBhubaneswar.js --delete`) which cascade-purges `isDemoData: true` records safely |
| **Stale `index.html` cached in user browsers after deploy** | MEDIUM | Fix `Cache-Control: no-store` on `index.html` in Nginx/Vercel; affected users need one hard refresh or tab close/reopen |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 Split-origin `VITE_API_URL` / `VITE_SOCKET_URL` & Vercel WS limitation | Phase 1 (Client/Server Wiring) & Phase 3 (`vercel.json` / `render.yaml`) | Build client with split-origin `VITE_API_URL`; verify REST & Socket.IO connect to API origin directly without hitting frontend `/api` |
| #2 Vite build-time `VITE_*` baking & Docker `ARG` secret isolation | Phase 2 (`Dockerfile`) & Phase 3 (CI build check) | Inspect built image layers (`docker history`) & `client/dist` bundle; confirm `VITE_*` present and server secrets absent |
| #3 Missing `trust proxy` / `express-rate-limit` v7 validation | Phase 1 (Server Hardening) | Jest/Supertest test sending `X-Forwarded-For` headers + live Nginx check with zero `express-rate-limit` validation warnings |
| #4 Helmet v7 CSP & COOP blocking Google GSI, Geoapify, Fonts, Theme | Phase 1 (Server Hardening) & Phase 3 (`vercel.json`) | Headless Chromium check on `/login` and `/admin/optimizer` with zero CSP/COOP console errors |
| #5 Nginx WS upgrade/timeouts & comma-separated CORS parity | Phase 1 (Shared CORS helper) & Phase 2 (Nginx config) | `wscat`/Chromium check confirming `101 Switching Protocols`, >90s idle stability, and multi-origin CORS preflight |
| #6 `npm workspaces` hoisting, lockfile skew & `.dockerignore` | Phase 2 (`Dockerfile`, `.dockerignore`) | Clean `docker build --no-cache` from repo root + verify `node server/src/index.js` boots with `--omit=dev` |
| #7 SPA catch-all swallowing `/api/v1` 404s | Phase 1 (`SERVE_CLIENT=true`) & Phase 2 (Nginx) & Phase 4 (Smoke) | `curl` `/api/v1/nonexistent` returns HTTP `404` JSON `ENDPOINT_NOT_FOUND` under both `SERVE_CLIENT=true` and Nginx |
| #8 Default secrets, `GEOAPIFY_API_KEY` drift & non-fail-fast boot | Phase 1 (Env Validation & Geoapify Unification) | Unit tests confirming startup aborts in `NODE_ENV=production` with weak/missing `JWT_SECRET` or `MONGODB_URI`, and `/admin/overview` reflects `GEOAPIFY_SERVER_API_KEY` |
| #9 Missing `SIGTERM`/`SIGINT` graceful shutdown & `/healthz` vs `/readyz` | Phase 1 (Probes & Shutdown) & Phase 2 (Compose Healthchecks) | `docker compose up -d` waits for healthy DB + server, and `docker compose stop` exits `0` cleanly |
| #10 Single-instance state limits & first-admin bootstrap | Phase 3 (`render.yaml`) & Phase 4 (`bootstrapAdmin` + `README.md`) | Run bootstrap script twice against empty MongoDB; verify idempotency and immediate `ADMIN` login |

---

## Sources

- **Codebase Inspection (HIGH confidence):**
  - [`package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/package.json), [`server/package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/package.json), [`client/package.json`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/package.json)
  - [`server/src/app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js), [`server/src/index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js), [`server/src/config/env.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/env.js), [`server/src/config/db.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/db.js)
  - [`server/src/middleware/rateLimiter.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/middleware/rateLimiter.js), [`server/src/middleware/auth.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/middleware/auth.js), [`server/src/controllers/adminController.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/controllers/adminController.js)
  - [`client/vite.config.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/vite.config.ts), [`client/index.html`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/index.html), [`client/src/api/client.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/api/client.ts), [`client/src/utils/socketClient.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/utils/socketClient.ts), [`client/src/components/auth/GoogleSignInButton.tsx`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/auth/GoogleSignInButton.tsx), [`client/src/components/maps/InteractiveMap.tsx`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/maps/InteractiveMap.tsx)
  - [`.env.example`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.env.example), [`.github/workflows/ci.yml`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/.github/workflows/ci.yml)
- **External Documentation & Ecosystem Verification (MEDIUM–HIGH confidence):**
  - `express-rate-limit` v7 `trust proxy` validation (`ERR_ERL_PERMISSIVE_TRUST_PROXY` / `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`)
  - Helmet v7 Content-Security-Policy & Cross-Origin-Opener-Policy (`same-origin-allow-popups`) requirements for Google Identity Services (`accounts.google.com/gsi/client`)
  - Socket.IO v4 Nginx reverse-proxy directives (`proxy_http_version 1.1`, `Upgrade`/`Connection`, `proxy_read_timeout`)
  - Vercel `rewrites` external WebSocket proxy limitation (direct split-origin Socket.IO connection pattern)
  - npm workspaces hoisting & multi-stage Docker `npm ci --omit=dev` manifest requirements

---
*Pitfalls research for: SmartRoute v6 Deployment & Production Readiness*
*Researched: 2026-11-11*
