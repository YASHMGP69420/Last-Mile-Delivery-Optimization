---
phase: 12-containerization-nginx-reverse-proxy
plan: 03
subsystem: infra
tags: [nginx, docker-compose, mongodb, websocket, reverse-proxy, cont-03]

requires:
  - phase: 12-containerization-nginx-reverse-proxy
    provides: Multi-stage non-root production Dockerfile with builder-scoped VITE_* ARGs and /readyz HEALTHCHECK (12-02)
  - phase: 11-server-and-client-runtime-hardening
    provides: Hardened Express/Socket.IO server with SERVE_CLIENT=true SPA serving, TRUST_PROXY=1, isSameRequestHost() CORS, /healthz, /readyz, and SIGTERM drain
provides:
  - Production Nginx 1.27 reverse proxy server block (deploy/nginx/default.conf) for SPA, API, health probes, and WebSocket /socket.io/ upgrades
  - Turnkey Single-Origin Docker Compose stack (docker-compose.yml) orchestrating mongo:6.0, single-instance app, and nginx:1.27-alpine with zero hardcoded secrets
affects:
  - Phase 13 (GitHub Actions CI live docker build, docker compose config -q, and live container smoke checks)
  - Phase 14 (Root .env.example alignment and Single-Origin Docker Compose runbook in README.md)

actuals:
  tokens: 1530
  tasks: 2
  commits: 2
plan_head_before: 69e94ff442e5ac687937807ea2dd2e46f1c85d02
plan_head_after: 61bc92057ba76ba84c71aca1760232d5010f9f9f

tech-stack:
  added:
    - Nginx 1.27 Alpine reverse proxy (deploy/nginx/default.conf)
    - Docker Compose v2 stack (mongo:6.0 + app + nginx:1.27-alpine)
  patterns:
    - "Single-Origin Nginx proxy preserving $http_host (including non-80 HTTP_PORT) and forwarding X-Real-IP / X-Forwarded-* headers to Express TRUST_PROXY=1"
    - "Dedicated /socket.io/ HTTP/1.1 Upgrade/Connection map location with proxy_buffering off and 86400s read/send timeouts"
    - "Internal-only mongo:6.0 and app:5004 network isolation with required :? JWT_SECRET / JWT_REFRESH_SECRET env substitution"

key-files:
  created:
    - deploy/nginx/default.conf
    - docker-compose.yml
  modified: []

key-decisions:
  - "Preserved $http_host in Host and X-Forwarded-Host proxy headers across all Nginx locations so isSameRequestHost() matches Origin when HTTP_PORT differs from 80"
  - "Repeated explicit proxy_set_header directives per location so /socket.io/ uses Connection $connection_upgrade while HTTP locations use Connection \"\" with upstream keepalive 32"
  - "Omitted host ports on mongo:6.0 and app:5004, publishing only nginx ${HTTP_PORT:-80}:80 and enforcing required JWT_SECRET/JWT_REFRESH_SECRET substitution via :?"

patterns-established:
  - "Single-Origin Compose edge pattern: nginx:1.27-alpine depends_on app (service_healthy) which depends_on mongo (service_healthy), with init: true and stop_grace_period: 15s"

requirements-completed:
  - CONT-03

coverage:
  - id: D1
    description: "Created deploy/nginx/default.conf with map $http_upgrade $connection_upgrade, smartroute_app upstream (app:5004, keepalive 32), server_tokens off, client_max_body_size 12m, gzip on, /healthz & /readyz, /socket.io/ HTTP/1.1 Upgrade/Connection + proxy_buffering off + 86400s timeouts, immutable /assets/ cache headers, /api/, and / SPA fallback proxy."
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "Nginx directive structure check PASSED (22 required directives verified) + npm --prefix server test -- tests/runtime_hardening.test.js (11/11 passed)"
        status: pass
      - kind: other
        ref: "Conditional nginx -t container check: DOCKER_DAEMON_UNAVAILABLE on workstation (pending Docker daemon / Phase 13 CI)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Created root docker-compose.yml (no deprecated version key) wiring mongo:6.0 (mongo_data:/data/db, internal-only, mongosh ping healthcheck), single-instance app (deploy.replicas: 1, init: true, stop_grace_period: 15s, expose 5004, SERVE_CLIENT=true, TRUST_PROXY=1, required JWT_SECRET/JWT_REFRESH_SECRET :? substitution, optional SMTP/SMS/OTP/Geoapify/Google env pass-through), and nginx:1.27-alpine (${HTTP_PORT:-80}:80, read-only default.conf mount, /healthz healthcheck)."
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "docker compose config -q PASSED with test secrets; missing JWT_SECRET and missing JWT_REFRESH_SECRET both rejected cleanly with required-variable stderr"
        status: pass
      - kind: other
        ref: "Conditional live docker compose up -d --build --wait smoke check: DOCKER_DAEMON_UNAVAILABLE on workstation (pending Docker daemon / Phase 13 CI)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-11
status: complete
---

# Phase 12 Plan 03: Production Nginx Reverse Proxy & Docker Compose Stack Summary

**Authored `deploy/nginx/default.conf` (WebSocket `/socket.io/` upgrades, `86400s` timeouts, `12m` body limit, gzip, `$http_host` forwarding, immutable `/assets/` caching) and root `docker-compose.yml` (`mongo:6.0` + single-instance `app` + `nginx:1.27-alpine`), validated offline via `docker compose config -q` and missing-secret rejection.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T15:16:16Z
- **Completed:** 2026-11-11T15:18:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `deploy/nginx/default.conf` for `nginx:1.27-alpine` with `map $http_upgrade $connection_upgrade`, `upstream smartroute_app` (`server app:5004; keepalive 32;`), `server_tokens off`, `client_max_body_size 12m`, gzip compression for text/CSS/JSON/JS/XML/SVG, exact `/healthz` and `/readyz` probes, `/socket.io/` HTTP/1.1 `Upgrade`/`Connection` + `proxy_buffering off` + `86400s` read/send timeouts, immutable `/assets/` cache headers (`public, max-age=31536000, immutable`), `/api/`, and `/` SPA fallback proxying with `$http_host` and `X-Real-IP`/`X-Forwarded-*` headers.
- Created root `docker-compose.yml` (omitting deprecated `version:` key) orchestrating `mongo:6.0` (persisted `mongo_data:/data/db`, internal-only network, `mongosh` ping healthcheck), single-instance `app` (`deploy.replicas: 1`, `init: true`, `stop_grace_period: 15s`, `expose: ["5004"]`, `depends_on: mongo: service_healthy`, builder-only `VITE_*` args, `SERVE_CLIENT: "true"`, `TRUST_PROXY: "${TRUST_PROXY:-1}"`, required `JWT_SECRET`/`JWT_REFRESH_SECRET` `:?` substitution, and optional Geoapify/Google/SMTP/SMS/OTP env pass-through), and `nginx:1.27-alpine` (`${HTTP_PORT:-80}:80`, read-only `default.conf` bind mount, `depends_on: app: service_healthy`, `wget` `/healthz` healthcheck).
- Verified `deploy/nginx/default.conf` structural directives (22/22 assertions passed), validated `docker compose config -q` with required test secrets, verified missing `JWT_SECRET` and missing `JWT_REFRESH_SECRET` both fail loudly with descriptive stderr, and ran `npm --prefix server test -- tests/runtime_hardening.test.js` (1/1 suite, 11/11 tests passed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deploy/nginx/default.conf for HTTP/1.1 WebSocket upgrades, gzip, 12m uploads, and immutable /assets/ caching** - `0635e6a` (feat)
2. **Task 2: Create turnkey docker-compose.yml and validate offline config + conditional live stack smoke check** - `61bc920` (feat)

## Files Created/Modified
- `deploy/nginx/default.conf` - Production Nginx 1.27 reverse proxy server configuration for Single-Origin SmartRoute deployment.
- `docker-compose.yml` - Turnkey Compose stack defining `mongo:6.0`, single-instance `app`, and `nginx:1.27-alpine` with `mongo_data` persistence.

## Decisions Made
- Preserved `$http_host` in both `Host` and `X-Forwarded-Host` across all proxy locations so `isSameRequestHost()` in `server/src/config/cors.js` matches browser `Origin` headers when `HTTP_PORT` is non-80 (e.g., `18080`).
- Defined explicit `proxy_set_header` blocks per Nginx location so `/socket.io/` sets `Upgrade $http_upgrade` and `Connection $connection_upgrade`, while HTTP locations clear `Connection ""` to reuse `upstream smartroute_app` `keepalive 32` connections.
- Kept `mongo:6.0` and `app:5004` internal to the Compose network (`ports` omitted) and enforced `${JWT_SECRET:?...}` / `${JWT_REFRESH_SECRET:?...}` with zero hardcoded secret fallbacks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Local Docker Desktop daemon offline (`DOCKER_DAEMON_UNAVAILABLE`):** `docker info` returned `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.` Per Plan 12-03 `<verify>`, live `nginx -t` container validation and `docker compose up -d --build --wait` smoke checks were skipped cleanly after offline directive and `docker compose config -q` checks passed. Phase 13 CI (`.github/workflows/ci.yml`) will execute the live Docker build, Compose validation, and container smoke suite on a Linux runner with Docker active.

## User Setup Required

None - no external service configuration required. Operators provide `JWT_SECRET` and `JWT_REFRESH_SECRET` (>=32 chars) via environment or `.env` at `docker compose up`.

## Next Phase Readiness
- Phase 12 plans (`12-01`, `12-02`, `12-03`) are all implemented on disk (`package.json`, `package-lock.json`, `.dockerignore`, `Dockerfile`, `deploy/nginx/default.conf`, `docker-compose.yml`).
- Ready for Phase 13 (`OPS-01`, `OPS-02`, `OPS-03`): `seed:admin` CLI, `render.yaml` / `vercel.json`, `scripts/smoke-test.js`, and GitHub Actions CI live Docker build + Compose + smoke verification.

## Self-Check: PASSED

- Verified `deploy/nginx/default.conf` and `docker-compose.yml` exist on disk and pass offline Nginx directive checks, `docker compose config -q`, missing-secret rejection checks, and `tests/runtime_hardening.test.js` (11/11 passed).
- Verified commits `0635e6a` (`deploy/nginx/default.conf`) and `61bc920` (`docker-compose.yml`) exist as ancestors of `HEAD` (`61bc92057ba76ba84c71aca1760232d5010f9f9f`).

---
*Phase: 12-containerization-nginx-reverse-proxy*
*Completed: 2026-11-11*
