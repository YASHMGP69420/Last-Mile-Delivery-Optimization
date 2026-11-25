# Phase 25: Comprehensive Multi-Entity CSV Import Test Datasets & Ingestion Validation — Research

## Overview & Scope
The platform provides bulk CSV ingestion for three primary operational entities:
1. **Orders / Consignments Manifest** (`orders.csv` — `POST /api/v1/deliveries/import-csv`)
2. **Commercial Drivers Roster** (`drivers.csv` — `POST /api/v1/drivers/import-csv`)
3. **Fleet Vehicles** (`vehicles.csv` — `POST /api/v1/vehicles/import-csv`)

The filenames are explicitly named according to their exact operational purpose:
- `orders.csv`
- `drivers.csv`
- `vehicles.csv`

To enable realistic manual and automated end-to-end testing, high-density sample CSV files with many rows (20–50+ records) must be constructed with valid schemas, accurate geospatial coordinates within Bhubaneswar, diverse vehicle and delivery constraints, and strictly non-real phone numbers.

---

## Detailed Entity Schemas & Validation Rules

### 1. Orders / Deliveries (`orders.csv` — 50 rows)
- **Parser Service:** `server/src/services/csvImportService.js` (`processCsvManifest`, `validateRow`)
- **Headers:**
  ```csv
  orderReference,customerName,customerPhone,customerEmail,street,city,zone,postalCode,weightKg,volumeM3,priority,timeWindowStart,timeWindowEnd,serviceDurationMinutes,latitude,longitude
  ```
- **Constraints & Format Rules:**
  - `orderReference`: Required, coerced to uppercase, unique across CSV and database (e.g., `#OD-BHUB-1001` through `#OD-BHUB-1050`).
  - `customerName`: Required string (min 1 char).
  - `customerPhone`: Required, matches `/^\+?[0-9\s\-()]{10,20}$/` with 10–15 digits. Strictly non-real dummy test numbers: `+91 99999 00001` through `+91 99999 00050`.
  - `customerEmail`: Optional valid email or empty string (e.g. `test.customer01@example.com`).
  - `street`: Required street address string.
  - `city`: Defaults to `Bhubaneswar`.
  - `zone`: Must be one of `BHUBANESWAR_ZONES`:
    - `Patia (Z-1)`
    - `Jaydev Vihar (Z-2)`
    - `Saheed Nagar (Z-3)`
    - `Khandagiri (Z-4)`
    - `Chandrasekharpur`
    - `Other`
  - `postalCode`: 6-digit pincode (`751024`, `751013`, `751007`, `751030`, `751016`).
  - `weightKg`: Strictly positive float (> 0).
  - `volumeM3`: Non-negative float (>= 0).
  - `priority`: One of `Standard`, `Urgent`, `Cold Chain`.
  - `timeWindowStart` & `timeWindowEnd`: Format `HH:mm`. Start time must strictly precede end time (e.g. `09:00` to `12:00`, `11:00` to `14:00`, `14:00` to `17:00`).
  - `serviceDurationMinutes`: Strictly positive integer (> 0, typically 5–20 minutes).
  - `latitude` & `longitude`: Float coordinates within the Bhubaneswar metro area (lat 20.24 to 20.36, lng 85.78 to 85.88).

### 2. Commercial Drivers (`drivers.csv` — 20 rows)
- **Parser Service:** `server/src/services/csvDriverImportService.js` (`processDriverCsv`, `validateRow`)
- **Headers:**
  ```csv
  name,email,phone,licenseNumber,password
  ```
- **Constraints & Format Rules:**
  - `name`: Required (min 2 characters).
  - `email`: Required valid email regex, unique across file and database (e.g., `driver.test01@smartroute.internal` through `driver.test20@smartroute.internal`).
  - `phone`: Required non-real dummy phone number (e.g., `+91 91111 00001` through `+91 91111 00020`).
  - `licenseNumber`: Commercial driving license number, unique across file and database (e.g., `OD-02-DL-2024-101` through `OD-02-DL-2024-120`).
  - `password`: Optional, defaults to `driver123`.

### 3. Fleet Vehicles (`vehicles.csv` — 20 rows)
- **Parser Service:** `server/src/services/csvVehicleImportService.js` (`processVehicleCsv`, `validateRow`)
- **Headers:**
  ```csv
  vehicleId,makeModel,type,capacityKg,capacityM3,fuelType,kmPerLitre,energyKWhPerKm,tankCapacityLitres,lastOdometerKm,availability
  ```
- **Constraints & Format Rules:**
  - `vehicleId`: Required, coerced to uppercase, unique across file and database (e.g., `OD-02-TX-1001` through `OD-02-TX-1020`).
  - `makeModel`: Required string (e.g., `Tata Ace Gold`, `Mahindra Treo Zor`, `Hero Electric Nyx`, `Ashok Leyland Dost`, `Eicher Pro 2049`).
  - `type`: Must be one of `Bike`, `Van`, `Truck`.
  - `capacityKg`: Strictly positive float (> 0).
  - `capacityM3`: Strictly positive float (> 0).
  - `fuelType`: Must be one of `Diesel`, `Petrol`, `Electric`.
  - `kmPerLitre`: Required for `Diesel` and `Petrol` (> 0); omitted/empty for `Electric`.
  - `energyKWhPerKm`: Required for `Electric` (> 0); omitted/empty for `Diesel` and `Petrol`.
  - `tankCapacityLitres`: Strictly positive float (> 0) for combustion vehicles.
  - `lastOdometerKm`: Non-negative float (>= 0).
  - `availability`: Must be one of `AVAILABLE`, `ASSIGNED`, `MAINTENANCE`, `RETIRED`.

---

## File Locations & UI Integration Architecture

1. **Storage Locations:**
   - `sample_data/csv/`: Root-level folder for CLI usage, automated tests, and git repository distribution.
     - `orders.csv` (50 rows)
     - `drivers.csv` (20 rows)
     - `vehicles.csv` (20 rows)
   - `client/public/sample_data/`: Static client assets enabling direct 1-click in-browser downloads from `/sample_data/orders.csv`, `/sample_data/drivers.csv`, `/sample_data/vehicles.csv`.
2. **UI Download Integration:**
   - `CsvImportModal.tsx`: Add a "Download orders.csv (50 Orders)" button.
   - `DriversPage.tsx`: Add a "Download drivers.csv (20 Drivers)" button.
   - `FleetsPage.tsx`: Add a "Download vehicles.csv (20 Vehicles)" button.
3. **Automated Verification:**
   - Dedicated Jest test suite: `server/tests/sample_csv_datasets.test.js`.
   - Runs dry-run validation against all three CSV files, asserting:
     - `totalRows` equals expected count.
     - `errors.length === 0`.
     - `created / validCount` equals `totalRows`.
     - Zero real phone numbers (all match test prefixes `+91 99999...` or `+91 91111...`).

---

## Pitfalls & Anti-Patterns to Avoid
1. **Never use real phone numbers:** All phone numbers must use designated dummy/test prefixes (`+91 99999 000XX` or `+91 91111 000XX`) to prevent unintentional SMS/OTP triggers or privacy leaks.
2. **Avoid duplicate orderReferences/vehicleIds/emails:** All identifiers within each sample file must be strictly unique.
3. **Honor Electric vs Combustion Constraints:**
   - `Electric` vehicles MUST have `energyKWhPerKm > 0` and leave `kmPerLitre` blank.
   - `Diesel`/`Petrol` vehicles MUST have `kmPerLitre > 0` and leave `energyKWhPerKm` blank.
4. **Time window ordering:** Ensure `timeWindowStart` is strictly earlier than `timeWindowEnd` in minutes (e.g. `09:00` to `12:00`).
