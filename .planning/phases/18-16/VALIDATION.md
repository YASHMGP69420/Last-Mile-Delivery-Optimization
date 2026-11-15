---
phase: "18"
slug: "production-ci-stabilization-real-time-telemetry-driver-hud"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 (Backend), Vitest 5.1.0 (Frontend), Playwright 1.65.0 (E2E) |
| **Config file** | `server/package.json`, `client/vitest.config.ts`, `client/playwright.config.ts` |
| **Quick run command** | `npm --prefix client run test:unit && npm --prefix server test -- server/tests/socket_auth.test.js` |
| **Full suite command** | `npm --prefix client run test:unit && npm --prefix server test` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted test command
- **After every plan wave:** Run `npm --prefix client run test:unit && npm --prefix server test`
- **Before `/gsd-verify-work`:** Full suite and CI validation pipeline must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | CI-01 | T-18-01 | Supply chain security clean; adaptive benchmarking throughput | Unit / Stress | `npm audit --audit-level=high && npm --prefix server test -- server/tests/adversarial_csv_batch.test.js` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 1 | MAP-01 | T-18-02 | Circuit breaker trips to simulation on 429/timeout <= 3500ms | Unit / Integration | `npm --prefix server test -- server/tests/adversarial_mapping_stress.test.js` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 2 | TEL-01 | T-18-03 | Authenticated driver streaming via `driver:locationUpdated` | Integration | `npm --prefix server test -- server/tests/socket_auth.test.js` | ✅ | ⬜ pending |
| 18-04-01 | 04 | 2 | HUD-01 | T-18-04 | Audit events record standard verificationMethods (OTP, sig, photo) | Unit / E2E | `npm --prefix server test -- server/tests/driver_hud.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing test infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Why Manual-Only | Mitigation / Tool |
|----------|-----------------|-------------------|
| Real-time Map Marker Movement | Visual verification of car animation | Live Tracking Page inspection with simulated driver socket |
| Mobile Screen Viewport Rendering | Physical viewport inspection | Chrome DevTools device mode (390x844 iPhone 12) |
