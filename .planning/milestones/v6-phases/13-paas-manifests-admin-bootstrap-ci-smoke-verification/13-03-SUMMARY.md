---
phase: 13-paas-manifests-admin-bootstrap-ci-smoke-verification
plan: 03
subsystem: infra
tags: [smoke-test, ci, github-actions, docker-compose, nginx, jest, supertest, ops-03]

requires:
  - phase: 13-paas-manifests-admin-bootstrap-ci-smoke-verification
    provides: Non-demo admin bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`), Render Blueprint (`render.yaml`), and Vercel SPA manifests (`vercel.json`, `client/vercel.json`)
provides:
  - Zero-dependency Node 20 post-deploy smoke verifier (`scripts/smoke-test.js`) exporting `normalizeBaseUrl`, `parseSmokeArgs`, and `runSmokeChecks`
  - Root monorepo helper scripts (`smoke`, `seed:admin`, `bootstrap:admin`) in `package.json`
  - Upgraded `.github/workflows/ci.yml` with live `NODE_ENV=production` `SERVE_CLIENT=true` + `seed:admin` + `smoke-test.js` boot smoke gate and `docker-and-compose` job (`docker compose config -q`, `nginx -t`, buildx build, live Compose smoke, `docker compose down -v`)
  - Integration and manifest contract test suite (`server/tests/ops_bootstrap_smoke.test.js`) covering `OPS-01`, `OPS-02`, and `OPS-03`
affects:
  - Phase 14 (`.env.example` and `README.md` runbooks can reference `npm run seed:admin`, `npm run bootstrap:admin`, and `npm run smoke`)

actuals:
  tokens: 8797
  tasks: 3
  commits: 3
  plan_head_before: ccffcc1f912a7cee025838c212af93e8c72e8a9e
  plan_head_after: 4d15328a89c71af7cd55a23e975f8b2a2c17df9c

tech-stack:
  added: []
  patterns:
    - "Zero-dependency Node 20 smoke CLI using native `fetch` + `AbortSignal.timeout(8000)` with `/readyz` bounded retry polling executed BEFORE the one-shot `POST /api/v1/auth/login` non-5xx probe so auth rate limiters are never spammed"
    - "CI production boot smoke pattern: idempotent double-run `seed:admin` -> background `node server/src/index.js` with `EXIT` `SIGTERM` trap -> `smoke-test.js --expect-spa` using dedicated non-blocklisted >=32-char ephemeral JWT secrets"
    - "Docker Compose + Nginx CI verification pattern: `docker compose config -q` -> `nginx -t` with `127.0.0.1 app` host stub -> multi-stage buildx build -> `docker compose up -d --build --wait` smoke -> `if: always()` `docker compose down -v` cleanup"

key-files:
  created:
    - scripts/smoke-test.js
    - server/tests/ops_bootstrap_smoke.test.js
  modified:
    - package.json
    - .github/workflows/ci.yml

key-decisions:
  - "Ordered `/readyz` bounded retry polling before any `/api/v1/auth/login` probes in `runSmokeChecks` so transient startup 503s never burn `authRateLimiter` quota"
  - "Kept `scripts/smoke-test.js` strictly zero-dependency (Node 20 native `fetch`, `URL`, `AbortSignal.timeout`) so it runs cleanly in CI, Docker runners, and fresh operator shells without `npm ci`"
  - "Included `actions/setup-node@v4` (`node-version: 20`) inside the `docker-and-compose` CI job so `scripts/smoke-test.js` executes deterministically on Node 20 native `fetch`"
  - "Used distinct ephemeral >=32-char `JWT_SECRET` and `JWT_REFRESH_SECRET` values outside `DISALLOWED_JWT_SECRETS` for both the `SERVE_CLIENT=true` CI smoke step and the `docker-and-compose` CI job"

patterns-established:
  - "In-process `createApp({ nodeEnv: 'production', serveClient: true, clientDistDir })` ephemeral HTTP server testing for `runSmokeChecks` including draining 503 failure behavior"
  - "Declarative manifest contract testing via `js-yaml` and `JSON.parse` verifying `render.yaml`, `vercel.json`, `client/vercel.json`, and `.github/workflows/ci.yml` invariants"

requirements-completed:
  - OPS-03

coverage:
  - id: D1
    description: "Created zero-dependency `scripts/smoke-test.js` (`normalizeBaseUrl`, `parseSmokeArgs`, `runSmokeChecks`) and registered `smoke`, `seed:admin`, and `bootstrap:admin` in root `package.json`."
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "Task 1 tracer verification (`node -e ...`) & `server/tests/ops_bootstrap_smoke.test.js` PASSED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Upgraded `.github/workflows/ci.yml` with `Bootstrap Admin & Live SERVE_CLIENT=true Smoke Check` step and `docker-and-compose` job using non-blocklisted >=32-char JWT secrets and clean teardown."
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "Task 2 `js-yaml` + `DISALLOWED_JWT_SECRETS` hygiene script & `server/tests/ops_bootstrap_smoke.test.js` PASSED"
        status: pass
    human_judgment: false
  - id: D3
    description: "Added `server/tests/ops_bootstrap_smoke.test.js` verifying `OPS-01` (`bootstrapAdmin`), `OPS-03` (`runSmokeChecks` against in-process `SERVE_CLIENT=true` server), and `OPS-02`/`OPS-03` manifest contracts, with full server Jest + client TypeScript/Vite build passing."
    requirement: OPS-03
    verification:
      - kind: integration
        ref: "`npm --prefix server test -- tests/ops_bootstrap_smoke.test.js` (8/8), `npm --prefix server test` (28/28 suites, 325/325 tests), `npm --prefix client test` (`tsc --noEmit`), and `npm --prefix client run build` PASSED"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-11
status: complete
---

# Phase 13 Plan 03: Smoke Verifier, CI Gates & Contract Test Suite Summary

**Delivered the zero-dependency Node 20 post-deploy smoke verifier (`scripts/smoke-test.js`), root monorepo helper scripts, upgraded `.github/workflows/ci.yml` with live `SERVE_CLIENT=true` + `docker-and-compose` smoke gates, and passing integration/contract tests (`server/tests/ops_bootstrap_smoke.test.js`) alongside the full 325-test server suite and client TypeScript/Vite build.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-11T16:02:06Z
- **Completed:** 2026-11-11T16:11:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `scripts/smoke-test.js` using only Node 20 built-ins (`fetch`, `URL`, `AbortSignal.timeout`), exporting `normalizeBaseUrl`, `parseSmokeArgs`, and `runSmokeChecks`, executing bounded `/readyz` polling before the one-shot `POST /api/v1/auth/login` non-5xx check, plus `/healthz`, `/readyz` (`database === 'CONNECTED'`), `/api/v1/health`, `/api/v1/does-not-exist` (`404` `ENDPOINT_NOT_FOUND`), optional authenticated login (never logging secrets/tokens), optional `OPTIONS` CORS preflight, and optional SPA HTML delivery (`/theme-init.js`).
- Added `"smoke"`, `"seed:admin"`, and `"bootstrap:admin"` helper scripts to root `package.json`.
- Upgraded `.github/workflows/ci.yml` while preserving `validate-and-test` (`tsc --noEmit`, `vite build`, `npm --prefix server test`), adding `Bootstrap Admin & Live SERVE_CLIENT=true Smoke Check` (idempotent double `seed:admin` + background `SERVE_CLIENT=true` server with `SIGTERM` trap + `smoke-test.js --expect-spa`) and `docker-and-compose` (`docker compose config -q`, `nginx -t` with `127.0.0.1 app`, buildx multi-stage build, live `docker compose up -d --build --wait` smoke, `if: always()` `docker compose down -v`), with all production secrets >=32 chars, distinct, and outside `DISALLOWED_JWT_SECRETS`.
- Created `server/tests/ops_bootstrap_smoke.test.js` covering `bootstrapAdmin` validation/hashing/idempotency (`OPS-01`), in-process `SERVE_CLIENT=true` `runSmokeChecks` + draining 503 failure (`OPS-03`), and parsed manifest contracts across `render.yaml`, `vercel.json`, `client/vercel.json`, and `.github/workflows/ci.yml` (`OPS-02`, `OPS-03`).
- Verified full repository regression suite: `npm --prefix server test -- tests/ops_bootstrap_smoke.test.js` (8/8 passed), `npm --prefix server test` (28/28 suites, 325/325 tests passed), `npm --prefix client test` (`tsc --noEmit` passed), and `npm --prefix client run build` (`vite build` succeeded).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create zero-dependency Node 20 scripts/smoke-test.js and register root package.json helper scripts** - `d23a530` (feat)
2. **Task 2: Upgrade .github/workflows/ci.yml with SERVE_CLIENT=true boot smoke and docker-and-compose verification jobs** - `5088c7a` (ci)
3. **Task 3: Create server/tests/ops_bootstrap_smoke.test.js and run full server & client verification suite** - `4d15328` (test)

## Files Created/Modified
- `scripts/smoke-test.js` - Zero-dependency Node 20 post-deploy smoke CLI and exportable `normalizeBaseUrl` / `parseSmokeArgs` / `runSmokeChecks` helpers.
- `package.json` - Registered `"smoke"`, `"seed:admin"`, and `"bootstrap:admin"` root npm scripts.
- `.github/workflows/ci.yml` - Added `Bootstrap Admin & Live SERVE_CLIENT=true Smoke Check` step and `docker-and-compose` CI job.
- `server/tests/ops_bootstrap_smoke.test.js` - Jest + Supertest integration and YAML/JSON manifest contract test suite for `OPS-01`, `OPS-02`, and `OPS-03`.

## Decisions Made
- Placed `/readyz` bounded retry polling ahead of all other probes in `runSmokeChecks` so slow-starting containers never trigger repeated `POST /api/v1/auth/login` calls against `authRateLimiter`.
- Added `actions/setup-node@v4` (`node-version: 20`) to the `docker-and-compose` job in `.github/workflows/ci.yml` so `scripts/smoke-test.js` always runs on Node 20 native `fetch` and `AbortSignal.timeout`.

## Deviations from Plan

None - plan executed as written. *(Note: During the initial full server test run, `tests/routes.test.js` `TC-INT-DISPATCH-1` encountered a single transient 500 error; running `npm --prefix server test -- tests/routes.test.js` and re-running the full `npm --prefix server test` suite immediately afterward passed all 28/28 suites and 325/325 tests cleanly without code edits.)*

## Issues Encountered

None requiring code changes — transient `routes.test.js` failure did not reproduce on direct re-run or subsequent full 28-suite `npm --prefix server test` execution.

## Threat Flags

None - all trust boundaries (`Smoke CLI -> Production/CI HTTP API` and `GitHub Actions CI Runner -> Production Boot & Containers`) comply with `<threat_model>` mitigations (`T-13-05`, `T-13-06`, `T-13-07`, `T-13-SC`) with zero new npm dependencies and zero secret/token stdout emission.

## Self-Check: PASSED

- Verified `scripts/smoke-test.js`, `package.json`, `.github/workflows/ci.yml`, and `server/tests/ops_bootstrap_smoke.test.js` exist on disk and pass all verification scripts.
- Verified `npm --prefix server test -- tests/ops_bootstrap_smoke.test.js` (8/8 passed), `npm --prefix server test` (28/28 suites, 325/325 tests passed), `npm --prefix client test` (`tsc --noEmit` passed), and `npm --prefix client run build` (`vite build` passed).
- Verified commits `d23a530`, `5088c7a`, and `4d15328` exist in git history with zero unintended file deletions and zero `.env` files staged.
