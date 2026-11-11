# SmartRoute – Production Deployment Guide

This guide outlines SmartRoute's supported v6 production architectures and configuration contracts. For step-by-step copy-paste runbooks (Local Development, Docker Compose, Render, Vercel + Atlas, Google OAuth, and Geoapify setup), see the canonical root [`README.md`](../README.md).

---

## 1. Supported v6 Deployment Topologies

SmartRoute pins a **single stateful backend instance** (`replicas: 1` / `numInstances: 1`) so Express + Socket.IO room state stays consistent without an external adapter:

1. **Single-Origin (`SERVE_CLIENT=true`)** — Express serves the pre-built `client/dist` SPA alongside `/api/v1/*` and `/socket.io/*` from the same origin:
   * **Docker Compose**: `docker-compose.yml` + root `Dockerfile` + `deploy/nginx/default.conf`
   * **Render Blueprint**: `render.yaml` (`runtime: node`, `numInstances: 1`, `healthCheckPath: /readyz`, `VITE_API_URL=/api/v1`, `VITE_SOCKET_URL=`)
2. **Split-Origin (`SERVE_CLIENT=false`)** — Vercel CDN serves the React SPA while a single-instance Node/Render API connects to MongoDB Atlas:
   * **Frontend**: `vercel.json` (repo root) or `client/vercel.json` (when Vercel Root Directory is `client`), configuring SPA rewrites, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Content-Security-Policy`, `no-cache` on `/index.html` and `/theme-init.js`, and immutable `/assets/*` caching.
   * **Backend API**: Single-instance Node 20 service (`node server/src/index.js`) with `SERVE_CLIENT=false` and `CLIENT_ORIGIN=https://<your-app>.vercel.app`.

---

## 2. Database Setup (MongoDB >= 6.0 / Atlas)

* **Managed MongoDB Atlas** (recommended for Render / Vercel deploys; e.g., AWS `ap-south-1` Mumbai):
  1. Provision a Replica Set cluster with a dedicated application user scoped to the `smartroute` database.
  2. Restrict Network Access to your backend egress IPs or VPC peering.
  3. Supply the Atlas URI via `MONGODB_URI` (`mongodb+srv://...` or `mongodb://...`).
* **Production Mongoose Defaults** (`server/src/config/db.js`): `autoIndex: false` in `NODE_ENV=production` and `serverSelectionTimeoutMS: 12000` (`12000ms`) so startup fails cleanly rather than hanging indefinitely if the database is unreachable.
* **Docker Compose Local DB**: `docker-compose.yml` provisions `mongo:6.0` with a persisted `mongo_data` volume and `mongosh` ping healthcheck; the `app` service waits on `service_healthy`.

---

## 3. Containerized Single-Origin Stack (`Dockerfile`, `docker-compose.yml`, `deploy/nginx/default.conf`)

SmartRoute ships a root multi-stage `Dockerfile` (never build from `server/` directly):

* **`Dockerfile`**:
  * `client-builder` stage (`node:20-bookworm-slim`): scopes `VITE_*` build arguments (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_MAP_PROVIDER`, `VITE_GEOAPIFY_TILE_API_KEY`, `VITE_GOOGLE_CLIENT_ID`) exclusively to the Vite build (`npm --prefix client run build`) so server secrets are never baked into client assets.
  * `runtime` stage (`node:20-bookworm-slim`): installs production server workspace dependencies, copies `server/` and `client/dist`, switches to non-root `USER node`, exposes port `5004`, defines a native Node 20 `/readyz` `HEALTHCHECK`, and starts `CMD ["node", "server/src/index.js"]`.
* **`deploy/nginx/default.conf`** (`nginx:1.27-alpine`):
  * Proxies `/healthz`, `/readyz`, `/api/`, `/assets/`, `/socket.io/`, and `/` to `app:5004` while preserving `$http_host` in `Host` and `X-Forwarded-Host`.
  * Configures WebSocket `Upgrade` / `Connection` headers and `86400s` (`proxy_read_timeout` / `proxy_send_timeout`) on `/socket.io/`.
  * Sets `client_max_body_size 12m`, gzip compression, and `public, max-age=31536000, immutable` caching on `/assets/`.
* **Launch**:
  ```bash
  docker compose config -q
  docker compose up -d --build --wait
  ```

---

## 4. Required v6 Environment Variables

In `NODE_ENV=production`, `server/src/config/env.js` refuses to boot unless all required security and connectivity variables pass fail-fast validation:

* `NODE_ENV=production`
* `PORT=5004`
* `MONGODB_URI=<your-mongodb-or-atlas-uri>`
* `JWT_SECRET=<unique-random-secret-at-least-32-chars>`
* `JWT_REFRESH_SECRET=<distinct-random-secret-at-least-32-chars>` (must differ from `JWT_SECRET` and never match committed dev/test/example literals)
* `TRUST_PROXY=1` (integer hop count behind Nginx, Render, or cloud load balancers; boolean `true` is rejected)
* `FORCE_HTTPS_CSP=true` (enables `upgrade-insecure-requests` on HTTPS deployments; keep `false` for plain HTTP local Compose testing)
* `SERVE_CLIENT=true` (Single-Origin) or `SERVE_CLIENT=false` (Split-Origin)
* `CLIENT_ORIGIN=https://<your-app>.vercel.app` (required when `SERVE_CLIENT=false`; supports comma-separated origins)
* `GEOAPIFY_SERVER_API_KEY=<server-api-key>` (falls back cleanly to simulated road matrix if omitted)
* `GOOGLE_CLIENT_ID=<google-oauth-web-client-id>` (must match `VITE_GOOGLE_CLIENT_ID` when Google Sign-In is enabled)

For Single-Origin client builds, keep `VITE_API_URL=/api/v1` and `VITE_SOCKET_URL=`. For Split-Origin Vercel builds, set `VITE_API_URL=https://<api-host>/api/v1`, optional `VITE_SOCKET_URL=https://<api-host>`, `VITE_GEOAPIFY_TILE_API_KEY`, and `VITE_GOOGLE_CLIENT_ID`. See [`README.md`](../README.md) and `.env.example` for the complete variable reference.

---

## 5. Initial Admin Bootstrap (`seed:admin`)

Provision the first non-demo `ADMIN` user (`isDemoData: false`) via `server/src/scripts/bootstrapAdmin.js` using a strong `ADMIN_PASSWORD` (`>= 10` non-whitespace characters):

```bash
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD="ReplaceWithStrongPassword123!" ADMIN_NAME="SmartRoute Admin" npm --prefix server run seed:admin
```

Inside Docker Compose, execute it inside the running `app` container (`docker compose exec ... app npm --prefix server run seed:admin`). The script is idempotent and does not invoke or alter the optional demo dataset (`npm --prefix server run seed`).

---

## 6. Health Checks & Post-Deploy Smoke Verification

Verify live endpoints and end-to-end routing behavior after every deployment:

* **Liveness**: `GET /healthz` and `GET /api/v1/health` $\to$ `200 OK`
* **Readiness**: `GET /readyz` and `GET /api/v1/health/ready` $\to$ `200 OK` (`database: CONNECTED`, or `503` while disconnected/draining)
* **Automated Smoke Suite** (`scripts/smoke-test.js`):
  ```bash
  # Single-Origin (Docker Compose / Render)
  node scripts/smoke-test.js --api-url https://<your-host> --expect-spa

  # Split-Origin (Vercel SPA + Render/Node API)
  node scripts/smoke-test.js --api-url https://<api-host> --client-url https://<your-app>.vercel.app --origin https://<your-app>.vercel.app
  ```
