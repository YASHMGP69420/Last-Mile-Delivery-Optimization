---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
# Technology Stack

**Analysis Date:** 2026-11-09

## Languages

**Primary:**
- **TypeScript 5.4.5** - Single-page frontend application located in `client/src/` (`client/src/App.tsx`, `client/src/api/`, `client/src/components/`, `client/src/context/`, `client/src/hooks/`, `client/src/types/`). Static type checking enforced via `client/tsconfig.json`.
- **JavaScript (Node.js ES2022 / CommonJS)** - Backend REST API service, real-time WebSocket server, and routing optimization engine located in `server/src/` (`server/src/index.js`, `server/src/app.js`, `server/src/controllers/`, `server/src/services/`, `server/src/models/`, `server/src/routes/`), automated database seeds in `server/src/seed/`, and end-to-end test runner in `tests/e2e/runner.js`.

**Secondary:**
- **HTML5 & CSS3 / PostCSS** - Responsive modern web interface, Obsidian dark theme, and Tailwind utility styling defined in `client/index.html`, `client/src/index.css`, `client/tailwind.config.js`, and `client/postcss.config.js`.
- **Shell / PowerShell / YAML** - Automation scripts, cross-platform port cleanup in `server/package.json` (`clean:port`), and automated CI pipeline in `.github/workflows/ci.yml`.

## Runtime

**Environment:**
- **Node.js:** `>=18.0.0` (validated against Node.js 20.x in `.github/workflows/ci.yml`; specified in root `package.json` and `server/package.json`).
- **Browser:** Evergreen modern browsers (Chrome, Edge, Firefox, Safari) with ES2020+, Geolocation API, Web Audio API, and SVG rendering support.

**Package Manager:**
- **npm:** `>=9.0.0`
- Monorepo workspace configuration defined in root `package.json` (`"workspaces": ["server", "client"]`).
- Lockfile: `package-lock.json` present at repository root and `client/package-lock.json`.

## Frameworks

**Core:**
- **Express 4.19.2** - Backend HTTP application server mounting REST API endpoints under `/api/v1` in `server/src/app.js` and `server/src/routes/index.js`.
- **React 18.3.1 & React DOM 18.3.1** - Frontend component library with React 18 hooks and context-driven state in `client/src/`.
- **React Router DOM 6.23.1** - Declarative client-side routing hierarchy for Admin Control Center and Driver HUD in `client/src/App.tsx`.
- **Socket.IO 4.7.5 & Socket.IO Client 4.7.5** - Bidirectional real-time WebSocket transport for live driver telemetry, vehicle tracking, and dispatch broadcast notifications in `server/src/index.js`, `server/src/services/socketService.js`, and `client/src/context/DriverSocketContext.tsx`.

**Testing:**
- **Jest 29.7.0 / 30.5.2** - Backend unit, integration, and adversarial stress testing framework configured in `server/jest.config.js` and executed via `server/tests/`.
- **Supertest 6.3.4 / 7.3.2** - HTTP assertion framework for Express routes in `server/tests/` and `tests/e2e/harness/testServer.js`.
- **Vitest** - Client unit testing configured in `client/package.json` (`"test": "vitest run"`).
- **Custom E2E Test Runner** - Multi-tiered verification harness executing Tier 1 (features), Tier 2 (boundaries), Tier 3 (pairwise interactions), and Tier 4 (workloads) in `tests/e2e/runner.js`.

**Build/Dev:**
- **Vite 5.2.11 & `@vitejs/plugin-react` 4.3.0** - Frontend development server and production bundler configured in `client/vite.config.ts` with `@/*` path resolution and development API proxy.
- **Nodemon 3.1.0** - Backend hot-reloading development process manager configured in `server/package.json`.
- **Concurrently 8.2.2** - Parallel execution of backend and frontend development processes from root `package.json` (`npm run dev`).
- **Tailwind CSS 3.4.3 & Autoprefixer 10.4.19** - Utility-first styling framework configured in `client/tailwind.config.js` with class-based dark mode.
- **TypeScript Compiler (tsc) 5.4.5** - Frontend type validation during production builds (`tsc && vite build`).

## Key Dependencies

**Critical:**
- **`mongoose` 8.3.1** - MongoDB object modeling, schema validation, index management, and document transactions in `server/src/config/db.js` and `server/src/models/`.
- **`leaflet` 1.9.4 & `react-leaflet` 4.1.0** - Client-side interactive map visualization, custom marker generation, route polylines, and bounds fitting in `client/src/components/maps/InteractiveMap.tsx`.
- **`axios` 1.7.2** - Promise-based HTTP client for external distance matrix calls in `server/src/services/mapping/geoapify.service.js` and authenticated client REST calls with interceptors in `client/src/api/client.ts`.
- **`papaparse` 5.4.1** - In-memory RFC 4180 CSV parsing and streaming for deliveries, vehicles, and drivers in `server/src/services/csvImportService.js` and `client/src/components/deliveries/CsvImportModal.tsx`.
- **`jsonwebtoken` 9.0.2** - HMAC-SHA256 stateless session token creation and verification in `server/src/controllers/authController.js` and `server/src/middleware/auth.js`.
- **`bcryptjs` 2.4.3** - One-way salted credential hashing in `server/src/models/User.js`.
- **`lucide-react` 0.378.0** - Icon set used across all admin and driver user interfaces in `client/src/components/`.

**Infrastructure:**
- **`helmet` 7.1.0** - HTTP security header middleware configured in `server/src/app.js`.
- **`cors` 2.8.5** - Cross-origin resource sharing policy configuration in `server/src/app.js`.
- **`express-rate-limit` 7.2.0** - IP-based rate limiting on sensitive authentication endpoints in `server/src/app.js`.
- **`morgan` 1.10.0** - HTTP access logging in non-test environments in `server/src/app.js`.
- **`dotenv` 16.4.5** - Environment variable resolution with multi-level fallback in `server/src/config/env.js`.
- **`uuid` 9.0.1** - Distributed UUIDv4 generation for request tracing, batch identifiers, and incident reports in `server/src/middleware/errorHandler.js`.
- **`clsx` 2.1.1 & `tailwind-merge` 2.3.0** - Class name merging and conflict resolution in `client/src/utils/`.

## Configuration

**Environment:**
- Backend loads environment variables through `server/src/config/env.js` with resolution order: `server/.env` (or `.env.test`) -> root `.env`.
- Frontend environment variables require the `VITE_` prefix and are loaded by Vite via `client/.env` and `client/.env.example`.
- Key configs required:
  - `PORT`: HTTP port for Express backend (default: `5004` or `5000`).
  - `NODE_ENV`: Runtime environment (`development`, `production`, `test`).
  - `MONGODB_URI`: Connection string for MongoDB (default: `mongodb://127.0.0.1:27017/smartroute`).
  - `JWT_SECRET`: Secret key for access token signing (minimum 32 characters in production).
  - `JWT_REFRESH_SECRET`: Secret key for refresh token signing.
  - `CLIENT_ORIGIN`: Allowed origin for CORS validation (default: `http://localhost:5173`).
  - `GEOAPIFY_SERVER_API_KEY`: API key for Geoapify routing and distance matrix computation.
  - `VITE_API_URL`: Base REST API endpoint for frontend client (`http://localhost:5004/api/v1`).
  - `VITE_GEOAPIFY_TILE_API_KEY`: Client raster tile key for Geoapify interactive maps.

**Build:**
- `client/vite.config.ts` - Bundler resolution, React plugins, deduplication of React singletons, and reverse proxy for `/api` and `/socket.io`.
- `client/tsconfig.json` - ES2020 target, bundler module resolution, strict mode, and `@/*` path aliases.
- `client/tailwind.config.js` - Color definitions, dark mode obsidian scale, box shadows, and typography.
- `client/postcss.config.js` - PostCSS configuration with Tailwind and Autoprefixer.
- `server/jest.config.js` - Jest test environment, setup scripts (`server/tests/setup.js`), and execution timeouts.

## Platform Requirements

**Development:**
- Node.js `18.0.0` or higher (`20.x` recommended).
- npm `9.0.0` or higher with workspace support.
- Local MongoDB `6.0+` instance running on `localhost:27017` or accessible MongoDB connection URI.
- Modern browser with Web Audio API, Geolocation, and Canvas/SVG support.

**Production:**
- Linux container (Docker) or Node.js runtime environment (Ubuntu 22.04 LTS / Debian 12).
- Managed MongoDB 6.0+ cluster (MongoDB Atlas or replicated replica set).
- NGINX or cloud ingress controller configured with WebSocket reverse proxy support for `/socket.io` and HTTP reverse proxy for `/api/v1`.
- Static asset serving or CDN for frontend distribution directory `client/dist`.

---

*Stack analysis: 2026-11-09*
