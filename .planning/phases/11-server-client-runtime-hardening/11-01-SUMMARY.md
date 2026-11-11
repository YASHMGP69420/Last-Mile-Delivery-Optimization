---
phase: 11-server-client-runtime-hardening
plan: 01
subsystem: infra
tags: [env-validation, cors, mongoose, geoapify, trust-proxy, security]

# Dependency graph
requires: []
provides:
  - Fail-fast validateProductionEnv(), parseTrustProxy(), and isGeoapifyConfigured() in server/src/config/env.js
  - Unified GEOAPIFY_SERVER_API_KEY lookup across env.js, geoapify.service.js, and adminController.js
  - Shared multi-origin CORS parser and Express/Socket.IO delegate in server/src/config/cors.js
  - Production Mongoose options (autoIndex disabled in production, serverSelectionTimeoutMS 12000) in server/src/config/db.js
affects: [11-03, express-app, socket-io, mongoose-db]

# Actuals (#2632)
actuals:
  tokens: 9136
  tasks: 3
  commits: 4
  plan_head_before: 21a36a2293e904ff08a5d9e7f0619930978abaed
  plan_head_after: 0319e7f9c193081d83dd9ec378d6f8eba8cf6430

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Non-enumerable helper exports on env object for backward-compatible CommonJS destructuring
    - Shared cors(delegate) callback compatible with both Express and Engine.IO IncomingMessage
    - Production-gated Mongoose autoIndex and dotenv loading

key-files:
  created:
    - server/src/config/cors.js
    - server/tests/env_cors_hardening.test.js
  modified:
    - server/src/config/env.js
    - server/src/config/db.js
    - server/src/services/mapping/geoapify.service.js
    - server/src/controllers/adminController.js

key-decisions:
  - "Guard dotenv loading with nodeEnv !== 'production' and validate rawEnv directly in validateProductionEnv() so local .env files or dev defaults never mask missing production variables"
  - "Attach validateProductionEnv, isGeoapifyConfigured, and parseTrustProxy as non-enumerable properties on env so existing require('./env') destructuring and spreads remain intact"
  - "Mask Geoapify key in adminController.getIntegrations only when isGeoapifyConfigured(apiKey) is true so placeholder strings always report 'Not set'"
  - "Evaluate same-request-host Origin matching in createCorsOptionsDelegate() using X-Forwarded-Host / Host when serveClient is true for Express and Engine.IO"

patterns-established:
  - "Production env guard: validateProductionEnv(targetEnv, rawEnv) throws an Error listing all failed production invariants for clean testability and index.js fail-fast exit"
  - "Unified CORS policy: parseAllowedOrigins() normalizes comma-separated CLIENT_ORIGIN values and omits localhost in production"

requirements-completed: [HARD-01, HARD-03, HARD-06]

coverage:
  - id: D1
    description: "Fail-fast production env validation for MONGODB_URI, JWT secrets, TRUST_PROXY, and CLIENT_ORIGIN (optional under SERVE_CLIENT=true)"
    requirement: "HARD-01"
    verification:
      - kind: unit
        ref: "server/tests/env_cors_hardening.test.js#HARD-01: validateProductionEnv()"
        status: pass
      - kind: unit
        ref: "server/tests/env_cors_hardening.test.js#HARD-02: parseTrustProxy()"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unified GEOAPIFY_SERVER_API_KEY (with GEOAPIFY_API_KEY fallback) and placeholder detection across env.js, geoapify.service.js, and adminController.js"
    requirement: "HARD-01"
    verification:
      - kind: integration
        ref: "server/tests/env_cors_hardening.test.js#HARD-01: Env loading & Geoapify key unification"
        status: pass
      - kind: integration
        ref: "server/tests/admin_control.test.js#TC-ADMIN-INT-1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared multi-origin CORS parser and Express/Socket.IO delegate supporting comma-separated origins and SERVE_CLIENT=true same-host requests"
    requirement: "HARD-03"
    verification:
      - kind: unit
        ref: "server/tests/env_cors_hardening.test.js#HARD-03: Shared multi-origin CORS parser & delegate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production Mongoose connection options with autoIndex disabled in production and serverSelectionTimeoutMS set to 12000"
    requirement: "HARD-06"
    verification:
      - kind: unit
        ref: "server/tests/env_cors_hardening.test.js#HARD-06: Production Mongoose connection options"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 01: Production Env, Geoapify Unification, CORS & DB Hardening Summary

**Fail-fast production environment validation (`HARD-01`), unified `GEOAPIFY_SERVER_API_KEY` resolution across service and admin endpoints, shared multi-origin Express/Socket.IO CORS delegation (`HARD-03`), and production Mongoose connection hardening (`HARD-06`).**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-11T14:25:11Z
- **Completed:** 2026-11-11T14:32:13Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Hardened `server/src/config/env.js` to skip dotenv loading when `NODE_ENV=production`, omit localhost `CLIENT_ORIGIN` fallback in production, parse numeric `TRUST_PROXY` (rejecting boolean `'true'`), unify `GEOAPIFY_SERVER_API_KEY` (with `GEOAPIFY_API_KEY` fallback), and validate `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (length `>= 32`, non-default, distinct), `TRUST_PROXY`, and `CLIENT_ORIGIN` via `validateProductionEnv()`.
- Unified Geoapify key resolution and placeholder rejection (`isGeoapifyConfigured()`) across `server/src/services/mapping/geoapify.service.js` and `server/src/controllers/adminController.js` (`getOverview`, `getIntegrations`, `testIntegration`), ensuring `keyMasked` returns `'Not set'` for placeholder keys.
- Created `server/src/config/cors.js` exporting `DEV_LOCALHOST_ORIGINS`, `normalizeOrigin()`, `parseAllowedOrigins()`, `isSameRequestHost()`, and `createCorsOptionsDelegate()` for consistent Express + Socket.IO CORS enforcement and `SERVE_CLIENT=true` same-host handling.
- Updated `server/src/config/db.js` to pass `serverSelectionTimeoutMS: 12000` and `autoIndex: env.NODE_ENV !== 'production'` to `mongoose.connect()`.
- Created `server/tests/env_cors_hardening.test.js` (19/19 passing) and verified zero regressions in `server/tests/admin_control.test.js` (15/15 passing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire fail-fast env validation, TRUST_PROXY parsing, and Geoapify key unification end-to-end** - `46dbd7f` (`feat`)
2. **Task 2: Extract shared multi-origin CORS parser and Express/Socket.IO delegate in server/src/config/cors.js** - `9bb60dc` (`feat`)
3. **Task 3: Harden Mongoose production connection options in server/src/config/db.js** - `0319e7f` (`feat`)

_(Note: `git rev-list --count` between `plan_head_before` and `plan_head_after` is `4` due to one concurrent Wave 1 planning commit `8959c79` on `master`.)_

## Files Created/Modified
- `server/src/config/env.js` - Production env guard, `parseTrustProxy()`, `isGeoapifyConfigured()`, `validateProductionEnv()`, `GEOAPIFY_SERVER_API_KEY` fallback, and `TRUST_PROXY`/`SERVE_CLIENT`/`FORCE_HTTPS_CSP` flags.
- `server/src/config/cors.js` - Shared `parseAllowedOrigins()`, `normalizeOrigin()`, `isSameRequestHost()`, and `createCorsOptionsDelegate()` helper for Express and Socket.IO.
- `server/src/config/db.js` - Hardened Mongoose `connectDB()` options (`serverSelectionTimeoutMS: 12000`, `autoIndex: env.NODE_ENV !== 'production'`).
- `server/src/services/mapping/geoapify.service.js` - Replaced hardcoded placeholder check with `env.isGeoapifyConfigured()` and `env.GEOAPIFY_SERVER_API_KEY` resolution.
- `server/src/controllers/adminController.js` - Replaced three `process.env.GEOAPIFY_API_KEY` reads with `env.GEOAPIFY_SERVER_API_KEY` and `env.isGeoapifyConfigured()`.
- `server/tests/env_cors_hardening.test.js` - 19 unit and integration tests covering `HARD-01`, `HARD-02` (`parseTrustProxy`), `HARD-03`, and `HARD-06`.

## Decisions Made
- Checked `rawEnv.CLIENT_ORIGIN` directly inside `validateProductionEnv(targetEnv, rawEnv)` (mirroring `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`) so non-production `.env.test` defaults on `targetEnv` never mask a missing `CLIENT_ORIGIN` in production validation.
- Deferred invalid `TRUST_PROXY` parsing errors during `env.js` top-level initialization to `validateProductionEnv()` so all invalid production variables are reported in a single descriptive `Error`.
- Added `isGeoapifyConfigured(apiKey)` check for `keyMasked` in `adminController.getIntegrations` so default placeholder strings (`YOUR_GEOAPIFY_SERVER_KEY`, `mock-geoapify-key`, etc.) never leak partial masked strings and consistently report `'Not set'`.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- During Task 1 verification, `validateProductionEnv(env, noOrigin)` initially passed unexpectedly when `env` was loaded under `NODE_ENV=test` (because `.env.test` set `env.CLIENT_ORIGIN='http://localhost:5173'` and `validateProductionEnv` fell back to `targetEnv.CLIENT_ORIGIN` when `rawEnv.CLIENT_ORIGIN` was omitted). Fixed immediately to validate `rawEnv.CLIENT_ORIGIN` directly.
- During Task 3 test authoring, spying on the outer `mongoose.connect` inside `jest.isolateModules` did not intercept the isolated `db.js` module's `mongoose` import. Scoped the `jest.spyOn(isolatedMongoose, 'connect')` inside `jest.isolateModules` so the shared `setup.js` MongoDB connection remains untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `server/src/config/env.js`, `server/src/config/cors.js`, and `server/src/config/db.js` expose all runtime contracts required by Plan `11-03` (`app.js` and `index.js` integration).
- Verification runs completed:
  - `npm --prefix server test -- tests/env_cors_hardening.test.js` -> 19/19 passed
  - `npm --prefix server test -- tests/admin_control.test.js` -> 15/15 passed

## Self-Check: PASSED
- Found all created/modified files (`server/src/config/env.js`, `server/src/config/cors.js`, `server/src/config/db.js`, `server/src/services/mapping/geoapify.service.js`, `server/src/controllers/adminController.js`, `server/tests/env_cors_hardening.test.js`).
- Verified all Plan 11-01 commits (`46dbd7f`, `9bb60dc`, `0319e7f`) exist as ancestors of `HEAD`.
- Zero stub patterns or untracked `.env` artifacts present.

---
*Phase: 11-server-client-runtime-hardening*
*Completed: 2026-11-11*
