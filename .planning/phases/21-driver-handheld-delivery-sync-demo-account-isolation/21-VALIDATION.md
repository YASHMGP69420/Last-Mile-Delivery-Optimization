---
phase: "21"
slug: "driver-handheld-delivery-sync-demo-account-isolation"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-20"
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `^29.7.0` (Backend) + Vitest `^5.1.0` (Frontend) |
| **Config file** | `server/package.json` (`test` script) & `client/vite.config.ts` |
| **Quick run command** | `npm --prefix server test -- tests/phase21_driver_sync_demo_isolation.test.js` |
| **Full suite command** | `npm --prefix server test && npm --prefix client run test:unit && npm --prefix client run test` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick unit/integration test for affected component
- **After every plan wave:** Run full test suite (`npm --prefix server test -- tests/phase21_driver_sync_demo_isolation.test.js && npm --prefix client run test:unit`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | DRIVER-SYNC-01 | T-21-03 | Handheld joins driver/route socket rooms securely; focus/visibilitychange re-fetches state debounced | integration | `npm --prefix server test -- tests/phase21_driver_sync_demo_isolation.test.js -t "DRIVER-SYNC-01"` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | DRIVER-SYNC-02 | T-21-04 | Dual-model atomic stop progression across ARRIVED, COMPLETED, FAILED and broadcasts across route and management rooms | integration | `npm --prefix server test -- tests/phase21_driver_sync_demo_isolation.test.js -t "DRIVER-SYNC-02"` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 1 | DEMO-ISOLATION-01 | T-21-01 | Backend returns 403 DEMO_ISOLATION_VIOLATION on cross-boundary dispatch, push, or assignment | integration | `npm --prefix server test -- tests/phase21_driver_sync_demo_isolation.test.js -t "DEMO-ISOLATION-01"` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | DEMO-ISOLATION-01 | T-21-01 | Dispatcher UI filters driver and vehicle selection dropdowns by demo status | unit | `npm --prefix client run test:unit -- -t "DEMO-ISOLATION-01"` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 2 | DEMO-ISOLATION-02 | T-21-02 | DriverCockpitPage and DriverRoutePage display sticky amber demo indicator banner when user.isDemoData is true | unit | `npm --prefix client run test:unit -- -t "DEMO-ISOLATION-02"` | ❌ W0 | ⬜ pending |
| 21-02-03 | 02 | 2 | DRIVER-SYNC-01 | T-21-03 | Mobile driver cockpit/route views reconcile active route on visibilitychange/focus and socket reconnect | unit / typecheck | `npm --prefix client run test -- --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/tests/phase21_driver_sync_demo_isolation.test.js` — test suite for socket sync, dual-model atomic updates, and demo isolation backend guards
- [ ] `client/src/pages/driver/__tests__/DriverCockpitDemoBanner.test.tsx` — unit tests for demo banner rendering and focus re-sync

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real hardware phone screen lock / unlock re-sync | DRIVER-SYNC-01 | Physical device sleep event simulation in browser devtools | Open Driver Cockpit on mobile Chrome, lock screen, unlock screen, verify active route state is refreshed without manual reload |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-20
