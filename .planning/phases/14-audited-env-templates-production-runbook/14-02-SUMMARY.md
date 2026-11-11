---
phase: 14-audited-env-templates-production-runbook
plan: 02
subsystem: docs
tags: [readme, deployment-guide, runbook, docker-compose, render, vercel, oauth, geoapify, seed-admin, smoke-test, ops-04]

requires:
  - phase: 11-server-client-runtime-hardening
    provides: Fail-fast production env validation, `/healthz` + `/readyz` probes, `SERVE_CLIENT=true` SPA hosting, and Split-Origin `VITE_API_URL` / `VITE_SOCKET_URL` resolution
  - phase: 12-containerization-nginx-reverse-proxy
    provides: Root multi-stage `Dockerfile` (`node:20-bookworm-slim`, non-root `USER node`), `docker-compose.yml` (`mongo:6.0` + `app` + `nginx:1.27-alpine`), and `deploy/nginx/default.conf`
  - phase: 13-paas-manifests-admin-bootstrap-ci-smoke-verification
    provides: Idempotent `seed:admin` CLI (`server/src/scripts/bootstrapAdmin.js`), `render.yaml`, `vercel.json`, `client/vercel.json`, and `scripts/smoke-test.js`
provides:
  - Canonical v6 project overview, local development quick start, and production deployment & operations runbook in `README.md`
  - Aligned v6 deployment architecture and configuration reference in `docs/DEPLOYMENT_GUIDE.md`
affects:
  - Plan 14-03 (`server/tests/env_docs_audit.test.js` verifies `README.md` and `docs/DEPLOYMENT_GUIDE.md` runbook anchors, repo paths, and absence of stale v4/v5 claims)

actuals:
  tokens: 5444
  tasks: 2
  commits: 3
  plan_head_before: add2badd229a3b52f6fcabcbca55fd8558814daf
  plan_head_after: e7d162247cdde674634905a5a1b588cf8891d05b

tech-stack:
  added: []
  patterns:
    - "Copy-paste-verified Windows PowerShell and Bash operator runbooks matching exact `package.json`, `server/package.json`, `client/package.json`, `docker-compose.yml`, `render.yaml`, `vercel.json`, `client/vercel.json`, and `scripts/smoke-test.js` contracts"
    - "Dual Single-Origin (`SERVE_CLIENT=true`) and Split-Origin (`SERVE_CLIENT=false` + `CLIENT_ORIGIN`) deployment documentation with zero hardcoded demo credentials"

key-files:
  created: []
  modified:
    - README.md
    - docs/DEPLOYMENT_GUIDE.md

key-decisions:
  - "Removed the static test-count badge and stale demo credentials table completely from `README.md`, documenting `npm --prefix server run seed:admin` for non-demo `ADMIN` creation and optional `npm --prefix server run seed` (`--delete`) for `isDemoData: true` Bhubaneswar data"
  - "Documented all three production topologies in `README.md` (Single-Origin Docker Compose, Single-Origin Render Blueprint, and Split-Origin Vercel + Render/Node API + MongoDB Atlas) alongside Google OAuth Authorized JavaScript Origins, Geoapify key fallback behavior, `scripts/smoke-test.js`, and factual test/build commands"
  - "Replaced legacy inline `server/Dockerfile` (`FROM node:20-alpine`) instructions in `docs/DEPLOYMENT_GUIDE.md` with references to the shipped root `Dockerfile`, `docker-compose.yml`, `deploy/nginx/default.conf`, `render.yaml`, `vercel.json`, `client/vercel.json`, v6 required env vars, `seed:admin`, `/healthz`/`/readyz`, and `scripts/smoke-test.js`"

patterns-established:
  - "Single source of truth for copy-paste deployment runbooks in `README.md`, with `docs/DEPLOYMENT_GUIDE.md` acting as a concise aligned architecture reference"

requirements-completed:
  - OPS-04

duration: 4min
completed: 2026-11-11
---

# Phase 14 Plan 02: Canonical v6 README Runbook & Deployment Guide Alignment Summary

**Rewrote root `README.md` as the canonical v6 deployment and operations runbook (`Node >= 20.0.0`, `seed:admin`, Docker Compose, Render Blueprint, Vercel + Atlas Split-Origin, OAuth/Geoapify, and `scripts/smoke-test.js`) and aligned `docs/DEPLOYMENT_GUIDE.md` with shipped v6 infrastructure**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-11T16:28:49Z
- **Completed:** 2026-11-11T16:33:00Z
- **Tasks:** 2 (1 tracer + 1 auto)
- **Files modified:** 2 (`README.md`, `docs/DEPLOYMENT_GUIDE.md`)

## Accomplishments
- **Task 1 (`README.md` rewrite — `c93c2c2`)**:
  - Updated Node.js badge to `node-%3E%3D20.0.0`, updated prerequisites (`Node.js >= 20.0.0`, `npm >= 10.0.0`, `MongoDB >= 6.0`, optional Docker Engine & Compose v2), and removed the stale `tests-151%20passed` badge and hardcoded demo credentials table.
  - Documented Local Development Quick Start (`http://localhost:5173`, `http://localhost:5004/api/v1`, `/healthz`, `/readyz`, PowerShell & Bash `.env.example` copy commands, idempotent `npm --prefix server run seed:admin`, and optional removable `npm --prefix server run seed` / `--delete`).
  - Documented copy-paste-verified Production Deployment Runbooks for Single-Origin Docker Compose (`docker-compose.yml` + `deploy/nginx/default.conf` + `Dockerfile`), Single-Origin Render Blueprint (`render.yaml`), and Split-Origin (`vercel.json` / `client/vercel.json` + Render/Node API + MongoDB Atlas).
  - Documented Google Identity Services Authorized JavaScript Origins + COOP/CSP alignment, Geoapify server/client keys and fallbacks, `scripts/smoke-test.js` flags & `SMOKE_*` env fallbacks, and factual quality gates (`npm --prefix server test`, `npm --prefix client test`, `npm --prefix client run build`) while preserving the Documentation Index.
- **Task 2 (`docs/DEPLOYMENT_GUIDE.md` alignment — `e7d1622`)**:
  - Removed obsolete inline `server/Dockerfile` (`FROM node:20-alpine` / `./server`) build instructions.
  - Aligned architecture overview, database configuration (`autoIndex: false`, `12000ms` `serverSelectionTimeoutMS`), containerized stack (`Dockerfile`, `docker-compose.yml`, `deploy/nginx/default.conf`), required v6 env vars (`JWT_REFRESH_SECRET`, `TRUST_PROXY=1`, `FORCE_HTTPS_CSP=true`, `SERVE_CLIENT`, `CLIENT_ORIGIN`), `seed:admin`, `/healthz` + `/readyz` probes, and `scripts/smoke-test.js`.

## Task Commits

Each task was committed atomically on `master`:

1. **Task 1: Rewrite root README.md as canonical v6 deployment & operations runbook** — `c93c2c2` (`docs(14-02)`)
2. **Task 2: Align docs/DEPLOYMENT_GUIDE.md with v6 single-origin and split-origin architecture** — `e7d1622` (`docs(14-02)`)

*(Note: `plan_head_before`..`plan_head_after` spans `commits: 3` because parallel Wave 1 Plan `14-01` committed `23dcba4` on `master` between Task 1 and Task 2.)*

## Files Created/Modified
- `README.md` — Canonical v6 overview, local quick start, production topology runbooks, OAuth/Geoapify setup, `scripts/smoke-test.js` usage, factual test/build commands, and Documentation Index
- `docs/DEPLOYMENT_GUIDE.md` — Concise v6 deployment reference aligned with `README.md`, `Dockerfile`, `docker-compose.yml`, `deploy/nginx/default.conf`, `render.yaml`, `vercel.json`, `client/vercel.json`, `seed:admin`, and `scripts/smoke-test.js`

## Decisions Made
None — executed strictly per `14-02-PLAN.md` and `14-CONTEXT.md`.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Verification Results
- `README.md` v6 runbook audit (`node -e "..."` checking absence of stale counts/passwords and presence of all 19 required v6 tokens): **PASSED** (`README.md v6 runbook audit OK`).
- `docs/DEPLOYMENT_GUIDE.md` alignment audit (`node -e "..."` checking removal of legacy `server/Dockerfile` snippet and presence of all 12 v6 references): **PASSED** (`docs/DEPLOYMENT_GUIDE.md alignment OK`).
- Path existence check across all referenced manifests, scripts, templates, and docs: **PASSED**.
- Real `.env`, `server/.env`, and `client/.env` files: **Untouched and unstaged**.

## Self-Check: PASSED
- Verified `README.md` and `docs/DEPLOYMENT_GUIDE.md` exist on disk and match their audited commit states (`c93c2c2` and `e7d1622`).
- Verified `.env`, `server/.env`, and `client/.env` do not appear in `git status --short`.
