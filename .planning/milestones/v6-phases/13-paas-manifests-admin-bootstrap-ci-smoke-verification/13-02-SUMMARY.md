---
phase: 13-paas-manifests-admin-bootstrap-ci-smoke-verification
plan: 02
subsystem: infra
tags: [render, vercel, paas, csp, coop, spa-rewrites, ops-02]

requires:
  - phase: 11-server-and-client-runtime-hardening
    provides: Hardened Express/Socket.IO app with SERVE_CLIENT=true SPA serving, /readyz probe, TRUST_PROXY, FORCE_HTTPS_CSP, and Helmet CSP/COOP policy
provides:
  - 'Declarative Single-Origin Render Blueprint manifest at root render.yaml (runtime node, numInstances 1, healthCheckPath /readyz, SERVE_CLIENT true, TRUST_PROXY 1, FORCE_HTTPS_CSP true, generateValue true JWT secrets, sync false external credentials)'
  - 'Declarative Split-Origin Vercel SPA manifests at both root vercel.json and client/vercel.json with SPA fallback rewrites excluding static assets and API/Socket.IO paths, immutable /assets/(.*) cache headers, no-cache HTML/theme-init headers, Cross-Origin-Opener-Policy same-origin-allow-popups, and Split-Origin-safe Helmet-aligned Content-Security-Policy'
affects:
  - '13-03-PLAN.md (ops_bootstrap_smoke.test.js parses render.yaml and vercel.json / client/vercel.json contracts)'
  - 'Phase 14 (.env.example and README.md PaaS deployment runbook references)'

actuals:
  tokens: 1446
  tasks: 2
  commits: 2
  plan_head_before: 3ec74d43b2a5a94475e3d1570bfdec8a64779a86
  plan_head_after: ed0380b42938fd9a0c9b27b38f38b04074309a96

tech-stack:
  added:
    - Render Blueprint (`render.yaml`)
    - Vercel Edge Configuration (`vercel.json`, `client/vercel.json`)
  patterns:
    - "Single-Origin Render Node web service using `npm ci --include=dev && npm --prefix client run build` so Vite/TypeScript devDependencies stay available under Render's `NODE_ENV=production`"
    - "Dual-root Vercel manifests (`vercel.json` for repo-root deploys and `client/vercel.json` for `client` Root Directory deploys) sharing identical SPA rewrite exclusions and CSP/COOP/Cache-Control headers"

key-files:
  created:
    - render.yaml
    - vercel.json
    - client/vercel.json
  modified: []

key-decisions:
  - "Used `npm ci --include=dev && npm --prefix client run build` in `render.yaml` so Render's injected `NODE_ENV=production` does not omit Vite/TypeScript `devDependencies` during build"
  - "Included `CLIENT_ORIGIN` with `sync: false` alongside `MONGODB_URI`, Geoapify, Google OAuth, and optional OTP delivery keys in `render.yaml`, while leaving `PORT` unset for Render dynamic port injection"
  - "Excluded `/api/`, `/socket.io/`, `/assets/`, `/theme-init.js`, `/favicon.svg`, `/icons.svg`, `/manifest.json`, and `/sw.js` from Vercel SPA fallback rewrites so static public files and API/WebSocket routes are never rewritten to `/index.html`"
  - "Mirrored `server/src/app.js` Helmet CSP directives in `vercel.json` and `client/vercel.json` while adding `https:` and `wss:` to `connect-src` so Split-Origin Vercel frontends can reach external Render/Railway HTTPS APIs and WSS Socket.IO endpoints"

patterns-established:
  - "Render Single-Origin Blueprint pattern: `numInstances: 1`, `healthCheckPath: /readyz`, `SERVE_CLIENT: \"true\"`, `TRUST_PROXY: \"1\"`, `FORCE_HTTPS_CSP: \"true\"`, `generateValue: true` JWT secrets, `sync: false` external credentials"
  - "Vercel Split-Origin SPA header/rewrite parity pattern across root and `client/` sub-project deployments"

requirements-completed:
  - OPS-02

coverage:
  - id: D1
    description: "Created root `render.yaml` Single-Origin Render Blueprint with `runtime: node`, `numInstances: 1`, `healthCheckPath: /readyz`, `npm ci --include=dev && npm --prefix client run build`, `node server/src/index.js`, `generateValue: true` JWT secrets, and `sync: false` external credentials."
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "js-yaml load + Blueprint contract assertions PASSED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Created root `vercel.json` and `client/vercel.json` with SPA fallback rewrite exclusions, immutable `/assets/(.*)` cache headers, `no-cache` on `/index.html` and `/theme-init.js`, COOP `same-origin-allow-popups`, and Split-Origin-safe Helmet-aligned CSP."
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "JSON.parse + RegExp routing + header/CSP + parity assertions PASSED"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-11
status: complete
---

# Phase 13 Plan 02: PaaS Manifests (Render Blueprint & Vercel Edge Config) Summary

**Authored declarative Single-Origin Render Blueprint (`render.yaml`) and dual-root Split-Origin Vercel SPA manifests (`vercel.json` and `client/vercel.json`) aligned 1:1 with Phase 11 runtime hardening, Helmet CSP/COOP directives, and static asset caching.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-11T15:55:33Z
- **Completed:** 2026-11-11T15:58:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created root `render.yaml` declaring a Single-Origin `smartroute` Node web service pinned to `numInstances: 1`, `healthCheckPath: /readyz`, `buildCommand: npm ci --include=dev && npm --prefix client run build`, `startCommand: node server/src/index.js`, `SERVE_CLIENT: "true"`, `TRUST_PROXY: "1"`, `FORCE_HTTPS_CSP: "true"`, `generateValue: true` for `JWT_SECRET`/`JWT_REFRESH_SECRET`, and `sync: false` for external DB/Geoapify/Google OAuth/optional `CLIENT_ORIGIN` and OTP credentials (leaving `PORT` unset for Render injection).
- Created both root `vercel.json` (with `installCommand: "npm ci"`, `buildCommand: "npm --prefix client run build"`, `outputDirectory: "client/dist"`) and `client/vercel.json` (client-root Vite preset defaults) sharing identical SPA rewrite exclusions (`/api/`, `/socket.io/`, `/assets/`, `/theme-init.js`, `/favicon.svg`, `/icons.svg`, `/manifest.json`, `/sw.js`), immutable `/assets/(.*)` cache headers, `no-cache` on `/index.html` and `/theme-init.js`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and mirrored Helmet CSP with `https:` and `wss:` permitted in `connect-src`.
- Verified `render.yaml` via `js-yaml` and verified `vercel.json` + `client/vercel.json` via `JSON.parse`, `RegExp` route matching, header/CSP token checks, and cross-file rewrite/header parity on Windows PowerShell.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create root render.yaml Single-Origin Render Blueprint and validate YAML contract** - `ba57e02` (chore)
2. **Task 2: Create root vercel.json and client/vercel.json with SPA rewrites, asset caching, COOP, and Split-Origin-safe CSP headers** - `ed0380b` (chore)

*(Note: Plan 13-01 executed concurrently on `master`, introducing `c5316c7` between `ba57e02` and `ed0380b`; Plan 13-02's own task commits are `ba57e02` and `ed0380b`.)*

## Files Created/Modified
- `render.yaml` - Declarative Single-Origin Render Blueprint manifest for `smartroute`.
- `vercel.json` - Root-deployed Split-Origin Vercel SPA manifest (`installCommand`, `buildCommand`, `outputDirectory`, rewrites, headers).
- `client/vercel.json` - Client-root-deployed Split-Origin Vercel SPA manifest (rewrites, headers).

## Decisions Made
- Used `npm ci --include=dev && npm --prefix client run build` in `render.yaml` so Render's build environment installs client `devDependencies` (Vite/TypeScript) even when `NODE_ENV=production` is set.
- Included optional `CLIENT_ORIGIN` (`sync: false`) in `render.yaml` so operators can optionally declare extra CORS origins without altering the Blueprint while `SERVE_CLIENT=true` handles same-host origins automatically.
- Excluded all `client/public/` files (`theme-init.js`, `favicon.svg`, `icons.svg`, `manifest.json`, `sw.js`) alongside `/api/`, `/socket.io/`, and `/assets/` from the Vercel SPA rewrite regex so none are accidentally served `index.html`.

## Deviations from Plan

None - plan executed exactly as written (with optional `CLIENT_ORIGIN` `sync: false` included in `render.yaml` as explicitly permitted).

## Threat Flags

None - no new runtime code, network endpoints, auth paths, or unmitigated trust boundaries introduced.

## Self-Check: PASSED

- Verified `render.yaml`, `vercel.json`, and `client/vercel.json` exist on disk and pass `js-yaml` / `JSON.parse` / regex / header / parity assertions.
- Verified commits `ba57e02` and `ed0380b` exist in `git` history with zero unintended file deletions and zero `.env` files staged.
