---
phase: "09"
slug: "operational-guards-and-validation-polish"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-10"
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: Jest `^29.7.0` + Supertest `^6.3.4`; Frontend: TypeScript `tsc --noEmit` + Vite production build |
| **Config file** | `server/jest.config.js`, `client/tsconfig.json` |
| **Quick run command** | `npm --prefix server test -- tests/phase09_guards.test.js && npm --prefix client test` |
| **Full suite command** | `npm --prefix server test && npm --prefix client run build` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix server test -- tests/phase09_guards.test.js && npm --prefix client test`
- **After every plan wave:** Run `npm --prefix server test -- tests/phase09_guards.test.js tests/shift_telemetry_savings.test.js tests/fleet.test.js tests/deliveries.test.js tests/driver_hud.test.js tests/admin_control.test.js tests/adversarial_csv_batch.test.js && npm --prefix client test`
- **Before `/gsd-verify-work`:** Full `npm --prefix server test` and `npm --prefix client run build` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision / Req | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | D-01..D-08, D-11, D-13 | T-09-01, T-09-02 | `lastOdometerKm`, `tankCapacityLitres`, `lastFuelLitres` telemetry continuity; `MAINTENANCE`/`RETIRED` shift block; terminal delivery state lock + BOLA | integration | `npm --prefix server test -- tests/phase09_guards.test.js tests/shift_telemetry_savings.test.js tests/driver_hud.test.js` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | D-09, D-12, D-14, D-15, D-16, D-17 | T-09-03, T-09-04 | Delivery create/edit parity, active-shift/route retire/re-pair block, maintenance date/cost validation, CSV dry-run DB dup check, batch active guards, Last-Admin lockout block | integration | `npm --prefix server test -- tests/phase09_guards.test.js tests/fleet.test.js tests/deliveries.test.js tests/admin_control.test.js tests/adversarial_csv_batch.test.js` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | D-02, D-04..D-08, D-10, D-11 | — | Telemetry & Inspection forms show `'Last recorded'` hint without prefill, clock-out refuel inline warning, L vs % unit alignment, inspection warning banner | typecheck + build | `npm --prefix client test && npm --prefix client run build` | ✅ | ⬜ pending |
| 09-04-01 | 04 | 2 | D-01, D-03, D-06, D-09, D-10, D-16 | — | Admin Vehicles edit modal (`lastOdometerKm` override, `tankCapacityLitres`), Consignment create/edit full parity, non-blocking batch multi-vehicle warning | typecheck + build | `npm --prefix client test && npm --prefix client run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/tests/phase09_guards.test.js` — integration tests covering D-01..D-17 backend guards, schema invariants, and backward compatibility with existing suites.

*Existing `server/tests/setup.js` and `client` TypeScript/Vite tooling cover test execution.*

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Clock In / Pre-Trip Inspection shows `'Last recorded: X km / Y L'` hint cleanly in dark mode without prefilling input | D-02, D-04, D-08 | Browser visual verification of modal UI & warning styling | Open Driver Cockpit / Pre-Trip Inspection in dev UI, trigger Clock In modal, verify badge & inline error when entering `< lastOdometerKm`. |
| Clock Out non-blocking inline warning when closing fuel > starting fuel | D-05 | Visual confirmation of amber warning banner without blocking submit | Start shift with 10 L, open Clock Out modal, enter 15 L, verify warning displays and submit succeeds. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers MISSING test suite (`server/tests/phase09_guards.test.js`)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-10
