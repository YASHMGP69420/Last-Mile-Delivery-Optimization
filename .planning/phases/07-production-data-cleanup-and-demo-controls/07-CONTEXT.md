# Phase 07 Context: Production Data Cleanup & Removable Prebuilt Demo Dataset Controls

**Date:** 2026-11-10  
**Status:** Locked Decisions from `/gsd-discuss-phase`

## Locked Decisions

1. **Production Database Hygiene & Initial Wipe**:
   - Keep **only** the two real operator accounts:
     - `mishrayashaswee6@gmail.com` (`ADMIN`)
     - `yashasweemishra7@gmail.com` (`DRIVER`, preserving its linked `Driver` profile)
   - Remove all seeded/test/legacy users (`@example.com`, `@smartroute.live`, `@smartroute.internal`, seeded `@smartroute.io` accounts) and wipe all current seeded/dummy `vehicles`, `drivers` (except any linked to kept real drivers), `deliveries`, `deliverybatches`, `routes`, `auditevents`, `fleets`, and `notifications`.
   - Ensure server startup never auto-seeds dummy records; remove hardcoded legacy quick-demo credentials (`admin123`, `manager123`, `driver123`) from `server/src/seed/seedBhubaneswar.js` (refactor into a clean production CLI/bootstrap helper or deprecate safely).

2. **Isolated, Removable Prebuilt Demo Controls (Admin Control Center)**:
   - Place a clean, self-contained **Prebuilt Demo Dataset** utility panel inside [AdminControlCenterPage.tsx](file:///c:/Users/Yash/Documents/ChatGPT/Last%20Mile%20Delivery%20Optimization/client/src/pages/admin/AdminControlCenterPage.tsx) visible **only** to `ADMIN` users (`user?.role === 'ADMIN'`).
   - Isolate backend and frontend files cleanly (`demoDataService.js`, `demoDataController.js`, `demoDataRoutes.js`, `DemoDatasetPanel.tsx`) so the entire feature can later be deleted cleanly with zero side-effects on production endpoints.

3. **Non-Destructive Demo Tagging (`isDemoData: true`)**:
   - Add `isDemoData: { type: Boolean, default: false, index: true }` to `User`, `Driver`, `Vehicle`, `Delivery`, `DeliveryBatch`, `Route`, `AuditEvent`, and `Fleet`.
   - **Import Prebuilt Demo Data** creates a curated realistic Bhubaneswar sample dataset (demo Fleet Manager, demo Drivers, demo Vehicles, demo Consignments, demo Batch) with every document flagged `isDemoData: true`. Guards against duplicate imports (`409` or idempotent status count).
   - **Delete Demo Data** executes strict `deleteMany({ isDemoData: true })` across operational collections, never touching real production orders, real vehicles, real drivers, or the sole Admin account.
   - **Zero-crash empty states**: Confirm all Admin, Fleet, Analytics, Tracking, Batches, Deliveries, and Driver views render clean empty states (`0` metrics, helpful empty messages, zero `NaN`/division-by-zero) when `deliveries = []`, `routes = []`, `vehicles = []`, `drivers = []`.

4. **CSV Formatting Templates Preserved**:
   - Keep `"Load Sample Manifest"` / `"Load Template Sample"` buttons in `CsvImportModal.tsx`, `DriversPage.tsx`, and `FleetsPage.tsx` strictly as opt-in user-triggered CSV formatting helpers.
