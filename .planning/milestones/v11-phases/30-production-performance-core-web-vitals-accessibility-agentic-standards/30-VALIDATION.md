---
phase: "30"
slug: "production-performance-core-web-vitals-accessibility-agentic-standards"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-25"
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v5.1.0 (with JSDOM and Testing Library) |
| **Config file** | `client/vitest.config.ts` |
| **Quick run command** | `npm --prefix client run test:unit` |
| **Full suite command** | `npm --prefix client run test:unit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix client run test:unit`
- **After every plan wave:** Run `npm --prefix client run test:unit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | PERF-CLS-01 | — | Card renders fixed skeleton without DOM collapsing | unit / render | `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | PERF-COMPOSIT-03 | T-30-01, T-30-02 | Font preload eliminates blocking CSS and transitions use GPU-accelerated transform & opacity | unit / static | `npm --prefix client run test:unit -- src/__tests__/performanceAssets.test.ts` | ❌ W0 | ⬜ pending |
| 30-02-01 | 02 | 2 | PERF-WATERFALL-02 | T-30-03, T-30-04 | In-flight GET deduplication prevents cache poisoning on mutations and socket reconnect jitter | unit / api | `npm --prefix client run test:unit -- src/api/__tests__/clientDeduplication.test.ts` | ❌ W0 | ⬜ pending |
| 30-02-02 | 02 | 2 | A11Y-CONTRAST-04 | — | Heading sequence strictly ordered without skips and badges meet WCAG AA contrast | unit / a11y | `npm --prefix client run test:unit -- src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx` | ❌ W0 | ⬜ pending |
| 30-02-03 | 02 | 2 | AGENTIC-SPEC-05 | T-30-05 | Agentic metadata strictly public with bearerAuth specs and rewrite exemptions | unit / static | `npm --prefix client run test:unit -- src/__tests__/agenticSpecs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/components/optimization/__tests__/RoutePlannerSkeleton.test.tsx` — covers PERF-CLS-01
- [ ] `client/src/__tests__/performanceAssets.test.ts` — covers PERF-COMPOSIT-03 & T-30-01, T-30-02
- [ ] `client/src/api/__tests__/clientDeduplication.test.ts` — covers PERF-WATERFALL-02 & T-30-03, T-30-04
- [ ] `client/src/components/optimization/__tests__/RoutePlannerHeadingOrder.test.tsx` — covers A11Y-CONTRAST-04
- [ ] `client/src/__tests__/agenticSpecs.test.ts` — covers AGENTIC-SPEC-05 & T-30-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse Desktop Audit on Vercel preview/production | PERF-CLS-01, PERF-WATERFALL-02 | Production CDN network environment & Chrome real-browser rendering | Run Lighthouse in DevTools or PageSpeed Insights on deployed URL: verify Performance >= 90, CLS <= 0.05, Speed Index <= 2.0s |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-11-25
