# Phase 19: E2E Test Suite Stabilization & Automated CI Verification - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate Playwright E2E test runner failures (`connect ECONNREFUSED ::1:5004`), establish automated dual-process webServer orchestration (backend port 5004 + client port 5173), configure isolated database fixtures, guarantee robust `bootstrapAdmin` credential defaults, resolve Vite deprecation warnings, and integrate the headless Chromium E2E suite as a reliable gate in GitHub Actions CI.

</domain>

<decisions>
## Implementation Decisions

### 1. Server Orchestration & Playwright Lifecycle
- **D-01:** Configure dual `webServer` array in `client/playwright.config.ts` — Playwright must automatically boot both the backend server (on port 5004 with `/api/v1/healthz` health verification) and the client frontend (on port 5173 with Vite) before executing global auth setup or test specs. — **Reversibility:** reversible — Standard Playwright configuration feature.
- **D-02:** Support `reuseExistingServer: !process.env.CI` for both servers so developers can run tests against already running servers locally while CI always spins up clean isolated instances.

### 2. Database Strategy & Environment Isolation
- **D-03:** Execute E2E runs against an isolated test database (`MONGODB_URI` pointing to `smartroute_e2e` or dedicated test database) to prevent mutating development data and ensure deterministic test states. — **Reversibility:** reversible — Controlled via environment variables.
- **D-04:** Provide resilient default test credentials (`ADMIN_EMAIL=admin@smartroute.internal`, compliant default test passwords) in test configurations and `bootstrapAdmin.js` to prevent unhandled email validation errors when run in headless CI environments.

### 3. CI Pipeline Integration & Artifact Diagnostics
- **D-05:** Integrate `npm --prefix client run test:e2e -- --project=chromium` into `.github/workflows/ci.yml` as a required pull-request and push gate.
- **D-06:** Configure CI step to upload Playwright HTML test report, traces, and screenshots on failure (`if: failure()`) as GitHub Actions artifacts for swift debugging.

### 4. Build Cleanliness & Deprecation Resolution
- **D-07:** Update `client/vite.config.ts` to replace deprecated `__dirname` with `import.meta.dirname` and clean up `rolldownOptions` / `oxc` plugin warnings to maintain clean, future-proof build logs.

### the agent's Discretion
- Readiness probe timeouts and retry intervals for backend health checks (e.g. 120s timeout in `playwright.config.ts`).
- Modular structure of test fixtures and helper scripts for multi-role session state (`admin`, `dispatcher`, `driver`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### E2E Testing & Orchestration
- `client/playwright.config.ts` — Playwright runner configuration, webServer settings, and project targets.
- `client/tests/e2e/auth.setup.ts` — Global setup script for generating auth storage states across user roles.
- `client/tests/e2e/auth.teardown.ts` — Global teardown and storage state cleanup.

### Server Bootstrap & Health
- `server/src/scripts/bootstrapAdmin.js` — Initial admin seeding script and validation requirements.
- `server/src/server.js` — Backend startup, `/healthz` and `/readyz` endpoints, port configuration.

### CI Workflow
- `.github/workflows/ci.yml` — Continuous Integration pipeline and automated test matrix.
</canonical_refs>
