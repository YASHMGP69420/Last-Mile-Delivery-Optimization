---
phase: quick
plan: 261124-bulk-import-csv-near-purge
subsystem: admin-dev-tools
tags: [admin, danger-zone, bulk-import, csv, sample-data, vehicles, drivers, orders]
status: complete
requires: []
provides: [bulk-import-sample-csvs-endpoint, bulk-import-danger-zone-button]
affects: [DeveloperDangerZoneCard, adminController, adminRoutes, AdminApi]
tech-stack:
  added: []
  patterns: [modal-confirmation, background-bulk-ingestion, dependency-ordered-import]
key-files:
  created:
    - server/src/services/devBulkImportService.js
    - server/tests/dev_import_csv.test.js
  modified:
    - server/src/controllers/adminController.js
    - server/src/routes/adminRoutes.js
    - client/src/api/client.ts
    - client/src/components/admin/DeveloperDangerZoneCard.tsx
    - client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx
decisions:
  - "Added 'Bulk Import Sample CSVs' button styled in deep indigo adjacent to 'Purge All Operational Data' in Developer Danger Zone"
  - "Confirmation modal clearly details the 3 datasets to be imported (20 vehicles, 20 drivers, 50 orders) before execution"
  - "Backend endpoint POST /api/v1/admin/dev-import-sample-csvs executes imports in strict dependency order: vehicles first, drivers second, consignment deliveries third"
  - "Successful import notifies the user via toast and automatically triggers onPurged/onDataChanged callback to rehydrate Operations Control Center counters"
metrics:
  duration: 12m
  completed_date: "2026-11-24"
actuals:
  tasks: 2
  commits: 1
---

# Quick Task 261124: Bulk Import Sample CSVs Near Purge Button

A one-click "Bulk Import Sample CSVs" action and confirmation workflow has been integrated adjacent to the "Purge All Operational Data" button within the Developer Danger Zone on the Operations Control Center.

## Overview of Implemented Work

### 1. Server Service & Administrative Endpoint
- **`server/src/services/devBulkImportService.js`**:
  - Dynamically discovers the sample CSV manifests (`vehicles.csv`, `drivers.csv`, `orders.csv`) from `sample_data/csv/` or `client/public/sample_data/`.
  - Executes sequential, dependency-ordered ingestion using the existing platform import engines:
    1. `processVehicleCsv(vehiclesContent, { dryRun: false })`
    2. `processDriverCsv(driversContent, { dryRun: false, actor })`
    3. `processCsvManifest(ordersContent, { dryRun: false, actor, skipDuplicates: true })`
  - Returns structured counts: `{ vehiclesCount, driversCount, deliveriesCount, totalImported }`.
- **`server/src/controllers/adminController.js` & `server/src/routes/adminRoutes.js`**:
  - Added `POST /api/v1/admin/dev-import-sample-csvs` strictly restricted to `authenticate` + `authorize(ROLES.ADMIN)`.
- **`server/tests/dev_import_csv.test.js`**:
  - Comprehensive Jest test suite verifying 401 unauthenticated, 403 non-admin forbidden, and 200 admin success with database document assertions (3/3 passed).

### 2. Frontend Client & Danger Zone UI
- **`client/src/api/client.ts`**:
  - Added `AdminApi.bulkImportSampleCsvs()` returning the imported counts and status.
- **`client/src/components/admin/DeveloperDangerZoneCard.tsx`**:
  - Added an indigo `Bulk Import Sample CSVs` button (`<FileSpreadsheet />`) adjacent to the red `Purge All Operational Data` button.
  - Implemented a clean, accessible confirmation modal displaying the exact dataset contents (20 Fleet Vehicles, 20 Commercial Drivers, 50 Consignment Orders).
  - Provided interactive loading state with animated spinner during ingestion.
  - On completion, emits a green toast notification: `"Successfully imported sample datasets (20 vehicles, 20 drivers, 50 orders)"` and immediately invokes `onPurged?.()` to re-fetch and update all dashboard counters in `AdminControlCenterPage`.
- **`client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx`**:
  - Added tests for button rendering, modal open, and API call on confirm (7/7 passed).
