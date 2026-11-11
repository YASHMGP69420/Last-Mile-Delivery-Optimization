---
phase: 12-containerization-nginx-reverse-proxy
plan: 01
subsystem: infra
tags: [npm-workspaces, docker, dockerignore, lockfile, node-20, cont-01]

requires:
  - phase: 11-server-and-client-runtime-hardening
    provides: Hardened Express/Socket.IO server and SERVE_CLIENT=true SPA serving ready for container packaging
provides:
  - Cleaned monorepo root package.json free of skewed duplicate dependencies and aligned to Node >=20.0.0 / npm >=10.0.0
  - server/package.json aligned to Node >=20.0.0 with explicit runtime dependency axios@^1.7.2
  - Refreshed root package-lock.json hoisting server workspace dependencies while preserving Linux optional esbuild/rollup binaries
  - Root .dockerignore protecting local .env* secrets, git metadata, node_modules, build artifacts, and non-runtime folders
affects:
  - 12-02-PLAN.md (multi-stage Dockerfile npm ci --omit=dev --workspace=server --include-workspace-root)
  - 12-03-PLAN.md (Docker Compose build context and container startup)

actuals:
  tokens: 124741
  tasks: 2
  commits: 2
plan_head_before: 82fc5ddfbf163d7663b62c98f56e86169796b1e6
plan_head_after: bacd8bfd652341e5cb580ccaddb78c57b1e5c7d1

tech-stack:
  added: []
  patterns:
    - "Monorepo workspace hoisting via root package-lock.json without root-level duplicate libraries"
    - "Secret-safe Docker build context exclusion via root .dockerignore with zero !.env re-inclusions"

key-files:
  created:
    - .dockerignore
  modified:
    - package.json
    - server/package.json
    - package-lock.json

key-decisions:
  - "Hoisted nested server/node_modules dependencies (supertest, express-rate-limit, jest) via targeted workspace installs after clearing root duplicates so root require.resolve('supertest') works while preserving Linux optional binaries in package-lock.json"
  - "Kept server/package.json express-rate-limit spec pinned at ^7.2.0 and declared axios@^1.7.2 explicitly for isolated production server npm ci installs"

patterns-established:
  - "Workspace manifest hygiene: server-only and client-only runtime dependencies stay exclusively in their workspace manifests"
  - "Docker build context hygiene: .env, .env.*, **/.env, **/.env.*, .git, **/node_modules, .planning, tests, scratch, and docs excluded at root"

requirements-completed:
  - CONT-01

coverage:
  - id: D1
    description: "Pruned skewed root dependencies (express-rate-limit, jest, supertest, leaflet, react-leaflet), aligned root and server engines to Node >=20.0.0 / npm >=10.0.0, added axios@^1.7.2 to server/package.json, and refreshed package-lock.json with Linux optional binaries intact and supertest hoisted."
    requirement: CONT-01
    verification:
      - kind: integration
        ref: "node -e workspace manifest & lockfile check + npm --prefix server test (27/27 suites, 317/317 tests) + npm --prefix client test (tsc --noEmit) + npm --prefix client run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Created root .dockerignore excluding .env*, **/.env*, .git, **/node_modules, client/dist, .planning, tests, server/tests, scratch, docs, stitch_smartroute_fleet_platform, coverage, and logs with zero tracked secret .env files."
    requirement: CONT-01
    verification:
      - kind: other
        ref: "node -e .dockerignore & git ls-files secret hygiene check (39 active rules)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-11
status: complete
---

# Phase 12 Plan 01: Workspace Dependency Cleanup & .dockerignore Summary

**Pruned skewed root dependencies, aligned monorepo engines to Node >=20.0.0 / npm >=10.0.0 with explicit `server` `axios@^1.7.2`, refreshed `package-lock.json` hoisting with Linux optional binaries preserved, and locked down `.dockerignore` for Docker builds.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-11T15:02:02Z
- **Completed:** 2026-11-11T15:10:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Removed top-level `dependencies` (`express-rate-limit`, `leaflet`, `react-leaflet`) and skewed `devDependencies` (`jest`, `supertest`) from root `package.json`, preserving `workspaces: ["server", "client"]`, all root scripts, and `concurrently`, and raised `engines` to `node >=20.0.0` / `npm >=10.0.0`.
- Updated `server/package.json` `engines` to `node >=20.0.0` and added `"axios": "^1.7.2"` to `dependencies` so isolated production server installs include `axios`.
- Refreshed `package-lock.json` so all 66 previously nested `server/node_modules/*` entries hoisted cleanly to root `node_modules/` (confirming `require.resolve('supertest')` for `tests/e2e/harness/testServer.js`) while retaining `node_modules/@esbuild/linux-x64` and `node_modules/@rollup/rollup-linux-x64-gnu`.
- Verified full regression suite after lockfile refresh: `npm --prefix server test` (27/27 suites, 317/317 tests passed), `npm --prefix client test` (`tsc --noEmit` passed), and `npm --prefix client run build` (`vite build` succeeded, 1706 modules transformed).
- Created root `.dockerignore` with 39 exclusion rules covering `.env*`, `**/.env*`, `.git`, `**/node_modules`, stale workspace lockfiles, `client/dist`, `.planning`, `tests`, `server/tests`, `scratch`, `docs`, `stitch_smartroute_fleet_platform`, `coverage`, and log files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prune skewed root dependencies, align engines to Node 20, and refresh package-lock.json end-to-end** - `58fcaf7` (chore)
2. **Task 2: Create root .dockerignore excluding secrets, VCS, node_modules, build artifacts, and non-runtime folders** - `bacd8bf` (chore)

## Files Created/Modified
- `package.json` - Removed skewed root `dependencies` and `jest`/`supertest` `devDependencies`; aligned `engines` to `node >=20.0.0` and `npm >=10.0.0`.
- `server/package.json` - Aligned `engines.node` to `>=20.0.0` and added `"axios": "^1.7.2"` to `dependencies`.
- `package-lock.json` - Refreshed workspace dependency tree hoisting `supertest@^6.3.4`, `jest@^29.7.0`, and `express-rate-limit@^7.2.0` to root while keeping Linux optional `@esbuild/linux-x64` and `@rollup/rollup-linux-x64-gnu` entries.
- `.dockerignore` - Created root Docker build-context exclusion rules protecting local secrets and trimming non-runtime directories.

## Decisions Made
- Used targeted workspace installs (`npm install --save-dev supertest@^6.3.4 --workspace=server`, `npm install express-rate-limit@^7.2.0 --workspace=server`, `npm install --save-dev jest@^29.7.0 --workspace=server`) followed by restoring `server/package.json` `"express-rate-limit": "^7.2.0"` and `npm install` rather than deleting `package-lock.json`, because deleting `package-lock.json` on Windows dropped the Linux-only optional entries (`@esbuild/linux-x64`, `@rollup/rollup-linux-x64-gnu`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial `npm install` after pruning root `package.json` retained `supertest@6.3.4`, `express-rate-limit@7.5.1`, and `jest@29.7.0` inside `server/node_modules/` because the pre-existing `package-lock.json` already satisfied `server` there, causing `require.resolve('supertest')` from root to fail. Testing lockfile deletion on Windows also stripped `@esbuild/linux-x64` and `@rollup/rollup-linux-x64-gnu`, so `HEAD`'s `package-lock.json` was restored and targeted `--workspace=server` installs were run to hoist all `server/node_modules/*` packages cleanly to root while keeping both Linux optional binaries intact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Workspace manifests, `package-lock.json`, and `.dockerignore` are ready for `12-02-PLAN.md` (multi-stage non-root `Dockerfile`) and `12-03-PLAN.md` (`docker-compose.yml` + `deploy/nginx/default.conf`).
- No blockers or deferred issues.

## Self-Check: PASSED

- Verified `.dockerignore`, `package.json`, `server/package.json`, and `package-lock.json` exist on disk and pass all Task 1 & Task 2 assertions.
- Verified commits `58fcaf7` and `bacd8bf` exist in Git history (`git merge-base --is-ancestor`).

---
*Phase: 12-containerization-nginx-reverse-proxy*
*Completed: 2026-11-11*
