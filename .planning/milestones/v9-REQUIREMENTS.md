# Requirements Archive: v9 Telemetry, Driver HUD & Stabilized E2E CI Gating

**Archived:** 2026-11-19  
**Status:** SHIPPED  

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: SmartRoute — Telemetry, Driver HUD & Stabilized E2E CI Gating (v9)

**Defined:** 2026-11-14  
**Core Value:** Calculate fuel-optimal, traffic-aware delivery routes end-to-end across dispatchers and field drivers while maintaining strict operational data integrity, real-time synchronization, and honest production telemetry.

## v9 Requirements

Requirements for Milestone **v9 — Telemetry, Driver HUD & Stabilized E2E CI Gating**. Each requirement maps to an atomic phase (`18`–`19`) in [ROADMAP.md](./ROADMAP.md).

### Phase 18: Production CI Stabilization & Real-Time Telemetry/Driver HUD Integration

- [x] **CI-01**: Supply-chain security audit is pinned with `npm audit --audit-level=high` (0 high/critical vulnerabilities), and adversarial batch ingestion and optimizer stress tests utilize adaptive throughput metrics and CI duration ceilings instead of fragile wall-clock limits.
- [x] **MAP-01**: Multi-provider mapping failovers operate through a 3-state circuit breaker (CLOSED, OPEN, HALF_OPEN) with a 3500ms timeout SLA, immediate fallback to simulated matrix on HTTP 429 quota exhaustion with zero retry burn, and a 30-second self-healing probe.
- [x] **TEL-01**: Real-time Socket.IO driver telemetry streaming (`driver:locationUpdated`) validates driver session BOLA ownership, records battery SoC, speed, heading, and coordinates with sub-50ms latency, falls back to REST on ack timeout, and synchronizes active driver route rooms (`route:join`).
- [x] **HUD-01**: Consolidated proof-of-delivery audit logs emit `AUDIT_EVENT_TYPES.POD_RECORDED` with explicit `verificationMethods: ['OTP', 'SIGNATURE', 'PHOTO']` across both driver HUD and dispatch controllers, paired with responsive tablet and desktop layouts for Driver HUD and Cockpit.

### Phase 19: E2E Test Suite Stabilization & Automated CI Verification

- [x] **E2E-01**: Playwright test runner simultaneously orchestrates backend (port 5004) and frontend (port 5173) using dual `webServer` array with an Express `/api/v1/healthz` readiness probe, explicit `127.0.0.1` IPv4 loopback binding, and Node 20.11+ ESM `import.meta.dirname` path resolution.
- [x] **E2E-02**: Dedicated test database `mongodb://127.0.0.1:27017/smartroute_e2e` is isolated from development and production environments, seeded with resilient `bootstrapAdmin.js` fallbacks and unique vehicle-driver assignments, and generates multi-role auth storage states for `admin`, `manager`, and `driver`.
- [x] **E2E-03**: All 4 critical E2E user flows execute and pass 100% (12/12 tests green) in headless Chromium: Admin Analytics (5/5), Batch Dispatch (2/2), Driver POD (3/3), and Mid-Shift Re-Optimization (2/2) with Socket.IO realtime push notifications.
- [x] **CI-02**: GitHub Actions CI workflow provisions Playwright Chromium with system dependencies (`npx playwright install chromium --with-deps`), gates PR merges on full E2E execution, and retains HTML reports (`always()`) and failure traces/videos (`failure()`) with 7-day retention.

---

## Traceability & Verification Matrix

| Requirement | Phase | Plan | VERIFICATION.md | Integration Check | Final Status |
|---|---|---|---|---|---|
| `CI-01` | Phase 18 | `18-01` | Passed | Passed (`adversarial_*.test.js`, `ci.yml`) | **Satisfied** |
| `MAP-01` | Phase 18 | `18-02` | Passed | Passed (`mappingProviderFactory.js`, `geoapify.service.js`) | **Satisfied** |
| `TEL-01` | Phase 18 | `18-03` | Passed | Passed (`socketAuth.js`, `DriverSocketContext.tsx`, `DriverCockpitPage.tsx`) | **Satisfied** |
| `HUD-01` | Phase 18 | `18-04`, `18-05` | Passed | Passed (`driverHudController.js`, `deliveryController.js`, `PODModal.tsx`, `DriverLayout.tsx`) | **Satisfied** |
| `E2E-01` | Phase 19 | `19-01` | Passed | Passed (`client/playwright.config.ts`, `server/src/routes/index.js`) | **Satisfied** |
| `E2E-02` | Phase 19 | `19-02` | Passed | Passed (`bootstrapAdmin.js`, `seedTestUsers.js`, `auth.setup.ts`) | **Satisfied** |
| `E2E-03` | Phase 19 | `19-02` | Passed | Passed (`admin-analytics.spec.ts`, `batch-dispatch.spec.ts`, `driver-pod.spec.ts`, `midshift-reoptimize.spec.ts`) | **Satisfied** |
| `CI-02` | Phase 19 | `19-03` | Passed | Passed (`.github/workflows/ci.yml` `e2e-tests` job & artifact retention) | **Satisfied** |
