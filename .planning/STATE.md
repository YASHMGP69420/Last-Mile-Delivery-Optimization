---
status: planning
milestone: 2
current_phase: 02
total_phases: 3
progress:
  percent: 33
  completed_phases: 1
  total_phases: 3
last_updated: 2026-11-10T18:42:00Z
---

# Project State

## Status
- **Current Milestone**: Milestone 2 (Production Authentication & High-Craft Motion UI)
- **Active Phases**:
  - Phase 02: Real Authentication, Google OAuth & OTP Verification (Planned next)
  - Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI (UI-SPEC Locked)
- **Milestone 1 (Phase 01)**: Completed & Verified

## Locked Architecture & User Decisions (Milestone 2)
- **Google OAuth**: Real Google Identity Services (`VITE_GOOGLE_CLIENT_ID`) + backend verification via `google-auth-library`. Fallback guidance/test mocking only when keys are absent in local dev/CI.
- **OTP Verification**: Required before account creation AND passwordless Email/Phone OTP Sign-In (skip password for non-Google login). SMTP/SMS with safe dev console/test preview fallback when credentials are absent.
- **Login Cleanup**: Remove hardcoded demo quick-login cards and simulated Google selector modal completely.
- **Motion & Glassmorphism**: GSAP (`gsap` + `@gsap/react`) + subtle glassmorphism + spongy/bouncy spring transitions (`back.out`), keeping native touch scroll on Driver Handheld & Leaflet map containers without Locomotive Scroll hijacking.
