---
phase: quick-261112-0sn
plan: 01
subsystem: auth
tags: [demo-showcase, auth, react, express, jwt, mongodb, isolation]
status: complete
requires: []
provides:
  - "POST /api/v1/auth/demo-login endpoint backed by ensureDemoShowcaseUser(role) with strict isDemoData=true isolation"
  - "3-card Demo Showcase Profiles grid (Admin, Manager, Demo Driver) on LoginPage with AuthContext.demoLogin"
  - "DEMO session badges in AdminHeader and DriverHeader plus DemoDatasetPanel cleanup clarification"
affects:
  - server/src/services/demoDataService.js
  - server/src/controllers/authController.js
  - server/src/routes/authRoutes.js
  - client/src/pages/LoginPage.tsx
  - client/src/context/AuthContext.tsx
tech-stack:
  added: []
  patterns:
    - "Role-allowlisted public demo showcase endpoint with rate limiting and isDemoData=true isolation guard"
    - "Idempotent auto-import of curated Bhubaneswar demo dataset on first demo showcase sign-in"
key-files:
  created: []
  modified:
    - server/src/services/demoDataService.js
    - server/src/controllers/authController.js
    - server/src/routes/authRoutes.js
    - server/tests/demo_data.test.js
    - client/src/types/index.ts
    - client/src/api/client.ts
    - client/src/context/AuthContext.tsx
    - client/src/pages/LoginPage.tsx
    - client/src/components/layout/AdminHeader.tsx
    - client/src/components/layout/DriverHeader.tsx
    - client/src/components/dashboard/DemoDatasetPanel.tsx
key-decisions:
  - "Pre-check existing non-demo users at the target demo email before calling importDemoDataset so real account collisions fail closed with 403 DEMO_USER_ISOLATION_VIOLATION instead of hitting duplicate-key errors"
  - "Generate random 32-char hex password seeds for demo.admin and demo.manager instead of weak hardcoded passwords while preserving driverCredentials strictly for demo drivers"
patterns-established:
  - "All demo showcase auth responses expose user.isDemoData boolean so UI headers can surface isolated demo session badges"
requirements-completed:
  - DEMO-SHOWCASE-01
duration: 11min
completed: 2026-11-12
commits: 3
plan_head_before: f64017819b322ac76afc5d5f0f242fb42baef40e
plan_head_after: 3d70f8c266269d233d674cd0d5055fdcead3056d
---

# Quick Task 261112-0sn Summary: Demo Showcase Profiles

**One-click isolated Demo Showcase Profiles (Admin, Manager, Demo Driver) restored on LoginPage via rate-limited `POST /api/v1/auth/demo-login` and `isDemoData=true` Bhubaneswar dataset auto-provisioning.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-12T00:38:07Z
- **Completed:** 2026-11-12T00:49:06Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `DEMO_SHOWCASE_PROFILES`, `demo.admin@smartroute.local` creation in `importDemoDataset`, and `ensureDemoShowcaseUser(role)` in [demoDataService.js](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/services/demoDataService.js) with idempotent auto-import and hard `isDemoData === true` isolation.
- Added `demoLogin` controller and `isDemoData` serialization across `buildAuthUserPayload`, `login`, and `getMe` in [authController.js](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/controllers/authController.js), wired to rate-limited `POST /api/v1/auth/demo-login` in [authRoutes.js](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/src/routes/authRoutes.js).
- Restored the 3-card Demo Showcase Profiles grid (`Admin`, `Manager`, `Demo Driver`) on [LoginPage.tsx](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/LoginPage.tsx) backed by `AuthContext.demoLogin` ([AuthContext.tsx](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/context/AuthContext.tsx)), updated the 401 refresh guard in [client.ts](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/api/client.ts) and `User` type in [index.ts](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/types/index.ts), and added `DEMO` session indicators in [AdminHeader.tsx](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/layout/AdminHeader.tsx), [DriverHeader.tsx](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/layout/DriverHeader.tsx), and [DemoDatasetPanel.tsx](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/components/dashboard/DemoDatasetPanel.tsx).
- Added `TC-DEMO-5` and `TC-DEMO-6` integration tests in [demo_data.test.js](file:///C:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/server/tests/demo_data.test.js) covering auto-import, role payloads, protected endpoint access, invalid role rejection (`400 INVALID_DEMO_ROLE`), real-account collision isolation (`403 DEMO_USER_ISOLATION_VIOLATION`), `bootstrapAdmin` independence, and `DELETE /api/v1/admin/demo-data` cleanup.

## Task Commits

1. **Task 1: Isolated demo showcase provisioning & demo-login endpoint** - `1ed4d6a` (feat)
2. **Task 2: Demo Showcase Profiles UI & demo session indicators** - `83472bc` (feat)
3. **Task 3: Demo showcase integration tests (`TC-DEMO-5`, `TC-DEMO-6`)** - `3d70f8c` (test)

## Decisions Made

- Pre-check for an existing non-demo user at the target `demo.*@smartroute.local` email before calling `importDemoDataset()` so real-account collisions fail closed immediately with `403 DEMO_USER_ISOLATION_VIOLATION`.
- Preserve `driverCredentials` query scope (`{ isDemoData: true, role: ROLES.DRIVER }`) so `TC-DEMO-4` and the Admin Demo Driver Credentials table remain strictly focused on the 3 demo drivers.

## Deviations from Plan

None - plan executed as specified, with the pre-import isolation check ordered ahead of `importDemoDataset()` inside `ensureDemoShowcaseUser` to prevent duplicate-key errors on real-account email collisions.

## Verification Results

- `npm --prefix server test`: 29/29 suites passed, 333/333 tests passed (including `tests/demo_data.test.js`, `tests/env_docs_audit.test.js`, `tests/auth_otp_google.test.js`, `tests/auth_refresh.test.js`, `tests/ops_bootstrap_smoke.test.js`). *(Note: an earlier full-suite run saw `ADV-CSV-5` hit 6244 ms vs 6000 ms under load; isolated `adversarial_csv_batch.test.js` passed in 4330 ms and the subsequent full `npm --prefix server test` run passed 29/29 suites.)*
- `npm --prefix client test` (`tsc --noEmit`): passed with 0 errors.
- `npm --prefix client run build` (`tsc && vite build`): built cleanly (`dist/assets/index-BZaF5wg7.js`, 0 errors).

## Self-Check: PASSED

- All 11 modified files exist and match committed state (`git status --short` shows only untracked `.planning/` directories).
- All 3 task commits (`1ed4d6a`, `83472bc`, `3d70f8c`) are ancestors of `HEAD` (`3d70f8c`).
