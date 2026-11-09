---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
</Architecture>
<Codebase Structure>
**Analysis Date:** 2026-11-09

## Directory Layout

```
smartroute-monorepo/
├── .planning/                  # Project roadmap, GSD state, and codebase analysis
│   └── codebase/               # Architecture, structure, stack, and convention audits
├── client/                     # Frontend React SPA application (Vite + TypeScript)
│   ├── public/                 # Static public assets (manifest.json, sw.js, icons)
│   ├── src/                    # Client source code
│   │   ├── api/                # Centralized Axios client and API resource gateways
│   │   ├── assets/             # Images, vector icons, and static graphics
│   │   ├── components/         # Reusable UI component library categorized by domain
│   │   │   ├── common/         # Generic UI primitives (Button, Table, Modal, Drawer, Toast)
│   │   │   ├── dashboard/      # Admin Command Center summary widgets and streams
│   │   │   ├── deliveries/     # Batch composer, CSV upload, manifest table, drawers
│   │   │   ├── driver/         # Mobile driver HUD components, POD modal, hero card
│   │   │   ├── layout/         # AdminLayout, DriverLayout, headers, sidebars, bottom nav
│   │   │   ├── maps/           # Leaflet map container and navigation deep-link triggers
│   │   │   └── optimization/   # Route planner, comparison drawer, dispatch modals
│   │   ├── context/            # React Contexts (AuthContext, DriverSocketContext, ThemeContext)
│   │   ├── hooks/              # Custom hooks (useRoutePlanner, useOptimization, useDriverSocket)
│   │   ├── pages/              # Routed view containers
│   │   │   ├── admin/          # Admin Control Center & operational management pages
│   │   │   └── driver/         # Driver Cockpit mobile navigation and workflow pages
│   │   ├── types/              # TypeScript interface and type declarations
│   │   └── utils/              # Client-side formatting, error translation, map helpers
│   ├── package.json            # Client workspace dependencies and build scripts
│   ├── tailwind.config.js      # Tailwind CSS configuration and dark theme extensions
│   ├── tsconfig.json           # TypeScript compiler options
│   └── vite.config.ts          # Vite build, plugins, and proxy configuration
├── docs/                       # Architectural specifications, API contracts, and user guides
├── scripts/                    # Live operational verification and test scripts
├── server/                     # Backend Node.js Express REST API & Socket.IO server
│   ├── src/                    # Server source code
│   │   ├── config/             # Environment, database connection, and system constants
│   │   ├── controllers/        # Express HTTP endpoint controllers
│   │   ├── middleware/         # Auth, validation, rate limiting, and error middleware
│   │   ├── models/             # Mongoose schemas and data persistence models
│   │   ├── routes/             # Modular Express routers aggregated in routes/index.js
│   │   ├── seed/               # Canonical Bhubaneswar database seeder and test fixtures
│   │   ├── services/           # Domain business logic and algorithmic modules
│   │   │   ├── mapping/        # Distance matrix adapters, simulated traffic, cache
│   │   │   └── optimization/   # Pure heuristic solvers (2-Opt, Or-Opt, Bin Packer)
│   │   ├── utils/              # Server utility functions and Google Maps deep-link helpers
│   │   ├── app.js              # Express app definition, middleware, and route tree
│   │   └── index.js            # Main server entry, HTTP listener, and Socket.IO gateway
│   ├── tests/                  # Backend Jest unit and integration test suites
│   └── package.json            # Server workspace dependencies and scripts
├── stitch_smartroute_fleet_platform/ # Design prototypes, UI mockups, and screen artifacts
├── tests/                      # Monorepo-level automated multi-tier E2E test suites
│   └── e2e/                    # Tiered end-to-end integration test framework
├── package.json                # Monorepo root configuration with npm workspaces
└── README.md                   # Platform documentation and developer onboarding guide
```

## Directory Purposes

**`client/src/api/`:**
- Purpose: Encapsulates all backend HTTP communications using a configured Axios singleton.
- Contains: Axios request/response interceptors, semantic error translation, and resource API modules.
- Key files: `client/src/api/client.ts`, `client/src/api/routeApi.ts`

**`client/src/components/common/`:**
- Purpose: Atomic, reusable presentation components adhering to the SmartRoute design system.
- Contains: Buttons, modally sliding drawers, inputs, modal dialogs, status badges, tabular displays, and toasts.
- Key files: `client/src/components/common/Button.tsx`, `client/src/components/common/Drawer.tsx`, `client/src/components/common/Table.tsx`, `client/src/components/common/Modal.tsx`

**`client/src/components/optimization/`:**
- Purpose: UI components managing the interactive route optimization and dispatch workflow.
- Contains: Baseline vs optimized comparison drawers, dispatch validation confirmation, metrics bars, and optimizer control panels.
- Key files: `client/src/components/optimization/OptimizationControlPanel.tsx`, `client/src/components/optimization/RouteComparisonDrawer.tsx`, `client/src/components/optimization/DispatchConfirmationModal.tsx`

**`client/src/components/driver/`:**
- Purpose: Touch-optimized mobile components for on-the-road driver navigation and delivery execution.
- Contains: Active stop hero cards, vehicle telemetry status chips, proof-of-delivery (POD) signature/photo capture modal.
- Key files: `client/src/components/driver/CurrentStopHeroCard.tsx`, `client/src/components/driver/PODModal.tsx`, `client/src/components/driver/DriverVehicleStatusCard.tsx`

**`client/src/context/`:**
- Purpose: Application-wide shared state providers.
- Contains: Authentication state, real-time Socket.IO subscriptions with mobile chime synthesis, and dark/light UI theme context.
- Key files: `client/src/context/AuthContext.tsx`, `client/src/context/DriverSocketContext.tsx`, `client/src/context/ThemeContext.tsx`

**`client/src/pages/admin/`:**
- Purpose: Admin Command Center views for fleet management, logistics supervision, and governance.
- Contains: Full-page route planners, fleet asset registers, driver directories, live tracking maps, analytics KPI dashboards, and system settings.
- Key files: `client/src/pages/admin/RoutePlannerPage.tsx`, `client/src/pages/admin/AdminControlCenterPage.tsx`, `client/src/pages/admin/TrackingPage.tsx`, `client/src/pages/admin/AnalyticsPage.tsx`

**`client/src/pages/driver/`:**
- Purpose: Driver mobile HUD views optimized for in-cab delivery workflows.
- Contains: Driver cockpit dashboard, turn-by-turn stop list, delivery detail view, pre-trip vehicle safety checklist, driver support, and driver profile.
- Key files: `client/src/pages/driver/DriverCockpitPage.tsx`, `client/src/pages/driver/DriverRoutePage.tsx`, `client/src/pages/driver/DriverVehicleCheckPage.tsx`, `client/src/pages/driver/DriverDeliveryDetailPage.tsx`

**`server/src/controllers/`:**
- Purpose: Request handlers translating HTTP inputs into domain service invocations and persisting changes.
- Contains: Route optimization controllers, delivery manifest handlers, driver HUD workflows, telemetry ingests, and vehicle management.
- Key files: `server/src/controllers/routeController.js`, `server/src/controllers/deliveryController.js`, `server/src/controllers/driverHudController.js`, `server/src/controllers/batchController.js`

**`server/src/services/optimization/`:**
- Purpose: Pure mathematical and algorithmic core solving the Capacitated Vehicle Routing Problem (CVRP).
- Contains: Nearest neighbor tour construction, 2-Opt edge inversion, Or-Opt segment relocation, bin-packing vehicle assignments, and fuel/cost scoring.
- Key files: `server/src/services/optimization/optimizerEngine.js`, `server/src/services/optimization/twoOpt.js`, `server/src/services/optimization/orOpt.js`, `server/src/services/optimization/binPacker.js`, `server/src/services/optimization/costScorer.js`

**`server/src/services/mapping/`:**
- Purpose: Unified geospatial routing and distance matrix calculation services.
- Contains: Google Maps Distance Matrix client, simulated traffic fallback engine using Haversine formulas with road winding multipliers, and in-memory TTL matrix cache.
- Key files: `server/src/services/mapping/googleMapsService.js`, `server/src/services/mapping/simulatedTrafficService.js`, `server/src/services/mapping/matrixCache.js`

**`server/src/models/`:**
- Purpose: Mongoose schemas defining MongoDB collections, validations, virtuals, and indexes.
- Contains: Schemas for Deliveries, DeliveryBatches, Routes, Vehicles, Drivers, DriverShifts, VehicleChecklists, AuditEvents, and SystemNotifications.
- Key files: `server/src/models/Delivery.js`, `server/src/models/Route.js`, `server/src/models/Vehicle.js`, `server/src/models/Driver.js`, `server/src/models/AuditEvent.js`

**`server/src/middleware/`:**
- Purpose: HTTP request filters executing before controller actions.
- Contains: Bearer JWT verification, role-based authorization guards, payload validators, rate limiters, and global 404/500 error handlers.
- Key files: `server/src/middleware/auth.js`, `server/src/middleware/errorHandler.js`, `server/src/middleware/rateLimiter.js`, `server/src/middleware/validate.js`

**`tests/e2e/`:**
- Purpose: Multi-tiered comprehensive automated test suite verifying platform integrity.
- Contains: Test fixtures, mock test servers, Tier 1 feature tests, Tier 2 boundary tests, Tier 3 pairwise integration tests, and Tier 4 canonical workloads.
- Key files: `tests/e2e/runner.js`, `tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js`, `tests/e2e/tier1-features/dispatch-flow.test.js`

## Key File Locations

**Entry Points:**
- `server/src/index.js`: Backend HTTP and Socket.IO application bootstrapper.
- `server/src/app.js`: Express application configuration and middleware pipeline.
- `client/src/main.tsx`: React application entry point and DOM root.
- `client/src/App.tsx`: Client routing hierarchy, layout wrappers, and authentication guards.
- `server/src/seed/seedBhubaneswar.js`: Canonical database seeding script for development and testing.

**Configuration:**
- `package.json`: Monorepo root workspace configuration and script orchestration.
- `server/src/config/env.js`: Environment variable parsing, validation, and defaults.
- `server/src/config/constants.js`: System-wide enums (roles, statuses, vehicle types, audit types, Bhubaneswar zones).
- `server/src/config/db.js`: MongoDB Mongoose connection and lifecycle hooks.
- `client/vite.config.ts`: Vite bundler configuration and proxy rules.
- `client/tailwind.config.js`: Tailwind design tokens and theme extensions.

**Core Logic:**
- `server/src/services/optimization/optimizerEngine.js`: Master route optimization orchestrator.
- `server/src/services/dispatchEligibilityService.js`: Business rules validating pre-dispatch criteria.
- `server/src/services/socketService.js`: Centralized WebSocket event broadcaster.
- `server/src/services/auditService.js`: Centralized compliance and operations audit logger.

**Testing:**
- `server/package.json`: `npm test` runs backend Jest tests (`server/tests/*`).
- `tests/e2e/runner.js`: Monorepo multi-tier E2E testing framework runner (`npm run test:e2e`).
- `server/tests/helpers/testUtils.js`: Backend test authentication helpers, database setup, and mock factories.

## Naming Conventions

**Files:**
- React Components & Pages: `PascalCase.tsx` (e.g., `client/src/components/common/Button.tsx`, `client/src/pages/admin/RoutePlannerPage.tsx`)
- Custom Hooks: `camelCase.ts` prefixed with `use` (e.g., `client/src/hooks/useOptimization.ts`, `client/src/hooks/useDriverSocket.ts`)
- TypeScript Types & Utilities: `camelCase.ts` or `index.ts` (e.g., `client/src/types/route.ts`, `client/src/utils/formatters.ts`)
- Server Modules & Services: `camelCase.js` (e.g., `server/src/services/dispatchEligibilityService.js`, `server/src/controllers/routeController.js`)
- Mongoose Models: `PascalCase.js` (e.g., `server/src/models/Delivery.js`, `server/src/models/Route.js`, `server/src/models/AuditEvent.js`)
- Test Files: `kebab-case.test.js` or `camelCase.test.js` (e.g., `tests/e2e/tier1-features/dispatch-flow.test.js`, `server/tests/routes.test.js`)

**Directories:**
- Frontend directories: `camelCase` or lowercase single words (e.g., `components/common`, `components/dashboard`, `pages/admin`, `pages/driver`)
- Backend directories: `camelCase` or lowercase single words (e.g., `config`, `controllers`, `middleware`, `models`, `services/optimization`, `services/mapping`)
- Test suite tiers: `kebab-case` prefixed with tier number (e.g., `tier1-features`, `tier2-boundaries`, `tier3-pairwise`, `tier4-workloads`)

## Where to Add New Code

**New Feature (e.g., Return-to-Vendor Workflow):**
- Primary server code: Create controller in `server/src/controllers/`, service in `server/src/services/`, route in `server/src/routes/` and mount in `server/src/routes/index.js`.
- Primary client code: Add API methods in `client/src/api/client.ts`, domain components in `client/src/components/`, and views in `client/src/pages/`.
- Tests: Add integration test in `server/tests/` and an E2E test in `tests/e2e/tier1-features/`.

**New Database Entity / Model:**
- Schema definition: `server/src/models/[EntityName].js`
- Enums & Constants: Update `server/src/config/constants.js`
- Seeder: Update `server/src/seed/seedBhubaneswar.js` to seed canonical instances
- TypeScript Definitions: Mirror schema in `client/src/types/index.ts`

**New Optimization Algorithm or Heuristic:**
- Solver implementation: Add pure heuristic function in `server/src/services/optimization/[algoName].js`
- Expose via barrel: Export from `server/src/services/optimization/index.js`
- Engine integration: Integrate into selection switch within `server/src/services/optimization/optimizerEngine.js`
- UI Selection: Add option in `client/src/components/optimization/OptimizationControlPanel.tsx`

**Utilities & Shared Helpers:**
- Client shared helpers: `client/src/utils/` (e.g., formatters, error parsers)
- Server shared helpers: `server/src/utils/` (e.g., geo math, URL builders)

## Special Directories

**`.planning/`:**
- Purpose: Stores project planning, roadmap progress, codebase analysis, and workflow status.
- Generated: Maintained by GSD workflow tools.
- Committed: Yes.

**`stitch_smartroute_fleet_platform/`:**
- Purpose: Contains UI design mockups, HTML prototypes, and visual reference specs for the SmartRoute Fleet platform.
- Generated: Design source artifacts.
- Committed: Yes.

**`client/dist/`:**
- Purpose: Production build output generated by `npm run build --workspace=client`.
- Generated: Yes.
- Committed: Yes (maintained in repo for static deployment readiness).

**`server/node_modules/` & `client/node_modules/` & `node_modules/`:**
- Purpose: NPM package dependencies.
- Generated: Yes (via `npm install`).
- Committed: No (ignored by `.gitignore`).

---

*Structure analysis: 2026-11-09*
