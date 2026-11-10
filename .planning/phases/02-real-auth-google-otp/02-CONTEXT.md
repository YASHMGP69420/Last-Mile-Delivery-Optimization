# Phase 02 Context: Real Authentication, Google OAuth & OTP Verification

## Requirements Mapped
- **AUTH-GGL-01**: Real Google Identity Services (`VITE_GOOGLE_CLIENT_ID`) rendered on client LoginPage and verified server-side via `google-auth-library` (`OAuth2Client.verifyIdToken` with `GOOGLE_CLIENT_ID`).
- **AUTH-GGL-02**: Safe configuration fallback guidance when Google Client ID env vars are absent in local dev/CI (no forged `google_${email}` payloads, no unverified JWT `jwt.decode` fallback).
- **AUTH-OTP-01**: Email/Phone OTP generation, cryptographic hashing (SHA-256/HMAC), TTL expiry (10 min), attempt cap (5 attempts), and delivery via SMTP (`nodemailer`) or SMS webhook/Twilio with safe dev console + non-production preview fallback when credentials are omitted.
- **AUTH-OTP-02**: `POST /api/v1/auth/otp/send`, `POST /api/v1/auth/otp/verify`, and `POST /api/v1/auth/otp/login` protected by `authRateLimiter`.
- **AUTH-REG-03**: Driver self-registration (`POST /api/v1/auth/register`) requires verified Email or Phone OTP BEFORE creating `User` and `Driver` documents; passwordless non-Google accounts allowed (`emailVerified`/`phoneVerified`).
- **AUTH-LGN-04**: Passwordless Email/Phone OTP Sign-In flow as primary non-Google authentication; secondary "Corporate Password Sign-In" mode retained on `/login` for provisioned Admins & Fleet Managers (preserving existing `/api/v1/auth/login` contract).
- **AUTH-CLN-05**: Complete removal of hardcoded demo quick-login cards (`Yashaswee Mishra`, `Test System Profiles`, `quickLogin`) and the simulated Google Account Selector modal from `LoginPage.tsx` and `AuthContext.tsx`.

## Codebase Baseline & Constraints (Verified 2026-11-10)
1. **Existing Auth Endpoints & Tests to Preserve**:
   - `server/tests/auth.test.js`, `auth_refresh.test.js`, `adversarial.test.js`, `socket_auth.test.js` exercise `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/users`.
   - Zero existing tests call `/auth/register` or `/auth/google`.
   - `POST /api/v1/auth/login` MUST remain backward-compatible for provisioned `ADMIN` / `FLEET_MANAGER` corporate password sign-in and automated test suites.
2. **Database Models**:
   - `server/src/models/User.js`: Currently requires `passwordHash` when `!this.googleId`. Must be updated to allow passwordless OTP accounts when `emailVerified || phoneVerified`, and add `emailVerified: Boolean`, `phoneVerified: Boolean`.
   - `server/src/models/Driver.js`: Requires unique `licenseNumber` (uppercase trimmed) and `phone`. For Google OAuth onboarding of a brand-new `DRIVER` user, provision a linked `Driver` document cleanly (`GGL-${userIdSuffix}`) with `phone: user.phone || 'PENDING'` so first-time Google sign-in does not throw `404 DRIVER_PROFILE_MISSING` with a half-created `User`.
3. **Security Hardening**:
   - Never use `jwt.decode()` without signature/audience verification on Google ID tokens (`authController.googleAuth`).
   - Never accept `role` elevation to `ADMIN` or `FLEET_MANAGER` via public `/google` or `/register` endpoints; existing provisioned Admins/Managers keep their DB role when signing in with matching verified Google email, while brand-new Google/self-registered accounts strictly receive `ROLES.DRIVER`.
   - Never leak OTP preview codes in `NODE_ENV === 'production'`.
4. **Packages & Environment Variables**:
   - Server (`server/package.json`): Add `google-auth-library`, `nodemailer`.
   - Server env (`server/src/config/env.js`, `.env.example`, `server/.env.example`): Add `GOOGLE_CLIENT_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMS_WEBHOOK_URL`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_DEV_PREVIEW`.
   - Client env (`client/.env.example`, `.env.example`): Add `VITE_GOOGLE_CLIENT_ID`.
   - Client Google SDK: Official Google Identity Services script (`https://accounts.google.com/gsi/client`) loaded dynamically by a reusable `GoogleSignInButton` component when `VITE_GOOGLE_CLIENT_ID` is defined, avoiding heavy third-party wrapper lock-in.
