---
phase: quick
plan: 261122-rq1-add-multi-select-to-delete-to-all-the-ta
subsystem: ui-tables-bulk-actions
tags: [tables, bulk-delete, multi-select, deliveries, drivers, fleet, user-management]
status: complete
requires: []
provides: [multi-select-table-rows, bulk-delete-manifest, bulk-delete-drivers, bulk-delete-fleet, bulk-delete-users]
affects: [ManifestTable, Table, UserTable, DeliveriesPage, DriversPage, FleetsPage, UserManagementPage]
tech-stack:
  added: []
  patterns: [indeterminate-checkbox-selection, sticky-bulk-actions-toolbar, protected-bulk-operations]
key-files:
  created:
    - client/src/components/deliveries/__tests__/ManifestTableBulkDelete.test.tsx
    - client/src/components/common/__tests__/TableSelection.test.tsx
    - client/src/pages/admin/__tests__/FleetsPageBulkDelete.test.tsx
    - client/src/components/admin/__tests__/UserTableBulkDelete.test.tsx
  modified:
    - client/src/components/deliveries/ManifestTable.tsx
    - client/src/pages/DeliveriesPage.tsx
    - client/src/components/common/Table.tsx
    - client/src/pages/admin/DriversPage.tsx
    - client/src/pages/admin/FleetsPage.tsx
    - client/src/components/admin/UserTable.tsx
    - client/src/pages/admin/UserManagementPage.tsx
    - client/src/pages/admin/__tests__/DriversPageCrud.test.tsx
    - client/src/components/admin/UserManagementPage.test.tsx
decisions:
  - "Common Table component provides native selectable rows with indeterminate header checkbox and getRowId resolution"
  - "Deliveries manifest table features red/destructive 'Delete Selected ({N})' button in sticky bar with modal confirmation and DeliveriesApi execution"
  - "Drivers table guards bulk deletion against active route/shift operations with conflict logging and toast notification"
  - "Fleets table provides permanent database expunge toggle alongside default soft-retire (availability = RETIRED)"
  - "User management table filters out authenticated user to prevent self-deletion lockout and catches LAST_ADMIN_PROTECTED errors"
metrics:
  duration: 15m
  completed_date: "2026-11-22"
actuals:
  tasks: 3
  commits: 3
  plan_head_before: "7e60af1eb2c9f9d0916765c70bbec28aa6ba50b4"
  plan_head_after: "ca7e7f35b4c1070e17ee92a715a31a90c5a2cbb9"
---

# Quick Task 261122-rq1: Multi-Select Bulk Deletion Across All Administrative Tables

Multi-select checkboxes, sticky bulk actions toolbars, confirmation dialogs, and protected bulk deletion endpoints have been implemented across all four core administrative tables: Deliveries Manifest, Drivers, Fleet Vehicles, and User Management.

## Overview of Implemented Work

### 1. Deliveries Manifest Bulk Deletion
- **ManifestTable.tsx**: Extended `ManifestTableProps` with optional `onDeleteSelected?: (selectedIds: string[]) => void`. When consignments are selected, a destructive "Delete Selected ({N})" button with `Trash2` icon is presented alongside batch composition tools in the sticky bulk actions toolbar.
- **DeliveriesPage.tsx**: Added `isBulkDeleteModalOpen`, `isBulkDeleting`, and `bulkDeleteError` state. Confirmation modal clearly warns the dispatcher of permanent queue removal. Deletions execute concurrently via `DeliveriesApi.delete` (`Promise.allSettled`) with success/failure feedback popups and automatic manifest refresh.

### 2. Common Table Component & Fleet/Driver Bulk Actions
- **Table.tsx**: Extended generic table with `selectable`, `selectedIds`, `onToggleSelect`, `onSelectAll`, and `getRowId` props. Header renders an indeterminate select-all checkbox; rows render individual selection checkboxes.
- **DriversPage.tsx**: Wired `selectedDriverIds` state to Table. Sticky toolbar shows count and triggers a bulk deletion modal. Active operation conflicts (`ACTIVE_OPERATION_CONFLICT`) are caught gracefully and reported via toast notifications to prevent corrupting in-flight missions.
- **FleetsPage.tsx**: Wired `selectedVehicleIds` state to Table. Sticky toolbar triggers a decommissioning modal featuring a permanent database removal toggle alongside the default soft-retire (`availability = RETIRED`) mode.

### 3. User Management Protected Bulk Deletion
- **UserTable.tsx**: Added checkbox selection column at index 0 and a sticky bulk actions toolbar with count and "Delete Selected" action.
- **UserManagementPage.tsx**: Wired selection state and implemented protected bulk deletion modal. Self-deletion of the currently authenticated administrator (`user?.id`) is automatically filtered out and flagged in an alert banner. Deletions safely catch `LAST_ADMIN_PROTECTED` responses to prevent administrative lockout.

## Automated Verification

- `npm --prefix client test` (`tsc --noEmit`): Passed with zero typecheck errors.
- `npm --prefix client run test:unit`: All 21 test suites (114 unit tests) passed cleanly without regressions, including new unit test suites:
  - `ManifestTableBulkDelete.test.tsx`
  - `TableSelection.test.tsx`
  - `DriversPageCrud.test.tsx` (bulk delete suite)
  - `FleetsPageBulkDelete.test.tsx`
  - `UserTableBulkDelete.test.tsx`
  - `UserManagementPage.test.tsx` (bulk delete & self-protection suite)

## Deviations from Plan

None - plan executed exactly as specified.

## Self-Check: PASSED
- [x] All 7 modified files and 4 new test files exist and compile
- [x] All 3 task commits exist in git history (`144afa6`, `0e78cbb`, `ca7e7f3`)
- [x] Verification test commands run cleanly
