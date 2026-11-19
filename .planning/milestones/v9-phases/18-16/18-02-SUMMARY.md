---
phase: 18
plan: 02
subsystem: mapping
tags:
  - mapping
  - circuit-breaker
  - failover
  - geoapify
  - google-maps
  - simulated-traffic
dependency_graph:
  requires: []
  provides:
    - MAP-01
  affects:
    - server/src/services/mapping
    - server/src/services/optimization
tech_stack:
  patterns:
    - 3-state in-memory circuit breaker (CLOSED, OPEN, HALF_OPEN)
    - multi-tier GIS provider failover with local simulated physics fallback
key_files:
  created:
    - server/src/services/mapping/mappingProviderFactory.js
  modified:
    - server/src/services/mapping/geoapify.service.js
    - server/src/services/mapping/index.js
    - server/tests/adversarial_mapping_stress.test.js
decisions:
  - "D-03: Wrap geoapify.service.js and googleMapsService.js in a resilient MappingProviderFactory with an in-memory 3-state circuit breaker that auto-falls back to simulatedTrafficService.js upon quota exhaustion (429/OVER_QUERY_LIMIT) or network timeout (>3500ms)."
metrics:
  duration: 15m
  completed_date: "2026-11-19"
status: complete
actuals:
  tokens: 42000
  tasks: 3
  commits: 3
  plan_head_before: "60c9887754d924d5ba6b83f0907d72cbfa1199a0"
  plan_head_after: "f555c86c1c87569f654b005fe4379320e8a7aeae"
---

# Phase 18 Plan 02: Resilient Multi-Provider Mapping Circuit Breaker Summary

Implemented a 3-tier mapping failover architecture centered on `MappingProviderFactory` with an in-memory 3-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`), strict 3500ms timeout bounds per D-03, and instantaneous tripping to deterministic local simulation upon quota exhaustion (HTTP 429 / `OVER_QUERY_LIMIT`).

## Key Achievements

1. **In-Memory 3-State Circuit Breaker (`MappingProviderFactory`)**:
   - Manages state transitions across `CLOSED`, `OPEN`, and `HALF_OPEN` states.
   - Enforces failure threshold of 3 consecutive network failures or timeouts before tripping to `OPEN`.
   - Bounded by a strict 3500ms timeout SLA (`Promise.race` against external GIS requests).
   - Zero-retry quota trip: immediately transitions to `OPEN` on HTTP 429, `OVER_QUERY_LIMIT`, `OVER_DAILY_LIMIT`, or `REQUEST_DENIED` errors without burning retries.
   - 30-second cooldown window allows exploratory probe in `HALF_OPEN` state, resetting to `CLOSED` upon successful probe or re-tripping to `OPEN` on probe failure.

2. **Mapping Subsystem Facade Integration**:
   - `server/src/services/mapping/geoapify.service.js` updated to enforce default 3500ms SLA timeout ceiling and annotate HTTP 429 errors with `isQuotaError = true`.
   - `server/src/services/mapping/index.js` routes all distance matrix operations through `mappingProviderFactory.getDistanceMatrix`, while preserving backwards compatibility for all existing facade exports (`CANONICAL_DEPOT`, `haversineDistance`, `roadDistance`, `calculateDuration`, `clearCache`, `getCacheStats`, and simulated traffic helpers).

3. **Expanded Adversarial Test Suite**:
   - Added Section 5 (`Multi-Provider Mapping Circuit Breaker Resilience`) to `server/tests/adversarial_mapping_stress.test.js`.
   - Verified 3 consecutive timeouts/failures transition circuit from `CLOSED` to `OPEN`.
   - Verified HTTP 429 quota exhaustion immediately trips to `OPEN` on first attempt (0 retry burn).
   - Verified requests received while `OPEN` bypass network dispatch entirely and return local simulated matrix.
   - Verified transition to `HALF_OPEN` after 30s cooldown and clean reset to `CLOSED` upon successful probe.
   - Verified probe failure in `HALF_OPEN` re-trips circuit back to `OPEN`.

## Task Execution & Commits

| Task | Name | Type | Commit | Key Files |
|------|------|------|--------|-----------|
| 1 | Create MappingProviderFactory with 3-state circuit breaker | tracer | `aae416c` | `server/src/services/mapping/mappingProviderFactory.js` |
| 2 | Wire MappingProviderFactory into facade and adjust Geoapify SLA | auto | `f34a135` | `server/src/services/mapping/geoapify.service.js`, `server/src/services/mapping/index.js` |
| 3 | Expand adversarial mapping stress tests for circuit breaker | auto | `f555c86` | `server/tests/adversarial_mapping_stress.test.js` |

## Verification Results

- Command: `npm --prefix server test -- server/tests/adversarial_mapping_stress.test.js`
  - Output: 27 passed, 27 total (100% passing across all 5 test sections).
- Command: `npm --prefix server test -- server/tests/env_cors_hardening.test.js`
  - Output: 19 passed, 19 total (100% passing).
- Command: `npm --prefix server test -- server/tests/adversarial_optimizer_stress.test.js`
  - Output: 16 passed, 16 total (100% passing).

## Deviations from Plan

None — executed according to plan specifications and user instructions.

## Self-Check: PASSED
- `server/src/services/mapping/mappingProviderFactory.js`: FOUND
- `server/src/services/mapping/geoapify.service.js`: FOUND
- `server/src/services/mapping/index.js`: FOUND
- `server/tests/adversarial_mapping_stress.test.js`: FOUND
- Commits `aae416c`, `f34a135`, `f555c86`: VERIFIED in git history
