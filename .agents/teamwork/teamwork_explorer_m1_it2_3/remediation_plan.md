# Remediation Plan: CSV Ingestion Robustness, Type Coercion & Parameter Precedence

**Author:** `teamwork_explorer_m1_it2_3` (Explorer / Investigation)  
**Date:** 2026-11-03  
**Target Components:**
- `server/src/services/csvImportService.js`
- `server/src/controllers/deliveryController.js`
- `server/tests/adversarial_csv_batch.test.js`  
**Parent Task:** Milestone 1 — CSV Ingestion, Batch Management & Boundary Conditions  

---

## 1. Executive Summary

Empirical adversarial testing (`teamwork_challenger_m1_2`) revealed two unhandled HTTP 500 crashes and two business logic inconsistencies in the CSV batch ingestion pipeline:
1. **Numeric Type Coercion Crash (HTTP 500)**: Direct invocation of `.trim()` on numeric primitives (such as `{ phone: 9861012345 }` or `{ orderReference: 10492 }`) throws an uncaught `TypeError: ...trim is not a function`.
2. **Empty CSV Text Crash (HTTP 500)**: Uploading an empty CSV string `""` causes PapaParse to emit an `UndetectableDelimiter` error, throwing a generic unhandled `Error` which Express formats as HTTP 500 instead of a sanitized client error (HTTP 400 Bad Request).
3. **Query vs. Body `dryRun` Precedence Inversion**: The controller checked `req.body.dryRun` prior to `req.query.dryRun`, allowing a body payload to silently override a URL query parameter `?dryRun=true`, risking unintended database commits.
4. **Distorted `invalidRows` Metric Calculation**: `invalidRows` was computed using `allErrors.length`. If one row had 5 invalid fields, `invalidRows` was reported as 5 (exceeding `totalRows`), distorting operational dashboards.

This document outlines the root causes, exact code modifications, unified diffs, and verification procedures for the worker agent.

---

## 2. Issue Analysis & Remediation Strategies

### 2.1 Issue 1: Numeric Type Coercion Crash (HTTP 500)

#### Root Cause
In `server/src/services/csvImportService.js`:
- In `validateRow` (lines 15–20, 30–35, 41–48, 53–59, 65–71, 79–84, 90–95, 108, 114, 128, 132), string properties are trimmed using `(...).trim()`. When a client passes JSON objects with numeric types (e.g., `phone: 9861012345`, `orderReference: 10492`, `pincode: 751024`), JavaScript throws:
  ```text
  TypeError: (row.customerPhone || row.phone || ...).trim is not a function
  ```
- In `processCsvManifest` (lines 186–188), `incomingRefs` is extracted with:
  ```javascript
  const incomingRefs = rows
    .map((r) => (r.orderReference || r['Order Reference'] || r.order_reference || '').trim().toUpperCase())
    .filter(Boolean);
  ```
  If `r.orderReference` is numeric, this map function also crashes before row validation begins.

#### Remediation Strategy
1. Introduce a safe string helper `safeTrim(val, defaultVal = '')`:
   ```javascript
   const safeTrim = (val, defaultVal = '') => {
     if (val === undefined || val === null) {
       return defaultVal;
     }
     return String(val).trim();
   };
   ```
2. In `validateRow`, coerce every string field using `safeTrim(...)` prior to validation regexes, length checks, or `.toUpperCase()`.
3. In `processCsvManifest`, safely coerce `r.orderReference` in the `incomingRefs` mapping.

---

### 2.2 Issue 2: Empty CSV Text Crash (HTTP 500)

#### Root Cause
In `server/src/services/csvImportService.js`:
- When `input.toString()` is an empty string `""` or whitespace, PapaParse parses the text and encounters no delimiters or data rows, emitting an error:
  `{ type: 'Delimiter', code: 'UndetectableDelimiter', message: "Unable to auto-detect delimiting character; defaulted to ','" }`.
- Line 175 checks `parseResult.errors.length > 0 && parseResult.data.length === 0` and throws a generic `new Error(...)`.
- Because the thrown `Error` has no `statusCode`, `errorHandler.js` defaults to `500 INTERNAL_SERVER_ERROR`.

In `server/src/controllers/deliveryController.js`:
- `importCsvManifest` accepts `typeof req.body === 'string'`. If the user posts an empty body (`Content-Type: text/csv` with `""`), it passes `""` directly to `processCsvManifest`, triggering the 500 crash.

#### Remediation Strategy
1. **In `csvImportService.js`**:
   - Extract a safe CSV parser helper `parseCsv(csvText)`:
     ```javascript
     const parseCsv = (csvText) => {
       if (typeof csvText !== 'string' || !csvText.trim()) {
         return { data: [], errors: [] };
       }
       return Papa.parse(csvText, {
         header: true,
         skipEmptyLines: true,
         transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
       });
     };
     ```
   - If `parseResult` fails on malformed non-empty data, throw `new AppError(`CSV Parsing failed: ${parseResult.errors[0].message}`, 400, 'MALFORMED_CSV')` so `errorHandler` returns HTTP 400 instead of HTTP 500.
   - If `processCsvManifest` is invoked directly with empty text, return an empty summary cleanly:
     ```javascript
     { dryRun, totalRows: 0, validRows: 0, invalidRows: 0, validCount: 0, errorCount: 0, errors: [], preview: [] }
     ```
2. **In `deliveryController.js`**:
   - Check if `inputData` is an empty string:
     ```javascript
     if (typeof inputData === 'string' && !inputData.trim()) {
       throw new AppError('CSV content cannot be empty', 400, 'EMPTY_CSV_CONTENT');
     }
     ```
   - This guarantees HTTP 400 Bad Request with `{ message: "CSV content cannot be empty" }` as required.

---

### 2.3 Issue 3: Query vs. Body `dryRun` Precedence

#### Root Cause
In `server/src/controllers/deliveryController.js` lines 251–253:
```javascript
const dryRunParam = req.body && req.body.dryRun !== undefined
  ? req.body.dryRun
  : (req.query.dryRun !== undefined ? req.query.dryRun === 'true' : true);
```
- The body parameter evaluated before the query parameter. If a user provided `?dryRun=true` on the URL for safety, but an ingested JSON body contained `dryRun: false`, `req.body.dryRun` overrode the URL parameter and performed a database write.
- Also, valueless query parameters `?dryRun` (which Express parses as `req.query.dryRun === ''`) evaluated to `false` under `req.query.dryRun === 'true'`.

#### Remediation Strategy
1. Give URL query parameter strict precedence over body:
   ```javascript
   const isDryRun = req.query.dryRun !== undefined
     ? (req.query.dryRun === 'true' || req.query.dryRun === '')
     : (req.body && req.body.dryRun !== undefined
       ? (req.body.dryRun === true || req.body.dryRun === 'true')
       : true);
   ```
2. If `req.query.dryRun` is present:
   - `?dryRun=true` or `?dryRun` -> `true`
   - `?dryRun=false` -> `false`
3. If `req.query.dryRun` is not present:
   - If body defines `dryRun`, use its boolean value (`dryRun === true` or `'true'`).
   - If neither specifies `dryRun`, safely default to `true` (preserving `TC-DEL-5` contract where default import is dry-run).

---

### 2.4 Issue 4: `invalidRows` Metric Calculation

#### Root Cause
In `server/src/services/csvImportService.js` line 219:
```javascript
invalidRows: allErrors.length,
```
- A single invalid row with 5 validation errors produced `invalidRows: 5`.
- For a 1-row CSV, the response returned `totalRows: 1, validRows: 0, invalidRows: 5`.

#### Remediation Strategy
Calculate `invalidRows` as the count of distinct row numbers that have errors:
```javascript
const invalidRows = new Set(allErrors.map((e) => e.row)).size;
```
Keep `errorCount: allErrors.length` and `errors: allErrors` for complete field-level reporting.

---

## 3. Concrete Code Diffs

### 3.1 `server/src/services/csvImportService.js`

```diff
--- a/server/src/services/csvImportService.js
+++ b/server/src/services/csvImportService.js
@@ -1,13 +1,38 @@
 const Papa = require('papaparse');
 const Delivery = require('../models/Delivery');
 const DeliveryBatch = require('../models/DeliveryBatch');
+const { AppError } = require('../middleware/errorHandler');
 const { PRIORITY_LEVELS, BHUBANESWAR_ZONES, AUDIT_EVENT_TYPES, DELIVERY_STATUS } = require('../config/constants');
 const { recordAuditEvent } = require('./auditService');
 
 const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
 
 /**
+ * Safely coerces any value to trimmed string, falling back to defaultVal
+ */
+const safeTrim = (val, defaultVal = '') => {
+  if (val === undefined || val === null) {
+    return defaultVal;
+  }
+  return String(val).trim();
+};
+
+/**
+ * Safely parse CSV text into row objects without throwing UndetectableDelimiter
+ */
+const parseCsv = (csvText) => {
+  if (typeof csvText !== 'string' || !csvText.trim()) {
+    return { data: [], errors: [] };
+  }
+
+  return Papa.parse(csvText, {
+    header: true,
+    skipEmptyLines: true,
+    transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
+  });
+};
+
+/**
  * Validates a single row from the CSV manifest
  */
 const validateRow = (row, rowIndex, existingOrderRefs) => {
   const errors = [];
 
-  const orderReference = (
-    row.orderReference ||
-    row['Order Reference'] ||
-    row.order_reference ||
-    ''
-  ).trim().toUpperCase();
+  const rawOrderRef = (row.orderReference !== undefined && row.orderReference !== null)
+    ? row.orderReference
+    : (row['Order Reference'] !== undefined && row['Order Reference'] !== null)
+      ? row['Order Reference']
+      : (row.order_reference !== undefined && row.order_reference !== null)
+        ? row.order_reference
+        : '';
+  const orderReference = safeTrim(rawOrderRef).toUpperCase();
 
   if (!orderReference) {
     errors.push({ row: rowIndex, field: 'orderReference', message: 'Order reference is required' });
   } else if (existingOrderRefs.has(orderReference)) {
     errors.push({ row: rowIndex, field: 'orderReference', message: `Duplicate order reference '${orderReference}' in file` });
   } else {
     existingOrderRefs.add(orderReference);
   }
 
-  const customerName = (
-    row.customerName ||
-    row['Customer Name'] ||
-    row.customer_name ||
-    ''
-  ).trim();
+  const customerName = safeTrim(
+    row.customerName !== undefined && row.customerName !== null ? row.customerName :
+    row['Customer Name'] !== undefined && row['Customer Name'] !== null ? row['Customer Name'] :
+    row.customer_name
+  );
 
   if (!customerName) {
     errors.push({ row: rowIndex, field: 'customerName', message: 'Customer name is required' });
   }
 
-  const customerPhone = (
-    row.customerPhone ||
-    row.phone ||
-    row['Customer Phone'] ||
-    row.customer_phone ||
-    ''
-  ).trim();
+  const customerPhone = safeTrim(
+    row.customerPhone !== undefined && row.customerPhone !== null ? row.customerPhone :
+    row.phone !== undefined && row.phone !== null ? row.phone :
+    row['Customer Phone'] !== undefined && row['Customer Phone'] !== null ? row['Customer Phone'] :
+    row.customer_phone
+  );
 
   if (!customerPhone) {
     errors.push({ row: rowIndex, field: 'phone', message: 'Customer phone number is required' });
   }
 
-  const street = (
-    row.street ||
-    row.address ||
-    row.Address ||
-    row.Street ||
-    ''
-  ).trim();
+  const street = safeTrim(
+    row.street !== undefined && row.street !== null ? row.street :
+    row.address !== undefined && row.address !== null ? row.address :
+    row.Address !== undefined && row.Address !== null ? row.Address :
+    row.Street
+  );
 
   if (!street) {
     errors.push({ row: rowIndex, field: 'address', message: 'Street address is required' });
   }
 
-  const postalCode = (
-    row.postalCode ||
-    row['Postal Code'] ||
-    row.pincode ||
-    row.Pincode ||
-    '751024'
-  ).trim();
+  const postalCode = safeTrim(
+    row.postalCode !== undefined && row.postalCode !== null ? row.postalCode :
+    row['Postal Code'] !== undefined && row['Postal Code'] !== null ? row['Postal Code'] :
+    row.pincode !== undefined && row.pincode !== null ? row.pincode :
+    row.Pincode,
+    '751024'
+  );
 
   const weightRaw = row.weightKg !== undefined ? row.weightKg : (row['Weight (kg)'] || row.weight || row.weight_kg);
   const weightKg = parseFloat(weightRaw);
   if (isNaN(weightKg) || weightKg <= 0) {
     errors.push({ row: rowIndex, field: 'weightKg', message: 'Weight must be a positive number (> 0)' });
   }
 
-  const timeWindowStart = (
-    row.timeWindowStart ||
-    row['Time Window Start'] ||
-    row.time_window_start ||
-    '09:00'
-  ).trim();
+  const timeWindowStart = safeTrim(
+    row.timeWindowStart !== undefined && row.timeWindowStart !== null ? row.timeWindowStart :
+    row['Time Window Start'] !== undefined && row['Time Window Start'] !== null ? row['Time Window Start'] :
+    row.time_window_start,
+    '09:00'
+  );
 
   if (!TIME_REGEX.test(timeWindowStart)) {
     errors.push({ row: rowIndex, field: 'timeWindowStart', message: 'Start time window must be HH:mm (e.g. 09:00)' });
   }
 
-  const timeWindowEnd = (
-    row.timeWindowEnd ||
-    row['Time Window End'] ||
-    row.time_window_end ||
-    '17:00'
-  ).trim();
+  const timeWindowEnd = safeTrim(
+    row.timeWindowEnd !== undefined && row.timeWindowEnd !== null ? row.timeWindowEnd :
+    row['Time Window End'] !== undefined && row['Time Window End'] !== null ? row['Time Window End'] :
+    row.time_window_end,
+    '17:00'
+  );
 
   if (!TIME_REGEX.test(timeWindowEnd)) {
     errors.push({ row: rowIndex, field: 'timeWindowEnd', message: 'End time window must be HH:mm (e.g. 17:00)' });
   }
 
   // Check start < end
   if (TIME_REGEX.test(timeWindowStart) && TIME_REGEX.test(timeWindowEnd)) {
     if (timeWindowStart >= timeWindowEnd) {
       errors.push({ row: rowIndex, field: 'timeWindow', message: 'Start time window must precede end time window' });
     }
   }
 
-  let priority = (row.priority || row.Priority || 'Standard').trim();
+  let priority = safeTrim(
+    row.priority !== undefined && row.priority !== null ? row.priority : row.Priority,
+    'Standard'
+  );
   const validPriorities = Object.values(PRIORITY_LEVELS);
   if (!validPriorities.includes(priority)) {
     priority = PRIORITY_LEVELS.STANDARD;
   }
 
-  let zone = (row.zone || row.Zone || 'Other').trim();
+  let zone = safeTrim(
+    row.zone !== undefined && row.zone !== null ? row.zone : row.Zone,
+    'Other'
+  );
   if (!BHUBANESWAR_ZONES.includes(zone)) {
     zone = 'Other';
   }
 
   const latRaw = parseFloat(row.latitude || row.lat || row.Lat);
   const lngRaw = parseFloat(row.longitude || row.lng || row.Lng);
   const hasCoordinates = !isNaN(latRaw) && !isNaN(lngRaw);
 
   const deliveryData = {
     orderReference,
     customer: {
       name: customerName,
       phone: customerPhone,
-      email: (row.customerEmail || row['Customer Email'] || row.customer_email || '').trim() || null,
+      email: safeTrim(row.customerEmail || row['Customer Email'] || row.customer_email) || null,
     },
     address: {
       street,
-      city: (row.city || row.City || 'Bhubaneswar').trim(),
+      city: safeTrim(row.city || row.City, 'Bhubaneswar'),
       zone,
       postalCode,
     },
@@ -165,15 +198,13 @@ const processCsvManifest = async (input, options = {}) => {
   if (Array.isArray(input)) {
     rows = input;
   } else if (input && typeof input === 'object' && Array.isArray(input.rows)) {
     rows = input.rows;
   } else {
-    const parseResult = Papa.parse(input.toString(), {
-      header: true,
-      skipEmptyLines: true,
-      transformHeader: (h) => h.trim(),
-    });
+    const rawText = input ? input.toString() : '';
+    const parseResult = parseCsv(rawText);
 
     if (parseResult.errors && parseResult.errors.length > 0 && parseResult.data.length === 0) {
-      throw new Error(`CSV Parsing failed: ${parseResult.errors[0].message}`);
+      throw new AppError(`CSV Parsing failed: ${parseResult.errors[0].message}`, 400, 'MALFORMED_CSV');
     }
     rows = parseResult.data;
   }
@@ -183,7 +214,14 @@ const processCsvManifest = async (input, options = {}) => {
   // Check existing orderReferences in DB to avoid collisions
   const incomingRefs = rows
-    .map((r) => (r.orderReference || r['Order Reference'] || r.order_reference || '').trim().toUpperCase())
+    .map((r) => {
+      const raw = (r.orderReference !== undefined && r.orderReference !== null)
+        ? r.orderReference
+        : (r['Order Reference'] !== undefined && r['Order Reference'] !== null)
+          ? r['Order Reference']
+          : (r.order_reference !== undefined && r.order_reference !== null)
+            ? r.order_reference
+            : '';
+      return safeTrim(raw).toUpperCase();
+    })
     .filter(Boolean);
@@ -215,9 +253,10 @@ const processCsvManifest = async (input, options = {}) => {
+  const invalidRowsCount = new Set(allErrors.map((e) => e.row)).size;
+
   const summary = {
     dryRun,
     totalRows: rows.length,
     validRows: validDeliveriesData.length,
-    invalidRows: allErrors.length,
+    invalidRows: invalidRowsCount,
     validCount: validDeliveriesData.length,
     errorCount: allErrors.length,
     errors: allErrors,
     preview: validDeliveriesData.slice(0, 10),
   };
@@ -274,5 +313,6 @@ const processCsvManifest = async (input, options = {}) => {
 module.exports = {
   processCsvManifest,
   validateRow,
+  parseCsv,
 };
```

---

### 3.2 `server/src/controllers/deliveryController.js`

```diff
--- a/server/src/controllers/deliveryController.js
+++ b/server/src/controllers/deliveryController.js
@@ -248,9 +248,11 @@ const updateDelivery = async (req, res, next) => {
 const importCsvManifest = async (req, res, next) => {
   try {
-    const dryRunParam = req.body && req.body.dryRun !== undefined
-      ? req.body.dryRun
-      : (req.query.dryRun !== undefined ? req.query.dryRun === 'true' : true);
+    const isDryRun = req.query.dryRun !== undefined
+      ? (req.query.dryRun === 'true' || req.query.dryRun === '')
+      : (req.body && req.body.dryRun !== undefined
+        ? (req.body.dryRun === true || req.body.dryRun === 'true')
+        : true);
 
     const batchId = req.query.batchId || (req.body && req.body.batchId) || null;
 
@@ -264,11 +266,15 @@ const importCsvManifest = async (req, res, next) => {
     } else if (req.body && req.body.csvContent) {
       inputData = req.body.csvContent;
     } else {
       throw new AppError('CSV content must be provided as text body, JSON rows array, or file upload', 400, 'MISSING_CSV_CONTENT');
     }
 
+    if (typeof inputData === 'string' && !inputData.trim()) {
+      throw new AppError('CSV content cannot be empty', 400, 'EMPTY_CSV_CONTENT');
+    }
+
     const result = await processCsvManifest(inputData, {
-      dryRun: dryRunParam,
+      dryRun: isDryRun,
       batchId,
       actor: req.user,
     });
```

---

### 3.3 `server/tests/adversarial_csv_batch.test.js`

In `server/tests/adversarial_csv_batch.test.js`, tests `ADV-CSV-4` and `ADV-CSV-6` were originally authored to document and assert the existing 500 error bugs. After applying the fixes, these tests must be updated to assert the fixed behavior (HTTP 400 with `EMPTY_CSV_CONTENT` on empty CSV, graceful summary on service call, and HTTP 200 validation success on numeric values):

```diff
--- a/server/tests/adversarial_csv_batch.test.js
+++ b/server/tests/adversarial_csv_batch.test.js
@@ -104,24 +104,23 @@ describe('Adversarial Test Suite: CSV Ingestion, Batch Management & Boundary Con
-    test('ADV-CSV-4: Empty CSV string triggers unhandled 500 error due to PapaParse UndetectableDelimiter error', async () => {
+    test('ADV-CSV-4: Empty CSV string returns 400 Bad Request and service handles empty input gracefully', async () => {
       // 1. Missing body completely returns 400 MISSING_CSV_CONTENT
       const resMissing = await request(app)
         .post('/api/v1/deliveries/import-csv')
         .set('Authorization', `Bearer ${managerToken}`)
         .send({});
       expect(resMissing.status).toBe(400);
       expect(resMissing.body.error.code).toBe('MISSING_CSV_CONTENT');
 
-      // 2. Direct service call on completely empty CSV string throws Error
-      let emptyServiceError = null;
-      try {
-        await processCsvManifest('', { dryRun: true });
-      } catch (err) {
-        emptyServiceError = err;
-      }
-      expect(emptyServiceError).not.toBeNull();
-      expect(emptyServiceError.message).toMatch(/CSV Parsing failed: Unable to auto-detect delimiting character/i);
+      // 2. Direct service call on completely empty CSV string returns empty summary cleanly
+      const emptyServiceResult = await processCsvManifest('', { dryRun: true });
+      expect(emptyServiceResult.totalRows).toBe(0);
+      expect(emptyServiceResult.validRows).toBe(0);
+      expect(emptyServiceResult.invalidRows).toBe(0);
+      expect(emptyServiceResult.errors).toEqual([]);
 
-      // 3. Raw empty text/csv body to endpoint results in HTTP 500 instead of 400
+      // 3. Raw empty text/csv body to endpoint results in HTTP 400 Bad Request
       const resEmptyText = await request(app)
         .post('/api/v1/deliveries/import-csv?dryRun=true')
         .set('Authorization', `Bearer ${managerToken}`)
         .set('Content-Type', 'text/csv')
         .send('');
-      // Empirical observation: PapaParse error causes unhandled Error, resulting in 500
-      expect(resEmptyText.status).toBe(500);
-      expect(resEmptyText.body.error.code).toBe('INTERNAL_SERVER_ERROR');
+      expect(resEmptyText.status).toBe(400);
+      expect(resEmptyText.body.error.code).toBe('EMPTY_CSV_CONTENT');
+      expect(resEmptyText.body.error.message).toMatch(/CSV content cannot be empty/i);
 
       // 4. Header-only CSV is handled safely returning 0 rows
       const headerOnly = `orderReference,customerName,phone,address,weightKg\n`;
@@ -220,17 +219,23 @@ describe('Adversarial Test Suite: CSV Ingestion, Batch Management & Boundary Con
-    test('ADV-CSV-6: Numeric data types in string fields (phone, orderReference) cause uncaught TypeError in validateRow', async () => {
+    test('ADV-CSV-6: Numeric data types in string fields (phone, orderReference) are safely coerced without TypeError', async () => {
       // If a client sends numeric phone or numeric orderReference via JSON rows array
       const numericPhonePayload = {
         dryRun: true,
         rows: [
-          { orderReference: '#NUM-PHONE-01', customerName: 'Numeric Phone', phone: 9861012345, address: 'Patia', weightKg: 10 },
+          { orderReference: 10492, customerName: 'Numeric Ref & Phone', phone: 9861012345, address: 'Patia', weightKg: 10 },
         ],
       };
 
       const res = await request(app)
         .post('/api/v1/deliveries/import-csv')
         .set('Authorization', `Bearer ${managerToken}`)
         .send(numericPhonePayload);
 
-      // Empirical finding: uncaught TypeError causes 500 Internal Server Error instead of validation error
-      expect(res.status).toBe(500);
-      expect(res.body.error.message).toMatch(/trim is not a function/i);
+      expect(res.status).toBe(200);
+      expect(res.body.success).toBe(true);
+      expect(res.body.data.totalRows).toBe(1);
+      expect(res.body.data.validRows).toBe(1);
+      expect(res.body.data.invalidRows).toBe(0);
+      expect(res.body.data.preview[0].orderReference).toBe('10492');
+      expect(res.body.data.preview[0].customer.phone).toBe('9861012345');
     });
```

---

## 4. Verification & Validation Protocol

After the worker applies these changes:

1. **Adversarial Test Suite Run**:
   ```bash
   npm test -- server/tests/adversarial_csv_batch.test.js
   ```
   **Expected Outcome:** 16 tests passing, 0 failures, exit code 0. Specifically:
   - `ADV-CSV-4` passes with HTTP 400 Bad Request on empty CSV text.
   - `ADV-CSV-6` passes with HTTP 200 OK and safe string coercion of numeric phone and order reference.

2. **Deliveries Regression Test Run**:
   ```bash
   npm test -- server/tests/deliveries.test.js
   ```
   **Expected Outcome:** 10 tests passing, 0 failures, exit code 0. Specifically:
   - `TC-DEL-5` (dryRun default when omitted), `TC-DEL-6` (partial invalid errors and invalidRows count), and `TC-DEL-7` (commit mode with `dryRun: false`) must all pass cleanly.

3. **Full Server Test Suite Execution**:
   ```bash
   npm run test --workspace=server
   ```
   Ensure no collateral damage to vehicles, auth, batches, or routes.

---

## 5. Implementation Checklist for Worker Agent

- [ ] **Step 1:** In `server/src/services/csvImportService.js`:
  - [ ] Add `AppError` import from `../middleware/errorHandler`.
  - [ ] Add `safeTrim(val, defaultVal)` helper.
  - [ ] Add `parseCsv(csvText)` helper and export it.
  - [ ] In `validateRow`: safely coerce all string attributes (`orderReference`, `customerName`, `customerPhone`/`phone`, `street`/`address`, `postalCode`, `timeWindowStart`, `timeWindowEnd`, `priority`, `zone`, `city`, `customerEmail`).
  - [ ] In `processCsvManifest`: use `parseCsv` helper, return clean empty summary if parsed data is empty, throw `AppError` 400 on malformed CSV errors, safely coerce `orderReference` in `incomingRefs` mapping, and calculate `invalidRows` using `new Set(allErrors.map((e) => e.row)).size`.
- [ ] **Step 2:** In `server/src/controllers/deliveryController.js:importCsvManifest`:
  - [ ] Check if `typeof inputData === 'string' && !inputData.trim()`, throwing `new AppError('CSV content cannot be empty', 400, 'EMPTY_CSV_CONTENT')`.
  - [ ] Implement query vs. body precedence:
    `const isDryRun = req.query.dryRun !== undefined ? (req.query.dryRun === 'true' || req.query.dryRun === '') : (req.body && req.body.dryRun !== undefined ? (req.body.dryRun === true || req.body.dryRun === 'true') : true);`
  - [ ] Pass `dryRun: isDryRun` to `processCsvManifest`.
- [ ] **Step 3:** In `server/tests/adversarial_csv_batch.test.js`:
  - [ ] Update `ADV-CSV-4` assertions to test for HTTP 400 `EMPTY_CSV_CONTENT` and service empty result.
  - [ ] Update `ADV-CSV-6` assertions to test for HTTP 200 validation success with numeric fields coerced.
- [ ] **Step 4:** Execute test commands and verify 100% pass rate.
