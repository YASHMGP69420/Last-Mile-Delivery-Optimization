# Phase 05 Execution Plan: Real Out-of-Band Email & SMS OTP Delivery + Zero Frontend OTP Leakage

**Milestone:** 2 — Production Authentication & High-Craft Motion UI  
**Goal:** Eliminate all frontend/HTTP OTP exposure (`devPreviewCode`), enforce honest out-of-band Email (SMTP) and Phone (Twilio / Fast2SMS / Webhook) OTP delivery with failure rollback and resend cooldowns, and expose provider readiness cleanly in the UI.

---

## Wave 1: Server Hardening, Multi-Provider Email/SMS Delivery & Provider Capability API

**Objective:** Remove `devPreviewCode` completely from the backend, wire real Email (SMTP) + Phone (Twilio, Fast2SMS, Webhook) delivery providers, roll back tokens on failed delivery, and enforce resend cooldowns.

### Tasks

1. **Remove `OTP_DEV_PREVIEW` & Add Real Provider Env Keys (`server/src/config/env.js`, `.env.example`, `server/.env.example`)**
   - Remove `OTP_DEV_PREVIEW` from `env.js` and `.env.example` / `server/.env.example`.
   - Add configuration keys in `env.js`:
     - `SMTP_SERVICE` (optional, e.g., `'gmail'`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
     - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
     - `FAST2SMS_API_KEY`
     - `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_SECRET`
     - `OTP_RESEND_COOLDOWN_SECONDS` (default `30`, `0` in `.env.test` if tests issue rapid resends, or respected explicitly in cooldown tests)

2. **Upgrade `server/src/services/otpDeliveryService.js`**
   - **`isSmtpConfigured()`** & **`isSmsConfigured()`** + **`getOtpProviderStatus()`** returning `{ emailConfigured, smsConfigured, emailProvider, smsProvider }`.
   - **`sendEmailOtp(toEmail, code, purpose)`**:
     - If `!isSmtpConfigured()`, throw `AppError('Email OTP delivery is not configured on the server. Set SMTP credentials in server/.env.', 503, 'EMAIL_OTP_UNCONFIGURED')`.
     - Build `nodemailer` transporter (`service: env.SMTP_SERVICE` when set, otherwise `host`/`port`/`secure`) and send HTML + plain-text OTP email.
     - Catch transport errors and throw `AppError('Failed to send OTP email via SMTP.', 502, 'OTP_DELIVERY_FAILED')`.
   - **`sendSmsOtp(toPhone, code, purpose)`**:
     - Priority order:
       1. **Twilio** (`TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER`): `POST https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json` with Basic Auth and URL-encoded form body `{ To, From, Body }`.
       2. **Fast2SMS** (`FAST2SMS_API_KEY`): strips `+91` / country code for 10-digit Indian numbers, calls `POST https://www.fast2sms.com/dev/bulkV2` (`route: 'otp'` or `'q'`, `authorization: apiKey`).
       3. **Custom Webhook** (`SMS_WEBHOOK_URL`): `POST` JSON `{ to, code, purpose, message }` with optional `X-Webhook-Secret` header.
     - If none configured, throw `AppError('SMS OTP delivery is not configured on the server. Set Twilio, Fast2SMS, or SMS_WEBHOOK_URL in server/.env, or use Email OTP.', 503, 'SMS_OTP_UNCONFIGURED')`.
     - Wrap HTTP failures cleanly as `502 OTP_DELIVERY_FAILED`.

3. **Harden `server/src/services/otpService.js`**
   - Remove every reference to `devPreviewCode` and `OTP_DEV_PREVIEW`.
   - Enforce server-side per-target resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`): before overwriting an existing unconsumed `OtpToken` for `{ target, purpose }`, check `createdAt`; if younger than cooldown (and `cooldown > 0`), throw `AppError('Please wait before requesting another verification code.', 429, 'OTP_RESEND_COOLDOWN')`.
   - **Rollback on Delivery Failure**: Save `OtpToken`, dispatch `sendEmailOtp` / `sendSmsOtp`, and if delivery throws, delete the newly created `OtpToken` in `catch` before rethrowing so failed deliveries never persist dangling codes.
   - Return strictly `{ target, channel, purpose, expiresInSeconds, deliveryMode }` (never the OTP code!).

4. **Add Capabilities Endpoint (`server/src/controllers/authController.js`, `server/src/routes/authRoutes.js`)**
   - Add `getOtpProviders(req, res)` returning `200 { emailConfigured, smsConfigured, emailProvider, smsProvider }` (never exposing secrets, usernames, or phone numbers).
   - Mount `GET /api/v1/auth/otp/providers` on `authRoutes.js`.

5. **Update & Expand Backend Tests (`server/tests/auth_otp_google.test.js`)**
   - Update OTP tests to spy on `otpDeliveryService.sendEmailOtp` / `otpDeliveryService.sendSmsOtp` (capturing the sent code cleanly via `jest.spyOn`) rather than reading `devPreviewCode`.
   - Explicitly assert `sendRes.body.data.devPreviewCode === undefined` and `JSON.stringify(sendRes.body)` does NOT contain the generated OTP code!
   - Add tests verifying:
     - `503 EMAIL_OTP_UNCONFIGURED` / `503 SMS_OTP_UNCONFIGURED` when providers are missing and `OtpToken` is cleaned up / not left orphaned.
     - Twilio / Fast2SMS / SMTP transport invocation arguments and rollback on simulated transport error (`502 OTP_DELIVERY_FAILED`).
     - `429 OTP_RESEND_COOLDOWN` enforcement when resending too quickly.
     - `GET /api/v1/auth/otp/providers` boolean accuracy.

**Wave 1 Verification:** `npm --prefix server test -- tests/auth_otp_google.test.js` passes all assertions.

---

## Wave 2: Frontend Cleanup & Provider-Aware OTP UX

**Objective:** Remove `devPreviewCode` types and banner from the React app completely, query `/auth/otp/providers` on `LoginPage`, and guide users cleanly across available channels.

### Tasks

1. **Remove `devPreviewCode` & Add `getOtpProviders` in `client/src/context/AuthContext.tsx`**
   - Remove `devPreviewCode?: string` from `SendOtpResult`.
   - Add `OtpProvidersStatus` (`{ emailConfigured: boolean; smsConfigured: boolean }`) and `getOtpProviders()` calling `GET /auth/otp/providers`.

2. **Update `client/src/pages/LoginPage.tsx`**
   - Delete `devOtpPreview` state and the `data-testid="dev-otp-preview"` banner completely.
   - Fetch `getOtpProviders()` on mount:
     - Show clear provider availability hint if `emailConfigured === false` or `smsConfigured === false` (e.g., disable SMS OTP channel button or show `"SMS unavailable (no gateway configured)"` / `"SMTP Email OTP requires server SMTP configuration — use Corporate Password or Google Sign-In"`).
     - Update copy under OTP step to tell the user to check their **email inbox / spam folder** (for `EMAIL`) or **SMS messages** (for `PHONE`).
   - Handle `503 EMAIL_OTP_UNCONFIGURED` / `503 SMS_OTP_UNCONFIGURED` / `429 OTP_RESEND_COOLDOWN` gracefully in the error banner.

3. **TypeScript & Vite Build Verification**
   - Verify zero occurrences of `devPreviewCode` or `devOtpPreview` remain anywhere under `client/src` or `server/src`.
   - Run `npm --prefix client test` and `npm --prefix client run build`.

---

## Wave 3: Full Verification, Documentation & Push

1. Run full `npm --prefix server test` and `npm --prefix client test && npm --prefix client run build`.
2. Help configure Gmail SMTP (using a Gmail App Password in `server/.env`, if user provides/wants to test live email OTP) and write `.planning/phases/05-real-otp-delivery-hardening/05-VERIFICATION.md`.
3. Update `.planning/ROADMAP.md` & `.planning/STATE.md` and push to `origin/master`.
