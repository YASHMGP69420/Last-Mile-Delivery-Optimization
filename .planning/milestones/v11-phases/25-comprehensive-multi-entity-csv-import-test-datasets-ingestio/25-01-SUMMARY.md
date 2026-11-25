# Plan 25-01 Summary: Comprehensive Multi-Entity CSV Import Test Datasets

## Overview
Generated high-density, production-validated sample CSV files named explicitly for their operational domain (`orders.csv`, `drivers.csv`, `vehicles.csv`), adhering strictly to the backend schemas and business validation rules. All customer and driver phone numbers use non-real test sequence numbers.

## Deliverables

### 1. `sample_data/csv/orders.csv` (50 Rows)
- **Target Entity:** Delivery / Consignment Manifest (`POST /api/v1/deliveries/import-csv`)
- **Headers:** `orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd,serviceDurationMinutes,latitude,longitude`
- **Phone Series:** Strictly non-real test sequence: `+91 99999 00001` through `+91 99999 00050`.
- **Geospatial & Zone Distribution:** Distributed across Patia (Z-1), Jaydev Vihar (Z-2), Saheed Nagar (Z-3), Khandagiri (Z-4), Chandrasekharpur, and Other, with accurate Bhubaneswar coordinates (~20.24–20.36 lat, ~85.78–85.88 lng), valid time windows, and package weights.

### 2. `sample_data/csv/drivers.csv` (20 Rows)
- **Target Entity:** Commercial Driver Roster (`POST /api/v1/drivers/import-csv`)
- **Headers:** `name,email,phone,licenseNumber,password`
- **Phone Series:** Strictly non-real test sequence: `+91 91111 00001` through `+91 91111 00020`.
- **Driver Profiles:** Realistic Indian full names, unique internal emails (`driver.test01@smartroute.internal` to `driver.test20@smartroute.internal`), commercial licenses (`OD-02-DL-2024-101` to `OD-02-DL-2024-120`), and standard test password `driver123`.

### 3. `sample_data/csv/vehicles.csv` (20 Rows)
- **Target Entity:** Fleet Vehicles (`POST /api/v1/vehicles/import-csv`)
- **Headers:** `vehicleId,makeModel,type,capacityKg,capacityM3,fuelType,kmPerLitre,energyKWhPerKm,tankCapacityLitres,lastOdometerKm,availability`
- **Fleet Mix:** 20 vehicles covering Bike, Van, and Truck models (Tata Ace Gold, Treo Zor EV, Hero Electric Nyx, Mahindra Bolero, Ashok Leyland Dost, Eicher Pro 2049, BharatBenz).
- **Powertrain Specs:** Strictly valid combustion (`kmPerLitre > 0`, empty energy) vs electric (`energyKWhPerKm > 0`, empty fuel mileage) specs.

## Verification
- Test Suite: `server/tests/sample_csv_datasets.test.js`
- 6/6 automated Jest tests passed with 0 errors:
  - `TC-CSV-ORDERS-1`: 50 valid orders parsed with 0 errors in dry-run mode.
  - `TC-CSV-ORDERS-2`: All 50 phone numbers verified as non-real test phones.
  - `TC-CSV-DRIVERS-1`: 20 commercial drivers parsed with 0 errors in dry-run mode.
  - `TC-CSV-DRIVERS-2`: All 20 phone numbers verified as non-real test phones.
  - `TC-CSV-VEHICLES-1`: 20 vehicles parsed with 0 errors in dry-run mode.
  - `TC-CSV-VEHICLES-2`: Vehicle combustion vs electric rules verified.
