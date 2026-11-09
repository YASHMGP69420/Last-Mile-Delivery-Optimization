---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
# Coding Conventions

**Analysis Date:** 2026-11-09

## Naming Patterns

**Files:**
- **React Components:** PascalCase with `.tsx` extension in `client/src/components/` (e.g., `client/src/components/common/Button.tsx`, `client/src/components/deliveries/ConsignmentDrawer.tsx`, `client/src/components/maps/InteractiveMap.tsx`).
- **Pages:** PascalCase suffixed with `Page.tsx` in `client/src/pages/` (e.g., `client/src/pages/LoginPage.tsx`, `client/src/pages/DeliveriesPage.tsx`, `client/src/pages/admin/RoutePlannerPage.tsx`, `client/src/pages/driver/DriverCockpitPage.tsx`).
- **Custom Hooks:** camelCase prefixed with `use` in `client/src/hooks/` (e.g., `client/src/hooks/useOptimization.ts`, `client/src/hooks/useDriverSocket.ts`, `client/src/hooks/useRoutePlanner.ts`).
- **Contexts:** PascalCase suffixed with `Context.tsx` in `client/src/context/` (e.g., `client/src/context/AuthContext.tsx`, `client/src/context/DriverSocketContext.tsx`).
- **Frontend Utilities & Types:** camelCase in `client/src/utils/` and `client/src/types/` (e.g., `client/src/utils/errorUtils.ts`, `client/src/utils/formatters.ts`, `client/src/types/index.ts`, `client/src/types/route.ts`).
- **Backend Models:** PascalCase in `server/src/models/` (e.g., `server/src/models/User.js`, `server/src/models/Vehicle.js`, `server/src/models/Delivery.js`, `server/src/models/Route.js`).
- **Backend Controllers:** camelCase suffixed with `Controller.js` in `server/src/controllers/` (e.g., `server/src/controllers/deliveryController.js`, `server/src/controllers/authController.js`, `server/src/controllers/routeController.js`).
- **Backend Routes:** camelCase suffixed with `Routes.js` in `server/src/routes/` (e.g., `server/src/routes/deliveryRoutes.js`, `server/src/routes/authRoutes.js`, `server/src/routes/routeRoutes.js`).
- **Backend Services:** camelCase suffixed with `Service.js` or algorithm descriptor in `server/src/services/` (e.g., `server/src/services/auditService.js`, `server/src/services/csvImportService.js`, `server/src/services/optimization/optimizerEngine.js`, `server/src/services/optimization/twoOpt.js`).
- **Backend Middleware & Config:** camelCase in `server/src/middleware/` and `server/src/config/` (e.g., `server/src/middleware/errorHandler.js`, `server/src/middleware/validate.js`, `server/src/config/constants.js`, `server/src/config/env.js`).
- **Tests:**
  - Jest server unit/integration tests: `server/tests/*.test.js` (e.g., `server/tests/auth.test.js`, `server/tests/deliveries.test.js`, `server/tests/optimization.test.js`).
  - E2E tiered tests: kebab-case in `tests/e2e/tier{N}-*/*.test.js` (e.g., `tests/e2e/tier1-features/auth-rbac.test.js`, `tests/e2e/tier2-boundaries/payload-boundaries.test.js`, `tests/e2e/tier4-workloads/bhubaneswar-canonical-55.test.js`).

**Functions:**
- Use camelCase for standard functions, handlers, and service methods (e.g., `getDeliveries`, `runRouteOptimization`, `haversineDistance`, `getFriendlyErrorMessage`, `formatDistance`).
- Use PascalCase for React component definitions (e.g., `Button`, `ConsignmentDrawer`, `InteractiveMap`).
- Handler functions in components use `handle` prefix or `on` prefix for props (e.g., `handleSubmit`, `handleStatusChange`, `onClose`, `onSuccess`).

**Variables:**
- Use camelCase for local variables, parameters, and object properties (e.g., `currentRoute`, `deliveryList`, `payloadCapacity`, `managerToken`, `apiClient`).
- Use UPPER_SNAKE_CASE for constant values, enumerations, and environment configuration (e.g., `ROLES`, `DELIVERY_STATUS`, `TRAFFIC_SCENARIOS`, `JWT_SECRET`, `CANONICAL_DEPOT`, `VALID_TRANSITIONS`).
- Prefix boolean state and flags with `is`, `has`, or `should` (e.g., `isLoading`, `isOperational`, `hasPendingUpdates`).

**Types:**
- Use PascalCase for TypeScript interfaces, type aliases, and enums in `client/src/types/index.ts` and component prop types (e.g., `User`, `UserRole`, `Vehicle`, `Delivery`, `ButtonProps`, `ApiResponse<T>`).
- Suffix component props with `Props` (e.g., `ButtonProps`, `ConsignmentDrawerProps`, `TableProps`).
- Suffix context state interfaces with `Type` or `ContextType` (e.g., `AuthContextType`, `DriverSocketContextType`).

## Code Style

**Formatting:**
- **Indentation:** 2 spaces across both JavaScript and TypeScript files.
- **Quotes:** Single quotes (`'`) for JavaScript/TypeScript imports and string literals; double quotes (`"`) inside JSX attributes and JSON files.
- **Semicolons:** Explicit semicolons required at the end of statements across client and server.
- **Trailing Commas:** ES5/modern multi-line trailing commas on objects, arrays, and parameter lists.
- **Styling Utility:** Tailwind CSS utility classes organized with `clsx` and `tailwind-merge` (`client/src/components/common/Button.tsx`).

**Linting:**
- **Frontend:** Strict TypeScript compiler configuration in `client/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "moduleResolution": "bundler",
      "strict": true,
      "noFallthroughCasesInSwitch": true,
      "noUnusedLocals": false,
      "noUnusedParameters": false,
      "paths": {
        "@/*": ["./src/*"]
      }
    }
  }
  ```
  Verified via `npm run build` (`tsc && vite build`).
- **Backend:** Defensive runtime validation via custom middleware (`server/src/middleware/validate.js`), Mongoose schema validation constraints (`server/src/models/Delivery.js`), and cross-environment test runner settings (`cross-env NODE_ENV=test`).

## Import Organization

**Order:**
1. **Runtime & Core Modules:** Node built-in packages or React core (`react`, `react-router-dom`, `path`, `fs`, `node:assert/strict`).
2. **Third-Party Libraries:** External npm packages (`axios`, `clsx`, `lucide-react`, `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `supertest`).
3. **Internal Models & Abstractions:** Domain models (`@/types`, `../models/User`, `../models/Delivery`).
4. **Middleware & Services:** Business logic and interceptors (`../middleware/errorHandler`, `../services/auditService`, `@/api/client`).
5. **Configuration & Helpers:** Constants and environment configs (`../config/constants`, `../config/env`, `@/utils/formatters`).

**Path Aliases:**
- Client uses `@/*` mapping to `./src/*` configured in `client/tsconfig.json` and `client/vite.config.ts`:
  ```typescript
  import { apiClient } from '@/api/client';
  import { Button } from '@/components/common/Button';
  import { Delivery } from '@/types';
  ```
- Server uses relative paths (`require('../models/Delivery')`, `require('../../src/config/constants')`).

## Error Handling

**Patterns:**
- **Custom Operational Errors (Backend):** Use `AppError` subclassing `Error` in `server/src/middleware/errorHandler.js` for operational issues:
  ```javascript
  const { AppError } = require('../middleware/errorHandler');

  if (!delivery) {
    throw new AppError('Delivery consignment not found', 404, 'DELIVERY_NOT_FOUND');
  }
  ```
- **Uniform Error Envelope (API Contract):** All failed HTTP responses conform to the uniform envelope in `server/src/middleware/errorHandler.js`:
  ```json
  {
    "success": false,
    "message": "Human readable error summary",
    "error": {
      "code": "ERROR_CODE_STRING",
      "message": "Human readable error summary",
      "details": [],
      "requestId": "4d14e0d4-1a39-4475-80f0-8c50c609ec8e"
    }
  }
  ```
- **Mongoose & JWT Translation:** `server/src/middleware/errorHandler.js` intercepts `ValidationError` (status 400), `CastError` (status 400), MongoDB duplicate index `11000` (status 409), `JsonWebTokenError` (status 401), and `TokenExpiredError` (status 401).
- **Asynchronous Controllers:** Express controller methods wrap async logic in `try ... catch (err)` blocks and forward unhandled exceptions to `next(err)`:
  ```javascript
  const getDeliveries = async (req, res, next) => {
    try {
      const items = await Delivery.find();
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  };
  ```
- **Client Translation & Interception:**
  - `client/src/api/client.ts` Axios response interceptor purges credentials and triggers redirect on `TOKEN_EXPIRED` or `TOKEN_REVOKED` (HTTP 401).
  - `client/src/utils/errorUtils.ts` provides `getFriendlyErrorMessage(err)` mapping raw technical strings and error codes into plain English for dispatchers and drivers.

## Logging

**Framework:** Built-in `console.*` with tagged prefixes, supplemented by `morgan` HTTP logger.

**Patterns:**
- **HTTP Request Logging:** `app.use(morgan('dev'))` in `server/src/app.js` enabled exclusively for non-test environments (`if (process.env.NODE_ENV !== 'test')`).
- **Domain-Tagged Console Messages:** Use prefix tags in brackets to identify system components:
  - `console.log('[Server] SmartRoute backend running on port 5004')` in `server/src/index.js`
  - `console.log('[MongoDB] Connected to database: smartroute')` in `server/src/config/db.js`
  - `console.log('[Socket.IO] Client connected: ...')` in `server/src/index.js`
  - `console.log('[Seed] Inserted 55 canonical deliveries.')` in `server/src/seed/seedBhubaneswar.js`
  - `console.warn('[Dispatch] VehicleAssignment upsert failed: ...')` in `server/src/controllers/routeController.js`
- **Error Logging:** Log internal 500 exceptions with their correlation `requestId` in non-test modes:
  ```javascript
  if (process.env.NODE_ENV !== 'test' && statusCode === 500) {
    console.error(`[Error] Request ID ${requestId}:`, err);
  }
  ```

## Comments

**When to Comment:**
- Add comments explaining non-obvious business logic, mathematical invariants (e.g., 2-opt edge swap evaluation, Haversine routing curvature, EV battery discharge thresholds).
- Document authorization rules and anti-tamper mechanisms (e.g., BOLA/IDOR prevention in `verifyDriverOwnership` in `server/src/controllers/deliveryController.js`).
- Use section header dividers for API groups in service and route modules (e.g., `// ==========================================`, `// ADMIN CONTROL CENTER API`).

**JSDoc/TSDoc:**
- Use JSDoc headers for public optimization algorithms, service functions, and middleware:
  ```javascript
  /**
   * Master Route Optimization Engine.
   * Evaluates candidate sequences, selects the best valid solution, and computes true deltas.
   *
   * @param {Object} params
   * @param {number} params.depotIndex - Index 0
   * @param {number[]} params.stopIndices - Assigned delivery indices in original order
   * @param {Function} params.getDistanceKm - (i, j) => number (km)
   * @param {Function} params.getDurationMin - (i, j) => number (minutes)
   * @param {Object} params.vehicle - Assigned vehicle specifications
   * @returns {Object} Optimized route summary with true baseline deltas
   */
  ```

## Function Design

**Size:**
- Aim for concise, focused functions under 50 lines where possible. Complex multi-step pipelines (like route optimization) decompose into sub-modules: `originalOrder.js`, `nearestNeighbor.js`, `twoOpt.js`, `orOpt.js`, and `costScorer.js`.

**Parameters:**
- For functions requiring 3+ arguments, pass an options object using destructured parameters with sensible defaults:
  ```javascript
  function runRouteOptimization({
    depotIndex = 0,
    stopIndices = [],
    getDistanceKm,
    getDurationMin,
    points = [],
    vehicle,
    options = {},
  }) { ... }
  ```

**Return Values:**
- Controller functions return uniform response payloads:
  - Success: `res.status(200).json({ success: true, data: ... })` or `res.status(201).json({ success: true, data: ... })`.
  - Failure: `res.status(4xx/5xx).json({ success: false, error: { code, message, details, requestId } })`.
- Frontend API helper functions return `Promise<ApiResponse<T>>` unwrapped from `res.data`.

## Module Design

**Exports:**
- **Server:** CommonJS module exports using object literal syntax:
  ```javascript
  module.exports = {
    getDeliveries,
    createDelivery,
    updateDeliveryStatus,
  };
  ```
- **Client:** ES Module named exports for components, hooks, and API service namespaces:
  ```typescript
  export const DeliveriesApi = { ... };
  export const BatchesApi = { ... };
  export const Button: React.FC<ButtonProps> = ({ ... }) => { ... };
  ```

**Barrel Files:**
- Used for consolidating module boundaries:
  - `server/src/routes/index.js` mounts all API routes under `/api/v1`.
  - `server/src/services/mapping/index.js` exports geocoding, distance matrix, and simulated traffic utilities.
  - `server/src/services/optimization/index.js` exports packing, heuristic routing, and scoring engines.
  - `client/src/types/index.ts` exports all shared TypeScript interfaces.

---

*Convention analysis: 2026-11-09*
