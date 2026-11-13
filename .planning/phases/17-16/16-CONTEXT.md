---
phase: 16
slug: test-infrastructure-admin-features
status: context-gathered
created: "2026-11-13"
---

# Phase 16 Context — Test Infrastructure & Admin Features

> Decisions captured from interactive discussion on 2026-11-13. These decisions guide research and planning for the next milestone (v8).

---

## Milestone v8 Scope

**Theme:** Test Infrastructure Hardening + Admin Features + POD Enhancement

**Target:** Achieve Nyquist compliance for Phase 15, add Admin User Management UI, make POD OTP optional, add E2E tests.

---

## Decisions

### A. Frontend Test Framework (Vitest + RTL)
- **Framework:** Vitest + React Testing Library (Vite-native, modern)
- **Scope:** All 10 missing component tests for Phase 15 requirements (D-02 through D-12):
  - CurrentRouteCard (vehicle assignments, Change Vehicle/Driver)
  - BatchComposerPanel (no dropdowns, empty arrays)
  - ConsignmentDrawer (batch status chip, no fleet UI)
  - DriversPage (no assign vehicle, onboard form)
  - FleetsPage (no Assigned Driver column)
  - DispatchConfirmationModal (multi-bin dispatch)
  - RouteComparisonDrawer (bin tabs, aggregate totals)
- **CI Integration:** Add to `.github/workflows/ci.yml` alongside server tests
- **Commands:** `npm --prefix client run test:unit` (new), keep `test` as `tsc --noEmit`

### B. Backend Test Coverage (All 5 Gaps)
- **Target:** `server/tests/routes.test.js` (existing patterns)
- **Gaps to cover:**
  - BE-01: `vehicleAssignments[]` in optimize response (High)
  - BE-02: Driver auto-assignment round-robin (High)
  - BE-03: Override re-optimization with vehicleIds/driverId (High)
  - BE-04: Multi-bin response with full per-bin data (Medium)
  - BE-05: Zone-aware bin grouping enhancement (Medium)
- **Pattern:** Follow existing test suites (real MongoDB test DB, Supertest, Jest)

### C. Plan Fixes (Quick Tasks)
- **Blocker:** Add `depends_on: ["15-07"]` to 15-08 frontmatter (resolve useOptimization.ts conflict)
- **Warnings:**
  - Add DISPATCH-12 requirement for D-05 (driver auto-assignment)
  - Move 15-04/15-05 from wave 2 → wave 1
  - Declare `coupling_justified` for 15-01/15-02 on routeApi.ts
  - Reframe implementation-focused truths as user-observable
  - Document 15-08 split: (a) backend response, (b) CurrentRouteCard multi-bin, (c) Dispatch+Comparison
- **Execution:** As quick tasks (`/gsd-quick`), not a full phase

### D. Security Hardening
- **Dependabot:** Enable GitHub Dependabot alerts (free, native)
- **Human Checkpoint:** Document in `SECURITY.md` for [ASSUMED]/[SUS] packages
- **Monitoring:** Watch upstream for `jest`/`deepmerge` fix (AR-15-04)
- **Priority:** v8

### E. Pre-Existing Test Failures
- **Decision:** Dedicated "Test Infrastructure Repair" phase AFTER v8
- **Reason:** 14 failing suites + Tier 4 E2E broken are pre-existing, not Phase 15 regressions
- **Scope:** Fix `phase09_guards`, `auth_refresh`, `shift_telemetry_savings`, `analytics_prd`, `deliveryController` + Tier 4 `seedBhubaneswar` import

### F. Admin User Management UI (Full CRUD)
- **Scope:** Full CRUD (list, create, edit, delete) — ADMIN only
- **Route:** `/admin/users` (new page)
- **Backend:** Existing Last-Admin protection + Jest tests remain
- **Priority:** v8

### G. POD OTP Verification (Optional)
- **Flow:** Optional OTP + picture capture (skippable, not mandatory)
- **Feature Flag:** Dev feature flag to enable/disable
- **Channel:** SMS OTP only (matches existing infrastructure)
- **Backend:** New endpoint `POST /api/v1/deliveries/:id/verify-pod-otp` (optional)
- **Priority:** v8

### H. E2E Test Framework (Playwright)
- **Framework:** Playwright (modern, multi-browser, better CI)
- **Critical Flows (4):**
  1. Batch creation → optimization → dispatch (single + multi-bin)
  2. Driver login → route view → POD capture
  3. Mid-shift re-optimization (HEAVY_TRAFFIC)
  4. Admin analytics dashboard
- **CI:** Run on PR
- **Priority:** v8

---

## Phase 16 Plan Structure (Proposed)

| Plan | Description | Wave | Depends On |
|------|-------------|------|------------|
| 16-01 | Frontend test framework setup (Vitest + RTL + CI) | 1 | [] |
| 16-02 | Backend test coverage (BE-01 to BE-05) | 1 | [] |
| 16-03 | Admin User Management UI (CRUD) | 2 | [16-01] |
| 16-04 | POD OTP optional + feature flag | 2 | [16-01] |
| 16-05 | Playwright E2E setup + 4 critical flows | 3 | [16-01, 16-03] |
| 16-06 | Security hardening (Dependabot, SECURITY.md) | 1 | [] |
| 16-07 | Plan fixes (quick tasks: blocker + warnings) | 1 | [] |

---

## Requirements Traceability

| Req ID | Description | Origin | Plan(s) |
|--------|-------------|--------|---------|
| TEST-01 | Frontend unit/component tests for all Phase 15 UI | 15-VALIDATION.md | 16-01 |
| TEST-02 | Backend tests for vehicleAssignments, driver assignment, override, multi-bin | 15-VALIDATION.md | 16-02 |
| ADMIN-01 | Admin User Management CRUD UI | PROJECT.md (D-17) | 16-03 |
| POD-01 | Optional POD OTP + picture with feature flag | Discussion | 16-04 |
| TEST-03 | E2E tests for 4 critical dispatch flows | Discussion | 16-05 |
| SEC-01 | Dependabot alerts + human checkpoint process | 15-SECURITY.md | 16-06 |
| PLAN-01 | Fix Phase 15 plan blockers/warnings | 15-VERIFICATION.md | 16-07 |

---

## Out of Scope for v8

- Pre-existing test failure fixes (dedicated phase after v8)
- Zone-aware bin grouping enhancement (BE-05, Medium priority, can defer)
- Email OTP for POD (SMS only)
- Full edit/delete for Admin UI beyond CRUD scope

---

## Success Criteria for v8

1. ✅ Nyquist compliant for Phase 15 (all 10 frontend + 5 backend tests passing)
2. ✅ Admin User Management CRUD at `/admin/users` (ADMIN only)
3. ✅ POD OTP optional with feature flag, SMS only
4. ✅ Playwright E2E for 4 critical flows running on PR
5. ✅ Dependabot enabled, SECURITY.md updated
6. ✅ Phase 15 plan metadata fixed (blocker + warnings)
7. ✅ All v8 plans executed, verified, committed

---

## Next Steps

1. Run `/gsd-new-milestone` to initialize v8 milestone
2. Run `/gsd-plan-phase` for Phase 16 with above structure
3. Execute plans with `/gsd-execute-phase`
4. Verify with `/gsd-verify-work`
5. Complete milestone with `/gsd-complete-milestone`