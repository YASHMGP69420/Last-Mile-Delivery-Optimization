# SmartRoute – Documentation Maintenance Protocol

**Mandatory Rule**: Documentation is an integrated deliverable of every code change. Code modifications are not complete until the corresponding documentation, user instructions, and test evidence have been synchronized.

---

## 1. Documentation Update Rules

| Change Type | Affected Code Areas | Mandatory Documentation Updates |
|---|---|---|
| **New Route or Endpoint** | `server/src/routes/*`, `controllers/*` | Update `docs/architecture/API-DOCUMENTATION.md` and `docs/user-guide/04-FLEET-MANAGER-GUIDE.md` |
| **Database Schema Change** | `server/src/models/*` | Update `docs/architecture/DATABASE-SCHEMA.md` |
| **Algorithm Modification** | `server/src/services/optimization/*` | Update `docs/user-guide/05-ROUTE-OPTIMIZATION-GUIDE.md` |
| **New UI Page / Component** | `client/src/pages/*`, `components/*` | Update `docs/INTERACTION_VERIFICATION.md` and appropriate User Guide |
| **Environment Variable Change** | `.env`, `server/src/config/env.js` | Update `.env.example` and `docs/ENVIRONMENT_CONFIGURATION.md` |
| **Bug Fix / Error Resolution** | Any module | Record root cause & fix in `docs/CORE_CHANGELOG.md` and `docs/user-guide/09-TROUBLESHOOTING-GUIDE.md` |

---

## 2. Pre-Commit Verification Protocol

Before declaring any feature complete:
1. Run `npm --prefix server test` to verify all unit/integration tests pass.
2. Run `npm --prefix client run build` to verify type-safety and bundle integrity.
3. Check `.env.example` for missing environment variables.
4. Verify user manuals reflect the exact control names and button labels implemented in code.
