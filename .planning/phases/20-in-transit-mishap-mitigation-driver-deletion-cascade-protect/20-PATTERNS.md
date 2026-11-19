# Phase 20: In-Transit Mishap Mitigation & Driver Deletion Cascade Protection - Pattern Map

**Mapped:** 2026-11-20  
**Files analyzed:** 12  
**Analogs found:** 12 / 12  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/src/services/mishapRecoveryService.js` | service | batch / transform / atomic transaction | `server/src/services/dispatch/dispatchExecutionService.js` | exact |
| `server/src/services/resourceGuardService.js` | service / guard | request-response / query | `server/src/services/resourceGuardService.js` | exact (in-situ upgrade) |
| `server/src/controllers/adminController.js` | controller | request-response / CRUD | `server/src/controllers/adminController.js` | exact (in-situ upgrade) |
| `server/src/controllers/routeController.js` | controller | request-response | `server/src/controllers/routeController.js` | exact (in-situ upgrade) |
| `server/src/config/constants.js` | config / constants | static / declarative | `server/src/config/constants.js` | exact (in-situ upgrade) |
| `server/src/models/DriverShift.js` | model | CRUD / schema | `server/src/models/DriverShift.js` | exact (in-situ upgrade) |
| `server/src/models/Route.js` | model | CRUD / schema | `server/src/models/Route.js` | exact (in-situ upgrade) |
| `server/src/services/socketService.js` | service / real-time | pub-sub / event-driven | `server/src/services/socketService.js` | exact (in-situ upgrade) |
| `client/src/components/admin/ActiveOperationConflictModal.tsx` | component | request-response / event-driven | `client/src/components/optimization/DispatchConfirmationModal.tsx` | exact |
| `client/src/components/admin/UserTable.tsx` | component | request-response / CRUD | `client/src/components/admin/UserTable.tsx` | exact (in-situ upgrade) |
| `client/src/pages/admin/UserManagementPage.tsx` | page / controller | request-response / CRUD | `client/src/pages/admin/UserManagementPage.tsx` | exact (in-situ upgrade) |
| `client/src/pages/admin/AdminControlCenterPage.tsx` | page / component | event-driven / streaming | `client/src/pages/admin/AdminControlCenterPage.tsx` | exact (in-situ upgrade) |
| `server/tests/phase20_mishap_guards.test.js` | test | integration / request-response | `server/tests/phase09_dispatch_admin_guards.test.js` | exact |
| `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | test | unit / component | `client/src/components/admin/UserFormModal.test.tsx` | exact |

---

## Pattern Assignments

### 1. `server/src/services/mishapRecoveryService.js` (service, batch/transform/atomic transaction)

**Analog:** `server/src/services/dispatch/dispatchExecutionService.js`

**Imports Pattern** (`server/src/services/dispatch/dispatchExecutionService.js:1-24`):
```javascript
const mongoose = require('mongoose');
const Route = require('../models/Route');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const DriverShift = require('../models/DriverShift');
const VehicleAssignment = require('../models/VehicleAssignment');
const RouteAssignment = require('../models/RouteAssignment');
const socketService = require('./socketService');
const { recordAuditEvent } = require('./auditService');
const { withTransaction } = require('../utils/transactionHelper');
const { AppError } = require('../middleware/errorHandler');
const {
  AUDIT_EVENT_TYPES,
  DELIVERY_STATUS,
  PRIORITY_LEVELS,
  SHIFT_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  NOTIFICATION_SEVERITIES,
} = require('../config/constants');
```

**Atomic Transaction & Multi-Entity Cascade Pattern** (`server/src/services/dispatch/dispatchExecutionService.js:151-244`):
```javascript
await withTransaction(async (session) => {
  const sessionOpts = session ? { session } : {};

  // 1. Locate active route and shift under transaction session
  const activeRoute = await Route.findOne({
    driverId,
    status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
  }, null, sessionOpts);

  const activeShift = await DriverShift.findOne({
    driverId,
    status: SHIFT_STATUS.IN_PROGRESS,
  }, null, sessionOpts);

  // 2. Rescue uncompleted stops; preserve completed POD intact
  const rescuedDeliveryIds = [];
  if (activeRoute) {
    for (const stop of activeRoute.stops) {
      if (stop.status !== 'COMPLETED') {
        await Delivery.findByIdAndUpdate(
          stop.deliveryId,
          {
            $set: {
              status: DELIVERY_STATUS.READY,
              assignedDriverId: null,
              assignedVehicleId: null,
              priority: PRIORITY_LEVELS.URGENT,
              failureReason: null,
              failureNotes: `Rescued from route ${activeRoute.routeCode} due to mishap: ${reason}`,
            },
          },
          sessionOpts
        );
        rescuedDeliveryIds.push(stop.deliveryId.toString());

        await recordAuditEvent({
          actorId: actor?.id || null,
          actorRole: actor?.role || 'SYSTEM',
          deliveryId: stop.deliveryId,
          routeId: activeRoute._id,
          action: `[MISHAP_RESCUE] Delivery returned to READY pool with Urgent priority. Reason: ${reason}`,
          type: AUDIT_EVENT_TYPES.EXCEPTION_REPORTED,
          metadata: { previousRouteCode: activeRoute.routeCode, reason },
        }, sessionOpts);

        stop.status = 'FAILED';
      }
    }

    // 3. Cancel route with reason
    activeRoute.status = 'CANCELLED';
    activeRoute.cancellationReason = reason;
    await activeRoute.save(sessionOpts);
  }

  // 4. Force-close driver shift
  if (activeShift) {
    activeShift.status = SHIFT_STATUS.FORCE_CLOSED;
    activeShift.endTime = new Date().toTimeString().slice(0, 5);
    activeShift.notes = (activeShift.notes ? activeShift.notes + ' | ' : '') + `Force-closed: ${reason}`;
    await activeShift.save(sessionOpts);
  }

  // 5. Unlink vehicle assignment and reset vehicle status
  await VehicleAssignment.updateMany(
    { driverId, status: { $in: ['PENDING', 'ACTIVE'] } },
    { $set: { status: 'CANCELLED' } },
    sessionOpts
  );

  const driver = await Driver.findById(driverId, null, sessionOpts);
  if (driver?.assignedVehicleId) {
    const vehicleAvailability = mishapCategory === 'VEHICLE_BREAKDOWN'
      ? VEHICLE_STATUS.MAINTENANCE
      : VEHICLE_STATUS.AVAILABLE;

    await Vehicle.findByIdAndUpdate(
      driver.assignedVehicleId,
      { $set: { assignedDriverId: null, availability: vehicleAvailability } },
      sessionOpts
    );
    driver.assignedVehicleId = null;
    driver.currentRouteId = null;
    driver.availability = DRIVER_AVAILABILITY.OFF_DUTY;
    await driver.save(sessionOpts);
  }
});
```

**Real-Time Broadcast & Post-Commit Pattern** (`server/src/services/dispatch/dispatchExecutionService.js:276-292`):
```javascript
// Post-commit broadcast outside transaction boundary
try {
  if (activeRoute) {
    socketService.emitRouteCancelled({
      routeId: activeRoute._id.toString(),
      routeCode: activeRoute.routeCode,
      driverId: driverId.toString(),
      reason,
      rescuedCount: rescuedDeliveryIds.length,
    });
  }
  socketService.emitDeliveriesReassigned({
    driverId: driverId.toString(),
    routeId: activeRoute?._id?.toString() || null,
    routeCode: activeRoute?.routeCode || null,
    rescuedDeliveryIds,
    count: rescuedDeliveryIds.length,
    reason,
  });
} catch (err) {
  console.warn(`[SocketBroadcast] Failed to emit mishap events: ${err.message}`);
}
```

---

### 2. `server/src/services/resourceGuardService.js` (service/guard, request-response/query)

**Analog:** `server/src/services/resourceGuardService.js`

**Current Pattern** (`server/src/services/resourceGuardService.js:27-65`):
```javascript
const assertNoActiveDriverOrVehicleOperations = async ({
  driverIds = [],
  vehicleIds = [],
  actionLabel = 'modify resource',
} = {}) => {
  const uniqueDriverIds = normalizeIdList(driverIds);
  const uniqueVehicleIds = normalizeIdList(vehicleIds);

  if (uniqueDriverIds.length === 0 && uniqueVehicleIds.length === 0) {
    return;
  }

  const orConditions = [];
  if (uniqueDriverIds.length > 0) {
    orConditions.push({ driverId: { $in: uniqueDriverIds } });
  }
  if (uniqueVehicleIds.length > 0) {
    orConditions.push({ vehicleId: { $in: uniqueVehicleIds } });
  }

  const [activeShift, activeRoute] = await Promise.all([
    DriverShift.exists({
      status: SHIFT_STATUS.IN_PROGRESS,
      $or: orConditions,
    }),
    Route.exists({
      status: { $in: ACTIVE_ROUTE_STATUSES },
      $or: orConditions,
    }),
  ]);

  if (activeShift || activeRoute) {
    throw new AppError(
      `Cannot ${actionLabel}: an active shift or DISPATCHED/IN_PROGRESS route is currently running.`,
      409,
      'ACTIVE_OPERATION_CONFLICT'
    );
  }
};
```

**Target Extension Pattern for Detailed Active Context (MISHAP-01)**:
```javascript
/**
 * Query detailed active route and shift metadata to return rich 409 conflict payload
 */
const getActiveDriverOrVehicleOperations = async ({ driverIds = [], vehicleIds = [] } = {}) => {
  const uniqueDriverIds = normalizeIdList(driverIds);
  const uniqueVehicleIds = normalizeIdList(vehicleIds);

  if (uniqueDriverIds.length === 0 && uniqueVehicleIds.length === 0) {
    return null;
  }

  const orConditions = [];
  if (uniqueDriverIds.length > 0) orConditions.push({ driverId: { $in: uniqueDriverIds } });
  if (uniqueVehicleIds.length > 0) orConditions.push({ vehicleId: { $in: uniqueVehicleIds } });

  const [activeShift, activeRoute] = await Promise.all([
    DriverShift.findOne({
      status: SHIFT_STATUS.IN_PROGRESS,
      $or: orConditions,
    }),
    Route.findOne({
      status: { $in: ACTIVE_ROUTE_STATUSES },
      $or: orConditions,
    }).populate('driverId'),
  ]);

  if (!activeShift && !activeRoute) {
    return null;
  }

  const activeDeliveryCount = activeRoute
    ? activeRoute.stops.filter((s) => ['PENDING', 'ARRIVED'].includes(s.status)).length
    : 0;

  return {
    hasActiveOperations: true,
    routeId: activeRoute?._id?.toString() || null,
    routeCode: activeRoute?.routeCode || null,
    activeDeliveryCount,
    shiftId: activeShift?._id?.toString() || null,
  };
};

// In assertNoActiveDriverOrVehicleOperations:
const conflict = await getActiveDriverOrVehicleOperations({ driverIds, vehicleIds });
if (conflict) {
  throw new AppError(
    `Cannot ${actionLabel}: an active shift or DISPATCHED/IN_PROGRESS route is currently running.`,
    409,
    'ACTIVE_OPERATION_CONFLICT',
    conflict
  );
}
```

---

### 3. `server/src/controllers/adminController.js` (controller, request-response/CRUD)

**Analog:** `server/src/controllers/adminController.js`

**Delete & Status Guard Pattern** (`server/src/controllers/adminController.js:369-454`):
```javascript
// Existing deleteUser pattern
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceReassign = req.query.forceReassign === 'true' || req.body?.forceReassign === true;

    if (id === req.user.id) {
      throw new AppError('Cannot delete your own administrator account', 403, 'SELF_LOCKOUT_PREVENTED');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await assertNotLastActiveAdmin(user, null, null, true);

    // MISHAP-01: Check linked driver profile operations
    const driver = await Driver.findOne({ userId: user._id });
    if (driver) {
      if (forceReassign) {
        // MISHAP-03: Execute atomic mishap recovery cascade
        await recoverDriverMishapCascade({
          driverId: driver._id,
          actor: req.user,
          reason: 'DRIVER_ACCOUNT_DELETED',
        });
        await Driver.findByIdAndDelete(driver._id);
      } else {
        await assertNoActiveDriverOrVehicleOperations({
          driverIds: [driver._id],
          actionLabel: 'delete driver user account',
        });
        await Driver.findByIdAndDelete(driver._id);
      }
    }

    await User.findByIdAndDelete(user._id);

    await logAdminAudit({
      actor: req.user,
      action: `Deleted user account '${user.name}' (${user.email})`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
      metadata: { deletedEmail: user.email, deletedRole: user.role, forceReassign },
    });

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
      data: { userId: user._id.toString() },
    });
  } catch (err) {
    next(err);
  }
};
```

---

### 4. `server/src/controllers/routeController.js` (controller, request-response)

**Analog:** `server/src/controllers/routeController.js`

**Controller Dispatch Endpoint Pattern** (`server/src/controllers/routeController.js:1026-1052`):
```javascript
/**
 * POST /api/v1/routes/:id/mishap-recover
 * Dispatcher manual mishap recovery trigger
 */
const recoverRouteMishap = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'IN_TRANSIT_BREAKDOWN', mishapCategory = 'VEHICLE_BREAKDOWN' } = req.body || {};

    const route = await Route.findById(id);
    if (!route) {
      throw new AppError(`Route '${id}' not found`, 404, 'ROUTE_NOT_FOUND');
    }

    const result = await recoverDriverMishapCascade({
      driverId: route.driverId,
      actor: req.user,
      reason,
      mishapCategory,
    });

    res.status(200).json({
      success: true,
      message: `Mishap recovery cascade executed for route ${route.routeCode}`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
```

---

### 5. `server/src/config/constants.js` & `server/src/models/DriverShift.js` / `Route.js` (model, CRUD)

**Analogs:** `server/src/config/constants.js:153-158`, `server/src/models/DriverShift.js:24-28`, `server/src/models/Route.js:91-96`

**Shift Status Constants Pattern** (`server/src/config/constants.js:153-158`):
```javascript
const SHIFT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FORCE_CLOSED: 'FORCE_CLOSED', // [Phase 20 D-03]
};
```

**DriverShift Schema Enum Pattern** (`server/src/models/DriverShift.js:24-28`):
```javascript
status: {
  type: String,
  enum: Object.values(SHIFT_STATUS),
  default: SHIFT_STATUS.SCHEDULED,
},
```

**Route Schema Cancellation Reason Pattern** (`server/src/models/Route.js:91-96`):
```javascript
status: {
  type: String,
  required: true,
  enum: ['DRAFT', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  default: 'DRAFT',
},
cancellationReason: {
  type: String,
  default: null,
},
```

---

### 6. `client/src/components/admin/ActiveOperationConflictModal.tsx` (component, confirmation modal)

**Analog:** `client/src/components/optimization/DispatchConfirmationModal.tsx:1-80` and `client/src/components/common/Modal.tsx:17-60`

**Modal Definition & Action Pattern**:
```typescript
import React from 'react';
import { AlertTriangle, RotateCcw, X, ShieldAlert } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export interface ActiveOperationConflictDetails {
  routeId?: string | null;
  routeCode?: string | null;
  activeDeliveryCount: number;
  driverName?: string | null;
}

export interface ActiveOperationConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ActiveOperationConflictDetails | null;
  onConfirmReassignAndDelete: () => Promise<void>;
  isSubmitting?: boolean;
}

export const ActiveOperationConflictModal: React.FC<ActiveOperationConflictModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onConfirmReassignAndDelete,
  isSubmitting = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Active Operation Conflict"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirmReassignAndDelete}
            isLoading={isSubmitting}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reassign Active Orders & Delete
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Cannot delete driver with active in-transit operations
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Driver <strong>{conflict?.driverName || 'Selected Driver'}</strong> is currently assigned to route{' '}
              <strong>{conflict?.routeCode || 'Active Route'}</strong> with{' '}
              <strong>{conflict?.activeDeliveryCount || 0}</strong> uncompleted deliveries.
            </p>
          </div>
        </div>

        <div className="p-3 bg-surface-low rounded-xl text-xs space-y-1.5 text-on-surface-variant">
          <p className="font-medium text-on-surface">Choosing "Reassign Active Orders & Delete" will:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Rescue {conflict?.activeDeliveryCount} remaining consignments back to <strong>READY</strong> with <strong>Urgent</strong> priority.</li>
            <li>Preserve all completed delivery Proof-of-Delivery signatures intact.</li>
            <li>Cancel route {conflict?.routeCode} and force-close the active driver shift.</li>
            <li>Release vehicle locks back to AVAILABLE status.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
```

---

### 7. `client/src/pages/admin/UserManagementPage.tsx` (page, request-response/CRUD)

**Analog:** `client/src/pages/admin/UserManagementPage.tsx:132-156`

**Conflict Interception Pattern**:
```typescript
// Error interception pattern in handleDelete
const [conflictModalOpen, setConflictModalOpen] = useState(false);
const [activeConflict, setActiveConflict] = useState<{
  user: AdminUser;
  details: ActiveOperationConflictDetails;
} | null>(null);
const [isCascadeSubmitting, setIsCascadeSubmitting] = useState(false);

const handleDelete = async (targetUser: AdminUser) => {
  if (targetUser.id === user?.id) {
    toast.error('Cannot delete your own account');
    return;
  }
  try {
    const res = await AdminUserApi.deleteUser(targetUser.id);
    if (res.success) {
      toast.success('User deleted successfully');
      fetchUsers(page);
    }
  } catch (err: any) {
    const errData = err.response?.data?.error;
    if (errData?.code === 'ACTIVE_OPERATION_CONFLICT') {
      setActiveConflict({
        user: targetUser,
        details: {
          routeId: errData.details?.routeId,
          routeCode: errData.details?.routeCode,
          activeDeliveryCount: errData.details?.activeDeliveryCount || 0,
          driverName: targetUser.name,
        },
      });
      setConflictModalOpen(true);
    } else if (errData?.code === 'LAST_ADMIN_PROTECTED') {
      toast.error('Cannot delete the last remaining active administrator');
    } else {
      toast.error(err.friendlyMessage || err.message || 'Failed to delete user');
    }
  }
};

const handleConfirmReassignAndDelete = async () => {
  if (!activeConflict) return;
  setIsCascadeSubmitting(true);
  try {
    const res = await AdminUserApi.deleteUser(activeConflict.user.id, { forceReassign: true });
    if (res.success) {
      toast.success(`Active orders rescued & driver account deleted`);
      setConflictModalOpen(false);
      setActiveConflict(null);
      fetchUsers(page);
    }
  } catch (err: any) {
    toast.error(err.friendlyMessage || err.message || 'Failed to execute mishap cascade');
  } finally {
    setIsCascadeSubmitting(false);
  }
};
```

---

### 8. `client/src/pages/admin/AdminControlCenterPage.tsx` (page/component, event-driven/streaming)

**Analog:** `client/src/pages/admin/AdminControlCenterPage.tsx:162-188`

**Live Socket Subscriber & Mishap Banner Pattern**:
```typescript
// Socket listener inside useEffect
useEffect(() => {
  fetchData();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return;

  return mountRealtimeSocket(token, (socket) => {
    const onLiveEvent = () => fetchData();
    const onMishapAlert = (payload: any) => {
      setMishapAlert(payload);
      fetchData();
    };

    socket.on('delivery:updated', onLiveEvent);
    socket.on('route:progress', onLiveEvent);
    socket.on('route:dispatched', onLiveEvent);
    socket.on('route:cancelled', onMishapAlert);
    socket.on('deliveries:reassigned', onMishapAlert);

    return () => {
      socket.off('delivery:updated', onLiveEvent);
      socket.off('route:progress', onLiveEvent);
      socket.off('route:dispatched', onLiveEvent);
      socket.off('route:cancelled', onMishapAlert);
      socket.off('deliveries:reassigned', onMishapAlert);
    };
  });
}, []);
```

---

### 9. `server/tests/phase20_mishap_guards.test.js` (test, integration)

**Analog:** `server/tests/phase09_dispatch_admin_guards.test.js:1-28, 400-420`

**Test Structure Pattern**:
```javascript
const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const Route = require('../src/models/Route');
const DriverShift = require('../src/models/DriverShift');
const Vehicle = require('../src/models/Vehicle');
const Driver = require('../src/models/Driver');
const User = require('../src/models/User');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 20 Mishap Guards & Deletion Cascade (server/tests/phase20_mishap_guards.test.js)', () => {
  let adminToken;
  let driverUser;
  let testDriver;
  let testVehicle;

  beforeEach(async () => {
    const admin = await createTestUser('ADMIN');
    adminToken = admin.token;

    driverUser = await createTestUser('DRIVER');
    testDriver = await createTestDriver(driverUser.user._id);
    testVehicle = await createTestVehicle();
  });

  test('MISHAP-01: DELETE /admin/users/:id returns 409 ACTIVE_OPERATION_CONFLICT when driver has active route', async () => {
    const del1 = await createTestDelivery({ status: 'ASSIGNED' });
    const route = await Route.create({
      routeCode: 'RT-MISHAP-01',
      vehicleId: testVehicle._id,
      driverId: testDriver._id,
      status: 'DISPATCHED',
      stops: [{ deliveryId: del1._id, status: 'PENDING', stopSequence: 1 }],
    });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${driverUser.user._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_OPERATION_CONFLICT');
    expect(res.body.error.details.routeCode).toBe('RT-MISHAP-01');
    expect(res.body.error.details.activeDeliveryCount).toBe(1);
  });

  test('MISHAP-03: DELETE /admin/users/:id with forceReassign=true rescues uncompleted deliveries to READY with Urgent priority', async () => {
    // Setup completed stop + pending stop
    const completedDel = await createTestDelivery({ status: 'COMPLETED' });
    const pendingDel = await createTestDelivery({ status: 'OUT_FOR_DELIVERY' });

    const route = await Route.create({
      routeCode: 'RT-MISHAP-02',
      vehicleId: testVehicle._id,
      driverId: testDriver._id,
      status: 'IN_PROGRESS',
      stops: [
        { deliveryId: completedDel._id, status: 'COMPLETED', stopSequence: 1 },
        { deliveryId: pendingDel._id, status: 'ARRIVED', stopSequence: 2 },
      ],
    });

    const res = await request(app)
      .delete(`/api/v1/admin/users/${driverUser.user._id}?forceReassign=true`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    // Verify uncompleted order is rescued to READY + Urgent
    const rescued = await Delivery.findById(pendingDel._id);
    expect(rescued.status).toBe('READY');
    expect(rescued.priority).toBe('Urgent');
    expect(rescued.assignedDriverId).toBeNull();

    // Verify completed stop was NOT touched
    const preserved = await Delivery.findById(completedDel._id);
    expect(preserved.status).toBe('COMPLETED');

    // Verify route cancelled
    const updatedRoute = await Route.findById(route._id);
    expect(updatedRoute.status).toBe('CANCELLED');
    expect(updatedRoute.cancellationReason).toBe('DRIVER_ACCOUNT_DELETED');
  });
});
```

---

### 10. `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` (test, component unit)

**Analog:** `client/src/components/admin/UserFormModal.test.tsx:1-60`

**Component Test Pattern**:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveOperationConflictModal } from '../ActiveOperationConflictModal';

describe('ActiveOperationConflictModal', () => {
  const defaultConflict = {
    routeId: 'route-123',
    routeCode: 'RT-0042',
    activeDeliveryCount: 7,
    driverName: 'Bikash Mohanty',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    conflict: defaultConflict,
    onConfirmReassignAndDelete: vi.fn(),
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conflict details correctly including route code and remaining deliveries', () => {
    render(<ActiveOperationConflictModal {...defaultProps} />);
    expect(screen.getByText(/RT-0042/i)).toBeInTheDocument();
    expect(screen.getByText(/Bikash Mohanty/i)).toBeInTheDocument();
    expect(screen.getByText(/7/i)).toBeInTheDocument();
  });

  it('triggers onConfirmReassignAndDelete when clicking confirm button', () => {
    render(<ActiveOperationConflictModal {...defaultProps} />);
    const confirmButton = screen.getByRole('button', { name: /Reassign Active Orders & Delete/i });
    fireEvent.click(confirmButton);
    expect(defaultProps.onConfirmReassignAndDelete).toHaveBeenCalledTimes(1);
  });
});
```

---

## Shared Patterns

### Shared Pattern 1: Atomic Transaction Boundary with Standalone Fallback
**Source:** `server/src/utils/transactionHelper.js:36-56`  
**Apply to:** `server/src/services/mishapRecoveryService.js` and all multi-document mutation workflows.
```javascript
// Executes inside Mongoose session when replica set is enabled; executes plain callback if standalone
await withTransaction(async (session) => {
  const sessionOpts = session ? { session } : {};
  // Perform multi-document updates using sessionOpts
});
```

### Shared Pattern 2: Structured Error Payload Interlock (409 Conflict)
**Source:** `server/src/middleware/errorHandler.js:6-15`, `server/src/services/resourceGuardService.js:59-64`  
**Apply to:** `adminController.js`, `resourceGuardService.js`, and `UserManagementPage.tsx`.
```javascript
// Server throws structured AppError with machine-readable code and detailed entity metadata
throw new AppError(
  'Cannot delete user: an active shift or DISPATCHED/IN_PROGRESS route is currently running.',
  409,
  'ACTIVE_OPERATION_CONFLICT',
  { routeId, routeCode, activeDeliveryCount, driverName }
);
```

### Shared Pattern 3: Multi-Channel Real-Time Socket Broadcast
**Source:** `server/src/services/socketService.js:57-70`, `client/src/utils/socketClient.ts:40-75`  
**Apply to:** `server/src/services/socketService.js` and `client/src/pages/admin/AdminControlCenterPage.tsx`.
```javascript
// Server broadcasts to room 'management' and tracking room
ioInstance.to('management').emit('route:cancelled', payload);
ioInstance.to('management').emit('deliveries:reassigned', payload);
```

### Shared Pattern 4: GSAP-Animated Accessible Modal Dialogs
**Source:** `client/src/components/common/Modal.tsx:17-60`  
**Apply to:** `client/src/components/admin/ActiveOperationConflictModal.tsx`.
```typescript
// Inherit Escape-key handling, background scroll-locking, and GSAP pop-in animations
<Modal isOpen={isOpen} onClose={onClose} title={title} footer={...}>
  {children}
</Modal>
```

---

## No Analog Found

*None. All files have concrete, git-tracked analogs in the current codebase.*

---

## Metadata

**Analog search scope:** `server/src/services`, `server/src/controllers`, `server/src/models`, `client/src/components`, `client/src/pages`, `server/tests`  
**Files scanned:** 26  
**Pattern extraction date:** 2026-11-20  
