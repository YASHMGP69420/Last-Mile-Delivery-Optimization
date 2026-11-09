---
last_mapped_commit: 6de3cd870c14b267435449b6a1e9b56607ea9d74
last_mapped_at: 2026-11-09
---
# Testing Patterns

**Analysis Date:** 2026-11-09

## Test Framework

**Runner:**
- **Server Unit & Integration:** Jest (`v29.7.0` in `server/package.json`, `v30.5.2` in `package.json`). Configured in `server/jest.config.js`.
- **E2E 4-Tier Test Runner:** Custom standalone CLI runner in `tests/e2e/runner.js` executing tests in isolated tiers with ANSI reporting and process exit code semantics.
- **HTTP Request Assertions:** Supertest (`v6.3.4` in `server/package.json`, `v7.3.2` in `package.json`) wrapping the Express application instance (`server/src/app.js`).

**Assertion Library:**
- **Jest Expect:** Used in `server/tests/**/*.test.js` (`toBe`, `toEqual`, `toMatchObject`, `toHaveProperty`, `toBeDefined`, `toBeNull`, `toBeGreaterThan`, `toMatch`).
- **Node Strict Assert:** `node:assert/strict` used in `tests/e2e/**/*.test.js` (`assert.strictEqual`, `assert.ok`, `assert.deepStrictEqual`, `assert.rejects`).

**Run Commands:**
```bash
# Root Monorepo Commands
npm test                       # Run all server Jest test suites
npm run test:server            # Run server tests workspace
npm run test:coverage          # Run server Jest tests with Istanbul coverage report
npm run test:e2e               # Run the 4-tier E2E testing framework runner

# Server Workspace Commands (from server/)
npm run test                   # Run Jest with --runInBand --detectOpenHandles --forceExit
npm run test:watch             # Run Jest in interactive watch mode
npm run test:coverage          # Run Jest with coverage collection

# Granular E2E Tier Execution (from root)
node tests/e2e/runner.js --tier=1     # Run Tier 1 Feature Isolation tests
node tests/e2e/runner.js --tier=2     # Run Tier 2 Boundary & Corner Case tests
node tests/e2e/runner.js --tier=3     # Run Tier 3 Pairwise Integration tests
node tests/e2e/runner.js --tier=4     # Run Tier 4 Real-World Workload tests
node tests/e2e/runner.js --verbose    # Output assertion details and responses
node tests/e2e/runner.js --bail       # Abort execution on first assertion failure
```

## Test File Organization

**Location:**
- Server unit, integration, and adversarial tests: `server/tests/`
- Monorepo E2E 4-tier tests: `tests/e2e/`
- Test utilities and setup scripts: `server/tests/setup.js`, `server/tests/helpers/testUtils.js`, `tests/e2e/harness/testServer.js`, `tests/e2e/harness/fixtures.js`.

**Naming:**
- Server test files: `*.test.js` (e.g., `server/tests/auth.test.js`, `server/tests/deliveries.test.js`, `server/tests/optimization.test.js`, `server/tests/adversarial.test.js`).
- E2E tiered test files: kebab-case `*.test.js` (e.g., `tests/e2e/tier1-features/auth-rbac.test.js`, `tests/e2e/tier2-boundaries/payload-boundaries.test.js`).

**Structure:**
```
server/tests/
├── setup.js                          # Mongoose connection and teardown hooks
├── helpers/
│   └── testUtils.js                  # Model factory functions & JWT generation
├── auth.test.js                      # Authentication & token verification tests
├── fleet.test.js                     # Vehicles and drivers CRUD tests
├── deliveries.test.js                # Consignment CRUD & state machine tests
├── optimization.test.js              # Unit tests for heuristics, cache, cost scoring
├── routes.test.js                    # Route generation & dispatch endpoint tests
├── adversarial.test.js               # Concurrency, edge case & security tests
├── adversarial_mapping_stress.test.js# Google Maps fallback & retry tests
└── adversarial_optimizer_stress.test.js# Mathematical invariant stress tests

tests/e2e/
├── runner.js                         # Standalone CLI test runner
├── harness/
│   ├── testServer.js                 # App launcher, DB lifecycle & auth headers
│   └── fixtures.js                   # Canonical Bhubaneswar locations & sample data
├── tier1-features/                   # 9 feature suites (isolated feature tests)
├── tier2-boundaries/                 # 6 boundary suites (payload limits, duplicates, tokens)
├── tier3-pairwise/                   # 4 integration suites (cross-feature interactions)
└── tier4-workloads/                  # 3 workload suites (canonical 55-stop simulation)
```

## Test Structure

**Suite Organization:**

*Server Jest Integration Suite (`server/tests/auth.test.js`):*
```javascript
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createTestUser } = require('./helpers/testUtils');
const bcrypt = require('bcryptjs');

describe('Authentication & RBAC Test Suite (server/tests/auth.test.js)', () => {
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('SmartRoute2026!', 10);
      await User.create({
        name: 'Super Admin',
        email: 'admin@smartroute.internal',
        passwordHash,
        role: 'ADMIN',
        active: true,
      });
    });

    test('TC-AUTH-1: Login with valid credentials returns 200, JWT token, and sanitized user object', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@smartroute.internal',
          password: 'SmartRoute2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });
});
```

*E2E Tier Suite (`tests/e2e/tier1-features/auth-rbac.test.js`):*
```javascript
module.exports = {
  name: 'Authentication & RBAC Feature Suite',
  tier: 1,
  file: 'auth-rbac.test.js',

  async run({ it, beforeEach, harness, assert }) {
    beforeEach(async () => {
      await harness.cleanDatabase();
    });

    it('TC-T1-AUTH-1: Login with valid credentials returns 200 and JWT token', async () => {
      const { user } = await harness.createTestUser('ADMIN', 'admin_login_t1@smartroute.test');

      const res = await harness.request
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.token, 'Expected JWT access token in response');
      assert.strictEqual(res.body.data.user.email, user.email);
    });
  },
};
```

**Patterns:**
- **Setup Pattern:** `server/tests/setup.js` initializes connection to `mongodb://127.0.0.1:27017/smartroute_test` in `beforeAll`.
- **Teardown Pattern:** `afterEach` iterates through `mongoose.connection.collections` and executes `collection.deleteMany({})` to ensure pristine test isolation between test cases. `afterAll` disconnects Mongoose.
- **Assertion Pattern:** All tests verify HTTP status codes, envelope shape (`{ success: true/false }`), payload contents, and security guarantees (e.g., verifying `passwordHash` is excluded from user responses).

## Mocking

**Framework:** Jest built-in spies (`jest.spyOn`) and mock implementations.

**Patterns:**
```javascript
// Mock external Google Maps API failure to verify resilient fallback to simulated matrix
test('TC-ADV-MAP-RESIL-2: Google Maps timeout retries and falls back cleanly', async () => {
  let callCount = 0;
  jest.spyOn(axios, 'get').mockImplementation(async () => {
    callCount++;
    const timeoutError = new Error('timeout of 5000ms exceeded');
    timeoutError.code = 'ECONNABORTED';
    throw timeoutError;
  });

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  const result = await googleMapsService.getDistanceMatrix(origin, destination, { skipCache: true });

  expect(callCount).toBe(3); // 1 initial + 2 retries
  expect(warnSpy).toHaveBeenCalled();
  expect(result.status).toBe('OK');
  expect(result.source).toBe('SIMULATED');

  warnSpy.mockRestore();
});
```

**What to Mock:**
- External third-party HTTP services (Google Maps Distance Matrix, Geoapify Geocoding API).
- Standard output warnings (`console.warn` / `console.error`) during negative and boundary tests to keep test runs clean.
- Timeouts and network failure modes (`ECONNABORTED`, HTTP 500 responses).

**What NOT to Mock:**
- MongoDB database collections (tests run against real `smartroute_test` MongoDB database to ensure index enforcement and unique constraints).
- JWT generation and verification logic (`jsonwebtoken`).
- Express routing, middleware execution, and input validation pipelines.
- Core route optimization algorithms (`nearestNeighbor.js`, `twoOpt.js`, `binPacker.js`).

## Fixtures and Factories

**Test Data:**
- Factory helpers in `server/tests/helpers/testUtils.js`:
  - `createTestUser(role, emailSuffix)`: Creates and persists a user with bcrypt-hashed credentials and returns signed JWT token.
  - `createTestVehicle(overrides)`: Persists an electric or diesel vehicle with default capacities.
  - `createTestDriver(user, overrides)`: Persists a driver profile associated with a User record.
  - `createTestDelivery(overrides)`: Persists a delivery consignment in Bhubaneswar coordinates.
- Static canonical fixtures in `tests/e2e/harness/fixtures.js`:
  - Canonical Rasulgarh depot location: `[85.863, 20.297]`.
  - 55 Bhubaneswar stops grouped into 5 clusters (Patia, Jaydev Vihar, Saheed Nagar, Khandagiri, Chandrasekharpur).
  - Valid, malformed, empty, and edge-case CSV strings.

**Location:**
- `server/tests/helpers/testUtils.js`
- `tests/e2e/harness/fixtures.js`

## Coverage

**Requirements:**
- High test coverage across core route optimization engine, mapping cache, authentication RBAC, consignment state transitions, and adversarial error handling.
- Deterministic test passes with zero open handles (`--detectOpenHandles --forceExit`).

**View Coverage:**
```bash
npm run test:coverage --workspace=server
```

## Test Types

**Unit Tests:**
- Test mathematical and algorithmic logic in isolation without HTTP or database overhead.
- Located in `server/tests/optimization.test.js`:
  - Haversine distance and spherical trigonometry accuracy.
  - LRU Matrix Cache hit/miss rates and TTL expiration.
  - Bin packing payload constraint enforcement.
  - 2-Opt local search distance improvements (triangle inequality).
  - Multi-objective cost and carbon emissions calculation.

**Integration Tests:**
- Test Express controllers, authentication middleware, Mongoose models, and database interactions using Supertest.
- Located in `server/tests/` (`auth.test.js`, `fleet.test.js`, `deliveries.test.js`, `routes.test.js`, `admin_control.test.js`).
- Verify request validation, HTTP status codes, audit event creation, and database mutations.

**E2E Tests:**
- Test full end-to-end operational workflows across 4 hierarchical tiers (`tests/e2e/runner.js`).
- Opaque-box testing adhering to public HTTP and Socket.IO interfaces.
- Tiers:
  - **Tier 1:** Individual feature verification in isolation.
  - **Tier 2:** Payload boundaries, time window inversions, CSV header edge cases, and token security.
  - **Tier 3:** Cross-feature interactions (CSV import -> batch composer -> route optimization -> driver dispatch).
  - **Tier 4:** Full real-world Bhubaneswar operational scenarios (55 canonical consignments, EV battery range, full driver journey with Proof of Delivery).

## Common Patterns

**Async Testing:**
```javascript
test('TC-DEL-1: Async database mutation and verification', async () => {
  const manager = await createTestUser('FLEET_MANAGER');

  const res = await request(app)
    .post('/api/v1/deliveries')
    .set('Authorization', `Bearer ${manager.token}`)
    .send({
      orderReference: '#DEL-BBS-001',
      customer: { name: 'Rajesh Das', phone: '+91 98610 11111' },
      address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
      weightKg: 10.0,
      priority: 'Standard',
      timeWindow: { start: '09:00', end: '12:00' },
    });

  expect(res.status).toBe(201);
  expect(res.body.data.status).toBe('DRAFT');

  // Assert persistence in database
  const saved = await Delivery.findById(res.body.data._id);
  expect(saved).not.toBeNull();
  expect(saved.orderReference).toBe('#DEL-BBS-001');
});
```

**Error Testing:**
```javascript
test('TC-AUTH-2: Rejects invalid password with 401 and INVALID_CREDENTIALS', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'admin@smartroute.internal',
      password: 'WrongPassword!',
    });

  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  expect(res.body.data).toBeUndefined();
});
```

---

*Testing analysis: 2026-11-09*
