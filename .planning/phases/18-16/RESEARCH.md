# Phase 18: Production CI Stabilization & Real-Time Telemetry/Driver HUD Integration - Research

**Researched:** 2026-11-15
**Domain:** CI/CD hardening, Multi-provider GIS Routing Failover, Real-time Socket.IO Telemetry, Mobile Driver HUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Standardize all monorepo test runners on deterministic one-shot execution (`vitest run` in client, `jest --runInBand` in server) with supply-chain audits pinned to `--audit-level=high`.
- **D-02:** Replace hardcoded wall-clock timeout expectations in adversarial benchmark tests with adaptive timeouts or relative metrics to prevent false-positive CI pipeline aborts under parallel load. — **Reversibility:** reversible — test calibration only.
- **D-03:** Wrap `geoapify.service.js` and `googleMapsService.js` in a resilient `MappingProviderFactory` with an in-memory circuit breaker that auto-falls back to `simulatedTrafficService.js` upon quota exhaustion (429/OVER_QUERY_LIMIT) or network timeout (>3500ms). — **Reversibility:** costly — touches server mapping service callers.
- **D-04:** Wire `DriverCockpitPage.tsx` and `DriverRoutePage.tsx` to active Socket.IO room events (`route:join`, `driver:locationUpdated`), streaming battery state of charge (SoC), speed, and heading coordinates directly to the Live Tracking Control Center.
- **D-05:** Unify Proof of Delivery (POD) audit event records to unambiguously reflect whether delivery closure completed with OTP verification, signature canvas data, or photo evidence.

### the agent's Discretion

- Selection of specific frontend telemetry reconnect backoff intervals (exponential vs fixed jitter).
- Organization of shared TypeScript interfaces between client tracking markers and server Socket.IO broadcast payloads.

### Deferred Ideas (OUT OF SCOPE)

- Offline-first IndexedDB telemetry caching for field drivers when network connectivity drops completely (future phase).

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CI-01** | Production CI stability with Vite 8, Vitest 5, React Router 7, pinned high-severity supply chain audit, and non-flaky test timeouts | Monorepo CI workflow audit confirms `npm audit --audit-level=high` clean; calibration strategy replaces fragile wall-clock bounds in `server/tests/adversarial_csv_batch.test.js` with adaptive throughput thresholds. |
| **MAP-01** | Resilient multi-provider mapping failover with in-memory circuit breaker (Geoapify → Google Maps → Simulated) | Architectural inspection shows decoupled providers with disparate timeouts (8000ms vs 5000ms); `MappingProviderFactory` centralizes matrix queries with a strict 3500ms timeout and trip/half-open state machines. |
| **TEL-01** | Real-time bi-directional telemetry gateway via Socket.IO (`driver:locationUpdated` event) | Codebase audit shows server currently relies on HTTP POST `/api/v1/driver-hud/location`; registering `driver:locationUpdated` socket event handler enables low-latency streaming (<50ms) directly into `emitTelemetryPing`. |
| **HUD-01** | Driver HUD synchronization (`route:join`), real-time vehicle positioning on tracking map, and unified POD audit records | Audit reveals incomplete metadata in `AuditEvent` records during POD completion; unified audit payload captures `verificationMethods` (OTP, signature, photo) across both driver HUD and central delivery controllers. |

</phase_requirements>

---

## Summary

Phase 18 solidifies the foundational bridge between CI stability, resilient external GIS integrations, and real-time operational execution in the field. The SmartRoute platform operates on modern runtimes (Node 22, Vite 8, Vitest 5, React Router 7), but requires three critical production-readiness enhancements:
1. **Deterministic CI & Wall-Clock Benchmark Calibration**: Eliminating false-positive test failures caused by parallel runner contention in high-volume benchmark suites (`adversarial_csv_batch.test.js` and `adversarial_optimizer_stress.test.js`).
2. **Resilient Multi-Provider Mapping Circuit Breaker**: Unifying Geoapify, Google Maps, and Bhubaneswar simulated physics behind a `MappingProviderFactory` that enforces a 3500ms network SLA and trips cleanly to deterministic simulation on quota exhaustion (HTTP 429 / `OVER_QUERY_LIMIT`).
3. **Low-Latency Telemetry & Unified POD Audit Tracking**: Enhancing the Socket.IO gateway with authenticated `driver:locationUpdated` event ingestion to complement HTTP polling, and standardizing Proof of Delivery audit event metadata to record explicit verification methods.

**Primary recommendation:** Implement `MappingProviderFactory` with an in-memory 3-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`), wire `driver:locationUpdated` on the Socket.IO gateway with dual-transport client support, and replace brittle wall-clock assertions with adaptive throughput benchmarks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CI Supply Chain & Regression Pipeline | CI / GitHub Actions | Test Runners (`vitest`, `jest`) | Ensures deterministic build gates, type-checking, and zero-vulnerability package compliance before code merge. |
| Mapping Circuit Breaker & Failover | API / Backend (`server/src/services/mapping/`) | Route Optimization Engine (`matrixBuilder.js`) | Protects route optimization and ETA computation from external API network lag and third-party quota exhaustion. |
| Real-Time Telemetry Socket Ingestion | API / Backend (`socketAuth.js`, `socketService.js`) | Mobile Client (`DriverSocketContext.tsx`) | Ingests GPS pings with sub-50ms latency, validates coordinates/speed, triggers safety alerts, and broadcasts to management rooms. |
| Driver HUD Maneuver & Route Tracking | Browser / Client (`DriverCockpitPage`, `DriverRoutePage`) | Real-Time Gateway (`trackingSocket`) | Manages driver room subscriptions, stop arrival states, navigation intents, and turn-by-turn context. |
| Proof-of-Delivery Verification & Audit | API / Backend (`driverHudController`, `deliveryController`) | Client (`PODModal.tsx`) | Authoritatively validates OTP, signatures, and photo uploads, generating immutable audit trail entries in MongoDB. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | `^8.3.8` [VERIFIED: client/package.json:53] | Frontend build tool & HMR engine | Modern Rolldown/Oxc powered bundler for ultra-fast compilation. |
| `vitest` | `^5.1.0` [VERIFIED: client/package.json:54] | Frontend test runner | Native Vite test runner sharing plugin pipeline with JSDOM. |
| `react-router-dom` | `^7.18.5` [VERIFIED: client/package.json:29] | Client-side routing & navigation | Standard declarative routing with nested routes and guards. |
| `socket.io` | `^4.7.5` [VERIFIED: server/package.json:33] | Server WebSocket engine | Mature event-driven transport with rooms, namespaces, and auto-fallback to polling. |
| `socket.io-client` | `^4.7.5` [VERIFIED: client/package.json:30] | Client WebSocket interface | Robust reconnection management with custom backoff jitter. |
| `jest` | `^29.7.0` [VERIFIED: server/package.json:38] | Backend test runner | Stable enterprise runner executing with `--runInBand` for serial isolation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `axios` | `^1.7.2` [VERIFIED: server/package.json:20] | HTTP client | External REST calls to Geoapify and Google Maps Distance Matrix. |
| `leaflet` & `react-leaflet` | `^1.9.4` / `^4.1.0` [VERIFIED: client/package.json:22,28] | Vector mapping UI | Interactive vehicle tracking and route polyline rendering in Control Center. |
| `sonner` | `^2.0.8` [VERIFIED: client/package.json:31] | Toast notifications | Real-time driver dispatch and escalation toasts. |

---

## Package Legitimacy Audit

No new external packages are introduced in Phase 18. All dependencies are already locked in `package.json` and `package-lock.json`.

| Package | Registry | Current Version | Source Repo | Verdict | Disposition |
|---------|----------|-----------------|-------------|---------|-------------|
| `vite` | npm | `^8.3.8` | `github.com/vitejs/vite` | `[OK]` | Approved (Pre-installed) |
| `vitest` | npm | `^5.1.0` | `github.com/vitest-dev/vitest` | `[OK]` | Approved (Pre-installed) |
| `react-router-dom` | npm | `^7.18.5` | `github.com/remix-run/react-router` | `[OK]` | Approved (Pre-installed) |
| `socket.io` | npm | `^4.7.5` | `github.com/socketio/socket.io` | `[OK]` | Approved (Pre-installed) |
| `socket.io-client` | npm | `^4.7.5` | `github.com/socketio/socket.io-client` | `[OK]` | Approved (Pre-installed) |

*Audit status:* Run `npm audit --audit-level=high` verified clean (0 high/critical vulnerabilities).

---

## Architecture Patterns

### System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              SmartRoute Platform Architecture                     |
+-----------------------------------------------------------------------------------+

     +-----------------------+                    +------------------------+
     |   Driver Mobile HUD   |                    | Live Tracking Center   |
     | (DriverCockpitPage /  |                    | (TrackingPage.tsx /    |
     |  DriverRoutePage.tsx) |                    |  InteractiveMap.tsx)   |
     +-----------+-----------+                    +-----------+------------+
                 |                                            ^
      1. Telemetry GPS / SoC                       4. Telemetry Ping Stream
         `driver:locationUpdated`                     `telemetry:ping`
                 |                                            |
                 v                                            |
+-----------------------------------------------------------------------------------+
|                        Server Gateway & Real-Time Engine                          |
|                                                                                   |
|  [Socket.IO Handshake Auth]  -->  [Room Router: 'management', 'route:{id}']       |
|                                                                                   |
|  [Telemetry Service]                                                              |
|   - Ingest & Bounds Check: [lng, lat], speed, heading, battery                    |
|   - Safety Alerts: Overspeed (>65 km/h), Critical Mobile Battery (<15%)           |
|   - Hardware CAN-bus Verification: Zero synthetic telemetry fabrication           |
|   - MongoDB Persistence: TelemetryPing (TTL 30d index)                            |
+-----------------------------------------------------------------------------------+
                                   |
                      Matrix Query / Geometry Query
                                   |
                                   v
+-----------------------------------------------------------------------------------+
|                 MappingProviderFactory (Circuit Breaker Layer)                    |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Circuit State: CLOSED (Normal) -> OPEN (Tripped) -> HALF_OPEN (Probing)  |   |
|   | Failure Triggers: HTTP 429, OVER_QUERY_LIMIT, Timeout > 3500ms, 3 Consec. |   |
|   +---------------------------------------------------------------------------+   |
|                 |                                             |                   |
|       (Primary Provider)                            (Secondary Provider)          |
|                 v                                             v                   |
|   +---------------------------+                 +---------------------------+     |
|   |   Geoapify Matrix API     |                 |  Google Maps Matrix API   |     |
|   |   (Routing & Matrix v1)   |                 |   (Distance Matrix API)   |     |
|   +-------------+-------------+                 +-------------+-------------+     |
|                 | (Tripped / Quota / Timeout)                 |                   |
|                 +----------------------+----------------------+                   |
|                                        |                                          |
|                                        v                                          |
|                         +-----------------------------+                           |
|                         |  simulatedTrafficService    |                           |
|                         | (Deterministic Bhubaneswar  |                           |
|                         |   Road Distance & Physics)  |                           |
|                         +-----------------------------+                           |
+-----------------------------------------------------------------------------------+
```

### Pattern 1: Resilient Three-State Mapping Circuit Breaker
**What:** An in-memory circuit breaker wrapping external GIS API calls. When external requests experience consecutive timeouts (>3500ms) or quota exhaustion (429/`OVER_QUERY_LIMIT`), the circuit opens, immediately redirecting callers to `simulatedTrafficService.js` without network latency.
**When to use:** All distance matrix and route geometry requests across dispatch planning and mid-shift re-optimization.

```javascript
// Pattern: MappingProviderCircuitBreaker
class MappingCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.timeoutMs = options.timeoutMs || 3500;
    this.cooldownMs = options.cooldownMs || 30000;
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(isQuotaError = false) {
    this.failureCount++;
    if (isQuotaError || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownMs;
    }
  }
}
```

### Pattern 2: Bi-Directional Socket.IO Telemetry Ingestion with HTTP Fallback
**What:** Mobile driver HUD emits high-frequency GPS, speed, heading, and battery state directly over an authenticated WebSocket (`driver:locationUpdated`), falling back to HTTP REST (`POST /api/v1/driver-hud/location`) only when the socket disconnects.
**When to use:** Active route delivery execution while the driver shift status is `IN_PROGRESS`.

```typescript
// Client-side dual-transport transmission pattern
const transmitLocation = async (payload: DriverLocationPayload) => {
  if (socketRef.current?.connected) {
    socketRef.current.emit('driver:locationUpdated', payload, (ack: any) => {
      if (!ack?.success) {
        // Fallback to REST if socket acknowledgement failed
        DriverHudApi.updateLocation(payload).catch(() => {});
      }
    });
  } else {
    await DriverHudApi.updateLocation(payload).catch(() => {});
  }
};
```

### Anti-Patterns to Avoid
- **Hardcoded Wall-Clock Expectations in High-Volume Tests:** Asserting `expect(dryTime).toBeLessThan(5000)` causes pipeline instability under CI runner load. Use relative throughput assertions (`validRows / elapsedSeconds > 25`) or adaptive ceilings scaled by host environment.
- **Unbounded HTTP Retries on Quota Errors:** Retrying HTTP 429 or `OVER_QUERY_LIMIT` exacerbates external rate limits and wastes precious request budgets. Circuit breaker must immediately trip to `OPEN` on quota errors.
- **Synthesizing OBD-II Telemetry Data:** Fabricating RPM or engine coolant values when no physical CAN-bus device is connected violates vehicle safety integrity. When `hardwareSensors.connected === false`, keep vehicle diagnostic telemetry `null`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time bi-directional messaging | Custom raw WebSocket server | Socket.IO (`socket.io` & `socket.io-client`) | Handles transparent HTTP long-polling fallback, room isolation, automatic reconnection backoff, and heartbeat pings. |
| Distance & Duration Computation | Raw Euclidean / Haversine distance in business logic | `simulatedTrafficService.js` / `MappingProviderFactory` | Bhubaneswar street grid has a 1.35x non-linear road tortuosity factor and distinct traffic multipliers (e.g. 1.8x Morning Rush, 2.2x Evening Peak). |
| Supply Chain Audit Gates | Custom vulnerability parsing scripts | `npm audit --audit-level=high` | Native npm command that scans the dependency tree against GitHub Advisory Database directly. |
| Proof-of-Delivery Signature Capture | Custom touch gesture coordinates parser | HTML5 `<canvas>` with PNG/SVG data URI serialization | Provides browser-agnostic cross-device support for stylus, mouse, and fingertip signatures. |

---

## Common Pitfalls

### Pitfall 1: Brittle Wall-Clock Benchmarks in GitHub Actions
**What goes wrong:** `server/tests/adversarial_csv_batch.test.js` fails with `Expected: < 5000, Received: 5420` in CI, aborting pull request verification.
**Why it happens:** GitHub Actions shared runners experience CPU throttling and disk I/O contention during parallel workflow steps (such as simultaneous Docker builds or background MongoDB flushing).
**How to avoid:** Define adaptive thresholds: `const maxAllowedMs = Math.max(8000, 5000 * (process.env.CI ? 2 : 1));` or benchmark throughput rate: `expect(dryRes.body.data.totalRows / (dryTime / 1000)).toBeGreaterThan(40);`.
**Warning signs:** Tests pass locally on developer workstations (8-core/M-series) in 1.2s but intermittently fail on `ubuntu-latest` CI runners.

### Pitfall 2: Circuit Breaker Cascade Lockout
**What goes wrong:** A temporary network glitch trips the circuit breaker to `OPEN`, and it permanently refuses to query Geoapify or Google Maps even after connectivity returns.
**Why it happens:** Missing `HALF_OPEN` state transition probe or missing timestamp reset.
**How to avoid:** Implement a 30-second cooldown window. Once elapsed, allow a single exploratory probe request (`HALF_OPEN`). If it succeeds, immediately transition to `CLOSED` and reset the failure counter.
**Warning signs:** Mapping provider logs show `[Geoapify] Using simulated fallback` indefinitely in production even with valid API keys and active network.

### Pitfall 3: Broken BOLA Isolation on Socket.IO Telemetry
**What goes wrong:** A malicious or buggy driver client emits `driver:locationUpdated` with a fabricated `driverId` belonging to another driver, polluting fleet tracking data.
**Why it happens:** Relying on client-provided `driverId` in the socket payload rather than extracting the authenticated user ID bound to `socket.user.id`.
**How to avoid:** In `socketAuth.js`, always bind telemetry pings to the verified driver record resolved via `socket.user.id`. Reject any payload attempting to override another driver's coordinates with `403 FORBIDDEN`.
**Warning signs:** Driver markers jump erratically across the Bhubaneswar map during shift changes.

---

## Code Examples

### 1. In-Memory Resilient Mapping Provider Factory

```javascript
// server/src/services/mapping/mappingProviderFactory.js
// Verified against server/src/services/mapping/geoapify.service.js:33-77
// and server/src/services/mapping/googleMapsService.js:31-69

const geoapifyService = require('./geoapify.service');
const googleMapsService = require('./googleMapsService');
const simulatedTrafficService = require('./simulatedTrafficService');
const env = require('../../config/env');

class MappingProviderFactory {
  constructor() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
    this.CIRCUIT_TIMEOUT_MS = 3500; // Locked per D-03
    this.COOLDOWN_MS = 30000;
  }

  isCircuitOpen() {
    return Date.now() < this.circuitOpenUntil;
  }

  tripCircuit() {
    this.circuitOpenUntil = Date.now() + this.COOLDOWN_MS;
    this.failureCount = 0;
  }

  async getDistanceMatrix(origins, destinations, options = {}) {
    if (options.forceSimulation || this.isCircuitOpen()) {
      return simulatedTrafficService.getDistanceMatrix(origins, destinations, options);
    }

    // 1. Try Primary: Geoapify
    if (env.isGeoapifyConfigured(env.GEOAPIFY_SERVER_API_KEY)) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('MAPPING_TIMEOUT_EXCEEDED')), this.CIRCUIT_TIMEOUT_MS)
        );
        const matrix = await Promise.race([
          geoapifyService.getDistanceMatrix(origins, destinations, options),
          timeoutPromise,
        ]);
        if (matrix && matrix.status === 'OK' && matrix.source === 'GEOAPIFY') {
          this.failureCount = 0;
          return matrix;
        }
      } catch (err) {
        this.failureCount++;
        if (this.failureCount >= 3 || err.message?.includes('429')) {
          this.tripCircuit();
        }
      }
    }

    // 2. Try Secondary: Google Maps (if configured)
    const googleKey = (env && env.GOOGLE_MAPS_API_KEY) || process.env.GOOGLE_MAPS_API_KEY;
    if (googleKey && googleKey !== 'mock_key' && !this.isCircuitOpen()) {
      try {
        const matrix = await googleMapsService.getDistanceMatrix(origins, destinations, options);
        if (matrix && matrix.status === 'OK' && matrix.source === 'GOOGLE_MAPS') {
          return matrix;
        }
      } catch (err) {
        if (err.isQuotaError) this.tripCircuit();
      }
    }

    // 3. Deterministic Invariant Fallback
    return simulatedTrafficService.getDistanceMatrix(origins, destinations, options);
  }
}

module.exports = new MappingProviderFactory();
```

### 2. Socket.IO Gateway `driver:locationUpdated` Event Handler

```javascript
// server/src/middleware/socketAuth.js (Addition to registerAuthorizedSocketHandlers)
// Verified against server/src/services/telemetryService.js:15-66

socket.on('driver:locationUpdated', async (data, ack) => {
  try {
    if (user.role !== ROLES.DRIVER) {
      const err = { code: 'FORBIDDEN', message: 'Only drivers may transmit telemetry coordinates.' };
      if (typeof ack === 'function') ack({ success: false, ...err });
      return;
    }

    // Enforce BOLA: telemetry always belongs to socket's authenticated user
    const driverDoc = await Driver.findOne({ userId: user.id }).lean();
    if (!driverDoc) {
      const err = { code: 'DRIVER_NOT_FOUND', message: 'No registered driver profile for session.' };
      if (typeof ack === 'function') ack({ success: false, ...err });
      return;
    }

    const payload = {
      ...data,
      driverId: driverDoc._id,
      vehicleId: driverDoc.assignedVehicleId || data.vehicleId,
      routeId: driverDoc.currentRouteId || data.routeId,
      source: 'MOBILE_APP_GPS',
    };

    const result = await telemetryService.recordTelemetry(payload, user);

    if (typeof ack === 'function') {
      ack({
        success: true,
        pingId: result.ping._id,
        timestamp: result.ping.timestamp,
      });
    }
  } catch (err) {
    if (typeof ack === 'function') {
      ack({ success: false, error: err.message });
    }
  }
});
```

### 3. Unified Proof-of-Delivery Audit Metadata

```javascript
// Verified against server/src/controllers/driverHudController.js:984-991
// and server/src/models/AuditEvent.js:21-43

const verificationMethods = [];
if (delivery.proofOfDelivery?.otpVerified || otp) verificationMethods.push('OTP');
if (signatureSvg) verificationMethods.push('SIGNATURE');
if (photoUrl) verificationMethods.push('PHOTO');

await AuditEvent.create({
  actorId: req.user.id,
  actorRole: req.user.role,
  action: `[DRIVER] Completed delivery for order ${delivery.orderReference} with POD`,
  type: AUDIT_EVENT_TYPES.POD_RECORDED,
  deliveryId: delivery._id,
  routeId: route?._id || null,
  metadata: {
    orderReference: delivery.orderReference,
    recipientName: recipientName || delivery.customer.name,
    verificationMethods,
    hasOtp: Boolean(otp || delivery.proofOfDelivery?.otp),
    otpVerified: Boolean(otpVerified),
    hasSignature: Boolean(signatureSvg),
    hasPhoto: Boolean(photoUrl),
    photoUrl: photoUrl || null,
    handoverNotes: handoverNotes || null,
    completedAt: new Date(),
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc per-service GIS failover | Centralized `MappingProviderFactory` with circuit breaker | Phase 18 | Prevents API thread starvation during external GIS outages; bounds latency to <= 3500ms. |
| HTTP-only location polling | Socket.IO bi-directional streaming (`driver:locationUpdated`) with REST fallback | Phase 18 | Drops telemetry lag from 10–30s to <50ms; reduces server HTTP connection overhead. |
| Ambiguous POD audit event payloads | Explicit `verificationMethods: ['OTP', 'SIGNATURE', 'PHOTO']` in audit logs | Phase 18 | Unambiguously satisfies enterprise compliance and claims dispute auditability. |
| Hardcoded wall-clock test assertions (`<5000ms`) | Adaptive throughput & environment-scaled assertions | Phase 18 | Eliminates false-positive CI pipeline cancellations in parallel GitHub Actions runners. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Socket.IO `reconnectionDelay` of 1500ms with jitter is sufficient for Bhubaneswar mobile carrier cell handoffs | Architecture Patterns | Low — can be fine-tuned without breaking protocol contracts. |

---

## Open Questions

1. **Should the mapping circuit breaker state be shared across multiple backend cluster workers or kept in-memory per worker?**
   - *What we know:* In the current single-instance / compose deployment, in-memory state is immediate and avoids Redis latency.
   - *What's unclear:* Under multi-instance clustering, workers evaluate circuit breakers independently.
   - *Recommendation:* Keep in-memory for Phase 18. Each worker independently detects 3 consecutive failures within seconds, which is standard for Node.js API services without external KV dependencies.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Monorepo runtime | ✓ | v22.12.0 [VERIFIED: node -v] | — |
| npm | Package management & audit | ✓ | 10.9.0 [VERIFIED: npm -v] | — |
| MongoDB | Core persistence & TTL indexes | ✓ | 6.0+ (Docker service in CI) | — |
| Geoapify Matrix API | Primary distance provider | ✓ | REST v1 | Deterministic `simulatedTrafficService.js` |
| Google Maps Distance Matrix | Secondary distance provider | ✓ | REST JSON | Deterministic `simulatedTrafficService.js` |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** External GIS APIs fail over to Bhubaneswar simulated matrix.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend Framework | Vitest 5.1.0 (`client/vitest.config.ts`) |
| Backend Framework | Jest 29.7.0 (`server/package.json`) |
| E2E Framework | Playwright 1.65.0 (`client/playwright.config.ts`) |
| Quick run command (Client) | `npm --prefix client run test:unit` |
| Quick run command (Server) | `npm --prefix server test -- server/tests/socket_auth.test.js` |
| Full suite command | `npm --prefix client run test:unit && npm --prefix server test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **CI-01** | Zero high/critical vulnerabilities & non-flaky adversarial benchmarks | Unit / Stress | `npm audit --audit-level=high && npm --prefix server test -- server/tests/adversarial_csv_batch.test.js` | ✅ `server/tests/adversarial_csv_batch.test.js` |
| **MAP-01** | `MappingProviderFactory` circuit breaker trips to simulation on 429/timeout | Unit / Integration | `npm --prefix server test -- server/tests/adversarial_mapping_stress.test.js` | ✅ `server/tests/adversarial_mapping_stress.test.js` |
| **TEL-01** | `driver:locationUpdated` socket event records telemetry & emits ping | Integration | `npm --prefix server test -- server/tests/socket_auth.test.js` | ✅ `server/tests/socket_auth.test.js` |
| **HUD-01** | Unified POD audit events record explicit `verificationMethods` (OTP, sig, photo) | Unit / E2E | `npm --prefix server test -- server/tests/driver_hud.test.js` | ✅ `server/tests/driver_hud.test.js` |

### Sampling Rate
- **Per task commit:** Run the targeted test file for that unit (`npm --prefix server test -- server/tests/<file>.test.js`).
- **Per wave merge:** Run full client unit test suite (`npm --prefix client run test:unit`) and core server regression suite.
- **Phase gate:** Full CI command pipeline (`npm --prefix client test`, `npm --prefix client run test:unit`, `npm --prefix server test`) completely green before completion.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT verification in HTTP `authenticateToken` middleware and WebSocket handshake `socketAuthMiddleware`. |
| V4 Access Control | Yes | BOLA protection preventing drivers from joining other driver rooms or transmitting telemetry under false IDs. |
| V5 Input Validation | Yes | Geographic coordinate bounds checking (`-180 <= lng <= 180`, `-90 <= lat <= 90`) and speed/heading numerical validation. |
| V10 Malicious Code Search | Yes | Pinned `npm audit --audit-level=high` in CI pipeline rejecting vulnerable supply-chain dependencies. |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Telemetry Spoofing (BOLA) | Spoofing | Bind `driverId` to authenticated JWT user context on server; never trust unverified client payload IDs. |
| Coordinate Tampering / Boundary Abuse | Tampering | Strict validation rejecting `NaN`, non-numbers, out-of-bounds lat/lng, and impossible vehicle speeds (>150 km/h). |
| Upstream GIS DoS / Resource Exhaustion | Denial of Service | 3500ms timeout with circuit breaker tripping to local simulated matrix on HTTP 429. |
| Sensitive Proof-of-Delivery Exposure | Information Disclosure | Store customer signatures and delivery photos in secure object storage; never leak customer OTPs to client endpoints. |

---

## Sources

### Primary (HIGH confidence)
- `server/src/services/mapping/geoapify.service.js:33-77` — Geoapify distance matrix implementation and 8000ms timeout
- `server/src/services/mapping/googleMapsService.js:31-69` — Google Maps Distance Matrix implementation and retry backoff
- `server/src/services/mapping/simulatedTrafficService.js:1-120` — Bhubaneswar road topology and deterministic traffic multipliers
- `server/src/middleware/socketAuth.js:43-160` — Socket.IO handshake JWT authentication and room authorization
- `server/src/services/telemetryService.js:15-100` — Consented GPS logging, coordinate bounds validation, and alert rules
- `server/src/controllers/driverHudController.js:935-1005` — Driver HUD delivery completion and existing POD audit events
- `client/src/context/DriverSocketContext.tsx:189-420` — Client socket lifecycle, room subscription, and location transmission
- `client/src/pages/admin/TrackingPage.tsx:170-250` — Control center telemetry consumption and map marker updates
- `.github/workflows/ci.yml:10-97` — GitHub Actions pipeline stages, services, and test runner invocations

### Secondary (MEDIUM confidence)
- Official Socket.IO Documentation: Acknowledgement callbacks and room emission mechanics (`socket.io/docs/v4/`)
- Vite 8 / Vitest 5 migration guides: Oxc/Rolldown transformation flags

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Directly inspected repository manifests (`package.json`, `client/package.json`, `server/package.json`)
- Architecture: HIGH — Validated all integration points across server mapping, socket gateway, and client HUD
- Pitfalls: HIGH — Root causes of CI test flakiness and mapping failover verified against empirical test logs

**Research date:** 2026-11-15
**Valid until:** 2026-12-15 (30 days)
