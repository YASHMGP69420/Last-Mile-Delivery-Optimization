---
phase: 11-server-client-runtime-hardening
plan: 03
subsystem: infra
tags: [express, helmet, csp, coop, cors, rate-limit, healthcheck, graceful-shutdown, spa, socket-io]

# Dependency graph
requires:
  - phase: 11-server-client-runtime-hardening
    provides: "11-01 env validation, parseTrustProxy(), shared cors.js delegate, and Mongoose production config"
  - phase: 11-server-client-runtime-hardening
    provides: "11-02 external /theme-init.js and VITE_API_URL / VITE_SOCKET_URL client resolution"
provides:
  - "Hardened Express createApp() factory and default app instance in server/src/app.js"
  - "Boot-time validateProductionEnv() gate, shared Socket.IO CORS, and idempotent SIGTERM/SIGINT drain in server/src/index.js"
  - "Root /healthz & /readyz probes plus draining-aware /api/v1/health/ready"
  - "Single clean authRateLimiter with structured RATE_LIMIT_EXCEEDED error payload"
  - "End-to-end integration test suite in server/tests/runtime_hardening.test.js"
affects: [12-docker-nginx, 13-paas-smoke-ci, 14-env-runbooks]

# Actuals (#2632)
actuals:
  tokens: 8643
  tasks: 3
  commits: 3
  plan_head_before: e7599e430a5f83fca024281ed00c866059f17ec4
  plan_head_after: 0124c2c34c9d782e7ae5eb99225795941cec1429

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express createApp(overrides) factory preserving default module.exports app for backward compatibility and isolated testing"
    - "Probes (/healthz, /readyz) mounted before CORS error blocking and rate limiters"
    - "Idempotent SIGTERM/SIGINT graceful drain: isDraining -> io.close() + closeIdleConnections() -> server.close() -> disconnectDB() -> exit"
    - "SERVE_CLIENT=true route order: /api/v1 -> /api JSON 404 isolation -> /assets immutable static -> dist static -> SPA fallback skipping /api, /socket.io, and dotted paths"

key-files:
  created:
    - server/tests/runtime_hardening.test.js
  modified:
    - server/src/app.js
    - server/src/index.js
    - server/src/routes/index.js
    - server/src/middleware/rateLimiter.js

key-decisions:
  - "Call server.closeIdleConnections() immediately after initiating io.close() before awaiting ioClosePromise so keep-alive sockets tear down without stalling drain"
  - "Resolve default clientDistDir in createApp() to ../../client/dist (repo root client/dist) and normalize clientDistDir with path.resolve() for safe res.sendFile()"
  - "Register SIGTERM/SIGINT handlers inside if (require.main === module) so importing { server, io } in Jest suites like socket_auth.test.js never leaks process listeners"

patterns-established:
  - "Strict Helmet v7 CSP (script-src 'self' https://accounts.google.com, toggleable upgrade-insecure-requests via FORCE_HTTPS_CSP) + COOP same-origin-allow-popups"
  - "Structured RATE_LIMIT_EXCEEDED error envelope alongside top-level message in authRateLimiter"

requirements-completed: [HARD-01, HARD-02, HARD-03, HARD-04, HARD-05, ORIG-01]

coverage:
  - id: D1
    description: "Boot-time production env fail-fast gate in startServer() before connectDB()"
    requirement: "HARD-01"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#HARD-01: Production boot fail-fast process validation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Numeric app.set('trust proxy', ...) before rate limiters and removal of duplicate loginLimiter"
    requirement: "HARD-02"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#HARD-02: Numeric trust proxy & single authRateLimiter IP isolation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared multi-origin and SERVE_CLIENT=true same-host CORS enforcement across Express and Socket.IO"
    requirement: "HARD-03"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#HARD-03: Shared Express & Socket.IO multi-origin and SERVE_CLIENT same-host CORS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Strict Helmet CSP + COOP same-origin-allow-popups with FORCE_HTTPS_CSP toggle"
    requirement: "HARD-04"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#HARD-04: Helmet CSP & COOP headers"
        status: pass
    human_judgment: false
  - id: D5
    description: "Root /healthz & /readyz probes, draining-aware /api/v1/health/ready, and idempotent SIGTERM/SIGINT gracefulShutdown()"
    requirement: "HARD-05"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#HARD-05: Probes (/healthz, /readyz, /api/v1/health*) & gracefulShutdown()"
        status: pass
    human_judgment: false
  - id: D6
    description: "SERVE_CLIENT=true dist existence check, immutable /assets/*, no-cache index.html, SPA fallback, and strict /api/* JSON 404 isolation"
    requirement: "ORIG-01"
    verification:
      - kind: integration
        ref: "server/tests/runtime_hardening.test.js#ORIG-01: SERVE_CLIENT=true static assets, caching, and SPA fallback isolation"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 03: Server Runtime Hardening, Probes, Graceful Drain & SPA Hosting Summary

**Hardened Express (`createApp()`), Socket.IO entrypoint (`index.js`), health probes (`/healthz`, `/readyz`), idempotent `SIGTERM`/`SIGINT` connection draining, Helmet v7 CSP/COOP, and `SERVE_CLIENT=true` SPA serving, verified across all 27 server Jest suites (317 tests) and client TypeScript/Vite build.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-11T14:33:53Z
- **Completed:** 2026-11-11T14:40:55Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Refactored `server/src/app.js` to expose `createApp(overrides)` and default `app` with numeric `trust proxy`, Helmet CSP (`script-src 'self' https://accounts.google.com`, Geoapify/OSM/CARTO tiles, Google Fonts, Google avatars, `ws:`/`wss:`, `FORCE_HTTPS_CSP`-gated `upgrade-insecure-requests`) + `COOP: same-origin-allow-popups`, root `/healthz` and `/readyz` probes before rate limiters/CORS errors, shared `createCorsOptionsDelegate`, removal of duplicate `loginLimiter`, and `SERVE_CLIENT=true` static/SPA hosting with strict `/api` JSON `404` isolation.
- Updated `server/src/routes/index.js` `/health/ready` to honor `req.app.get('isDraining')` (`503` `DRAINING`) alongside MongoDB readiness, and enriched `server/src/middleware/rateLimiter.js` `authRateLimiter` with `error: { code: 'RATE_LIMIT_EXCEEDED', message }`.
- Hardened `server/src/index.js` with boot-time `validateProductionEnv()` and `SERVE_CLIENT` dist validation in `startServer()`, shared `createCorsOptionsDelegate` on Socket.IO `io`, idempotent `gracefulShutdown()` (`isDraining` -> `io.close()` + `server.closeIdleConnections()` -> `server.close()` -> `disconnectDB()` -> `exitFn(0)` with `.unref()` 10s timeout), and `require.main === module`-guarded `SIGTERM`/`SIGINT` handlers.
- Added `server/tests/runtime_hardening.test.js` (11 integration/process-spawn tests covering `HARD-01..05` and `ORIG-01`) and verified the full backend suite (`27/27` suites, `317/317` tests), `npm --prefix client test`, and `npm --prefix client run build`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden Express app.js (trust proxy, Helmet CSP/COOP, shared CORS, probes, SERVE_CLIENT=true) and routes/rateLimiter** - `1a6ec4d` (`feat`)
2. **Task 2: Harden server/src/index.js (boot env gate, shared Socket.IO CORS, idempotent SIGTERM/SIGINT drain)** - `893d7dd` (`feat`)
3. **Task 3: Add runtime_hardening.test.js integration suite and run full backend + client verification** - `0124c2c` (`test`)

## Files Created/Modified
- `server/src/app.js` - `createApp()` factory + default app with trust proxy, Helmet CSP/COOP, `/healthz` & `/readyz`, shared CORS, and `SERVE_CLIENT=true` SPA hosting.
- `server/src/index.js` - `startServer()` production env & `SERVE_CLIENT` gate, shared Socket.IO CORS, and idempotent `gracefulShutdown()`.
- `server/src/routes/index.js` - `/api/v1/health/ready` updated to honor `req.app.get('isDraining')`.
- `server/src/middleware/rateLimiter.js` - `authRateLimiter` structured `RATE_LIMIT_EXCEEDED` error payload.
- `server/tests/runtime_hardening.test.js` - 11 tests covering `HARD-01..05` and `ORIG-01` via `spawnSync`, Supertest, `socket.io-client`, and isolated shutdown drain verification.

## Decisions Made
- Invoked `server.closeIdleConnections()` immediately after initiating `io.close()` before awaiting `ioClosePromise` so HTTP keep-alive connections do not delay Socket.IO/HTTP server teardown.
- Normalized `clientDistDir` with `path.resolve(...)` (defaulting to `../../client/dist`) so `res.sendFile(clientIndexPath)` always receives an absolute path even when callers pass relative overrides.
- Used `X-Forwarded-Host` for `polling` and `Host` for `websocket` in `runtime_hardening.test.js` same-host Socket.IO handshake tests because Node XHR polling clients restrict overriding the `Host` header directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial `runtime_hardening.test.js` draft passed `Host` in `polling` `extraHeaders` (rejected by Node XHR client) and tried `jest.spyOn(mongoose.connection, 'readyState', 'get')` (non-configurable Mongoose property). Updated the test to cover `X-Forwarded-Host` on polling + `Host` on websocket and use `jest.isolateModules` with mocked `mongoose.connection.readyState = 0`; all 11 tests in `runtime_hardening.test.js` and all 27 server suites (317 tests) then passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (`11-01`, `11-02`, `11-03`) runtime hardening is complete and verified across backend (`27/27` suites, `317/317` tests), client TypeScript (`tsc --noEmit`), and Vite production build (`client/dist/`).
- Ready for Phase 12 (Containerization & Nginx Reverse Proxy).

## Self-Check: PASSED
- Verified files exist: `server/src/app.js`, `server/src/index.js`, `server/src/routes/index.js`, `server/src/middleware/rateLimiter.js`, `server/tests/runtime_hardening.test.js`.
- Verified commits exist as ancestors of `HEAD`: `1a6ec4d`, `893d7dd`, `0124c2c`.
- Verified `npm --prefix server test` (27/27 suites, 317/317 tests), `npm --prefix client test`, and `npm --prefix client run build` exit 0 after final edits.

---
*Phase: 11-server-client-runtime-hardening*
*Completed: 2026-11-11*
