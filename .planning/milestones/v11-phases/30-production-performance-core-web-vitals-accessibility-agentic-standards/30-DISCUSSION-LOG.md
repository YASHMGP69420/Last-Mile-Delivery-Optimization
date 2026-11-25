# Phase 30: Production Performance, Core Web Vitals, Accessibility & Agentic Standards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-25
**Phase:** 30-production-performance-core-web-vitals-accessibility-agentic-standards
**Areas discussed:** Scope Structure, Layout Shift (CLS), API Waterfall Deduplication, Font Loading & Speed Index, Accessibility & Contrast, Agentic Web Standards

---

## Scope Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive 4-Pillar Overhaul | CLS Skeletons, API Deduplication, Font/Composited CSS, & A11y/Agentic | ✓ |
| Core Web Vitals Only | Focus strictly on CLS < 0.05 & Speed Index < 1.8s | |
| Performance + API Waterfall Only | Skip a11y & agentic discovery | |

**User's choice:** Comprehensive 4-Pillar Overhaul (CLS Skeletons, API Deduplication, Font/Composited CSS, & A11y/Agentic)
**Notes:** Full coverage of all Lighthouse diagnostics to achieve 90+ performance, 100 a11y, and 4/4 agentic discovery.

---

## CLS Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Reserved Skeleton Layout | Fixed aspect-ratio grid placeholders + CSS min-height to prevent DOM jumps while data loads | ✓ |
| Progressive Blur-Up Loader | Full-page glassmorphism overlay until batch & route data resolve completely | |
| Optimistic Static Shell | Pre-render default empty canvas and hydrate without reflow | |

**User's choice:** Reserved Skeleton Layout
**Notes:** Stabilizes `RoutePlannerPage.tsx` grid layout (`grid grid-cols-1 lg:grid-cols-12`) directly eliminating 0.416 of the 0.450 shift score.

---

## API Waterfall & Latency

| Option | Description | Selected |
|--------|-------------|----------|
| Global In-Flight Request Deduplication | ApiClient deduplication collapsing redundant concurrent GET queries into 1 promise | ✓ |
| Centralized Batch DataLoader Hook | Single unified endpoint/hook dispatching all batch assets concurrently | |
| Client-Side Session Storage Cache | 30s TTL session storage caching | |

**User's choice:** Global In-Flight Request Deduplication & SWR Caching in ApiClient
**Notes:** Resolves redundant duplicate calls (`routes?batchId=...` fired 4x) without requiring backend endpoint redesign.

---

## Font Loading & Speed Index

| Option | Description | Selected |
|--------|-------------|----------|
| Asynchronous Google Font Loading | font-display: swap + preconnect & font metrics override (eliminates 310ms render-blocking) | ✓ |
| Self-Host Fonts Locally | Host Inter & JetBrains Mono locally in client/public/fonts/ | |
| System Font Stack Fallback | Zero web-font blocking | |

**User's choice:** Asynchronous Google Font Loading with font-display: swap + preconnect & font metrics override
**Notes:** Eliminates render-blocking CSS link while preserving brand typography.

---

## Accessibility & Contrast

| Option | Description | Selected |
|--------|-------------|----------|
| High-Contrast Obsidian Tokens | Upgrade amber badges to amber-400 on dark slate, darken muted text for >= 4.5:1 ratio, enforce semantic h1->h2->h3 hierarchy | ✓ |
| Subtle Contrast Boost | Touch only specific flagged stop tags without touching palette tokens | |

**User's choice:** High-Contrast Obsidian Tokens
**Notes:** Resolves all WCAG AA color contrast failures and heading hierarchy skips.

---

## Agentic Web Standards

| Option | Description | Selected |
|--------|-------------|----------|
| Full Agentic Discovery | Add top-level H1 & markdown link index to llms.txt, serve valid ai-catalog.json with JSON mime-type | ✓ |
| Fix llms.txt format only | Omit ai-catalog.json | |

**User's choice:** Full Agentic Discovery
**Notes:** Fulfills 4/4 agentic discovery criteria for AI agents and LLM scrapers.

---

## the agent's Discretion

- In-flight cache TTL (3s).
- Detailed Tailwind transition properties for hardware acceleration.
- Skeleton shimmer pulse styling.

## Deferred Ideas

- None — discussion stayed within the Lighthouse diagnostic scope.
