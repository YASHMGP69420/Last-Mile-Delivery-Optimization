# Architecture Research

**Domain:** Production Deployment, Containerization, Reverse-Proxy Routing & PaaS Integration for SmartRoute (npm Workspaces Monorepo: Vite React SPA + Express/Socket.IO/MongoDB)
**Researched:** 2026-11-11
**Confidence:** HIGH (codebase verified directly; official Helmet v7, Google Identity Services, Render Blueprint, and Vercel rewrite docs verified via web search)

---

## Standard Architecture

### System Overview

SmartRoute operates under a **Platform-Agnostic Single-Origin Primary** topology (with an optional **Split-Origin** PaaS variant). In the primary topology, all browser traffic (`/`, `/assets/*`, `/api/v1/*`, `/socket.io/*`) shares one origin, eliminating cross-origin cookie/CORS friction and WebSocket proxy drops.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT TOPOLOGY OPTIONS                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [1] PRIMARY: Single-Origin (Docker Compose / VPS / Render / Railway)        │
│                                                                              │
│  Browser / Driver Handheld                                                   │
│     │  HTTPS :443 (or HTTP :8080 local Compose)                              │
│     ▼                                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Reverse Proxy (Nginx in Docker Compose OR PaaS Edge TLS Terminator)    │  │
│  │  • /healthz, /readyz  ──▶ Express liveness/readiness (no rate limit)   │  │
│  │  • /api/v1/*          ──▶ Express API (X-Forwarded-For, keepalive)     │  │
│  │  • /socket.io/*       ──▶ Express HTTP/1.1 Upgrade: websocket          │  │
│  │  • / & /assets/*      ──▶ Nginx static dist/ OR Express (SERVE_CLIENT) │  │
│  └─────────────────────────────────┬──────────────────────────────────────┘  │
│                                    │ HTTP :5004 (internal network)           │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Node.js 20 Alpine App Container (server/src/index.js)                  │  │
│  │  • Express 4 (trust proxy=1, Helmet CSP+COOP, multi-origin CORS)       │  │
│  │  • Socket.IO 4 (path: /socket.io, JWT handshake auth)                  │  │
│  │  • Optional Static SPA + History Fallback (when SERVE_CLIENT=true)     │  │
│  └─────────────────────────────────┬──────────────────────────────────────┘  │
│                                    │ Mongoose 8 (TLS / SRV in Atlas)         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ MongoDB 6.0 (Docker Compose service w/ volume OR MongoDB Atlas M0/M10) │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [2] OPTIONAL: Split-Origin (Vercel Static Edge + Render Node Web Service)   │
│                                                                              │
│  Browser ──▶ Vercel Edge (client/dist + vercel.json SPA rewrites)            │
│     │                                                                        │
│     ├── REST /api/v1/*  ──▶ Direct HTTPS to Render (VITE_API_URL)            │
│     │                       [or Vercel rewrite HTTP proxy; no WS support]    │
│     └── Socket.IO       ──▶ Direct WSS to Render (VITE_SOCKET_URL)           │
│                             (Vercel Edge rewrites do NOT proxy WebSockets)   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Concrete Implementation |
|-----------|----------------|-------------------------|
| **Edge / Reverse Proxy (`nginx/nginx.conf` or PaaS Edge)** | TLS termination, `X-Forwarded-*` headers, HTTP/1.1 WebSocket upgrade for `/socket.io/`, gzip/Brotli compression, immutable cache headers for `/assets/*` | Nginx `1.27-alpine` in Docker Compose; Render/Railway native edge proxy in PaaS single-origin |
| **Static SPA Delivery** | Serve `client/dist` (`index.html`, hashed `/assets/*`, `/favicon.svg`) and SPA history fallback for React `BrowserRouter` routes (`/admin/*`, `/driver/*`, `/login`) | Two mutually compatible modes: (1) Nginx `try_files` + `alias` in Docker Compose; (2) Express `express.static` + fallback when `SERVE_CLIENT=true` in PaaS single-container deploy; (3) Vercel CDN in split-origin |
| **Express HTTP Gateway (`server/src/app.js`)** | `trust proxy`, Helmet CSP + COOP, comma-separated multi-origin CORS, JSON body parsing, rate limiting, `/healthz` + `/readyz`, `/api/v1` router, API 404 isolation | `express` 4.19 + `helmet` 7.1 + `cors` 2.8 + `express-rate-limit` 7.2 |
| **Socket.IO Gateway (`server/src/index.js`)** | Real-time tracking/dispatch rooms (`management`, `driver:<id>`, `route:<id>`) at `path: '/socket.io'` sharing HTTP server port | `socket.io` 4.7 attached to `http.createServer(app)`, sharing unified CORS origin validator |
| **Env & Runtime Guard (`server/src/config/env.js`)** | Parse config, validate fail-fast secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`) in `NODE_ENV=production`, parse `CLIENT_ORIGIN` list & `SERVE_CLIENT` | CommonJS config module loaded before `app` / `index` bind ports |
| **Lifecycle Manager (`server/src/index.js`)** | Ordered startup (`connectDB()` → `server.listen()`), graceful `SIGTERM`/`SIGINT` drain (`io.close()` → `server.close()` → `disconnectDB()`) | Process signal handlers with forced-exit safety timer (10s) |
| **MongoDB Store (`server/src/config/db.js`)** | Primary persistence across 19 Mongoose models + connection readiness state (`mongoose.connection.readyState === 1`) | MongoDB 6.0 container with persistent volume (`mongo_data`) or MongoDB Atlas |
| **Admin Bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`)** | Idempotent creation of initial `ADMIN` user (`isDemoData: false`) completely decoupled from `demoDataService` | Standalone CLI (`npm run bootstrap:admin`) reading `BOOTSTRAP_ADMIN_*` env vars |

---

## Recommended Project Structure

Files marked **[NEW]** are introduced for v6 deployment; files marked **[MODIFIED]** require targeted changes at integration boundaries without altering business/dispatch logic.

```
Last Mile Delivery Optimization/
├── .dockerignore                             # [NEW] Exclude node_modules, .env, .git, tests, .planning, client/dist
├── Dockerfile                                # [NEW] Multi-stage monorepo build (deps → client-build → prod-deps → runtime)
├── docker-compose.yml                        # [NEW] Orchestrates mongo:6.0 + app + nginx:1.27-alpine w/ healthchecks
├── render.yaml                               # [NEW] Single-origin Render Blueprint (web service, healthCheckPath: /readyz)
├── vercel.json                               # [NEW] Optional split-origin Vercel SPA + API rewrite config
├── .env.example                              # [MODIFIED] Audited unified dev/prod env template
├── README.md                                 # [MODIFIED] Complete setup, architecture, Docker & PaaS deployment runbook
├── package.json                              # [MODIFIED] Add start, build, bootstrap:admin, smoke scripts
├── .github/
│   └── workflows/
│       └── ci.yml                            # [MODIFIED] Add Docker image build + server env/health sanity check
├── nginx/
│   └── nginx.conf                            # [NEW] Reverse proxy for /api/v1, /socket.io (WS upgrade), /healthz, SPA dist
├── scripts/
│   └── smoke-deploy.mjs (or .js)             # [NEW] Post-deploy HTTP + DB readiness + Auth + Socket.IO smoke verifier
├── client/
│   ├── .env.example                          # [MODIFIED] Document optional VITE_API_URL / VITE_SOCKET_URL for split-origin
│   ├── vite.config.ts                        # [UNCHANGED] Keep dev proxy; optional manualChunks if desired later
│   └── src/
│       ├── api/
│       │   └── client.ts                     # [MODIFIED] Read import.meta.env.VITE_API_URL with '/api/v1' default
│       └── utils/
│           └── socketClient.ts               # [MODIFIED] Read import.meta.env.VITE_SOCKET_URL / derived origin with '/' default
└── server/
    ├── .env.example                          # [MODIFIED] Audited server-only production env template
    ├── package.json                          # [MODIFIED] Add bootstrap:admin script
    └── src/
        ├── app.js                            # [MODIFIED] trust proxy, CSP+COOP, unified CORS, /healthz+/readyz, SERVE_CLIENT SPA fallback
        ├── index.js                          # [MODIFIED] Unified CORS, SIGTERM/SIGINT graceful shutdown
        ├── config/
        │   ├── env.js                        # [MODIFIED] Multi-origin CLIENT_ORIGIN parser, SERVE_CLIENT, TRUST_PROXY, fail-fast prod check
        │   └── cors.js                       # [NEW] Single shared CORS origin validator for Express & Socket.IO
        ├── routes/
        │   └── index.js                      # [UNCHANGED] Preserves /api/v1/health & /api/v1/health/ready
        └── scripts/
            └── bootstrapAdmin.js             # [NEW] Idempotent first-ADMIN bootstrapper (never sets isDemoData: true)
```

### Structure Rationale

- **Root `Dockerfile` + `.dockerignore`:** Because this is an `npm` workspaces monorepo (`package.json` defines `"workspaces": ["server", "client"]` and holds shared root dependencies + a unified `package-lock.json`), Docker build context **must** be the repository root so `npm ci` resolves workspace links deterministically.
- **Dedicated `server/src/config/cors.js`:** Currently `allowedOrigins` is duplicated verbatim in `server/src/app.js` (lines 20–26) and `server/src/index.js` (lines 12–18). Extracting a single helper prevents Express REST and Socket.IO handshake CORS from drifting.
- **Root-level `/healthz` and `/readyz` alongside `/api/v1/health*`:** Kubernetes, Render, Railway, and Docker `HEALTHCHECK` probes conventionally hit root `/healthz` (liveness) and `/readyz` (DB readiness) without an `/api/v1` prefix, while existing Jest tests and internal tools continue hitting `/api/v1/health` and `/api/v1/health/ready` untouched.

---

## Architectural Patterns

### Pattern 1: SPA History Fallback vs. API 404 Separation (`SERVE_CLIENT=true`)

**What:** When Express serves `client/dist` directly (`SERVE_CLIENT=true`, used in single-container PaaS like Render/Railway), Express must serve static assets and fall back to `index.html` for React Router deep links (`/admin/control-center`, `/driver/route`, `/login`), **without ever swallowing unknown `/api/*`, `/socket.io/*`, `/healthz`, or missing static asset files (`.js`, `.css`, `.png`) into `index.html`**.
**When to use:** Single-origin PaaS deployments (`render.yaml`) or running the production container standalone without Nginx.
**Trade-offs:** Slightly higher Node.js static file I/O compared to Nginx/CDN, completely mitigated by immutable cache headers on `/assets/*` and negligible at <10k fleet users.

**Exact Middleware Ordering in `server/src/app.js`:**
```javascript
// 1. Trust reverse proxy headers BEFORE rate limiters
app.set('trust proxy', env.TRUST_PROXY);

// 2. Security headers (Helmet CSP + COOP) + CORS + Body Parsers + Logging
// ...

// 3. Liveness & Readiness Probes (BEFORE rate limiters & SPA fallback)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});

app.get('/readyz', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: ready ? 'connected' : 'disconnected',
  });
});

// 4. API Rate Limiter & API v1 Router
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1', routes);

// 5. Strict API 404 Boundary (ANY /api/* path not matched above returns JSON 404, NEVER index.html)
app.use('/api', notFoundHandler);

// 6. Optional SPA Static Serving & History Fallback
if (env.SERVE_CLIENT) {
  const clientDistPath = path.resolve(__dirname, '../../../client/dist');
  // Immutable caching for Vite hashed assets; no-cache for index.html
  app.use(
    '/assets',
    express.static(path.join(clientDistPath, 'assets'), { maxAge: '1y', immutable: true })
  );
  app.use(
    express.static(clientDistPath, {
      index: false, // Controlled explicitly by fallback below with Cache-Control: no-cache
      maxAge: '1h',
    })
  );

  // SPA History Fallback: ONLY GET/HEAD HTML navigation requests outside /api and /socket.io
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    // Missing asset extension (e.g. /assets/missing.js) should 404, not return HTML with MIME error
    if (path.extname(req.path)) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 7. Catch-all 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);
```

### Pattern 2: Nginx Reverse Proxy Routing (Docker Compose Single-Origin)

**What:** In `docker-compose.yml`, Nginx fronts the Node.js container on port `80` (mapped to host `8080:80`). Nginx serves `client/dist` directly (baked into a shared volume or copied into the Nginx image stage, OR proxied to Express) while proxying `/api/v1`, `/socket.io`, `/healthz`, and `/readyz` to `http://app:5004`.
**Recommendation:** Copy `client/dist` into the Nginx image (or share via build stage in `nginx/Dockerfile` or serve via Nginx volume / proxy to Express with `SERVE_CLIENT=true`). Actually, **two clean choices** exist in Docker Compose:
- **Choice A (Recommended):** Build `client/dist` inside the multi-stage `Dockerfile` (so the `app` image is self-contained for PaaS too with `SERVE_CLIENT=true`), and in Docker Compose **either** set `SERVE_CLIENT=false` + mount/copy `client/dist` into `nginx`, **or** keep Nginx as pure reverse-proxy (`proxy_pass http://smartroute_app`) with `SERVE_CLIENT=true` in `app`. Setting `SERVE_CLIENT=true` on `app` and letting Nginx handle TLS/compression/WebSocket buffering/static caching (or serving `client/dist` from Nginx if built via a targeted `nginx` Dockerfile) avoids dual-build drift. Even cleaner: Nginx proxies `/api/`, `/socket.io/`, `/healthz`, `/readyz`, and `/` directly to `app:5004` (with `SERVE_CLIENT=true`) **or** Nginx serves `client/dist` directly if `nginx` uses a `Dockerfile` `COPY --from=client-builder`. Wait: using stock `nginx:1.27-alpine` image in `docker-compose.yml` requires zero extra Dockerfile if `app` runs `SERVE_CLIENT=true` and Nginx proxies all routes with WebSocket support + `proxy_buffering off` for `/socket.io/`! Alternatively, if Nginx serves static assets directly, a 4-line `nginx/Dockerfile` copies `client/dist` from the builder stage. The **single-image `app` + stock `nginx:1.27-alpine` reverse-proxy** pattern is simpler to maintain and guarantees identical runtime behavior between Docker Compose and Render/Railway (`SERVE_CLIENT=true`).

**Critical Nginx Directives for Socket.IO + Express:**
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream smartroute_backend {
    server app:5004;
    keepalive 32;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 12m; # Matches Express 10mb JSON/CSV limit with header headroom

    # Liveness & readiness probes (pass straight through)
    location ~ ^/(healthz|readyz)$ {
        proxy_pass http://smartroute_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket + Engine.IO HTTP long-polling
    location /socket.io/ {
        proxy_pass http://smartroute_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # REST API v1
    location /api/ {
        proxy_pass http://smartroute_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA & Static Assets (served by Express SERVE_CLIENT=true or Nginx try_files)
    location / {
        proxy_pass http://smartroute_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*Note on `/api/` vs `/api` in Nginx:* If Express serves `SERVE_CLIENT=true`, having Express also guard `app.use('/api', notFoundHandler)` guarantees that even a bare `/api` request without trailing slash never hits the SPA fallback.

### Pattern 3: Helmet CSP & COOP Tuned for SmartRoute Integrations

**What:** Currently `server/src/app.js` disables CSP (`contentSecurityPolicy: false`). Enabling Helmet v7 CSP requires explicit allowances for every external origin observed in `client/index.html`, `GoogleSignInButton.tsx`, and `InteractiveMap.tsx`, **plus** overriding Helmet's default `Cross-Origin-Opener-Policy: same-origin` (which breaks Google Sign-In popup `window.postMessage` / `window.closed`).

**Verified Directives Required by SmartRoute Client:**

| Directive | Allowed Sources | Codebase Evidence |
|-----------|----------------|-------------------|
| `defaultSrc` | `'self'` | Baseline self-origin |
| `scriptSrc` | `'self'`, `'unsafe-inline'`, `https://accounts.google.com/gsi/client` | `client/index.html` L10–38 has inline theme `<script>`; `GoogleSignInButton.tsx` L37 injects GIS script |
| `styleSrc` | `'self'`, `'unsafe-inline'`, `https://fonts.googleapis.com`, `https://accounts.google.com/gsi/style` | Tailwind/Leaflet inline styles + `client/index.html` L42 Google Fonts CSS + GIS button stylesheet |
| `fontSrc` | `'self'`, `data:`, `https://fonts.gstatic.com` | `client/index.html` L40 Inter & JetBrains Mono fonts |
| `imgSrc` | `'self'`, `data:`, `blob:`, `https://maps.geoapify.com`, `https://*.tile.openstreetmap.org`, `https://*.basemaps.cartocdn.com`, `https://lh3.googleusercontent.com` | `InteractiveMap.tsx` L193–197 (Geoapify + OSM `a/b/c` subdomains) + CARTO fallback + Google OAuth `avatarUrl` + Leaflet data-URI/blob layers |
| `connectSrc` | `'self'`, `ws:`, `wss:`, `https://accounts.google.com/gsi/`, `https://maps.geoapify.com`, `https://*.tile.openstreetmap.org`, `https://*.basemaps.cartocdn.com`, plus any configured split-origin API/Socket URLs | Socket.IO polling+WS upgrade, GIS token exchange, tile/map requests |
| `frameSrc` | `'self'`, `https://accounts.google.com/gsi/` | Google Identity Services One-Tap / Sign-In iframe (`GoogleSignInButton.tsx`) |
| `formAction` | `'self'` | Standard form protection |
| `objectSrc` | `'none'` | Block Flash/legacy objects |
| `upgradeInsecureRequests` | `null` when serving plain HTTP (e.g., local Docker Compose `http://localhost:8080`), enabled (`[]`) only when `FORCE_HTTPS_CSP=true` | Prevents Helmet v7 from breaking local HTTP Docker Compose verification by forcing `https://localhost:8080` asset upgrades |
| `crossOriginOpenerPolicy` | `{ policy: 'same-origin-allow-popups' }` | Required by Google Identity Services popup/cross-window `postMessage` |
| `crossOriginResourcePolicy` | `false` (or `{ policy: 'cross-origin' }`) | Preserves existing `app.js` L14 setting so split-origin API responses/avatars aren't blocked |

### Pattern 4: Multi-Stage Monorepo `Dockerfile` (npm Workspaces)

**What:** Builds `client/dist` in a builder stage and ships a lean `node:20-alpine` runtime image with only production dependencies (`npm ci --omit=dev --workspace=server --include-workspace-root`), non-root user (`node`), and `dumb-init`/native signal forwarding (`CMD ["node", "server/src/index.js"]` — never `npm start` as PID 1, because `npm` swallows `SIGTERM`!).

**Stage Architecture:**
```
Stage 1: deps-base (node:20-alpine)
  COPY package.json package-lock.json ./
  COPY server/package.json ./server/
  COPY client/package.json ./client/
  RUN npm ci

Stage 2: client-builder (FROM deps-base)
  ARG VITE_API_URL=/api/v1
  ARG VITE_SOCKET_URL=
  ARG VITE_MAP_PROVIDER=geoapify
  ARG VITE_GEOAPIFY_TILE_API_KEY=
  ARG VITE_GOOGLE_CLIENT_ID=
  COPY client/ ./client/
  RUN npm run build --workspace=client   # outputs /app/client/dist

Stage 3: prod-deps (node:20-alpine)
  COPY package.json package-lock.json ./
  COPY server/package.json ./server/
  COPY client/package.json ./client/
  RUN npm ci --omit=dev --workspace=server --include-workspace-root && npm cache clean --force

Stage 4: runtime (node:20-alpine)
  ENV NODE_ENV=production PORT=5004 SERVE_CLIENT=true
  WORKDIR /app
  COPY --from=prod-deps /app/node_modules ./node_modules
  COPY --from=prod-deps /app/package.json ./package.json
  COPY server/package.json ./server/package.json
  COPY server/src ./server/src
  COPY --from=client-builder /app/client/dist ./client/dist
  USER node
  EXPOSE 5004
  HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5004)+'/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  CMD ["node", "server/src/index.js"]
```

**Why `client/.env` / `.env` must be in `.dockerignore`:** Vite automatically loads `.env` files inside `client/` during `vite build`. Ignoring `.env` and `.env.*` (except `.env.example`) in `.dockerignore` ensures local developer keys never bake into production Docker images.

### Pattern 5: Admin Bootstrap Separation from Demo Data

**What:** Public registration (`POST /api/v1/auth/register`) and Google OAuth (`POST /api/v1/auth/google`) strictly assign `ROLES.DRIVER` (`server/src/controllers/authController.js` L492, L578). `seedBhubaneswar.js` only calls `demoDataService.importDemoDataset()`, which creates `isDemoData: true` records (`demo.manager@smartroute.local`, `demo.driver1..3@smartroute.local`) and intentionally creates **zero** `ADMIN` accounts.
**Solution:** Create `server/src/scripts/bootstrapAdmin.js`:
1. Reads `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (min 12 chars in prod), `BOOTSTRAP_ADMIN_NAME` (default `'SmartRoute Platform Admin'`), and optional `BOOTSTRAP_ADMIN_PHONE`.
2. Connects via `connectDB()`.
3. Checks `User.findOne({ email })` OR existing `User.countDocuments({ role: ROLES.ADMIN, isDemoData: { $ne: true } })`:
   - If target admin email already exists (with `isDemoData: false`): idempotent no-op (logs `"Admin user already exists, skipping"`, exits `0`) — never overwrites an existing admin's password silently unless `--reset-password` flag is explicitly passed.
   - If email exists as `isDemoData: true`: fails fast with exit code `1` to prevent colliding with demo records.
   - Otherwise creates `User` with `role: ROLES.ADMIN`, `isDemoData: false`, `emailVerified: true`, `active: true`, `accountStatus: 'ACTIVE'`.
4. Never imports `demoDataService` or `seedBhubaneswar.js`. Production deploys start with **0 demo records** and 1 real `ADMIN` who can provision `FLEET_MANAGER` / `DRIVER` accounts or optionally load/purge demo data from the Admin Control Center UI.

---

## Data & Request Flow

### Production Request & Upgrade Flow (Single-Origin vs. Split-Origin)

```
1. Initial Document Load (GET /admin/control-center)
   Single-Origin:
     Browser ──▶ Reverse Proxy ──▶ Express SERVE_CLIENT fallback ──▶ client/dist/index.html (no-cache)
     Browser ──▶ /assets/index-*.js (Cache-Control: public, max-age=31536000, immutable)
   Split-Origin (Vercel):
     Browser ──▶ Vercel Edge ──▶ vercel.json rewrite "/(.*)" -> "/index.html"

2. REST API Call (POST /api/v1/auth/login)
   Single-Origin:
     Browser (baseURL='/api/v1') ──▶ Proxy ──▶ Express /api/v1 ──▶ MongoDB
     (Client IP preserved via app.set('trust proxy', 1) for express-rate-limit!)
   Split-Origin:
     Browser (VITE_API_URL='https://api.smartroute.onrender.com/api/v1') ──▶ Render Express
     (CORS checked against comma-separated CLIENT_ORIGIN env var)

3. API 404 Protection (GET /api/v1/nonexistent or GET /api/unknown)
   Browser ──▶ Express /api/* ──▶ notFoundHandler ──▶ 404 JSON { code: 'ENDPOINT_NOT_FOUND' }
   (NEVER falls through to client/dist/index.html)

4. Socket.IO Real-Time Tracking (/socket.io/)
   Browser (polling -> websocket upgrade)
     ──▶ Nginx (Upgrade + Connection headers, buffering off) OR direct WSS to Render
     ──▶ Express HTTP Server ──▶ io.use(socketAuthMiddleware) ──▶ Room join
```

### Graceful Shutdown Flow (`SIGTERM` / `SIGINT`)

```
PaaS / Docker sends SIGTERM
   │
   ▼
1. Set shuttingDown flag (optional /readyz -> 503 immediately so LB stops new traffic)
2. io.close() — disconnect Socket.IO clients cleanly
3. server.close() — stop accepting new HTTP connections, finish in-flight requests
4. await disconnectDB() — close Mongoose connection pool cleanly
5. process.exit(0) (guarded by unref()'d 10s force-exit timeout)
```

---

## Split-Origin (Vercel + Render) Integration Gap Found in Codebase

Inspecting `client/src/api/client.ts` and `client/src/utils/socketClient.ts` revealed a critical current gap:
- `client/src/api/client.ts` (L6, L47, L190) hardcodes `baseURL: '/api/v1'`, `axios.post('/api/v1/auth/refresh', ...)`, and `/api/v1/batches/${id}/export`. It **ignores** `import.meta.env.VITE_API_URL` (even though `client/.env.example` and `.github/workflows/ci.yml` already define `VITE_API_URL`)!
- `client/src/utils/socketClient.ts` (L11) hardcodes `io('/', { path: '/socket.io', ... })`, ignoring `VITE_API_URL` / `VITE_SOCKET_URL`.
- **Impact on Split-Origin (Vercel + Render):**
  - If `client.ts` and `socketClient.ts` are NOT updated to honor `VITE_API_URL` / `VITE_SOCKET_URL`, Vercel must rely on `vercel.json` rewrites to proxy `/api/v1/:path*` to Render. However, **Vercel Edge rewrites do NOT proxy persistent WebSocket (`Upgrade: websocket`) tunnels**, forcing Socket.IO to remain stuck on HTTP long-polling (higher latency, extra serverless/edge hops, sticky-session issues).
  - **Recommended Design:** Update `client.ts` to use `(import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '')` (for `baseURL`, `/auth/refresh`, and `exportCsvUrl`), and update `socketClient.ts` to derive the Socket.IO origin from `import.meta.env.VITE_SOCKET_URL` or `new URL(import.meta.env.VITE_API_URL).origin` when `VITE_API_URL` is an absolute `http(s)://` URL, falling back to `'/'` for single-origin deployments. Keep `vercel.json` with SPA rewrite `/(.*) -> /index.html` (plus optional `/api/v1/(.*)` rewrite only if `VITE_API_URL` is unset).

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–1k users (1 hub, 1–50 drivers)** | Single Node.js container (`SERVE_CLIENT=true` or Nginx + 1 app container) + MongoDB Atlas M0/M10 or Docker MongoDB 6.0. Current in-memory `tokenBlacklist` and `matrixCache` are acceptable for a single instance. |
| **1k–100k users (multi-hub, 50–500 drivers)** | Enable horizontal Node.js replicas behind Nginx/PaaS load balancer by adding `@socket.io/redis-adapter` + Redis-backed `tokenBlacklist`/`matrixCache` (currently process-local per `.planning/codebase/CONCERNS.md`), and offload 2-Opt optimization to `worker_threads` or a queue. Add MongoDB TTL index on `TelemetryPing.createdAt`. |
| **100k+ users** | Separate static CDN (Vercel/CloudFront) + auto-scaled API cluster + dedicated optimization worker service + MongoDB sharded cluster / Time Series telemetry collection. |

---

## Anti-Patterns

### Anti-Pattern 1: `npm start` as Container Entrypoint (`PID 1`)
- **What people do:** `CMD ["npm", "start"]` in `Dockerfile`.
- **Why it's wrong:** `npm` does not reliably forward `SIGTERM` to child `node` processes in Alpine Linux, causing Docker/Render to wait 10–30s and send `SIGKILL` (dropping active Socket.IO shifts and Mongoose writes).
- **Do this instead:** `CMD ["node", "server/src/index.js"]` with explicit `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)` handlers.

### Anti-Pattern 2: Unconditional SPA Catch-All Swallowing `/api/*` 404s
- **What people do:** Place `app.get('*', (_, res) => res.sendFile('index.html'))` without scoping `/api` 404s first or checking `req.path.startsWith('/api')`.
- **Why it's wrong:** Typos or deprecated API routes return `200 OK` with HTML instead of `404` JSON (`ENDPOINT_NOT_FOUND`), breaking Axios error handling (`SyntaxError: Unexpected token '<'`) and hiding API misconfigurations.
- **Do this instead:** Mount `app.use('/api', notFoundHandler)` immediately after `app.use('/api/v1', routes)` and before the `SERVE_CLIENT` static/SPA middleware.

### Anti-Pattern 3: Hardcoded Dev Fallbacks Active in `NODE_ENV=production`
- **What people do:** Keep `JWT_SECRET: process.env.JWT_SECRET || 'smartroute_super_secret_...'` active in production (`server/src/config/env.js` L20–24).
- **Why it's wrong:** A misconfigured deployment silently signs production admin JWTs with a publicly committed Git secret!
- **Do this instead:** Fail fast (`process.exit(1)` / `throw`) at startup if `NODE_ENV === 'production'` and `JWT_SECRET`, `JWT_REFRESH_SECRET` (<32 chars or matching dev defaults), or `MONGODB_URI` are missing/default.

### Anti-Pattern 4: Missing `trust proxy` with `express-rate-limit`
- **What people do:** Deploy Express behind Nginx/Render/Railway without `app.set('trust proxy', 1)`.
- **Why it's wrong:** `express-rate-limit` v7 throws `ValidationError: ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` when `X-Forwarded-For` is present while `trust proxy` is `false`, or buckets every user in the fleet under the proxy's single IP (locking out all drivers after 30 login attempts).
- **Do this instead:** Set `app.set('trust proxy', env.TRUST_PROXY)` (default `1` in production/proxy environments, `0` when exposed directly).

### Anti-Pattern 5: Coupling Admin Account Creation to Demo Seeders
- **What people do:** Re-enable hardcoded admin passwords in `seedBhubaneswar.js` so production has an admin login.
- **Why it's wrong:** Pollutes production DB with Bhubaneswar demo deliveries/vehicles or ships known default passwords.
- **Do this instead:** Keep `seedBhubaneswar.js` strictly for `isDemoData: true` datasets and provide a separate idempotent `bootstrapAdmin.js` reading `BOOTSTRAP_ADMIN_*` env vars.

---

## Integration Points

### External Services

| Service | Integration Pattern | Deployment & CSP Gotchas |
|---------|---------------------|--------------------------|
| **MongoDB 6.0 / Atlas** | `mongoose.connect(env.MONGODB_URI)` in `server/src/config/db.js` | Docker Compose uses `mongodb://mongo:27017/smartroute` with `mongo:6.0` `mongosh` healthcheck; Atlas uses `mongodb+srv://...` (enable `0.0.0.0/0` or PaaS egress IPs) |
| **Geoapify** | Server: `api.geoapify.com/v1/*` (`GEOAPIFY_SERVER_API_KEY`); Client: `maps.geoapify.com/v1/tile/*` (`VITE_GEOAPIFY_TILE_API_KEY`) | Client tile key is **build-time** in Vite (`ARG VITE_GEOAPIFY_TILE_API_KEY` in Dockerfile); falls back cleanly to OSM tiles + simulated Bhubaneswar traffic matrix if absent. Requires `img-src` & `connect-src` for `https://maps.geoapify.com` |
| **OSM / CARTO Tiles** | Fallback Leaflet `TileLayer` (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) | Requires `https://*.tile.openstreetmap.org` (and `https://*.basemaps.cartocdn.com` if used) in CSP `img-src` and `connect-src` |
| **Google Identity Services (OAuth)** | Client loads `https://accounts.google.com/gsi/client` (`VITE_GOOGLE_CLIENT_ID`); Server verifies ID token via `google-auth-library` (`GOOGLE_CLIENT_ID`) | Both env vars must share the same OAuth Web Client ID; Authorized JavaScript Origins in Google Cloud Console must include exact deployed origin (`https://...`); Helmet requires `COOP: same-origin-allow-popups` + CSP `script-src`/`frame-src`/`connect-src` for `https://accounts.google.com/gsi/` |
| **Google Fonts** | `client/index.html` loads `fonts.googleapis.com` & `fonts.gstatic.com` | Requires CSP `style-src` + `font-src` allowances |
| **SMTP / Twilio / Fast2SMS** | Optional out-of-band OTP channels (`server/src/services/otpDeliveryService.js`) | Outbound server-only TCP/HTTPS; no CSP impact |

### Internal Boundaries (New vs. Modified Files Matrix)

| File | Status | Responsibility at Deployment Boundary |
|------|--------|---------------------------------------|
| `server/src/config/env.js` | **MODIFIED** | Parse `SERVE_CLIENT`, `TRUST_PROXY`, `CLIENT_ORIGINS` (comma-separated from `CLIENT_ORIGIN`), `FORCE_HTTPS_CSP`; fail-fast validation in `NODE_ENV=production` |
| `server/src/config/cors.js` | **NEW** | Shared `buildAllowedOrigins()` + `isOriginAllowed()` callback used identically by Express `cors()` and Socket.IO `Server` |
| `server/src/app.js` | **MODIFIED** | `app.set('trust proxy', ...)`, tuned Helmet CSP + `same-origin-allow-popups`, `/healthz` + `/readyz` probes, `app.use('/api', notFoundHandler)`, conditional `SERVE_CLIENT=true` static + SPA fallback |
| `server/src/index.js` | **MODIFIED** | Use shared `cors.js`, track shutting-down state, graceful `SIGTERM`/`SIGINT` cleanup (`io.close` → `server.close` → `disconnectDB`) |
| `server/src/scripts/bootstrapAdmin.js` | **NEW** | Idempotent first-`ADMIN` creation from `BOOTSTRAP_ADMIN_*` env vars (`isDemoData: false`) |
| `client/src/api/client.ts` | **MODIFIED** | Honor `VITE_API_URL` for Axios `baseURL`, `/auth/refresh`, and `exportCsvUrl` (default `/api/v1` for single-origin) |
| `client/src/utils/socketClient.ts` | **MODIFIED** | Honor `VITE_SOCKET_URL` or `new URL(VITE_API_URL).origin` (default `'/'` for single-origin) |
| `Dockerfile` & `.dockerignore` | **NEW** | Multi-stage npm workspaces build producing non-root `node:20-alpine` image with `client/dist` + `server/src` |
| `nginx/nginx.conf` & `docker-compose.yml` | **NEW** | Local/VPS single-origin stack (`mongo:6.0` + `app` + `nginx:1.27-alpine`) with healthchecks & persistent volume |
| `render.yaml` & `vercel.json` | **NEW** | Declarative PaaS Blueprints (`render.yaml` primary single-origin `SERVE_CLIENT=true`; `vercel.json` optional split-origin SPA) |
| `.github/workflows/ci.yml` | **MODIFIED** | Keep existing Jest + `tsc` + Vite build, add Docker multi-stage build verification (`docker build .`) |
| `scripts/smoke-deploy.js` | **NEW** | Post-deploy verification: `/healthz`, `/readyz`, SPA HTML check, API 404 JSON check, login/auth roundtrip, Socket.IO handshake |
| `.env.example`, `server/.env.example`, `client/.env.example`, `README.md` | **MODIFIED** | Audited configuration templates & turnkey production documentation |

### Suggested Phase / Build Order for Deployment Milestone

1. **Phase A — Server & Client Production Hardening:**
   - Centralize `env.js` (fail-fast prod guard, comma-separated `CLIENT_ORIGIN`, `SERVE_CLIENT`, `TRUST_PROXY`) and `cors.js`.
   - Harden `app.js` (`trust proxy`, Helmet CSP + COOP, `/healthz` + `/readyz`, strict `/api` 404 separation, `SERVE_CLIENT=true` static/SPA fallback) and `index.js` (`SIGTERM`/`SIGINT` graceful shutdown).
   - Wire `VITE_API_URL` / `VITE_SOCKET_URL` fallback into `client/src/api/client.ts` and `client/src/utils/socketClient.ts`.
   - Add Jest integration tests verifying `/healthz`, `/readyz`, `/api/*` JSON 404 vs SPA HTML fallback, multi-origin CORS, and Helmet CSP headers.
2. **Phase B — Containerization & Reverse Proxy Stack:**
   - Add `.dockerignore`, multi-stage `Dockerfile`, `nginx/nginx.conf`, and `docker-compose.yml` (`mongo:6.0` + `app` + `nginx`).
   - Verify full-stack container boot, WebSocket upgrade over Nginx, Leaflet + Google Sign-In under Helmet CSP, and `SERVE_CLIENT=true` standalone mode.
3. **Phase C — PaaS Manifests, Admin Bootstrap, Smoke Verification & Docs:**
   - Implement `server/src/scripts/bootstrapAdmin.js` (idempotent, separated from `demoDataService`).
   - Add `render.yaml` and `vercel.json`, update `.github/workflows/ci.yml` with Docker build verification.
   - Implement `scripts/smoke-deploy.js`, audit all `.env.example` files, and write the production `README.md`.

---

## Sources

- **Codebase Inspection (HIGH):** `server/src/app.js`, `server/src/index.js`, `server/src/config/env.js`, `server/src/config/db.js`, `server/src/routes/index.js`, `server/src/middleware/errorHandler.js`, `server/src/middleware/rateLimiter.js`, `server/src/controllers/authController.js`, `server/src/services/demoDataService.js`, `server/src/seed/seedBhubaneswar.js`, `client/vite.config.ts`, `client/index.html`, `client/src/App.tsx`, `client/src/api/client.ts`, `client/src/utils/socketClient.ts`, `client/src/components/maps/InteractiveMap.tsx`, `client/src/components/auth/GoogleSignInButton.tsx`, `.github/workflows/ci.yml`.
- **Official Helmet v7 CSP & COOP Defaults (MEDIUM, web-verified):** `helmetjs.github.io` — Helmet v7 enables `Cross-Origin-Opener-Policy: same-origin` and `upgrade-insecure-requests` by default, requiring explicit `same-origin-allow-popups` and CSP directives.
- **Google Identity Services CSP & COOP Requirements (MEDIUM, web-verified):** `developers.google.com` / GIS integration docs — requires `script-src https://accounts.google.com/gsi/client`, `frame-src`/`connect-src https://accounts.google.com/gsi/`, and `COOP: same-origin-allow-popups`.
- **Render Blueprint & Vercel Rewrite Specifications (MEDIUM, web-verified):** `render.com` `render.yaml` `healthCheckPath` + `envVars` specification; `vercel.com` SPA `rewrites` ordering and Edge rewrite WebSocket limitations.

---
*Architecture research for: SmartRoute v6 Deployment & Production Readiness*
*Researched: 2026-11-11*
