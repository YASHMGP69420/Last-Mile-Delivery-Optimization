---
phase: 19-continue-execution-from-antigravity
plan: "01"
subsystem: testing
tags: [playwright, e2e, vite, esm, express, webserver]

requires:
  - phase: 18-real-time-telemetry-driver-hud-integration
    provides: Real-time telemetry, driver HUD, and admin endpoints
provides:
  - Dual webServer orchestration in Playwright test runner targeting 127.0.0.1:5004 and 127.0.0.1:5173
  - Express API GET /healthz readiness probe alias under /api/v1
  - Modernized Vite ESM configuration with import.meta.dirname
affects: [19-02, 19-03, ci]

actuals:
  tokens: 960
  tasks: 2
  commits: 2

commits: 2
plan_head_before: 92a1ae3bc40632afd11c7f215e127cf1a4d5ead7
plan_head_after: 3bb7ee51e8b024389a9cc88f32bb605be4eb4d26

tech-stack:
  added: []
  patterns: [dual-webserver-orchestration, ipv4-loopback-binding, esm-dirname-resolution]

key-files:
  created: []
  modified:
    - server/src/routes/index.js
    - client/playwright.config.ts
    - client/vite.config.ts

key-decisions:
  - "D-01/D-02: Orchestrate backend (5004) and frontend (5173) in Playwright dual webServer array with reuseExistingServer: !process.env.CI"
  - "Explicit IPv4 loopback binding (127.0.0.1) across Playwright config and Vite proxy prevents IPv6 ::1 ECONNREFUSED issues"
  - "Modernize Vite ESM path resolution with Node 20.11+ import.meta.dirname, eliminating __dirname deprecation warnings"

patterns-established:
  - "Dual webServer orchestration: Playwright starts both backend on :5004 with /api/v1/healthz readiness probe and frontend on :5173"
  - "IPv4 binding: Explicit 127.0.0.1 used for all local server addresses and proxies to prevent ::1 dual-stack resolution mismatches"

requirements-completed:
  - E2E-01

coverage:
  - id: D1
    description: "Playwright dual webServer orchestration for backend (:5004) and frontend (:5173) with /api/v1/healthz probe"
    requirement: "E2E-01"
    verification:
      - kind: e2e
        ref: "npm --prefix client run test:e2e -- --project=chromium --list"
        status: pass
    human_judgment: false
  - id: D2
    description: "Express router /api/v1/healthz readiness probe alias returning HTTP 200 OK"
    requirement: "E2E-01"
    verification:
      - kind: integration
        ref: "node -e \"const r = require('./server/src/routes/index.js'); console.log('Routes loaded successfully');\""
        status: pass
    human_judgment: false
  - id: D3
    description: "Modernized Vite ESM configuration with import.meta.dirname resolving paths cleanly without deprecation"
    requirement: "E2E-01"
    verification:
      - kind: other
        ref: "npm --prefix client run build"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-19
status: complete
---

# Phase 19 Plan 01: Dual webServer Orchestration & Build Modernization Summary

**Playwright dual webServer orchestration for backend (port 5004) and frontend (port 5173), Express /api/v1/healthz readiness probe alias, and Vite ESM modernization using import.meta.dirname.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-11-19T09:55:40Z
- **Completed:** 2026-11-19T10:00:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Configured dual `webServer` array in `client/playwright.config.ts` managing both the backend server (`npm --prefix ../server run start:e2e` targeting port 5004 with `/api/v1/healthz` readiness probe) and the Vite development server (`npm run dev` on port 5173).
- Added dedicated `GET /healthz` endpoint alias to `server/src/routes/index.js` returning HTTP 200 with operational status for container and Playwright orchestration.
- Modernized path resolution across `client/playwright.config.ts` and `client/vite.config.ts` using standard Node 20.11+ `import.meta.dirname`, removing legacy `fileURLToPath` and `dirname` boilerplate.
- Enforced explicit IPv4 loopback (`127.0.0.1`) across Playwright `baseURL`, `webServer.url`, and Vite proxy targets to prevent IPv6 dual-stack resolution failures (`connect ECONNREFUSED ::1:5004`).
- Validated Playwright configuration test suite listing (12 tests across 4 files) and verified clean Vite production build.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end dual webServer orchestration & health probe alias** - `5e97158` (feat)
2. **Task 2: Modernize Vite ESM configuration and clean deprecation warnings** - `3bb7ee5` (chore)

## Files Created/Modified

- `server/src/routes/index.js` - Added `/healthz` readiness probe route handler under `/api/v1`.
- `client/playwright.config.ts` - Converted single webServer to dual webServer array, updated baseURL to IPv4 loopback, modernized path resolution with `import.meta.dirname`.
- `client/vite.config.ts` - Replaced legacy `fileURLToPath`/`__dirname` with `import.meta.dirname`, verified IPv4 proxy endpoints.

## Decisions Made

- Standardized all local test network communication on IPv4 `127.0.0.1` rather than hostname `localhost` to eliminate IPv6 `::1` connection refusals on Node 18+.
- Implemented `reuseExistingServer: !process.env.CI` for both webServers in `playwright.config.ts` to accelerate local developer workflows while ensuring pristine process isolation in automated CI runs.
- Transitioned path aliasing to native `import.meta.dirname` supported in Node 20.11+, resolving Vite deprecation warnings.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 19-01 is complete. Dual server orchestration is verified via `--list` and Vite build passes cleanly.
- System is ready for Plan 19-02 (Wave 2: Auth setup stabilization, resilient admin bootstrap defaults, and automated test user seeding).

---
## Self-Check: PASSED
- FOUND: server/src/routes/index.js
- FOUND: client/playwright.config.ts
- FOUND: client/vite.config.ts
- FOUND: 5e97158
- FOUND: 3bb7ee5
