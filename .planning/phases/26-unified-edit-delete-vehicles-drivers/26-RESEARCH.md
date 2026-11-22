# Phase 26: Unified Edit and Delete Management for Vehicles and Drivers — Research

## Problem Statement & Context
Fleet dispatchers and platform administrators require complete administrative lifecycle control over both fleet vehicles and commercial drivers.
Currently:
1. **Driver Management (`DriversPage.tsx`)**:
   - Only provides "Onboard Driver" (create) and "Import CSV".
   - The "Actions" column is a static non-interactive label: `<span className="text-[10px] text-on-surface-variant font-mono">Optimizer-assigned</span>`.
   - There is NO Edit modal or button to update a driver's name, email, phone, license number, or availability status.
   - There is NO Delete modal or button.
   - The backend `driverRoutes.js` lacks a `DELETE /api/v1/drivers/:id` endpoint.
   - `PUT /api/v1/drivers/:id` only updates `phone`, `availability`, and `rating`, without touching the linked `User` record's name or email.
2. **Fleet Vehicles (`FleetsPage.tsx`)**:
   - Has `openEditModal` and `setRetiringVehicle` ("Retire").
   - Lacks an explicit, clean "Delete Vehicle" action with confirmation modal and active operation guard checks.
3. **Safety & Cascade Guards**:
   - Deleting a driver or vehicle that is currently assigned to an active route or in transit must be protected by `assertNoActiveDriverOrVehicleOperations`, returning `409 ACTIVE_OPERATION_CONFLICT` with active route and delivery details.
   - When confirmed with `forceReassign: true`, `recoverDriverMishapCascade` rescues active deliveries to `READY` / `Urgent` priority and cleanly unpairs the vehicle and deletes the driver.

## Technical Architecture & Findings

### 1. Backend Driver Routes & Controller
- File: `server/src/routes/driverRoutes.js`
  - Needs `router.delete('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.deleteDriver);`
- File: `server/src/controllers/driverController.js`
  - Enhance `updateDriver`:
    - Accept `name`, `email`, `phone`, `licenseNumber`, `availability`, `rating`.
    - If `name` or `email` provided, update the linked `User` model (`driver.userId`).
    - Verify email uniqueness (excluding current user) and license uniqueness (excluding current driver).
    - Emit `driver:updated` socket event with updated driver data.
  - Implement `deleteDriver`:
    - Find driver by ID. If not found, throw 404.
    - Check active operations with `assertNoActiveDriverOrVehicleOperations({ driverIds: [driver._id], actionLabel: 'delete driver' })`.
    - If conflict and `req.query.forceReassign === 'true'` or `req.body.forceReassign === true`:
      - Execute `recoverDriverMishapCascade({ driverId: driver._id, actor: req.user, reason: 'DRIVER_ACCOUNT_DELETED' })`.
    - If driver has assigned vehicle, unpair: `vehicle.assignedDriverId = null`.
    - Delete Driver record: `await Driver.findByIdAndDelete(driver._id);`.
    - If user exists, delete or mark deleted: `await User.findByIdAndDelete(driver.userId);`.
    - Emit `driver:deleted` socket event to dispatch rooms.

### 2. Backend Vehicle Delete & Controller
- File: `server/src/controllers/vehicleController.js`
  - `deleteVehicle` already enforces `assertNoActiveDriverOrVehicleOperations`.
  - Add support for hard-delete when `permanent === true` and vehicle has no route history or active operations, otherwise soft-retire (`availability = RETIRED`).
  - Emit `vehicle:deleted` socket event.

### 3. Frontend API Client
- File: `client/src/api/client.ts`
  - Add to `FleetApi`:
    ```typescript
    updateDriver: async (id: string, data: { name?: string; email?: string; phone?: string; licenseNumber?: string; availability?: string }): Promise<ApiResponse<{ driver: Driver }>> => {
      const res = await apiClient.put(`/drivers/${id}`, data);
      return res.data;
    },
    deleteDriver: async (id: string, options?: { forceReassign?: boolean }): Promise<ApiResponse<{ message: string }>> => {
      const res = await apiClient.delete(`/drivers/${id}`, { params: { forceReassign: options?.forceReassign } });
      return res.data;
    },
    ```

### 4. UI Components
- **`DriversPage.tsx`**:
  - Add Edit Driver Modal (`showEditModal`, `editingDriver`, `handleSaveEdit`).
  - Add Delete Driver Modal (`showDeleteModal`, `deletingDriver`, `handleConfirmDelete`).
  - Integrate `ActiveOperationConflictModal` when backend returns 409 conflict, allowing one-click active order rescue & delete (`forceReassign: true`).
  - Replace static text in Actions column with Edit and Delete buttons.
- **`FleetsPage.tsx`**:
  - Ensure Edit and Delete buttons are clearly labeled and functional.
  - Dedicated Delete Vehicle Confirmation Modal with license plate check and operation conflict handling.
