---
phase: "10"
slug: "prd-completion-and-audit-closure"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-11"
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: Jest `^29.7.0` + Supertest `^6.3.4`; Frontend: TypeScript `tsc --noEmit` + Vite production build |
| **Config file** | `server/jest.config.js`, `client/tsconfig.json` |
| **Quick run command** | `npm --prefix server test -- tests/demo_data.test.js tests/analytics_prd.test.js tests/midshift_reoptimize.test.js && npm --prefix client test` |
| **Full suite command** | `npm --prefix server test && npm --prefix client run build` |
| **Estimated runtime** | ~30 seconds (targeted) / ~140 seconds (full server + build) |

---

## Sampling Rate

- **After every task commit:** Targeted Jest test file (`npm --prefix server test -- tests/<file>.test.js`) or `npm --prefix client test`
- **After every plan wave:** `npm --prefix server test -- tests/demo_data.test.js tests/analytics_prd.test.js tests/midshift_reoptimize.test.js tests/admin_control.test.js tests/routes.test.js && npm --prefix client test`
- **Before `/gsd-verify-work`:** Full `npm --prefix server test` and `npm --prefix client run build` must be green
- **Max feedback latency:** 35 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Decision / Req | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | D-01 | T-10-01 | `isDemoData` schema field added to first 5 secondary operational models (`DriverIncident`, `DriverShift`, `MaintenanceRecord`, `RouteAssignment`, `SystemNotification`) | schema check | `node -e "for (const m of ['DriverIncident','DriverShift','MaintenanceRecord','RouteAssignment','SystemNotification']) { const M = require('./server/src/models/' + m); if (!M.schema.path('isDemoData')) process.exit(1); }"` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | D-01 | T-10-01 | `isDemoData` schema field added to remaining 4 secondary models (`TelemetryAlert`, `TelemetryPing`, `VehicleAssignment`, `VehicleChecklist`) | schema check | `node -e "for (const m of ['TelemetryAlert','TelemetryPing','VehicleAssignment','VehicleChecklist','DeliveryEvent','Route']) { const M = require('./server/src/models/' + m); if (!M.schema.path('isDemoData')) process.exit(1); }"` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | D-01 | T-10-01 | Propagate `isDemoData` onto `Route`, assignments, and `AuditEvent` during optimization & dispatch | integration | `npm --prefix server test -- tests/demo_data.test.js tests/routes.test.js` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 1 | D-04, D-06, D-07 | T-10-04 | `getAnalyticsSummary` in `savingsAnalyticsService` & `GET /api/v1/admin/analytics` (`ADMIN` + `FLEET_MANAGER`, preserving `403` on `/admin/overview`) | integration | `npm --prefix server test -- tests/admin_control.test.js tests/shift_telemetry_savings.test.js` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 1 | D-04, D-06, D-07 | T-10-04 | Wave 0 integration tests covering `/admin/analytics` RBAC, `0`/`null` empty fallbacks, `DRAFT` exclusion, 4 PRD KPIs & Planned vs Actual | integration | `npm --prefix server test -- tests/analytics_prd.test.js tests/admin_control.test.js tests/shift_telemetry_savings.test.js` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | D-02, D-03 | T-10-02, T-10-03 | Entity-linked cascade deletion in `demoDataService.deleteDemoDataset()` + `TC-DEMO-3` zero-orphan test | integration | `npm --prefix server test -- tests/demo_data.test.js tests/routes.test.js` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | D-03 | — | Author verified `07-VERIFICATION.md` documenting Phase 07 cleanup evidence and `TC-DEMO-3` pass | verification doc | `node -e "const fs = require('fs'); const c = fs.readFileSync('.planning/phases/07-production-data-cleanup-and-demo-controls/07-VERIFICATION.md','utf8'); if (!c.includes('TC-DEMO-3') || !c.includes('Passed')) process.exit(1);"` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 2 | D-08 | T-10-05 | `HEAVY_TRAFFIC` (`2.0x`) multiplier, dual `route:reordered`/`route:updated` Socket.IO broadcast, and `activeRouteReoptimizer.js` | unit check | `node -e "const c = require('./server/src/config/constants'); const r = require('./server/src/services/optimization/activeRouteReoptimizer'); if (c.TRAFFIC_MULTIPLIERS.HEAVY_TRAFFIC <= 1 || typeof r.reoptimizeActiveRoute !== 'function') process.exit(1);"` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 | 2 | D-08, D-09, D-10 | T-10-05, T-10-06 | Auto-trigger `reoptimizeActiveRoute` on `ROUTE_OBSTRUCTION` in `reportIncident` + `POST /api/v1/routes/:id/reoptimize` | integration | `npm --prefix server test -- tests/driver_hud.test.js tests/routes.test.js` | ✅ | ⬜ pending |
| 10-04-03 | 04 | 2 | D-08, D-09, D-10 | T-10-05, T-10-06 | Wave 0 integration tests in `server/tests/midshift_reoptimize.test.js` | integration | `npm --prefix server test -- tests/midshift_reoptimize.test.js tests/driver_hud.test.js tests/routes.test.js` | ❌ W0 | ⬜ pending |
| 10-05-01 | 05 | 3 | D-05, D-06, D-10 | — | `TrafficScenario` union (`HEAVY_TRAFFIC`), `AdminApi.getAnalytics`, `RoutesApi.reoptimize`, remove dead `RoutesApi.reset` | typecheck | `npm --prefix client test` | ✅ | ⬜ pending |
| 10-05-02 | 05 | 3 | D-04, D-06, D-07 | — | Sync `FLEET_MANAGER` savings on `AdminControlCenterPage` + PRD KPIs & Planned vs Actual on `AnalyticsPage` | typecheck | `npm --prefix client test` | ✅ | ⬜ pending |
| 10-05-03 | 05 | 3 | D-08, D-09, D-10 | — | Wire live `route:reordered`/`route:updated` sync & dispatcher re-optimize button in `TrackingPage` and feedback in `DriverSupportPage` | typecheck + build | `npm --prefix client test && npm --prefix client run build` | ✅ | ⬜ pending |
| 10-06-01 | 06 | 3 | D-05 | T-10-07, T-10-08 | `DRIVER` redirect in `AdminLayout`, `BatchesPage:746` button radius, dark alert contrast in `RoutePlannerPage` & `DriversPage` | typecheck | `npm --prefix client test` | ✅ | ⬜ pending |
| 10-06-02 | 06 | 3 | D-05 | T-10-09 | Dark-mode alert contrast fixes in `DispatchConfirmationModal`, `CsvImportModal`, `DriverHeader`, and `PODModal` | typecheck + build | `npm --prefix client test && npm --prefix client run build` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] Extend `server/tests/demo_data.test.js` with `TC-DEMO-3` (import -> optimize -> dispatch -> driver HUD secondary records -> delete -> zero orphans, real data preserved)
- [ ] Create `server/tests/analytics_prd.test.js` (RBAC, `0`/`—` empty fallbacks, `DRAFT` exclusion, 4 PRD KPIs, Planned vs Actual `Route` vs `DriverShift`)
- [ ] Create `server/tests/midshift_reoptimize.test.js` (`reoptimizeActiveRoute`, `HEAVY_TRAFFIC` multiplier, terminal stop locks, live `TelemetryPing` anchoring, `reportIncident` auto-reroute, `POST /routes/:id/reoptimize`)

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| `AnalyticsPage` renders 4 new PRD KPI cards & Planned vs Actual panel cleanly in Carbon & Zinc dark mode | D-06, D-07 | Visual layout, alignment, and contrast confirmation | Open `/admin/analytics` in Chrome dark mode, inspect empty (`0`/`—`) and populated states. |
| Secondary modal dark-mode alert contrast (`RoutePlannerPage`, `DispatchConfirmationModal`, `CsvImportModal`, `DriverHeader`, `PODModal`, `DriversPage`) | D-05 | Visual confirmation of dark-mode legibility | Inspect alert banners in dark mode across Admin & Driver modals. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 test dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers missing test suites (`analytics_prd.test.js`, `midshift_reoptimize.test.js`) and `demo_data.test.js` extension
- [x] No watch-mode flags
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-11
