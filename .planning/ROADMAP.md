# SmartRoute Roadmap

## Milestone 1: Core System & Operational Stabilization (Completed)

- [x] **Phase 01: Operational Dispatch & Driver Workflow Stabilization** (Completed 2026-11-09)
  - FIX-MSG-01: Direct driver messaging without requiring active route lookup or failing with 'Route not found'
  - REM-BRK-02: Remove driver break option and shift break controls from UI and API endpoints
  - FIX-PSH-03: Enable seamless 'Push to Driver Handheld' from Route Planner and Optimization panel
  - FIX-ASN-04: Eliminate duplicate and cascading vehicle/driver assignments across planner and batches
  - FIX-UI-05: Driver mobile handheld UI viewport containment, unclipped bottom action card, and normalized touch targets

## Milestone 2: Production Authentication & High-Craft Motion UI (In Progress)

- [ ] **Phase 02: Real Authentication, Google OAuth & OTP Verification**
  - Goal: Replace mock/demo authentication with real verified Google Identity Services Sign-In and passwordless Email/Phone OTP verification for registration and sign-in.
  - Requirements: `AUTH-GGL-01`, `AUTH-GGL-02`, `AUTH-OTP-01`, `AUTH-OTP-02`, `AUTH-REG-03`, `AUTH-LGN-04`, `AUTH-CLN-05`
- [x] **Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI** (Completed 2026-11-10)
  - Goal: Add subtle glassmorphism, bouncy/spongy GSAP micro-interactions, and GPU-accelerated page switch animations across Admin and Driver SPAs while keeping native touch scrolling and Leaflet map interactions fast.
  - Requirements: `UI-GLS-01`, `UI-GSAP-02`, `UI-TRN-03`, `UI-SPR-04`, `UI-SCR-05`
- [x] **Phase 04: End-to-End Admin ↔ Fleet ↔ Driver Communication, State Sync & Dead-UI Cleanup** (Completed 2026-11-10)
  - Goal: Fix broken Admin/Fleet↔Driver messaging, completion/POD/vehicle state sync, Socket.IO room isolation, continuous telemetry, and prune broken/orphaned/AI-artifact UI elements across Admin, Fleet, and Driver screens.
