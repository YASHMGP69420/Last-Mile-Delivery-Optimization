---
phase: 11-server-client-runtime-hardening
verified: 2026-11-11T14:48:09Z
status: passed
score: 12/12 must-haves verified
covered_files:
  - .planning/phases/11-server-client-runtime-hardening/11-01-PLAN.md
  - .planning/phases/11-server-client-runtime-hardening/11-01-SUMMARY.md
  - .planning/phases/11-server-client-runtime-hardening/11-02-PLAN.md
  - .planning/phases/11-server-client-runtime-hardening/11-02-SUMMARY.md
  - .planning/phases/11-server-client-runtime-hardening/11-03-PLAN.md
  - .planning/phases/11-server-client-runtime-hardening/11-03-SUMMARY.md
  - client/index.html
  - client/public/theme-init.js
  - client/src/api/client.ts
  - client/src/utils/socketClient.ts
  - client/src/vite-env.d.ts
  - server/src/app.js
  - server/src/config/cors.js
  - server/src/config/db.js
  - server/src/config/env.js
  - server/src/controllers/adminController.js
  - server/src/index.js
  - server/src/middleware/rateLimiter.js
  - server/src/routes/index.js
  - server/src/services/mapping/geoapify.service.js
  - server/tests/env_cors_hardening.test.js
  - server/tests/runtime_hardening.test.js
covered_digest: "v4:sha256:fdca7d43c013fe1d9a85edce637f94b751fad873ade4cfe239499f4320f3037b"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the SERVE_CLIENT=true production app in a real browser with valid VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID and VITE_GEOAPIFY_TILE_API_KEY configured, sign in via Google Identity Services popup, and load map views + Socket.IO telemetry while inspecting DevTools Console."
    expected: "Google Sign-In popup completes without COOP/CSP framing blocks, Geoapify/OSM/CARTO map tiles and Google Fonts render cleanly, theme-init.js applies dark/light theme before first paint, and zero CSP/CORS console errors occur."
    why_human: "External Google OAuth and Geoapify tile credentials and live browser popup/rendering execution are unavailable in offline Jest/Supertest."
---

# Phase 11: Server & Client Runtime Hardening Verification Report

**Phase Goal:** Express, Socket.IO, Mongoose, and the Vite client enforce production security boundaries, proxy-aware rate limiting, readiness draining, and both Single-Origin (`SERVE_CLIENT=true`) and Split-Origin topologies.
**Verified:** 2026-11-11T14:48:09Z
**Status:** passed (automated 12/12 verified; operator approved deferred live OAuth/Geoapify browser check for post-deploy rollout)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Server refuses to boot in `NODE_ENV=production` when `MONGODB_URI`, strong `JWT_SECRET` / `JWT_REFRESH_SECRET` (>=32 chars, non-default, distinct), `TRUST_PROXY`, or required `CLIENT_ORIGIN` (when `SERVE_CLIENT !== 'true'`) is missing or invalid, while permitting explicit URIs like `mongodb://mongo:27017/smartroute`. | ✓ VERIFIED | [`env.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/env.js#L145-L218) skips dotenv in production and validates raw env; [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L88-L96) exits `1` before `connectDB()`; verified by `env_cors_hardening.test.js` and `spawnSync` tests in `runtime_hardening.test.js`. |
| 2 | `GEOAPIFY_SERVER_API_KEY` (with `GEOAPIFY_API_KEY` fallback) and `isGeoapifyConfigured()` resolve identically across `env.js`, `geoapify.service.js`, and `adminController.js`. | ✓ VERIFIED | [`env.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/env.js#L83-L112), [`geoapify.service.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/services/mapping/geoapify.service.js#L19-L36), and [`adminController.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/controllers/adminController.js#L90-L96) (`getOverview`, `getIntegrations`, `testIntegration`) all use `env.GEOAPIFY_SERVER_API_KEY` + `env.isGeoapifyConfigured()`; tested in `env_cors_hardening.test.js` and `admin_control.test.js`. |
| 3 | Express sets numeric `trust proxy` (`1` in production, `false` in dev/test, never boolean `true`) before rate limiters and removes duplicate `loginLimiter` stacking, bucketing proxied `X-Forwarded-For` requests by true client IP with zero `ERR_ERL_*` warnings. | ✓ VERIFIED | [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L16-L33) sets numeric `trust proxy` before routes and omits `loginLimiter`; [`rateLimiter.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/middleware/rateLimiter.js#L10-L23) returns `RATE_LIMIT_EXCEEDED`; verified by 31+1 `X-Forwarded-For` requests in `runtime_hardening.test.js`. |
| 4 | Shared `parseAllowedOrigins()` and `createCorsOptionsDelegate()` in `cors.js` normalize comma-separated `CLIENT_ORIGIN` values, omit localhost in production, support `SERVE_CLIENT=true` same-host requests, and govern both Express and Socket.IO identically. | ✓ VERIFIED | [`cors.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/cors.js#L11-L81) shared by [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L114-L122) and [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L18-L26); verified for Express HTTP + Socket.IO `polling`/`websocket` in `env_cors_hardening.test.js` and `runtime_hardening.test.js`. |
| 5 | Helmet v7 emits strict CSP (`script-src 'self' https://accounts.google.com`, map tiles, Google Fonts, Google avatars, `ws:`/`wss:`, `upgrade-insecure-requests` gated on `FORCE_HTTPS_CSP=true`) and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. | ✓ VERIFIED | [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L36-L82) configures Helmet CSP/COOP; verified by `runtime_hardening.test.js` and direct HTTP spot-check on `/`, `/admin/control-center`, `/theme-init.js`, and `/healthz`. (Live browser OAuth popup/tile loading noted in Human Verification.) |
| 6 | `client/index.html` loads `/theme-init.js` synchronously from `'self'` with zero inline `<script>` blocks, and `npm --prefix client run build` emits `client/dist/theme-init.js` and clean `client/dist/index.html`. | ✓ VERIFIED | [`client/index.html`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/index.html#L10) references `<script src="/theme-init.js"></script>`; [`theme-init.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/public/theme-init.js#L1-L27) emitted to `client/dist/theme-init.js` with zero inline `<script>` tags in `client/dist/index.html`. |
| 7 | `GET /healthz` and `GET /readyz` respond before rate limiters (`503` when draining or MongoDB `readyState !== 1`), while preserving `/api/v1/health` and `/api/v1/health/ready` (also draining-aware). | ✓ VERIFIED | [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L85-L111) and [`routes/index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/routes/index.js#L18-L42); verified in `runtime_hardening.test.js` for connected, draining, and disconnected (`readyState: 0`) states. |
| 8 | `SIGTERM`/`SIGINT` runs idempotent `gracefulShutdown()` (`isDraining` -> `io.close()` + `closeIdleConnections()` -> `server.close()` -> `disconnectDB()` -> `exit(0)` with `.unref()` 10s fallback `exit(1)`), registered inside `require.main === module`. | ✓ VERIFIED | [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L41-L83) & [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L132-L136); verified by `runtime_hardening.test.js` ordering/idempotency test and `socket_auth.test.js` without listener leaks. |
| 9 | `connectDB()` passes `autoIndex: env.NODE_ENV !== 'production'` and `serverSelectionTimeoutMS: 12000` to `mongoose.connect()`. | ✓ VERIFIED | [`db.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/config/db.js#L14-L17); verified in `env_cors_hardening.test.js` for both `production` and `development`. |
| 10 | With `SERVE_CLIENT=true`, startup verifies `client/dist/index.html` exists, unknown `/api/*` returns JSON `404`, `/assets/*` serves `public, max-age=31536000, immutable`, `index.html` serves `no-cache`, SPA GET routes serve `index.html`, and `/socket.io/*` + dotted asset paths skip SPA fallback. | ✓ VERIFIED | [`app.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/app.js#L137-L183) and [`index.js`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/index.js#L98-L107); verified in `runtime_hardening.test.js` and live HTTP `fetch` spot-check. |
| 11 | `client/src/api/client.ts` exports normalized `API_BASE_URL` (default `'/api/v1'`) for `apiClient`, `refreshAccessToken()`, and `BatchesApi.exportCsvUrl()`, and `client/src/utils/socketClient.ts` exports `resolveSocketUrl()` (`VITE_SOCKET_URL` -> origin of `VITE_API_URL` -> `'/'`) passed to `io(...)`. | ✓ VERIFIED | [`client.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/api/client.ts#L5-L52) (`exportCsvUrl` at line 192), [`socketClient.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/utils/socketClient.ts#L9-L46), [`vite-env.d.ts`](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/vite-env.d.ts#L3-L8); verified via Split-Origin Vite build spot-check and clean default build. |
| 12 | All existing backend Jest suites (`27/27`, `317/317` tests including `socket_auth.test.js`), client TypeScript check (`tsc --noEmit`), and Vite client build pass cleanly. | ✓ VERIFIED | Executed directly: `npm --prefix server test` (27 suites, 317 tests passed), `npm --prefix client test` (exit 0), `npm --prefix client run build` (exit 0). |

**Score:** 12/12 truths verified (automated codebase & runtime checks).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `server/src/config/env.js` | Production env parsing, `TRUST_PROXY`/`SERVE_CLIENT`/`FORCE_HTTPS_CSP`, Geoapify key unification, `validateProductionEnv()` | ✓ VERIFIED | Exists, substantive (228 lines), wired into `app.js`, `index.js`, `db.js`, `geoapify.service.js`, `adminController.js`. |
| `server/src/config/cors.js` | Shared multi-origin CORS parser and Express/Socket.IO delegate | ✓ VERIFIED | Exists, substantive (89 lines), wired into `app.js` and `index.js`. |
| `server/src/config/db.js` | Production-hardened Mongoose connection options (`autoIndex`, `serverSelectionTimeoutMS`) | ✓ VERIFIED | Exists, substantive (41 lines), wired into `index.js`. |
| `server/src/services/mapping/geoapify.service.js` | Unified `GEOAPIFY_SERVER_API_KEY` + `isGeoapifyConfigured()` resolution | ✓ VERIFIED | Exists, substantive (120 lines), uses `env.GEOAPIFY_SERVER_API_KEY` and `env.isGeoapifyConfigured()`. |
| `server/src/controllers/adminController.js` | Unified Geoapify config/masking via `env.js` | ✓ VERIFIED | Uses `env.GEOAPIFY_SERVER_API_KEY` and `env.isGeoapifyConfigured()` in `getOverview`, `getIntegrations`, `testIntegration`. |
| `server/src/app.js` | Hardened Express `createApp()` factory & default `app` (`module.exports = app; app.createApp = createApp;`) | ✓ VERIFIED | Exists, substantive (195 lines), CommonJS `app` + `app.createApp` exported and wired to `index.js` and tests. (Note: `verify.artifacts` reported `Missing export: default app` solely because `11-03-PLAN.md` wrote `"default app"` instead of `app` in CommonJS export metadata.) |
| `server/src/index.js` | Boot env/dist validation, shared Socket.IO CORS, idempotent `gracefulShutdown()` | ✓ VERIFIED | Exists, substantive (144 lines), exports `{ app, server, io, startServer, gracefulShutdown }`. |
| `server/src/routes/index.js` | Preserved `/api/v1/health` and draining-aware `/api/v1/health/ready` | ✓ VERIFIED | Exists, substantive (56 lines), checks `req.app?.get?.('isDraining')` and `readyState === 1`. |
| `server/src/middleware/rateLimiter.js` | Single clean `authRateLimiter` + `operationalRateLimiter` with `RATE_LIMIT_EXCEEDED` | ✓ VERIFIED | Exists, substantive (38 lines), wired to `authRoutes.js` and operational routes without duplicate `loginLimiter`. |
| `client/public/theme-init.js` | Synchronous `'self'` theme boot script | ✓ VERIFIED | Exists, 27 lines, copied verbatim to `client/dist/theme-init.js`. |
| `client/index.html` | `<script src="/theme-init.js"></script>` with zero inline scripts | ✓ VERIFIED | Exists, 22 lines, zero inline `<script>` tags in source or built `client/dist/index.html`. |
| `client/src/vite-env.d.ts` | Typed `ImportMetaEnv` (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEOAPIFY_TILE_API_KEY`) | ✓ VERIFIED | Exists, 12 lines, passes `tsc --noEmit`. |
| `client/src/api/client.ts` | Split-origin aware `API_BASE_URL` across `apiClient`, `refreshAccessToken()`, `BatchesApi.exportCsvUrl()` | ✓ VERIFIED | Exists, 450 lines, exports `API_BASE_URL`, `apiClient`, `BatchesApi`. |
| `client/src/utils/socketClient.ts` | Split-origin `resolveSocketUrl()` wired to `createRealtimeSocket()` | ✓ VERIFIED | Exists, 79 lines, exports `resolveSocketUrl`, `createRealtimeSocket`, `mountRealtimeSocket`. |
| `server/tests/env_cors_hardening.test.js` | Unit/integration coverage for `HARD-01`, `HARD-02` (`parseTrustProxy`), `HARD-03`, `HARD-06` | ✓ VERIFIED | Exists, 420 lines, all tests pass. |
| `server/tests/runtime_hardening.test.js` | Integration suite for `HARD-01..05` and `ORIG-01` | ✓ VERIFIED | Exists, 546 lines, all tests pass. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `server/src/controllers/adminController.js` | `server/src/config/env.js` | `env.GEOAPIFY_SERVER_API_KEY` and `env.isGeoapifyConfigured()` | ✓ WIRED | Verified by `gsd-tools query verify.key-links` and integration test in `env_cors_hardening.test.js`. |
| `server/src/services/mapping/geoapify.service.js` | `server/src/config/env.js` | `env.isGeoapifyConfigured(env.GEOAPIFY_SERVER_API_KEY)` | ✓ WIRED | Verified by `gsd-tools query verify.key-links` and unit test in `env_cors_hardening.test.js`. |
| `server/src/config/db.js` | `mongoose.connect` | `autoIndex: env.NODE_ENV !== 'production'`, `serverSelectionTimeoutMS: 12000` | ✓ WIRED | Verified by `gsd-tools query verify.key-links` and isolated spy test in `env_cors_hardening.test.js`. |
| `client/index.html` | `client/public/theme-init.js` | `<script src="/theme-init.js"></script>` | ✓ WIRED | Verified in `client/index.html` and built `client/dist/index.html` + `client/dist/theme-init.js`. |
| `client/src/api/client.ts` | `import.meta.env.VITE_API_URL` | `API_BASE_URL` in `apiClient`, `refreshAccessToken()`, `BatchesApi.exportCsvUrl()` | ✓ WIRED | Verified in source and Split-Origin `VITE_API_URL` Vite bundle test. |
| `client/src/utils/socketClient.ts` | `import.meta.env.VITE_SOCKET_URL` | `resolveSocketUrl()` in `createRealtimeSocket()` | ✓ WIRED | Verified in source and `tsc --noEmit` + Vite build. |
| `server/src/app.js` | `server/src/config/cors.js` | `createCorsOptionsDelegate({ allowedOrigins, nodeEnv, serveClient })` | ✓ WIRED | Verified by `gsd-tools query verify.key-links` and `runtime_hardening.test.js`. |
| `server/src/index.js` | `server/src/config/cors.js` | Socket.IO `cors: createCorsOptionsDelegate(...)` | ✓ WIRED | Verified by `gsd-tools query verify.key-links` and Socket.IO handshake tests in `runtime_hardening.test.js`. |
| `server/src/index.js` | `server/src/config/env.js` | `validateProductionEnv()` in `startServer()` before `connectDB()` | ✓ WIRED | Verified by `spawnSync` fail-fast tests in `runtime_hardening.test.js`. |
| `server/src/app.js` | `client/dist/index.html` | `SERVE_CLIENT=true` existence check, `/assets` immutable static, SPA fallback | ✓ WIRED | Verified in `runtime_hardening.test.js` and live HTTP `fetch` spot-check. |

### Data-Flow Trace (Level 4)

Not applicable to UI DB queries (Phase 11 introduces configuration, middleware, probe, and URL-resolution plumbing rather than new UI data views); env/config flows (`process.env` -> `env.js` -> `app.js`/`index.js`/`adminController.js`/`geoapify.service.js`, and `import.meta.env` -> `API_BASE_URL`/`resolveSocketUrl()`) are traced end-to-end above with zero static stubs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full backend test suite (`env_cors_hardening`, `runtime_hardening`, `socket_auth`, `auth`, `admin_control`, etc.) | `npm --prefix server test` | `27 passed, 27 total` suites; `317 passed, 317 total` tests; exit 0 | ✓ PASS |
| Client TypeScript typecheck | `npm --prefix client test` | `tsc --noEmit` exit 0 | ✓ PASS |
| Client production build + CSP inline-script check | `npm --prefix client run build` + Node check on `client/dist/index.html` & `client/dist/theme-init.js` | `dist/index.html` (1.11 kB), `dist/theme-init.js` present, zero inline `<script>` tags | ✓ PASS |
| Split-Origin `VITE_API_URL` Vite bundle check (temp outDir) | `VITE_API_URL=https://api.example.com/api/v1/ npx vite build --outDir $TEMP\smartroute-split-verify` | Built bundle contains `https://api.example.com/api/v1` with runtime `.replace(/\/+$/, '')` normalization; temp dir removed | ✓ PASS |
| Live `SERVE_CLIENT=true` HTTP response & security headers spot-check | `node -e "...createApp({ nodeEnv: 'production', serveClient: true })..."` | `/` & `/admin/control-center` -> `200`, `text/html`, `Cache-Control: no-cache`, `COOP: same-origin-allow-popups`, CSP present; `/theme-init.js` -> `200`, `application/javascript`; `/api/v1/does-not-exist` -> `404`, `application/json` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| HARD-01 | 11-01, 11-03 | Fail-fast `NODE_ENV=production` validation (`MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`) + Geoapify key unification | ✓ SATISFIED | `env.js`, `index.js`, `geoapify.service.js`, `adminController.js`, `env_cors_hardening.test.js`, `runtime_hardening.test.js` |
| HARD-02 | 11-03 (helper in 11-01) | Numeric `trust proxy` before rate limiters (`ERR_ERL_*` clean) + remove duplicate `loginLimiter` | ✓ SATISFIED | `env.js`, `app.js`, `rateLimiter.js`, `env_cors_hardening.test.js`, `runtime_hardening.test.js` |
| HARD-03 | 11-01, 11-03 | Shared `parseAllowedOrigins()` & CORS delegate across Express and Socket.IO | ✓ SATISFIED | `cors.js`, `app.js`, `index.js`, `env_cors_hardening.test.js`, `runtime_hardening.test.js` |
| HARD-04 | 11-02, 11-03 | Helmet v7 CSP + `COOP: same-origin-allow-popups` + external `/theme-init.js` zero inline scripts | ? NEEDS HUMAN | CSP/COOP headers and zero inline scripts verified automatically; live browser OAuth popup & map tile rendering with external credentials queued for human check |
| HARD-05 | 11-03 | Root `/healthz`, `/readyz`, draining-aware `/api/v1/health*`, and idempotent `SIGTERM`/`SIGINT` drain | ✓ SATISFIED | `app.js`, `routes/index.js`, `index.js`, `runtime_hardening.test.js` |
| HARD-06 | 11-01 | Production Mongoose `autoIndex: NODE_ENV !== 'production'` and `serverSelectionTimeoutMS: 12000` | ✓ SATISFIED | `db.js`, `env_cors_hardening.test.js` |
| ORIG-01 | 11-03 | `SERVE_CLIENT=true` hosting (`immutable` `/assets/*`, `no-cache` `index.html`, SPA fallback, JSON `404` on `/api/*`, missing dist guard) | ✓ SATISFIED | `app.js`, `index.js`, `runtime_hardening.test.js`, HTTP `fetch` spot-check |
| ORIG-02 | 11-02 | Split-Origin `VITE_API_URL` / `VITE_SOCKET_URL` across `client.ts` & `socketClient.ts`, defaulting to `'/api/v1'` and `'/'` | ✓ SATISFIED | `vite-env.d.ts`, `client.ts`, `socketClient.ts`, Split-Origin Vite bundle spot-check |

Orphaned requirements: None (`HARD-01..06` and `ORIG-01..02` all claimed in Phase 11 plans).

### Anti-Patterns Found

None. Scanning all 14 modified/created implementation files found zero `TBD`, `FIXME`, `XXX`, `TODO`, or `HACK` debt markers; `GEOAPIFY_PLACEHOLDER_KEYS` / `isPlaceholderKey` in `env.js` and `geoapify.service.js` are intentional placeholder-rejection guards.

### Human Verification Required

### 1. Live Browser CSP/COOP Check for Google OAuth Popup & Map Tiles

**Test:** Boot the server with `NODE_ENV=production` and `SERVE_CLIENT=true` (with valid `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, and `VITE_GEOAPIFY_TILE_API_KEY` configured), open the app in a desktop browser with DevTools Console open, toggle light/dark mode and reload, click **Sign in with Google**, and open a map route/control-center screen.
**Expected:** `/theme-init.js` applies the saved theme before first paint, the Google Identity Services popup opens and completes cleanly under `COOP: same-origin-allow-popups`, Geoapify/OSM/CARTO tiles and Google Fonts load, Socket.IO connects, and zero CSP/CORS console errors are logged.
**Why human:** External Google OAuth / Geoapify tile credentials and interactive browser popup rendering cannot be executed inside offline Jest/Supertest runs.

### Gaps Summary

No code or automated test gaps found. All 27 backend Jest suites (317 tests), client TypeScript checks, Vite production builds, and HTTP header spot-checks passed cleanly; only live browser external-credential OAuth popup and map-tile visual/console confirmation remains for human verification.

---

_Verified: 2026-11-11T14:48:09Z_
_Verifier: the agent (gsd-verifier)_
