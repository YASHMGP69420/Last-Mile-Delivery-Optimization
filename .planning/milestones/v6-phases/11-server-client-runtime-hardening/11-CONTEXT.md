# Phase 11: Server & Client Runtime Hardening - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Express, Socket.IO, Mongoose, and the Vite client enforce production security boundaries, proxy-aware rate limiting, readiness draining, and both Single-Origin (`SERVE_CLIENT=true`) and Split-Origin topologies (`HARD-01`..`HARD-06`, `ORIG-01`..`ORIG-02`), without modifying core dispatch, optimization, analytics, or UI business behavior.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/config/env.js`: Centralized env object with dev/test dotenv loading order
- `server/src/config/db.js`: Already exports `connectDB` and `disconnectDB` cleanly
- `server/src/routes/index.js`: Contains existing `/health` and `/health/ready` handlers (`mounted at /api/v1`)
- `server/src/middleware/rateLimiter.js`: Contains `authRateLimiter` and `operationalRateLimiter`
- `client/src/utils/socketClient.ts`: Standardized `createRealtimeSocket` and `mountRealtimeSocket` helpers
- `.planning/codebase/`: Complete architecture/conventions/testing maps available from Milestone v5

### Established Patterns
- Structured API error JSON (`{ success: false, error: { code, message } }`) via `notFoundHandler` and `errorHandler`
- Mongoose `readyState === 1` check in DB helpers
- Centralized `apiClient` interceptor with single-flight `refreshAccessToken()` in `client/src/api/client.ts`

### Integration Points
- `server/src/config/env.js`, `server/src/config/db.js`, `server/src/config/cors.js` (new)
- `server/src/app.js`, `server/src/index.js`, `server/src/controllers/adminController.js`
- `client/index.html`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`

</code_context>

<specifics>
## Specific Ideas

No special UI visual requests — SmartRoute's existing `SERVE_CLIENT=true` + Nginx + Split-Origin topologies must both pass CSP/COOP cleanly in headless Chromium/Jest.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 11 scope (containers in Phase 12, PaaS/seed/smoke/CI in Phase 13, docs/env audit in Phase 14).

</deferred>
