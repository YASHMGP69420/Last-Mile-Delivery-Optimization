---
phase: 28-multi-depot-vehicle-routing-mdvrp-multi-hub-management
plan: 01
subsystem: backend-hub-management
tags:
  - hubs
  - mdvrp
  - multi-depot
  - crud
  - seed
  - vehicle-assignment
requires: []
provides:
  - HUB-CRUD-01
affects:
  - server/src/models/Hub.js
  - server/src/controllers/hubController.js
  - server/src/routes/hubRoutes.js
  - server/src/models/Vehicle.js
  - server/src/models/DeliveryBatch.js
  - server/src/models/Route.js
  - server/src/seed/seedHubs.js
  - server/src/services/devPurgeService.js
tech-stack:
  added: []
  patterns:
    - Mongoose Schema with Geo Coordinates
    - Upsert Seeding
    - Cascade Deletion Guards
    - Canonical Hub Pre-Save Defaulting
key-files:
  created:
    - server/src/models/Hub.js
    - server/src/controllers/hubController.js
    - server/src/routes/hubRoutes.js
    - server/src/seed/seedHubs.js
    - server/tests/hub_crud.test.js
  modified:
    - server/src/routes/index.js
    - server/src/models/Vehicle.js
    - server/src/models/DeliveryBatch.js
    - server/src/models/Route.js
    - server/src/services/devPurgeService.js
decisions:
  - "D-01: Dedicated Hub Mongoose model with full Admin/Fleet Manager REST CRUD endpoints and initial Bhubaneswar seed hubs (Rasulgarh, Patia, Khandagiri)"
  - "D-02: Vehicle schema extended with homeHubId defaulting to canonical Rasulgarh hub via pre-save hook"
metrics:
  duration: 8m
  completed: 2026-11-23
status: complete
actuals:
  tokens: 22000
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 1a46b421f55bd03ff32613effff28bf9d95b3793
plan_head_after: ce88347a5d430b6d2278f290d1565deb2f731b5e
---

# Phase 28 Plan 01: Hub Data Infrastructure & Admin CRUD Summary

**One-liner:** Dedicated Hub database model with Bhubaneswar seed data, Admin/Fleet Manager REST CRUD endpoints, cascade deletion guards, Vehicle homeHubId defaulting, and devPurge resilience.

---

## Executive Summary

Plan 28-01 established the foundational multi-depot data infrastructure for Multi-Depot Vehicle Routing (MDVRP). We implemented the core Mongoose `Hub` schema, seeded initial Bhubaneswar logistics hubs (Rasulgarh Logistics Hub as canonical, Patia Infocity Hub, and Khandagiri Distribution Terminal), provided authenticated REST endpoints under `/api/v1/hubs` for Admin and Fleet Manager users with cascade protection against in-use vehicle or batch deletions, extended the `Vehicle` model with `homeHubId`, and configured `devPurgeService` to re-seed default hubs post-purge.

All 16 automated tests in `server/tests/hub_crud.test.js` pass cleanly alongside existing regression suites.

---

## Completed Tasks

| Task | Description | Status | Commit | Key Files Modified/Created |
| ---- | ----------- | ------ | ------ | -------------------------- |
| Task 1 | End-to-end Hub creation and retrieval tracer slice | Completed | `a182e58` | `server/src/models/Hub.js`, `server/src/controllers/hubController.js`, `server/src/routes/hubRoutes.js`, `server/src/routes/index.js`, `server/src/seed/seedHubs.js`, `server/tests/hub_crud.test.js` |
| Task 2 | Full Hub Admin CRUD, Vehicle homeHubId, cascade guards & devPurge resilience | Completed | `ce88347` | `server/src/controllers/hubController.js`, `server/src/routes/hubRoutes.js`, `server/src/models/Vehicle.js`, `server/src/models/DeliveryBatch.js`, `server/src/models/Route.js`, `server/src/services/devPurgeService.js`, `server/tests/hub_crud.test.js` |

---

## Key Highlights & Verification Details

1. **Hub Data Model (`server/src/models/Hub.js`):**
   - Stores `name`, `code` (unique, uppercase), `address`, `location: { lat, lng }`, `contactPhone`, `operatingHours`, `isActive`, and `isCanonical`.
   - Validates latitude (-90 to 90) and longitude (-180 to 180).
   - `toJSON` transform outputs clean `id` attribute.

2. **Bhubaneswar Logistics Hub Seeding (`server/src/seed/seedHubs.js`):**
   - Rasulgarh Logistics Hub (`HUB-RASULGARH`, `20.2961, 85.8645`, canonical).
   - Patia Infocity Hub (`HUB-PATIA`, `20.3533, 85.8178`).
   - Khandagiri Distribution Terminal (`HUB-KHANDAGIRI`, `20.2588, 85.7825`).
   - Uses upsert matching on `code` for safe idempotence.

3. **Admin & Fleet Manager REST Endpoints (`/api/v1/hubs`):**
   - `GET /` — lists hubs with optional `isActive` filter.
   - `POST /` — creates new hub with unique code and geo validation.
   - `GET /:id` — retrieves hub details with 404 handler.
   - `PUT /:id` — updates hub fields with self-excluding code uniqueness.
   - `DELETE /:id` — guarded: rejects deletion of canonical hub (400) or hubs assigned to active vehicles or batches (409).
   - `PATCH /:id/toggle-active` — toggles active state, disallowing deactivating canonical hub.

4. **Vehicle `homeHubId` & Defaulting (`server/src/models/Vehicle.js`):**
   - References `Hub` ObjectId.
   - Pre-save hook defaults `homeHubId` to the canonical hub (`HUB-RASULGARH`) when omitted, preserving custom assignments when explicitly set.

5. **Purge Resilience (`server/src/services/devPurgeService.js`):**
   - Wipes custom hubs during hard database purges and immediately re-seeds the 3 initial Bhubaneswar logistics hubs so development and test environments always retain operational hubs.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `hubId` to `DeliveryBatch` and `Route` schemas**
- **Found during:** Task 2 execution
- **Issue:** Mongoose strict mode discarded `hubId` when creating a batch to test cascade deletion guards, resulting in batches lacking a persisted `hubId` field.
- **Fix:** Added `hubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hub', default: null, index: true }` to both `server/src/models/DeliveryBatch.js` and `server/src/models/Route.js`.
- **Files modified:** `server/src/models/DeliveryBatch.js`, `server/src/models/Route.js`
- **Commit:** `ce88347`

---

## Self-Check: PASSED

1. **Created files exist:**
   - `server/src/models/Hub.js`: FOUND
   - `server/src/controllers/hubController.js`: FOUND
   - `server/src/routes/hubRoutes.js`: FOUND
   - `server/src/seed/seedHubs.js`: FOUND
   - `server/tests/hub_crud.test.js`: FOUND

2. **Commits exist in git history:**
   - `a182e58`: FOUND
   - `ce88347`: FOUND

3. **Automated tests:**
   - `npm --prefix server test -- tests/hub_crud.test.js`: 16/16 passed.
