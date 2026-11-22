<!-- generated-by: gsd-doc-writer -->
# SmartRoute — Configuration Guide

This guide provides a comprehensive reference for configuring SmartRoute across local development, containerized stacks, and production cloud environments. It details all supported environment variables, configuration files, default values, production validation rules, and secret management practices.

---

## 1. Architecture & Configuration Overview

SmartRoute is structured as a monorepo containing a Node.js Express + Socket.IO backend (`server`) and a React + Vite Single-Page Application (`client`). Runtime configuration is handled via environment variables and static configuration files:

1. **Unified Configuration (`.env.example`)**: Located at the project root, this file serves as the master template for full-stack local development and Docker Compose deployments.
2. **Server Configuration (`server/.env.example` & `server/src/config/env.js`)**: Backend-only runtime environment variables managing database connectivity, JWT security, proxy hops, CORS policies, mapping providers, and notification integrations.
3. **Client Configuration (`client/.env.example`)**: Vite frontend variables prefixed with `VITE_`. These are evaluated and embedded into the public JavaScript bundle at build time.
4. **Container & Reverse Proxy Configuration (`docker-compose.yml`, `Dockerfile`, `deploy/nginx/default.conf`)**: Declarative definitions for container networking, multi-stage image builds, WebSocket upgrades, body limits, and asset caching headers.
5. **Platform Deployment Descriptors (`render.yaml`, `vercel.json`)**: Blueprint specifications for single-origin hosting on Render or split-origin hosting on Vercel and cloud platforms.

SmartRoute supports two primary hosting topologies:
* **Single-Origin (`SERVE_CLIENT=true`)**: The Express backend serves the pre-built React application from `client/dist` alongside `/api/v1` and `/socket.io` under a single domain. This topology is used by Docker Compose and Render.
* **Split-Origin (`SERVE_CLIENT=false`)**: The React SPA is hosted independently (e.g., on Vercel CDN), while the backend runs as an API service (e.g., on Render or a dedicated VM). CORS and origin headers are strictly enforced.

---

## 2. Environment Variables Reference

### 2.1 Server Runtime & Hardening

These variables are consumed by `server/src/config/env.js` and Express middleware. In `NODE_ENV=production`, core security variables are validated at startup before accepting incoming connections.

| Variable | Type | Default Value | Status | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Number | `5004` (`5000` internal fallback) | Optional | The HTTP port that the Express and Socket.IO server binds to. Aligns with Vite dev proxy and Dockerfile `EXPOSE`. |
| `NODE_ENV` | String | `development` | Optional | Runtime environment: `development`, `test`, or `production`. Governs security validation, logging, and error envelopes. |
| `MONGODB_URI` | String | `mongodb://127.0.0.1:27017/smartroute` | **Required in Prod** | MongoDB connection string. Must start with `mongodb://` or `mongodb+srv://`. In Docker Compose, defaults to `mongodb://mongo:27017/smartroute`. |
| `JWT_SECRET` | String | Dev fallback string | **Required in Prod** | Cryptographic key used to sign and verify short-lived access tokens. Must be $\ge 32$ characters in production and cannot match committed example keys. |
| `JWT_REFRESH_SECRET` | String | Dev fallback string | **Required in Prod** | Cryptographic key used to sign and verify long-lived refresh tokens. Must be $\ge 32$ characters, cannot match example keys, and **must differ** from `JWT_SECRET`. |
| `JWT_EXPIRES_IN` | String | `15m` | Optional | Lifespan of access tokens parsed by `jsonwebtoken` (e.g., `15m`, `1h`). |
| `JWT_REFRESH_EXPIRES_IN` | String | `7d` | Optional | Lifespan of refresh tokens parsed by `jsonwebtoken` (e.g., `7d`, `30d`). |
| `CLIENT_ORIGIN` | String | `http://localhost:5173` | **Required if Split-Origin** | Comma-separated list of allowed origins for CORS and Socket.IO in production when `SERVE_CLIENT=false` (e.g., `https://app.yourdomain.com`). |
| `SERVE_CLIENT` | Boolean | `false` (`true` in Docker/Render) | Optional | When `'true'`, Express serves static SPA assets from `client/dist`. When `'false'`, the server operates strictly as an API service. |
| `TRUST_PROXY` | Integer / Boolean | `false` (`1` in production) | Optional | Express proxy hop count. Must be a non-negative integer (e.g., `1`) or `'false'`. **Boolean `true` is explicitly rejected** to prevent permissive spoofing. |
| `FORCE_HTTPS_CSP` | Boolean | `false` | Optional | When `'true'`, enables `upgrade-insecure-requests` in Content-Security-Policy headers behind TLS reverse proxies (Render, Cloudflare, AWS ALB). |

### 2.2 Mapping & Geocoding Services

Consumed by `server/src/services/mapping/geoapify.service.js` and routing engines.

| Variable | Type | Default Value | Status | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| `MAP_PROVIDER` | String | `geoapify` | Optional | Primary routing engine and geocoding provider. Set to `geoapify` or `osm`. |
| `GEOAPIFY_SERVER_API_KEY` | String | Unset | Optional | Server-side Geoapify API key used for routing matrices, distance calculations, and forward geocoding. If unset or using a placeholder, falls back cleanly to simulated road matrices. |
| `GEOAPIFY_API_KEY` | String | Unset | Optional | Legacy fallback variable for `GEOAPIFY_SERVER_API_KEY`. |
| `GOOGLE_MAPS_API_KEY` | String | Unset | Optional | Legacy optional fallback key for Google Distance Matrix API if configured. |

> [!NOTE]
> **Canonical Depot Coordinates**: The default distribution hub coordinates are defined in `server/src/config/constants.js` as the **Rasulgarh Logistics Hub** (`lat: 20.2961`, `lng: 85.8645`, Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar). Custom stop coordinates are supplied per consignment or batch import.

### 2.3 Authentication, OAuth & Out-of-Band OTP Integrations

Consumed by `server/src/controllers/authController.js` and notification services.

| Variable | Type | Default Value | Status | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| `GOOGLE_CLIENT_ID` | String | Unset | Optional | Google OAuth 2.0 Web Client ID used by the backend to verify Google ID tokens received from the client. Must match `VITE_GOOGLE_CLIENT_ID`. |
| `SMTP_SERVICE` | String | `gmail` | Optional | Nodemailer well-known service identifier (e.g., `gmail`, `SendGrid`). |
| `SMTP_HOST` | String | `smtp.gmail.com` | Optional | Hostname of the outbound SMTP server. |
| `SMTP_PORT` | Number | `587` | Optional | Port for the SMTP server (typically `587` for STARTTLS or `465` for SSL). |
| `SMTP_SECURE` | Boolean | `false` | Optional | Set to `'true'` for SSL on port 465; `'false'` for port 587/STARTTLS. |
| `SMTP_USER` | String | Unset | Optional | Username or email address for SMTP authentication. |
| `SMTP_PASS` | String | Unset | Optional | Password or App Password for SMTP authentication. |
| `SMTP_FROM` | String | `SmartRoute Operations <no-reply@smartroute.local>` | Optional | Outbound sender name and email address for system emails. |
| `TWILIO_ACCOUNT_SID` | String | Unset | Optional | Twilio account SID for SMS delivery of driver dispatch alerts and OTP codes. |
| `TWILIO_AUTH_TOKEN` | String | Unset | Optional | Twilio authentication token. |
| `TWILIO_FROM_NUMBER` | String | Unset | Optional | Sender phone number registered with Twilio in E.164 format. |
| `FAST2SMS_API_KEY` | String | Unset | Optional | Fast2SMS API key for Indian SMS routing. |
| `FAST2SMS_ROUTE` | String | `otp` | Optional | Fast2SMS route category (e.g., `otp`, `dlt`). |
| `SMS_WEBHOOK_URL` | String | Unset | Optional | Optional webhook URL for external SMS gateway relays. |
| `SMS_WEBHOOK_SECRET` | String | Unset | Optional | Secret token for authenticating inbound/outbound SMS webhook payloads. |
| `OTP_TTL_MINUTES` | Number | `10` | Optional | Time-to-live for one-time passwords in minutes. |
| `OTP_MAX_ATTEMPTS` | Number | `5` | Optional | Maximum failed verification attempts before an OTP is invalidated. |
| `OTP_RESEND_COOLDOWN_SECONDS` | Number | `30` | Optional | Minimum cooldown period between consecutive OTP resend requests. |
| `ENABLE_POD_OTP` | Boolean | `false` in `.env.example` | Optional | Feature flag controlling Proof-of-Delivery OTP verification during stop completion. |

### 2.4 Client (Vite Frontend) Configuration

These variables are defined in `client/.env.example` and read via `import.meta.env` in `client/src`. All `VITE_*` variables are baked into static assets during `npm run build`. **Never place confidential server credentials in client variables.**

| Variable | Type | Default Value | Status | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | String | `/api/v1` | **Required** | Base path or URL for REST API requests. Use `/api/v1` for Vite dev proxy and Single-Origin hosting. Use `https://api.yourdomain.com/api/v1` for Split-Origin hosting. |
| `VITE_SOCKET_URL` | String | `""` (empty) | Optional | URL for Socket.IO connection. Leave blank to inherit `/` or derive from `VITE_API_URL`. Set explicitly only if Socket.IO is hosted on a separate hostname. |
| `VITE_MAP_PROVIDER` | String | `geoapify` | Optional | Map provider used by client map views (`geoapify` or `osm`). |
| `VITE_GEOAPIFY_TILE_API_KEY` | String | Unset | Optional | Client-safe Geoapify tile key for vector map rendering. Falls back to OpenStreetMap tiles if unset. |
| `VITE_GOOGLE_CLIENT_ID` | String | Unset | Optional | Public Google OAuth 2.0 Web Client ID for Google Sign-In button rendering. Must match `GOOGLE_CLIENT_ID` on the server. |

### 2.5 Infrastructure, Bootstrap & Smoke Testing

Variables used by container orchestrators, administrative seed utilities, and verification scripts.

| Variable | Type | Default Value | Status | Purpose & Description |
| :--- | :--- | :--- | :--- | :--- |
| `HTTP_PORT` | Number | `80` | Optional | Host port mapped by `docker-compose.yml` to the Nginx reverse proxy. |
| `ADMIN_EMAIL` | String | `admin@smartroute.internal` (dev) | **Required for seed:admin** | Email address for initial non-demo administrator provisioning via `npm --prefix server run seed:admin`. |
| `ADMIN_PASSWORD` | String | `SmartRouteAdmin!2026` (dev) | **Required for seed:admin** | Password for the initial administrator. Must be $\ge 10$ non-whitespace characters in production and not in the weak passwords list. |
| `ADMIN_NAME` | String | `SmartRoute Admin` | Optional | Display name for the initial administrator account (2 to 100 characters). |
| `SMOKE_API_URL` | String | Unset | Optional | Target API URL for post-deployment automated smoke testing (`scripts/smoke-test.js`). |
| `SMOKE_CLIENT_URL` | String | Unset | Optional | Target SPA URL for split-origin post-deployment smoke verification. |
| `SMOKE_ORIGIN` | String | Unset | Optional | Origin header used during automated CORS preflight smoke verification. |
| `SMOKE_RETRIES` | Number | `10` | Optional | Maximum polling attempts for `/readyz` during smoke verification. |
| `SMOKE_DELAY_MS` | Number | `1000` | Optional | Millisecond delay between readiness polling attempts. |
| `SMOKE_EMAIL` | String | Unset | Optional | Test user email for authenticated smoke probe verification. |
| `SMOKE_PASSWORD` | String | Unset | Optional | Test user password for authenticated smoke probe verification. |

---

## 3. Configuration Files Reference

```
Last Mile Delivery Optimization/
├── .env.example                # Unified monorepo template (Server, Client, Docker, Smoke)
├── docker-compose.yml          # Container stack orchestration (MongoDB, Node App, Nginx)
├── Dockerfile                  # Multi-stage production container build
├── render.yaml                 # Infrastructure-as-code blueprint for Render
├── vercel.json                 # Split-origin SPA rewrite and security headers configuration
├── deploy/
│   └── nginx/
│       └── default.conf        # Production Nginx reverse proxy and caching rules
├── server/
│   ├── .env.example            # Isolated backend runtime template
│   └── src/
│       ├── config/
│       │   ├── env.js          # Environment loading and production validation schema
│       │   ├── cors.js         # Origin normalization and CORS options delegate
│       │   ├── constants.js    # System constants, vehicle specs, and depot coordinates
│       │   └── db.js           # Mongoose connection options and timeout settings
│       └── middleware/
│           └── rateLimiter.js  # Brute-force and operational API rate limits
└── client/
    ├── .env.example            # Frontend build variables template
    ├── vite.config.ts          # Vite build config, dev server, and local API proxy
    └── vercel.json             # Alternative Vercel config when client is root directory
```

### 3.1 Server Environment Loader (`server/src/config/env.js`)

In non-production environments (`NODE_ENV !== 'production'`), the loader automatically checks for `.env` (or `.env.test`) in `server/` first, falling back to the project root `.env`. In production, local `.env` files are ignored so that secrets cannot be silently masked by stale disk files.

```javascript
// server/src/config/env.js (Production Validation Sample)
const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute',
  JWT_SECRET: process.env.JWT_SECRET || '...',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '...',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? (nodeEnv === 'production' ? '' : 'http://localhost:5173'),
  TRUST_PROXY: parsedTrustProxy,
  SERVE_CLIENT: process.env.SERVE_CLIENT === 'true',
  FORCE_HTTPS_CSP: process.env.FORCE_HTTPS_CSP === 'true',
};
```

### 3.2 Multi-Stage Dockerfile (`Dockerfile`)

The root `Dockerfile` separates client compilation from the Node runtime using two stages:

1. **`client-builder` (`node:20-bookworm-slim`)**:
   * Accepts public build arguments: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_MAP_PROVIDER`, `VITE_GEOAPIFY_TILE_API_KEY`, and `VITE_GOOGLE_CLIENT_ID`.
   * Runs `npm --prefix client run build` to output compiled HTML/JS/CSS to `client/dist`.
   * Server secrets are never passed into this stage.
2. **`runtime` (`node:20-bookworm-slim`)**:
   * Installs production dependencies only via `npm ci --omit=dev --workspace=server --include-workspace-root`.
   * Copies `server/` and `client/dist`.
   * Runs as unprivileged `USER node`.
   * Configures a native Node.js `/readyz` `HEALTHCHECK`.
   * Starts the server via `CMD ["node", "server/src/index.js"]`.

### 3.3 Docker Compose Stack (`docker-compose.yml`)

The compose stack wires together three services in an internal network:

```yaml
services:
  mongo:
    image: mongo:6.0
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL:-/api/v1}
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: "5004"
      SERVE_CLIENT: "true"
      TRUST_PROXY: "${TRUST_PROXY:-1}"
      MONGODB_URI: "${MONGODB_URI:-mongodb://mongo:27017/smartroute}"
      JWT_SECRET: "${JWT_SECRET:?Set JWT_SECRET (>=32 chars)}"
      JWT_REFRESH_SECRET: "${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET (>=32 chars)}"

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "${HTTP_PORT:-80}:80"
    volumes:
      - ./deploy/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      app:
        condition: service_healthy
```

### 3.4 Nginx Reverse Proxy (`deploy/nginx/default.conf`)

The reverse proxy handles public HTTP traffic and enforces operational standards:
* **Body Size Limit**: `client_max_body_size 12m;` (supports CSV imports and image uploads within backend limits).
* **Compression**: Gzip enabled for JSON, JavaScript, CSS, XML, and SVG.
* **WebSocket Upgrades**: Maps `$http_upgrade` to `$connection_upgrade` and sets `86400s` read/send timeouts on `/socket.io/`.
* **Static Asset Caching**: Serves `/assets/` with `Cache-Control: public, max-age=31536000, immutable` and `expires 1y`.
* **Health Probes**: Direct unbuffered proxy passes for `/healthz` and `/readyz`.

---

## 4. Built-in Application Limits & Guardrails

In addition to environment variables, SmartRoute enforces hard architectural limits in code:

| Component | Setting | Value | Source Location |
| :--- | :--- | :--- | :--- |
| **Auth Rate Limiter** | Window & Max Attempts | 30 requests per 15 minutes per IP | `server/src/middleware/rateLimiter.js` |
| **Operational Rate Limiter** | Window & Max Requests | 300 requests per 15 minutes per IP | `server/src/middleware/rateLimiter.js` |
| **JSON Payload Limit** | Express body parser | `10mb` | `server/src/app.js` |
| **URL-Encoded Payload Limit** | Express body parser | `10mb` | `server/src/app.js` |
| **Nginx Client Max Body** | Reverse Proxy Buffer | `12m` | `deploy/nginx/default.conf` |
| **MongoDB Selection Timeout** | Driver Connection | `12000ms` | `server/src/config/db.js` |
| **Server Shutdown Timeout** | Graceful Drain | `10000ms` | `server/src/index.js` |
| **Depot Location** | Default Hub Geo | Lat: `20.2961`, Lng: `85.8645` | `server/src/config/constants.js` |

---

## 5. Startup Validation Rules (`NODE_ENV=production`)

When booted with `NODE_ENV=production`, `server/src/config/env.js` runs `validateProductionEnv()`. If any check fails, the process logs a detailed error list and exits immediately (`code 1`), preventing corrupted or insecure runtimes from receiving traffic.

### Validation Requirements:

1. **`MONGODB_URI`**:
   * Must not be empty or whitespace.
   * Must start with `mongodb://` or `mongodb+srv://`.
   * *Error*: `MONGODB_URI is required in production (missing or blank)` or `MONGODB_URI must start with mongodb:// or mongodb+srv://`.
2. **`JWT_SECRET`**:
   * Must not be empty.
   * Length must be $\ge 32$ characters.
   * Must not match any development, test, CI, or example placeholder strings.
   * *Error*: `JWT_SECRET must be at least 32 characters in production`.
3. **`JWT_REFRESH_SECRET`**:
   * Must not be empty.
   * Length must be $\ge 32$ characters.
   * Must not match any development or example strings.
   * **Must differ** from `JWT_SECRET`.
   * *Error*: `JWT_REFRESH_SECRET must differ from JWT_SECRET in production`.
4. **`TRUST_PROXY`**:
   * Must parse to a non-negative integer (e.g., `1`, `2`) or `false`.
   * Passing literal `true` throws an error.
   * *Error*: `Invalid TRUST_PROXY value "true": boolean true is disallowed to prevent permissive trust proxy errors; specify an integer hop count (e.g. "1") or "false".`
5. **`CLIENT_ORIGIN`** (when `SERVE_CLIENT` is not `'true'`):
   * Must contain at least one valid origin URL.
   * *Error*: `CLIENT_ORIGIN must contain at least one valid origin in production when SERVE_CLIENT is not true`.
6. **`SERVE_CLIENT`** (when set to `'true'`):
   * `client/dist/index.html` must exist on disk before startup.
   * *Error*: `SERVE_CLIENT=true requires built client assets, but "<path>" was not found. Run "npm --prefix client run build" first.`

---

## 6. Default Values & Fallback Strategy

The application resolves configuration progressively based on runtime context:

```
[Default Code Constant] ---> [server/.env] ---> [Monorepo root .env] ---> [System Environment]
```

* **Local Development (`NODE_ENV=development`)**:
  * Local `.env` files are loaded using `dotenv`.
  * If `JWT_SECRET` or `JWT_REFRESH_SECRET` is unset, hardcoded development keys are permitted for zero-friction developer onboarding.
  * `TRUST_PROXY` defaults to `false`.
  * `CLIENT_ORIGIN` automatically includes `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, and `http://127.0.0.1:5174`.
* **Testing (`NODE_ENV=test`)**:
  * Loads `server/.env.test` or root `.env.test`.
  * Morgan HTTP request logging is disabled.
  * Rate limiter countdowns and delays are bypassed in test runners.
* **Production (`NODE_ENV=production`)**:
  * File loading via `dotenv` is bypassed. All configuration **must** come directly from container or host environment variables.
  * Localhost origins are excluded from CORS unless explicitly listed in `CLIENT_ORIGIN`.
  * `TRUST_PROXY` defaults to `1`.
  * Fallback development secrets cause immediate termination.

---

## 7. Environment Setup: Dev vs. Staging vs. Production

### 7.1 Local Development

In local development, developers typically run the frontend and backend in separate terminal processes:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start MongoDB locally (or run `docker compose up mongo -d`).
3. Start the monorepo concurrently:
   ```bash
   npm run dev
   ```
   * Vite dev server listens on `http://localhost:5173`.
   * Express API listens on `http://localhost:5004`.
   * Vite proxies `/api` and `/socket.io` to `http://127.0.0.1:5004`.

### 7.2 Docker Compose (Single-Origin)

To run the complete production-grade container stack locally or on a VPS:

1. Generate secure random JWT keys in your root `.env`:
   ```bash
   JWT_SECRET=$(openssl rand -hex 32)
   JWT_REFRESH_SECRET=$(openssl rand -hex 32)
   ```
2. Verify compose configuration and boot:
   ```bash
   docker compose config -q
   docker compose up -d --build --wait
   ```
3. Seed the initial admin account inside the container:
   ```bash
   docker compose exec app npm --prefix server run seed:admin
   ```
4. Access the unified web app at `http://localhost` (or `http://<server-ip>`).

### 7.3 Production Cloud Deployments

#### Option A: Render (Single-Origin Blueprint)
* Blueprint specification: `render.yaml`.
* The Render Node service builds both client and server, then runs `node server/src/index.js` with `SERVE_CLIENT=true`.
* `JWT_SECRET` and `JWT_REFRESH_SECRET` are generated automatically via `generateValue: true`.
* Supply `MONGODB_URI` (pointing to MongoDB Atlas) in the Render Dashboard environment settings.
* Set `TRUST_PROXY=1` and `FORCE_HTTPS_CSP=true`.

#### Option B: Split-Origin (Vercel Frontend + Render API)
* **Frontend (Vercel)**:
  * Deploy using root `vercel.json` or `client/vercel.json`.
  * Set environment variables in Vercel project settings:
    * `VITE_API_URL=https://api.yourdomain.com/api/v1`
    * `VITE_SOCKET_URL=https://api.yourdomain.com`
    * `VITE_GEOAPIFY_TILE_API_KEY=<client-tile-key>`
    * `VITE_GOOGLE_CLIENT_ID=<google-client-id>`
* **Backend (Node 20 Runtime)**:
  * Set `SERVE_CLIENT=false`.
  * Set `CLIENT_ORIGIN=https://your-app.vercel.app`.
  * Supply `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.

---

## 8. Secrets Management & Best Practices

1. **Cryptographic Key Generation**:
   Always generate production tokens using a cryptographically secure random number generator:
   ```bash
   openssl rand -hex 32
   ```
   Never reuse the same secret for both `JWT_SECRET` and `JWT_REFRESH_SECRET`.
2. **Never Commit Secrets**:
   Ensure `.env`, `server/.env`, and `client/.env` remain listed in `.gitignore`. SmartRoute includes `.gitleaksignore` to audit repository commits for accidental credential leaks.
3. **Public vs. Private Variable Scoping**:
   * **Private (Server-only)**: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `GEOAPIFY_SERVER_API_KEY`, `SMTP_PASS`, `TWILIO_AUTH_TOKEN`. These must only be set in the server environment and never exposed to the client.
   * **Public (Client-embedded)**: Any variable beginning with `VITE_`. These are compiled directly into the client bundle and are visible to anyone inspecting web network requests.
4. **Initial Administrator Seeding**:
   Never use weak, predictable passwords for `ADMIN_PASSWORD`. In production, supply credentials inline to the CLI seeding script without committing them to disk:
   ```bash
   ADMIN_EMAIL="admin@yourdomain.com" \
   ADMIN_PASSWORD="YourStrongSecurePassword2026!" \
   ADMIN_NAME="Operations Admin" \
   npm --prefix server run seed:admin
   ```
5. **Post-Deployment Verification**:
   Execute the smoke test suite against newly deployed environments to verify configuration and readiness:
   ```bash
   node scripts/smoke-test.js --api-url https://api.yourdomain.com --expect-spa
   ```
