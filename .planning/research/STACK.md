# Stack Research

**Domain:** Production Deployment, Containerization, Reverse Proxy & Hardening (SmartRoute v6)
**Researched:** 2026-11-11
**Confidence:** HIGH (workspace stack & versions verified directly from repo; external PaaS/Nginx/Helmet/Docker specs MEDIUM via verified web docs)

---

## Recommended Stack

> **Core Principle:** SmartRoute already ships Express `^4.19.2` (`4.22.3` installed), Helmet `^7.1.0` (`7.2.0`), CORS `^2.8.5` (`2.8.6`), `express-rate-limit` `^7.2.0` (`7.5.1` in `server`), Socket.IO `^4.7.5` (`4.8.4`), Mongoose `^8.3.1` (`8.24.8`), and Vite `^5.2.11` on Node 20 + MongoDB 6.0. **Zero new npm runtime dependencies are required** for v6 — production readiness comes from container images, reverse-proxy config, PaaS manifests, native Node 20 primitives, and hardening existing middleware.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js (Debian Slim)** | `node:20-bookworm-slim` (Node 20 LTS) | Backend runtime & multi-stage Docker builder | Matches `.github/workflows/ci.yml` (`node-version: 20`) and `client` `@types/node` (`^20.12.12`). Uses `glibc` instead of Alpine's `musl`, preventing native C++ addon/binary issues (`bcryptjs`, prebuilt binaries, `npm ci` monorepo workspace symlinks) while keeping runtime image size minimal (~80–100 MB compressed). |
| **Nginx** | `nginx:1.27-alpine` | Production SPA static server, API/Socket.IO reverse proxy & TLS termination edge (Docker Compose) | Industry standard for single-origin Docker deployments: serves Vite `dist/` with `try_files $uri $uri/ /index.html` and immutable asset caching, while proxying `/api/` and `/socket.io/` with HTTP/1.1 `Upgrade` headers and `86400s` WebSocket timeouts. |
| **MongoDB** | `mongo:6.0` (Docker) / **MongoDB Atlas M0+** (PaaS) | Primary operational database | Matches `.github/workflows/ci.yml` (`image: mongo:6.0`) and Mongoose `^8.3.1` (`8.24.8`). Supports `mongosh --quiet --eval "db.adminCommand('ping').ok"` Docker healthchecks out of the box (unlike legacy `mongo` shell removed in 6.0). |
| **Helmet** | `^7.1.0` (`7.2.0` installed, existing) | Production security headers (CSP, COOP, HSTS, X-Frame-Options) | Already installed in `server/package.json`, currently disabled (`contentSecurityPolicy: false`). Tuning Helmet v7 directives specifically for Google Identity Services, Geoapify/OSM tiles, Google Fonts, and the inline dark-mode init script locks down XSS without breaking OAuth or maps. |
| **Express + `express-rate-limit`** | `express@^4.19.2` (`4.22.3`) + `^7.2.0` (`7.5.1`) | Reverse-proxy-aware HTTP API, health probes (`/healthz`, `/readyz`), optional `SERVE_CLIENT=true` SPA hosting | Setting `app.set('trust proxy', 1)` (or configurable `TRUST_PROXY_HOPS`) fixes `X-Forwarded-For` client IP resolution behind Render/Railway/Nginx without triggering `express-rate-limit` v7's `ERR_ERL_PERMISSIVE_TRUST_PROXY` error. |
| **Socket.IO** | `^4.7.5` (`4.8.4` installed, existing) | Real-time fleet telemetry & dispatch rooms | Stateful long-lived connections require a persistent Node process (Render/Railway/Docker VPS) and multi-origin CORS matching Express. Supports clean `io.close()` before `server.close()` during `SIGTERM`/`SIGINT`. |

### Supporting Libraries & Built-In Primitives

| Tool / Primitive | Version / Source | Purpose | When to Use |
|------------------|------------------|---------|-------------|
| **Native Node 20 `fetch` + `http`** | Node 20 built-in | Post-deploy smoke test script (`scripts/smoke-test.js`) & SMS webhooks | Use instead of installing `node-fetch`, `axios`, or `wait-on` at root. Native `fetch` validates `/healthz`, `/readyz`, `/api/v1/health`, auth login, and SPA index delivery in zero-dependency CI/post-deploy checks. |
| **Native Node `process.env` validator** | Custom `server/src/config/validateEnv.js` | Fail-fast production environment validation | Use instead of adding `envalid`/`joi`/`zod` just for 15 env vars. Enforces `JWT_SECRET` & `JWT_REFRESH_SECRET` >= 32 chars and non-default, non-localhost `MONGODB_URI`, and non-empty `CLIENT_ORIGIN` (when `SERVE_CLIENT !== 'true'`) at boot when `NODE_ENV === 'production'`. |
| **Node 20 `server.closeIdleConnections()`** | Node `>=18.2.0` built-in | Graceful `SIGTERM`/`SIGINT` shutdown | Drops idle HTTP keep-alive sockets immediately after `io.close()` and `server.close()`, allowing Mongoose `mongoose.connection.close(false)` to flush and exit cleanly well under Render/Docker's 10–30s grace window. |
| **`bcryptjs`** | `^2.4.3` (existing in `server`) | Idempotent first-admin bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`) | Reuse existing `User` model + password hashing hook instead of `seedBhubaneswar.js` (which only seeds `isDemoData: true` records). Safe to run repeatedly in PaaS release/pre-deploy commands or SSH shells. |

### Deployment Platforms & Tooling

| Platform / File | Purpose | Configuration & Rationale |
|-----------------|---------|---------------------------|
| **Docker + Docker Compose v2** (`Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker/nginx.conf`) | Self-hosted VPS, local production parity, & container registries | Multi-stage `Dockerfile` builds `client/dist` (`vite build` with build-arg `VITE_*` vars) and production `server` runtime; Compose wires `nginx` (`:80`) → `app` (`:5004`) → `mongo:6.0` (`:27017` internal) with `depends_on: condition: service_healthy`. |
| **Render Blueprint** (`render.yaml`) | Managed PaaS backend (or `SERVE_CLIENT=true` monolith) | Supports `runtime: node`, persistent WebSockets for Socket.IO, native `healthCheckPath: /readyz`, `generateValue: true` for `JWT_SECRET`/`JWT_REFRESH_SECRET`, and `sync: false` for Atlas `MONGODB_URI` & API keys. |
| **Vercel** (`vercel.json`) | Global CDN hosting for Vite SPA (`client/dist`) | Best used for **split-origin frontend hosting** (`rewrites` fallback to `/index.html` + security headers + immutable `/assets/*` cache). **Do NOT host the Express + Socket.IO backend as Vercel Serverless Functions** — see *What NOT to Use*. |
| **Railway** (optional `railway.toml`) | Alternative persistent-Node PaaS backend | Works cleanly with `Dockerfile` or Railpack (`npm start --workspace=server`) and `healthcheckPath = "/readyz"`, `healthcheckTimeout = 100`. |
| **GitHub Actions** (`.github/workflows/ci.yml`) | Automated test, build & Docker verification | Extend existing `validate-and-test` job (`mongo:6.0` + Node 20) with `docker build` verification (`docker/build-push-action` or `docker build --check`/build) and `SERVE_CLIENT=true` boot/smoke probe. |

---

## Installation

**No new production npm dependencies are needed.** Maintain exact workspace discipline and align Node engine floor to Node 20 LTS:

```bash
# Verify current lockfile integrity in CI / Docker
npm ci

# Production build (client SPA)
npm run build --workspace=client

# Production server start
npm run start --workspace=server
```

*(Recommended `package.json` cleanup, no new packages:)*
- Update `"engines": { "node": ">=20.0.0", "npm": ">=10.0.0" }` in root `package.json` and `server/package.json` to match Node 20 in CI and Docker.
- Remove duplicate root `"express-rate-limit": "^8.7.3"` if unused at root (server explicitly pins `"express-rate-limit": "^7.2.0"` / `7.5.1`).

---

## Single-Origin vs. Split-Origin Compatibility

SmartRoute MUST support two production topologies without code edits between deploys:

### Topology A: Single-Origin (Recommended Default)
Used by **Docker Compose + Nginx** (`:80`) and **Render/Railway Monolith (`SERVE_CLIENT=true`)**.
- Browser loads SPA, `/api/v1/*`, and `/socket.io/*` from the exact same origin (e.g., `https://smartroute.example.com`).
- `client/src/api/client.ts` uses `baseURL: '/api/v1'` and `client/src/utils/socketClient.ts` uses `io('/', { path: '/socket.io', transports: ['polling', 'websocket'] })`.
- Zero cross-origin CORS preflights; cookies/credentials and Google Identity Services work against one authorized JavaScript origin.
- **Note for `SERVE_CLIENT=true`:** Express serves `client/dist` via `express.static` and falls back non-`/api/*` & non-`/socket.io/*` `GET` routes to `client/dist/index.html`, with Helmet CSP applied to HTML responses.
- **Note for Docker + Nginx:** Nginx serves `client/dist` directly (faster static delivery + gzip) and proxies `/api/` and `/socket.io/` to `app:5004`.

### Topology B: Split-Origin (Vercel SPA + Render/Railway API)
Used when hosting `client/dist` on **Vercel** (`https://app.smartroute.com`) and the Node API + Socket.IO server on **Render or Railway** (`https://api.smartroute.com`).
- **Required Client Code Fix (observed gap):** Currently `client/src/api/client.ts` hardcodes `baseURL: '/api/v1'` (line 6) and `axios.post('/api/v1/auth/refresh', ...)` (line 47), and `client/src/utils/socketClient.ts` hardcodes `io('/', ...)` (line 11), ignoring `VITE_API_URL`!
  - Fix: Resolve `API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'` in `apiClient` AND `refreshAccessToken()`.
  - Fix: Resolve `SOCKET_ORIGIN` from `import.meta.env.VITE_SOCKET_URL || (VITE_API_URL ? new URL(VITE_API_URL).origin : '/')` in `createRealtimeSocket()`.
- **Required Server CORS Setting:** `CLIENT_ORIGIN` must accept a **comma-separated list** (e.g., `https://app.smartroute.com,https://preview.smartroute.com`), trimmed and parsed into a `Set` shared by both Express `cors()` (`server/src/app.js`) and Socket.IO `cors` (`server/src/index.js`).
- **Required Vercel Config (`vercel.json`):** Add SPA fallback rewrite `{ "source": "/((?!api/|socket\\.io/|assets/).*)", "destination": "/index.html" }`. You *may* proxy `/api/(.*)` via Vercel rewrites for REST, **never** proxy `/socket.io` through Vercel rewrites — connect `VITE_SOCKET_URL` directly to the Render/Railway origin.

---

## Specific Configuration Specifications

### 1. Multi-Stage `Dockerfile` (`node:20-bookworm-slim`)

Use a 3-stage monorepo-aware build so `npm ci` caches cleanly and `client/dist` is available both for `SERVE_CLIENT=true` monoliths and Nginx static extraction:

- **Stage 1 (`deps`):** `FROM node:20-bookworm-slim` — copy `package.json`, `package-lock.json`, `server/package.json`, `client/package.json`, run `npm ci`.
- **Stage 2 (`client-builder`):** Copy `client/`, pass `ARG VITE_API_URL=/api/v1`, `ARG VITE_SOCKET_URL=`, `ARG VITE_MAP_PROVIDER=geoapify`, `ARG VITE_GEOAPIFY_TILE_API_KEY=`, `ARG VITE_GOOGLE_CLIENT_ID=`, run `npm run build --workspace=client`.
- **Stage 3 (`runtime`):** `FROM node:20-bookworm-slim` — `ENV NODE_ENV=production`, install `curl` or use `node -e "fetch(...)"` for container `HEALTHCHECK`, copy root + `server` manifests and run `npm ci --omit=dev --workspace=server` (or copy pruned `node_modules`), copy `server/src` and `--from=client-builder /app/client/dist ./client/dist` with `--chown=node:node`, switch to `USER node`, `EXPOSE 5004`, `CMD ["node", "server/src/index.js"]`.
- **`.dockerignore`:** Exclude `node_modules`, `*/node_modules`, `.git`, `.env`, `.env.*` (except `.env.example`), `client/dist`, `server/coverage`, `tests`, `scratch`, `.planning`, `stitch_smartroute_fleet_platform`, `*.md` (except README if needed), `*.log`.

### 2. Nginx Reverse Proxy Directives (`nginx:1.27-alpine`)

Required directives in `docker/nginx.conf`:
```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 80;
  server_tokens off;
  client_max_body_size 12m; # Matches Express express.json({ limit: '10mb' })

  # Gzip static JS/CSS/SVG/JSON
  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;

  # Immutable hashed Vite assets
  location /assets/ {
    root /usr/share/nginx/html;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # REST API proxy
  location /api/ {
    proxy_pass http://app:5004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Top-level health probes
  location ~ ^/(healthz|readyz)$ {
    proxy_pass http://app:5004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }

  # Socket.IO polling + WebSocket upgrade
  location /socket.io/ {
    proxy_pass http://app:5004;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
  }

  # SPA history fallback
  location / {
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri $uri/ /index.html;
  }
}
```
*Why `client_max_body_size 12m`?* Express allows `10mb` JSON/CSV payloads; Nginx's default `1m` silently rejects bulk CSV delivery imports with `413 Request Entity Too Large`.

### 3. Express, Helmet v7 & CORS Hardening

Observed external origins in SmartRoute (`client/index.html`, `GoogleSignInButton.tsx`, `InteractiveMap.tsx`, `socketClient.ts`):
- **Google Identity Services:** `https://accounts.google.com` (loads `/gsi/client` script, renders iframe/One Tap, opens OAuth popup).
- **Geoapify & OSM Tiles:** `https://maps.geoapify.com` and `https://tile.openstreetmap.org` (fallback when `VITE_GEOAPIFY_TILE_API_KEY` is absent).
- **Google Fonts:** `https://fonts.googleapis.com` (CSS) and `https://fonts.gstatic.com` (woff2).
- **Inline Theme Init Script:** `client/index.html` lines 10–38 execute an inline IIFE before React mounts (`smartroute-theme`), AND Tailwind/Leaflet/GSAP apply inline styles.

Required Helmet v7 configuration:
```javascript
app.set('trust proxy', env.TRUST_PROXY_HOPS); // Default 1 in production, 0 in dev/test

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Crucial: 'same-origin' breaks Google Sign-In popup window.close / postMessage!
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://maps.geoapify.com',
          'https://*.tile.openstreetmap.org',
          'https://tile.openstreetmap.org',
          'https://lh3.googleusercontent.com', // Google user avatars
        ],
        connectSrc: [
          "'self'",
          'ws:',
          'wss:',
          'https://accounts.google.com',
          'https://api.geoapify.com',
          'https://maps.geoapify.com',
          ...allowedOrigins, // Needed in split-origin mode!
        ],
        frameSrc: ["'self'", 'https://accounts.google.com'],
      },
    },
  })
);
```
*Note on `'unsafe-inline'` in `scriptSrc`:* `client/index.html` contains a static synchronous theme-bootstrap `<script>` to prevent dark-mode FOUC. Either keep `'unsafe-inline'` or compute a deterministic SHA-256 CSP hash (`'sha256-...'`) of that inline snippet during build/startup. Using `same-origin-allow-popups` (or `unsafe-none`) for COOP is mandatory for Google Identity Services popups.

### 4. Health Probes & Graceful Shutdown

- **Liveness (`/healthz`):** Mounted at root in `app.js` (not behind rate-limiters). Returns `200 { status: 'ok', uptimeSeconds }` immediately as long as the Node event loop is alive.
- **Readiness (`/readyz`):** Mounted at root in `app.js` (keep existing `/api/v1/health` and `/api/v1/health/ready` as aliases for backward compatibility). Checks `mongoose.connection.readyState === 1` AND `!isShuttingDown` — returns `200` when ready, `503` during startup, DB disconnect, or `SIGTERM` drain.
- **Shutdown (`SIGTERM`, `SIGINT`):**
  1. Set `isShuttingDown = true` (causes `/readyz` to immediately return `503` so load balancers stop routing new traffic).
  2. Call `io.close()` to terminate active Socket.IO Engine connections cleanly.
  3. Call `server.close()` and `server.closeIdleConnections?.()` (Node 20 built-in) to stop accepting new HTTP requests and drop keep-alive sockets.
  4. `await disconnectDB()` (`mongoose.connection.close(false)`).
  5. Arm a `setTimeout(() => process.exit(1), 10000).unref()` safety timer so containers never hang until `SIGKILL`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node:20-bookworm-slim` | `node:20-alpine` | Use `-alpine` only if image size (<60 MB) is strictly constrained and you add `python3 make g++` for any native builds; `-bookworm-slim` avoids `musl` surprises on `npm ci` monorepo builds. |
| **Nginx (`nginx:1.27-alpine`) in Compose** | **Express `SERVE_CLIENT=true` only** | Use `SERVE_CLIENT=true` for single-container PaaS deploys (Render Web Service, Railway) where there is only one container. Use Nginx in Docker Compose/VPS for superior static caching, gzip, and WebSocket buffering isolation. |
| **Vercel SPA + Render/Railway API** (split) or **Render Monolith** (single) | **Full-stack Vercel Serverless** | Never use Vercel Serverless for SmartRoute's Socket.IO backend unless refactoring rooms to `@socket.io/redis-adapter` + Redis + client state recovery; serverless execution timeouts forcibly drop driver tracking sockets. |
| **Zero-dep `validateEnv.js`** | `envalid` or `zod` | Use `zod` if the API later adds complex nested JSON config files; for flat `process.env` keys, a 45-line zero-dep validator adds zero bundle/audit surface and runs identically in CommonJS `server/`. |

---

## What NOT to Use / Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **PM2 inside Docker containers** | PM2 masks PID 1 `SIGTERM` signals, breaks Docker healthcheck/restart semantics, and forks multiple workers that break Socket.IO sticky sessions without Redis. | Run `CMD ["node", "server/src/index.js"]` directly; scale horizontally only with sticky sessions + Redis adapter if needed later. |
| **`app.set('trust proxy', true)`** | `express-rate-limit` v7 (`7.5.1` installed) throws `ERR_ERL_PERMISSIVE_TRUST_PROXY` because boolean `true` lets attackers spoof `X-Forwarded-For` to bypass login rate limits. | Set `app.set('trust proxy', 1)` (exact hop count, configurable via `TRUST_PROXY_HOPS`). |
| **`nodemon` or `concurrently` in production CMD** | Dev dependencies stripped by `npm prune --omit=dev`; file watchers waste CPU and don't forward `SIGTERM` cleanly. | `node server/src/index.js` (`npm run start --workspace=server`). |
| **`wait-on` / `axios` / `node-fetch` in root for smoke tests** | Unnecessary extra dependencies in a monorepo running Node 20. | Built-in Node 20 global `fetch()` in `scripts/smoke-test.js`. |
| **Automatic demo seeding on production boot** | `seedBhubaneswar.js` creates `isDemoData: true` demo records; running it on boot pollutes live production fleets. | Explicit one-time idempotent `bootstrapAdmin.js` CLI using `BOOTSTRAP_ADMIN_*` env vars. |
| **Default fallback secrets in `NODE_ENV=production`** | `server/src/config/env.js` currently falls back to hardcoded strings (`smartroute_super_secret_jwt_key_2026_bhubaneswar`) and `PORT=5000` (while `.env.example` & CI use `5004`). | Fail-fast `validateEnv()` throwing at startup in production if `JWT_SECRET` / `JWT_REFRESH_SECRET` are missing, `< 32` chars, or equal to dev defaults. |

---

## Version Compatibility

| Package / Runtime | Verified Workspace Version | Compatibility Notes |
|-------------------|---------------------------|---------------------|
| **Node.js** | `20.x` (CI), `>=18.0.0` (package.json) | `server.closeIdleConnections()` requires Node `>=18.2.0`; native `fetch` stable in Node `20`. Pin `20` across Dockerfile, CI, and PaaS (`NODE_VERSION=20`). |
| **Express + `express-rate-limit`** | `express@4.22.3` + `express-rate-limit@7.5.1` (server) | Note root `package.json` has `express-rate-limit@^8.7.3` unused; server uses `7.5.1`. Both enforce strict `trust proxy` validation (`number`, not `true`). |
| **Helmet** | `helmet@7.2.0` | `crossOriginOpenerPolicy` defaults to `same-origin` in v7 — MUST override to `same-origin-allow-popups` or `unsafe-none` for Google Sign-In popups. |
| **Socket.IO (Server & Client)** | Server `4.8.4` (`^4.7.5`), Client `^4.7.5` | Protocol v4 (`EIO=4`) compatible across 4.7.x–4.8.x. Client uses `transports: ['polling', 'websocket']`, so reverse proxies MUST pass `Upgrade` + `Connection` headers AND support HTTP sticky sessions if >1 replica. |
| **Mongoose + MongoDB** | `mongoose@8.24.8` + `mongo:6.0` | `mongoose.connection.close(false)` returns a Promise in Mongoose 8 (no callback argument). Use `mongosh` (not deprecated `mongo`) in Docker healthchecks. |
| **Vite** | `vite@5.2.11` | `VITE_*` variables are baked in at **build time** (`npm run build --workspace=client`), NOT runtime! Docker `Dockerfile` MUST accept `ARG VITE_*` before `vite build`, and split-origin PaaS hosts must define `VITE_API_URL` / `VITE_SOCKET_URL` in build env. |

---

## Sources

- **Local Workspace Verified Files:** `package.json`, `server/package.json`, `client/package.json`, `server/src/app.js`, `server/src/index.js`, `server/src/config/env.js`, `server/src/config/db.js`, `server/src/routes/index.js`, `server/src/seed/seedBhubaneswar.js`, `client/index.html`, `client/vite.config.ts`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/src/components/auth/GoogleSignInButton.tsx`, `client/src/components/maps/InteractiveMap.tsx`, `.github/workflows/ci.yml` — **HIGH confidence** (directly observed).
- **Web Search (Cross-Checked Docs):**
  - Helmet v7 + Google Identity Services CSP/COOP (`accounts.google.com`, `crossOriginOpenerPolicy`) — **MEDIUM confidence**
  - Socket.IO + Nginx reverse proxy (`Upgrade`, `Connection`, `proxy_read_timeout 86400s`) — **MEDIUM confidence**
  - Express `express-rate-limit` v7 `ERR_ERL_PERMISSIVE_TRUST_PROXY` (`trust proxy` hop count) — **MEDIUM confidence**
  - `node:20-bookworm-slim` vs `node:20-alpine` multi-stage npm workspace Docker patterns — **MEDIUM confidence**
  - Render `render.yaml` Blueprint spec, Railway `railway.toml`, and Vercel `vercel.json` SPA rewrites & WebSocket limitations — **MEDIUM confidence**
  - Express + Socket.IO `io.close()` + `server.close()` + Mongoose 8 `connection.close()` graceful shutdown — **MEDIUM confidence**

---
*Stack research for: SmartRoute v6 Deployment & Production Readiness*
*Researched: 2026-11-11*
