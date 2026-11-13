# Security Policy

## Supported Versions

| Version | Security updates |
| --- | --- |
| `main` | Yes |
| Latest release | Yes |
| Earlier releases and feature branches | No |

## Reporting a Vulnerability

Please do not disclose vulnerabilities in a public issue. Open a private GitHub
Security Advisory for this repository; if that is unavailable, contact a project
maintainer privately. Include the affected component, reproduction steps, impact,
and any suggested mitigation.

We aim to acknowledge reports within 72 hours and to provide a remediation plan
within 7 days for critical vulnerabilities. Disclosure timing is coordinated
with the reporter after a fix is available.

## Supply Chain Security

This policy implements the package-legitimacy mitigation in **T-15-SC** and the
accepted-risk process in **AR-15-04** from
[`15-SECURITY.md`](.planning/milestones/v7-phases/15-dispatch-simplification-auto-vehicle-assignment/15-SECURITY.md).

Before adding any npm dependency, check its npm package page, linked GitHub
repository activity, maintainers, and download history. Classify the result:

| Classification | Meaning | Required action |
| --- | --- | --- |
| **[VERIFIED]** | Well-known, active, reputable package | Normal review may proceed. |
| **[ASSUMED]** | Unfamiliar but plausible package | Stop for a blocking human security review before installation. |
| **[SUS]** | Possible typosquat, no credible repository, sole new maintainer, or very recent package | Stop for a blocking human security review before installation. |
| **[SLOP]** | Obvious malware, typosquat, or otherwise untrustworthy package | Forbidden; do not install. |

For **[ASSUMED]** and **[SUS]** packages, do not run a package-manager install
until a reviewer explicitly approves the package name and version. Record the
classification and review in the PR or commit. The reviewer checks that the npm
package matches its source repository, has no suspicious install scripts or
obfuscated code, and has an acceptable dependency chain.

Dependabot is configured for the root, client, and server npm manifests. It opens
security-update PRs only; CI runs `npm audit --audit-level=high` and the normal
test suite for those PRs. Dependabot alerts and Dependabot security updates must
also be enabled in the repository's GitHub settings.

### Current Accepted Risk

| Risk | Description | Severity | Monitoring |
| --- | --- | --- | --- |
| **AR-15-04** | `jest` pulls in vulnerable `deepmerge` transitively as a development dependency. | High | Monitor upstream fixes; CI audit guards against new high/critical findings. |

## Platform Controls

- **Security headers (Phase 11):** Helmet CSP, COOP (`same-origin-allow-popups`),
  HSTS, and related browser-hardening headers protect the production server.
- **Authentication (Phases 02/05):** Google OAuth, rotating JWTs, and out-of-band
  OTP delivery are used for account access and verification.
- **RBAC:** `ADMIN`, `FLEET_MANAGER`, and `DRIVER` permissions are enforced with
  frontend route guards and backend endpoint authorization middleware.
