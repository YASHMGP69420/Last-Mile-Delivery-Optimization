# Phase 12: Containerization & Nginx Reverse Proxy - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators can clean workspace dependency skew, build a lean non-root multi-stage production Docker image (`Dockerfile` + `.dockerignore`), and launch a turnkey Single-Origin `nginx:1.27-alpine` + `app` (`node:20-bookworm-slim`) + `mongo:6.0` Docker Compose stack (`docker-compose.yml` + `deploy/nginx/default.conf`) with working WebSocket `/socket.io/` upgrades, `/readyz` healthchecks, and clean graceful shutdown (`CONT-01`, `CONT-02`, `CONT-03`).

</domain>

<decisions>
## Implementation Decisions

### Monorepo Build & Nginx Proxy Topology
- Remove skewed duplicate dependencies (`express-rate-limit`, `jest`, `supertest`, `leaflet`, `react-leaflet`) from root `package.json`, preserve `workspaces: ["server", "client"]` and `concurrently`, align `"engines"` to Node `>=20.0.0` (npm `>=10.0.0`), and refresh `package-lock.json` cleanly so `npm ci` runs deterministically in Docker and CI
- Proxy all traffic (`/`, `/assets/*`, `/api/v1/*`, `/socket.io/*`, `/healthz`, `/readyz`) through `nginx:1.27-alpine` to `app:5004` running with `SERVE_CLIENT=true` so a single build artifact handles SPA, API, CSP/COOP, and WebSocket routing cleanly without duplicating `client/dist` across images
- Use Node 20 built-in `fetch('http://127.0.0.1:5004/readyz')` inside `Dockerfile` `HEALTHCHECK` (`node -e`) so no extra `curl` package needs to be installed in `node:20-bookworm-slim`
- Publish `${HTTP_PORT:-80}:80` on `nginx` while keeping `app:5004` internal to the Compose network (`expose: ["5004"]`), with `${MONGODB_URI:-mongodb://mongo:27017/smartroute}` overridable for external MongoDB Atlas

### Compose Security, Volumes & Local Verification
- Pass secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `GEOAPIFY_SERVER_API_KEY`, `GOOGLE_CLIENT_ID`, SMTP/SMS keys) into `docker-compose.yml` via environment substitution without committing hardcoded production secrets inside `docker-compose.yml`, while keeping `docker compose config -q` cleanly validatable
- Persist `mongo:6.0` state in named volume `mongo_data:/data/db` with no host port published by default, guarded by `mongosh --quiet --eval "db.adminCommand('ping').ok"` healthcheck (`app` uses `depends_on: mongo: condition: service_healthy`)
- Configure `deploy/nginx/default.conf` with `gzip on`, `client_max_body_size 12m`, HTTP/1.1 `Upgrade`/`Connection "upgrade"` + `proxy_read_timeout 86400s` + `proxy_buffering off` on `/socket.io/`, `X-Real-IP`/`X-Forwarded-For`/`X-Forwarded-Proto` forwarding, and `/assets/` immutable cache headers (`public, max-age=31536000, immutable`)
- Verify via `docker build`, `docker compose config -q`, and — if the local Docker daemon is running — live `docker compose up -d` smoke check (HTTP `/healthz`, `/readyz`, `/`, `/assets/*`, `/api/v1/does-not-exist`, Socket.IO handshake) followed by clean `docker compose down -v` teardown

### the agent's Discretion
- Exact `.dockerignore` patterns covering `.env*`, `.git`, `**/node_modules`, `client/dist`, `.planning`, `tests`, `scratch`, logs, and non-runtime artifacts, plus `docker-compose.yml` `init: true` / `stop_grace_period: 15s` tuning

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/app.js` & `server/src/index.js`: Already expose `/healthz`, `/readyz`, `SERVE_CLIENT=true` static/SPA routing, numeric `TRUST_PROXY=1`, shared CORS, and `SIGTERM`/`SIGINT` drain
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`: Contain exact verified `node:20-bookworm-slim`, `nginx:1.27-alpine`, `mongo:6.0` configurations and `npm workspaces` hoisting rules

### Established Patterns
- Monorepo workspaces (`server` + `client`) built from repo root (`npm --prefix client run build`)
- Default server port `5004` in CI/tests (`PORT=5004` in `docker-compose.yml` & `Dockerfile` default `EXPOSE 5004`)

### Integration Points
- Root `package.json`, `package-lock.json`, `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `deploy/nginx/default.conf`

</code_context>

<specifics>
## Specific Ideas

Docker CLI (`29.6.2`) and Docker Compose (`v5.3.1`) are installed on the workstation — include automated `docker compose config -q` + `docker build` checks (plus live Compose container boot & teardown if daemon responds).

</specifics>

<deferred>
## Deferred Ideas

None — PaaS manifests (`render.yaml`, `vercel.json`), `seed:admin`, and CI workflow updates stay in Phase 13; `.env.example` audit and `README.md` runbook stay in Phase 14.

</deferred>
