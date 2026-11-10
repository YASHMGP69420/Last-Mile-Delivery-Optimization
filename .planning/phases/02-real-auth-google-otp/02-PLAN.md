# Phase 02 Execution Plan: Real Authentication, Google OAuth & OTP Verification

**Milestone:** 2 — Production Authentication & High-Craft Motion UI  
**Goal:** Replace mock/demo authentication with real verified Google Identity Services Sign-In and passwordless Email/Phone OTP verification for registration and sign-in, while removing all demo quick-login shortcuts and simulated modals.

---

## Wave 1: Backend OTP Infrastructure, Google ID Token Verification & Auth Routes

**Objective:** Build verifiable OTP storage/delivery, real Google `OAuth2Client.verifyIdToken` authentication, OTP-gated driver registration, and passwordless OTP sign-in without breaking any existing corporate `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, or `/auth/users` contracts.

### Tasks

1. **Install Server Dependencies & Extend Env Configuration**
   - Install `google-auth-library` and `nodemailer` in `server/`.
   - Update `server/src/config/env.js` to expose:
     - `GOOGLE_CLIENT_ID`
     - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
     - `SMS_WEBHOOK_URL`
     - `OTP_TTL_MINUTES` (default `10`), `OTP_MAX_ATTEMPTS` (default `5`), `OTP_DEV_PREVIEW` (`process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_PREVIEW !== 'false'`)
   - Document all new keys in `.env.example`, `server/.env.example`, and `client/.env.example` (including `VITE_GOOGLE_CLIENT_ID`).

2. **Update `User` Model & Create `OtpToken` Model**
   - **`server/src/models/User.js`**:
     - Add `emailVerified: { type: Boolean, default: false }` and `phoneVerified: { type: Boolean, default: false }`.
     - Update `passwordHash` `required` validator to `!this.googleId && !this.emailVerified && !this.phoneVerified` so passwordless OTP accounts save cleanly.
     - Add normalized sparse index or lookup support on `phone` for OTP sign-in lookup.
   - **`server/src/models/OtpToken.js`** (New):
     - Fields: `target` (string, indexed, lowercase email or normalized phone), `channel` (`'EMAIL' | 'PHONE'`), `purpose` (`'REGISTER' | 'LOGIN'`), `codeHash` (SHA-256/HMAC hex string), `attempts` (number, default `0`), `maxAttempts` (number, default `5`), `verifiedAt` (Date, default `null`), `verificationTokenHash` (string, default `null`), `expiresAt` (Date, MongoDB TTL index `expires: 0`), timestamps.

3. **Create OTP Service & Notification Delivery Service**
   - **`server/src/services/otpDeliveryService.js`** (New):
     - `sendEmailOtp(toEmail, code, purpose)`: Uses `nodemailer.createTransport(...)` when `SMTP_HOST` & `SMTP_USER` & `SMTP_PASS` are configured; otherwise in non-production logs `[OTP-DEV][EMAIL]` cleanly to console and returns `{ delivered: true, channel: 'EMAIL', mode: 'DEV_CONSOLE' }`.
     - `sendSmsOtp(toPhone, code, purpose)`: Posts JSON `{ to, message, code }` to `SMS_WEBHOOK_URL` via native `fetch` if configured; otherwise logs `[OTP-DEV][SMS]` cleanly in non-production.
   - **`server/src/services/otpService.js`** (New):
     - Helper `normalizeOtpTarget(identifier, explicitChannel)`: detects/validates email (`EMAIL`) vs phone (`PHONE`, 10–15 digits / E.164 normalization).
     - `issueOtp({ identifier, channel, purpose })`: invalidates prior unverified tokens for `{ target, purpose }`, generates cryptographically random 6-digit code (`crypto.randomInt(100000, 1000000)`), stores HMAC-SHA256 `codeHash`, dispatches via `otpDeliveryService`, returns `{ target, channel, expiresInSeconds, deliveryMode, devPreviewCode }` (including `devPreviewCode` **only** when `env.OTP_DEV_PREVIEW` is true and delivery fell back to console/test).
     - `verifyOtpCode({ identifier, channel, purpose, code })`: validates non-expired unconsumed `OtpToken`, increments `attempts` atomically and locks/deletes after `maxAttempts` (`OTP_MAX_ATTEMPTS`), verifies `codeHash` via `crypto.timingSafeEqual`, sets `verifiedAt`, issues a single-use short-lived `verificationToken` (stored hashed on the record) and returns `{ target, channel, verificationToken }`.
     - `consumeVerificationToken({ identifier, purpose, verificationToken })`: verifies & deletes/consumes the token atomically during `/register`.

4. **Upgrade `authController.js` & `authRoutes.js`**
   - **`server/src/services/googleAuthService.js`** (New, cleanly isolated for unit testing):
     - Instantiates `OAuth2Client(env.GOOGLE_CLIENT_ID)` from `google-auth-library`.
     - `verifyGoogleIdToken(credential)`: throws `503 GOOGLE_AUTH_UNCONFIGURED` if `!env.GOOGLE_CLIENT_ID`; otherwise calls `client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID })`, checks `payload.email_verified === true`, and returns `{ googleId: payload.sub, email, name, avatarUrl, emailVerified: true }`.
   - **`server/src/controllers/authController.js`**:
     - Replace fake `jwt.decode` + arbitrary `profile` handling in `googleAuth` with strict `credential` verification via `googleAuthService.verifyGoogleIdToken(credential)`.
     - Fix Google onboarding role & Driver profile creation:
       - If existing `User` found by `{ $or: [{ googleId }, { email }] }`: keep existing corporate role (`ADMIN`, `FLEET_MANAGER`, or `DRIVER`), link `googleId`/`avatarUrl`, set `emailVerified: true`.
       - If new user: force `role: ROLES.DRIVER`, create `User`, and atomically create a linked `Driver` document (`licenseNumber: 'GGL-' + user._id.toString().slice(-8).toUpperCase()`, `phone: user.phone || 'PENDING'`) so first-time Google Sign-In works end-to-end (clean up `User` if `Driver` save fails).
     - Add `sendOtp(req, res, next)` (`POST /api/v1/auth/otp/send`):
       - Validates `purpose` (`'REGISTER' | 'LOGIN'`) and `identifier`.
       - For `'REGISTER'`: ensures no active `User` already holds that email or phone (`409 EMAIL_EXISTS` / `PHONE_EXISTS`).
       - For `'LOGIN'`: ensures a matching `User` exists and is `active` (`404 ACCOUNT_NOT_FOUND` / `401 USER_INACTIVE`).
       - Calls `otpService.issueOtp(...)`.
     - Add `verifyOtp(req, res, next)` (`POST /api/v1/auth/otp/verify`):
       - Verifies `{ identifier, channel, purpose, code }` and returns `{ verified: true, target, channel, verificationToken }`.
     - Add `otpLogin(req, res, next)` (`POST /api/v1/auth/otp/login`):
       - Passwordless Email/Phone OTP sign-in: consumes verified OTP (`code` or `verificationToken` with `purpose: 'LOGIN'`), locates `User` by email or normalized phone, attaches linked `Driver` profile if `role === DRIVER`, mints JWT + rotating `refreshToken`, persists `refreshToken`, updates `emailVerified`/`phoneVerified` & `lastLogin`, returns standard auth payload.
     - Update `register(req, res, next)` (`POST /api/v1/auth/register`):
       - Require verified OTP BEFORE creating any account (`verificationToken` from `/otp/verify` OR inline `{ otp, otpTarget }` verified for `purpose: 'REGISTER'`).
       - Make `password` optional (supports passwordless registration; hashes if supplied).
       - Still strictly enforce `ROLES.DRIVER` only (`403 REGISTRATION_ROLE_FORBIDDEN` for `ADMIN`/`FLEET_MANAGER`) and require `licenseNumber` + `phone` for `Driver` profile creation.
   - **`server/src/routes/authRoutes.js`**:
     - Mount `POST /otp/send`, `POST /otp/verify`, and `POST /otp/login` behind `authRateLimiter`.

5. **Backend Test Coverage (`server/tests/auth_otp_google.test.js`)**
   - Write comprehensive Jest + Supertest integration tests covering:
     - Sending OTP for `REGISTER` and `LOGIN` (email & phone), duplicate registration rejection (`409`), unknown login rejection (`404`).
     - Verifying wrong OTP increments attempt count & locks out after 5 invalid attempts (`401`/`429`).
     - Registration fails with `400`/`401` without verified OTP; succeeds passwordlessly with verified OTP and marks `emailVerified`/`phoneVerified = true` + creates `Driver`.
     - Passwordless `POST /api/v1/auth/otp/login` mints valid access + refresh tokens compatible with `/auth/refresh` & `/auth/me`.
     - `POST /api/v1/auth/google` rejects spoofed `profile` payloads without `credential`, rejects unconfigured/invalid ID tokens, and verifies valid tokens (mocking `googleAuthService.verifyGoogleIdToken`) while blocking role elevation to `ADMIN` on new accounts and auto-provisioning a linked `Driver`.

**Wave 1 Verification:** Run `npm --prefix server test` — all existing tests AND `auth_otp_google.test.js` pass with zero regressions.

---

## Wave 2: Frontend Real Google Identity Services, OTP Flows & Login Cleanup

**Objective:** Remove all demo quick-login cards and simulated Google modals from the client, add real Google Identity Services rendering, and implement seamless passwordless Email/Phone OTP registration and sign-in flows.

### Tasks

1. **Client Google Identity Services Component (`client/src/components/auth/GoogleSignInButton.tsx`)**
   - Load `https://accounts.google.com/gsi/client` dynamically via helper hook when `import.meta.env.VITE_GOOGLE_CLIENT_ID` is present.
   - Initialize `window.google.accounts.id.initialize({ client_id, callback })` and render Google's official button into a ref container (`theme`, `size: 'large'`, `width`, `text: 'continue_with'`).
   - On credential callback, pass `{ credential }` (raw verified JWT ID token) to `onCredential(credential)`.
   - When `VITE_GOOGLE_CLIENT_ID` is empty/unconfigured: show a subtle disabled configuration notice (`Google OAuth unavailable — configure VITE_GOOGLE_CLIENT_ID`) rather than a fake demo account chooser.

2. **Update `client/src/context/AuthContext.tsx` & `client/src/types/auth.ts` (if present)**
   - Remove `quickLogin` completely from `AuthContextType` and `AuthProvider`.
   - Replace `googleLogin(payload, role)` signature with `googleLogin(credential: string): Promise<User>` posting `{ credential }` to `/auth/google`.
   - Add `sendOtp(params: { identifier: string; channel?: 'EMAIL' | 'PHONE'; purpose: 'REGISTER' | 'LOGIN' }): Promise<{ target: string; channel: 'EMAIL' | 'PHONE'; expiresInSeconds: number; deliveryMode: string; devPreviewCode?: string }>`.
   - Add `verifyOtp(params: { identifier: string; channel?: 'EMAIL' | 'PHONE'; purpose: 'REGISTER' | 'LOGIN'; code: string }): Promise<{ verified: boolean; target: string; channel: 'EMAIL' | 'PHONE'; verificationToken: string }>`.
   - Add `loginWithOtp(params: { identifier: string; channel?: 'EMAIL' | 'PHONE'; code: string }): Promise<User>` calling `/auth/otp/login`.
   - Update `register(...)` to send `{ name, email, phone, licenseNumber, verificationToken, otpTarget }` (passwordless, OTP-verified) to `/auth/register`.
   - Preserve `login(email, password)` cleanly for Corporate Password Sign-In (Admin / Fleet Manager).

3. **Rebuild `client/src/pages/LoginPage.tsx`**
   - **Remove Demo Artifacts (`AUTH-CLN-05`)**:
     - Delete `showGoogleModal`, `customGoogleEmail`, `customGoogleName`, `executeGoogleSignIn`, and the entire Google Account Selector modal JSX.
     - Delete `handleQuickLogin`, the "Yashaswee Mishra" quick-access card, and the `Test System Profiles` (`Admin` / `Manager` / `Demo Driver`) card grid.
   - **Implement Real Sign-In Modes (`SIGN_IN`)**:
     - Primary non-Google mode: **Passwordless Email / Phone OTP Sign-In**:
       - Step 1: Enter registered Email or Phone number + click `Send OTP`.
       - Step 2: Enter 6-digit OTP code (with resend countdown timer + safe dev-preview notice banner when backend returns `devPreviewCode` in non-production local mode) + click `Verify & Sign In`.
     - Secondary toggle link/tab (`Corporate Password Sign-In`): clean Email/Phone + Password form calling `login(identifier, password)` for provisioned Admins & Fleet Managers.
   - **Implement OTP-Verified Driver Registration (`REGISTER`)**:
     - Step 1: Choose Email or Phone verification channel, enter Email, Phone, Full Name, Commercial License Number -> click `Verify Contact & Send OTP` (`purpose: 'REGISTER'`).
     - Step 2: Enter 6-digit OTP -> verifies via `/auth/otp/verify` and creates Driver account via `/auth/register` (`verificationToken`) -> signs in automatically and routes to `/driver`.
   - **Real Google Sign-In Section**:
     - Mount `GoogleSignInButton` under an `or continue with Google` divider; handles loading/errors cleanly (`Driver profile...` or verification errors displayed in error banner).
   - Keep Phase 03 GSAP card/field entrance styling and glassmorphism tokens consistent.

4. **TypeScript & Vite Build Verification**
   - Verify no remaining imports/usages of `quickLogin` or simulated Google profile payloads exist anywhere under `client/src`.
   - Run `npm --prefix client test` (`tsc --noEmit`) and `npm --prefix client run build`.

---

## Wave 3: End-to-End Verification, Documentation & Git Push

1. Run full server test suite (`npm --prefix server test`) and client typecheck/build (`npm --prefix client test && npm --prefix client run build`).
2. Verify `.planning/ROADMAP.md` & `.planning/STATE.md` status tracking.
3. Update `.planning/phases/02-real-auth-google-otp/02-VERIFICATION.md` upon execution and push directly to `origin/master`.
