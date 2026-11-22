<!-- generated-by: gsd-doc-writer -->
# SmartRoute — Getting Started Guide

Welcome to **SmartRoute**, an enterprise-grade last-mile delivery route optimization and real-time fleet management platform purpose-built for the urban logistics network of Bhubaneswar, Odisha.

This guide provides a pragmatic, step-by-step walkthrough for developers, QA engineers, and evaluators to set up the repository, configure runtime environments, initialize the database, launch development servers, and explore role-based workflows across Admin, Fleet Manager, and Driver personas.

---

## 1. Prerequisites

Ensure your host environment meets the following software requirements before proceeding.

| Component | Minimum Version | Recommended Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | `20.x` or `22.x` LTS | `node --version` | Defined in root `package.json` `engines`. |
| **npm** | `>= 10.0.0` | `10.x+` | `npm --version` | Supports native npm workspaces (`server`, `client`). |
| **MongoDB** | `>= 6.0` | `7.0+` | `mongod --version` | Community Server or Docker container. Replica set optional. |
| **Docker & Docker Compose** | *(Optional)* `24.0+` | Latest | `docker compose version` | Optional for running local containerized MongoDB or full stack. |
| **Git** | `2.30+` | Latest | `git --version` | Version control. |

---

## 2. Installation & Workspace Setup

SmartRoute is structured as an npm monorepo with two primary workspaces:
* `server`: Node.js, Express, Socket.IO, and Mongoose optimization backend.
* `client`: Vite, React 18, TypeScript, Tailwind CSS, Leaflet, and GSAP single-page application.

### Step 1: Clone the Repository

Clone the project repository to your local workstation:

```bash
git clone https://github.com/your-org/smartroute.git
cd "Last Mile Delivery Optimization"
```

### Step 2: Install Monorepo Dependencies

Install all root, backend, and frontend dependencies in a single hoisted pass from the repository root:

```bash
npm install
```

This automatically links the workspaces and resolves dependencies for both `server` and `client`.

---

## 3. Environment Configuration

SmartRoute requires environment configuration files for both the backend and frontend. Template files are provided across the repository:

* Root `.env.example`: Master template for Docker and full-stack local coordination.
* `server/.env.example`: Server runtime, database connection, JWT secrets, and third-party API keys.
* `client/.env.example`: Frontend build-time variables prefixed with `VITE_`.

### Step 1: Provision Backend Environment

Create `server/.env` by copying the server template:

```bash
cp server/.env.example server/.env
```

*(On Windows PowerShell, use `Copy-Item server/.env.example server/.env`)*

Inspect and update `server/.env` with your local settings. For local development, the default values provide an operational environment out-of-the-box:

```ini
PORT=5004
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/smartroute
JWT_SECRET=development-only-jwt-secret-key-32chars-min!
JWT_REFRESH_SECRET=development-only-jwt-refresh-secret-32chars-min!
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
SERVE_CLIENT=false
TRUST_PROXY=false
MAP_PROVIDER=geoapify
# Optional: Set your Geoapify server key (simulated routing matrix fallback used if blank)
GEOAPIFY_SERVER_API_KEY=
```

### Step 2: Provision Frontend Environment

Create `client/.env` by copying the client template:

```bash
cp client/.env.example client/.env
```

*(On Windows PowerShell, use `Copy-Item client/.env.example client/.env`)*

Verify the frontend configuration:

```ini
VITE_API_URL=/api/v1
VITE_SOCKET_URL=
VITE_MAP_PROVIDER=geoapify
# Optional: Set your Geoapify client tile key (falls back to OpenStreetMap tiles if blank)
VITE_GEOAPIFY_TILE_API_KEY=
```

> [!TIP]
> In local development, `VITE_API_URL` defaults to `/api/v1` because Vite's dev server (`client/vite.config.ts`) proxies `/api` and `/socket.io` directly to `http://127.0.0.1:5004`.

---

## 4. Database Initialization & Seeding

SmartRoute provides automated CLI scripts to initialize database accounts and demo datasets.

### Step 1: Start MongoDB

Ensure your MongoDB instance is running locally:

**Local Service:**
```bash
# If running as a native Windows service or macOS Homebrew service:
# MongoDB usually runs on 127.0.0.1:27017 automatically.
```

**Using Docker (Alternative):**
```bash
docker run -d --name smartroute-mongo -p 27017:27017 -v smartroute_mongo_data:/data/db mongo:7.0
```

### Step 2: Provision First Administrator

To log in to administrative dashboards without relying on demo accounts, bootstrap a primary system administrator. The bootstrap script is **strictly idempotent** and validates password complexity ($\ge 10$ non-whitespace characters, rejecting common weak passwords):

```bash
npm run bootstrap:admin
```
*(Or via workspace script: `npm --prefix server run seed:admin`)*

By default in `development`, this creates:
* **Email:** `admin@smartroute.internal`
* **Password:** `SmartRouteAdmin!2026`
* **Role:** `ADMIN`

To provision a customized administrator, supply environment variables during execution:

```bash
ADMIN_EMAIL=lead.admin@yourdomain.com ADMIN_PASSWORD="SecureCustomPassword#2026" ADMIN_NAME="Lead Administrator" npm run bootstrap:admin
```

### Step 3: Seed Optional Bhubaneswar Demo Dataset

For feature evaluation, UI testing, and demonstration, SmartRoute includes a prebuilt demo dataset representing the Bhubaneswar logistics zone (Rasulgarh hub, 10 tagged consignments, 3 EV/ICE vehicles, 3 drivers, active delivery batches, and simulated telemetry):

```bash
npm run seed
```
*(Or via workspace script: `npm --prefix server run seed`)*

Every entity generated by this script is tagged with `isDemoData: true`.

### Step 4: Purging Demo Data

You can safely purge demo data at any time without destroying real administrator accounts or production data:

**Option A — CLI Command:**
```bash
node server/src/seed/seedBhubaneswar.js --delete
```

**Option B — In-App Developer Danger Zone:**
1. Log in to the application as an `ADMIN`.
2. Navigate to `/admin/control-center`.
3. Scroll to the **Developer Danger Zone** card at the bottom of the overview.
4. Click **Reset / Purge Database**, review the affected collections, and complete the two-step countdown confirmation modal. This dispatches `DELETE /api/v1/admin/dev-purge` and notifies all connected clients via WebSocket (`system:purged`).

---

## 5. First Run: Starting Development Servers

Launch both the backend API server and the Vite frontend client concurrently:

```bash
npm run dev
```

This executes `concurrently`, spawning:
1. `[SERVER]`: Nodemon running `server/src/index.js` on port `5004`.
2. `[CLIENT]`: Vite dev server running `client` on port `5173`.

Alternatively, run each service in separate terminal windows:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

---

## 6. Verifying System Health Probes

Once running, verify that all backend health probes and database connections report healthy status.

### 1. Liveness Probe (`/healthz`)
Verifies that the Node.js process is active and not currently draining connections:
```bash
curl -i http://localhost:5004/healthz
```
*Expected Response (200 OK):*
```json
{
  "success": true,
  "status": "OK",
  "timestamp": "2026-11-23T02:00:00.000Z"
}
```

### 2. Readiness Probe (`/readyz`)
Verifies database connectivity and readiness to process traffic:
```bash
curl -i http://localhost:5004/readyz
```
*Expected Response (200 OK):*
```json
{
  "success": true,
  "status": "READY",
  "database": "CONNECTED",
  "timestamp": "2026-11-23T02:00:00.000Z"
}
```

### 3. API Versioned Health Check (`/api/v1/health`)
Verifies Express routing pipeline functionality:
```bash
curl -i http://localhost:5004/api/v1/health
```
*Expected Response (200 OK):*
```json
{
  "success": true,
  "message": "SmartRoute API v1 operational",
  "timestamp": "2026-11-23T02:00:00.000Z"
}
```

### 4. API Detailed Readiness Check (`/api/v1/health/ready`)
```bash
curl -i http://localhost:5004/api/v1/health/ready
```
*Expected Response (200 OK):*
```json
{
  "success": true,
  "status": "READY",
  "timestamp": "2026-11-23T02:00:00.000Z",
  "uptimeSeconds": 42,
  "services": {
    "api": "UP",
    "database": "CONNECTED"
  }
}
```

---

## 7. Accessing the Application & Role Login Walkthrough

Open your web browser and navigate to:

```text
http://localhost:5173
```

You will be redirected to the unified authentication page at `http://localhost:5173/login`.

SmartRoute supports both password-based and passwordless OTP authentication, along with **Quick Demo Showcase** buttons for rapid evaluation:

```
+-----------------------------------------------------------------------+
| SmartRoute Operations — Rasulgarh Urban Logistics Hub                 |
+-----------------------------------------------------------------------+
|  [ Demo System Admin ]     [ Demo Hub Dispatcher ]     [ Demo Driver ]|
+-----------------------------------------------------------------------+
|  Sign In Method: (o) Passwordless OTP    ( ) Password                 |
|  Email or Phone Number: [                                           ] |
+-----------------------------------------------------------------------+
```

### Role Walkthroughs

#### 1. Administrator (`ADMIN`)
* **Login Option A (Showcase):** Click the **Demo System Admin** button on the login screen.
* **Login Option B (Credentials):** Select **Password** tab, enter `admin@smartroute.internal` and `SmartRouteAdmin!2026`.
* **Landing Route:** `/admin/control-center`
* **Key Workflows & Navigation:**
  - **Executive Control Center (`/admin/control-center`):** View fleet operational KPIs, active batch statuses, real-time vehicle map, and unassigned delivery pools.
  - **Route Optimizer (`/admin/optimizer`):** Run the genetic algorithm and 2-opt vehicle routing optimizer, inspect clustering, and generate turn-by-turn dispatch manifests.
  - **Fleet & Vehicle Management (`/admin/fleets`):** Monitor vehicle telemetry, battery/fuel levels, maintenance schedules, and CSV fleet imports.
  - **Driver Directory (`/admin/drivers`):** Manage driver rosters, shift schedules, and safety incident reports.
  - **User Management (`/admin/users`):** Provision and edit staff accounts, adjust roles, and manage access privileges.
  - **Audit Logs (`/admin/audit-logs`):** Inspect tamper-evident security audit trails for consignment lifecycle changes and dispatch actions.
  - **Developer Danger Zone:** Execute hard database purges and reset test data.

#### 2. Fleet Manager / Dispatcher (`FLEET_MANAGER`)
* **Login Option A (Showcase):** Click the **Demo Hub Dispatcher** button on the login screen.
* **Login Option B (Credentials):** `demo.manager@smartroute.local`.
* **Landing Route:** `/admin/control-center`
* **Key Workflows & Navigation:**
  - **Consignment Management (`/admin/deliveries`):** Create single consignments or import CSV shipment manifests.
  - **Batch Allocation (`/admin/batches`):** Group deliveries into geographic delivery batches and assign delivery windows.
  - **Live GPS Tracking (`/admin/tracking`):** Track driver positions, telemetry pings, and geofence alerts in real time over WebSockets.
  - **System Notifications (`/admin/notifications`):** Receive dispatch alarms, driver breakdown notices, and delivery SLA exceptions.
  - *Note:* Access to Super Admin settings (`/admin/users`, `/admin/audit-logs`) is restricted.

#### 3. Delivery Driver (`DRIVER`)
* **Login Option A (Showcase):** Click the **Demo Driver** button on the login screen.
* **Login Option B (Credentials):** `demo.driver1@smartroute.local`.
* **Landing Route:** `/driver` (Driver Cockpit HUD)
* **Key Workflows & Navigation:**
  - **Driver Cockpit (`/driver`):** View shift status, assigned vehicle ID, next stop summary, and operational alerts.
  - **Active Route Navigation (`/driver/route`):** Interactive map showing optimized stop sequence from Rasulgarh hub through Bhubaneswar drops.
  - **Delivery Manifest (`/driver/deliveries`):** View package details, trigger recipient OTP verification codes, collect proof-of-delivery signatures, and record delivery completion or failure reasons.
  - **Pre-Trip Vehicle Inspection (`/driver/vehicle-check`):** Submit digital pre-trip checklists (brakes, tires, battery/fuel, mirrors) before starting a route.
  - **Driver Support (`/driver/support`):** Emergency dispatch contact, SOS alerts, and incident logging.
  - **Driver Profile (`/driver/profile`):** View personal shift statistics, completed drops, and on-time performance metrics.

---

## 8. Common Setup Issues & Troubleshooting

### Issue 1: MongoDB Connection Refused (`ECONNREFUSED 127.0.0.1:27017`)
* **Symptom:** Backend fails at startup with `[DB] MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017`.
* **Cause:** The MongoDB service is either not installed or not currently running on the default port.
* **Solution:**
  1. Check if MongoDB is running via `netstat -ano | grep 27017` or PowerShell `Get-Service MongoDB`.
  2. If running locally, start the service: `net start MongoDB` (Windows) or `brew services start mongodb-community` (macOS).
  3. If using Docker, run `docker run -d --name smartroute-mongo -p 27017:27017 mongo:7.0`.

### Issue 2: Port 5004 Collision (`EADDRINUSE: address already in use :::5004`)
* **Symptom:** Server crashes immediately on launch with `Error: listen EADDRINUSE: address already in use :::5004`.
* **Cause:** A previous instance of the server was terminated abnormally and remains bound to port 5004.
* **Solution:**
  Use the built-in server cleanup script:
  ```bash
  npm --prefix server run clean:port
  ```
  *(On Linux/macOS, run `npx kill-port 5004` or `lsof -ti:5004 | xargs kill -9`)*.

### Issue 3: CORS Mismatch / Socket.IO Connection Blocked
* **Symptom:** Browser console outputs `Access to XMLHttpRequest at 'http://localhost:5004/api/v1/...' from origin 'http://localhost:5173' has been blocked by CORS policy`.
* **Cause:** The `CLIENT_ORIGIN` environment variable in `server/.env` does not match the origin in your browser address bar.
* **Solution:**
  Ensure `server/.env` specifies:
  ```ini
  CLIENT_ORIGIN=http://localhost:5173
  ```
  If accessing via an IP address (e.g., `http://192.168.1.100:5173`), add it to `CLIENT_ORIGIN` as a comma-separated list:
  ```ini
  CLIENT_ORIGIN=http://localhost:5173,http://192.168.1.100:5173
  ```

### Issue 4: Service Worker Cache Stale Assets
* **Symptom:** UI updates, styles, or bug fixes are not appearing in the browser after pulling code updates or switching branches.
* **Cause:** SmartRoute includes a Progressive Web App (PWA) Service Worker (`/sw.js`) that caches client bundle assets.
* **Solution:**
  1. Perform a hard refresh: `Ctrl + F5` (Windows/Linux) or `Cmd + Shift + R` (macOS).
  2. In Chrome / Edge DevTools: Open **Application** tab $\rightarrow$ **Service Workers** $\rightarrow$ Click **Unregister**, or toggle **Bypass for network** during active frontend development.

### Issue 5: Missing Geoapify Key / Simulated Routing Fallback
* **Symptom:** Warning message in server logs: `[Geoapify] GEOAPIFY_SERVER_API_KEY is not set. Falling back to simulated road matrix engine.`
* **Cause:** `GEOAPIFY_SERVER_API_KEY` is blank in `server/.env`.
* **Solution:**
  SmartRoute includes a built-in Euclidean and haversine road matrix simulator that allows full route optimization testing without any external API credentials. If high-precision road network calculations are required, register for a free Geoapify key at [geoapify.com](https://www.geoapify.com) and assign it to `GEOAPIFY_SERVER_API_KEY` in `server/.env` and `VITE_GEOAPIFY_TILE_API_KEY` in `client/.env`.

---

## 9. Next Steps

Now that SmartRoute is running locally, consult the following guides for deeper technical details and operational practices:

* **[Architecture Guide](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/docs/ARCHITECTURE.md):** Detailed system architecture, data flow pipelines, optimization algorithms, and WebSocket telemetry contracts.
* **[Configuration Guide](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/docs/CONFIGURATION.md):** Exhaustive reference for environment variables, security hardening, CORS delegates, and production deployment profiles.
* **[Development Guide](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/docs/DEVELOPMENT.md):** Monorepo structure, coding standards, local build commands, and Git pull request workflows.
* **[Testing Guide](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/docs/TESTING.md):** Unit testing with Jest and Vitest, end-to-end testing with Playwright, and smoke probe verification scripts.
