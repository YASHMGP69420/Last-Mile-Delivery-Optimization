# Phase 14: Audited Env Templates & Production Runbook - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators have 1:1 code-verified environment variable templates (`.env.example`, `server/.env.example`, `client/.env.example`) and accurate, copy-paste-verified deployment and operational runbooks in root `README.md` (with `docs/DEPLOYMENT_GUIDE.md` aligned) covering local development, Single-Origin Docker Compose, Single-Origin Render Blueprint, Split-Origin Vercel + Render + Atlas, OAuth/Geoapify domain setup, `seed:admin`, and `scripts/smoke-test.js` (`OPS-04`).

</domain>

<decisions>
## Implementation Decisions

### Env Templates Audit & Production README Runbook
- Align `.env.example`, `server/.env.example`, and `client/.env.example` cleanly on `PORT=5004`, safe non-committed `replace_with_random_32plus_char_secret` placeholders (never copying `DISALLOWED_JWT_SECRETS` dev secrets into `server/.env.example`), dev `VITE_API_URL=/api/v1` & `VITE_SOCKET_URL=` with clear Split-Origin comments, and 1:1 coverage for every env variable actually read across `server/src/config/env.js`, `server/src/scripts/bootstrapAdmin.js`, `client/src/`, `docker-compose.yml`, and `scripts/smoke-test.js` (`SERVE_CLIENT`, `TRUST_PROXY`, `FORCE_HTTPS_CSP`, `GEOAPIFY_SERVER_API_KEY`, `MAP_PROVIDER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `HTTP_PORT`, `SMOKE_*`)
- Update root `README.md` as the canonical v6 deployment and operations runbook: align badges & prerequisites to `Node >= 20.0.0`, replace stale `151 passed` and old `seedBhubaneswar.js` "demo accounts" wording with exact current workflow (`seed:admin` for non-demo `ADMIN`, optional `seed` for `isDemoData: true` Bhubaneswar demo data), and provide copy-paste-verified runbooks for Local Dev, Single-Origin Docker Compose (`nginx:1.27-alpine` + `app` + `mongo:6.0`), Single-Origin Render (`render.yaml`), Split-Origin (`vercel.json` / `client/vercel.json` + Render + MongoDB Atlas), Google OAuth Authorized JavaScript Origins & Geoapify API setup, and `scripts/smoke-test.js` verification
- Lightly align `docs/DEPLOYMENT_GUIDE.md` so it points cleanly to the audited `v6` Single-Origin / Split-Origin / `seed:admin` / `smoke-test.js` workflow instead of giving conflicting instructions
- Add an automated contract test (`server/tests/env_docs_audit.test.js` or extension) asserting 1:1 parity between actual code/Compose/script env vars and `.env.example` + `server/.env.example` + `client/.env.example`, zero `DISALLOWED_JWT_SECRETS` literals in `server/.env.example`, and zero stale `seed` admin password claims or unverified paths in `README.md`

### the agent's Discretion
- Exact markdown layout, badge presentation, and table formatting in `README.md` and `.env.example` comments

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.env.example` (root), `server/.env.example`, `client/.env.example` — current templates needing 1:1 v6 reconciliation
- `README.md` & `docs/DEPLOYMENT_GUIDE.md` — existing docs needing accuracy updates for Node 20, v6 hardening, Docker Compose, Render, Vercel, `seed:admin`, and `scripts/smoke-test.js`
- `server/src/config/env.js`, `server/src/scripts/bootstrapAdmin.js`, `docker-compose.yml`, `render.yaml`, `vercel.json`, `client/vercel.json`, `scripts/smoke-test.js`, `client/src/vite-env.d.ts` — authoritative source of env keys and CLI commands

### Established Patterns
- PowerShell + Bash copy-paste commands in docs
- Never modify or commit `.env`, `server/.env`, or `client/.env`

### Integration Points
- `.env.example`, `server/.env.example`, `client/.env.example`, `README.md`, `docs/DEPLOYMENT_GUIDE.md`, `server/tests/env_docs_audit.test.js`

</code_context>

<specifics>
## Specific Ideas

Double-check every npm script, file path, and CLI flag written in `README.md` against `package.json`, `server/package.json`, `client/package.json`, `scripts/smoke-test.js`, `render.yaml`, and `docker-compose.yml` so zero typos ship in the final v6 release!

</specifics>

<deferred>
## Deferred Ideas

None — final phase of Milestone v6.

</deferred>
