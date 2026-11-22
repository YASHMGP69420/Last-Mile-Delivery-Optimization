---
status: passed
phase: 25-comprehensive-multi-entity-csv-import-test-datasets-ingestio
date: 2026-11-22
must_haves_score: 3/3
---

# Phase 25 Verification: Multi-Entity CSV Import Test Datasets

## Verdict: PASSED

All must-haves verified. All 3 sample CSV datasets exist, contain high row density (50 orders, 20 drivers, 20 vehicles), use strictly non-real dummy phone numbers, and pass backend dry-run schema and business validation with 0 errors.

## Must-Haves Verification

1. **High-density CSV datasets exist for Orders (50 rows), Drivers (20 rows), and Vehicles (20 rows):**
   - `sample_data/csv/orders.csv`: 50 rows (headers: orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd,serviceDurationMinutes,latitude,longitude)
   - `sample_data/csv/drivers.csv`: 20 rows (headers: name,email,phone,licenseNumber,password)
   - `sample_data/csv/vehicles.csv`: 20 rows (headers: vehicleId,makeModel,type,capacityKg,capacityM3,fuelType,kmPerLitre,energyKWhPerKm,tankCapacityLitres,lastOdometerKm,availability)
   - Status: **PASSED**

2. **Non-Real Phone Numbers across all datasets:**
   - `orders.csv`: Customer phones strictly match `+91 99999 00001` through `+91 99999 00050`.
   - `drivers.csv`: Driver phones strictly match `+91 91111 00001` through `+91 91111 00020`.
   - Status: **PASSED**

3. **Backend Schema & Dry-Run Ingestion Validation:**
   - Tested with `server/tests/sample_csv_datasets.test.js` against `processCsvManifest`, `processDriverCsv`, and `processVehicleCsv`.
   - 6/6 test cases passing with 0 errors:
     - `TC-CSV-ORDERS-1`: 50 valid orders, 0 errors, dryRun: true.
     - `TC-CSV-ORDERS-2`: Non-real customer phone format verified.
     - `TC-CSV-DRIVERS-1`: 20 commercial drivers, 0 errors, dryRun: true.
     - `TC-CSV-DRIVERS-2`: Non-real driver phone format verified.
     - `TC-CSV-VEHICLES-1`: 20 fleet vehicles, 0 errors, dryRun: true.
     - `TC-CSV-VEHICLES-2`: Vehicle combustion vs electric rules verified.
   - Status: **PASSED**
