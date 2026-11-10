# Phase 05 Context: Real Out-of-Band Email & SMS OTP Delivery + Zero Frontend OTP Leakage

## Problem Statement
During Phase 02 execution, `OTP_DEV_PREVIEW` defaulted to returning the generated 6-digit OTP inside `POST /api/v1/auth/otp/send` JSON responses (`devPreviewCode`) and rendering it directly inside `LoginPage.tsx`. In addition, unconfigured SMTP/SMS channels returned `{ delivered: true, mode: 'DEV_CONSOLE' }`, silently pretending an OTP was delivered when no real email or SMS was sent.

## Security & Functional Requirements
- **OTP-SEC-01 (Zero Client OTP Leakage)**: Completely remove `devPreviewCode`, `OTP_DEV_PREVIEW`, and all UI preview banners. Never return plaintext OTP codes in any HTTP response, header, or error payload across all `NODE_ENV` modes (`development`, `test`, `production`).
- **OTP-EML-02 (Real Email OTP via SMTP / Gmail / Custom Provider)**:
  - `nodemailer` transport with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (plus convenient `SMTP_SERVICE` / `smtp.gmail.com` support).
  - Verify connection / send real mail cleanly; fail loudly if SMTP fails or is unconfigured (`503 EMAIL_OTP_UNCONFIGURED` / `502 OTP_DELIVERY_FAILED`) and delete the pending `OtpToken` so failed sends do not leave dangling records.
- **OTP-SMS-03 (Real Phone SMS OTP via Twilio / Fast2SMS / Webhook)**:
  - First-class native `fetch` support (zero heavy SDK bloat) for:
    1. **Twilio REST API** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
    2. **Fast2SMS** (`FAST2SMS_API_KEY`, ideal for Indian `+91` 10-digit driver numbers)
    3. **Custom SMS Webhook** (`SMS_WEBHOOK_URL` + optional `SMS_WEBHOOK_SECRET`)
  - Fail explicitly with `503 SMS_OTP_UNCONFIGURED` when no SMS provider is configured rather than faking delivery.
- **OTP-CAP-04 (Provider Readiness & Cooldown Guard)**:
  - Add `GET /api/v1/auth/otp/providers` returning non-sensitive boolean capabilities (`{ emailConfigured, smsConfigured, deliveryModes }`).
  - Enforce server-side per-target resend cooldown (30 seconds, configurable via `OTP_RESEND_COOLDOWN_SECONDS`, skipped only if `0`) to prevent email/SMS spam & cost abuse.
  - Update `LoginPage.tsx` to disable/flag unconfigured OTP channels honestly using `/auth/otp/providers` and guide users to configure SMTP/SMS credentials or use the active channel / Google Sign-In.

## Preserved Contracts
- Existing JWT + refresh rotation (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/users`, `/auth/google`) remain unchanged.
- `server/tests/auth_otp_google.test.js` will spy on `otpDeliveryService` (`sendEmailOtp` / `sendSmsOtp`) to capture delivered codes in tests without relying on any HTTP response leakage (`devPreviewCode` strictly forbidden and asserted `undefined`).
