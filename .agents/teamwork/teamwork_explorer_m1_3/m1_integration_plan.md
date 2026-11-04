# Milestone 1 Integration & Scaffolding Plan
**Root Monorepo Architecture, Package Dependencies, and Unit/Integration Test Harness**

- **Project:** SmartRoute — Last-Mile Delivery Optimization Platform
- **Milestone:** Milestone 1 (Foundation, Fleet Operations & CSV Ingestion)
- **Author:** Teamwork Explorer M1-3 (`teamwork_explorer_m1_3`)
- **Date:** 2026-11-03
- **Status:** Complete Technical Specification & Implementation Plan

---

## 1. Executive Summary & Architecture Overview

This integration plan defines the complete scaffolding, workspace dependency graphs, multi-process development orchestration, and test automation harness for **Milestone 1** of SmartRoute.

Milestone 1 delivers the operational foundation of SmartRoute across both backend and frontend:
1. **Identity & RBAC:** JWT credentials authentication, password hashing, user provisioning, and role protection for `ADMIN`, `FLEET_MANAGER`, and `DRIVER`.
2. **Fleet Operations:** Full CRUD for vehicles (Diesel Vans, Electric 3-Wheelers, Petrol/Electric Bikes) and driver profiles, strictly enforcing the **1:1 active vehicle-driver pairing rule**.
3. **Delivery Consignments & Manifests:** Individual delivery CRUD, high-density manifest data tables, and batch clustering anchored at the central Rasulgarh depot.
4. **CSV Manifest Ingestion Engine:** Client/server CSV ingestion with PapaParse, schema verification, row-level dry-run validation, and downloadable error reports.
5. **Delivery Lifecycle State Machine:** Strict enforcement of the operational status flow (`DRAFT` $\to$ `READY` $\to$ `ASSIGNED` $\to$ `OUT_FOR_DELIVERY` $\to$ `COMPLETED` / `FAILED`) with immutable audit logging (`DeliveryEvent`).

### Monorepo Architecture Pattern
SmartRoute is structured as an npm workspaces monorepo with strict boundary separation:
- **Root (`/`):** Coordinates workspaces, unified commands (`dev`, `build`, `test`, `seed`), dependency conventions, and parallel process execution via `concurrently`.
- **Backend API (`server/`):** Node.js/Express service connecting to MongoDB Atlas / local MongoDB, exposing REST endpoints under `/api/v1`, real-time telemetry over Socket.IO, and automated Jest test suites.
- **Frontend Client (`client/`):** React 18, Vite, TypeScript, Tailwind CSS with Stitch design tokens (`#14243A`, `#0051D5`), Lucide icons, PapaParse, and Axios API clients.

```
c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\
├── package.json                          # Monorepo root workspaces & dev scripts
├── server/                               # Backend Express API & Test Harness
│   ├── package.json                      # Express, Mongoose, Socket.IO, Jest, Supertest
│   ├── jest.config.js                    # Test environment, coverage, and setup config
│   ├── .env.example                      # Production/dev environment schema
│   ├── .env.test                         # Test environment configuration
│   ├── src/
│   │   ├── app.js                        # Pure Express app (middleware, routes, error handling)
│   │   ├── index.js                      # HTTP server + Socket.IO initialization & listen
│   │   ├── config/                       # Database connection, env, constants
│   │   ├── models/                       # User, Driver, Vehicle, Delivery, DeliveryBatch, DeliveryEvent
│   │   ├── middleware/                   # auth.js, errorHandler.js, validate.js
│   │   ├── controllers/                  # auth, fleet, delivery, batch controllers
│   │   ├── routes/                       # /api/v1/auth, /vehicles, /drivers, /deliveries, /batches
│   │   └── seed/                         # seedBhubaneswar.js (canonical Rasulgarh demo fixture)
│   └── tests/
│       ├── setup.js                      # DB lifecycle hooks (connect, clear, disconnect)
│       ├── helpers/                      # Token generator, test fixtures factory
│       ├── auth.test.js                  # Auth, JWT, login, RBAC rejection tests
│       ├── deliveries.test.js            # Delivery CRUD, CSV dry-run, state machine tests
│       └── fleet.test.js                 # Vehicle, Driver, 1:1 assignment rule tests
└── client/                               # Frontend React / Vite / TypeScript App
    ├── package.json                      # React 18, Vite, Tailwind, PapaParse, Axios
    ├── vite.config.ts                    # Vite dev server & proxy configuration
    ├── tailwind.config.js                # Stitch design system color and typography tokens
    └── src/                              # Components, Pages, Context, Services
```

---

## 2. Root Monorepo Configuration (`package.json`)

### 2.1 Complete Root `package.json`

Create the root `package.json` at `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\package.json`:

```json
{
  "name": "smartroute-monorepo",
  "version": "1.0.0",
  "description": "SmartRoute — Last-Mile Delivery Optimization Platform for Bhubaneswar",
  "private": true,
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "dev": "concurrently -k -p \"[{name}]\" -n \"SERVER,CLIENT\" -c \"cyan.bold,magenta.bold\" \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "build": "npm run build --workspace=client",
    "test": "npm run test --workspace=server",
    "test:server": "npm run test --workspace=server",
    "test:coverage": "npm run test:coverage --workspace=server",
    "seed": "npm run seed --workspace=server",
    "install:all": "npm install"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### 2.2 Workspace Design Principles & Hoisting Rules
1. **Workspaces Declaration:** `"workspaces": ["server", "client"]` enables npm to discover child packages, link cross-dependencies, and manage unified lockfiles.
2. **Private Repository Safeguard:** `"private": true` prevents accidental publication to public npm registries.
3. **Hoisting Management:** Node dependencies installed at root or within workspaces share common devDependencies. `concurrently` is kept at root as an orchestrator dependency.
4. **Process Concurrency Flags:**
   - `-k` (`--kill-others`): If either the server or client process crashes or terminates, the peer process is cleanly stopped, preventing orphaned background servers on port 5000 or 5173.
   - `-p "[{name}]"`: Prefixes all stdout/stderr terminal lines with the process name (`[SERVER]` or `[CLIENT]`).
   - `-n "SERVER,CLIENT"`: Names each command.
   - `-c "cyan.bold,magenta.bold"`: High-visibility ANSI colors for logs.

---

## 3. Server Package Configuration (`server/package.json` & Config)

### 3.1 Complete `server/package.json`

Create `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\server\package.json`:

```json
{
  "name": "smartroute-server",
  "version": "1.0.0",
  "description": "SmartRoute REST API, Real-Time Socket.IO Server & Optimization Engine",
  "private": true,
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "seed": "node src/seed/seedBhubaneswar.js",
    "test": "cross-env NODE_ENV=test jest --runInBand --detectOpenHandles --forceExit",
    "test:watch": "cross-env NODE_ENV=test jest --watch",
    "test:coverage": "cross-env NODE_ENV=test jest --coverage --runInBand --forceExit"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.3.1",
    "morgan": "^1.10.0",
    "papaparse": "^5.4.1",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "supertest": "^6.3.4"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 3.2 Dependency Rationale & Architectural Purpose

| Dependency | Category | Exact Version | Purpose & Architectural Justification |
|---|---|---|---|
| `express` | Production | `^4.19.2` | Core HTTP framework for REST API routing, middleware chaining, and JSON payload serialization. |
| `mongoose` | Production | `^8.3.1` | ODM for MongoDB schema enforcement, type validation, unique indexing, and lifecycle pre-save hooks. |
| `jsonwebtoken` | Production | `^9.0.2` | HMAC SHA-256 (HS256) stateless token signing and verification for RBAC session management. |
| `bcryptjs` | Production | `^2.4.3` | Pure JavaScript implementation of bcrypt password hashing (salt work factor $\ge 10$) without native C++ compilation dependencies. |
| `cors` | Production | `^2.8.5` | Cross-Origin Resource Sharing control; authorizes frontend origin (`http://localhost:5173`). |
| `dotenv` | Production | `^16.4.5` | Twelve-factor configuration loader reading `.env` / `.env.test` into `process.env`. |
| `papaparse` | Production | `^5.4.1` | High-reliability CSV parser used for server-side manifest file batch ingestion and dry-run validation. |
| `socket.io` | Production | `^4.7.5` | Real-time WebSocket engine for room-multiplexed driver location streaming and delivery status broadcasts. |
| `helmet` | Production | `^7.1.0` | Essential HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options). |
| `express-rate-limit` | Production | `^7.2.0` | IP-based rate limiting to protect `/api/v1/auth/login` against brute-force attacks. |
| `morgan` | Production | `^1.10.0` | HTTP request logging middleware (configured to redact authorization tokens and passwords). |
| `jest` | Dev | `^29.7.0` | Test runner, assertion library, and mock harness for unit and integration testing. |
| `supertest` | Dev | `^6.3.4` | Fluent HTTP assertion library for opaque-box testing of Express endpoints without port bindings. |
| `cross-env` | Dev | `^7.0.3` | Cross-platform environment variable setting (guarantees Windows PowerShell and Linux CI compatibility). |
| `nodemon` | Dev | `^3.1.0` | Hot-reloading development server watching `server/src/`. |

### 3.3 Server Jest Configuration (`server/jest.config.js`)

Create `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\server\jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    './tests/setup.js'
  ],
  testTimeout: 15000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/seed/**'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 3.4 Environment Schemas (`server/.env.example` & `server/.env.test`)

#### `server/.env.example`
```env
# Server Environment Configuration
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# Database Connection
MONGODB_URI=mongodb://127.0.0.1:27017/smartroute_dev

# Authentication & Security
JWT_SECRET=super-secret-jwt-key-minimum-32-characters-required-for-smartroute-2026!
JWT_EXPIRES_IN=24h
BCRYPT_SALT_ROUNDS=10

# Map Provider Mode: LIVE_GOOGLE_MAPS | DETERMINISTIC_SIMULATION
MAP_PROVIDER_MODE=DETERMINISTIC_SIMULATION
GOOGLE_MAPS_API_KEY=
```

#### `server/.env.test`
```env
PORT=5001
NODE_ENV=test
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/smartroute_test
JWT_SECRET=test-jwt-secret-key-32-chars-long-minimum-for-security
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
MAP_PROVIDER_MODE=DETERMINISTIC_SIMULATION
```

---

## 4. Frontend Client Package Configuration (`client/package.json` & Config)

### 4.1 Complete `client/package.json`

Update `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\client\package.json`:

```json
{
  "name": "smartroute-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.8",
    "clsx": "^2.1.1",
    "lucide-react": "^0.378.0",
    "papaparse": "^5.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "socket.io-client": "^4.7.5",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.4.3",
    "typescript": "~5.4.5",
    "vite": "^5.2.11"
  }
}
```

### 4.2 Client Vite Configuration (`client/vite.config.ts`)

To ensure smooth client-server communication during local development, Vite must proxy API and WebSocket requests:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
```

### 4.3 Tailwind CSS Configuration (`client/tailwind.config.js`)

Ensure Tailwind is configured with the Stitch design tokens:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#14243A', // Deep Navy / Primary command surfaces
          dark: '#0D1726',
          light: '#1F3554',
        },
        secondary: {
          DEFAULT: '#0051D5', // Electric Blue / Active vectors & buttons
          hover: '#003EA8',
          container: '#316BF3',
        },
        surface: {
          DEFAULT: '#FAF8FF', // Ergonomic low-glare canvas
          low: '#F2F3FF',
          lowest: '#FFFFFF',
        },
        status: {
          success: '#16A34A',
          warning: '#F59E0B',
          error: '#BA1A1A',
          info: '#2563EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

---

## 5. Milestone 1 Test Harness Architecture

### 5.1 Express App vs Server Listener Separation
To run clean, fast, isolated integration tests with Supertest without port collisions or lingering WebSocket connections:
- **`server/src/app.js`**: Creates and configures the Express application:
  - Registers security middleware (`helmet`, `cors`, `express-rate-limit`).
  - Registers body parsers (`express.json()`, `express.urlencoded()`).
  - Mounts routes (`/api/v1/auth`, `/api/v1/vehicles`, `/api/v1/drivers`, `/api/v1/deliveries`, `/api/v1/batches`).
  - Mounts centralized error handler (`errorHandler`).
  - Exports `app`. **Does NOT call `app.listen()`**.
- **`server/src/index.js`**: Imports `app`, creates Node `http.createServer(app)`, binds `socket.io`, connects to MongoDB, and begins listening on `PORT`.
- In integration tests, Supertest mounts `app` directly on an ephemeral in-process port (`request(app).post(...)`).

### 5.2 Test Database Lifecycle (`server/tests/setup.js`)

Create `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\server\tests\setup.js`:

```javascript
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute_test';

beforeAll(async () => {
  // Ensure connection to isolated test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  }
});

afterEach(async () => {
  // Clear all test collections between test runs to guarantee zero test cross-contamination
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});

afterAll(async () => {
  // Disconnect cleanly to prevent Jest open handles
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
```

### 5.3 Test Helpers & Fixtures (`server/tests/helpers/testUtils.js`)

Create helper utilities for tests to generate authenticated JWT tokens and sample entity models:

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Vehicle = require('../../src/models/Vehicle');
const Driver = require('../../src/models/Driver');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-long-minimum-for-security';

/**
 * Creates a persisted user in test DB and returns user and signed JWT token
 */
async function createTestUser(role = 'ADMIN', emailSuffix = 'admin@smartroute.test') {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Password123!', salt);
  
  const user = await User.create({
    name: `Test ${role}`,
    email: `${role.toLowerCase()}_${Date.now()}@smartroute.test`,
    passwordHash,
    role,
    active: true,
  });

  const token = jwt.sign(
    { sub: user._id.toString(), id: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return { user, token };
}

/**
 * Creates a persisted vehicle
 */
async function createTestVehicle(overrides = {}) {
  return await Vehicle.create({
    vehicleId: overrides.vehicleId || `OD-02-TEST-${Math.floor(Math.random() * 9000 + 1000)}`,
    makeModel: overrides.makeModel || 'Tata Ace Diesel',
    type: overrides.type || 'Van',
    capacityKg: overrides.capacityKg || 1000,
    capacityM3: overrides.capacityM3 || 3.5,
    fuelType: overrides.fuelType || 'Diesel',
    kmPerLitre: overrides.kmPerLitre || 14.0,
    availability: overrides.availability || 'AVAILABLE',
    ...overrides,
  });
}

/**
 * Creates a persisted driver linked to a User
 */
async function createTestDriver(user, overrides = {}) {
  return await Driver.create({
    userId: user._id,
    licenseNumber: overrides.licenseNumber || `OD-02-LIC-${Math.floor(Math.random() * 90000 + 10000)}`,
    phone: overrides.phone || '+91 98610 99999',
    availability: overrides.availability || 'AVAILABLE',
    assignedVehicleId: overrides.assignedVehicleId || null,
    ...overrides,
  });
}

module.exports = {
  createTestUser,
  createTestVehicle,
  createTestDriver,
};
```

---

## 6. Detailed Test Suite Specifications for Milestone 1

### 6.1 `server/tests/auth.test.js` Specification

#### Focus
1. User login with valid credentials (Admin, Fleet Manager, Driver).
2. Negative credentials rejection (invalid password, non-existent user, missing fields).
3. JWT verification middleware behavior on protected endpoints.
4. Role-based access control (RBAC) rejection on admin-only routes.
5. Password hashing and confidential data exclusion (`passwordHash` never leaked in JSON).

#### Test Cases & Assertions Matrix

```javascript
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createTestUser } = require('./helpers/testUtils');

describe('Authentication & RBAC Test Suite (server/tests/auth.test.js)', () => {

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Seed known user
      const bcrypt = require('bcryptjs');
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
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user).toMatchObject({
        email: 'admin@smartroute.internal',
        role: 'ADMIN',
      });
      // CRITICAL: passwordHash must NOT be returned
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('TC-AUTH-2: Login with invalid password returns 401 and INVALID_CREDENTIALS', async () => {
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

    test('TC-AUTH-3: Login with non-existent email returns 401 without account existence leak', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@smartroute.internal',
          password: 'SmartRoute2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('TC-AUTH-4: Login with missing fields returns 400 Bad Request with field validation errors', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email-format',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('JWT Verification & RBAC Authorization Middleware', () => {
    test('TC-AUTH-5: Request to protected route without Authorization header returns 401', async () => {
      const res = await request(app)
        .get('/api/v1/vehicles');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('TC-AUTH-6: Request with malformed or invalid JWT token returns 401', async () => {
      const res = await request(app)
        .get('/api/v1/vehicles')
        .set('Authorization', 'Bearer this-is-an-invalid-garbage-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('TC-AUTH-7: User provisioning (POST /api/v1/auth/users) allows ADMIN role', async () => {
      const { token: adminToken } = await createTestUser('ADMIN');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Fleet Manager',
          email: 'fleet.manager.new@smartroute.test',
          password: 'Password123!',
          role: 'FLEET_MANAGER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('fleet.manager.new@smartroute.test');
      expect(res.body.data.user.role).toBe('FLEET_MANAGER');
    });

    test('TC-AUTH-8: User provisioning (POST /api/v1/auth/users) rejects FLEET_MANAGER with 403 Forbidden', async () => {
      const { token: managerToken } = await createTestUser('FLEET_MANAGER');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Hacker User',
          email: 'hacker@smartroute.test',
          password: 'Password123!',
          role: 'ADMIN',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('TC-AUTH-9: User provisioning (POST /api/v1/auth/users) rejects DRIVER with 403 Forbidden', async () => {
      const { token: driverToken } = await createTestUser('DRIVER');

      const res = await request(app)
        .post('/api/v1/auth/users')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          name: 'Hacker User',
          email: 'hacker@smartroute.test',
          password: 'Password123!',
          role: 'DRIVER',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

});
```

---

### 6.2 `server/tests/deliveries.test.js` Specification

#### Focus
1. Delivery Consignment CRUD (create, read, query filter, update).
2. Input field validation (weights, customer info, time-window format and ordering).
3. CSV Batch Import & Dry-Run Engine (verifying dry-run preview vs persistent commit, row-level error reporting).
4. Delivery Lifecycle State Machine transitions (`DRAFT` $\to$ `READY` $\to$ `ASSIGNED` $\to$ `OUT_FOR_DELIVERY` $\to$ `COMPLETED` / `FAILED`).
5. Illegal transition rejection and mandatory failure reasons.
6. Verification of immutable audit logs (`DeliveryEvent`).

#### Test Cases & Assertions Matrix

```javascript
const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const DeliveryEvent = require('../src/models/DeliveryEvent');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

describe('Deliveries & CSV Ingestion Test Suite (server/tests/deliveries.test.js)', () => {
  let managerToken;
  let driverUser;
  let driverToken;
  let testDriver;
  let testVehicle;

  beforeEach(async () => {
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;

    const driverData = await createTestUser('DRIVER');
    driverUser = driverData.user;
    driverToken = driverData.token;

    testVehicle = await createTestVehicle();
    testDriver = await createTestDriver(driverUser, { assignedVehicleId: testVehicle._id });
  });

  describe('Delivery CRUD & Field Validation', () => {
    test('TC-DEL-1: Create single delivery consignment with valid attributes returns 201 and DRAFT status', async () => {
      const payload = {
        orderReference: '#DEL-BBS-001',
        customer: {
          name: 'Soumya Ranjan Mohanty',
          phone: '+91 98610 24891',
        },
        address: {
          street: 'Plot 412, DLF Cybercity, Patia',
          city: 'Bhubaneswar',
          zone: 'Patia (Z-1)',
          postalCode: '751024',
        },
        weightKg: 14.5,
        priority: 'Urgent',
        timeWindow: {
          start: '09:00',
          end: '11:00',
        },
      };

      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderReference).toBe('#DEL-BBS-001');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.weightKg).toBe(14.5);
      expect(res.body.data.location).toBeDefined();
    });

    test('TC-DEL-2: Create delivery rejects non-positive weight with 400 Bad Request', async () => {
      const payload = {
        orderReference: '#DEL-BBS-002',
        customer: { name: 'Invalid Weight', phone: '+91 98610 00000' },
        address: { street: 'Janpath', city: 'Bhubaneswar', zone: 'Saheed Nagar (Z-3)', postalCode: '751007' },
        weightKg: -5.0,
        priority: 'Standard',
        timeWindow: { start: '10:00', end: '12:00' },
      };

      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/weight/i);
    });

    test('TC-DEL-3: Create delivery rejects inverted time window (start >= end) with 400 Bad Request', async () => {
      const payload = {
        orderReference: '#DEL-BBS-003',
        customer: { name: 'Inverted Window', phone: '+91 98610 00000' },
        address: { street: 'Khandagiri', city: 'Bhubaneswar', zone: 'Khandagiri (Z-4)', postalCode: '751030' },
        weightKg: 10.0,
        priority: 'Standard',
        timeWindow: { start: '14:00', end: '11:00' }, // Invalid!
      };

      const res = await request(app)
        .post('/api/v1/deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/time window/i);
    });

    test('TC-DEL-4: GET /api/v1/deliveries filters deliveries by zone and status', async () => {
      await Delivery.create([
        {
          orderReference: '#DEL-Z1-01',
          customer: { name: 'User 1', phone: '+91 98610 11111' },
          address: { street: 'Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
          weightKg: 5,
          priority: 'Standard',
          timeWindow: { start: '09:00', end: '18:00' },
          status: 'READY',
        },
        {
          orderReference: '#DEL-Z2-02',
          customer: { name: 'User 2', phone: '+91 98610 22222' },
          address: { street: 'Jaydev Vihar', city: 'Bhubaneswar', zone: 'Jaydev Vihar (Z-2)', postalCode: '751013' },
          weightKg: 8,
          priority: 'Urgent',
          timeWindow: { start: '09:00', end: '11:00' },
          status: 'DRAFT',
        },
      ]);

      const res = await request(app)
        .get('/api/v1/deliveries?zone=Patia (Z-1)&status=READY')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].orderReference).toBe('#DEL-Z1-01');
    });
  });

  describe('CSV Batch Import & Dry-Run Validation', () => {
    test('TC-DEL-5: Dry-run CSV validation (dryRun=true) returns row counts and syntax checks without DB inserts', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#CSV-01', customerName: 'A. Mishra', phone: '+91 98610 00001', address: 'Patia', weightKg: 10, priority: 'Standard', timeWindowStart: '09:00', timeWindowEnd: '12:00' },
          { orderReference: '#CSV-02', customerName: 'B. Nayak', phone: '+91 98610 00002', address: 'Saheed Nagar', weightKg: 15, priority: 'Urgent', timeWindowStart: '10:00', timeWindowEnd: '13:00' },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(2);
      expect(res.body.data.validRows).toBe(2);
      expect(res.body.data.invalidRows).toBe(0);
      expect(res.body.data.errors).toHaveLength(0);

      // Verify no records actually inserted
      const count = await Delivery.countDocuments({ orderReference: { $in: ['#CSV-01', '#CSV-02'] } });
      expect(count).toBe(0);
    });

    test('TC-DEL-6: Partial invalid CSV returns row-level error reporting with exact line numbers and messages', async () => {
      const csvPayload = {
        dryRun: true,
        rows: [
          { orderReference: '#CSV-03', customerName: 'Valid Customer', phone: '+91 98610 00003', address: 'Khandagiri', weightKg: 12, priority: 'Standard', timeWindowStart: '09:00', timeWindowEnd: '12:00' },
          { orderReference: '#CSV-04', customerName: 'Invalid Weight', phone: '+91 98610 00004', address: 'Nayapalli', weightKg: -8, priority: 'Standard', timeWindowStart: '09:00', timeWindowEnd: '12:00' }, // Row 2 error
          { orderReference: '#CSV-05', customerName: 'Missing Address', phone: '+91 98610 00005', address: '', weightKg: 14, priority: 'Standard', timeWindowStart: '09:00', timeWindowEnd: '12:00' }, // Row 3 error
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(3);
      expect(res.body.data.validRows).toBe(1);
      expect(res.body.data.invalidRows).toBe(2);
      expect(res.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 2, field: 'weightKg' }),
          expect.objectContaining({ row: 3, field: 'address' }),
        ])
      );
    });

    test('TC-DEL-7: CSV Commit (dryRun=false) persists all valid rows in DRAFT status', async () => {
      const csvPayload = {
        dryRun: false,
        rows: [
          { orderReference: '#CSV-06', customerName: 'Persisted User 1', phone: '+91 98610 00006', address: 'Rasulgarh', weightKg: 20, priority: 'Standard', timeWindowStart: '09:00', timeWindowEnd: '18:00' },
          { orderReference: '#CSV-07', customerName: 'Persisted User 2', phone: '+91 98610 00007', address: 'Mancheswar', weightKg: 25, priority: 'Urgent', timeWindowStart: '10:00', timeWindowEnd: '12:00' },
        ],
      };

      const res = await request(app)
        .post('/api/v1/deliveries/import-csv')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(csvPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.importedCount).toBe(2);

      const d1 = await Delivery.findOne({ orderReference: '#CSV-06' });
      expect(d1).not.toBeNull();
      expect(d1.status).toBe('DRAFT');
    });
  });

  describe('Delivery Lifecycle State Machine & Audit Events', () => {
    let delivery;

    beforeEach(async () => {
      delivery = await Delivery.create({
        orderReference: '#DEL-LIFE-01',
        customer: { name: 'Lifecycle Consignee', phone: '+91 98610 33333' },
        address: { street: 'KIIT Square, Patia', city: 'Bhubaneswar', zone: 'Patia (Z-1)', postalCode: '751024' },
        weightKg: 10,
        priority: 'Urgent',
        timeWindow: { start: '09:00', end: '11:00' },
        status: 'DRAFT',
      });
    });

    test('TC-DEL-8: Follows valid progression DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED', async () => {
      // 1. DRAFT -> READY (Manager)
      let res = await request(app)
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'READY' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('READY');

      // 2. READY -> ASSIGNED (Manager assigns vehicle and driver)
      res = await request(app)
        .patch(`/api/v1/deliveries/${delivery._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: testVehicle._id, driverId: testDriver._id });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ASSIGNED');
      expect(res.body.data.assignedDriverId.toString()).toBe(testDriver._id.toString());

      // 3. ASSIGNED -> OUT_FOR_DELIVERY (Driver departs)
      res = await request(app)
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'OUT_FOR_DELIVERY' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('OUT_FOR_DELIVERY');

      // 4. OUT_FOR_DELIVERY -> COMPLETED (Driver submits OTP / POD)
      res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/complete`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          otp: '4821',
          signatureSvg: 'data:image/svg+xml;base64,PHN2Zz...',
          notes: 'Delivered at front door',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.proofOfDelivery.otpVerified).toBe(true);

      // Verify Audit Event trail
      const events = await DeliveryEvent.find({ deliveryId: delivery._id }).sort({ at: 1 });
      expect(events.length).toBeGreaterThanOrEqual(4);
      expect(events.map(e => e.metadata.toStatus)).toContain('COMPLETED');
    });

    test('TC-DEL-9: Invalid transition (DRAFT directly to COMPLETED) is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/v1/deliveries/${delivery._id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    test('TC-DEL-10: Marking delivery FAILED without reason code is rejected with 400 Bad Request', async () => {
      // Advance to OUT_FOR_DELIVERY
      delivery.status = 'OUT_FOR_DELIVERY';
      delivery.assignedDriverId = testDriver._id;
      await delivery.save();

      const res = await request(app)
        .post(`/api/v1/deliveries/${delivery._id}/fail`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({}); // Missing reason!

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/reason/i);
    });
  });

});
```

---

### 6.3 `server/tests/fleet.test.js` Specification

#### Focus
1. Vehicle CRUD and specifications (Van, EV 3-Wheeler, Bike) with capacity and fuel parameters.
2. Cross-field vehicle validation (e.g. combustion requires `kmPerLitre`, EV requires `energyKWhPerKm`).
3. Driver CRUD and availability status.
4. Strict **1:1 Active Driver-Vehicle Pairing Rule**:
   - Assigning Driver A to Vehicle A succeeds.
   - Assigning Driver A to Vehicle B while still assigned to Vehicle A returns HTTP 409 Conflict.
   - Assigning Driver B to Vehicle A while Vehicle A is already in use by Driver A returns HTTP 409 Conflict.
   - Unassigning restores `AVAILABLE` status and allows new assignments.
5. Maintenance status gates preventing assignment to deactivated vehicles.

#### Test Cases & Assertions Matrix

```javascript
const request = require('supertest');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const { createTestUser, createTestVehicle, createTestDriver } = require('./helpers/testUtils');

describe('Fleet Management & 1:1 Pairing Rules Test Suite (server/tests/fleet.test.js)', () => {
  let managerToken;

  beforeEach(async () => {
    const manager = await createTestUser('FLEET_MANAGER');
    managerToken = manager.token;
  });

  describe('Vehicle Registry CRUD & Validation', () => {
    test('TC-FLEET-1: Register Diesel Van with capacity and kmPerLitre returns 201', async () => {
      const payload = {
        vehicleId: 'OD-02-VAN-1001',
        makeModel: 'Tata Ace Gold Diesel',
        type: 'Van',
        capacityKg: 750.0,
        capacityM3: 2.8,
        fuelType: 'Diesel',
        kmPerLitre: 15.0,
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleId).toBe('OD-02-VAN-1001');
      expect(res.body.data.fuelType).toBe('Diesel');
      expect(res.body.data.availability).toBe('AVAILABLE');
    });

    test('TC-FLEET-2: Register Electric 3-Wheeler with energyKWhPerKm returns 201', async () => {
      const payload = {
        vehicleId: 'OD-02-EV-2001',
        makeModel: 'Mahindra Treo Zor Cargo',
        type: 'Van',
        capacityKg: 500.0,
        fuelType: 'Electric',
        energyKWhPerKm: 0.12,
        batterySoC: 95,
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicleId).toBe('OD-02-EV-2001');
      expect(res.body.data.fuelType).toBe('Electric');
      expect(res.body.data.energyKWhPerKm).toBe(0.12);
    });

    test('TC-FLEET-3: Register Electric vehicle without energyKWhPerKm returns 400 Bad Request', async () => {
      const payload = {
        vehicleId: 'OD-02-EV-INVALID',
        makeModel: 'Invalid EV',
        type: 'Van',
        capacityKg: 600.0,
        fuelType: 'Electric',
        // Missing energyKWhPerKm
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/energyKWhPerKm/i);
    });

    test('TC-FLEET-4: Register Diesel vehicle without kmPerLitre returns 400 Bad Request', async () => {
      const payload = {
        vehicleId: 'OD-02-DIESEL-INVALID',
        makeModel: 'Invalid Diesel',
        type: 'Van',
        capacityKg: 1000.0,
        fuelType: 'Diesel',
        // Missing kmPerLitre
      };

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/kmPerLitre/i);
    });

    test('TC-FLEET-5: Duplicate vehicleId registration returns 409 Conflict', async () => {
      await createTestVehicle({ vehicleId: 'OD-02-DUP-9999' });

      const res = await request(app)
        .post('/api/v1/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          vehicleId: 'OD-02-DUP-9999',
          makeModel: 'Duplicate Van',
          type: 'Van',
          capacityKg: 800,
          fuelType: 'Diesel',
          kmPerLitre: 12.0,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VEHICLE_ALREADY_EXISTS');
    });
  });

  describe('Driver Registry & 1:1 Vehicle Pairing Rule', () => {
    let driverA, driverB;
    let vehicle1, vehicle2;

    beforeEach(async () => {
      const userA = await createTestUser('DRIVER');
      const userB = await createTestUser('DRIVER');

      driverA = await createTestDriver(userA.user, { licenseNumber: 'OD-02-2020-001001', phone: '+91 98610 11111' });
      driverB = await createTestDriver(userB.user, { licenseNumber: 'OD-02-2020-002002', phone: '+91 98610 22222' });

      vehicle1 = await createTestVehicle({ vehicleId: 'OD-02-PAIR-1111' });
      vehicle2 = await createTestVehicle({ vehicleId: 'OD-02-PAIR-2222' });
    });

    test('TC-FLEET-6: Assign Driver A to Vehicle 1 succeeds (HTTP 200, status updated to ASSIGNED)', async () => {
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedVehicleId.toString()).toBe(vehicle1._id.toString());

      // Verify mutual pairing in database
      const updatedVehicle = await Vehicle.findById(vehicle1._id);
      expect(updatedVehicle.assignedDriverId.toString()).toBe(driverA._id.toString());
      expect(updatedVehicle.availability).toBe('ASSIGNED');
    });

    test('TC-FLEET-7: Conflict when Driver A attempts assignment to Vehicle 2 while already assigned to Vehicle 1 (HTTP 409)', async () => {
      // First assign Driver A to Vehicle 1
      await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      // Attempt to bind Driver A to Vehicle 2
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle2._id });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DRIVER_ALREADY_ASSIGNED');
    });

    test('TC-FLEET-8: Conflict when Driver B attempts assignment to Vehicle 1 already assigned to Driver A (HTTP 409)', async () => {
      // First assign Driver A to Vehicle 1
      await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      // Attempt to bind Driver B to already occupied Vehicle 1
      const res = await request(app)
        .put(`/api/v1/drivers/${driverB._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VEHICLE_ALREADY_ASSIGNED');
    });

    test('TC-FLEET-9: Unassign Driver A from Vehicle 1 restores AVAILABLE status for both', async () => {
      // Pair them
      await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      // Unassign
      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/unassign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedDriver = await Driver.findById(driverA._id);
      expect(updatedDriver.assignedVehicleId).toBeNull();

      const updatedVehicle = await Vehicle.findById(vehicle1._id);
      expect(updatedVehicle.assignedDriverId).toBeNull();
      expect(updatedVehicle.availability).toBe('AVAILABLE');

      // Now Driver B can successfully claim Vehicle 1
      const pairRes = await request(app)
        .put(`/api/v1/drivers/${driverB._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      expect(pairRes.status).toBe(200);
    });

    test('TC-FLEET-10: Assignment blocked if vehicle is in MAINTENANCE status (HTTP 400)', async () => {
      vehicle1.availability = 'MAINTENANCE';
      await vehicle1.save();

      const res = await request(app)
        .put(`/api/v1/drivers/${driverA._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vehicleId: vehicle1._id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VEHICLE_NOT_AVAILABLE');
    });
  });

});
```

---

## 7. Execution Runbook, Jest Commands & Output Assertions

### 7.1 Local Prerequisites & Verification
Verify Node, npm, and MongoDB service on the Windows workstation:
```powershell
# 1. Verify Node and npm
node -v   # Expected: >= v18.0.0 (Found: v24.16.0)
npm -v    # Expected: >= 9.0.0  (Found: 11.16.0)

# 2. Verify MongoDB service is running
Get-Service -Name MongoDB
```

### 7.2 Monorepo Installation & Build Steps
Execute from monorepo root:
```powershell
# Step 1: Install all workspace dependencies from root
npm install

# Step 2: Seed Bhubaneswar demo dataset into database
npm run seed
```

### 7.3 Exact Jest Execution Commands

To execute the Milestone 1 test harness with full isolation and leak detection:

#### Option A: Unified Monorepo Command
```powershell
npm test
```

#### Option B: Server Workspace Direct Command
```powershell
npm test --workspace=server
# Or using prefix:
npm --prefix server test
```

#### Option C: Direct CLI with Strict Flags
```powershell
cd server
npx jest --config jest.config.js --runInBand --detectOpenHandles --forceExit --verbose
```

### 7.4 Detailed Expected Terminal Output & Exit Code Assertions

When all tests pass, Jest produces the following terminal output:

```text
 PASS  tests/auth.test.js
  Authentication & RBAC Test Suite (server/tests/auth.test.js)
    POST /api/v1/auth/login
      √ TC-AUTH-1: Login with valid credentials returns 200, JWT token, and sanitized user object (185 ms)
      √ TC-AUTH-2: Login with invalid password returns 401 and INVALID_CREDENTIALS (122 ms)
      √ TC-AUTH-3: Login with non-existent email returns 401 without account existence leak (98 ms)
      √ TC-AUTH-4: Login with missing fields returns 400 Bad Request with field validation errors (45 ms)
    JWT Verification & RBAC Authorization Middleware
      √ TC-AUTH-5: Request to protected route without Authorization header returns 401 (32 ms)
      √ TC-AUTH-6: Request with malformed or invalid JWT token returns 401 (28 ms)
      √ TC-AUTH-7: User provisioning (POST /api/v1/auth/users) allows ADMIN role (140 ms)
      √ TC-AUTH-8: User provisioning (POST /api/v1/auth/users) rejects FLEET_MANAGER with 403 Forbidden (42 ms)
      √ TC-AUTH-9: User provisioning (POST /api/v1/auth/users) rejects DRIVER with 403 Forbidden (38 ms)

 PASS  tests/deliveries.test.js
  Deliveries & CSV Ingestion Test Suite (server/tests/deliveries.test.js)
    Delivery CRUD & Field Validation
      √ TC-DEL-1: Create single delivery consignment with valid attributes returns 201 and DRAFT status (85 ms)
      √ TC-DEL-2: Create delivery rejects non-positive weight with 400 Bad Request (35 ms)
      √ TC-DEL-3: Create delivery rejects inverted time window (start >= end) with 400 Bad Request (32 ms)
      √ TC-DEL-4: GET /api/v1/deliveries filters deliveries by zone and status (65 ms)
    CSV Batch Import & Dry-Run Validation
      √ TC-DEL-5: Dry-run CSV validation (dryRun=true) returns row counts and syntax checks without DB inserts (78 ms)
      √ TC-DEL-6: Partial invalid CSV returns row-level error reporting with exact line numbers and messages (62 ms)
      √ TC-DEL-7: CSV Commit (dryRun=false) persists all valid rows in DRAFT status (95 ms)
    Delivery Lifecycle State Machine & Audit Events
      √ TC-DEL-8: Follows valid progression DRAFT -> READY -> ASSIGNED -> OUT_FOR_DELIVERY -> COMPLETED (210 ms)
      √ TC-DEL-9: Invalid transition (DRAFT directly to COMPLETED) is rejected with 400 Bad Request (41 ms)
      √ TC-DEL-10: Marking delivery FAILED without reason code is rejected with 400 Bad Request (52 ms)

 PASS  tests/fleet.test.js
  Fleet Management & 1:1 Pairing Rules Test Suite (server/tests/fleet.test.js)
    Vehicle Registry CRUD & Validation
      √ TC-FLEET-1: Register Diesel Van with capacity and kmPerLitre returns 201 (68 ms)
      √ TC-FLEET-2: Register Electric 3-Wheeler with energyKWhPerKm returns 201 (59 ms)
      √ TC-FLEET-3: Register Electric vehicle without energyKWhPerKm returns 400 Bad Request (36 ms)
      √ TC-FLEET-4: Register Diesel vehicle without kmPerLitre returns 400 Bad Request (34 ms)
      √ TC-FLEET-5: Duplicate vehicleId registration returns 409 Conflict (58 ms)
    Driver Registry & 1:1 Vehicle Pairing Rule
      √ TC-FLEET-6: Assign Driver A to Vehicle 1 succeeds (HTTP 200, status updated to ASSIGNED) (88 ms)
      √ TC-FLEET-7: Conflict when Driver A attempts assignment to Vehicle 2 while already assigned to Vehicle 1 (HTTP 409) (72 ms)
      √ TC-FLEET-8: Conflict when Driver B attempts assignment to Vehicle 1 already assigned to Driver A (HTTP 409) (69 ms)
      √ TC-FLEET-9: Unassign Driver A from Vehicle 1 restores AVAILABLE status for both (115 ms)
      √ TC-FLEET-10: Assignment blocked if vehicle is in MAINTENANCE status (HTTP 400) (49 ms)

Test Suites: 3 passed, 3 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        4.821 s
Ran all test suites.
```

- **Exit Code:** `0` (Success).
- Any failing test causes non-zero exit code (`1`), immediately failing CI pipelines.

---

## 8. Implementation Agent Task Checklist for Milestone 1

### For Lead Orchestrator (A0)
1. Commit root `package.json` with npm workspaces (`["server", "client"]`) and `concurrently`.
2. Scaffold `server/` directory with `package.json`, `.env.example`, and `jest.config.js`.
3. Update `client/package.json` with React 18, React Router, Lucide, Axios, and PapaParse.

### For Backend Implementation Agent (A2 / M1-1)
1. Follow `app.js` vs `index.js` separation.
2. Implement Mongoose models in `server/src/models/`:
   - `User.js` (password hashing hook, role enum, excluded passwordHash).
   - `Vehicle.js` (cross-field custom validator for fuelType vs kmPerLitre / energyKWhPerKm).
   - `Driver.js` (unique license, 1:1 assignedVehicleId).
   - `Delivery.js` (orderReference, GeoJSON location, weightKg > 0, timeWindow regex).
   - `DeliveryEvent.js` (immutable status transitions).
3. Implement controllers and routes in `server/src/controllers/` and `server/src/routes/`:
   - `authController.js` & `authRoutes.js`
   - `vehicleController.js` & `vehicleRoutes.js`
   - `driverController.js` & `driverRoutes.js` (handling 1:1 assignment and conflict 409)
   - `deliveryController.js` & `deliveryRoutes.js` (CSV import with dryRun flag, lifecycle transitions)
4. Implement `server/tests/setup.js` and the 3 test suites (`auth.test.js`, `deliveries.test.js`, `fleet.test.js`).
5. Run `npm test` and verify 29/29 passing tests.

### For Frontend Implementation Agent (A1 / M1-2)
1. Add React Router and Stitch layout in `client/src/App.tsx`.
2. Implement `LoginPage.tsx` with role quick-fill buttons.
3. Build `ManifestTable.tsx`, `CsvImportModal.tsx`, and `BatchComposerPanel.tsx`.
4. Test client dev server with `npm run dev` and verify proxy forwarding to `http://localhost:5000`.
