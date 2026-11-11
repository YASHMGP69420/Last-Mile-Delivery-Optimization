# Phase 11: Server & Client Runtime Hardening - Research

**Researched:** 2026-11-11
**Domain:** Express 4 / Socket.IO 4 / Mongoose 8 / Helmet 7 / express-rate-limit 7 / Vite 5 Production Hardening & Multi-Topology Origin Routing
**Confidence:** HIGH

## Summary

Phase 11 hardens SmartRoute's existing Express (`4.22.3`), Socket.IO (`4.8.4`), Mongoose (`8.24.8`), Helmet (`7.2.0`), `express-rate-limit` (`7.5.1` in `server/node_modules`), and Vite (`5.2.11`) runtime boundaries so both Single-Origin (`SERVE_CLIENT=true` or Nginx edge proxy) and Split-Origin (`VITE_API_URL` / `VITE_SOCKET_URL` + multi-origin CORS) deployments run securely with **zero new external npm packages** `[VERIFIED: server/package.json:16-31]`, `[VERIFIED: client/package.json:12-26]`.

Direct inspection of the codebase confirms eight exact integration gaps matching `HARD-01..06` and `ORIG-01..02`:
1. `server/src/config/env.js` falls back to committed dev secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`), local MongoDB (`mongodb://127.0.0.1:27017/smartroute`), and `'YOUR_GEOAPIFY_SERVER_KEY'` without a `NODE_ENV=production` fail-fast gate, while `server/src/controllers/adminController.js` reads `process.env.GEOAPIFY_API_KEY` in three places instead of `env.GEOAPIFY_SERVER_API_KEY` `[VERIFIED: server/src/config/env.js:20-25]`, `[VERIFIED: server/src/controllers/adminController.js:89,1114-1115,1146]`.
2. `server/src/app.js` omits `app.set('trust proxy', ...)` and mounts a duplicate `loginLimiter` on `/api/v1/auth/login` ahead of `authRoutes.js`'s `authRateLimiter`, while disabling Helmet CSP (`contentSecurityPolicy: false`) and leaving default `COOP` behavior unconfigured `[VERIFIED: server/src/app.js:12-17,51-65]`, `[VERIFIED: server/src/routes/authRoutes.js:9-15]`.
3. `server/src/app.js` and `server/src/index.js` duplicate `allowedOrigins` inline with a single `CLIENT_ORIGIN` string and allow all origins when `NODE_ENV !== 'production'`, without comma-separated parsing or `SERVE_CLIENT=true` same-origin support `[VERIFIED: server/src/app.js:20-40]`, `[VERIFIED: server/src/index.js:12-31]`.
4. Root `/healthz` and `/readyz` probes and `SIGTERM`/`SIGINT` graceful draining do not exist in `app.js`/`index.js`, and `server/src/config/db.js` hardcodes `serverSelectionTimeoutMS: 5000` and `autoIndex: true` `[VERIFIED: server/src/config/db.js:14-17]`.
5. `server/src/app.js` lacks `SERVE_CLIENT=true` static/SPA serving, and `client/src/api/client.ts` and `client/src/utils/socketClient.ts` hardcode `'/api/v1'`, `'/api/v1/auth/refresh'`, `` `/api/v1/batches/${id}/export` ``, and `'/'` `[VERIFIED: client/src/api/client.ts:6,47,190]`, `[VERIFIED: client/src/utils/socketClient.ts:11]`.

**Primary recommendation:** Implement `validateProductionEnv()`, numeric `TRUST_PROXY`, and `GEOAPIFY_SERVER_API_KEY` unification in `server/src/config/env.js`; extract shared `parseAllowedOrigins()` + `createCorsOptionsDelegate()` into `server/src/config/cors.js` (handling both Express and Socket.IO `IncomingMessage` requests including same-origin `SERVE_CLIENT=true`); move the `client/index.html` theme boot script to `client/public/theme-init.js` for hash-free strict `script-src` Helmet CSP + `same-origin-allow-popups` COOP; add `/healthz`, `/readyz`, `SERVE_CLIENT=true` SPA isolation, and `SIGTERM`/`SIGINT` connection draining across `app.js`, `index.js`, and `db.js`; and wire `VITE_API_URL` / `VITE_SOCKET_URL` in `client/src/api/client.ts` and `client/src/utils/socketClient.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Production Env Validation & Multi-Origin CORS
- Require explicit `process.env.MONGODB_URI` in `NODE_ENV=production` (reject missing/default fallback while permitting Docker Compose internal hosts such as `mongodb://mongo:27017/...` and explicit URIs)
- Fail fast (`process.exit(1)`) on `NODE_ENV=production` boot if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing, `< 32` chars, or matches dev/CI default strings
- Treat `GEOAPIFY_SERVER_API_KEY` as canonical in `server/src/config/env.js` with fallback to `GEOAPIFY_API_KEY`, and update `server/src/controllers/adminController.js` to read `env.GEOAPIFY_SERVER_API_KEY`
- Extract shared `server/src/config/cors.js` (`parseAllowedOrigins`) parsing comma-separated `CLIENT_ORIGIN` (trimmed, trailing-slash stripped), omitting localhost origins in `NODE_ENV=production` unless explicitly listed, used identically by Express (`app.js`) and Socket.IO (`index.js`)

### Reverse-Proxy Trust, Rate Limiting & Helmet CSP/COOP
- Configure `app.set('trust proxy', env.TRUST_PROXY)` defaulting to numeric `1` in `NODE_ENV=production` (`false` in dev/test; env-configurable integer hop count or `'false'`, never boolean `true`) to avoid `ERR_ERL_PERMISSIVE_TRUST_PROXY`
- Remove duplicate `loginLimiter` in `server/src/app.js` so `authRateLimiter` in `server/src/middleware/rateLimiter.js` is the single clean auth limiter
- Keep Helmet `script-src` strict (`'self' https://accounts.google.com`) using an exact SHA-256 hash or `/theme-init.js` under `'self'` instead of `'unsafe-inline'`, permit Geoapify/OSM/CARTO tiles, Google Fonts, Google avatars, and `ws:`/`wss:` in CSP, and set `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }`
- Gate CSP `upgradeInsecureRequests` on `FORCE_HTTPS_CSP=true` (disabled by default) so local HTTP Docker Compose tests work without broken mixed-scheme upgrades

### Probes, Graceful Shutdown & Single/Split-Origin Routing
- Expose root `GET /healthz` (`200` ok, `503` draining) and `GET /readyz` (`200` when `mongoose.connection.readyState === 1` and not draining, else `503`) before rate limiters while preserving existing `/api/v1/health` and `/api/v1/health/ready`
- Implement idempotent `SIGTERM`/`SIGINT` drain sequence in `server/src/index.js`: mark draining -> `io.close()` -> `server.close()` -> `server.closeIdleConnections()` -> `disconnectDB()` -> `process.exit(0)` with a `.unref()` `10s` force-exit (`1`); configure Mongoose with `autoIndex: NODE_ENV !== 'production'` and `serverSelectionTimeoutMS: 12000`
- Under `SERVE_CLIENT=true`, validate `client/dist/index.html` exists cleanly on startup, mount `app.use('/api', notFoundHandler)` BEFORE static/SPA fallback, serve `/assets/*` with `Cache-Control: public, max-age=31536000, immutable` and `index.html` with `no-cache`, and skip `/socket.io/*` + dotted asset paths in SPA GET fallback
- Wire `import.meta.env.VITE_API_URL` (trailing-slash normalized, defaulting to `'/api/v1'`) across `client/src/api/client.ts` (`baseURL`, `/auth/refresh`, `exportCsvUrl`) and `import.meta.env.VITE_SOCKET_URL || originOf(VITE_API_URL) || '/'` in `client/src/utils/socketClient.ts` so Single-Origin and Vite dev proxy continue using relative `/` paths when omitted

### the agent's Discretion
- Exact module decomposition for `validateProductionEnv()` and shared CORS helper, plus exact Jest/Supertest test filenames covering `HARD-01..06` and `ORIG-01..02`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 11 scope (containers in Phase 12, PaaS/seed/smoke/CI in Phase 13, docs/env audit in Phase 14).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARD-01 | Server fails fast on `NODE_ENV=production` boot when `MONGODB_URI`, `JWT_SECRET` (>=32 chars, non-default), `JWT_REFRESH_SECRET` (>=32 chars, non-default), or `CLIENT_ORIGIN` (when `SERVE_CLIENT !== 'true'`) is missing/invalid, and unifies `GEOAPIFY_SERVER_API_KEY` / `GEOAPIFY_API_KEY` lookup across `env.js`, `geoapify.service.js`, and `adminController.js` | `server/src/config/env.js:17-49`, `.env.example:14-15`, `server/.env.example:4-5`, `server/.env.test:4-5`, `.github/workflows/ci.yml:55-60`, `server/src/controllers/adminController.js:89,1114-1115,1146`, `server/src/services/mapping/geoapify.service.js:20-21,68-69` |
| HARD-02 | Express sets numeric `trust proxy` (`TRUST_PROXY`, default `1` in production) before rate limiters so proxied `X-Forwarded-For` client IPs resolve accurately without `ERR_ERL_*` errors, and duplicate `loginLimiter` stacking in `app.js` is removed | `server/src/app.js:5,51-65`, `server/src/routes/authRoutes.js:9-15`, `server/src/middleware/rateLimiter.js:7-26`, verified `express-rate-limit@7.5.1` (`server/node_modules`) behavior with `app.set('trust proxy', 1)` |
| HARD-03 | Shared `parseAllowedOrigins()` helper parses comma-separated, trimmed, trailing-slash-normalized `CLIENT_ORIGIN` values consistently across Express (`app.js`) and Socket.IO (`index.js`) | `server/src/app.js:20-40`, `server/src/index.js:12-31`, verified `cors@2.8.6` delegate `(req, cb)` + `engine.io` `handleUpgrade` passing `IncomingMessage` |
| HARD-04 | Tuned Helmet v7 Content Security Policy and `crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }` protect the served app while permitting Google Identity Services (`accounts.google.com`), Geoapify/OSM/CARTO tiles, Google Fonts, `ws:`/`wss:`, and the inline theme boot script in `client/index.html` with zero console errors | `server/src/app.js:12-17`, `client/index.html:10-44`, `client/src/components/auth/GoogleSignInButton.tsx:37`, `client/src/components/maps/InteractiveMap.tsx:193-225`, `client/src/components/driver/PODModal.tsx:92,120`, `server/src/services/googleAuthService.js:56`, verified `helmet@7.2.0` default directives & `upgradeInsecureRequests: null` |
| HARD-05 | Root `/healthz` (process liveness) and `/readyz` (MongoDB `readyState === 1` returning `503` when disconnected or draining) plus idempotent `SIGTERM`/`SIGINT` graceful shutdown (`io.close()` -> `server.close()` -> `server.closeIdleConnections()` -> `disconnectDB()`, 10s safety timeout) drain active connections cleanly while keeping `/api/v1/health` and `/api/v1/health/ready` | `server/src/routes/index.js:18-40`, `server/src/index.js:46-75`, `server/src/config/db.js:30-36`, `server/tests/socket_auth.test.js:12,38-43` |
| HARD-06 | Production Mongoose config sets `autoIndex: NODE_ENV !== 'production'` and explicit `serverSelectionTimeoutMS` (`10000`–`15000` ms) for reliable Atlas failover | `server/src/config/db.js:14-17` |
| ORIG-01 | Optional `SERVE_CLIENT=true` mode serves `client/dist` (`Cache-Control: public, max-age=31536000, immutable` on `/assets/*`, `no-cache` on `index.html`) and falls back non-`/api/*`, non-`/socket.io/*`, non-asset GET routes to `index.html` while keeping unknown `/api/*` requests returning JSON `404` and failing clearly if `client/dist/index.html` is missing | `server/src/app.js:68-72`, `server/src/middleware/errorHandler.js:20-29`, `client/public/*` (`favicon.svg`, `icons.svg`, `manifest.json`, `sw.js`), `client/src/App.tsx:60-102` |
| ORIG-02 | Client REST module (`client/src/api/client.ts`: `baseURL`, refresh token post, CSV export URL) and Socket.IO client (`client/src/utils/socketClient.ts`) honor build-time `VITE_API_URL` and derived/explicit `VITE_SOCKET_URL` for Split-Origin deploys while defaulting to relative `/` paths for Single-Origin and Vite dev proxy | `client/src/api/client.ts:5-6,47,189-191`, `client/src/utils/socketClient.ts:7-20`, `client/src/vite-env.d.ts:1`, `client/vite.config.ts:17-28` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Production Env & Secret Validation | API / Backend (`server/src/config/env.js`, `index.js`) | — | Server owns secret hygiene (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`) and must abort boot before listening or connecting DB. |
| Reverse-Proxy IP & Rate Limiting | API / Backend (`server/src/app.js`, `rateLimiter.js`) | CDN / Proxy Edge (Nginx/Render) | Proxy forwards `X-Forwarded-For`; Express must trust exact hop count (`TRUST_PROXY`) before `authRateLimiter` / `operationalRateLimiter` evaluate `req.ip`. |
| Multi-Origin CORS & Same-Origin Policy | API / Backend (`server/src/config/cors.js`, `app.js`, `index.js`) | — | Both Express REST and Socket.IO Engine.IO handshakes enforce identical `CLIENT_ORIGIN` rules and same-origin `SERVE_CLIENT=true` matching. |
| Security Headers (CSP & COOP) | API / Backend (`server/src/app.js` Helmet v7) | Browser / Client (`client/public/theme-init.js`) | Express emits CSP/COOP on served HTML/API responses; client avoids `'unsafe-inline'` scripts by loading `/theme-init.js` from `'self'`. |
| Liveness, Readiness & Graceful Drain | API / Backend (`server/src/app.js`, `index.js`, `db.js`) | — | Only the Node process owns `isDraining` state, Socket.IO handle, HTTP keep-alive sockets, and Mongoose connection pool. |
| SPA Asset & Route Delivery (`SERVE_CLIENT=true`) | API / Backend (`server/src/app.js`) | Browser / Client (`client/dist`) | Single-Origin mode serves built `client/dist` assets and SPA HTML while strictly isolating `/api/*` JSON 404s and `/socket.io/*`. |
| Split-Origin API & Socket URL Resolution | Browser / Client (`client/src/api/client.ts`, `socketClient.ts`) | — | Vite bakes `VITE_API_URL` and `VITE_SOCKET_URL` at build time, falling back to relative `/api/v1` and `/` when omitted. |

## Standard Stack

No new packages are added in Phase 11. All capabilities use the installed runtime libraries verified directly in `node_modules` and `server/node_modules`:

### Core
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `express` | `4.22.3` (`^4.19.2`) | HTTP API, `trust proxy`, `express.static`, `/healthz` & `/readyz` | Existing backend framework `[VERIFIED: node_modules/express/package.json]` |
| `helmet` | `7.2.0` (`^7.1.0`) | CSP & `Cross-Origin-Opener-Policy` security headers | Existing security middleware; verified `upgradeInsecureRequests: null` & `same-origin-allow-popups` `[VERIFIED: node_modules/helmet/package.json]` |
| `express-rate-limit` | `7.5.1` in `server/node_modules` (`^7.2.0`); `8.7.3` hoisted in root `node_modules` | IP-based auth & operational rate limiting | Existing rate limiter (Phase 12 cleans root skew; Phase 11 code must work cleanly on both `7.5.1` and `8.x`) `[VERIFIED: server/node_modules/express-rate-limit/package.json]` |
| `cors` | `2.8.6` (`^2.8.5`) | Shared Express & Engine.IO CORS middleware | Existing CORS library; verified delegate `(req, cb)` support `[VERIFIED: node_modules/cors/package.json]` |
| `socket.io` | `4.8.4` (`^4.7.5`) | Real-time gateway & `io.close()` graceful drain | Existing WebSocket/polling engine `[VERIFIED: node_modules/socket.io/package.json]` |
| `mongoose` | `8.24.8` (`^8.3.1`) | MongoDB connection (`readyState`, `autoIndex`, `serverSelectionTimeoutMS`, `disconnect`) | Existing ODM `[VERIFIED: node_modules/mongoose/package.json]` |
| `axios` | `1.7.2` (client) | REST client & token refresh interceptor | Existing frontend HTTP client `[VERIFIED: client/package.json:14]` |
| `socket.io-client` | `4.7.5` (client) | Real-time client connection | Existing frontend Socket.IO client `[VERIFIED: client/package.json:24]` |

**Installation:** None required (all packages already installed in workspace).

## Package Legitimacy Audit

> **Status:** No new external packages are installed in Phase 11 (`HARD-01..06`, `ORIG-01..02`). All runtime packages above already exist in `server/package.json`, `client/package.json`, and `package-lock.json`.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Browser (Single-Origin or Split-Origin)
   │
   ├── GET /healthz, /readyz ──────────────────────► Express (before rate limiters & CORS error)
   │                                                    ├─ /healthz: 200 OK | 503 if isDraining
   │                                                    └─ /readyz:  200 OK if !isDraining && readyState===1 | else 503
   │
   ├── HTTP /api/v1/* or /socket.io/* ─────────────► Reverse Proxy (X-Forwarded-For, X-Forwarded-Host)
   │                                                    ▼
   │                                                 app.set('trust proxy', env.TRUST_PROXY)
   │                                                    ▼
   │                                                 Helmet (CSP + COOP: same-origin-allow-popups)
   │                                                    ▼
   │                                                 Shared CORS Delegate (parseAllowedOrigins + SERVE_CLIENT same-host)
   │                                                    ▼
   │                                                 /api/v1/* routes (authRateLimiter / operationalRateLimiter)
   │                                                 /api/* unmatched ──► notFoundHandler (JSON 404)
   │
   └── GET /* (when SERVE_CLIENT=true) ────────────► /assets/* (Cache-Control: public, max-age=31536000, immutable)
                                                     /public files (favicon.svg, theme-init.js, manifest.json, sw.js)
                                                     non-/api, non-/socket.io, non-dotted GET ──► index.html (no-cache)
```

### Pattern 1: Testable Fail-Fast Env & Geoapify Unification (`server/src/config/env.js`)
**What:** Load `.env` / `.env.test` only when `NODE_ENV !== 'production'` (so local `.env` files never silently satisfy production validation), normalize `TRUST_PROXY`, `SERVE_CLIENT`, `FORCE_HTTPS_CSP`, `JWT_REFRESH_EXPIRES_IN`, and `GEOAPIFY_SERVER_API_KEY` (with fallback to `GEOAPIFY_API_KEY`), and export `validateProductionEnv(targetEnv = env, rawEnv = process.env)`.
**Key codebase details observed:**
- `server/src/config/env.js:20-26`:
  ```js
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute',
  JWT_SECRET: process.env.JWT_SECRET || 'smartroute_super_secret_jwt_key_2026_bhubaneswar',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'smartroute_super_secret_refresh_key_2026_bhubaneswar',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  GEOAPIFY_SERVER_API_KEY: process.env.GEOAPIFY_SERVER_API_KEY || 'YOUR_GEOAPIFY_SERVER_KEY',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  ```
- Known committed dev/CI/example default secrets observed across repo that MUST be rejected in `NODE_ENV=production`:
  - `'smartroute_super_secret_jwt_key_2026_bhubaneswar'` (`server/src/config/env.js:21`, `server/.env.example:4`)
  - `'smartroute_super_secret_refresh_key_2026_bhubaneswar'` (`server/src/config/env.js:22`, `server/.env.example:5`)
  - `'test_jwt_secret_smartroute_bhubaneswar_2026'` (`server/.env.test:4`)
  - `'test_jwt_refresh_secret_smartroute_bhubaneswar_2026'` (`server/.env.test:5`)
  - `'your_secure_random_jwt_secret_minimum_32_chars_here'` (`.env.example:14`)
  - `'your_secure_random_refresh_secret_minimum_32_chars_here'` (`.env.example:15`)
  - `'ci_secret_random_key_string_32_characters_minimum'` (`.github/workflows/ci.yml:55`)
  - `'ci_refresh_random_key_string_32_chars_min'` (`.github/workflows/ci.yml:56`)
- Geoapify placeholder values observed across repo:
  - `'YOUR_GEOAPIFY_SERVER_KEY'` (`server/src/config/env.js:24`, `server/src/services/mapping/geoapify.service.js:21`)
  - `'mock-geoapify-key'` (`server/src/controllers/adminController.js:89,1114,1146`)
  - `'your_geoapify_api_key_here'` (`.env.example:24-25`)
  - `'ci_placeholder_key'` (`.github/workflows/ci.yml:60`)
- `adminController.js` lines to update:
  - Line `89`: `const hasGeoapifyKey = Boolean(process.env.GEOAPIFY_API_KEY && process.env.GEOAPIFY_API_KEY !== 'mock-geoapify-key');`
  - Lines `1114-1115`: `hasKey` and `keyMasked` reading `process.env.GEOAPIFY_API_KEY`
  - Line `1146`: `const isConfigured = Boolean(process.env.GEOAPIFY_API_KEY && process.env.GEOAPIFY_API_KEY !== 'mock-geoapify-key');`
  Replace all three with `env.GEOAPIFY_SERVER_API_KEY` and a shared `isGeoapifyConfigured(env.GEOAPIFY_SERVER_API_KEY)` helper (exported from `env.js` or `geoapify.service.js`) that returns `false` for empty or placeholder keys!
- **Boot call site (`server/src/index.js`):** Call `validateProductionEnv()` at the start of `startServer()` (when `env.NODE_ENV === 'production'`), log clearly to `console.error`, and call `process.exit(1)` BEFORE `connectDB()` so Jest tests importing `validateProductionEnv()` or `app.js` can assert thrown errors cleanly without killing the Jest worker, while spawning `node server/src/index.js` with `NODE_ENV=production` exits immediately with code `1`.

### Pattern 2: `TRUST_PROXY` Parsing & Single `authRateLimiter` (`HARD-02`)
**What:**
- Parse `TRUST_PROXY` in `env.js`:
  - If `process.env.TRUST_PROXY === undefined || process.env.TRUST_PROXY === ''`: default to `1` when `NODE_ENV === 'production'`, else `false`.
  - If `'false'` or `'0'`: return `false`.
  - If `'true'`: throw/reject in `validateProductionEnv()` (or refuse boolean `true` and parse strict non-negative integer `/^\d+$/`). Never pass boolean `true` to `app.set('trust proxy', ...)`, because `express-rate-limit` throws `ERR_ERL_PERMISSIVE_TRUST_PROXY` `[VERIFIED: server/node_modules/express-rate-limit/dist/index.cjs]`.
- In `server/src/app.js`:
  - Call `app.set('trust proxy', config.trustProxy ?? env.TRUST_PROXY)` BEFORE mounting rate limiters or routes.
  - Remove lines `5` (`const rateLimit = require('express-rate-limit');`) and `51-65` (`loginLimiter` + `app.use('/api/v1/auth/login', loginLimiter);`).
  - `server/src/routes/authRoutes.js:9-15` already mounts `authRateLimiter` (`max: 30`, `windowMs: 15 * 60 * 1000`) on `/login`, `/otp/send`, `/otp/verify`, `/otp/login`, `/register`, and `/google`. (Optionally enrich `authRateLimiter.message` in `server/src/middleware/rateLimiter.js` to `{ success: false, message: '...', error: { code: 'RATE_LIMIT_EXCEEDED', message: '...' } }` so both `error.code` and top-level `message` are preserved.)

### Pattern 3: Shared Multi-Origin CORS & `SERVE_CLIENT=true` Same-Origin (`HARD-03`)
**What:** Create `server/src/config/cors.js` exporting `parseAllowedOrigins(rawOrigin, nodeEnv)` and `createCorsOptions({ allowedOrigins, nodeEnv, serveClient })`.
- `parseAllowedOrigins(rawOrigin = env.CLIENT_ORIGIN, nodeEnv = env.NODE_ENV)`:
  - Split `rawOrigin` on `,`, `.map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)`.
  - Deduplicate with `Set`.
  - Only append dev defaults (`http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, `http://127.0.0.1:5174`) when `nodeEnv !== 'production'`.
- **Crucial same-origin detail verified in `cors@2.8.6` & `engine.io`:**
  - Browsers send an `Origin` header on same-origin `POST`/`PUT`/`PATCH`/`DELETE` requests (`Origin: https://app.example.com`).
  - Under `SERVE_CLIENT=true` (where `CLIENT_ORIGIN` is optional per `HARD-01`), if `allowedOrigins` is empty, a naive `origin` string callback would reject same-origin `POST /api/v1/auth/login`!
  - Because both `cors(delegate)` in Express and `engine.io`'s `require("cors")(this.opts.cors)` invoke a function delegate `(req, callback)` with the raw `http.IncomingMessage` `[VERIFIED: node_modules/cors/lib/index.js]`, `[VERIFIED: node_modules/engine.io/build/server.js:68-69,562,599]`, the shared delegate can check:
    1. `!origin` -> allow
    2. `nodeEnv !== 'production'` -> allow
    3. `allowedOrigins.includes(normalizedOrigin)` -> allow
    4. `serveClient === true` and `new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host)` -> allow same-origin!
    5. Otherwise -> `const err = new Error('Blocked by CORS'); err.statusCode = 403; err.code = 'CORS_BLOCKED'; callback(err);` (note: using `req.headers['x-forwarded-host'] || req.headers.host` works on both Express `req` and raw `engine.io` `IncomingMessage`).

### Pattern 4: Strict Helmet v7 CSP + COOP & Theme Boot Script (`HARD-04`)
**What:**
- Extract `client/index.html:10-38` inline dark-mode IIFE into `client/public/theme-init.js` and load `<script src="/theme-init.js"></script>` synchronously in `<head>` (no `async`/`defer` so theme class applies before first paint with zero FOUC).
  - Why `/theme-init.js` over inline SHA-256? Vite copies `client/public/*` verbatim to `client/dist/` (`[VERIFIED: vite build]`), keeps `scriptSrc: ["'self'", "https://accounts.google.com"]` hash-free, eliminates CRLF/LF hash drift across Windows/Linux, and lets Phase 13 `vercel.json` mirror the exact same CSP string cleanly.
  - (For reference, the exact SHA-256 of the current LF inline script in `client/index.html:10-38` was verified as `'sha256-Zfu0xjbyj5DZit2ESi9UACF5lulvRR98MToNnMX5W2w='`.)
- Configure `helmet(...)` in `server/src/app.js`:
  ```js
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://maps.geoapify.com',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.org',
          'https://*.basemaps.cartocdn.com',
          'https://lh3.googleusercontent.com',
        ],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https://accounts.google.com',
          'https://maps.geoapify.com',
          'https://api.geoapify.com',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.org',
          'https://*.basemaps.cartocdn.com',
        ],
        frameSrc: ["'self'", 'https://accounts.google.com'],
        upgradeInsecureRequests: forceHttpsCsp ? [] : null,
      },
    },
  })
  ```
- Verified sources in `client/`:
  - `client/index.html:39-44`: `https://fonts.googleapis.com` (`style-src`), `https://fonts.gstatic.com` (`font-src`).
  - `client/src/components/auth/GoogleSignInButton.tsx:37`: `https://accounts.google.com/gsi/client` (`script-src`, `frame-src`, `connect-src`, `style-src`).
  - `client/src/components/maps/InteractiveMap.tsx:193-197,225`: `https://maps.geoapify.com` and `https://tile.openstreetmap.org` (with `subdomains={['a', 'b', 'c']}` -> `https://*.tile.openstreetmap.org`).
  - `client/src/components/driver/PODModal.tsx:92,120`: `canvas.toDataURL(...)` (`img-src data:`).
  - `server/src/services/googleAuthService.js:56`: `payload.picture` Google avatars (`img-src https://lh3.googleusercontent.com`).
  - Verified against `helmet@7.2.0`: `upgradeInsecureRequests: null` omits `upgrade-insecure-requests` from the emitted header so HTTP Docker Compose smoke tests do not break.

### Pattern 5: Probes, Graceful Shutdown & Production Mongoose Config (`HARD-05`, `HARD-06`)
- **Probes (`server/src/app.js` before rate limiters & CORS error paths):**
  - `app.set('isDraining', false)` on app creation.
  - `GET /healthz`: returns `503` `{ success: false, status: 'DRAINING', timestamp }` if `Boolean(app.get('isDraining'))`, else `200` `{ success: true, status: 'OK', timestamp }`.
  - `GET /readyz`: returns `200` `{ success: true, status: 'READY', database: 'CONNECTED', timestamp }` when `!app.get('isDraining') && mongoose.connection.readyState === 1`, else `503` `{ success: false, status: app.get('isDraining') ? 'DRAINING' : 'DEGRADED', database: ... }`.
  - Preserve `GET /api/v1/health` and `GET /api/v1/health/ready` in `server/src/routes/index.js:18-40` (also respecting `req.app.get('isDraining')` in `/api/v1/health/ready` for consistency).
- **Graceful Shutdown (`server/src/index.js`):**
  - Export `gracefulShutdown(signal)` (idempotent via `let isShuttingDown = false`) and register `SIGTERM`/`SIGINT` handlers only when `require.main === module` (prevents listener leaks and unexpected `process.exit` in Jest suites like `server/tests/socket_auth.test.js:12`).
  - Sequence:
    1. If `isShuttingDown`, return early. `isShuttingDown = true`.
    2. `app.set('isDraining', true)`.
    3. Schedule `const forceTimer = setTimeout(() => process.exit(1), 10000); forceTimer.unref();`.
    4. `await new Promise((resolve) => io.close(() => resolve()))` (if `io` active).
    5. If `server.listening`: close HTTP server (`server.close(...)`) and call `if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();`.
    6. `await disconnectDB()`.
    7. `clearTimeout(forceTimer); process.exit(0);`.
- **Mongoose (`server/src/config/db.js:14-17`):**
  - Replace `serverSelectionTimeoutMS: 5000` and `autoIndex: true` with:
    ```js
    serverSelectionTimeoutMS: 12000,
    autoIndex: env.NODE_ENV !== 'production',
    ```

### Pattern 6: `SERVE_CLIENT=true` SPA Serving & Split-Origin Client URLs (`ORIG-01`, `ORIG-02`)
- **Backend (`server/src/app.js`):**
  - When `serveClient` (`env.SERVE_CLIENT`) is true:
    1. Validate `fs.existsSync(clientIndexPath)` synchronously when initializing `createApp` / on startup; throw a clear error naming the missing `client/dist/index.html` path and `npm run build --workspace=client`.
    2. Mount `app.use('/api', notFoundHandler)` IMMEDIATELY after `app.use('/api/v1', routes)` and BEFORE static middleware so any unknown `/api/*` request returns structured JSON `404` (`ENDPOINT_NOT_FOUND`).
    3. Mount `/assets` static middleware: `app.use('/assets', express.static(path.join(clientDistDir, 'assets'), { maxAge: '1y', immutable: true, fallthrough: false }))` (or `setHeaders` setting `Cache-Control: public, max-age=31536000, immutable`) — note `fallthrough: true` or custom 404 ensures missing `/assets/foo.js` returns 404, NOT `index.html`.
    4. Mount root static middleware: `app.use(express.static(clientDistDir, { index: false, setHeaders: (res, filePath) => { if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }))` — serves `favicon.svg`, `icons.svg`, `manifest.json`, `sw.js`, `theme-init.js`.
    5. Mount SPA fallback `app.get('*', (req, res, next) => { ... })`:
       - Skip if `req.path === '/api' || req.path.startsWith('/api/') || req.path === '/socket.io' || req.path.startsWith('/socket.io/') || Boolean(path.posix.extname(req.path))` -> `return next();`.
       - Otherwise `res.setHeader('Cache-Control', 'no-cache'); res.sendFile(clientIndexPath);`.
  - Keep `app.use(notFoundHandler); app.use(errorHandler);` at the end.
- **Client (`client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/src/vite-env.d.ts`):**
  - `client/src/api/client.ts`:
    ```ts
    const normalizedViteApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
    export const API_BASE_URL = normalizedViteApiUrl || '/api/v1';
    ```
    Use `API_BASE_URL` in:
    - Line 6: `baseURL: API_BASE_URL,`
    - Line 47: `const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {`
    - Line 190: `return `${API_BASE_URL}/batches/${id}/export`;`
  - `client/src/utils/socketClient.ts`:
    ```ts
    export function resolveSocketUrl(): string {
      const explicitSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
      if (explicitSocketUrl) return explicitSocketUrl;

      const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
      if (rawApiUrl && /^https?:\/\//i.test(rawApiUrl)) {
        try {
          return new URL(rawApiUrl).origin;
        } catch {
          // Fall back to relative root
        }
      }
      return '/';
    }
    ```
    Pass `resolveSocketUrl()` instead of `'/'` in `createRealtimeSocket` (line 11).

### Anti-Patterns to Avoid
- **Never set `app.set('trust proxy', true)`**: `express-rate-limit` throws `ERR_ERL_PERMISSIVE_TRUST_PROXY` `[VERIFIED: server/node_modules/express-rate-limit/dist/index.cjs]`.
- **Never leave `upgradeInsecureRequests` enabled by default in Helmet CSP**: Helmet v7 emits `upgrade-insecure-requests` by default `[VERIFIED: helmet@7.2.0]`, breaking HTTP Docker Compose local testing. Always pass `upgradeInsecureRequests: env.FORCE_HTTPS_CSP ? [] : null`.
- **Never fall through SPA `app.get('*')` for `/api/*`, `/socket.io/*`, or `.js`/`.css` dotted asset paths**: Returns `200 text/html` instead of JSON 404 or asset 404.
- **Never omit `connectSrc` for `api.geoapify.com` or `*.tile.openstreetmap.org`**: `sw.js` (`client/public/sw.js:36`) calls `fetch(event.request)` for intercepted requests, and Leaflet uses subdomains `a`/`b`/`c` on `tile.openstreetmap.org`.
- **Never call `process.exit(1)` inside module top-level `env.js` evaluation unconditionally without a testable throw**: Export `validateProductionEnv()` that throws an `Error`, and call it in `index.js` `startServer()` with `process.exit(1)` catch handling (or spawn-test `index.js` directly).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security HTTP headers & CSP serialization | Manual `res.setHeader('Content-Security-Policy', ...)` string concatenation | `helmet` (`7.2.0`) | Handles directive casing, COOP, `X-Content-Type-Options`, `Referrer-Policy`, and `null` directive omission safely |
| IP rate limiting behind reverse proxy | Custom in-memory IP counter map | `express-rate-limit` (`7.5.1`) + `app.set('trust proxy', env.TRUST_PROXY)` | Handles `RateLimit-*` standard headers, sliding/fixed windows, and `X-Forwarded-For` parsing |
| CORS header & preflight negotiation | Manual `Access-Control-Allow-Origin` middleware | `cors` (`2.8.6`) delegate `(req, cb)` shared across Express and Socket.IO | Properly handles `Vary: Origin`, `OPTIONS` preflight, credentials, and Engine.IO WebSocket upgrades |
| URL origin extraction in client | Regex splitting `VITE_API_URL` on `/api` | `new URL(rawApiUrl).origin` | Handles ports, paths, trailing slashes, and invalid URLs safely |

## Common Pitfalls

### Pitfall 1: `CORS` Blocking Same-Origin `POST` Requests Under `SERVE_CLIENT=true`
**What goes wrong:** In `NODE_ENV=production` with `SERVE_CLIENT=true` and `CLIENT_ORIGIN` unset (`HARD-01` explicitly allows omitting `CLIENT_ORIGIN` when `SERVE_CLIENT === 'true'`), browsers still send `Origin: https://your-host` on `POST /api/v1/auth/login` and Socket.IO polling/WebSocket handshakes. An empty `allowedOrigins` list rejects those same-origin requests.
**How to avoid:** Use a `cors` options delegate `(req, callback)` that checks `serveClient && new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host)`.

### Pitfall 2: `env.js` Silently Loading Local `server/.env` in `NODE_ENV=production`
**What goes wrong:** `server/src/config/env.js:5-15` loads `.env` even when `NODE_ENV === 'production'`. On a developer machine or misconfigured host where `server/.env` exists, `dotenv.config()` populates `process.env` with dev values before validation runs.
**How to avoid:** Only load `dotenv.config()` when `process.env.NODE_ENV !== 'production'` AND validate raw `process.env` against `DISALLOWED_JWT_SECRETS` and length `>= 32`.

### Pitfall 3: `client/index.html` Inline Script Hash Drift Across Line Endings
**What goes wrong:** A CSP `'sha256-...'` hash breaks if an editor or Git `core.autocrlf` switches `\n` to `\r\n` inside `<script>...</script>`.
**How to avoid:** Extract the inline script (`client/index.html:10-38`) to `client/public/theme-init.js` and reference `<script src="/theme-init.js"></script>` so `script-src` stays `'self' https://accounts.google.com` with zero fragile inline hashes.

### Pitfall 4: Existing Tests (`socket_auth.test.js`, `auth.test.js`) Breaking on Signal Listeners or Rate Limits
**What goes wrong:** `server/tests/socket_auth.test.js:12` imports `{ server, io } = require('../src/index')`. Registering top-level `process.on('SIGTERM', ...)` on every import adds duplicate listeners or triggers `process.exit`, and `authRateLimiter` (`max: 30`) accumulates across requests from `127.0.0.1` in a single test file.
**How to avoid:** Attach `SIGTERM`/`SIGINT` listeners only inside `if (require.main === module)` (or via a guarded `registerShutdownHandlers()` called by `startServer()`), and in rate-limiter tests use distinct `X-Forwarded-For` headers (with `trust proxy: 1`) or isolated `createApp()` instances.

### Pitfall 5: Duplicate Root `express-rate-limit@8.7.3` vs Server `7.5.1`
**What goes wrong:** Root `node_modules` currently contains `express-rate-limit@8.7.3` while `server/node_modules` contains `7.5.1`. (Root `package.json` cleanup is scheduled in Phase 12 `CONT-01`.)
**How to avoid:** Ensure `rateLimiter.js` uses options compatible with both `7.5.1` and `8.x` (e.g., `standardHeaders: true`, `legacyHeaders: false`, numeric `trust proxy` — never boolean `true`), and run Jest from `server/` (`npm --prefix server test`) where `server/node_modules/express-rate-limit@7.5.1` resolves.

## Code Examples

### 1. Extracted Theme Boot Script (`client/public/theme-init.js` + `client/index.html`)
Source: `client/index.html:10-38`
```js
(function () {
  try {
    var saved = localStorage.getItem('smartroute-theme');
    var isDark =
      saved === 'dark' ||
      (saved === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#0B0C0E' : '#FFFFFF');
    }
  } catch (e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
})();
```
In `client/index.html`: replace lines `10-38` with `<script src="/theme-init.js"></script>`.

### 2. Shared CORS Delegate (`server/src/config/cors.js`)
```js
const DEV_LOCALHOST_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function parseAllowedOrigins(rawClientOrigin = '', nodeEnv = process.env.NODE_ENV) {
  const parsed = String(rawClientOrigin || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (nodeEnv !== 'production') {
    return Array.from(new Set([...parsed, ...DEV_LOCALHOST_ORIGINS]));
  }
  return Array.from(new Set(parsed));
}

function isSameRequestHost(origin, req) {
  try {
    const originHost = new URL(origin).host;
    const requestHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
    return Boolean(originHost && requestHost && originHost === String(requestHost).split(',')[0].trim());
  } catch {
    return false;
  }
}

function createCorsOptionsDelegate({ allowedOrigins, nodeEnv, serveClient, methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'] }) {
  return (req, callback) => {
    const rawOrigin = req?.headers?.origin;
    if (!rawOrigin || nodeEnv !== 'production') {
      return callback(null, { origin: true, credentials: true, methods });
    }
    const normalized = normalizeOrigin(rawOrigin);
    if (allowedOrigins.includes(normalized) || (serveClient && isSameRequestHost(normalized, req))) {
      return callback(null, { origin: true, credentials: true, methods });
    }
    const err = new Error('Blocked by CORS');
    err.statusCode = 403;
    err.code = 'CORS_BLOCKED';
    return callback(err);
  };
}
```

### 3. Client URL Resolution (`client/src/api/client.ts` & `client/src/utils/socketClient.ts`)
```ts
// client/src/api/client.ts
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE_URL = rawApiUrl || '/api/v1';

// client/src/utils/socketClient.ts
export function resolveSocketUrl(): string {
  const explicitSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }
  const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (rawApiUrl && /^https?:\/\//i.test(rawApiUrl)) {
    try {
      return new URL(rawApiUrl).origin;
    } catch {
      // ignore invalid URL and fall back to same-origin
    }
  }
  return '/';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `helmet({ contentSecurityPolicy: false })` | Strict CSP + `COOP: same-origin-allow-popups` + `FORCE_HTTPS_CSP` toggle | Phase 11 | Protects tokens/DOM without breaking Google Sign-In, Leaflet tiles, or HTTP Docker tests |
| `app.set('trust proxy', true)` or omitted | Numeric `TRUST_PROXY` (`1` in prod, `false` in dev/test) | `express-rate-limit` v7+ | Prevents `ERR_ERL_PERMISSIVE_TRUST_PROXY` & `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` |
| `server.close()` alone on shutdown | `isDraining` -> `io.close()` -> `server.close()` + `server.closeIdleConnections()` -> `disconnectDB()` | Node 18.2+ / 20 LTS | Immediately tears down HTTP keep-alive sockets so orchestrators don't hang until `SIGKILL` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser verification in live Chromium (`HARD-04` zero console errors with Google Identity Services & Geoapify/OSM tiles) will be executed either via Playwright/Chromium or verified against CSP rules during UAT/Phase 13 | Phase Requirements / Validation | If an undocumented third-party sub-resource is loaded by `accounts.google.com/gsi/client` at runtime, a CSP directive might need one additional origin |

## Open Questions (RESOLVED)

1. **Inline `<script>` vs `/theme-init.js` preference**
   - What we know: `11-CONTEXT.md` explicitly allows either the exact SHA-256 hash (`'sha256-Zfu0xjbyj5DZit2ESi9UACF5lulvRR98MToNnMX5W2w='`) or `/theme-init.js` under `'self'`.
   - Recommendation: Use `client/public/theme-init.js` + `<script src="/theme-init.js"></script>` so `script-src` stays `'self' https://accounts.google.com` without CRLF/formatting hash fragility.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime, Jest, Vite | ✓ | `v24.16.0` (engines `>=18.0.0`, target `>=20.0.0`) | — |
| npm | Workspace scripts | ✓ | `11.16.0` | — |
| MongoDB (`127.0.0.1:27017`) | Jest integration tests (`setup.js`) | ✓ | Port `27017` reachable (`True`) | — |
| Client TypeScript (`tsc --noEmit`) | Client validation | ✓ | `5.9.3` (passed cleanly) | — |
| Client Vite build (`vite build`) | `client/dist` bundle + `ORIG-01` | ✓ | `5.2.11` (built `dist/` in 4.53s) | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend Framework | Jest `^29.7.0` + Supertest `^6.3.4` (`server/jest.config.js`) |
| Test Setup | `server/tests/setup.js` (auto-connects `mongodb://127.0.0.1:27017/smartroute_test`, clears collections `afterEach`, closes `afterAll`) |
| Quick Backend Run | `npm --prefix server test -- tests/runtime_hardening.test.js` |
| Full Backend Suite | `npm --prefix server test` (`cross-env NODE_ENV=test jest --runInBand --detectOpenHandles --forceExit`) |
| Client Type Check & Build | `npm --prefix client test` (`tsc --noEmit`) and `npm --prefix client run build` (`tsc && vite build`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | `validateProductionEnv()` rejects missing `MONGODB_URI`, missing/short/default `JWT_SECRET` & `JWT_REFRESH_SECRET`, missing `CLIENT_ORIGIN` (when `SERVE_CLIENT !== 'true'`), allows `mongodb://mongo:27017/...`, unifies `GEOAPIFY_SERVER_API_KEY` / `GEOAPIFY_API_KEY` across `env.js`, `geoapify.service.js`, `adminController.js`; child process `NODE_ENV=production node src/index.js` exits `1` | unit + process spawn | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| HARD-02 | `app.get('trust proxy')` is numeric `1` in prod (`false` in dev/test, never `true`), `X-Forwarded-For` isolates rate-limit buckets cleanly with zero `ERR_ERL_*` warnings, duplicate `loginLimiter` removed | integration (Supertest) | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| HARD-03 | `parseAllowedOrigins()` trims, strips trailing slashes, omits localhost in `production` unless explicit, and shared CORS delegate allows/blocks Express & Socket.IO identically (plus same-origin `SERVE_CLIENT=true`) | unit + integration (Supertest + `socket.io-client`) | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| HARD-04 | Helmet emits CSP (`script-src 'self' https://accounts.google.com`, map tiles, fonts, avatars, `ws:`/`wss:`, no `upgrade-insecure-requests` unless `FORCE_HTTPS_CSP=true`) & `Cross-Origin-Opener-Policy: same-origin-allow-popups` | integration (Supertest) | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| HARD-05 | `/healthz` (`200` / `503` draining), `/readyz` (`200` connected / `503` disconnected or draining), `/api/v1/health` & `/api/v1/health/ready` preserved, idempotent `gracefulShutdown` sequence | integration + unit | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| HARD-06 | `db.js` passes `autoIndex: false` in production (`true` otherwise) and `serverSelectionTimeoutMS: 12000` to `mongoose.connect` | unit (spy on `mongoose.connect`) | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| ORIG-01 | `SERVE_CLIENT=true` fails fast if `client/dist/index.html` missing; serves `/assets/*` with `immutable`, `index.html` with `no-cache`, SPA routes (`GET /admin/control-center`) with HTML, dotted missing asset as 404, and `/api/v1/does-not-exist` as JSON `404` | integration (Supertest) | `npm --prefix server test -- tests/runtime_hardening.test.js` | ❌ Wave 0 |
| ORIG-02 | `client/src/api/client.ts` & `socketClient.ts` resolve `VITE_API_URL`, `VITE_SOCKET_URL`, origin derivation, and `/` / `/api/v1` defaults cleanly | typecheck + Vite build (+ optional Node unit check) | `npm --prefix client test && npm --prefix client run build` | ✅ (existing scripts) |

### Wave 0 Gaps
- [ ] `server/tests/runtime_hardening.test.js` (or split into `env_cors_hardening.test.js` + `spa_probes_hardening.test.js`) — covers `HARD-01..06` and `ORIG-01`
- [ ] Baseline verification run of existing `server/tests/` suite (`npm --prefix server test`) + `npm --prefix client test && npm --prefix client run build` after all Phase 11 edits

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Keep existing `authRateLimiter` (single limiter, no double-count), fail-fast `>=32`-char non-default `JWT_SECRET` / `JWT_REFRESH_SECRET` |
| V3 Session Management | yes | `JWT_REFRESH_SECRET` enforcement + rotation intact; `COOP: same-origin-allow-popups` for Google OAuth popup flow |
| V4 Access Control | yes | Shared `CLIENT_ORIGIN` CORS allowlist (no wildcard, no implicit localhost in production) |
| V5 Input Validation | yes | Strict `TRUST_PROXY` integer/`'false'` parsing; `/api/*` isolated from SPA HTML fallback |
| V14 Configuration & HTTP Security | yes | Helmet v7 strict CSP (no `'unsafe-inline'` in `script-src`), production `autoIndex: false`, graceful drain |

### Known Threat Patterns for Express + Socket.IO + Vite
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hardcoded dev JWT fallback in prod | Elevation of Privilege / Spoofing | `validateProductionEnv()` rejects missing, `<32` char, or committed dev/CI JWT secrets (`process.exit(1)`) |
| Rate-limit bypass or shared-bucket DoS behind proxy | Denial of Service | `app.set('trust proxy', 1)` (`TRUST_PROXY`) + single `authRateLimiter` |
| Permissive wildcard/localhost CORS in prod | Information Disclosure / CSRF | `parseAllowedOrigins()` omits localhost in `production` unless explicitly configured |
| XSS / Script injection in served SPA | Tampering | Strict Helmet `script-src` (`'self' https://accounts.google.com`) + `theme-init.js` |

## Sources

### Primary (HIGH confidence — Direct Codebase & Tool Inspection)
- `server/src/config/env.js:1-49`, `server/src/config/db.js:1-41`, `server/src/app.js:1-74`, `server/src/index.js:1-80`
- `server/src/routes/index.js:1-54`, `server/src/routes/authRoutes.js:1-25`, `server/src/middleware/rateLimiter.js:1-31`, `server/src/middleware/errorHandler.js:1-103`, `server/src/middleware/auth.js:1-142`
- `server/src/controllers/adminController.js:87-98,1106-1179`, `server/src/services/mapping/geoapify.service.js:1-106`, `server/src/services/googleAuthService.js:1-63`
- `client/index.html:1-50`, `client/public/manifest.json`, `client/public/sw.js`, `client/src/api/client.ts:1-447`, `client/src/utils/socketClient.ts:1-53`, `client/src/components/auth/GoogleSignInButton.tsx:1-163`, `client/src/components/maps/InteractiveMap.tsx:1-393`, `client/src/components/driver/PODModal.tsx:86-125`, `client/src/App.tsx:1-109`, `client/src/vite-env.d.ts`
- `.env.example`, `server/.env.example`, `server/.env.test`, `.github/workflows/ci.yml`, `server/jest.config.js`, `server/tests/setup.js`, `server/tests/auth.test.js`, `server/tests/socket_auth.test.js`
- Runtime verification via Node `v24.16.0`: `helmet@7.2.0` default directives & `upgradeInsecureRequests: null`, `express-rate-limit@7.5.1` `ERR_ERL_*` list & `trust proxy: 1` `X-Forwarded-For` test, `cors@2.8.6` & `engine.io` delegate inspection, SHA-256 computation of `client/index.html` inline script, `npm --prefix server test -- tests/auth.test.js`, `npm --prefix client test`, `npm --prefix client run build`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified exact installed versions and runtime behavior of `helmet@7.2.0`, `express-rate-limit@7.5.1`, `cors@2.8.6`, `socket.io@4.8.4`, `mongoose@8.24.8`
- Architecture: HIGH — all target files, line numbers, middleware order, and client URL references directly inspected
- Pitfalls: HIGH — verified same-origin `SERVE_CLIENT=true` CORS behavior in `cors`/`engine.io` and `dotenv` dev secret shadowing

**Research date:** 2026-11-11
**Valid until:** 2026-12-11
