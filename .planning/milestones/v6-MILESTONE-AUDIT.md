---
milestone: v6
audited: "2026-11-11T16:53:00Z"
status: tech_debt
scores:
  requirements: 15/15
  phases: 4/4
  integration: 15/15
  flows: 4/4
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 11-server-client-runtime-hardening
    items:
      - "Post-deploy browser verification (`HARD-04`): confirm live Google Identity Services popup completion and Geoapify/OSM/CARTO tile rendering with real production `VITE_GOOGLE_CLIENT_ID` & `VITE_GEOAPIFY_TILE_API_KEY` credentials (`11-VERIFICATION.md` automated checks passed 12/12)."
  - phase: 12-containerization-nginx-reverse-proxy
    items:
      - "Live Docker daemon runtime verification (`CONT-02`, `CONT-03`): Docker Desktop Linux Engine was stopped locally (`DOCKER_DAEMON_UNAVAILABLE`); live `docker build`, `nginx -t`, and `docker compose up` + `smoke-test.js` execute in `.github/workflows/ci.yml` (`docker-and-compose` job) on GitHub push."
  - phase: 14-audited-env-templates-production-runbook
    items:
      - "Dead configuration surface: `MAP_PROVIDER` and `VITE_MAP_PROVIDER` are documented in env templates, `Dockerfile`, `docker-compose.yml`, `render.yaml`, and CI without runtime branching in `server/src/` or `client/src/` (harmless metadata)."
      - "Resolved during audit: clarified `README.md` Topology A Step 1 to replace `.env.example`'s `127.0.0.1` `MONGODB_URI` with `mongodb://mongo:27017/smartroute` (or Atlas URI) and clear/set `VITE_GEOAPIFY_TILE_API_KEY` / `VITE_GOOGLE_CLIENT_ID` before running `docker compose up`."
nyquist:
  compliant_phases: []
  partial_phases: []
  not_validated_phases: []
  missing_phases:
    - 11-server-client-runtime-hardening
    - 12-containerization-nginx-reverse-proxy
    - 13-paas-manifests-admin-bootstrap-ci-smoke-verification
    - 14-audited-env-templates-production-runbook
  overall: discovery_missing
---

# Milestone v6 — Deployment & Production Readiness Audit Report

**Audited:** 2026-11-11T16:53:00Z
**Milestone Goal:** Make SmartRoute turnkey to containerize, configure, secure, verify, and deploy reliably across PaaS (Render/Railway/Vercel + MongoDB Atlas) and Docker/VPS environments.
**Status:** `tech_debt` (`15/15` requirements satisfied, `4/4` phases verified, `0` critical blockers)

---

## 1. Phase Verification Summary (`4/4` Passed)

| Phase | Name | Plans | Verification Status | Digest State |
| --- | --- | --- | --- | --- |
| 11 | Server & Client Runtime Hardening | `3/3` | `passed` | Valid (`fdca7d43...`) |
| 12 | Containerization & Nginx Reverse Proxy | `3/3` | `passed` | Valid (`100c2589...`) |
| 13 | PaaS Manifests, Admin Bootstrap & CI/Smoke Verification | `3/3` | `passed` | Valid (`eb2ba62d...`) |
| 14 | Audited Env Templates & Production Runbook | `3/3` | `passed` | Valid (`de609bdd...`) |

---

## 2. Three-Source Requirements Coverage (`15/15` Satisfied)

| Requirement | Assigned Phase | `VERIFICATION.md` | `SUMMARY.md` | `REQUIREMENTS.md` | Cross-Phase Integration | Final Status |
| --- | --- | --- | --- | --- | --- | --- |
| `HARD-01` | Phase 11 | Passed | `11-01`, `11-03` | `[x]` | Wired (`env.js`, `index.js`, `geoapify.service.js`, `adminController.js`) | **Satisfied** |
| `HARD-02` | Phase 11 | Passed | `11-03` | `[x]` | Wired (`app.js` numeric `trust proxy`, `rateLimiter.js`) | **Satisfied** |
| `HARD-03` | Phase 11 | Passed | `11-01`, `11-03` | `[x]` | Wired (`cors.js` shared by Express & Socket.IO) | **Satisfied** |
| `HARD-04` | Phase 11 | Passed | `11-02`, `11-03` | `[x]` | Wired (`/theme-init.js`, `app.js` Helmet CSP/COOP, `vercel.json`) | **Satisfied** |
| `HARD-05` | Phase 11 | Passed | `11-03` | `[x]` | Wired (`/healthz`, `/readyz`, `SIGTERM`/`SIGINT` drain, `Dockerfile`, `render.yaml`) | **Satisfied** |
| `HARD-06` | Phase 11 | Passed | `11-01` | `[x]` | Wired (`db.js` `autoIndex: false` in prod, `serverSelectionTimeoutMS: 12000`) | **Satisfied** |
| `ORIG-01` | Phase 11 | Passed | `11-03` | `[x]` | Wired (`SERVE_CLIENT=true`, `/api` JSON `404`, immutable `/assets`, `no-cache` HTML) | **Satisfied** |
| `ORIG-02` | Phase 11 | Passed | `11-02` | `[x]` | Wired (`client.ts` `API_BASE_URL`, `socketClient.ts` `resolveSocketUrl()`) | **Satisfied** |
| `CONT-01` | Phase 12 | Passed | `12-01` | `[x]` | Wired (`package.json`, `server/package.json` `axios`, `package-lock.json`, `.dockerignore`) | **Satisfied** |
| `CONT-02` | Phase 12 | Passed | `12-02` | `[x]` | Wired (multi-stage `node:20-bookworm-slim` `Dockerfile`, `USER node`, `/readyz` `HEALTHCHECK`) | **Satisfied** |
| `CONT-03` | Phase 12 | Passed | `12-03` | `[x]` | Wired (`docker-compose.yml` + `deploy/nginx/default.conf` `/socket.io/` upgrade & `$http_host`) | **Satisfied** |
| `OPS-01` | Phase 13 | Passed | `13-01` | `[x]` | Wired (`server/src/scripts/bootstrapAdmin.js`, `seed:admin` / `bootstrap:admin`, decoupled from `seedBhubaneswar.js`) | **Satisfied** |
| `OPS-02` | Phase 13 | Passed | `13-02` | `[x]` | Wired (`render.yaml`, `vercel.json`, `client/vercel.json`) | **Satisfied** |
| `OPS-03` | Phase 13 | Passed | `13-03` | `[x]` | Wired (`scripts/smoke-test.js`, `.github/workflows/ci.yml`, `ops_bootstrap_smoke.test.js`) | **Satisfied** |
| `OPS-04` | Phase 14 | Passed | `14-01`, `14-02`, `14-03` | `[x]` | Wired (`.env.example`, `server/.env.example`, `client/.env.example`, `README.md`, `docs/DEPLOYMENT_GUIDE.md`, `env_docs_audit.test.js`) | **Satisfied** |

---

## 3. End-to-End Integration & Automated Checks

- **Server Jest Suite (`npm --prefix server test`):** `29 passed, 29 total` suites (`330 passed, 330 total` tests), covering unit, integration, adversarial security, runtime hardening, PaaS/bootstrap/smoke contracts, and 1:1 env/doc parity (`env_docs_audit.test.js`).
- **Frontend Type Check (`npm --prefix client test`):** `tsc --noEmit` exited `0`.
- **Frontend Production Build (`npm --prefix client run build`):** `vite build` transformed `1706` modules (`built in 5.72s`, exited `0`).
- **Docker Compose Offline Validation (`docker compose config -q`):** Exited `0` with valid secrets and rejected missing `JWT_SECRET`/`JWT_REFRESH_SECRET` cleanly.
- **Cross-Phase Fix Applied During Audit:** Updated `README.md` Topology A Step 1 so operators copying `.env.example` to `.env` for Docker Compose explicitly switch `MONGODB_URI` to `mongodb://mongo:27017/smartroute` (or Atlas) and clear placeholder `VITE_*` strings before `docker compose up`.

---

## 4. Non-Blocking Tech Debt & Operator Rollout Items

1. **Post-Deploy Live Browser OAuth & Map Tile Check (`11-VERIFICATION.md`):** Execute once live Google OAuth and Geoapify keys are set on the target host.
2. **Live Docker Build & Compose Run (`12-VERIFICATION.md`):** Executes automatically in CI (`docker-and-compose` job in `.github/workflows/ci.yml`) on GitHub push or locally once Docker Desktop daemon is started.
3. **`MAP_PROVIDER` / `VITE_MAP_PROVIDER` Config Surface:** Present consistently across templates/manifests for clarity even though Geoapify/OSM fallback runs unconditionally in code.
4. **Nyquist (`*-VALIDATION.md`):** Not generated for Phases `11`–`14` (informational discovery; automated Jest/Supertest/TypeScript/Vite/Compose tests cover all deliverables).
