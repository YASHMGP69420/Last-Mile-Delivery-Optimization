---
phase: 12-containerization-nginx-reverse-proxy
plan: 02
subsystem: infra
tags: [docker, dockerfile, multi-stage, node-20, non-root, healthcheck, cont-02]

requires:
  - phase: 12-containerization-nginx-reverse-proxy
    provides: Cleaned workspace manifests, hoisted package-lock.json with Linux optional binaries, and root .dockerignore (12-01)
  - phase: 11-server-and-client-runtime-hardening
    provides: Hardened Express/Socket.IO server with SERVE_CLIENT=true SPA serving, /readyz probe, and graceful SIGTERM drain
provides:
  - Multi-stage production Dockerfile at repository root using node:20-bookworm-slim (client-builder + runtime)
  - Builder-scoped public VITE_* build arguments isolated from runtime image layers and zero server secrets
  - Non-root runtime stage (USER node, --chown=node:node) with production-only server workspace dependencies, native fetch /readyz HEALTHCHECK, and PID 1 CMD ["node", "server/src/index.js"]
affects:
  - 12-03-PLAN.md (docker-compose.yml builds app image from root Dockerfile)
  - Phase 13 (GitHub Actions CI live docker build & container smoke verification)

actuals:
  tokens: 403
  tasks: 2
  commits: 1
plan_head_before: 49bcf9ad50c2c40796ebed100c846aec228170c3
plan_head_after: d618bb9d281cb6e8ada11e48c15a9b70715172ab

tech-stack:
  added:
    - Docker multi-stage build (node:20-bookworm-slim)
  patterns:
    - "Builder-scoped VITE_* ARG/ENV isolation preventing runtime leak or secret exposure in OCI image metadata"
    - "Non-root Node 20 container execution (USER node, --chown=node:node) with built-in fetch /readyz HEALTHCHECK and exec-form PID 1 signal delivery"

key-files:
  created:
    - Dockerfile
  modified: []

key-decisions:
  - "Scoped VITE_API_URL, VITE_SOCKET_URL, VITE_MAP_PROVIDER, VITE_GEOAPIFY_TILE_API_KEY, and VITE_GOOGLE_CLIENT_ID exclusively to client-builder with zero server secret ARG/ENV declarations anywhere in Dockerfile"
  - "Used node:20-bookworm-slim built-in global fetch inside exec-form HEALTHCHECK against /readyz so no curl/wget attack surface is added to the runtime image"
  - "Installed runtime dependencies via npm ci --omit=dev --workspace=server --include-workspace-root && npm cache clean --force after copying root and workspace manifests"

patterns-established:
  - "Multi-stage SPA+API container pattern: client-builder compiles Vite dist once; runtime copies server/ and /app/client/dist with --chown=node:node and launches node server/src/index.js as PID 1"

requirements-completed:
  - CONT-02

coverage:
  - id: D1
    description: "Created root Dockerfile with two node:20-bookworm-slim stages (client-builder + runtime), builder-scoped VITE_* ARGs, zero server secrets, production workspace npm ci --omit=dev --workspace=server --include-workspace-root, --chown=node:node, USER node, EXPOSE 5004, native fetch /readyz HEALTHCHECK, and CMD [\"node\", \"server/src/index.js\"]."
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "Static Dockerfile contract check OK + npm --prefix server test -- tests/runtime_hardening.test.js (11/11 passed)"
        status: pass
      - kind: other
        ref: "Conditional docker build check: DOCKER_DAEMON_UNAVAILABLE on workstation (docker build --help & Dockerfile instruction/path sanity checks passed; live docker build pending Docker daemon startup / Phase 13 CI)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-11
status: complete
---

# Phase 12 Plan 02: Multi-Stage Non-Root Dockerfile Summary

**Authored root multi-stage `Dockerfile` on `node:20-bookworm-slim` isolating `VITE_*` build arguments to `client-builder`, installing production server workspace dependencies, and running `/app/server/src/index.js` as non-root `USER node` with a native Node 20 `fetch` `/readyz` `HEALTHCHECK`.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T15:12:55Z
- **Completed:** 2026-11-11T15:15:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created root `Dockerfile` with `FROM node:20-bookworm-slim AS client-builder` installing workspace dependencies (`npm ci --include=optional --workspace=client --include-workspace-root`), injecting only client-safe `VITE_*` `ARG`/`ENV` values (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_MAP_PROVIDER`, `VITE_GEOAPIFY_TILE_API_KEY`, `VITE_GOOGLE_CLIENT_ID`), and compiling the Vite + TypeScript SPA via `npm --prefix client run build`.
- Configured `FROM node:20-bookworm-slim AS runtime` with `NODE_ENV=production`, `PORT=5004`, `SERVE_CLIENT=true`, production-only server workspace install (`npm ci --omit=dev --workspace=server --include-workspace-root && npm cache clean --force`), `--chown=node:node` copies for `server/` and `/app/client/dist`, non-root `USER node`, `EXPOSE 5004`, native `fetch` `/readyz` `HEALTHCHECK`, and exec-form PID 1 `CMD ["node", "server/src/index.js"]`.
- Verified static `Dockerfile` contract assertions (stage count, `VITE_*` scoping, zero server secret names, production `npm ci`, `--chown=node:node`, `USER node`, `/readyz` `fetch`, exec-form `CMD`) and ran `npm --prefix server test -- tests/runtime_hardening.test.js` (1/1 suite, 11/11 tests passed).
- Executed conditional `docker info` check cleanly: local Docker Desktop daemon was offline (`DOCKER_DAEMON_UNAVAILABLE`), so `docker build --help`, Dockerfile instruction syntax parsing, and `.dockerignore` / workspace manifest path alignment were verified cleanly offline, with live `docker build` flagged for Docker Desktop startup / Phase 13 CI.

## Task Commits

Each task with code changes was committed atomically:

1. **Task 1: Create multi-stage non-root Dockerfile (client-builder + runtime) on node:20-bookworm-slim** - `d618bb9` (feat)
2. **Task 2: Validate Dockerfile syntax and execute conditional Docker build + image inspection** - verification-only (no files modified)

## Files Created/Modified
- `Dockerfile` - Multi-stage `node:20-bookworm-slim` container definition for SmartRoute SPA + Express/Socket.IO production server.

## Decisions Made
- Scoped `VITE_*` `ARG`s and `ENV`s strictly inside `client-builder` and omitted all server secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`, `SMTP_PASS`, etc.) from `Dockerfile` so runtime env secrets are only supplied at container start.
- Used Node 20's native `fetch` inside the exec-form `HEALTHCHECK` against `http://127.0.0.1:(process.env.PORT || 5004)/readyz` instead of installing `curl` via `apt-get`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Local Docker Desktop daemon offline (`DOCKER_DAEMON_UNAVAILABLE`):** `docker info` returned `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.` Per Plan 12-02 Task 2, live `docker build` and image layer inspection were skipped cleanly after verifying `docker build --help`, Dockerfile instruction syntax, and `.dockerignore` / workspace manifest paths. Live image build verification remains pending Docker Desktop daemon startup / Phase 13 GitHub Actions CI.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Root `Dockerfile` is ready for `12-03-PLAN.md` (`docker-compose.yml` + `deploy/nginx/default.conf`) and Phase 13 CI live image build checks.
- Live `docker build` and container filesystem hygiene check should be executed once the Docker daemon is running or in Phase 13 CI.

## Self-Check: PASSED

- Verified `Dockerfile` exists on disk at repository root and passes all static `CONT-02` contract assertions plus `tests/runtime_hardening.test.js` (11/11 tests passed).
- Verified commit `d618bb9d281cb6e8ada11e48c15a9b70715172ab` exists in Git history (`git merge-base --is-ancestor d618bb9 HEAD`).

---
*Phase: 12-containerization-nginx-reverse-proxy*
*Completed: 2026-11-11*
