---
phase: "19"
slug: "continue-execution-from-antigravity"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-19"
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test ^1.65.0 |
| **Config file** | `client/playwright.config.ts` |
| **Quick run command** | `npm --prefix client run test:e2e -- --project=chromium -g "loads and displays KPIs"` |
| **Full suite command** | `npm --prefix client run test:e2e -- --project=chromium` |
| **Estimated runtime** | ~15-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix client run test:e2e -- --project=chromium -g "loads and displays KPIs"`
- **After every plan wave:** Run `npm --prefix client run test:e2e -- --project=chromium`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | E2E-01 | T-19-01 | Express root & API route alias `/api/v1/healthz` responding 200 OK | config | `npm --prefix server test -- server/tests/health.test.js` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | E2E-01 | T-19-01 | Dual webServer boots backend and frontend automatically without IPv6 connection drops | e2e | `npm --prefix client run test:e2e -- --project=chromium --list` | ✅ | ⬜ pending |
| 19-01-03 | 01 | 1 | E2E-02 | T-19-02 | Non-production fallback defaults for bootstrapAdmin prevent fatal schema crashes | unit | `npm --prefix server run seed:admin` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 2 | E2E-03 | T-19-03 | Global auth setup authenticates and generates storage states for admin, dispatcher, driver | e2e | `npm --prefix client run test:e2e -- --project=chromium tests/e2e/auth.spec.ts` | ✅ | ⬜ pending |
| 19-02-02 | 02 | 2 | E2E-03 | T-19-04 | Critical path E2E flows (admin, dispatcher, driver) pass green in headless Chromium | e2e | `npm --prefix client run test:e2e -- --project=chromium` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 3 | CI-02 | T-19-05 | GitHub Actions runs E2E tests with Playwright browser installation and report artifacts on failure | ci | `npm --prefix client run test:e2e -- --project=chromium` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All 4 test spec files (`admin.spec.ts`, `dispatcher.spec.ts`, `driver.spec.ts`, `auth.spec.ts`), global setup scripts, and GitHub Actions workflows exist in the repository.

---

## Manual-Only Verifications

All phase behaviors have automated verification via Playwright E2E and Jest integration tests.

---

## Validation Sign-Off

- [ ] All per-task verification commands pass
- [ ] No manual-only tests without documented verification
- [ ] Full headless Chromium suite passes in `npm --prefix client run test:e2e -- --project=chromium`
