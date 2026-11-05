# SmartRoute Admin Security & Operational Guardrails

## 1. Principles of Least-Privilege & Zero-Trust

SmartRoute adheres to least-privilege administrative principles. Privileged actions are audited, verified, and restricted to prevent accidental system destruction, credential leakage, or unauthorized elevation of privileges.

---

## 2. Mandatory Security Guardrails

### 2.1 Self-Lockout & Demotion Guard
- Administrators **cannot** suspend or deactivate their own active account (`SELF_LOCKOUT_PREVENTED` HTTP 403).
- Administrators **cannot** revoke their own `ADMIN` role (`SELF_DEMOTION_BLOCKED` HTTP 403).
- Any attempt to modify one's own role requires an independent second administrator account.

### 2.2 Password & Sensitive Field Sanitization
- Passwords are encrypted with bcrypt (10 rounds).
- Database queries across all routes use `{ select: false }` for `passwordHash` and `refreshToken`.
- User and Driver JSON response serializations strictly delete `passwordHash`, `refreshToken`, and Mongo internal properties (`__v`).

### 2.3 Mandatory Rationale for Operational Overrides
- Manual vehicle groundings (`SUSPEND_MAINTENANCE`), driver availability overrides, route cancellations, and failed delivery reopenings strictly require a `reason` parameter of **at least 5 characters**.
- Requests submitted without a reason are rejected with `400 REASON_REQUIRED`.

### 2.4 Immutable Append-Only Audit Logging
- Every administrative action generates a non-destructive, non-editable `AuditEvent` record.
- Ordinary administrators have zero endpoints to edit, alter, or delete audit events.
- Audit logs capture:
  - `actorId` (Admin ObjectId)
  - `action` (Description of mutation)
  - `type` (Classification code)
  - `metadata` (Previous state, new state, target record ID, reason)
  - `at` (Authoritative server timestamp).

### 2.5 Masked Integration Secrets
- External secrets (such as the `GEOAPIFY_API_KEY`) are loaded via environment variables and never exposed in browser payloads.
- Status diagnostics return masked strings (e.g., `d45b••••••••9a12`).

### 2.6 Driver Privacy & Location Tracking Policy
- Driver GPS coordinates are collected strictly for active delivery navigation and dispatch safety.
- Covert or background tracking during off-duty hours is technically prohibited.
- When a driver is marked `OFF_DUTY`, telemetry updates are ignored and location sharing is deactivated.
