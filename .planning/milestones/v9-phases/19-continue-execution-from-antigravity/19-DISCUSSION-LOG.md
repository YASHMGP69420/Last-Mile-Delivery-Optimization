# Phase 19: E2E Test Suite Stabilization & Automated CI Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-19
**Phase:** 19-e2e-test-suite-stabilization-and-ci-verification
**Areas discussed:** Primary Objective, Server Orchestration, Database Strategy, CI Integration

---

## 1. Primary Objective

| Option | Description | Selected |
|--------|-------------|----------|
| E2E Test Stabilization & Automated CI Verification | Fix Playwright test runner, bootstrapAdmin environment, and automated multi-role E2E suites | ✓ |
| Production Cloud Deployment & Docker Smoke Verification | Containerized Nginx + Node + Mongo validation and live production health checks | |
| Real-Time Customer Live Tracking Portal | Public tracking link for customers with real-time driver ETA and map view | |
| Fleet Management Enhancements | Multi-depot routing, vehicle maintenance tracking, and fuel cost analytics | |

**User's choice:** E2E Test Stabilization & Automated CI Verification
**Notes:** Selected to resolve connection refused errors, bootstrap admin errors, and provide a fully automated, reliable E2E test gate.

---

## 2. Server Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Dual webServer in Playwright config | Playwright automatically launches both backend (port 5004) and client (port 5173) if not already running | ✓ |
| Concurrently orchestration script | Dedicated script boots test backend + client and then runs Playwright | |

**User's choice:** Dual webServer in Playwright config
**Notes:** Native Playwright configuration ensures server lifecycle is managed cleanly with health checks before global setup runs.

---

## 3. Database Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Isolated test database | MONGODB_URI with smartroute_test / in-memory fixtures to ensure clean isolation | ✓ |
| Local MongoDB with demo seed data | Run against local MongoDB using isDemoData: true fixtures | |

**User's choice:** Isolated test database
**Notes:** Prevents mutation of development data and guarantees fresh state for every E2E run.

---

## 4. CI Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Automated GitHub Actions CI gate | Run headless Chromium E2E suite on every push/PR with trace uploads on failure | ✓ |
| Local-only npm test:e2e script | Keep E2E tests local with manual CI trigger | |

**User's choice:** Automated GitHub Actions CI gate
**Notes:** Ensures all 4 critical E2E flows are verified automatically in GitHub Actions on every commit and PR.

---

## the agent's Discretion

- Readiness timeouts and retry bounds for server health verification.
- Clean up of Vite build warnings (`__dirname` replacement with `import.meta.dirname`).
- Multi-role fixture generation structure in `auth.setup.ts`.

## Deferred Ideas

- None.
