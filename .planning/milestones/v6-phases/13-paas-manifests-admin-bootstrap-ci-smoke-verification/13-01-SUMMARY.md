---
phase: 13-paas-manifests-admin-bootstrap-ci-smoke-verification
plan: 01
subsystem: auth
tags: [bootstrap, admin, cli, mongoose, bcrypt, ops-01]

requires:
  - phase: 11-server-and-client-runtime-hardening
    provides: Production env fail-fast boundary (`server/src/config/env.js`), `connectDB()` / `disconnectDB()` (`server/src/config/db.js`), and `User` model bcrypt `pre('save')` hooks (`server/src/models/User.js`)
provides:
  - Idempotent non-demo first-admin bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`) exporting `validateBootstrapConfig`, `bootstrapAdmin`, `runCli`, and `WEAK_ADMIN_PASSWORDS`
  - Server npm scripts `seed:admin` and `bootstrap:admin` in `server/package.json`
affects:
  - 13-03-PLAN.md (`scripts/smoke-test.js`, `.github/workflows/ci.yml` `seed:admin` CI boot smoke gate, and `server/tests/ops_bootstrap_smoke.test.js`)
  - Phase 14 (`.env.example` `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` audit and `README.md` production bootstrap runbook)

actuals:
  tokens: 1340
  tasks: 2
  commits: 4
  plan_head_before: 3ec74d43b2a5a94475e3d1570bfdec8a64779a86
  plan_head_after: 9598f95b871b74978a08981ffe1e1986b4e9634f

tech-stack:
  added: []
  patterns:
    - "Pre-DB credential validation gate: `validateBootstrapConfig(process.env)` rejects invalid emails, short/whitespace-only passwords (`< 10` non-whitespace chars), and weak/placeholder passwords before `connectDB()` opens a MongoDB socket"
    - "Idempotent non-demo admin check via `User.findOne({ $or: [{ email }, { role: ROLES.ADMIN, isDemoData: false, active: true }] })` exiting `0` without overwriting existing passwords"

key-files:
  created:
    - server/src/scripts/bootstrapAdmin.js
  modified:
    - server/package.json

key-decisions:
  - "Validated both raw password length and trimmed non-whitespace length (`>= 10`) alongside `WEAK_ADMIN_PASSWORDS` and substring checks (`your_admin_password`, `changeme`) before `connectDB()` so weak or whitespace-padded credentials fail fast with exit code `1`"
  - "Checked idempotency against both matching `email` and any existing active non-demo `ADMIN` (`role: ROLES.ADMIN, isDemoData: false, active: true`) before calling `User.create(...)`, preserving existing credentials with exit code `0`"
  - "Kept `bootstrapAdmin.js` completely isolated from `seedBhubaneswar.js` and `demoDataService.js` while delegating password hashing to `User` `pre('save')` hooks"

patterns-established:
  - "Production CLI bootstrap pattern: pre-DB `validateBootstrapConfig()` -> `connectDB()` -> idempotent `User.findOne` / `User.create` (`isDemoData: false`) -> `disconnectDB()`"

requirements-completed:
  - OPS-01

coverage:
  - id: D1
    description: "Created `server/src/scripts/bootstrapAdmin.js` and registered `seed:admin` and `bootstrap:admin` scripts in `server/package.json` without referencing or altering `seedBhubaneswar.js`."
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "Bootstrap tracer contract check (exports, package.json scripts, isDemoData: false, zero demo-seed references)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Enforced pre-DB `validateBootstrapConfig()` rejection (`exit 1`) for missing/malformed `ADMIN_EMAIL` and missing/`< 10`-char/whitespace-only/weak-placeholder `ADMIN_PASSWORD`, plus live MongoDB `User.create` (`isDemoData: false`, bcrypt `$2b$`/`$2a$` hash) and idempotent repeat-run `exit 0` no-op."
    requirement: OPS-01
    verification:
      - kind: integration
        ref: "Pre-DB CLI fail-fast (`MONGODB_URI=mongodb://127.0.0.1:1/unreachable`) + live `smartroute_bootstrap_verify` MongoDB create & idempotent `seed:admin` / `bootstrap:admin` re-run checks"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-11-11
status: complete
---

# Phase 13 Plan 01: First-Admin Bootstrap CLI Summary

**Implemented the idempotent, non-demo production first-admin bootstrap CLI (`server/src/scripts/bootstrapAdmin.js`) and exposed `seed:admin` / `bootstrap:admin` in `server/package.json` with pre-DB credential validation and `User.create` bcrypt hook delegation.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-11-11T15:56:58Z
- **Completed:** 2026-11-11T16:00:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `server/src/scripts/bootstrapAdmin.js` exporting `validateBootstrapConfig`, `bootstrapAdmin`, `runCli`, and `WEAK_ADMIN_PASSWORDS`, importing `../config/env`, `../config/db`, `../models/User`, and `../config/constants` with zero imports or references to `seedBhubaneswar.js` or `demoDataService.js`.
- Enforced pre-DB fail-fast validation rejecting missing/invalid `ADMIN_EMAIL`, missing/short (`< 10` non-whitespace chars) `ADMIN_PASSWORD`, weak/placeholder passwords (`admin123`, `password123`, `changeme`, `your_admin_password_here`, `password`, `admin`, `1234567890`, `smartroute123`, and `your_admin_password`/`changeme` substrings), and out-of-range `ADMIN_NAME` (`2`–`100` chars, defaulting to `'SmartRoute Admin'`).
- Registered `"seed:admin"` and `"bootstrap:admin"` scripts (`node src/scripts/bootstrapAdmin.js`) in `server/package.json`.
- Verified pre-DB CLI fail-fast against unreachable MongoDB (`mongodb://127.0.0.1:1/unreachable`) and verified live local MongoDB creation (`isDemoData: false`, `role: 'ADMIN'`, `emailVerified: true`, `active: true`, `accountStatus: 'ACTIVE'`, bcrypt hash validity via `comparePassword`) plus idempotent `exit 0` no-op on repeat `seed:admin` / `bootstrap:admin` runs (dropping the temporary `smartroute_bootstrap_verify` database afterward).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server/src/scripts/bootstrapAdmin.js and register seed:admin / bootstrap:admin in server/package.json** - `c5316c7` (feat)
2. **Task 2: Verify pre-DB validation rejection and idempotent MongoDB CLI execution for bootstrapAdmin** - verified via automated pre-DB + live local MongoDB CLI checks (no code edits required)

*(Note: Plan `13-02` executed concurrently on `master` in Wave 1, adding `ba57e02`, `ed0380b`, and `9598f95` between `plan_head_before` and `plan_head_after`; Plan `13-01`'s own code commit is `c5316c7`.)*

## Files Created/Modified
- `server/src/scripts/bootstrapAdmin.js` - Idempotent non-demo first-admin bootstrap CLI (`validateBootstrapConfig`, `bootstrapAdmin`, `runCli`, `WEAK_ADMIN_PASSWORDS`).
- `server/package.json` - Added `seed:admin` and `bootstrap:admin` npm scripts alongside `seed`.

## Decisions Made
- Checked both `rawPassword.length < 10` and `rawPassword.trim().length < 10` in `validateBootstrapConfig()` so 10+ space-only strings cannot slip past length validation.
- Performed idempotency lookup on `$or: [{ email }, { role: ROLES.ADMIN, isDemoData: false, active: true }]` before calling `User.create(...)`, logging whether the skip reason was `matching_email` or `existing_non_demo_admin` and leaving existing passwords untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Flags

None - all trust boundaries (`Operator Environment -> bootstrapAdmin.js CLI` and `bootstrapAdmin.js -> MongoDB users collection`) follow `<threat_model>` mitigations (`T-13-01`, `T-13-02`, `T-13-SC`) with zero new runtime dependencies.

## Self-Check: PASSED

- Verified `server/src/scripts/bootstrapAdmin.js` and `server/package.json` exist on disk and pass all Task 1 tracer contract assertions.
- Verified pre-DB validation checks reject all invalid/weak/whitespace cases before touching MongoDB (`exit 1` with zero `ECONNREFUSED`/`timeout`).
- Verified live local MongoDB create + idempotent second run (`exit 0`), bcrypt hash integrity, unchanged password hash across repeat runs, and clean drop of `smartroute_bootstrap_verify`.
- Verified commit `c5316c7` exists in git history with zero unintended file deletions and zero `.env` files staged.
