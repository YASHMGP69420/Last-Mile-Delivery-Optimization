---
phase: 19-continue-execution-from-antigravity
plan: "03"
subsystem: ci
tags: [github-actions, ci, playwright, artifacts, gating]

requires:
  - phase: 19-02
    provides: Stabilized 4 critical E2E user flows passing 100% in headless Chromium
provides:
  - Playwright Chromium provisioning with OS dependencies in CI
  - Streamlined e2e-tests job utilizing Playwright dual webServer orchestration
  - Automated diagnostic artifact capture (HTML report on always(), traces on failure())
affects: [ci, pull-requests]

actuals:
  tokens: 880
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: [native-webserver-ci, test-gating, diagnostic-artifact-capture]

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Eliminated legacy manual nohup server background script in CI in favor of Playwright's native dual webServer array, avoiding port collisions and race conditions"
  - "Configured actions/upload-artifact@v4 with 7-day retention for both HTML reports and failure traces/screenshots"

requirements-completed:
  - CI-02

verification:
  - kind: script
    ref: "node -e '...' checks on ci.yml"
    status: pass
    details: "YAML syntax verified, command npm --prefix client run test:e2e -- --project=chromium present, upload-artifact@v4 present"
---

# Phase 19 Plan 03: CI Workflow Integration Summary

## Overview
Hardened the GitHub Actions CI pipeline (`.github/workflows/ci.yml`) by provisioning Playwright Chromium with system dependencies, streamlining the `e2e-tests` job to rely purely on Playwright's native dual `webServer` orchestration, establishing mandatory test gating, and configuring automated artifact retention for post-mortem diagnostics.

## Executed Tasks
1. **Playwright Chromium Provisioning & Streamlined Execution (`CI-02`)**:
   - Replaced fragile manual `nohup node server/src/index.js` background server startup loop with native Playwright dual `webServer` orchestration.
   - Pinned `npx playwright install chromium --with-deps` in `./client`.
   - Bound environment variables to explicit IPv4 endpoints (`127.0.0.1:5004`, `127.0.0.1:5173`) and test database `smartroute_e2e`.

2. **Diagnostic Artifact Capture (`CI-02`)**:
   - Configured `actions/upload-artifact@v4` to upload `client/playwright-report/` on `always()`.
   - Configured `actions/upload-artifact@v4` to capture `client/test-results/` (traces, videos, screenshots) on `failure()`.
   - Enforced 7-day ephemeral retention for CI storage hygiene.

## Verification Result
- **YAML Syntax**: Passed.
- **E2E Command Match**: `npm --prefix client run test:e2e -- --project=chromium`.
- **Artifact Upload Match**: `playwright-report` (`always()`) and `playwright-traces` (`failure()`).
