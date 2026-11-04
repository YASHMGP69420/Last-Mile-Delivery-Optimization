# AGENT TASK BOARD

The Orchestrator defines all work items here. Each task includes an ID, assigned agent, description, dependencies, owned files, acceptance criteria, and status. Agents update this file as they progress.

## Legend
- **Status:** BACKLOG ➜ READY ➜ IN PROGRESS ➜ BLOCKED ➜ REVIEW ➜ INTEGRATED ➜ COMPLETED
- **Agent IDs:**
  - **A0** – Lead Orchestrator (this document)
  - **A1** – Frontend/UI Agent
  - **A2** – Backend/DB/Auth Agent
  - **A3** – Optimization Algorithm Agent
  - **A4** – Maps & Tracking Agent
  - **A5** – Analytics & Reporting Agent
  - **A6** – QA & DevOps Agent

---

### Phase 1 – Foundations
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T001 | A0 | Create shared project documentation (already done) | – | docs/PROJECT_SPECIFICATION.md, docs/SYSTEM_ARCHITECTURE.md, docs/DATABASE_SCHEMA.md, docs/WORKSPACE_AUDIT.md, docs/STITCH_DESIGN_INVENTORY.md | Docs exist, reviewed, and approved | COMPLETED |
| T002 | A0 | Define file ownership matrix and component guidelines | T001 | docs/COMPONENT_GUIDELINES.md | Clear ownership table for each module, design system basics defined | READY |
| T003 | A0 | Scaffold monorepo with `client/` (React + Vite) and `server/` (Express) | T001 | package.json, client/, server/ | `npm install` succeeds, basic dev server runs | READY |

---
### Phase 2 – Authentication & Authorization (Backend)
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T101 | A2 | Implement user model, JWT auth, role‑based middleware, login/logout endpoints | T003 | server/src/models/User.js, server/src/controllers/authController.js, server/src/middleware/auth.js | Secure login returns JWT, protected routes enforce roles, unit tests pass | BACKLOG |
| T102 | A2 | Seed initial demo users (admin, fleet manager, driver) for Bhubaneswar region | T101 | server/seed/demoUsers.js | Users created in DB, passwords hashed, can login | BACKLOG |

---
### Phase 3 – Delivery & Batch Management (Backend + Frontend)
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T201 | A2 | Define Delivery and DeliveryBatch Mongoose schemas, CRUD routes, validation | T101 | server/src/models/Delivery.js, server/src/models/DeliveryBatch.js, server/src/routes/deliveryRoutes.js | API endpoints work, validation errors handled, unit tests pass | BACKLOG |
| T202 | A1 | Convert Stitch `smartroute_delivery_operations_batch_management` design into React pages, integrate with backend APIs | T201 | client/src/pages/BatchManagement.tsx, components/... | UI matches design, CRUD operations functional, tests pass | BACKLOG |

---
### Phase 4 – Fleet Management (Backend + Frontend)
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T301 | A2 | Vehicle and Driver models, CRUD routes, assignment logic | T101 | server/src/models/Vehicle.js, server/src/models/Driver.js, server/src/routes/vehicleRoutes.js, driverRoutes.js | API functional, validation, unit tests | BACKLOG |
| T302 | A1 | Implement UI for vehicle and driver management using Stitch designs (`smartroute_fleet_operations_delivery_dispatch_flow`, `smartroute_operational_master_dashboard`) | T301 | client/src/pages/VehicleManagement.tsx, DriverManagement.tsx | UI matches design, integrates with backend, functional tests | BACKLOG |

---
### Phase 5 – Maps & Real‑Time Tracking
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T401 | A4 | Build Mapping Service wrapper (geocode, distance matrix) with caching | T003 | server/src/services/mapping/googleMapsService.js | Service returns correct data, handles cache TTL, unit tests | BACKLOG |
| T402 | A4 | Implement Socket.IO server for driver location broadcasting | T401 | server/src/sockets/trackingSocket.js | Real‑time updates received by clients, auth enforced | BACKLOG |
| T403 | A1 | Create React `InteractiveMap` component from Stitch `smartroute_live_fleet_tracking_telemetry` design, integrate with tracking socket | T402 | client/src/components/InteractiveMap.tsx | Map displays live driver pins, responsive, matches design | BACKLOG |

---
### Phase 6 – Route Optimization Engine
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T501 | A3 | Implement distance matrix builder, Nearest‑Neighbour heuristic, 2‑opt improvement | T401 | server/src/algorithms/optimizer.js, server/src/services/optimization/routeService.js | Returns optimized stop sequence, respects capacity & time windows, unit tests cover edge cases | BACKLOG |
| T502 | A3 | Expose `POST /api/routes/optimize` endpoint (API contract defined) | T501 | server/src/controllers/optimizationController.js | Endpoint validates input, returns schema as per docs, integration tests pass | BACKLOG |

---
### Phase 7 – Analytics & Reporting
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T601 | A5 | Design aggregation pipelines for KPIs (delivery rates, fuel cost, vehicle utilisation) | T201, T301 | server/src/services/analytics/analyticsService.js | API returns accurate metrics, performance acceptable, unit tests | BACKLOG |
| T602 | A5 | Build React analytics dashboard using Stitch `smartroute_operational_master_dashboard` design | T601 | client/src/pages/AnalyticsDashboard.tsx, chart components | Dashboard shows KPIs, charts match design, data updates correctly | BACKLOG |
| T603 | A5 | Implement CSV & PDF report generation endpoints | T601 | server/src/services/reports/reportService.js | Files download correctly, format matches spec, tests pass | BACKLOG |

---
### Phase 8 – QA, Security & Deployment
| Task ID | Assigned | Description | Dependencies | Files Owned | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|
| T701 | A6 | Write Jest unit tests for backend services and algorithms | T101‑T603 | tests/backend/**/*.test.js, tests/algorithms/**/*.test.js | >90% coverage, all tests pass |
| T702 | A6 | Create Cypress end‑to‑end tests for critical user flows (login, create batch, optimise route, driver tracking) | T202‑T403 | tests/e2e/**/*.spec.js | All flows succeed in CI environment |
| T703 | A6 | Perform security audit (password hashing, JWT expiry, role checks, input validation) | T101‑T401 | docs/security_audit.md | No critical findings, report generated |
| T704 | A6 | Prepare Dockerfiles, CI pipelines, and deployment scripts for Vercel/Render | T003‑T603 | Dockerfile, .github/workflows/ci.yml, deployment/README.md | Build passes, deploys to staging URL |

---

**Integration notes:**
- Each agent must update the status column as work progresses.
- When a task moves to **REVIEW**, the Orchestrator (A0) will perform code review and merge.
- Dependencies must be satisfied before a task starts.

*End of task board.*

