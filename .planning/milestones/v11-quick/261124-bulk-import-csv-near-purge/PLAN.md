---
phase: quick
plan: 261124-bulk-import-csv-near-purge
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/services/devBulkImportService.js
  - server/src/controllers/adminController.js
  - server/src/routes/adminRoutes.js
  - server/tests/dev_import_csv.test.js
  - client/src/api/client.ts
  - client/src/components/admin/DeveloperDangerZoneCard.tsx
  - client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Admin endpoint POST /api/v1/admin/dev-import-sample-csvs exists, requires ADMIN authorization, and sequentially bulk-imports vehicles.csv, drivers.csv, and orders.csv"
    - "AdminApi client exports bulkImportSampleCsvs() calling the endpoint and returning imported counts"
    - "DeveloperDangerZoneCard renders a 'Bulk Import Sample CSVs' button adjacent to the 'Purge All Operational Data' button"
    - "Clicking Bulk Import opens a modal confirming the sample datasets, displays loading state during import, displays success feedback upon completion, and calls onPurged to refresh the operations dashboard"
  artifacts:
    - server/src/services/devBulkImportService.js
    - server/tests/dev_import_csv.test.js
    - client/src/components/admin/DeveloperDangerZoneCard.tsx
    - client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx
  key_links:
    - "DeveloperDangerZoneCard button triggers AdminApi.bulkImportSampleCsvs and refreshes dashboard via onPurged"
    - "adminRoutes mounts /dev-import-sample-csvs under authenticate and authorize(ROLES.ADMIN)"
---

<objective>
Implement a one-click 'Bulk Import Sample CSVs' button adjacent to the 'Purge All Operational Data' button in the Developer Danger Zone on the Operations Control Center.

Purpose: Enable developers and administrators to instantly repopulate an empty or freshly purged database with realistic Bhubaneswar test datasets (20 fleet vehicles, 20 drivers with user logins, and 50 delivery orders) directly from the danger zone without navigating between separate tables.
Output: Backend bulk import service and admin route, client API integration, DeveloperDangerZoneCard UI enhancements, and automated backend/frontend test suites.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@server/src/services/devPurgeService.js
@server/src/controllers/adminController.js
@server/src/routes/adminRoutes.js
@client/src/components/admin/DeveloperDangerZoneCard.tsx
@client/src/pages/admin/AdminControlCenterPage.tsx
@client/src/api/client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend Dev Bulk Import Service, Admin Route and Jest Test Suite</name>
  <files>server/src/services/devBulkImportService.js, server/src/controllers/adminController.js, server/src/routes/adminRoutes.js, server/tests/dev_import_csv.test.js</files>
  <action>
    1. Create server/src/services/devBulkImportService.js:
       - Locates the sample CSV datasets on disk (checks sample_data/csv/ and client/public/sample_data/ for vehicles.csv, drivers.csv, orders.csv).
       - Imports in dependency order:
         a. Vehicles: processVehicleCsv(vehiclesCsv, { dryRun: false })
         b. Drivers: processDriverCsv(driversCsv, { dryRun: false, actor })
         c. Consignments: processCsvManifest(ordersCsv, { dryRun: false, actor, skipDuplicates: true })
       - Returns a structured summary: { vehiclesCount, driversCount, deliveriesCount, totalImported }.
    2. In server/src/controllers/adminController.js:
       - Implement devImportSampleCsvs calling devBulkImportService.bulkImportSampleData(req.user).
    3. In server/src/routes/adminRoutes.js:
       - Wire router.post('/dev-import-sample-csvs', adminController.devImportSampleCsvs) guarded under authorize(ROLES.ADMIN).
    4. Create server/tests/dev_import_csv.test.js:
       - Test 401 unauthorized on missing token.
       - Test 403 forbidden on DRIVER or non-admin roles.
       - Test 200 on ADMIN call returning { success: true, data: { vehiclesCount: 20, driversCount: 20, deliveriesCount: 50 } }.
  </action>
  <verify>
    <automated>npm --prefix server test -- tests/dev_import_csv.test.js</automated>
    <fails_when>Jest tests fail or sample CSVs cannot be imported</fails_when>
  </verify>
  <done>
    Backend bulk import service and admin route are active and verified by Jest tests.
  </done>
</task>

<task type="auto">
  <name>Task 2: Client API Method, DeveloperDangerZoneCard UI Button & Vitest Suite</name>
  <files>client/src/api/client.ts, client/src/components/admin/DeveloperDangerZoneCard.tsx, client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx</files>
  <action>
    1. In client/src/api/client.ts:
       - Add bulkImportSampleCsvs to AdminApi calling POST /admin/dev-import-sample-csvs.
    2. In client/src/components/admin/DeveloperDangerZoneCard.tsx:
       - Add a "Bulk Import Sample CSVs" button styled in deep indigo/violet adjacent to the red "Purge All Operational Data" button.
       - Include a confirmation modal outlining the datasets to be imported:
         * 20 Fleet Vehicles (EVs, Vans, Bikes, Trucks)
         * 20 Commercial Drivers (with credentials & license classes)
         * 50 Consignment Orders (Bhubaneswar delivery addresses & coordinates)
       - Handle loading state with spinner ("Importing Sample Datasets...").
       - On success:
         * Trigger toast.success('Successfully imported sample datasets (20 vehicles, 20 drivers, 50 orders)').
         * Call onPurged?.() to refresh the parent dashboard counters.
       - Catch errors and display toast.error with friendly error message.
    3. In client/src/components/admin/__tests__/DeveloperDangerZone.test.tsx:
       - Add tests verifying the "Bulk Import Sample CSVs" button renders.
       - Test clicking it opens the modal and confirming triggers AdminApi.bulkImportSampleCsvs and onPurged callback.
    4. Run client tests and TypeScript check:
       - npm --prefix client run test:unit -- DeveloperDangerZone
       - npm --prefix client test (tsc --noEmit)
  </action>
  <verify>
    <automated>npm --prefix client run test:unit -- DeveloperDangerZone</automated>
    <fails_when>Vitest tests fail or TypeScript errors occur</fails_when>
  </verify>
  <done>
    Developer Danger Zone renders Bulk Import button near Purge button with modal confirmation and tests pass.
  </done>
</task>

</tasks>

<verification>
Automated verification:
- npm --prefix server test -- tests/dev_import_csv.test.js
- npm --prefix client run test:unit -- DeveloperDangerZone
- npm --prefix client test
</verification>

<success_criteria>
Admin can bulk import realistic test CSVs in one click directly from the Developer Danger Zone, repopulating vehicles, drivers, and deliveries with live dashboard refresh.
</success_criteria>

<output>
Create .planning/quick/261124-bulk-import-csv-near-purge/SUMMARY.md
</output>
