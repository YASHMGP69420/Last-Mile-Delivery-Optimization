# Requirements Archive: v5 Final PRD Completion & Audit Closure

**Archived:** 2026-11-11
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements — Milestone 2: Production Authentication & High-Craft Motion UI

## Phase 02: Real Authentication, Google OAuth & OTP Verification

- **AUTH-GGL-01**: Integrate real Google Identity Services (`@react-oauth/google` / GSI script) on `LoginPage.tsx` using `VITE_GOOGLE_CLIENT_ID`.
- **AUTH-GGL-02**: Verify Google ID tokens cryptographically on the backend (`POST /api/v1/auth/google`) using `google-auth-library` (`OAuth2Client.verifyIdToken`); reject unsigned/forged profile payloads and auto-provision linked `Driver` profile when onboarding new drivers cleanly.
- **AUTH-OTP-01**: Implement OTP generation, hashing (`bcrypt`/`crypto`), expiration (5 min TTL), attempt limiting (max 5 attempts), and resend cooldown (60s) via an `OtpToken` MongoDB model + `otpService.js`.
- **AUTH-OTP-02**: Support Email OTP delivery (Nodemailer SMTP when `SMTP_HOST`/`SMTP_USER` configured) and Phone SMS OTP delivery (configurable webhook/Twilio gateway) with safe dev/test console/response preview fallback when keys are absent (`NODE_ENV !== 'production'`).
- **AUTH-REG-03**: Enforce Email or Phone OTP verification before creating a new driver account (`POST /api/v1/auth/otp/request` -> `POST /api/v1/auth/otp/verify` -> `POST /api/v1/auth/register` with `verificationToken`).
- **AUTH-LGN-04**: Support passwordless Email/Phone OTP Sign-In (`POST /api/v1/auth/login-otp/request` -> `POST /api/v1/auth/login-otp/verify`) so non-Google users verify ownership via 6-digit OTP before signing in.
- **AUTH-CLN-05**: Remove the simulated Google account picker modal and hardcoded demo quick-login shortcuts from `LoginPage.tsx`.

## Phase 03: GSAP Motion, Subtle Glassmorphism & Page Transitions UI

- **UI-GLS-01**: Establish subtle glassmorphism tokens (`backdrop-blur-md`, translucent `--surface-glass` cards, crisp 1px specular border highlights) across floating bars, headers, modals, and drawers in Daylight White & Obsidian Dark modes.
- **UI-GSAP-02**: Integrate `gsap` and `@gsap/react` (`useGSAP`) for smooth staggered entrance animations on dashboard KPIs, cards, tables, and driver HUD components (`ease: "back.out(1.4)"` spongy/bouncy feel), strictly respecting `prefers-reduced-motion`.
- **UI-TRN-03**: Implement GPU-accelerated page switch transitions across Admin and Driver routes (`RouteTransitionWrapper`), giving instant tactile spring feel (`opacity`, `y`, `scale`) when switching tabs or views.
- **UI-SPR-04**: Add subtle spongy/bouncy micro-interactions (`scale` spring press/release, floating nav pill/tab slide transitions) on interactive buttons, `DriverBottomNav`, and modal dialogs without blocking pointer or Leaflet map gestures.
- **UI-SCR-05**: Keep scrolling native and hardware-accelerated (`overscroll-contain`, `will-change: transform`) on Driver Handheld and Leaflet map containers so touch panning, pinch-to-zoom, and nested drawers stay fast and responsive without Locomotive Scroll hijacking conflicts.
