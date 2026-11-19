---
phase: 18
plan: 01
subsystem: ci-test-infrastructure
tags: [ci, jest, vitest, adversarial-tests, throughput-benchmarks, supply-chain]
requires: []
provides:
  - "Adaptive throughput benchmarking for 500-row CSV batch ingestion"
  - "Environment-aware execution ceilings for 2-Opt optimizer convergence"
  - "Deterministic CI pipeline workflow with pinned audit levels and runInBand backend testing"
affects:
  - server/tests/adversarial_csv_batch.test.js
  - server/tests/adversarial_optimizer_stress.test.js
  - .github/workflows/ci.yml
tech-stack:
  added: []
  patterns:
    - "Environment-aware test thresholds (Math.max, process.env.CI scaling)"
    - "Throughput-based SLA assertions (rows/sec) replacing wall-clock ceilings"
key-files:
  created: []
  modified:
    - server/tests/adversarial_csv_batch.test.js
    - server/tests/adversarial_optimizer_stress.test.js
    - .github/workflows/ci.yml
decisions:
  - "D-01: Standardized monorepo CI on single-shot deterministic runners (vitest run, jest --runInBand) with blocking high-severity supply-chain audits."
  - "D-02: Calibrated adversarial benchmark bounds with dynamic throughput metrics (>= 25 rows/s dry, >= 20 rows/s commit) and CI-scaled timeouts (2000ms optimizer, 20-24s batch commit)."
metrics:
  duration: 8m
  completed_date: "2026-11-19"
status: complete
actuals:
  tokens: 45000
  tasks: 3
  commits: 3
---

# Phase 18 Plan 01: Production CI Stabilization & Runner Determinism Summary

Deterministic CI runner standards, high-severity supply-chain audit enforcement, and adaptive throughput thresholds for adversarial CSV batch and optimizer benchmark suites.

## Overview

Plan 18-01 hardens the monorepo against non-deterministic CI failures and shared virtualization bottlenecks without compromising mathematical or throughput validation. Static wall-clock expectations that previously triggered false-positive aborts under CPU-throttled GitHub Actions runners have been replaced with throughput-based metrics (rows/second) and environment-aware execution ceilings. In addition, repository supply-chain vulnerability checking is pinned to `--audit-level=high` and test runner execution is standardized across client (`vitest run`) and server (`jest --runInBand`).

## Tasks Completed

| Task | Name | Commit | Key Files Modified |
|------|------|--------|-------------------|
| 1 (Tracer) | Calibrate adversarial CSV batch benchmark timeouts with adaptive throughput thresholds | `8a27198` | `server/tests/adversarial_csv_batch.test.js` |
| 2 | Calibrate adversarial optimizer stress test execution bounds for CI runners | `25ffba4` | `server/tests/adversarial_optimizer_stress.test.js` |
| 3 | Harden CI pipeline supply-chain audit and runner determinism | `78fb180` | `.github/workflows/ci.yml` |

## Verification Results

1. **Supply Chain Audit (`npm audit --audit-level=high`)**:
   - Exit code 0, 0 high/critical vulnerabilities.
   - Pinned in `.github/workflows/ci.yml` as a blocking gate with `continue-on-error: false`.

2. **Adversarial CSV Batch Suite (`server/tests/adversarial_csv_batch.test.js`)**:
   - 16 / 16 tests passed.
   - Dry run throughput benchmark: verified `(totalRows / (dryTime / 1000)) >= 25` rows/second with environment-adaptive ceiling `Math.max(8000, 5000 * (process.env.CI ? 2 : 1))`.
   - Commit phase throughput benchmark: verified `(importedCount / (commitTime / 1000)) >= 20` rows/second with environment-adaptive ceiling `Math.max(20000, 12000 * (process.env.CI ? 2 : 1))`.
   - Test timeout scaled to `Math.max(35000, 25000 * (process.env.CI ? 2 : 1))`.

3. **Adversarial Optimizer Stress Suite (`server/tests/adversarial_optimizer_stress.test.js`)**:
   - 16 / 16 tests passed.
   - Execution duration assertion scaled: `maxAllowedDuration = process.env.CI ? 2000 : 750` ms.
   - Measured canonical BBSR-EXP-01 (25 stops) execution duration: 13.79 ms (well within threshold).
   - Invariants strictly preserved: `D_optimized <= D_baseline + 1e-6`, 2-Opt iterations (< 1000), and convergence verified.

4. **Client Unit Tests (`npm --prefix client run test:unit`)**:
   - 39 / 39 tests passed in single-shot mode (`vitest run`).

## Deviations from Plan

None - plan executed exactly as specified.

## Self-Check: PASSED

- All 3 modified files verified and committed cleanly.
- Commits `8a27198`, `25ffba4`, and `78fb180` exist in git history.
- Verification commands pass with zero failures.
