# Empirical Adversarial Challenge Report: CSV Ingestion, Batch Management & Boundary Conditions

**Author:** `teamwork_challenger_m1_2` (Empirical Challenger)  
**Date:** 2026-11-03  
**Scope:** Milestone 1 — CSV Ingestion, Batch Calculations, Boundary Values & Duplicate Defenses  
**Test Suite:** `server/tests/adversarial_csv_batch.test.js` (16 automated tests)  
**Verdict:** `VERDICT: REQUEST_CHANGES (failures found)`  

---

## 1. Executive Summary

An adversarial empirical challenge was conducted against the Milestone 1 implementation of CSV batch ingestion, delivery consignment validation, batch metric aggregation, payload capacity checks, and duplicate order reference defenses.

While the core functionality of dry-run non-persistence, capacity boundary calculation (1000.0 kg vs 1000.1 kg), negative/zero weight rejections, and duplicate order detection passed basic checks, deep adversarial stress-testing surfaced **two unhandled 500 server crashes** and **two integrity flaws** in `csvImportService.js` and `deliveryController.js`:
1. **Empty CSV text causes an unhandled 500 Internal Server Error** due to PapaParse `UndetectableDelimiter` throwing a raw `Error` instead of a sanitized client error (HTTP 400).
2. **Numeric data types in string fields (`phone`, `orderReference`, `address`) cause an uncaught `TypeError: ...trim is not a function`**, crashing the endpoint with HTTP 500 when JSON rows are imported.
3. **Precedence inversion between `req.body.dryRun` and `req.query.dryRun`**, where body parameters override URL query parameters and can trigger unintended commits or ignored flags.
4. **Distorted `invalidRows` metric in CSV import summary**, where `invalidRows` equals the total number of errors rather than unique row count.

---

## 2. Test Execution & Empirical Evidence

The adversarial test suite `server/tests/adversarial_csv_batch.test.js` was executed under `NODE_ENV=test` using Jest and MongoDB `smartroute_test`.

### 2.1 Verbatim Jest Execution Results

```text
PASS tests/adversarial_csv_batch.test.js (9.532 s)
  Adversarial Test Suite: CSV Ingestion, Batch Management & Boundary Conditions
    1. Malformed CSV Files & Schema Resilience
      √ ADV-CSV-1: Header mismatch (unrecognized columns) rejects all rows with field errors (414 ms)
      √ ADV-CSV-2: Non-numeric weights ("TEN kg", "abc", null) are caught and flagged (151 ms)
      √ ADV-CSV-3: Missing address triggers rejection; missing coordinates gracefully falls back to canonical hub (152 ms)
      √ ADV-CSV-4: Empty CSV string triggers unhandled 500 error due to PapaParse UndetectableDelimiter error (187 ms)
      √ ADV-CSV-5: 500-Row high-volume stress batch performance & precision (4352 ms)
      √ ADV-CSV-6: Numeric data types in string fields (phone, orderReference) cause uncaught TypeError in validateRow (152 ms)
    2. Dry-Run Integrity & Non-Persistence Proof
      √ ADV-DRY-1: Dry-run returns validation summary without writing to MongoDB (158 ms)
      √ ADV-DRY-2: Commit mode with validation errors aborts atomically without dirty writes (158 ms)
    3. Batch Capacity & Numerical Boundary Conditions
      √ ADV-BOUND-1: Exact vehicle capacity (1000.0 / 1000.0 kg) is validated and permitted (337 ms)
      √ ADV-BOUND-2: Overflow by 0.1 kg (1000.1 / 1000.0 kg) triggers overload detection (324 ms)
      √ ADV-BOUND-3: Zero-weight packages (0 kg) are rejected across CSV import, REST API, and Mongoose model (170 ms)
      √ ADV-BOUND-4: Negative weight packages (-0.1kg, -5kg) are rejected across all entry points (157 ms)
    4. Duplicate Order References & Collision Defenses
      √ ADV-DUP-1: Intra-file duplicate order references in CSV are rejected (145 ms)
      √ ADV-DUP-2: Case-insensitive intra-file duplicate references (#dup-case-01 vs #DUP-CASE-01) are caught (138 ms)
      √ ADV-DUP-3: Cross-system collision: CSV containing pre-existing database orderReference is flagged and rejected on commit (185 ms)
      √ ADV-DUP-4: Direct REST API POST /api/v1/deliveries with duplicate reference returns 409 Conflict (180 ms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        9.62 s
```

---

## 3. Detailed Empirical Findings & Vulnerabilities

### Finding 1 [HIGH]: Uncaught TypeError on Numeric Field Types in `validateRow` (500 Server Crash)
- **Observation:** In `server/src/services/csvImportService.js` lines 15-20, 30-35, 41-48, 53-59:
  ```javascript
  const customerPhone = (
    row.customerPhone ||
    row.phone ||
    row['Customer Phone'] ||
    row.customer_phone ||
    ''
  ).trim();
  ```
  When the client sends JSON rows containing numeric values (e.g., `{ phone: 9861012345 }` or `{ orderReference: 10492 }`), `.trim()` is called directly on a JavaScript Number primitive.
- **Empirical Proof:** Verified via `ADV-CSV-6` and direct Node execution:
  ```text
  TypeError: (row.customerPhone || row.phone || row.Customer Phone || row.customer_phone || "").trim is not a function
      at validateRow (server/src/services/csvImportService.js:48:6)
  ```
- **Blast Radius:** Any API client passing numbers in phone or order reference fields triggers an unhandled 500 error instead of a clean validation error.
- **Remediation:** Cast values to String before trimming:
  ```javascript
  String(row.customerPhone || row.phone || row['Customer Phone'] || row.customer_phone || '').trim();
  ```

---

### Finding 2 [MEDIUM]: Empty CSV String Triggers Unhandled 500 Internal Server Error
- **Observation:** In `server/src/services/csvImportService.js` lines 169-177:
  ```javascript
  const parseResult = Papa.parse(input.toString(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parseResult.errors && parseResult.errors.length > 0 && parseResult.data.length === 0) {
    throw new Error(`CSV Parsing failed: ${parseResult.errors[0].message}`);
  }
  ```
  When an empty string `""` or whitespace is passed via `Content-Type: text/csv`, PapaParse generates a delimiter error:
  `{ type: 'Delimiter', code: 'UndetectableDelimiter', message: "Unable to auto-detect delimiting character; defaulted to ','" }`.
  Because `parseResult.data.length === 0`, line 176 throws a raw `Error`.
  In `server/src/middleware/errorHandler.js`, raw `Error` defaults to `statusCode = 500` (`INTERNAL_SERVER_ERROR`).
- **Empirical Proof:** Verified via `ADV-CSV-4`:
  ```text
  POST /api/v1/deliveries/import-csv?dryRun=true with body: ""
  -> HTTP 500 { "success": false, "error": { "code": "INTERNAL_SERVER_ERROR", "message": "CSV Parsing failed: Unable to auto-detect delimiting character; defaulted to ','" } }
  ```
- **Blast Radius:** Users uploading an empty CSV file receive a server crash error (500) rather than a 400 Bad Request or a clean message indicating no records were found.
- **Remediation:**
  1. In `processCsvManifest`, check if `input.toString().trim().length === 0`, and return empty summary immediately (`totalRows: 0, validRows: 0, invalidRows: 0, errors: []`).
  2. If throwing parse errors, throw `new AppError(..., 400, 'MALFORMED_CSV')` so `errorHandler` returns HTTP 400 rather than 500.

---

### Finding 3 [MEDIUM]: Parameter Precedence Inversion Between Query and Body `dryRun`
- **Observation:** In `server/src/controllers/deliveryController.js` lines 251-253:
  ```javascript
  const dryRunParam = req.body && req.body.dryRun !== undefined
    ? req.body.dryRun
    : (req.query.dryRun !== undefined ? req.query.dryRun === 'true' : true);
  ```
- **Attack Scenario:** If a client invokes `POST /api/v1/deliveries/import-csv?dryRun=false` but the body includes `{ dryRun: true }` (or vice-versa), `req.body.dryRun` silently overrides the URL query parameter.
- **Blast Radius:** If a user specifies `?dryRun=true` to test safely, but an exported payload contains `dryRun: false`, consignments are permanently committed without confirmation!
- **Remediation:** Explicitly favor safety: if either query or body requests `dryRun === true`, dry run should take precedence; or query parameter should strictly override body parameter.

---

### Finding 4 [LOW]: Distorted `invalidRows` Metric Count in Validation Summary
- **Observation:** In `server/src/services/csvImportService.js` line 219:
  ```javascript
  invalidRows: allErrors.length,
  ```
- **Attack Scenario:** If a CSV contains 1 row with completely unrecognized headers, `validateRow` pushes 5 separate errors (missing reference, name, phone, address, weight).
  Summary output returns:
  `totalRows: 1, validRows: 0, invalidRows: 5`.
- **Blast Radius:** UI badges and progress bars calculate invalid row percentages as `invalidRows / totalRows = 500%`, confusing operators.
- **Remediation:** Track unique row indices with errors:
  ```javascript
  const uniqueInvalidRows = new Set(allErrors.map((e) => e.row)).size;
  ```

---

## 4. Robust Features Verified (Passed Under Stress)

1. **Intra-Batch & Case-Insensitive Duplicate Reference Catch:**
   - Intra-file duplicates (e.g. `#DUP-INTRA-01` repeated on line 2 and line 4) are caught during dry run and completely block commit (status 422).
   - Case-insensitive variations (`#dup-case-01` vs `#DUP-CASE-01`) are unified and caught.
2. **Cross-System DB Duplicate Key Defenses:**
   - Pre-existing database reference collision is intercepted during dry run and returns 422 on commit without dirty partial writes.
   - Direct REST API consignment creation returns 409 `DUPLICATE_KEY_CONFLICT`.
3. **Dry-Run Non-Persistence Isolation:**
   - In `dryRun: true` mode, exactly 0 database writes occur.
   - In `dryRun: false` mode with partial errors, atomic pre-validation prevents any consignment from entering the database.
4. **Boundary & Numerical Capacity Calculations:**
   - Exact capacity (1000.0 / 1000.0 kg): Successfully creates batch, computes 100.0% utilization, overload condition is `false`.
   - 0.1 kg Overflow (1000.1 / 1000.0 kg): Accurately triggers `isOverloaded = true` with 0.1 kg excess.
   - Zero-weight packages (0 kg): Rejected across CSV import, REST API (400 `INVALID_WEIGHT`), and Mongoose schema (`min: 0.01`).
   - Negative-weight packages (-0.1 kg, -5 kg): Rejected across CSV import, REST API, and Mongoose schema.
5. **500-Row High-Volume Batch Performance:**
   - Processed 500 valid delivery consignments in Bhubaneswar.
   - Dry run completed in < 50ms (service) / < 500ms (HTTP).
   - Commit completed in < 300ms (service) / < 4.5s (HTTP).
   - Batch metrics accurately aggregated: `totalDeliveries = 500`, and `totalWeightKg` matched floating-point sum with < 0.001 error.

---

## 5. Peer Findings Correlation

During full test suite execution, peer challenger `teamwork_challenger_m1_1` identified 4 additional failures in `server/tests/adversarial.test.js`:
1. `TC-ADV-STATE-5`: State machine bypass — deliveries in `DRAFT` status can be directly transitioned to `COMPLETED` via `POST /api/v1/deliveries/:id/complete` or `FAILED` via `/fail`.
2. `TC-ADV-STATE-7`: Terminal `COMPLETED` deliveries can be modified via `/fail` or `/assign`.
3. `TC-ADV-FLEET-3`: Concurrent driver binding does not cleanly unbind previous vehicles.
4. `TC-ADV-FLEET-4`: Driver concurrent assignment to two vehicles allows mutual binding conflicts.

---

## 6. Final Verdict

```
VERDICT: REQUEST_CHANGES (failures found)
```

The system demonstrates solid architectural scaffolding, but requires targeted fixes for:
1. `csvImportService.js`: String coercion on numeric fields to prevent uncaught `TypeError` (.trim).
2. `csvImportService.js`: Graceful handling of empty CSV string / file without throwing `UndetectableDelimiter` 500 error.
3. `deliveryController.js`: Consistent query parameter precedence for `dryRun`.
4. `csvImportService.js`: Correct calculation of `invalidRows` using unique row set.
5. State machine validation on `/complete` and `/fail` endpoints (preventing direct transition from `DRAFT`).
