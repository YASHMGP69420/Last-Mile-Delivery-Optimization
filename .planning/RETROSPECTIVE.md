# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v5 — Final PRD Completion & Audit Closure

**Shipped:** 2026-11-11
**Phases:** 10 | **Plans:** 19 | **Quick Tasks:** 4

### What Was Built
- Full-stack SmartRoute Last-Mile Delivery Platform across Operations Control Center (VRP Nearest-Neighbor + 2-Opt optimization, CSV dry-run ingestion, batch orchestration with `409` active-operation/active-batch interlocks, PRD Analytics & Planned-vs-Actual performance, live telemetry & mid-shift re-optimization) and Mobile Driver Handheld cockpit (daylight white default + dark toggle, telemetry continuity, pre-trip checks, incident reporting).
- Zero-orphan Admin Demo Dataset controls (`isDemoData` provenance across 7 core + 10 secondary Mongoose schemas + `deleteDemoDataset()` cascade purge).
- Live real-time synchronization via authenticated Socket.IO (`route:reordered`, `route:updated`, `telemetry:alert` preservation across background reloads).

### What Worked
- Goal-backward verification paired with live headless Chromium CDP E2E tests caught real UI/WebSocket races (such as Socket.IO alerts wiped by background `fetchData()` reloads and dark-mode contrast leaks on `CurrentRouteCard`/`RouteComparisonDrawer`).
- Atomic per-task commits and shared server-side validation/analytics services prevented drift between Desktop Admin, Fleet Manager, and Driver Handheld views.

### What Was Inefficient
- Early phases (02, 05–08) mixed `SUMMARY`/`VERIFICATION` formats, creating documentation hygiene debt caught during the Milestone 4 audit before Phase 10 closed it cleanly.
- Running cross-AI external CLI review failed because local `claude` and `codex` CLI auth sessions were expired.

### Patterns Established
- Deriving `isDemoData` server-side across route/dispatch pipelines rather than trusting client flags.
- Preserving ephemeral `_isLiveSocketAlert` notifications when background REST refreshes overwrite active alert lists.
- Enforcing `data-theme="light"` pre-paint defaults for daylight mobile readability alongside opt-in dark toggles.

### Key Lessons
1. Always validate WebSocket event + REST refetch interplay in a live two-browser DOM harness, not just unit mocks.
2. Keep `ROADMAP.md` summary bullets paired with detailed phase sections so GSD progression/completion CLIs resolve cleanly.

### Cost Observations
- Model mix: Coordinator / Verifier / Executor agents running seamlessly on workspace model inherit
- Notable: Live headless Chromium CDP (`ws`) testing eliminated manual browser back-and-forth during final UAT

---

## Milestone: v6 — Deployment & Production Readiness

**Shipped:** 2026-11-11
**Phases:** 4 (`11`–`14`) | **Plans:** 12 | **Tasks:** 27

### What Was Built
- Hardened Express 4, Socket.IO 4, Mongoose 8, and Vite 5 (`HARD-01..06`, `ORIG-01..02`) with fail-fast production env checks, Geoapify key unification, numeric `TRUST_PROXY`, shared Express/Socket.IO multi-origin CORS, external `/theme-init.js` with strict Helmet CSP + `COOP: same-origin-allow-popups`, `/healthz` & `/readyz`, idempotent `SIGTERM`/`SIGINT` drain, `SERVE_CLIENT=true` SPA isolation, and Split-Origin `VITE_API_URL`/`VITE_SOCKET_URL`.
- Cleaned monorepo dependency skew in `package.json`, declared missing server `axios@^1.7.2`, locked down `.dockerignore`, authored multi-stage non-root `Dockerfile` (`node:20-bookworm-slim`, `USER node`), and wired `docker-compose.yml` + `deploy/nginx/default.conf` (`CONT-01..03`).
- Built idempotent non-demo first-admin CLI (`server/src/scripts/bootstrapAdmin.js` `seed:admin`), `render.yaml` Blueprint, dual-root `vercel.json` / `client/vercel.json`, zero-dependency Node 20 `scripts/smoke-test.js`, and CI `SERVE_CLIENT=true` + `docker-and-compose` gates (`OPS-01..03`).
- Reconciled `.env.example`, `server/.env.example`, and `client/.env.example` 1:1 with code/Compose/smoke consumers, rewrote `README.md` and aligned `docs/DEPLOYMENT_GUIDE.md` across Single-Origin and Split-Origin runbooks, and locked parity via `server/tests/env_docs_audit.test.js` (`OPS-04`).

### What Worked
- Independent `gsd-plan-checker` passes before execution caught two genuine production blockers early: `axios` missing from `server/package.json` for isolated `--workspace=server` Docker builds, and `render.yaml` needing `npm ci --include=dev` so Render's injected `NODE_ENV=production` doesn't strip Vite/TypeScript during frontend compilation.
- Programmatic bidirectional audit tests (`ops_bootstrap_smoke.test.js`, `env_docs_audit.test.js`) prevented future CI/template secret drift (`DISALLOWED_JWT_SECRETS`) automatically inside `npm --prefix server test`.

### What Was Inefficient
- Early subagent status races required re-verifying file presence and YAML frontmatter directly on disk (`13-02-SUMMARY.md` unquoted `: ` YAML scalar, `13-VERIFICATION.md` missing initial write) and refreshing `covered_digest` after downstream edits to `package.json` and `README.md`.
- Docker Desktop Linux Engine was offline on the Windows workstation, deferring live `docker build` / `docker compose up` runtime execution to GitHub Actions CI.

### Patterns Established
- Externalizing theme-init script to `/theme-init.js` under `'self'` avoids CRLF vs LF CSP SHA-256 hash mismatches between Windows and Linux Docker builds.
- Dual `vercel.json` + `client/vercel.json` with full `client/public/*` negative-lookahead exclusions and `connect-src https: wss:` handles both Vercel Root Directory configurations cleanly.
- Keeping `.env.example` Compose-ready via documented `MONGODB_URI=mongodb://mongo:27017/smartroute` override guidance prevents `127.0.0.1` connection refusals inside containers.

### Key Lessons
1. Always check runtime `require()` dependencies in monorepo sub-packages (`axios` in `server/` previously relying on `client/` hoisting) before isolated workspace Docker installs.
2. Quote YAML list scalars containing `: ` in summary frontmatter and re-verify file existence/digests whenever downstream phases touch tracked workspace manifests or READMEs.

### Cost Observations
- Model mix: Coordinator, Planner, Checker, Executor, Verifier, and Integration Checker agents running on inherited workspace model
- Notable: Zero third-party npm packages added for v6 (`Node 20` native `fetch`, existing `helmet`/`cors`/`mongoose`/`js-yaml`)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Quick Tasks | Key Change |
| --- | --- | --- | --- |
| v1–v5 (Cumulative) | 10 | 4 archived | Introduced Milestone Audit closure gate + live headless Chromium E2E CDP verification |
| v6 (Deployment) | 4 | 0 | Added plan-checker isolate-build dependency audits, cross-phase wiring checks, and 1:1 env/doc parity tests |

### Cumulative Quality

| Milestone | Automated Suites | E2E Checks | Source LOC |
| --- | --- | --- | --- |
| v5 | 25/25 Jest (287/287 passed), `tsc` + Vite clean | 18/18 live Chromium CDP passed | 34,951 LOC (`server/src` + `client/src`) |
| v6 | 29/29 Jest (330/330 passed), `tsc` + Vite clean, `docker compose config -q` | Live in-process `SERVE_CLIENT=true` + `scripts/smoke-test.js` CI gates (`DOCKER_DAEMON_UNAVAILABLE` offline) | 35,631 LOC (`server/src` + `client/src`) |

### Top Lessons (Verified Across Milestones)
1. Live multi-context browser verification catches state synchronization and CSS theme regressions that headless API tests miss.
2. Shared domain services (`savingsAnalyticsService`, `resourceGuardService`, `activeRouteReoptimizer`) keep RBAC roles aligned across dashboards.
