# Phase 19: E2E Test Suite Stabilization & Automated CI Verification - Pattern Map
**Mapped:** 2026-11-19
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `client/playwright.config.ts` | config | batch | `client/playwright.config.ts` (existing) | exact |
| `client/vite.config.ts` | config | transform | `client/vite.config.ts` (existing) | exact |
| `server/src/routes/index.js` | route | request-response | `server/src/routes/index.js` (existing) | exact |
| `server/src/scripts/bootstrapAdmin.js` | utility | batch | `server/src/scripts/bootstrapAdmin.js` (existing) | exact |
| `server/src/scripts/seedTestUsers.js` | utility | batch | `server/src/scripts/bootstrapAdmin.js` | role-match |
| `server/package.json` | config | batch | `server/package.json` (existing) | exact |
| `client/tests/e2e/auth.setup.ts` | test | request-response | `client/tests/e2e/fixtures.ts` | role-match |
| `client/tests/e2e/auth.teardown.ts` | test | file-I/O | `client/tests/e2e/auth.setup.ts` | role-match |
| `client/tests/e2e/fixtures.ts` | test | request-response | `client/tests/e2e/fixtures.ts` (existing) | exact |
| `.github/workflows/ci.yml` | config | batch | `.github/workflows/ci.yml` (existing) | exact |

---

## Pattern Assignments

### `client/playwright.config.ts` (config, batch)

**Analog:** `client/playwright.config.ts` (lines 1-86)

**Imports pattern** (lines 1-7):
```typescript
import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';
```
*Note: Deprecated `fileURLToPath(import.meta.url)` and `dirname(__filename)` replaced with standard `import.meta.dirname`.*

**Core Dual webServer Pattern** (lines 75-81 modified to dual array):
```typescript
  /* Run both backend and frontend servers before starting tests */
  webServer: [
    {
      command: 'npm --prefix ../server run start:e2e',
      url: 'http://127.0.0.1:5004/api/v1/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PORT: '5004',
        NODE_ENV: 'test',
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_e2e',
        JWT_SECRET: process.env.JWT_SECRET || 'ci_e2e_jwt_secret_2026_32chars_test_key',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'ci_e2e_refresh_secret_2026_32chars_test',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@smartroute.internal',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'SmartRouteAdmin!2026',
        ADMIN_NAME: 'E2E Admin',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],

  /* Global setup and teardown */
  globalSetup: resolve(import.meta.dirname, './tests/e2e/auth.setup.ts'),
  globalTeardown: resolve(import.meta.dirname, './tests/e2e/auth.teardown.ts'),
```

**Project & Device Configuration Pattern** (lines 40-53):
```typescript
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
```

---

### `client/vite.config.ts` (config, transform)

**Analog:** `client/vite.config.ts` (lines 1-34)

**Imports & Modern Path Aliasing Pattern** (lines 1-17 modernized):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
    deduplicate: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5004',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5004',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
```

---

### `server/src/routes/index.js` (route, request-response)

**Analog:** `server/src/routes/index.js` (lines 17-25)

**Imports pattern** (lines 1-3):
```javascript
const express = require('express');
const router = express.Router();
```

**Health Route & Healthz Alias Pattern** (lines 17-25 extended):
```javascript
// API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SmartRoute API v1 operational',
    timestamp: new Date().toISOString(),
  });
});

// Healthz alias for container and Playwright webServer readiness probe
router.get('/healthz', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'SmartRoute API v1 operational',
    timestamp: new Date().toISOString(),
  });
});
```

---

### `server/src/scripts/bootstrapAdmin.js` (utility, batch)

**Analog:** `server/src/scripts/bootstrapAdmin.js` (lines 20-60, 110-126)

**Imports & Constants** (lines 1-17):
```javascript
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
```

**Validation & Resilient Non-Prod Fallback Pattern** (lines 24-59):
```javascript
function validateBootstrapConfig(sourceEnv = process.env) {
  const envSource = sourceEnv || {};
  const isProduction = envSource.NODE_ENV === 'production';

  const defaultEmail = isProduction ? '' : 'admin@smartroute.internal';
  const defaultPassword = isProduction ? '' : 'SmartRouteAdmin!2026';

  const rawEmail = typeof envSource.ADMIN_EMAIL === 'string'
    ? envSource.ADMIN_EMAIL.trim().toLowerCase()
    : defaultEmail;

  if (!rawEmail || !EMAIL_PATTERN.test(rawEmail)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }

  const rawPassword = envSource.ADMIN_PASSWORD || defaultPassword;
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    throw new Error('ADMIN_PASSWORD is required');
  }
  const trimmedPassword = rawPassword.trim();
  if (rawPassword.length < 10 || trimmedPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 non-whitespace characters');
  }

  const rawName = typeof envSource.ADMIN_NAME === 'string' ? envSource.ADMIN_NAME.trim() : '';
  const name = rawName || 'SmartRoute Admin';

  return { email: rawEmail, password: rawPassword, name };
}
```

**Error Handling & CLI Exit Pattern** (lines 110-126):
```javascript
async function runCli() {
  try {
    validateBootstrapConfig(process.env);
    await connectDB();
    await bootstrapAdmin(process.env);
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error(`[BootstrapAdmin] Error: ${err.message}`);
    try {
      await disconnectDB();
    } catch {
      // Ignore disconnect cleanup error
    }
    process.exit(1);
  }
}
```

---

### `server/src/scripts/seedTestUsers.js` (utility, batch)

**Analog:** `server/src/scripts/seedTestUsers.js` (lines 1-110)

**Imports & User Definition Pattern** (lines 1-27):
```javascript
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const { ROLES, VEHICLE_TYPES, FUEL_TYPES, VEHICLE_STATUS, DRIVER_AVAILABILITY } = require('../config/constants');

const TEST_USERS = [
  {
    email: 'admin@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Admin',
    role: ROLES.ADMIN,
  },
  {
    email: 'manager@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Manager',
    role: ROLES.FLEET_MANAGER,
  },
  {
    email: 'driver@smartroute.test',
    password: 'TestPass123!',
    name: 'E2E Test Driver',
    role: ROLES.DRIVER,
  },
];
```

**Idempotent Upsert & Vehicle Association Pattern** (lines 29-57):
```javascript
async function seedTestUsers() {
  await connectDB();
  for (const userData of TEST_USERS) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      existing.passwordHash = userData.password;
      existing.role = userData.role;
      existing.name = userData.name;
      existing.emailVerified = true;
      existing.active = true;
      existing.accountStatus = 'ACTIVE';
      existing.isDemoData = true;
      await existing.save();
    } else {
      await User.create({
        ...userData,
        passwordHash: userData.password,
        emailVerified: true,
        active: true,
        accountStatus: 'ACTIVE',
        isDemoData: true,
      });
    }
  }
  // Driver profile and vehicle linking
  // ...
  await disconnectDB();
}
```

---

### `server/package.json` (config, batch)

**Analog:** `server/package.json` (lines 7-18)

**Scripts Block Pattern**:
```json
  "scripts": {
    "start": "node src/index.js",
    "start:e2e": "node src/scripts/seedTestUsers.js && node src/index.js",
    "dev": "nodemon src/index.js",
    "clean:port": "powershell -Command \"Get-NetTCPConnection -LocalPort 5004 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\"",
    "seed": "node src/seed/seedBhubaneswar.js",
    "seed:admin": "node src/scripts/bootstrapAdmin.js",
    "seed:test-users": "node src/scripts/seedTestUsers.js",
    "bootstrap:admin": "node src/scripts/bootstrapAdmin.js",
    "test": "cross-env NODE_ENV=test jest --runInBand --detectOpenHandles --forceExit",
    "test:watch": "cross-env NODE_ENV=test jest --watch",
    "test:coverage": "cross-env NODE_ENV=test jest --coverage --runInBand --forceExit"
  }
```

---

### `client/tests/e2e/auth.setup.ts` (test, request-response)

**Analog:** `client/tests/e2e/auth.setup.ts` (lines 1-105)

**Imports & Directory Creation Pattern** (lines 1-13):
```typescript
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { request } from '@playwright/test';

const AUTH_DIR = join(import.meta.dirname, '.auth');

if (!existsSync(AUTH_DIR)) {
  mkdirSync(AUTH_DIR, { recursive: true });
}
```

**Storage State Serialization & IPv4 Target Pattern** (lines 67-88, 94-105):
```typescript
  // Create storage state with tokens
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://127.0.0.1:5173',
        localStorage: [
          { name: 'accessToken', value: tokenStr },
          { name: 'refreshToken', value: refreshTokenStr },
          { name: 'user', value: userDataStr },
        ],
      },
    ],
  };

  writeFileSync(user.storageState, JSON.stringify(storageState, null, 2));

export default async function globalSetup(config: any) {
  // Explicit IPv4 connection prevents ::1 ECONNREFUSED error
  const requestContext = await request.newContext({
    baseURL: 'http://127.0.0.1:5004',
  });

  await loginAndSaveStorageState(requestContext, testUsers.admin);
  await loginAndSaveStorageState(requestContext, testUsers.manager);
  await loginAndSaveStorageState(requestContext, testUsers.driver);

  await requestContext.dispose();
}
```

---

### `client/tests/e2e/auth.teardown.ts` (test, file-I/O)

**Analog:** `client/tests/e2e/auth.teardown.ts` (lines 1-15)

**Cleanup Pattern**:
```typescript
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const AUTH_DIR = join(import.meta.dirname, '.auth');

export default async function globalTeardown() {
  if (existsSync(AUTH_DIR)) {
    rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log('Cleaned up auth storage states');
  }
}
```

---

### `client/tests/e2e/fixtures.ts` (test, request-response)

**Analog:** `client/tests/e2e/fixtures.ts` (lines 1-37, 77-96)

**Authenticated Request Fixture Pattern**:
```typescript
import { test as base, APIRequestContext, Page, expect } from '@playwright/test';
import { testUsers } from './auth.setup';

function createAuthRequest(request: APIRequestContext, token: string): AuthenticatedAPIRequest {
  return {
    async post(url: string, options: any = {}) {
      return request.post(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    // ... get, patch, delete, put ...
  };
}
```

---

### `.github/workflows/ci.yml` (config, batch)

**Analog:** `.github/workflows/ci.yml` (lines 180-249)

**Playwright CI Job Orchestration Pattern**:
```yaml
      - name: Install Playwright Chromium
        run: npx playwright install chromium --with-deps
        working-directory: client

      - name: Run Playwright E2E Tests
        run: npm --prefix client run test:e2e -- --project=chromium
        env:
          CI: true
          PORT: 5004
          MONGODB_URI: mongodb://127.0.0.1:27017/smartroute_e2e
          JWT_SECRET: ci_e2e_jwt_secret_2026_32chars_test_key
          JWT_REFRESH_SECRET: ci_e2e_refresh_secret_2026_32chars_test
          ADMIN_EMAIL: admin@smartroute.internal
          ADMIN_PASSWORD: SmartRouteAdmin!2026
          ADMIN_NAME: E2E Admin
          VITE_API_URL: http://127.0.0.1:5004/api/v1
          PLAYWRIGHT_BASE_URL: http://127.0.0.1:5173

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: client/playwright-report/
          retention-days: 7

      - name: Upload Playwright Traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: client/test-results/
          retention-days: 7
```

---

## Shared Patterns

### 1. IPv4 Addressing Standard (`127.0.0.1`)
**Source:** `client/tests/e2e/auth.setup.ts`, `client/playwright.config.ts`, `client/vite.config.ts`
**Apply to:** All test configs, fetch endpoints, and proxy definitions
**Rule:** Never use `localhost` in network URLs, webServer configurations, or test requests. Node.js 18+ resolves `localhost` to IPv6 `::1` by default, which causes immediate `ECONNREFUSED` when servers bind to IPv4. Always use `127.0.0.1`.

### 2. Resilient Non-Production Fallbacks
**Source:** `server/src/scripts/bootstrapAdmin.js`
**Apply to:** All database bootstrap and seeding scripts
**Rule:** When `NODE_ENV !== 'production'`, scripts must never crash if optional environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) are omitted. Provide valid, compliant defaults (`admin@smartroute.internal` / `SmartRouteAdmin!2026`) while enforcing strict non-empty checks in production.

### 3. Native Playwright Server Lifecycle Management
**Source:** `client/playwright.config.ts`, `.github/workflows/ci.yml`
**Apply to:** Local development test runs and CI runners
**Rule:** Never start background backend servers with `nohup` or background shell operators (`&`) in CI workflows. Instead, use Playwright's native `webServer` array with health probe URLs. Playwright automatically polls readiness, manages process lifecycles, and terminates processes cleanly when tests complete.

### 4. Role-Based Auth Storage State Persistence
**Source:** `client/tests/e2e/auth.setup.ts`, `client/tests/e2e/auth.teardown.ts`
**Apply to:** All E2E test specs (`*.spec.ts`)
**Rule:** Authentication is performed once per test run in `auth.setup.ts` via API POST to `/api/v1/auth/login`. LocalStorage tokens (`accessToken`, `refreshToken`, `user`) are serialized into `.auth/{role}.json` and mounted into browser contexts via `test.use({ storageState: ... })`. The `.auth/` directory is cleaned up in `auth.teardown.ts`.

---

## No Analog Found

None. All files have exact or role-matching analogs within the existing codebase.

---

## Metadata

**Analog search scope:** `client/`, `server/src/`, `.github/workflows/`
**Files scanned:** 12
**Pattern extraction date:** 2026-11-19
