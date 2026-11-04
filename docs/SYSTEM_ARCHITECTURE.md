# SYSTEM ARCHITECTURE

## Overview
The SmartRoute system follows a layered, service‑oriented architecture separating concerns between **frontend**, **backend API**, **optimization engine**, **mapping services**, **real‑time tracking**, and **analytics**.

```
React Web Client
  ├─ UI components (Tailwind + reusable design system)
  ├─ State management (React Query / Context)
  ├─ API layer (Axios) → Express REST API
  └─ Socket.IO client → Real‑time tracking gateway

Express API Server (Node.js)
  ├─ Controllers (HTTP request handling, auth, validation)
  ├─ Services (business logic, orchestration)
  ├─ Repositories (Mongoose models, MongoDB persistence)
  ├─ Optimization Service (pure algorithm modules)
  ├─ Mapping Service (Google Maps wrapper, caching)
  ├─ Tracking Service (Socket.IO server, location persistence)
  └─ Analytics Service (aggregation pipelines, report generation)

MongoDB Atlas
  ├─ Collections: users, drivers, vehicles, deliveries, batches, routes, tracking, notifications, reports, settings
  └─ Indexes for frequent queries (e.g., driverId, vehicleId, batchId)
```

## Key Architectural Rules (see `docs/03-architecture.txt`)
1. Controllers are thin – they authenticate, validate, and delegate to services.
2. Services contain all business rules; they are pure where possible.
3. All external provider calls (Google Maps, external APIs) occur **only** in service layer.
4. Socket.IO is used solely for broadcasting location updates; the REST API remains the source of truth.
5. Optimization algorithms are deterministic pure functions given a snapshot of inputs.
6. Audit events are emitted for every state‑changing request.

## Security & Reliability
- JWT authentication with short‑lived access tokens and refresh tokens.
- Role‑based access control enforced in middleware.
- Input validation using `express-validator`.
- Caching of geocode and matrix results with TTL based on traffic sensitivity.
- Fallback to deterministic demo traffic scenarios when live data unavailable.

