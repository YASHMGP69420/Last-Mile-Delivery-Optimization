---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
# External Integrations

**Analysis Date:** 2026-11-09

## APIs & External Services

**Routing & Matrix Services:**
- **Geoapify Routing & Matrix API** - Primary distance matrix calculation, stop-to-stop driving duration, and turn-by-turn route geometry generation across Bhubaneswar delivery stops.
  - SDK/Client: Direct HTTP via `axios` (`server/src/services/mapping/geoapify.service.js`)
  - Endpoints:
    - Matrix: `https://api.geoapify.com/v1/routing/matrix`
    - Route Geometry: `https://api.geoapify.com/v1/routing`
    - Geocoding / Search: `https://api.geoapify.com/v1/geocode/search`
    - Autocomplete: `https://api.geoapify.com/v1/geocode/autocomplete`
  - Auth: `GEOAPIFY_SERVER_API_KEY` (backend requests), `VITE_GEOAPIFY_TILE_API_KEY` (frontend tiles)
  - Fallback Strategy: Deterministic fallback to simulated Bhubaneswar physics-based road network matrix in `server/src/services/mapping/simulatedTrafficService.js` if key is missing or quota/network error occurs.

- **Google Maps Distance Matrix API** - Secondary matrix provider and fallback routing calculation.
  - SDK/Client: Direct HTTP via `axios` (`server/src/services/mapping/googleMapsService.js`)
  - Endpoint: `https://maps.googleapis.com/maps/api/distancematrix/json`
  - Auth: Optional `GOOGLE_MAPS_API_KEY` or `key` parameter; falls back to deterministic simulated matrix on quota or authentication failure (`OVER_QUERY_LIMIT`, `REQUEST_DENIED`).

- **Google Maps Universal Navigation URLs** - Driver turn-by-turn navigation deep links launching the native Google Maps app or mobile web from the driver cockpit.
  - Implementation: `client/src/utils/googleMaps.ts` and `client/src/components/maps/OpenInGoogleMapsButton.tsx`
  - Navigation URL Pattern: `https://www.google.com/maps/dir/?api=1&origin={deviceLocation}&destination={target}&waypoints={stops}&travelmode=driving`
  - Auth: No API key required (standard Google Maps URL scheme with device GPS auto-resolution).

**Map Tile Providers:**
- **Geoapify Raster Tiles** - Vector and raster base map rendering in Leaflet.
  - Light Mode URL: `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={key}`
  - Dark Mode URL: `https://maps.geoapify.com/v1/tile/dark-matter-dark-grey/{z}/{x}/{y}.png?apiKey={key}`
  - Implementation: `client/src/components/maps/InteractiveMap.tsx`
  - Auth: `VITE_GEOAPIFY_TILE_API_KEY`

- **OpenStreetMap (OSM) Tiles** - Fallback open tile provider when Geoapify API key is not supplied.
  - Endpoint: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Implementation: Handled in `client/src/components/maps/InteractiveMap.tsx` with CSS dark-mode invert filters when active in dark mode without third-party CDN dependency.
  - Auth: None (public tile server with OpenStreetMap attribution).

## Data Storage

**Databases:**
- **MongoDB (v6.0+)**
  - Connection: `MONGODB_URI` environment variable (default: `mongodb://127.0.0.1:27017/smartroute`)
  - Client: `mongoose` v8.3.1 (`server/src/config/db.js`)
  - Core Collections / Schemas:
    - `deliveries` (`server/src/models/Delivery.js`): Consignment manifests, delivery addresses, coordinates, time windows, status, priority, and verification records.
    - `deliverybatches` (`server/src/models/DeliveryBatch.js`): Delivery batch clusters, assigned vehicles, assigned drivers, and batch metrics.
    - `routes` (`server/src/models/Route.js`): Optimized vehicle routes, stop sequences, baseline vs. optimized comparison metrics, distance, duration, fuel usage, and carbon emissions.
    - `vehicles` (`server/src/models/Vehicle.js`): Fleet assets, registration numbers, vehicle types (Bike, Van, Truck), fuel types (Petrol, Diesel, Electric), capacity constraints, and maintenance statuses.
    - `drivers` (`server/src/models/Driver.js`): Driver profiles, license information, contact info, shift statuses, and vehicle assignments.
    - `drivershifts` (`server/src/models/DriverShift.js`): Shift logs, start/end times, break durations, and daily vehicle pre-trip checklists.
    - `telemetrypings` & `telemetryalerts` (`server/src/models/TelemetryPing.js`, `server/src/models/TelemetryAlert.js`): High-frequency GPS coordinates, vehicle telemetry, speed, battery, and threshold violations.
    - `users` (`server/src/models/User.js`): User accounts, hashed credentials, and role assignments (`ADMIN`, `FLEET_MANAGER`, `DRIVER`).
    - `organizationsettings` (`server/src/models/OrganizationSettings.js`): Multi-depot coordinates, optimization weights, fuel price tariffs, and integration status flags.
    - `auditevents` (`server/src/models/AuditEvent.js`): Immutable administrative audit trail for override actions, permissions updates, and configuration changes.

**File Storage:**
- **Local filesystem only / In-Database Storage:**
  - Manifest and fleet CSV uploads are parsed in-memory directly from JSON payloads (`{ csvContent: string }`) using `papaparse` in `server/src/services/csvImportService.js`.
  - Proof of Delivery (POD) digital signatures are stored inline as SVG text strings (`signatureSvg`) in the `Delivery` document in `server/src/models/Delivery.js`.
  - Photo attachments are referenced by URL strings (`photoUrl`).
  - No external blob storage (e.g., AWS S3, Google Cloud Storage, Azure Blob) is connected or required.

**Caching:**
- **In-Memory TTL LRU Matrix Cache:**
  - Implementation: `MatrixCache` class in `server/src/services/mapping/matrixCache.js`
  - Scope: In-process caching of computed distance and duration pairs between geographic coordinates across traffic scenarios.
  - Configuration: Default capacity of 10,000 entries (`CACHE_MAX_ENTRIES`), 1 hour TTL (`DEFAULT_CACHE_TTL_MS`), and automatic sweep interval every 5 minutes (`CACHE_SWEEP_INTERVAL_MS`) configured via `server/src/config/constants.js`.
  - No external cache cluster (such as Redis or Memcached) is required.

## Authentication & Identity

**Auth Provider:**
- **Custom JWT-based Stateless Authentication:**
  - Implementation: Express middleware in `server/src/middleware/auth.js` and controller actions in `server/src/controllers/authController.js`.
  - Password Hashing: One-way salted hashing with 10 salt rounds via `bcryptjs` in `server/src/models/User.js`.
  - Token Structure:
    - **Access Token:** Short-lived JWT (default: 15 minutes, `JWT_EXPIRES_IN`), signed with `JWT_SECRET`. Contains user ID, role, email, and name.
    - **Refresh Token:** Long-lived JWT (default: 7 days, `JWT_REFRESH_EXPIRES_IN`), signed with `JWT_REFRESH_SECRET`.
  - Client Handling: Stored in browser `localStorage` and injected into outgoing API requests via Axios request interceptors (`Authorization: Bearer <token>`) in `client/src/api/client.ts`. Automatic redirect to `/login` upon `TOKEN_EXPIRED` or `TOKEN_REVOKED` response codes.
  - Authorization / RBAC: Role-Based Access Control enforcing permissions across three standard roles: `ADMIN`, `FLEET_MANAGER`, and `DRIVER` via `authorizeRoles(...)` middleware.

## Monitoring & Observability

**Error Tracking:**
- **None (Internal Operational Error Handling):**
  - Centralized Express error handler in `server/src/middleware/errorHandler.js`.
  - Maps Mongoose validation errors, duplicate keys (`11000`), CastErrors, and JWT token expirations to uniform error envelopes.
  - Generates a unique `requestId` (UUIDv4) attached to every error response for traceability.
  - Unhandled 500 exceptions logged to server console/stderr in non-test modes.

**Logs:**
- **HTTP Request Logs:** `morgan('dev')` format logging HTTP verbs, routes, response codes, and execution latencies in `server/src/app.js` (suppressed in test environments).
- **Audit Logs:** Centralized audit logging via `server/src/services/auditService.js` persisting detailed user override records, IP addresses, resource identifiers, and before/after mutation diffs in the MongoDB `AuditEvent` collection.
- **Telemetry & Operational Alerts:** Real-time alert records stored in `TelemetryAlert` and `SystemNotification` collections for active fleet monitoring and driver push notifications.

## CI/CD & Deployment

**Hosting:**
- Self-hosted / Containerized Node.js application server.
- Supports deployment on Linux VPS, Docker containers, or container management platforms (AWS ECS, GCP Cloud Run, DigitalOcean App Platform).
- Frontend static build output located in `client/dist/` ready for NGINX or static web CDN distribution.

**CI Pipeline:**
- **GitHub Actions** (`.github/workflows/ci.yml`):
  - Triggers on push and pull request to `main`, `master`, and `develop` branches.
  - Service Container: `mongo:6.0` on port 27017 with `mongosh` health check.
  - Node Version: Node.js 20.x via `actions/setup-node@v4` with npm cache enabled.
  - Pipeline Stages:
    1. Checkout repository (`actions/checkout@v4`)
    2. Monorepo dependency install (`npm ci`)
    3. Frontend typecheck and production build (`npm --prefix client run build`)
    4. Backend regression and adversarial test suite (`npm --prefix server test`)

## Environment Configuration

**Required env vars:**
- `PORT` - Server HTTP port (e.g. `5004` or `5000`)
- `NODE_ENV` - Execution mode (`development`, `production`, `test`)
- `MONGODB_URI` - MongoDB connection URI (`mongodb://127.0.0.1:27017/smartroute`)
- `JWT_SECRET` - HMAC secret key for access token encryption (minimum 32 characters in production)
- `JWT_REFRESH_SECRET` - HMAC secret key for refresh token encryption (minimum 32 characters in production)
- `CLIENT_ORIGIN` - Frontend application URL allowed through CORS headers (e.g. `http://localhost:5173`)
- `VITE_API_URL` - Frontend REST API base URL (e.g. `http://localhost:5004/api/v1`)

**Optional / Provider env vars:**
- `GEOAPIFY_SERVER_API_KEY` - Third-party distance matrix and route geometry key
- `GEOAPIFY_API_KEY` - Alias key for Geoapify routing queries
- `MAP_PROVIDER` - Map provider toggle (`geoapify`)
- `JWT_EXPIRES_IN` - Access token expiration window (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration window (default: `7d`)
- `VITE_MAP_PROVIDER` - Frontend map provider name (`geoapify`)
- `VITE_GEOAPIFY_TILE_API_KEY` - Client tile access token for Geoapify raster tiles

**Secrets location:**
- Development secrets are maintained in `.env` and `server/.env` files (ignored in `.gitignore`).
- Continuous integration secrets are passed through GitHub Actions workflow environment variables in `.github/workflows/ci.yml`.

## Webhooks & Callbacks

**Incoming:**
- **None** - System does not expose third-party webhook receivers. Telemetry and consignment data are ingested directly via authenticated REST endpoints (`/api/v1/telemetry`, `/api/v1/deliveries/import-csv`) or WebSocket connection frames.

**Outgoing:**
- **None** - No external third-party webhooks are dispatched. Live updates are pushed directly to connected clients via internal Socket.IO WebSocket events (`route:dispatched`, `driver:location:updated`, `alert:created`) handled in `server/src/services/socketService.js`.

---

*Integration audit: 2026-11-09*
