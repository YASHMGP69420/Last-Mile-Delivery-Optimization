---
phase: quick
plan: 261122-rq1-add-multi-select-to-delete-to-all-the-ta
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/deliveries/ManifestTable.tsx
  - client/src/pages/DeliveriesPage.tsx
  - client/src/components/common/Table.tsx
  - client/src/pages/admin/DriversPage.tsx
  - client/src/pages/admin/FleetsPage.tsx
  - client/src/components/admin/UserTable.tsx
  - client/src/pages/admin/UserManagementPage.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Deliveries manifest table presents a 'Delete Selected ({N})' button in the sticky bulk actions bar that triggers a confirmation modal and bulk-deletes selected consignments via DeliveriesApi"
    - "Drivers admin table supports row and select-all checkboxes with a sticky bulk actions bar, confirmation modal, and bulk-deletion via FleetApi with conflict handling"
    - "Fleet vehicles admin table supports row and select-all checkboxes with a sticky bulk actions bar, confirmation modal for soft-retire or permanent delete, and execution via FleetApi"
    - "User management table supports row and select-all checkboxes with a sticky bulk actions bar and safe bulk-deletion via AdminUserApi preventing deletion of own account and the last admin"
  artifacts:
    - client/src/components/deliveries/ManifestTable.tsx
    - client/src/pages/DeliveriesPage.tsx
    - client/src/components/common/Table.tsx
    - client/src/pages/admin/DriversPage.tsx
    - client/src/pages/admin/FleetsPage.tsx
    - client/src/components/admin/UserTable.tsx
    - client/src/pages/admin/UserManagementPage.tsx
  key_links:
    - "Table.tsx selection state wired to DriversPage and FleetsPage action handlers"
    - "UserTable row selection state wired to UserManagementPage bulk delete handler"
---

<objective>
Implement multi-select checkboxes and bulk deletion workflows across all core administrative data tables: Deliveries Manifest, Drivers, Fleet Vehicles, and User Management.

Purpose: Allow dispatchers and administrators to select multiple records at once (or all records via header toggle) and execute bulk deletion with explicit confirmation dialogs, safety guards (preventing self-deletion and active route conflicts), and immediate visual feedback.
Output: Updated UI components with row selection, sticky bulk action toolbars, confirmation modals, and API client integrations.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/src/components/deliveries/ManifestTable.tsx
@client/src/pages/DeliveriesPage.tsx
@client/src/components/common/Table.tsx
@client/src/pages/admin/DriversPage.tsx
@client/src/pages/admin/FleetsPage.tsx
@client/src/components/admin/UserTable.tsx
@client/src/pages/admin/UserManagementPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add bulk delete action and confirmation to Deliveries Manifest</name>
  <files>client/src/components/deliveries/ManifestTable.tsx, client/src/pages/DeliveriesPage.tsx</files>
  <action>
In client/src/components/deliveries/ManifestTable.tsx:
1. Extend ManifestTableProps with an optional onDeleteSelected callback prop: onDeleteSelected?: (selectedIds: string[]) => void.
2. In the sticky bulk actions bar that renders when selectedIds.length > 0, import Trash2 from 'lucide-react' and add a red/destructive Button for "Delete Selected ({selectedIds.length})" with leftIcon Trash2, placed alongside the existing "Compose Operational Batch" and "Clear" buttons.
3. Wire the button onClick to trigger onDeleteSelected with selectedIds when provided.

In client/src/pages/DeliveriesPage.tsx:
1. Add state for bulk delivery deletion: isBulkDeleteModalOpen (boolean), isBulkDeleting (boolean), and bulkDeleteError (string | null).
2. Wire onDeleteSelected on ManifestTable to set isBulkDeleteModalOpen(true).
3. Add a confirmation Modal for bulk deletion warning the dispatcher that selectedIds.length delivery consignments will be permanently deleted from the manifest queue.
4. Implement handleConfirmBulkDelete:
   - Sets isBulkDeleting to true.
   - Iterates through selectedIds calling DeliveriesApi.delete(id) using Promise.allSettled.
   - Computes succeeded and failed counts.
   - Emits a feedback popup or toast notifying the dispatcher of the result (e.g., "Deleted {succeeded} consignments").
   - Clears selectedIds, closes the modal, and calls fetchData() to refresh the manifest queue.
  </action>
  <verify>
    <automated>npm --prefix client test</automated>
  </verify>
  <done>ManifestTable includes a Delete Selected button in the sticky bulk bar, and DeliveriesPage provides a confirmation dialog that executes bulk deletions via DeliveriesApi, clears selection, and reloads data.</done>
</task>

<task type="auto">
  <name>Task 2: Add multi-select checkboxes and bulk deletion to Drivers and Fleets tables</name>
  <files>client/src/components/common/Table.tsx, client/src/pages/admin/DriversPage.tsx, client/src/pages/admin/FleetsPage.tsx</files>
  <action>
In client/src/components/common/Table.tsx:
1. Extend TableProps with optional selection props:
   - selectable?: boolean
   - selectedIds?: string[]
   - onToggleSelect?: (id: string) => void
   - onSelectAll?: (ids: string[]) => void
   - getRowId?: (row: T) => string
2. When selectable is true:
   - Prepend a checkbox header column with select-all checkbox supporting indeterminate state (when some but not all rows are selected) and onChange calling onSelectAll with all row IDs or empty array.
   - Prepend a checkbox cell in each row that toggles selection for that row using getRowId or row.id / row._id.

In client/src/pages/admin/DriversPage.tsx:
1. Add state: selectedDriverIds (string[]), isBulkDeleteModalOpen (boolean), and isBulkDeleting (boolean).
2. Pass selectable, selectedIds={selectedDriverIds}, onToggleSelect, onSelectAll, and getRowId={d => d.id || d._id} to Table.
3. Above the Table, render a sticky bulk actions bar when selectedDriverIds.length > 0 displaying:
   - "{selectedDriverIds.length} Drivers Selected"
   - "Delete Selected ({selectedDriverIds.length})" button with Trash2 icon (variant danger/destructive)
   - "Clear" button that empties selectedDriverIds.
4. Implement bulk deletion confirmation modal:
   - Warns about deleting selected drivers and note that drivers with active routes or shifts will trigger active operation conflicts.
   - On confirm: iterate sequentially or via Promise.allSettled calling FleetApi.deleteDriver(id). If ACTIVE_OPERATION_CONFLICT is returned, record the conflict and warn the user.
   - Display toast summary of deleted drivers and any conflicts encountered.
   - Clear selectedDriverIds and call fetchData() to refresh the drivers list.

In client/src/pages/admin/FleetsPage.tsx:
1. Add state: selectedVehicleIds (string[]), isBulkDeleteModalOpen (boolean), isBulkDeleting (boolean), and bulkPermanentDelete (boolean, default false).
2. Pass selectable, selectedIds={selectedVehicleIds}, onToggleSelect, onSelectAll, and getRowId={v => v.id || v._id} to Table.
3. Above the Table, render a sticky bulk actions bar when selectedVehicleIds.length > 0 displaying:
   - "{selectedVehicleIds.length} Vehicles Selected"
   - "Delete / Retire Selected ({selectedVehicleIds.length})" button with Trash2 icon
   - "Clear" button that empties selectedVehicleIds.
4. Implement bulk deletion/retire confirmation modal:
   - Checkbox toggle allowing the user to select permanent database deletion vs default soft-retire (availability = RETIRED).
   - On confirm: iterate calling FleetApi.deleteVehicle(id, { permanent: bulkPermanentDelete }).
   - Display toast summary of deleted/retired vehicles, clear selectedVehicleIds, and call fetchVehicles().
  </action>
  <verify>
    <automated>npm --prefix client test</automated>
  </verify>
  <done>Generic Table supports row selection and select-all checkboxes. DriversPage and FleetsPage display sticky bulk toolbars with confirmation dialogs and execute bulk deletion with conflict handling.</done>
</task>

<task type="auto">
  <name>Task 3: Add multi-select checkboxes and protected bulk deletion to User Management table</name>
  <files>client/src/components/admin/UserTable.tsx, client/src/pages/admin/UserManagementPage.tsx</files>
  <action>
In client/src/components/admin/UserTable.tsx:
1. Extend UserTableProps with optional selection callbacks:
   - selectedUserIds: string[]
   - onToggleSelect: (id: string) => void
   - onSelectAll: (ids: string[]) => void
   - onBulkDelete: (selectedUsers: AdminUser[]) => void
2. Add a select checkbox column at index 0:
   - Header: checkbox with indeterminate state if some but not all rows on the page are selected; onChange toggles select-all for the current page users.
   - Cell: row checkbox checked if selectedUserIds.includes(user.id); onChange toggles onToggleSelect(user.id).
3. In the UI above or sticky over the table, when selectedUserIds.length > 0, render a bulk actions bar:
   - "{selectedUserIds.length} Users Selected"
   - "Delete Selected ({selectedUserIds.length})" button with Trash2 icon
   - "Clear" button.
4. Clicking Delete Selected invokes onBulkDelete with the array of selected AdminUser objects.

In client/src/pages/admin/UserManagementPage.tsx:
1. Maintain selectedUserIds state (string[]) and isBulkDeleteModalOpen (boolean).
2. Wire selectedUserIds, onToggleSelect, onSelectAll, and onBulkDelete to UserTable.
3. Implement protected bulk delete confirmation modal:
   - Filter out the logged-in administrator's account (user?.id) and show an informative message if self is selected: "Your own account cannot be deleted and will be excluded."
   - Confirm deletion of the remaining target users.
   - On confirm: iterate calling AdminUserApi.deleteUser(id).
   - Catch LAST_ADMIN_PROTECTED errors and skip/report them safely without crashing.
   - Show toast summary of successfully deleted accounts and any skipped/protected accounts.
   - Clear selectedUserIds and call fetchUsers(page) to reload the user table.
  </action>
  <verify>
    <automated>npm --prefix client test && npm --prefix client run test:unit</automated>
  </verify>
  <done>UserTable displays row selection checkboxes and a bulk action bar. UserManagementPage enforces self-deletion and last-admin protections during bulk delete, reporting clear toast feedback and reloading users.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client UI -> Admin APIs | Bulk deletion requests originate from browser UI to protected backend endpoints (/api/v1/deliveries, /api/v1/fleet/drivers, /api/v1/fleet/vehicles, /api/v1/admin/users) |
| Active Operations -> Fleet Entities | Deleting drivers or vehicles currently assigned to in-flight routes or active delivery shifts |
| User Management -> Identity & Session | Bulk user deletion potentially targeting the currently authenticated administrator or the last admin |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick-01 | Elevation of Privilege | Admin APIs & Table Actions | high | mitigate | All bulk delete operations call existing authenticated endpoints guarded by JWT bearer tokens and role-based access checks (ADMIN / FLEET_MANAGER) |
| T-quick-02 | Denial of Service | UserManagementPage | critical | mitigate | Enforce client-side and backend protection: self-account deletion is explicitly prevented and filtered out; LAST_ADMIN_PROTECTED errors are caught and surfaced without system lockout |
| T-quick-03 | Tampering / Inconsistency | DriversPage & FleetsPage | high | mitigate | Active operations are guarded: ACTIVE_OPERATION_CONFLICT responses are handled safely, informing the user of conflicting shifts/routes rather than corrupting in-flight missions |
| T-quick-SC | Tampering | npm installs | high | mitigate | package-legitimacy gate; no external packages introduced |
</threat_model>

<verification>
Automated verification across all modified files:
1. Run `npm --prefix client test` to ensure zero TypeScript compilation errors across the modified components.
2. Run `npm --prefix client run test:unit` to verify all Vitest client test suites pass without regression.
</verification>

<success_criteria>
1. Deliveries Manifest table provides row selection with a 'Delete Selected ({N})' button in the sticky bulk bar, confirmation modal, and DeliveriesApi deletion.
2. Common Table component supports selection, allowing DriversPage and FleetsPage to select multiple rows, view a sticky bulk actions toolbar, and bulk-delete with active conflict protection.
3. User Management table provides row selection, sticky bulk actions bar, and bulk delete guarded against self-deletion and last-admin removal.
4. Full client TypeScript typecheck and Vitest test suite pass cleanly.
</success_criteria>

<output>
Create `.planning/quick/261122-rq1-add-multi-select-to-delete-to-all-the-ta/PLAN.md`
</output>
