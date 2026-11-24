# Quick Task Plan: Remove Driver & Vehicle Edit/Delete Buttons for Fleet Manager

**Task Slug**: `261124-remove-driver-vehicle-edit-delete-buttons-for-fleet-manager`  
**Goal**: Restrict Driver and Vehicle Edit and Delete UI action buttons to Super Admins only (`ADMIN`), completely removing them for Fleet Managers (`FLEET_MANAGER`), and backing this up with backend API role enforcement.

---

## Proposed Changes

### 1. `client/src/pages/admin/DriversPage.tsx`
- Import `useAuth` from `../../context/AuthContext` and extract `const { isAdmin } = useAuth();`.
- Only render the `Actions` column in the drivers table when `isAdmin` is true. If `!isAdmin`, omit the Actions column completely (or if rendered, omit Edit and Delete buttons).
- Restrict bulk driver selection (`selectable={isAdmin}`) and sticky bulk deletion bar (`{isAdmin && selectedDriverIds.length > 0 && ...}`).

### 2. `client/src/pages/admin/FleetsPage.tsx`
- In `vehicleColumns`, wrap the `Edit` button with `{isAdmin && (...)}` and wrap the `Delete` button with `{isAdmin && (...)}`.
- Fleet managers retain operational buttons (`Maintenance` and `Retire`), but cannot see or click `Edit` or `Delete`.

### 3. `server/src/routes/driverRoutes.js`
- Align with `vehicleRoutes.js` (which already restricts `DELETE /:id` to `ROLES.ADMIN`):
  - Restrict `PUT /:id` (driver update) to `authorize(ROLES.ADMIN)`.
  - Restrict `DELETE /:id` (driver delete) to `authorize(ROLES.ADMIN)`.
  - Leave `POST /:id/assign` and `POST /:id/unassign` open to `ROLES.ADMIN, ROLES.FLEET_MANAGER` for operations.

### 4. Automated Tests
- Update `client/src/pages/admin/__tests__/DriversPageCrud.test.tsx` to verify:
  - Super Admin (`mockUsers.admin`) sees `Edit driver` and `Delete driver` action buttons.
  - Fleet Manager (`mockUsers.fleetManager`) does NOT see `Edit driver` or `Delete driver` buttons.
- Update/add test in `client/src/pages/admin/__tests__/FleetsPageBulkDelete.test.tsx` (or new test file) verifying:
  - Fleet Manager does NOT see `Edit` or `Delete` vehicle buttons in `FleetsPage`, but sees `Maintenance` and `Retire`.
  - Super Admin sees `Edit` and `Delete` vehicle buttons.
- Update `server/tests/security_url_bypass.test.js` to verify:
  - Fleet Manager direct API call `PUT /api/v1/drivers/:id` ➔ 403 Forbidden.
  - Fleet Manager direct API call `DELETE /api/v1/drivers/:id` ➔ 403 Forbidden.

---

## Verification Criteria
1. Client unit tests for DriversPage and FleetsPage pass 100%.
2. Client typecheck `tsc --noEmit` passes with 0 errors.
3. Backend test `tests/security_url_bypass.test.js` and `tests/driver_vehicle_crud.test.js` pass 100%.
