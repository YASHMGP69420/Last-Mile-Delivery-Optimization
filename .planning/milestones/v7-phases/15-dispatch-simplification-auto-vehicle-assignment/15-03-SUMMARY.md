# Plan 15-03 Summary: ConsignmentDrawer Fleet Assignment Removal

## Objective
Remove fleet assignment UI from ConsignmentDrawer and replace with Batch Status Chip, completing Wave 1 of Phase 15.

## Files Modified
- `client/src/components/deliveries/ConsignmentDrawer.tsx`
- `client/src/pages/DeliveriesPage.tsx`

## Changes Made

### ConsignmentDrawer.tsx
1. **Removed fleet assignment UI section** - Replaced "Fleet Resource Assignment" card with Batch Status Chip
2. **Removed `hasFleetOptions` logic** - No longer references `vehicles`/`drivers` props (removed from interface)
3. **Fixed batch status comparison** - Changed `'DISPATCHED'` to `'IN_PROGRESS'` to match `BatchStatus` type (`'DRAFT' | 'READY' | 'PLANNED' | 'IN_PROGRESS' | 'CLOSED'`)
4. **Fixed import** - Changed `Batch` to `DeliveryBatch` (correct exported type name)
5. **Batch Status Chip** - Shows batch code with colored status badge:
   - Green (`IN_PROGRESS`) = Dispatched/Active
   - Amber (other statuses) = Pending/Planned

### DeliveriesPage.tsx
1. **Removed `vehicles` and `drivers` props** from `<ConsignmentDrawer />` component call (lines 428-429)

## Verification Results
| Command | Result |
|---------|--------|
| `npm --prefix client run build` | ✅ Success (9.36s) |
| `npm --prefix client run test` | ✅ TypeScript check passed |
| `npm --prefix server test` | ✅ 333/333 tests passed |

## Wave 1 Completion Status
| Plan | Status | Summary |
|------|--------|---------|
| 15-01 (Tracer) | ✅ Done | Backend auto-assignment + types |
| 15-02 | ✅ Done | BatchComposerPanel fleet removal |
| 15-03 | ✅ Done | ConsignmentDrawer fleet removal + Batch Status Chip |

**Wave 1 Complete** - Ready for Wave 2 (15-04 DriversPage, 15-05 FleetsPage, 15-06 CurrentRouteCard with overrides)