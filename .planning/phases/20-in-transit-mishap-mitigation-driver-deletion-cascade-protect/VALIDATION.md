# Phase 20: In-Transit Mishap Mitigation & Driver Deletion Cascade Protection - Validation Plan

**Generated:** 2026-11-20  
**Phase:** 20 - In-Transit Mishap Mitigation & Driver Deletion Cascade Protection  
**Status:** Active  

---

## 1. Validation Architecture & Test Framework

| Property | Value |
|----------|-------|
| Backend Framework | Jest `^29.7.0` (`server/package.json`) |
| Frontend Framework | Vitest `^5.1.0` (`client/vite.config.ts`) |
| Backend Targeted Run | `npm --prefix server test -- tests/phase20_mishap_guards.test.js` |
| Frontend Targeted Run | `npm --prefix client run test:unit -- src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` |
| Full Test Suite | `npm --prefix server test` and `npm --prefix client test` |

---

## 2. Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Test Command | Target File |
|--------|----------|-----------|------------------------|-------------|
| **MISHAP-01** | Admin delete/status toggle is blocked with `409 ACTIVE_OPERATION_CONFLICT` with active route & stop details when active driver operations exist | Backend Integration | `npm --prefix server test -- tests/phase20_mishap_guards.test.js -t "MISHAP-01"` | `server/tests/phase20_mishap_guards.test.js` |
| **MISHAP-02** | Frontend conflict resolution modal renders active route code and uncompleted stops count, providing a 1-click "Reassign Active Orders & Delete" (`forceReassign=true`) cascade | Frontend Component Unit | `npm --prefix client run test:unit -- src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` |
| **MISHAP-03** | Atomic recovery rescues uncompleted orders (`PENDING`, `OUT_FOR_DELIVERY`, `FAILED`) to `READY` with `'Urgent'` priority, cancels route with `cancellationReason: 'DRIVER_REMOVED'`, force-closes shift (`status: 'FORCE_CLOSED'`), unlinks vehicle, and preserves completed POD signatures | Backend Integration | `npm --prefix server test -- tests/phase20_mishap_guards.test.js -t "MISHAP-03"` | `server/tests/phase20_mishap_guards.test.js` |
| **MISHAP-04** | Real-time Socket.IO events (`route:cancelled`, `driver:incident`, `deliveries:reassigned`), high-severity `SystemNotification`, and live Control Center banner notification are emitted and subscribed | Integration & E2E | `npm --prefix server test -- tests/phase20_mishap_guards.test.js -t "MISHAP-04"` | `server/tests/phase20_mishap_guards.test.js` |

---

## 3. Wave 0 Scaffold Files

- `server/tests/phase20_mishap_guards.test.js` — covers MISHAP-01, MISHAP-03, and MISHAP-04
- `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` — covers MISHAP-02 UI rendering and cascade dispatch

---

## 4. Sampling Rate & Quality Gates

- **Per task commit:** Execute targeted test command for the respective task.
- **Wave 1 completion:** `npm --prefix server test -- tests/phase20_mishap_guards.test.js` must pass with 0 failures.
- **Wave 2 completion:** `npm --prefix client run test:unit -- src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` and full client typecheck (`npm --prefix client run test -- --noEmit`) must pass with 0 errors.
- **Phase Hand-off Gate:** All unit and integration tests pass cleanly before `/gsd-verify-work`.
