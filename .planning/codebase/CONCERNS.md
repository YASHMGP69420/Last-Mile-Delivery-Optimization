---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
<!-- refreshed: 2026-11-09 -->
# Architecture and Implementation Concerns
**Analysis Date:** 2026-11-09

## Tech Debt

**Monolithic Business Logic in Controllers:**
- Issue: Complex domain orchestration, bin packing, heuristic scoring, multi-collection cascading updates, and audit logging are implemented directly inside HTTP controller handlers rather than encapsulated domain services.
- Files: `server/src/controllers/routeController.js` (1,542 lines), `server/src/controllers/adminController.js` (1,060 lines), `server/src/controllers/driverHudController.js` (930 lines), `server/src/controllers/deliveryController.js` (669 lines)
- Impact: High cyclomatic complexity, tight coupling between transport layer (Express request/response) and core logistics algorithms, reduced reusability, and difficulty maintaining unit test isolation.
- Fix approach: Extract domain logic into dedicated service classes (e.g., `DispatchExecutionService`, `AdminReportingService`, `DriverShiftWorkflowService`) and reduce controllers to thin request parsing and response envelopes.

**Absence of Multi-Document Database Transactions:**
- Issue: Multi-collection state changes during route dispatch, consignment completion, and batch lifecycle (updating Vehicle availability, Driver route assignment, Delivery status arrays, Batch operational metrics, and creating AuditEvent records) occur sequentially via standalone Mongoose queries without MongoDB replica set transactions (`startSession()` / `session.withTransaction()`).
- Files: `server/src/controllers/routeController.js`, `server/src/controllers/deliveryController.js`, `server/src/controllers/batchController.js`
- Impact: Unhandled exceptions or transient network failures midway through dispatch leave the database in an inconsistent state (e.g., vehicle marked `IN_TRANSIT` while deliveries remain `READY`, or batch metrics desynchronized from consignment counts).
- Fix approach: Wrap multi-document update sequences in a reusable MongoDB transaction helper with automatic retry for transient write errors.

**In-Memory Process-Local State & Token Blacklist:**
- Issue: User session invalidation upon logout relies on an in-memory `Set` (`tokenBlacklist`), and distance matrix calculations utilize an in-memory `Map` (`matrixCache`).
- Files: `server/src/middleware/auth.js`, `server/src/services/mapping/matrixCache.js`
- Impact: Token revocations and matrix caches are lost across server process restarts and are never shared across horizontally scaled multi-instance clusters (PM2, Docker, or Kubernetes). Additionally, `tokenBlacklist` lacks TTL eviction, causing an unbounded memory leak over extended runtimes.
- Fix approach: Back token blacklisting and route matrix caching with Redis using automatic key expiration (`TTL`).

**Regional Coordinate Guessing Heuristic in Client:**
- Issue: Geolocation normalization in the frontend relies on a hardcoded coordinate range check tailored specifically to Bhubaneswar (`c1 < 40 && c2 > 60`) to distinguish `[lat, lng]` from `[lng, lat]`.
- Files: `client/src/utils/googleMaps.ts` (lines 77-80)
- Impact: Deploying or testing the platform outside the Bhubaneswar/Odisha geographic bounding box (e.g., southern hemisphere or western longitudes) will incorrectly swap latitude and longitude values, corrupting route calculations and map pins.
- Fix approach: Enforce strict GeoJSON `[longitude, latitude]` schema typing across all API payloads and Leaflet `[latitude, longitude]` conversions, eliminating heuristic coordinate guessing.

## Known Bugs

**Batch Assignment Endpoint Method Mismatch (E2E Test TC-T1-BAT-3 Failure):**
- Symptoms: E2E test `TC-T1-BAT-3` fails with `404 !== 200` during test runner execution (`npm run test:e2e`).
- Files: `server/src/routes/batchRoutes.js` (line 13), `tests/e2e/tier1-features/batches.test.js` (lines 100-110)
- Trigger: Issuing an HTTP `PUT /api/v1/batches/:id` request to reassign vehicles or drivers to an existing batch. The route router defines `router.patch('/:id')` but omits `router.put('/:id')`.
- Workaround: Client currently sends `PATCH` requests; adding `router.put('/:id', authorize(...), batchController.updateBatch)` in `batchRoutes.js` restores contract parity.

**Missing Test Framework Dependency in Client Package:**
- Symptoms: Running `npm test` inside `client/` fails with command not found error (`vitest: command not found`).
- Files: `client/package.json` (line 7)
- Trigger: Executing `npm test` or `npm run test --workspace=client`.
- Workaround: Add `vitest` and `@testing-library/react` to `client/package.json` `devDependencies` and configure `vitest.config.ts`.

## Security Considerations

**Unverified Google OAuth Token & Role Escalation Vulnerability:**
- Risk: Critical Authentication Bypass & Privilege Escalation. `googleAuth` decodes incoming JWT credentials using `jwt.decode(credential)` without verifying cryptographic signatures against Google's public JWKS. It also accepts unverified fallback payloads (`profile.email`) and allows callers to supply `role: "ADMIN"`.
- Files: `server/src/controllers/authController.js` (lines 337-418)
- Current mitigation: None. The controller trusts caller-supplied claims and creates or authenticates user accounts.
- Recommendations: Replace custom decoding with official `google-auth-library` (`oauth2Client.verifyIdToken({ idToken, audience })`), reject arbitrary `profile` JSON bodies, and restrict OAuth account creation strictly to default role (`DRIVER`).

**Unauthenticated Socket.IO Gateway & Room Hijacking:**
- Risk: Driver location snooping, unauthorized telemetry tracking, and privacy violation. Socket.IO connection handling lacks authentication handshake middleware (`io.use()`), and room join listeners (`route:join`, `driver:join`) accept arbitrary IDs without verifying JWT ownership or user roles.
- Files: `server/src/index.js` (lines 19-60), `server/src/services/socketService.js`, `client/src/context/DriverSocketContext.tsx`
- Current mitigation: Basic CORS origin restriction.
- Recommendations: Implement Socket.IO handshake JWT authentication matching REST API tokens and validate that drivers can only join their assigned route and driver rooms.

**Hardcoded Demo Credentials and Personal Email in Frontend Bundle:**
- Risk: Credential exposure. Cleartext accounts including administrative passwords and a personal Gmail address (`mishrayashaswee6@gmail.com`) are hardcoded in the client application bundle (`quickLogin`).
- Files: `client/src/context/AuthContext.tsx` (lines 129-135)
- Current mitigation: None; compiled directly into production assets (`dist/assets/index-*.js`).
- Recommendations: Gate `quickLogin` strictly behind development flags (`import.meta.env.DEV`) and remove hardcoded production credentials.

**JWT Tokens in LocalStorage:**
- Risk: Cross-Site Scripting (XSS) credential theft. Both access tokens and user profile records are stored in browser `localStorage`.
- Files: `client/src/api/client.ts` (lines 16-37), `client/src/context/AuthContext.tsx`
- Current mitigation: None.
- Recommendations: Store refresh tokens in HttpOnly, Secure, SameSite cookies and maintain access tokens in memory or short-lived state.

## Performance Bottlenecks

**Synchronous Combinatorial Route Optimization on Node.js Main Thread:**
- Problem: Multi-stop route calculation executes Nearest-Neighbor construction, bounded 2-Opt local search (with `O(N^3)` asymmetric edge calculations per iteration), and Or-Opt search synchronously on the single-threaded Node.js event loop.
- Files: `server/src/controllers/routeController.js` (lines 470-490), `server/src/services/optimization/twoOpt.js` (lines 45-73), `server/src/services/optimization/optimizerEngine.js`
- Cause: Pairwise matrix evaluations and edge swaps run inside nested synchronous JavaScript loops. Under load or with 50+ consignments, this blocks the event loop for seconds, stalling incoming HTTP requests and WebSocket telemetry broadcasts.
- Improvement path: Offload route optimization computation to Node.js `worker_threads` or an asynchronous background task queue (e.g., BullMQ with Redis).

**Linear O(N) Cache Eviction Scan in MatrixCache:**
- Problem: When `MatrixCache` reaches its maximum capacity (10,000 entries), every subsequent cache write triggers `evictOne()`, which iterates over the entire `Map.entries()` to locate the lowest monotonic sequence number.
- Files: `server/src/services/mapping/matrixCache.js` (lines 69-86)
- Cause: Iterating through 10,000 keys sequentially on every cache insertion creates unnecessary CPU overhead when the cache is saturated.
- Improvement path: Replace with an `O(1)` LRU doubly linked list structure (or utilize the standard `lru-cache` library).

**Unsplit Monolithic Frontend Asset Bundle:**
- Problem: Client production build emits a single 930 kB JavaScript bundle (`index-C8n47Zrg.js`), well above the recommended 500 kB threshold.
- Files: `client/vite.config.ts`, `client/src/App.tsx`
- Cause: All 18+ application routes and heavy dependencies (Leaflet, Recharts, Lucide Icons, PapaParse) are imported synchronously in `App.tsx`.
- Improvement path: Implement `React.lazy()` route-based code splitting and configure Rollup manual chunks in `client/vite.config.ts`.

## Fragile Areas

**Driver-Vehicle 1:1 Mutual Exclusivity and State Invariants:**
- Files: `server/src/controllers/routeController.js`, `server/src/controllers/vehicleAssignmentController.js`, `server/src/models/Vehicle.js`, `server/src/models/Driver.js`
- Why fragile: State transitions (`AVAILABLE` -> `ASSIGNED` -> `IN_TRANSIT`) span across separate collections (`Driver` and `Vehicle`). Concurrent assignment requests or route dispatches can lead to race conditions where one driver's vehicle assignment is overwritten while active.
- Safe modification: Enforce atomic conditional updates (`findOneAndUpdate({ _id, availability: 'AVAILABLE' })`) and check modification return values before proceeding.
- Test coverage: Adversarial tests in `adversarial.test.js` cover sequential checks, but lack high-concurrency database integration testing.

**Leaflet GeoJSON vs LatLng Coordinate Inversion:**
- Files: `client/src/components/maps/InteractiveMap.tsx`, `client/src/utils/googleMaps.ts`
- Why fragile: GeoJSON standards define coordinates as `[longitude, latitude]`, whereas Leaflet and Google Maps APIs accept `[latitude, longitude]`. Minor discrepancies in map marker generation or route polyline rendering easily invert coordinates.
- Safe modification: Enforce domain type aliases (`type GeoJsonPoint = [number, number]` vs `type LatLngTuple = [number, number]`) with explicit runtime transform functions.
- Test coverage: Zero automated test coverage for frontend map rendering components.

## Scaling Limits

**Telemetry Ping Ingestion Without Automated Pruning or Sharding:**
- Current capacity: High-frequency driver GPS pings are saved as individual documents in `TelemetryPing`.
- Limit: With 50 active vehicles pinging every 5 seconds over a 10-hour daily shift, ~360,000 documents accumulate daily (~10.8 million pings/month). Without automated TTL index cleanup, storage and index sizes quickly degrade database performance.
- Scaling path: Configure a MongoDB TTL index on `createdAt` (`expireAfterSeconds: 2592000` for 30-day retention) or transition the collection to a native MongoDB Time Series collection.

**Single-Instance WebSocket Architecture:**
- Current capacity: Single Node.js server managing in-memory Socket.IO connections and rooms.
- Limit: Inability to scale horizontally behind a load balancer; clients connected to instance A will not receive telemetry broadcasts emitted by instance B.
- Scaling path: Introduce `@socket.io/redis-adapter` for distributed cross-instance WebSocket broadcasting.

## Dependencies at Risk

**`papaparse` In-Browser CSV Processing:**
- Risk: Memory consumption during massive CSV file uploads (>50,000 rows) can block or crash client browser threads.
- Impact: Mobile and low-spec dispatch consoles experience browser tab freezing.
- Migration plan: Move CSV parsing for large manifests to server streaming endpoints (`csv-parser` or Node.js streams).

**Runtime Version Drift (Node.js v26 in Development):**
- Risk: Workspace environment is running under Node.js v26.3.0, while package engines define `node: ">=18.0.0"`.
- Impact: Potential unspotted behavior differences in cryptography, streams, or native dependencies between local development and LTS production deployments.
- Migration plan: Standardize container and CI environments on active LTS (Node.js 20 LTS or 22 LTS).

## Missing Critical Features

**Automated 30-Day Location Retention Pruning:**
- Problem: The project specification explicitly details 30-day driver location retention pruning, but neither TTL indexes nor scheduled pruning cron tasks exist.
- Blocks: Data compliance standards and database capacity containment.

**SMS OTP Delivery & Verification Engine:**
- Problem: `completeDelivery` accepts any OTP string and marks `otpVerified: true` without sending an SMS code or verifying against a cryptographically hashed OTP.
- Blocks: Genuine non-repudiation and verified Proof-of-Delivery in production field operations.

**Silent JWT Token Refresh Flow in Frontend:**
- Problem: When access tokens expire (15m TTL), `client/src/api/client.ts` immediately wipes local storage and forces a redirect to `/login` instead of utilizing `POST /api/v1/auth/refresh`.
- Blocks: Uninterrupted dispatch operations and continuous background tracking for active drivers.

## Test Coverage Gaps

**Frontend Test Coverage (0% Test Coverage):**
- What's not tested: All React components, pages, hooks, state contexts, form validations, and vector map rendering.
- Files: `client/src/**/*` (over 40 components, pages, and hooks)
- Risk: High. Regressions in user interaction, dispatch modals, and map updates cannot be detected prior to manual end-user verification.
- Priority: High

**Socket.IO Real-Time Gateway Integration Tests:**
- What's not tested: Authenticated WebSocket handshakes, room multiplexing, telemetry broadcast relays, and disconnect/reconnect resilience.
- Files: `server/src/services/socketService.js`, `server/src/index.js`
- Risk: Medium. Disconnections or room routing regressions can silently disable live fleet cockpits.
- Priority: Medium

**Batch PUT Endpoint Contract Verification:**
- What's not tested / Broken: `PUT /api/v1/batches/:id` endpoint omitted in router, failing E2E test `TC-T1-BAT-3`.
- Files: `server/src/routes/batchRoutes.js`
- Risk: Medium. Discrepancy between contract expectations and Express router definitions.
- Priority: High

---

*Concerns audit: 2026-11-09*
