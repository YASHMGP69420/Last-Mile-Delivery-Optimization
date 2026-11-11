# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v5 — Final PRD Completion & Audit Closure

**Shipped:** 2026-11-11
**Phases:** 10 | **Plans:** 19 | **Quick Tasks:** 4

### What Was Built
- Full-stack SmartRoute Last-Mile Delivery Platform across Operations Control Center (VRP Nearest-Neighbor + 2-Opt optimization, CSV dry-run ingestion, batch orchestration with `409` active-operation/active-batch interlocks, PRD Analytics & Planned-vs-Actual performance, live telemetry & mid-shift re-optimization) and Mobile Driver Handheld cockpit (daylight white default + dark toggle, telemetry continuity, pre-trip checks, incident reporting).
- Zero-orphan Admin Demo Dataset controls (`isDemoData` provenance across 7 core + 10 secondary Mongoose schemas + `deleteDemoDataset()` cascade purge).
- Live real-time synchronization via authenticated Socket.IO (`route:reordered`, `route:updated`, `telemetry:alert` preservation across background reloads).

### What Worked
- Goal-backward verification paired with live headless Chromium CDP E2E tests caught real UI/WebSocket races (such as Socket.IO alerts wiped by background `fetchData()` reloads and dark-mode contrast leaks on `CurrentRouteCard`/`RouteComparisonDrawer`).
- Atomic per-task commits and shared server-side validation/analytics services prevented drift between Desktop Admin, Fleet Manager, and Driver Handheld views.

### What Was Inefficient
- Early phases (02, 05–08) mixed `SUMMARY`/`VERIFICATION` formats, creating documentation hygiene debt caught during the Milestone 4 audit before Phase 10 closed it cleanly.
- Running cross-AI external CLI review failed because local `claude` and `codex` CLI auth sessions were expired.

### Patterns Established
- Deriving `isDemoData` server-side across route/dispatch pipelines rather than trusting client flags.
- Preserving ephemeral `_isLiveSocketAlert` notifications when background REST refreshes overwrite active alert lists.
- Enforcing `data-theme="light"` pre-paint defaults for daylight mobile readability alongside opt-in dark toggles.

### Key Lessons
1. Always validate WebSocket event + REST refetch interplay in a live two-browser DOM harness, not just unit mocks.
2. Keep `ROADMAP.md` summary bullets paired with detailed phase sections so GSD progression/completion CLIs resolve cleanly.

### Cost Observations
- Model mix: Coordinator / Verifier / Executor agents running seamlessly on workspace model inherit
- Notable: Live headless Chromium CDP (`ws`) testing eliminated manual browser back-and-forth during final UAT

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Quick Tasks | Key Change |
| --- | --- | --- | --- |
| v1–v5 (Cumulative) | 10 | 4 archived | Introduced Milestone Audit closure gate + live headless Chromium E2E CDP verification |

### Cumulative Quality

| Milestone | Automated Suites | E2E Checks | Source LOC |
| --- | --- | --- | --- |
| v5 | 25/25 Jest (287/287 passed), `tsc` + Vite clean | 18/18 live Chromium CDP passed | 34,951 LOC (`server/src` + `client/src`) |

### Top Lessons (Verified Across Milestones)
1. Live multi-context browser verification catches state synchronization and CSS theme regressions that headless API tests miss.
2. Shared domain services (`savingsAnalyticsService`, `resourceGuardService`, `activeRouteReoptimizer`) keep RBAC roles aligned across dashboards.
