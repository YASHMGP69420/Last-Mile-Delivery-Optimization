# Phase 28: Multi-Depot Vehicle Routing (MDVRP) & Multi-Hub Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 28-Multi-Depot Vehicle Routing (MDVRP) & Multi-Hub Management
**Areas discussed:** Hub Data Model & Management, Vehicle & Order Assignment, Route Topology & Return Behavior, Map Visuals & Dispatcher Filtering

---

## Hub / Depot Data Model & Management

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 'Hub' Model | Dedicated 'Hub' database model with full Admin CRUD (Name, Code, Address, Lat/Lng coordinates, contact info) and pre-seeded Bhubaneswar logistics hubs | ✓ |
| OrganizationSettings | Store hubs in OrganizationSettings without a separate model | |
| Preset static config | Preset list of static hubs in application configuration without dynamic CRUD | |

**User's choice:** Dedicated 'Hub' database model with full Admin CRUD.

---

## Consignment & Vehicle Hub Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Home Hub + Auto-Clustering | Vehicles have an assigned Home Hub, and orders auto-cluster to their nearest hub during batch creation (with manual override) | ✓ |
| Manual assignment | Dispatchers explicitly pick the originating hub for each delivery batch and vehicle | |
| Fully dynamic | Vehicles can dispatch from any hub based on daily workload | |

**User's choice:** Vehicles have an assigned Home Hub, and orders auto-cluster to their nearest hub during batch creation (with manual override).

---

## Route Topology & Return Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Closed-loop tour | Vehicle departs from its origin hub and returns to the same hub after completing deliveries | ✓ |
| Open tour | Vehicle departs from origin hub and ends at the final delivery stop without returning | |
| Flexible return | Vehicle returns to whichever hub is closest to the final delivery stop | |

**User's choice:** Closed-loop tour.

---

## Map Visuals & Dispatcher Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Hubs Tab & Pins | Dedicated 'Hubs' tab in Fleet Management with CRUD modal, custom warehouse icons on Leaflet maps, and a Hub filter on Batches & Live Tracking | ✓ |
| Standalone Page | Standalone 'Logistics Hubs' page in main navigation with full dashboard analytics per hub | |
| Admin Settings Card | Simple Hubs configuration card inside Admin Settings without dedicated map visuals | |

**User's choice:** Dedicated 'Hubs' tab in Fleet Management with CRUD modal, custom warehouse icons on Leaflet maps, and a Hub filter on Batches & Live Tracking.

---

## Deferred Ideas
- Inter-hub trunking routes (transferring freight between regional warehouses) deferred to future supply-chain expansion phase.
