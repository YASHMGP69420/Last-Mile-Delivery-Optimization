# SmartRoute – Smart Route Optimization System for Last-Mile Delivery

[![CI/CD Pipeline](https://github.com/smartroute/smartroute/actions/workflows/ci.yml/badge.svg)](https://github.com/smartroute/smartroute/actions)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**SmartRoute** is an enterprise-grade route optimization, fleet scheduling, and driver execution platform designed for dense urban logistics clusters. Built with React 18, Node.js Express, Socket.IO, MongoDB, and Tailwind CSS, SmartRoute automates capacity-constrained bin packing, Electric Vehicle (EV) allocation, Nearest-Neighbor heuristic construction, and bounded 2-Opt local search Traveling Salesperson Problem (TSP) optimization.

---

## 🌟 Key Highlights

* **Multi-Vehicle 2-Opt TSP Engine**: Refines delivery sequences while guaranteeing the mathematical invariant $D_{\text{optimized}} \le D_{\text{baseline}}$.
* **EV Preference & Fuel Savings**: Computes monetary savings in Indian Rupees (₹) and kilograms of tailpipe $\text{CO}_2$ avoided.
* **1:1 Vehicle-Driver Mutual Exclusivity**: Enforces strict mutual unbinding on reassignment at both the database and REST controller layers.
* **Resilient Mapping with Fallbacks**: Interactive Leaflet canvas supporting Geoapify vector tiles and automatic fallback to OpenStreetMap standard tiles and simulated Haversine matrices.
* **Driver Handheld Mobile App**: Mobile stop sequencing, Universal Google Maps turn-by-turn navigation deep-links, OTP handoff, digital signature pad, photo upload, and exception reporting.
* **Application-Wide Dark & Light Modes**: Seamless switching between daylight dispatching and low-glare nighttime driving with local persistence.
* **Bulk CSV Import**: High-volume consignment, vehicle, and driver CSV ingestion with dry-run schema validation and atomic commit.

---

## 🚀 Quick Start Guide (Local Development)

### Prerequisites
* **Node.js**: `>= 20.0.0` (matches `package.json` `engines.node`)
* **npm**: `>= 10.0.0` (matches `package.json` `engines.npm`)
* **MongoDB**: `>= 6.0` (local service, Docker `mongo:6.0`, or MongoDB Atlas)
* **Docker Engine & Compose v2** *(optional)*: required only for containerized Single-Origin deployment

### 1. Installation
Clone the repository and install all monorepo workspace dependencies:
```bash
git clone <repository-url>
cd "Last Mile Delivery Optimization"
npm install
```

### 2. Environment Configuration
Copy the audited environment templates (`.env.example`, `server/.env.example`, `client/.env.example`) to local `.env` files (never commit `.env` files with real secrets):

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env; Copy-Item server/.env.example server/.env; Copy-Item client/.env.example client/.env
```

**Bash / macOS / Linux:**
```bash
cp .env.example .env && cp server/.env.example server/.env && cp client/.env.example client/.env
```

In local development, `server/.env` runs on `PORT=5004` with `CLIENT_ORIGIN=http://localhost:5173`, and the Vite dev server (`client/vite.config.ts`) proxies `/api` and `/socket.io` directly to `http://127.0.0.1:5004` so `VITE_API_URL=/api/v1` and an empty `VITE_SOCKET_URL=` work out of the box.

### 3. Create Initial Admin (`seed:admin`)
SmartRoute does not ship default hardcoded login passwords. Provision your first non-demo `ADMIN` user (`isDemoData: false`) using `server/src/scripts/bootstrapAdmin.js` with `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`>= 10` non-whitespace characters, non-weak/non-placeholder), and optional `ADMIN_NAME` (defaults to `SmartRoute Admin`):

**Windows PowerShell:**
```powershell
$env:ADMIN_EMAIL="admin@yourdomain.com"; $env:ADMIN_PASSWORD="ReplaceWithStrongPassword123!"; $env:ADMIN_NAME="SmartRoute Admin"; npm --prefix server run seed:admin
```

**Bash / macOS / Linux:**
```bash
ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD="ReplaceWithStrongPassword123!" ADMIN_NAME="SmartRoute Admin" npm --prefix server run seed:admin
```

You can also invoke the root workspace alias `npm run seed:admin` (or `npm run bootstrap:admin`). `seed:admin` is idempotent: if an active non-demo `ADMIN` or matching email already exists, it exits cleanly without overwriting passwords or modifying demo data.

### 4. Optional Demo Dataset (`seed`)
To explore the platform with sample Bhubaneswar logistics data, you may optionally import the removable demo dataset (`isDemoData: true`: 10 consignments, 4 vehicles, 3 drivers, and 1 ready dispatch batch generated with random per-seed credentials and zero hardcoded passwords):
```bash
npm --prefix server run seed
```

This runs `server/src/seed/seedBhubaneswar.js`. Purge all tagged `isDemoData: true` records anytime—without touching real users, vehicles, drivers, or consignments—via CLI or the **Admin Control Center → Demo Dataset** panel:
```bash
node server/src/seed/seedBhubaneswar.js --delete
```

### 5. Start Development Servers
Run both the Express/Socket.IO backend and Vite React frontend concurrently:
```bash
npm run dev
```

Open your browser or health endpoints at:
* **Frontend Cockpit**: `http://localhost:5173`
* **Backend API Base**: `http://localhost:5004/api/v1`
* **Liveness Probe**: `http://localhost:5004/healthz` (and `http://localhost:5004/api/v1/health`)
* **Readiness Probe**: `http://localhost:5004/readyz` (and `http://localhost:5004/api/v1/health/ready`)

---

## 🚢 Production Deployment Runbooks

SmartRoute supports both **Single-Origin** (`SERVE_CLIENT=true`, same origin serves SPA + `/api/v1/*` + `/socket.io/*`) and **Split-Origin** (`SERVE_CLIENT=false` API + Vercel-hosted React SPA). All production topologies pin a single stateful backend instance (`replicas: 1` / `numInstances: 1`) for Socket.IO room state.

### Topology A — Single-Origin Docker Compose (`docker-compose.yml` + `deploy/nginx/default.conf` + `Dockerfile`)
Launches three services: `mongo:6.0` (persisted `mongo_data` volume + `mongosh` ping healthcheck), non-root `app` (`node:20-bookworm-slim`, `USER node`, `SERVE_CLIENT=true`, `/readyz` `HEALTHCHECK`), and `nginx:1.27-alpine` (`deploy/nginx/default.conf` with WebSocket `/socket.io/` upgrade, `86400s` timeouts, `12m` max body size, gzip, and immutable `/assets/` cache).

1. **Configure root `.env`**:
   ```bash
   cp .env.example .env
   ```
   Generate distinct, high-entropy `>= 32`-character secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET` (e.g., `openssl rand -hex 32`), keep `VITE_API_URL=/api/v1`, `VITE_SOCKET_URL=`, and `FORCE_HTTPS_CSP=false` (set to `true` only if an external TLS reverse proxy terminates HTTPS in front of Nginx), and optionally set `HTTP_PORT=80` plus Geoapify, Google OAuth, SMTP, or SMS keys.

2. **Validate and start the stack**:
   ```bash
   docker compose config -q
   docker compose up -d --build --wait
   ```

3. **Bootstrap the initial non-demo admin**:
   ```bash
   docker compose exec -e ADMIN_EMAIL=admin@yourdomain.com -e ADMIN_PASSWORD="ReplaceWithStrongPassword123!" -e ADMIN_NAME="SmartRoute Admin" app npm --prefix server run seed:admin
   ```

4. **Verify live deployment**:
   ```bash
   node scripts/smoke-test.js --api-url http://127.0.0.1:80 --expect-spa --origin http://127.0.0.1:80
   ```

### Topology B — Single-Origin Render Blueprint (`render.yaml`)
Deploy declaratively from the repository root `render.yaml` (`runtime: node`, `numInstances: 1`, `healthCheckPath: /readyz`, `SERVE_CLIENT=true`, `TRUST_PROXY=1`, `FORCE_HTTPS_CSP=true`, `VITE_API_URL=/api/v1`, and Render-generated `JWT_SECRET` & `JWT_REFRESH_SECRET`).

1. **Create Blueprint**: In the Render Dashboard, create a new Blueprint pointing to this repository (`render.yaml`).
2. **Populate `sync: false` environment variables**:
   * **Required**: `MONGODB_URI` (MongoDB Atlas connection string)
   * **Optional Maps & OAuth**: `GEOAPIFY_SERVER_API_KEY`, `VITE_GEOAPIFY_TILE_API_KEY`, `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`
   * **Optional Custom Domain & Notifications**: `CLIENT_ORIGIN` (comma-separated allowed origins if serving custom domains), `SMTP_*`, `TWILIO_*`, `FAST2SMS_*`, `SMS_WEBHOOK_*`
3. **Bootstrap initial admin** in the Render service **Shell**:
   ```bash
   ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD="ReplaceWithStrongPassword123!" ADMIN_NAME="SmartRoute Admin" npm --prefix server run seed:admin
   ```
4. **Verify live deployment**:
   ```bash
   node scripts/smoke-test.js --api-url https://<your-service>.onrender.com --expect-spa
   ```

### Topology C — Split-Origin (`vercel.json` / `client/vercel.json` + Render/Node API + MongoDB Atlas)
Host the Express + Socket.IO API on Render (or any Node 20 host) and the React SPA on Vercel CDN:

1. **Deploy the Backend API (`SERVE_CLIENT=false`)**:
   * Start command: `node server/src/index.js` (`numInstances: 1`)
   * Required production env vars: `NODE_ENV=production`, `PORT=5004`, `SERVE_CLIENT=false`, `TRUST_PROXY=1`, `FORCE_HTTPS_CSP=true`, `MONGODB_URI=<atlas-uri>`, distinct `>= 32`-character `JWT_SECRET` & `JWT_REFRESH_SECRET`, and `CLIENT_ORIGIN=https://<your-app>.vercel.app` (comma-separated if supporting custom domains or preview URLs).
   * Add optional `GEOAPIFY_SERVER_API_KEY`, `GOOGLE_CLIENT_ID`, and SMTP/SMS variables.
2. **Deploy the Frontend SPA on Vercel**:
   * Use root `vercel.json` (default repo root) or `client/vercel.json` (when Vercel **Root Directory** is set to `client`). Both manifests configure mirrored SPA rewrites, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `no-cache` on `/index.html` and `/theme-init.js`, immutable `/assets/*` caching, and the production `Content-Security-Policy`.
   * Set Vercel build-time environment variables:
     * `VITE_API_URL=https://<api-host>/api/v1`
     * `VITE_SOCKET_URL=https://<api-host>` *(optional — auto-derived from `VITE_API_URL` origin when omitted)*
     * `VITE_GEOAPIFY_TILE_API_KEY=<browser-tile-key>`
     * `VITE_GOOGLE_CLIENT_ID=<google-web-client-id>`
3. **Bootstrap initial admin** (locally or from the API host shell with production `MONGODB_URI`):
   ```bash
   npm --prefix server run seed:admin
   ```
4. **Verify live Split-Origin deployment**:
   ```bash
   node scripts/smoke-test.js --api-url https://<api-host> --client-url https://<your-app>.vercel.app --origin https://<your-app>.vercel.app
   ```

---

## 🔐 Google OAuth & Geoapify Setup

### Google Identity Services (Google Sign-In)
1. In Google Cloud Console (**APIs & Services → Credentials → OAuth 2.0 Web Client**), register every browser origin under **Authorized JavaScript origins**:
   * Local dev: `http://localhost:5173` and `http://127.0.0.1:5173`
   * Production: `https://<your-service>.onrender.com`, `https://<your-app>.vercel.app`, and any custom domain
2. Set the identical Web Client ID in both `GOOGLE_CLIENT_ID` (backend ID-token verification) and `VITE_GOOGLE_CLIENT_ID` (browser GIS button).
3. Both `server/src/app.js` (Helmet) and `vercel.json` / `client/vercel.json` emit `Cross-Origin-Opener-Policy: same-origin-allow-popups` and allow `https://accounts.google.com` in `script-src`, `style-src`, `frame-src`, and `connect-src`.

### Geoapify Routing & Map Tiles
* **`GEOAPIFY_SERVER_API_KEY`**: Private server key used for route matrix and geocoding requests. If omitted or left as a placeholder, SmartRoute falls back cleanly to the deterministic simulated road matrix.
* **`VITE_GEOAPIFY_TILE_API_KEY`**: Public browser key used by Leaflet map tiles. If omitted, the UI falls back cleanly to OpenStreetMap standard tiles. Restrict this key by HTTP referrer in your Geoapify Dashboard for production deployments.

---

## 🩺 Post-Deploy Smoke Verification (`scripts/smoke-test.js`)

Run the zero-dependency Node 20 verifier (`node scripts/smoke-test.js` or `npm run smoke -- ...`) against any local, Docker, Render, or Split-Origin deployment:

```bash
node scripts/smoke-test.js --api-url https://<api-host> [options]
```

**Supported flags & `SMOKE_*` environment fallbacks:**
* `--api-url <url>` (`SMOKE_API_URL`): Base API or Single-Origin URL (trailing `/api/v1` is normalized automatically)
* `--client-url <url>` (`SMOKE_CLIENT_URL`): Split-Origin frontend SPA URL (auto-enables SPA check)
* `--origin <origin>` (`SMOKE_ORIGIN`): Origin header for `OPTIONS /api/v1/health` CORS preflight verification
* `--expect-spa`: Verify `GET /` serves `text/html` containing `/theme-init.js`
* `--retries <n>` (`SMOKE_RETRIES`, default `10`): Maximum `/readyz` polling attempts before failing
* `--delay-ms <ms>` (`SMOKE_DELAY_MS`, default `1000`): Delay between `/readyz` polling attempts in ms
* `--email <email>` / `--password <pass>` (`SMOKE_EMAIL` / `SMOKE_PASSWORD`): Optional authenticated `POST /api/v1/auth/login` check (runs after readiness polling to avoid auth rate-limit interference)

---

## 🧪 Testing & Quality Gates

Run the full server Jest unit, integration, and security test suite:
```bash
npm --prefix server test
```

Run frontend TypeScript type checking:
```bash
npm --prefix client test
```

Run frontend type checking and production Vite bundle build:
```bash
npm --prefix client run build
```

---

## 📚 Documentation Index

Comprehensive user guides and technical architecture documents are available in the [`docs/`](docs/README.md) directory:

### User Manuals
* [01 - Project Overview & System Architecture](docs/user-guide/01-PROJECT-OVERVIEW.md)
* [02 - Installation and Setup Guide](docs/user-guide/02-INSTALLATION-AND-SETUP.md)
* [03 - Chief Operations Admin Guide](docs/user-guide/03-ADMIN-GUIDE.md)
* [04 - Fleet Manager & Dispatcher Guide](docs/user-guide/04-FLEET-MANAGER-GUIDE.md)
* [05 - Route Planning & Optimization Guide](docs/user-guide/05-ROUTE-OPTIMIZATION-GUIDE.md)
* [06 - Maps & Google Maps Navigation Guide](docs/user-guide/06-MAPS-AND-NAVIGATION-GUIDE.md)
* [07 - Delivery Driver User Guide](docs/user-guide/07-DRIVER-GUIDE.md)
* [08 - Tracking, Telemetry & Analytics Guide](docs/user-guide/08-TRACKING-AND-ANALYTICS-GUIDE.md)
* [09 - Troubleshooting & Error Recovery Guide](docs/user-guide/09-TROUBLESHOOTING-GUIDE.md)
* [10 - Frequently Asked Questions (FAQ)](docs/user-guide/10-FAQ.md)

### Technical Reports & Audits
* [Project Completion Audit](docs/PROJECT_COMPLETION_AUDIT.md)
* [Feature Completion Matrix](docs/FEATURE_COMPLETION_MATRIX.md)
* [Interaction & Control Verification](docs/INTERACTION_VERIFICATION.md)
* [Production Readiness Report](docs/PRODUCTION_READINESS_REPORT.md)
* [Repository Cleanup & Hygiene Report](docs/REPOSITORY_CLEANUP_REPORT.md)
* [Dark & Light Mode Implementation](docs/DARK_MODE_IMPLEMENTATION.md)
* [Environment Configuration Reference](docs/ENVIRONMENT_CONFIGURATION.md)
* [Security & Adversarial Audit](docs/SECURITY_AUDIT.md)
* [Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
* [CI/CD Quality Gates Guide](docs/CI_CD_GUIDE.md)
* [Documentation Maintenance Protocol](docs/DOCUMENTATION_MAINTENANCE.md)
* [Core System Changelog](docs/CORE_CHANGELOG.md)
* [Final Project Completion Report](docs/FINAL_PROJECT_COMPLETION_REPORT.md)
