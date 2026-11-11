# Phase 13: PaaS Manifests, Admin Bootstrap & CI/Smoke Verification - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators can provision an initial non-demo production admin (`OPS-01`), deploy declaratively to Render or Vercel (`OPS-02`), and verify live or CI deployments automatically via a zero-dependency Node 20 smoke test and upgraded `.github/workflows/ci.yml` build/container/smoke gates (`OPS-03`), without altering `seedBhubaneswar.js` demo isolation or Phase 14's `.env.example` / `README.md` runbooks.

</domain>

<decisions>
## Implementation Decisions

### First-Admin Bootstrap & PaaS Manifests
- Implement idempotent `server/src/scripts/bootstrapAdmin.js` (exposed via `"seed:admin": "node src/scripts/bootstrapAdmin.js"` and `"bootstrap:admin"` in `server/package.json` plus root helper script if convenient) reading `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME` (default `'SmartRoute Admin'`)
- Require `ADMIN_EMAIL` (valid email) and strong `ADMIN_PASSWORD` (`>= 10` characters, rejecting weak/placeholder strings like `'admin123'`, `'password123'`, `'changeme'`, `'your_admin_password_here'`) before touching the database
- Create `ADMIN` using `User.create(...)` (`name`, `email`, `passwordHash: password`, `role: ROLES.ADMIN`, `emailVerified: true`, `active: true`, `accountStatus: 'ACTIVE'`, `isDemoData: false`) so Mongoose schema validation and `bcrypt` `pre('save')` hooks execute cleanly; skip as idempotent `exit 0` no-op if a matching email or active non-demo `ADMIN` already exists without overwriting passwords; never invoke or alter `seedBhubaneswar.js`
- Author root `render.yaml` Blueprint targeting Single-Origin `runtime: node` (`buildCommand: npm ci && npm --prefix client run build`, `startCommand: node server/src/index.js`, `SERVE_CLIENT: "true"`, `TRUST_PROXY: "1"`, `FORCE_HTTPS_CSP: "true"`, `numInstances: 1`, `healthCheckPath: /readyz`), `generateValue: true` for `JWT_SECRET` and `JWT_REFRESH_SECRET`, and `sync: false` for external credentials (`MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`, `GOOGLE_CLIENT_ID`, `VITE_GEOAPIFY_TILE_API_KEY`, `VITE_GOOGLE_CLIENT_ID`, optional OTP keys)
- Provide BOTH `client/vercel.json` (for Vercel Root Directory = `client`) and root `vercel.json` (`buildCommand: "npm --prefix client run build"`, `outputDirectory: "client/dist"`) with SPA fallback rewrites (`try_files`-equivalent rule excluding `/assets/*`), immutable `/assets/(.*)` cache headers (`public, max-age=31536000, immutable`), `no-cache` on `/index.html` and `/theme-init.js`, and mirrored Helmet CSP + `Cross-Origin-Opener-Policy: same-origin-allow-popups` security headers

### Post-Deploy Smoke Test & CI Verification Gates
- Build zero-dependency `scripts/smoke-test.js` using Node 20 native `fetch` (plus `"smoke": "node scripts/smoke-test.js"` in root `package.json`) supporting CLI flags (`--api-url`, optional `--client-url`, optional `--origin`, `--expect-spa`, `--retries`, `--delay-ms`) and env vars (`SMOKE_API_URL`, `SMOKE_CLIENT_URL`, `SMOKE_ORIGIN`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`)
- Smoke checks verify: bounded `/readyz` readiness retry loop, `GET /healthz` (`200`), `GET /readyz` (`200`), `GET /api/v1/health` (`200`), `GET /api/v1/does-not-exist` (`404` JSON `ENDPOINT_NOT_FOUND`), `POST /api/v1/auth/login` (`400`/`401` on invalid probe payload with zero `5xx`, plus optional `200` login verification when `SMOKE_EMAIL` & `SMOKE_PASSWORD` are supplied), `OPTIONS` CORS preflight when `--origin` is set, and SPA HTML delivery (`200` + `/theme-init.js`) on `--client-url` or `--expect-spa` `/`
- Upgrade `.github/workflows/ci.yml`: keep `validate-and-test` (`tsc`, `vite build`, `jest`), AND execute (a) live `SERVE_CLIENT=true` + `seed:admin` + `node scripts/smoke-test.js` boot smoke check against CI `mongo:6.0`, plus (b) `docker-and-compose` job validating `docker compose config -q`, `docker build` (with GitHub Actions buildx cache), `nginx:1.27-alpine` `nginx -t`, and running the built Docker image (or Compose stack) against `scripts/smoke-test.js`
- Add Jest + Supertest integration test coverage (`server/tests/ops_bootstrap_smoke.test.js`) testing `bootstrapAdmin` validation/idempotency/`isDemoData: false`, `scripts/smoke-test.js` against an in-process hardened Express app, and `render.yaml` / `vercel.json` contract parsing locally

### the agent's Discretion
- Exact CLI flag parsing helper structure in `scripts/smoke-test.js` and clean teardown inside CI `SERVE_CLIENT=true` background server step

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/models/User.js`: Enforces email/name validation, indexes `isDemoData`, and hashes `passwordHash` automatically via `bcrypt` `pre('save')` hook
- `server/src/config/db.js`: Provides `connectDB()` & `disconnectDB()` used by CLI seed scripts
- `server/src/seed/seedBhubaneswar.js`: Reference CLI pattern (`if (require.main === module) runCli()`) — intentionally decoupled (`isDemoData: true` only)
- `.github/workflows/ci.yml`: Existing CI pipeline with `mongo:6.0` service, Node 20 setup, `npm ci`, `tsc`, `vite build`, and `jest`

### Established Patterns
- Phase 11 `SERVE_CLIENT=true`, `/healthz`, `/readyz`, JSON `ENDPOINT_NOT_FOUND` 404, and `/theme-init.js`
- Phase 12 `Dockerfile` (`node:20-bookworm-slim`), `deploy/nginx/default.conf`, and `docker-compose.yml`

### Integration Points
- `server/src/scripts/bootstrapAdmin.js`, `server/package.json`, `package.json`
- `render.yaml`, `vercel.json`, `client/vercel.json`
- `scripts/smoke-test.js`, `.github/workflows/ci.yml`, `server/tests/ops_bootstrap_smoke.test.js`

</code_context>

<specifics>
## Specific Ideas

Ensure CI job env vars satisfy Phase 11's `validateProductionEnv()` checks (`>=32`-char non-placeholder JWT secrets for boot smoke checks, NEVER matching Phase 11's `DISALLOWED_JWT_SECRETS` blocklist!) and never skip `npm --prefix server test` regressions.

</specifics>

<deferred>
## Deferred Ideas

None — `.env.example` 1:1 audit and `README.md` runbook stay in Phase 14.

</deferred>
