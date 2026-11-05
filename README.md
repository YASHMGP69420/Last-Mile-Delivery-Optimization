# SmartRoute – Smart Route Optimization System for Last-Mile Delivery

[![CI/CD Pipeline](https://github.com/smartroute/smartroute/actions/workflows/ci.yml/badge.svg)](https://github.com/smartroute/smartroute/actions)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/tests-151%20passed-success.svg)](docs/FINAL_PROJECT_COMPLETION_REPORT.md)

**SmartRoute** is an enterprise-grade route optimization, fleet scheduling, and driver execution platform designed for dense urban logistics clusters. Built with React 18, Node.js Express, MongoDB, and Tailwind CSS, SmartRoute automates capacity-constrained bin packing, Electric Vehicle (EV) allocation, Nearest-Neighbor heuristic construction, and bounded 2-Opt local search Traveling Salesperson Problem (TSP) optimization.

---

## 🌟 Key Highlights

* **Multi-Vehicle 2-Opt TSP Engine**: Refines delivery sequences while guaranteeing the mathematical invariant $D_{\text{optimized}} \le D_{\text{baseline}}$.
* **EV Preference & Fuel Savings**: Computes monetary savings in Indian Rupees (₹) and kilograms of tailpipe $\text{CO}_2$ avoided.
* **1:1 Vehicle-Driver Mutual Exclusivity**: Enforces strict mutual unbinding on reassignment at both the database and REST controller layers.
* **Resilient Mapping with Fallbacks**: Interactive Leaflet canvas supporting Geoapify vector tiles and automatic fallback to OpenStreetMap standard tiles and simulated Haversine matrices.
* **Driver Handheld Mobile App**: Mobile stop sequencing, Universal Google Maps turn-by-turn navigation deep-links, OTP handoff, digital signature pad, photo upload, and exception reporting.
* **Application-Wide Dark & Light Modes**: Seamless switching between daylight dispatching and low-glare nighttime driving with local persistence.
* **Bulk CSV Import**: High-volume consignment, vehicle, and driver CSV ingestion with dry-run schema validation and atomic commit.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: `>= 18.0.0` (LTS recommended)
* **MongoDB**: `>= 5.0.0` (Local service or MongoDB Atlas)
* **npm**: `>= 9.0.0`

### 1. Installation
Clone the repository and install all monorepo workspace dependencies:
```bash
git clone <repository-url>
cd "Last Mile Delivery Optimization"
npm install
```

### 2. Environment Configuration
Copy the sanitized environment template:
```bash
# Windows PowerShell
Copy-Item .env.example .env
Copy-Item .env.example server/.env
Copy-Item client/.env.example client/.env
```

### 3. Seed Canonical Dataset
Initialize the MongoDB database with the canonical Bhubaneswar dataset (55 consignments, 5 vehicles, 3 drivers, and demo accounts):
```bash
npm --prefix server run seed
```

### 4. Start the Application
Run both backend and frontend concurrently:
```bash
npm run dev
```

Open your browser at:
* **Frontend Cockpit**: `http://localhost:5174`
* **Backend API Base**: `http://localhost:5004/api/v1`
* **Health Probe**: `http://localhost:5004/api/v1/health/ready`

### Demo Credentials
| Persona | Email | Password | Quick Login |
|---|---|---|---|
| **Chief Admin** | `admin@example.com` | `admin123` | Click **Admin** on Login screen |
| **Fleet Manager** | `manager@example.com` | `manager123` | Click **Dispatcher** on Login screen |
| **Delivery Driver** | `driver@example.com` | `driver123` | Click **Driver** on Login screen |

---

## 🧪 Testing & Quality Gates

Run the full automated test suite (151 unit, integration, and security tests across 9 suites):
```bash
npm --prefix server test
```

Run frontend type checking and production build:
```bash
npm --prefix client run build
```

---

## 📚 Documentation Index

Comprehensive user guides and technical architecture documents are available in the [`docs/`](docs/README.md) directory:

### User Manuals
* [01 - Project Overview & System Architecture](docs/user-guide/01-PROJECT-OVERVIEW.md)
* [02 - Installation and Setup Guide](docs/user-guide/02-INSTALLATION-AND-SETUP.md)
* [03 - Chief Operations Admin Guide](docs/user-guide/03-ADMIN-GUIDE.md)
* [04 - Fleet Manager & Dispatcher Guide](docs/user-guide/04-FLEET-MANAGER-GUIDE.md)
* [05 - Route Planning & Optimization Guide](docs/user-guide/05-ROUTE-OPTIMIZATION-GUIDE.md)
* [06 - Maps & Google Maps Navigation Guide](docs/user-guide/06-MAPS-AND-NAVIGATION-GUIDE.md)
* [07 - Delivery Driver User Guide](docs/user-guide/07-DRIVER-GUIDE.md)
* [08 - Tracking, Telemetry & Analytics Guide](docs/user-guide/08-TRACKING-AND-ANALYTICS-GUIDE.md)
* [09 - Troubleshooting & Error Recovery Guide](docs/user-guide/09-TROUBLESHOOTING-GUIDE.md)
* [10 - Frequently Asked Questions (FAQ)](docs/user-guide/10-FAQ.md)

### Technical Reports & Audits
* [Project Completion Audit](docs/PROJECT_COMPLETION_AUDIT.md)
* [Feature Completion Matrix](docs/FEATURE_COMPLETION_MATRIX.md)
* [Interaction & Control Verification](docs/INTERACTION_VERIFICATION.md)
* [Production Readiness Report](docs/PRODUCTION_READINESS_REPORT.md)
* [Repository Cleanup & Hygiene Report](docs/REPOSITORY_CLEANUP_REPORT.md)
* [Dark & Light Mode Implementation](docs/DARK_MODE_IMPLEMENTATION.md)
* [Environment Configuration Reference](docs/ENVIRONMENT_CONFIGURATION.md)
* [Security & Adversarial Audit](docs/SECURITY_AUDIT.md)
* [Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
* [CI/CD Quality Gates Guide](docs/CI_CD_GUIDE.md)
* [Documentation Maintenance Protocol](docs/DOCUMENTATION_MAINTENANCE.md)
* [Core System Changelog](docs/CORE_CHANGELOG.md)
* [Final Project Completion Report](docs/FINAL_PROJECT_COMPLETION_REPORT.md)
