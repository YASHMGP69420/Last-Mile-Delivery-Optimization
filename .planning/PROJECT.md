# SmartRoute — Last-Mile Delivery Optimization Platform

## Project Vision
SmartRoute is an enterprise last-mile logistics and fleet dispatch platform tailored for urban distribution hubs (e.g., Rasulgarh Logistics Hub, Bhubaneswar). It pairs an operations control center (VRP 2-Opt route optimization, batch orchestration, live fleet telemetry, and RBAC governance) with a responsive, field-ready driver mobile handheld cockpit.

## Milestone History
- **Milestone 1: Core System & Operational Stabilization** (Completed 2026-11-09)
  - F-01..F-07 audit remediation (batch CRUD parity, Socket.IO JWT security, O(1) LRU MatrixCache, transactional dispatch execution).
  - Phase 01: Direct driver messaging (`FIX-MSG-01`), removal of driver break option (`REM-BRK-02`), push-to-handheld reliability (`FIX-PSH-03`), idempotent fleet assignment (`FIX-ASN-04`), handheld viewport & map stacking repairs (`FIX-UI-05`, `A11Y-06`), CI/CD lockfile & Docker health fix, and removal of non-functional decorative UI artifacts.

## Current Milestone: Milestone 2 — Production Authentication & High-Craft Motion UI
1. **Real Authentication, Google OAuth & OTP Verification (Phase 02)**:
   - Cryptographically verified Google Sign-In (Google Identity Services + `google-auth-library`).
   - Passwordless Email & Phone OTP verification before creating accounts and signing in (when not authenticating via Google), with SMTP/SMS provider integration and safe local dev/CI preview fallback.
   - Removal of simulated Google modal and hardcoded demo quick-login shortcuts.
2. **GSAP Motion, Subtle Glassmorphism & Page Transitions UI (Phase 03)**:
   - Tactile, bouncy/spongy micro-interactions, GPU-accelerated route switch animations, and subtle glassmorphic surfaces powered by **GSAP** (`gsap` + `useGSAP`), cleanly scoped to avoid breaking Leaflet map gestures or driver handheld touch-scroll viewports.
