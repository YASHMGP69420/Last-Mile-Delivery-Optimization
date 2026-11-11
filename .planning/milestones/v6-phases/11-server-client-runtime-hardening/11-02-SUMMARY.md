---
phase: 11-server-client-runtime-hardening
plan: 02
subsystem: ui
tags: [vite, csp, helmet, axios, socket.io-client, split-origin, typescript]

# Dependency graph
requires: []
provides:
  - "Synchronous /theme-init.js served from 'self' with zero inline <script> blocks in client/index.html"
  - "Typed Vite environment declarations in client/src/vite-env.d.ts"
  - "Normalized API_BASE_URL (default '/api/v1') across apiClient, refreshAccessToken, and BatchesApi.exportCsvUrl"
  - "Split-origin resolveSocketUrl() helper in client/src/utils/socketClient.ts"
affects: [11-03-server-hardening, 12-docker, 13-paas-vercel-render]

# Actuals
actuals:
  tokens: 5633
  tasks: 2
  commits: 2
plan_head_before: 468c5ca60f599118d66acb0822546e2c6076ed24
plan_head_after: 21a36a2293e904ff08a5d9e7f0619930978abaed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External static /theme-init.js in client/public/ for hash-free Helmet script-src 'self' CSP"
    - "Build-time VITE_API_URL / VITE_SOCKET_URL trailing-slash normalization with safe URL origin fallback"

key-files:
  created:
    - client/public/theme-init.js
  modified:
    - client/index.html
    - client/src/vite-env.d.ts
    - client/src/api/client.ts
    - client/src/utils/socketClient.ts

key-decisions:
  - "Extracted inline theme boot script to client/public/theme-init.js rather than SHA-256 CSP hashing to prevent CRLF/LF hash drift across Windows and Linux builds."
  - "Kept BatchesApi export symbol intact while updating BatchesApi.exportCsvUrl() to interpolate API_BASE_URL."
  - "Rebuilt client/dist with default relative env after split-origin bundle verification so Plan 11-03 SERVE_CLIENT=true tests observe default '/' and '/api/v1' paths."

patterns-established:
  - "Split-Origin REST & Socket URL Resolution: explicit VITE_SOCKET_URL -> origin of absolute VITE_API_URL -> relative '/'"

requirements-completed:
  - HARD-04
  - ORIG-02

coverage:
  - id: D1
    description: "client/index.html loads /theme-init.js synchronously from 'self' with zero inline <script> blocks and Vite emits client/dist/theme-init.js."
    requirement: "HARD-04"
    verification:
      - kind: integration
        ref: "npm --prefix client run build && node CSP inline-script check on client/dist/index.html + client/dist/theme-init.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "client/src/api/client.ts exports normalized API_BASE_URL (default '/api/v1') for apiClient, refreshAccessToken(), and BatchesApi.exportCsvUrl(), and client/src/utils/socketClient.ts exports resolveSocketUrl()."
    requirement: "ORIG-02"
    verification:
      - kind: unit
        ref: "npm --prefix client test (tsc --noEmit) && VITE_API_URL=https://api.example.com/api/v1/ vite build bundle check && clean default build check"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 02: Client CSP Decoupling & Split-Origin URL Resolution Summary

**Extracted synchronous `/theme-init.js` out of `client/index.html` for strict `'self'` CSP and wired build-time `VITE_API_URL` / `VITE_SOCKET_URL` resolution across Axios REST and Socket.IO clients**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-11T14:26:03Z
- **Completed:** 2026-11-11T14:29:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted the inline dark/light theme initialization IIFE from `client/index.html` into `client/public/theme-init.js` and replaced it with synchronous `<script src="/theme-init.js"></script>` prior to font preconnect links so dark/light classes apply before first paint with zero inline scripts.
- Added typed `ImportMetaEnv` declarations (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GEOAPIFY_TILE_API_KEY`) to `client/src/vite-env.d.ts`.
- Exported normalized `API_BASE_URL` (defaulting to `'/api/v1'`) in `client/src/api/client.ts` and wired it into `apiClient` `baseURL`, `refreshAccessToken()`, and `BatchesApi.exportCsvUrl()`.
- Exported `resolveSocketUrl()` in `client/src/utils/socketClient.ts` (preferring trimmed `VITE_SOCKET_URL`, else `new URL(VITE_API_URL).origin`, else `'/'`) and passed it to `io(...)` inside `createRealtimeSocket()`.
- Verified TypeScript compilation (`npm --prefix client test`), Split-Origin bundle inlining with `VITE_API_URL=https://api.example.com/api/v1/`, and clean default production build emitting `client/dist/theme-init.js` and zero inline `<script>` tags.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract inline theme boot script to client/public/theme-init.js and verify dist artifact** - `d556f25` (feat)
2. **Task 2: Wire VITE_API_URL and VITE_SOCKET_URL resolution across client REST and Socket.IO modules** - `21a36a2` (feat)

## Files Created/Modified
- `client/public/theme-init.js` - Synchronous theme initialization IIFE served from `'self'`
- `client/index.html` - Replaced inline `<script>` block with `<script src="/theme-init.js"></script>`
- `client/src/vite-env.d.ts` - Declared optional `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID`, and `VITE_GEOAPIFY_TILE_API_KEY` on `ImportMetaEnv`
- `client/src/api/client.ts` - Exported `API_BASE_URL` and wired it into `apiClient`, `refreshAccessToken()`, and `BatchesApi.exportCsvUrl()`
- `client/src/utils/socketClient.ts` - Added and exported `resolveSocketUrl()` and wired it into `createRealtimeSocket()`

## Decisions Made
- Used external static `/theme-init.js` rather than an inline SHA-256 CSP hash to eliminate Windows CRLF vs Linux LF hash drift.
- Rebuilt `client/dist` with unset `VITE_API_URL`/`VITE_SOCKET_URL` after verifying the Split-Origin build so `client/dist` retains default relative paths for Plan 11-03 `SERVE_CLIENT=true` verification.

## Deviations from Plan

None - plan executed exactly as written. (Note: `client/src/api/client.ts` exports `BatchesApi` rather than `batchApi`; `BatchesApi.exportCsvUrl()` was updated accordingly.)

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `client/dist/index.html` and `client/dist/theme-init.js` are built with default relative `/api/v1` and `/` targets and zero inline `<script>` blocks, ready for Plan 11-03 Helmet CSP/COOP and `SERVE_CLIENT=true` integration verification.

## Self-Check: PASSED
- Verified files exist: `client/public/theme-init.js`, `client/index.html`, `client/src/vite-env.d.ts`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/dist/theme-init.js`, `client/dist/index.html`.
- Verified commits exist as ancestors of `HEAD`: `d556f25`, `21a36a2`.
- Verified `npm --prefix client test` and `npm --prefix client run build` exit 0 after final edits.

---
*Phase: 11-server-client-runtime-hardening*
*Completed: 2026-11-11*
