# SmartRoute – Installation and Setup Guide

This guide details the complete local development and production installation instructions for SmartRoute.

---

## 1. Prerequisites

Before installing SmartRoute, ensure the following tools are installed on your host machine:

| Software | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Node.js** | `>= 18.0.0` | `20.x LTS` or `22.x LTS` | Verify with `node -v` |
| **npm** | `>= 9.0.0` | `10.x` | Bundled with Node.js |
| **MongoDB** | `>= 5.0.0` | `6.0+ Community Server` | Local service or MongoDB Atlas |
| **Git** | `>= 2.30.0` | Latest | For repository control |

---

## 2. Repository Clone & Setup

Clone the repository and enter the project directory:

```bash
git clone <repository-url>
cd "Last Mile Delivery Optimization"
```

Verify repository structure:
```text
.
├── client/              # React 18 + Vite Frontend SPA
├── server/              # Node.js + Express.js API Backend
├── docs/                # Comprehensive User & Technical Documentation
├── package.json         # Monorepo Workspace Configuration
└── .env.example         # Unified Environment Template
```

---

## 3. Dependency Installation

SmartRoute uses npm workspaces to manage both frontend and backend dependencies in a single tree:

```bash
# Install root, backend, and frontend packages cleanly
npm install
```

To install workspace packages individually if needed:
```bash
# Server dependencies
npm --prefix server install

# Client dependencies
npm --prefix client install
```

---

## 4. Environment Configuration

### Root & Server Environment
Create your `.env` from the root template:

```bash
# Windows PowerShell
Copy-Item .env.example .env
Copy-Item .env.example server/.env
Copy-Item client/.env.example client/.env
```

Ensure the following variables are configured in `server/.env`:

```env
PORT=5004
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/smartroute
JWT_SECRET=smartroute_super_secret_jwt_key_2026_bhubaneswar_min32chars
JWT_REFRESH_SECRET=smartroute_super_secret_refresh_key_2026_bhubaneswar_min32chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5174
MAP_PROVIDER=geoapify
GEOAPIFY_API_KEY=your_geoapify_server_key_here
```

### Client Environment
Ensure the following variables are configured in `client/.env`:

```env
VITE_API_URL=http://localhost:5004/api/v1
VITE_MAP_PROVIDER=geoapify
VITE_GEOAPIFY_TILE_API_KEY=your_geoapify_client_tile_key_here
```

> [!NOTE]
> If a Geoapify API key is not provided or is invalid, SmartRoute automatically falls back to:
> 1. Real-time Haversine road matrix simulation on the backend.
> 2. OpenStreetMap standard tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) on the frontend.
> The system remains 100% operational with zero external blockers!

---

## 5. Database Initialization & Seeding

Start your local MongoDB service:

```bash
# Windows Service Check
Get-Service -Name MongoDB

# Start if stopped
Start-Service -Name MongoDB
```

Run the canonical Bhubaneswar dataset seed script:

```bash
npm --prefix server run seed
```

This populates:
* **Admin User**: `admin@example.com` / `admin123`
* **Fleet Manager**: `manager@example.com` / `manager123`
* **Driver**: `driver@example.com` / `driver123`
* **Fleet Vehicles**: 5 vehicles across Electric, Diesel, and Petrol (Tata Ace EV, Mahindra Treo, etc.)
* **Commercial Drivers**: 3 verified drivers with OD license registrations
* **Delivery Consignments**: 55 geocoded consignments across Bhubaneswar urban zones
* **Operational Batch**: `BBSR-EXP-01` (Rasulgarh Central Hub)

---

## 6. Running the Application Locally

Run both backend and frontend concurrently from the root directory:

```bash
# Start both backend (Port 5004) and frontend (Port 5174)
npm run dev
```

Alternatively, run in separate terminals:

```bash
# Terminal 1 - Backend Server
npm --prefix server run dev

# Terminal 2 - Frontend Client
npm --prefix client run dev
```

Open your browser and navigate to:
**`http://localhost:5174`**

---

## 7. Verifying the Setup

1. **Backend Health Check**:
   ```bash
   curl http://localhost:5004/api/v1/health
   # Expected: {"success": true, "message": "SmartRoute API v1 operational", ...}
   ```
2. **Readiness Probe**:
   ```bash
   curl http://localhost:5004/api/v1/health/ready
   # Expected: {"success": true, "status": "READY", "services": {"api": "UP", "database": "CONNECTED"}}
   ```
3. **Automated Test Suite**:
   ```bash
   npm --prefix server test
   # Expected: Test Suites: 9 passed, 9 total, Tests: 151 passed, 151 total
   ```
4. **Production Build Check**:
   ```bash
   npm --prefix client run build
   # Expected: tsc && vite build complete with zero errors
   ```
