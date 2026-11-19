# Phase 21: Driver Handheld Delivery Sync & Demo Account Isolation - Pattern Map

**Mapped:** 2026-11-20  
**Files analyzed:** 13  
**Analogs found:** 13 / 13  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server/src/services/socketService.js` | service | pub-sub / streaming | `server/src/services/socketService.js` | exact |
| `server/src/controllers/driverHudController.js` | controller | transactional / CRUD | `server/src/controllers/driverHudController.js` | exact |
| `server/src/services/dispatch/dispatchExecutionService.js` | service | transactional / CRUD | `server/src/services/dispatch/dispatchExecutionService.js` | exact |
| `server/src/controllers/routeController.js` | controller | request-response / CRUD | `server/src/controllers/routeController.js` | exact |
| `server/src/controllers/batchController.js` | controller | request-response / CRUD | `server/src/controllers/batchController.js` | exact |
| `server/src/middleware/socketAuth.js` | middleware | request-response / auth | `server/src/middleware/socketAuth.js` | exact |
| `client/src/context/DriverSocketContext.tsx` | provider / context | streaming / event-driven | `client/src/context/DriverSocketContext.tsx` | exact |
| `client/src/pages/driver/DriverCockpitPage.tsx` | component / page | streaming / request-response | `client/src/pages/driver/DriverCockpitPage.tsx` | exact |
| `client/src/pages/driver/DriverRoutePage.tsx` | component / page | streaming / request-response | `client/src/pages/driver/DriverRoutePage.tsx` | exact |
| `client/src/components/deliveries/BatchComposerPanel.tsx` | component | request-response / CRUD | `client/src/components/deliveries/BatchComposerPanel.tsx` | exact |
| `client/src/pages/admin/RoutePlannerPage.tsx` | component / page | request-response / CRUD | `client/src/pages/admin/RoutePlannerPage.tsx` | exact |
| `server/tests/phase21_driver_sync_demo_isolation.test.js` | test | integration / request-response | `server/tests/phase20_mishap_guards.test.js` | role-match |
| `client/src/pages/driver/__tests__/DriverCockpitDemoBanner.test.tsx` | test | unit / component | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | role-match |

---

## Pattern Assignments

### 1. `server/src/services/socketService.js` (service, pub-sub / streaming)

**Analog:** `server/src/services/socketService.js`  
**Git Tracked:** Yes (`git ls-files server/src/services/socketService.js`)

**Imports & Setup Pattern** (lines 1-15):
```javascript
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

let ioInstance = null;
```

**Core Multi-Room Emission Pattern** (lines 125-156):
```javascript
/**
 * Emit delivery status change (driver arrived, completed, or failed stop)
 * Multi-room broadcast to management, route room, and driver room
 */
const emitDeliveryUpdated = (payload) => {
  if (!ioInstance) return;
  try {
    // 1. Management room (dispatcher fleet board & control center)
    ioInstance.to('management').emit('delivery:updated', payload);
    ioInstance.to('management').emit('delivery:status_changed', payload);
    ioInstance.to('management').emit('route:updated', payload);
    ioInstance.to('management').emit('driver:stop_progressed', payload);

    // 2. Driver personal room (handheld socket context)
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('delivery:updated', payload);
      ioInstance.to(`driver:${payload.driverId}`).emit('delivery:status_changed', payload);
      ioInstance.to(`driver:${payload.driverId}`).emit('route:updated', payload);
      ioInstance.to(`driver:${payload.driverId}`).emit('driver:stop_progressed', payload);
    }

    // 3. Route specific room (driver cockpit & route overview)
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:progress', payload);
      ioInstance.to(`route:${payload.routeId}`).emit('delivery:updated', payload);
      ioInstance.to(`route:${payload.routeId}`).emit('delivery:status_changed', payload);
      ioInstance.to(`route:${payload.routeId}`).emit('route:updated', payload);
      ioInstance.to(`route:${payload.routeId}`).emit('driver:stop_progressed', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit delivery:updated: ${err.message}`);
  }
};
```

**Error Handling:** Non-fatal try/catch with console warning logging (`console.warn`) to prevent socket emit failures from aborting HTTP REST mutations.

---

### 2. `server/src/controllers/driverHudController.js` (controller, transactional / CRUD)

**Analog:** `server/src/controllers/driverHudController.js`  
**Git Tracked:** Yes (`git ls-files server/src/controllers/driverHudController.js`)

**Imports Pattern** (lines 1-30):
```javascript
const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const VehicleAssignment = require('../models/VehicleAssignment');
const RouteAssignment = require('../models/RouteAssignment');
const socketService = require('../services/socketService');
const { withTransaction } = require('../utils/transactionHelper');
const { AppError } = require('../middleware/errorHandler');
const { DELIVERY_STATUS, DRIVER_AVAILABILITY, VEHICLE_STATUS } = require('../config/constants');
```

**Dual-Model Atomic Sync Pattern** (lines 893-928 & 816-860):
```javascript
exports.markDeliveryArrived = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    await assertDriverCanMutateDelivery(driver, req.user, delivery);

    const route = await Route.findOne({ driverId: driver._id, 'stops.deliveryId': delivery._id });

    // Atomic dual-model update in withTransaction
    await withTransaction(async (session) => {
      const sessionOpts = session ? { session } : {};
      delivery.status = DELIVERY_STATUS.OUT_FOR_DELIVERY;
      await delivery.save(sessionOpts);

      if (route) {
        await Route.updateOne(
          { _id: route._id, 'stops.deliveryId': delivery._id },
          { $set: { 'stops.$.status': 'ARRIVED', status: 'IN_PROGRESS' } },
          sessionOpts
        );
      }
    });

    socketService.emitDeliveryUpdated({
      deliveryId: delivery._id.toString(),
      orderReference: delivery.orderReference,
      status: 'OUT_FOR_DELIVERY',
      stopStatus: 'ARRIVED',
      routeId: route?._id?.toString(),
      driverId: driver._id.toString(),
      driverName: req.user.name,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Marked arrived at customer destination',
      data: { delivery },
    });
  } catch (err) {
    next(err);
  }
};
```

**Session-Aware Finalization Pattern** (lines 816-850):
```javascript
const finalizeRouteIfFinished = async ({ routeId, driver, incrementCompletedRuns = false, session = null }) => {
  if (!routeId) return null;
  const sessionOpts = session ? { session } : {};
  const updatedRoute = await Route.findById(routeId).session(session);
  if (!updatedRoute) return null;

  const remaining = updatedRoute.stops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
  if (remaining.length > 0) return updatedRoute;

  updatedRoute.status = 'COMPLETED';
  updatedRoute.completedAt = new Date();
  await updatedRoute.save(sessionOpts);

  if (incrementCompletedRuns) {
    driver.onTimeRuns = (driver.onTimeRuns || 0) + 1;
  }
  driver.availability = DRIVER_AVAILABILITY.AVAILABLE;
  driver.currentRouteId = null;
  await driver.save(sessionOpts);

  if (updatedRoute.vehicleId) {
    await Vehicle.findByIdAndUpdate(updatedRoute.vehicleId, {
      availability: VEHICLE_STATUS.AVAILABLE,
    }, sessionOpts);
  }
  // ... assignments update with sessionOpts ...
};
```

**BOLA Guard:** `assertDriverCanMutateDelivery(driver, req.user, delivery)` throws `403 FORBIDDEN` if caller does not own the delivery.

---

### 3. `server/src/services/dispatch/dispatchExecutionService.js` (service, transactional / CRUD)

**Analog:** `server/src/services/dispatch/dispatchExecutionService.js`  
**Git Tracked:** Yes (`git ls-files server/src/services/dispatch/dispatchExecutionService.js`)

**Imports Pattern** (lines 1-25):
```javascript
const mongoose = require('mongoose');
const Route = require('../../models/Route');
const DeliveryBatch = require('../../models/DeliveryBatch');
const Vehicle = require('../../models/Vehicle');
const Driver = require('../../models/Driver');
const Delivery = require('../../models/Delivery');
const VehicleAssignment = require('../../models/VehicleAssignment');
const RouteAssignment = require('../../models/RouteAssignment');
const socketService = require('../socketService');
const { AppError } = require('../../middleware/errorHandler');
const { withTransaction } = require('../../utils/transactionHelper');
```

**Demo Isolation Guard Pattern** (integrate before transaction at line 147):
```javascript
// Validate Demo Sandbox Boundaries per D-03
const isCallerDemo = Boolean(
  req?.user?.isDemoData || (req?.user?.email && req.user.email.toLowerCase().endsWith('@smartroute.local'))
);

if (driver) {
  const isDriverDemo = Boolean(driver.isDemoData);
  if (isCallerDemo && !isDriverDemo) {
    throw new AppError(
      'Demo dispatchers cannot assign or dispatch to production drivers.',
      403,
      'DEMO_ISOLATION_VIOLATION'
    );
  }
  if (!isCallerDemo && isDriverDemo) {
    throw new AppError(
      'Production dispatchers cannot assign or dispatch to demo drivers.',
      403,
      'DEMO_ISOLATION_VIOLATION'
    );
  }
}

if (vehicle) {
  const isVehicleDemo = Boolean(vehicle.isDemoData);
  if (isCallerDemo && !isVehicleDemo) {
    throw new AppError(
      'Demo dispatchers cannot assign or dispatch to production vehicles.',
      403,
      'DEMO_ISOLATION_VIOLATION'
    );
  }
  if (!isCallerDemo && isVehicleDemo) {
    throw new AppError(
      'Production dispatchers cannot assign or dispatch to demo vehicles.',
      403,
      'DEMO_ISOLATION_VIOLATION'
    );
  }
}

// Ensure route.isDemoData strictly reflects caller/fleet demo mode
const isDemo = Boolean(isCallerDemo || driver?.isDemoData || vehicle?.isDemoData);
```

---

### 4. `server/src/controllers/routeController.js` (controller, request-response / CRUD)

**Analog:** `server/src/controllers/routeController.js`  
**Git Tracked:** Yes (`git ls-files server/src/controllers/routeController.js`)

**Push Route Handheld Isolation Guard Pattern** (lines 1220-1260):
```javascript
const pushRouteToHandheld = async (req, res, next) => {
  try {
    const { id } = req.params;
    let route = await Route.findById(id).populate('driverId vehicleId');
    if (!route) {
      throw new AppError('Route not found for dispatch push', 404, 'ROUTE_NOT_FOUND');
    }

    const isCallerDemo = Boolean(
      req.user?.isDemoData || (req.user?.email && req.user.email.toLowerCase().endsWith('@smartroute.local'))
    );
    const isTargetDemo = Boolean(route.isDemoData || route.driverId?.isDemoData || route.vehicleId?.isDemoData);

    if (isCallerDemo && !isTargetDemo) {
      throw new AppError(
        'Demo accounts cannot push routes to production driver handhelds.',
        403,
        'DEMO_ISOLATION_VIOLATION'
      );
    }
    if (!isCallerDemo && isTargetDemo) {
      throw new AppError(
        'Production accounts cannot push routes to demo driver handhelds.',
        403,
        'DEMO_ISOLATION_VIOLATION'
      );
    }

    // Proceed to promote status and emitRouteDispatched
    if (route.status === 'OPTIMIZED' || route.status === 'DRAFT') {
      route.status = 'DISPATCHED';
      route.dispatchedAt = new Date();
      await route.save();
    }
    // ...
```

---

### 5. `server/src/controllers/batchController.js` (controller, request-response / CRUD)

**Analog:** `server/src/controllers/batchController.js`  
**Git Tracked:** Yes (`git ls-files server/src/controllers/batchController.js`)

**Batch Creation & Fleet Update Guard Pattern** (lines 239-245 & 588-594):
```javascript
const isCallerDemo = Boolean(
  req.user?.isDemoData || (req.user?.email && req.user.email.toLowerCase().endsWith('@smartroute.local'))
);

if (vehicleIds?.length > 0 || driverIds?.length > 0) {
  const [vehicles, drivers] = await Promise.all([
    Vehicle.find({ _id: { $in: vehicleIds } }),
    Driver.find({ _id: { $in: driverIds } }),
  ]);

  for (const v of vehicles) {
    if (isCallerDemo && !v.isDemoData) {
      throw new AppError('Demo dispatchers cannot assign production vehicles to batches.', 403, 'DEMO_ISOLATION_VIOLATION');
    }
    if (!isCallerDemo && v.isDemoData) {
      throw new AppError('Production dispatchers cannot assign demo vehicles to batches.', 403, 'DEMO_ISOLATION_VIOLATION');
    }
  }

  for (const d of drivers) {
    if (isCallerDemo && !d.isDemoData) {
      throw new AppError('Demo dispatchers cannot assign production drivers to batches.', 403, 'DEMO_ISOLATION_VIOLATION');
    }
    if (!isCallerDemo && d.isDemoData) {
      throw new AppError('Production dispatchers cannot assign demo drivers to batches.', 403, 'DEMO_ISOLATION_VIOLATION');
    }
  }
}
```

---

### 6. `client/src/context/DriverSocketContext.tsx` (provider / context, streaming / event-driven)

**Analog:** `client/src/context/DriverSocketContext.tsx`  
**Git Tracked:** Yes (`git ls-files client/src/context/DriverSocketContext.tsx`)

**Imports Pattern** (lines 1-20):
```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { createDriverSocket } from '../utils/driverSocket';
import { toast } from 'sonner';
```

**Multi-Event Listening & Reconnect Re-Sync Pattern** (lines 344-380):
```typescript
const handleDeliveryUpdated = (payload: any) => {
  if (!belongsToThisDriver(payload)) return;
  triggerRefresh();
};

socketInstance.on('route:dispatched', handleRouteDispatched);
socketInstance.on('route:reordered', handleRouteReordered);
socketInstance.on('route:updated', handleRouteReordered);
socketInstance.on('delivery:updated', handleDeliveryUpdated);
socketInstance.on('delivery:status_changed', handleDeliveryUpdated);
socketInstance.on('driver:stop_progressed', handleDeliveryUpdated);
socketInstance.on('route:progress', handleDeliveryUpdated);

// Reconnection room re-join and sync
socketInstance.io.on('reconnect', () => {
  if (driverIdRef.current) {
    socketInstance.emit('driver:join', { driverId: driverIdRef.current });
  }
  if (activeRouteIdRef.current) {
    socketInstance.emit('route:join', { routeId: activeRouteIdRef.current });
  }
  triggerRefresh();
});
```

**Visibility & Focus Debounced Re-Sync Hook Pattern** (lines 400-420):
```typescript
// Background to foreground PWA visibility reconciliation
useEffect(() => {
  let timer: NodeJS.Timeout | null = null;
  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        triggerRefresh();
      }, 500);
    }
  };

  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  window.addEventListener('focus', onVisibilityOrFocus);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    window.removeEventListener('focus', onVisibilityOrFocus);
    if (timer) clearTimeout(timer);
  };
}, [triggerRefresh]);
```

---

### 7. `client/src/pages/driver/DriverCockpitPage.tsx` (component / page, streaming / request-response)

**Analog:** `client/src/pages/driver/DriverCockpitPage.tsx`  
**Git Tracked:** Yes (`git ls-files client/src/pages/driver/DriverCockpitPage.tsx`)

**Demo Account Detection & Amber Status Banner Pattern** (render at top of cockpit container, lines 305-316):
```tsx
import { AlertTriangle, RotateCw, Navigation, CheckCircle2, XCircle } from 'lucide-react';

const isDemoUser = Boolean(
  user?.isDemoData || user?.email?.toLowerCase().endsWith('@smartroute.local')
);

return (
  <div ref={cockpitRef} className="flex-1 min-h-0 overflow-y-auto smooth-scroll overscroll-y-contain w-full max-w-7xl mx-auto p-4 md:p-6 pb-24 space-y-4 md:space-y-6 select-none">
    {/* Amber Demo Status Banner per D-04 & UI-SPEC */}
    {isDemoUser && (
      <div
        data-testid="demo-handheld-banner"
        role="status"
        className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-xs backdrop-blur-xs rounded-lg"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Demo Driver Session — Simulated Handheld</span>
      </div>
    )}
```

**Visibility Re-Fetch Pattern:**
```tsx
useEffect(() => {
  let timer: NodeJS.Timeout | null = null;
  const handleFocus = () => {
    if (document.visibilityState === 'visible') {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshAll();
      }, 500);
    }
  };

  document.addEventListener('visibilitychange', handleFocus);
  window.addEventListener('focus', handleFocus);
  return () => {
    document.removeEventListener('visibilitychange', handleFocus);
    window.removeEventListener('focus', handleFocus);
    if (timer) clearTimeout(timer);
  };
}, [refreshAll]);
```

---

### 8. `client/src/pages/driver/DriverRoutePage.tsx` (component / page, streaming / request-response)

**Analog:** `client/src/pages/driver/DriverRoutePage.tsx`  
**Git Tracked:** Yes (`git ls-files client/src/pages/driver/DriverRoutePage.tsx`)

**Sticky Amber Demo Pill & Visibility Sync Pattern** (lines 183-200):
```tsx
const isDemoUser = Boolean(
  user?.isDemoData || user?.email?.toLowerCase().endsWith('@smartroute.local')
);

return (
  <div ref={hudRef} className="flex-1 min-h-0 relative flex flex-col w-full h-full overflow-hidden select-none">
    {/* Top Demo Banner if simulated demo session */}
    {isDemoUser && (
      <div
        data-testid="demo-handheld-banner"
        role="status"
        className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-1 text-xs font-bold flex items-center justify-center gap-2"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Demo Driver Session — Simulated Handheld</span>
      </div>
    )}
```

---

### 9. `client/src/components/deliveries/BatchComposerPanel.tsx` & `client/src/pages/admin/RoutePlannerPage.tsx` (components, request-response / CRUD)

**Analogs:**
- `client/src/components/deliveries/BatchComposerPanel.tsx` (Git Tracked)
- `client/src/hooks/useRoutePlanner.ts` (Git Tracked)

**Dropdown Filtering Pattern:**
```typescript
const { user } = useAuth();
const isDemoDispatcher = Boolean(
  user?.isDemoData || user?.email?.toLowerCase().endsWith('@smartroute.local')
);

// Filter available vehicles & drivers based on demo status
const filteredVehicles = useMemo(() => {
  return vehicles.filter((v) => (isDemoDispatcher ? Boolean(v.isDemoData) : !v.isDemoData));
}, [vehicles, isDemoDispatcher]);

const filteredDrivers = useMemo(() => {
  return drivers.filter((d) => (isDemoDispatcher ? Boolean(d.isDemoData) : !d.isDemoData));
}, [drivers, isDemoDispatcher]);
```

**DEMO_ISOLATION_VIOLATION Error Callout:**
```tsx
{error?.code === 'DEMO_ISOLATION_VIOLATION' && (
  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
    Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.
  </div>
)}
```

---

### 10. `server/tests/phase21_driver_sync_demo_isolation.test.js` (test, integration / request-response)

**Analog:** `server/tests/phase20_mishap_guards.test.js` (lines 1-60) and `server/tests/driver_hud.test.js` (lines 1-60)  
**Git Tracked:** Yes (`git ls-files server/tests/phase20_mishap_guards.test.js`)

**Test Setup & Assertion Pattern:**
```javascript
const request = require('supertest');
const app = require('../src/app');
const Route = require('../src/models/Route');
const Delivery = require('../src/models/Delivery');
const Driver = require('../src/models/Driver');
const Vehicle = require('../src/models/Vehicle');
const DeliveryBatch = require('../src/models/DeliveryBatch');
const {
  createTestUser,
  createTestVehicle,
  createTestDriver,
  createTestDelivery,
} = require('./helpers/testUtils');

describe('Phase 21: Driver Sync & Demo Account Isolation', () => {
  let demoDispatcherToken;
  let prodDispatcherToken;
  let demoDriver;
  let prodDriver;

  beforeEach(async () => {
    // Setup demo and prod accounts
  });

  describe('DRIVER-SYNC-02: Dual-Model Atomic Stop Progression', () => {
    test('markDeliveryArrived atomically updates Route.stops[i].status and Delivery.status', async () => {
      // assert 200, Route stop is ARRIVED, Delivery is OUT_FOR_DELIVERY
    });
  });

  describe('DEMO-ISOLATION-01: Demo Dispatch & Push Boundary Enforcement', () => {
    test('Demo dispatcher assigning prod driver returns 403 DEMO_ISOLATION_VIOLATION', async () => {
      // assert 403 DEMO_ISOLATION_VIOLATION
    });
  });
});
```

---

### 11. `client/src/pages/driver/__tests__/DriverCockpitDemoBanner.test.tsx` (test, unit / component)

**Analog:** `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` (lines 1-60)  
**Git Tracked:** Yes (`git ls-files client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx`)

**Vitest Component Test Pattern:**
```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DriverCockpitPage } from '../DriverCockpitPage';
import { AuthContext } from '../../../context/AuthContext';

describe('DriverCockpitDemoBanner (DEMO-ISOLATION-02)', () => {
  it('renders sticky amber banner when user has isDemoData === true', () => {
    const mockAuth = {
      user: { id: 'd1', name: 'Demo Driver', email: 'rajesh.driver@smartroute.local', role: 'DRIVER', isDemoData: true },
      // ...auth context values
    };

    render(
      <AuthContext.Provider value={mockAuth as any}>
        <DriverCockpitPage />
      </AuthContext.Provider>
    );

    const banner = screen.getByTestId('demo-handheld-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Demo Driver Session — Simulated Handheld');
  });

  it('does NOT render demo banner for production drivers', () => {
    const mockAuth = {
      user: { id: 'd2', name: 'Real Driver', email: 'driver@smartroute.in', role: 'DRIVER', isDemoData: false },
      // ...auth context values
    };

    render(
      <AuthContext.Provider value={mockAuth as any}>
        <DriverCockpitPage />
      </AuthContext.Provider>
    );

    expect(screen.queryByTestId('demo-handheld-banner')).not.toBeInTheDocument();
  });
});
```

---

## Shared Patterns

### 1. Dual-Model Atomic Stop Progression with `withTransaction`
**Source:** `server/src/utils/transactionHelper.js:36-55`  
**Apply to:** `driverHudController.js` (`markDeliveryArrived`, `completeDelivery`, `failDelivery`, `finalizeRouteIfFinished`)
```javascript
const { withTransaction } = require('../utils/transactionHelper');

await withTransaction(async (session) => {
  const sessionOpts = session ? { session } : {};
  delivery.status = nextStatus;
  await delivery.save(sessionOpts);

  if (route) {
    await Route.updateOne(
      { _id: route._id, 'stops.deliveryId': delivery._id },
      { $set: { 'stops.$.status': stopStatus } },
      sessionOpts
    );
  }
});
```

### 2. Multi-Room WebSocket Event Broadcast
**Source:** `server/src/services/socketService.js:125-156`  
**Apply to:** All status transitions in `driverHudController.js` and `socketService.js`
```javascript
// Broadcast to 3 destinations simultaneously:
// 1. management (fleet board)
// 2. driver:${driverId} (handheld context)
// 3. route:${routeId} (cockpit and route map)
['delivery:updated', 'delivery:status_changed', 'route:updated', 'driver:stop_progressed'].forEach(evt => {
  ioInstance.to('management').emit(evt, payload);
  if (payload.driverId) ioInstance.to(`driver:${payload.driverId}`).emit(evt, payload);
  if (payload.routeId) ioInstance.to(`route:${payload.routeId}`).emit(evt, payload);
});
```

### 3. Strict Demo Isolation Assertion Helper
**Source:** `server/src/services/dispatch/dispatchExecutionService.js`  
**Apply to:** `dispatchExecutionService.js`, `routeController.js`, `batchController.js`
```javascript
function assertDemoIsolation({ actorUser, targetDriver, targetVehicle, targetRoute }) {
  const isActorDemo = Boolean(
    actorUser?.isDemoData || (actorUser?.email && actorUser.email.toLowerCase().endsWith('@smartroute.local'))
  );

  if (targetDriver) {
    const isDriverDemo = Boolean(targetDriver.isDemoData);
    if (isActorDemo !== isDriverDemo) {
      throw new AppError(
        isActorDemo
          ? 'Demo dispatchers cannot assign or dispatch to production drivers.'
          : 'Production dispatchers cannot assign or dispatch to demo drivers.',
        403,
        'DEMO_ISOLATION_VIOLATION'
      );
    }
  }

  if (targetVehicle) {
    const isVehicleDemo = Boolean(targetVehicle.isDemoData);
    if (isActorDemo !== isVehicleDemo) {
      throw new AppError(
        isActorDemo
          ? 'Demo dispatchers cannot assign or dispatch to production vehicles.'
          : 'Production dispatchers cannot assign or dispatch to demo vehicles.',
        403,
        'DEMO_ISOLATION_VIOLATION'
      );
    }
  }
}
```

### 4. Debounced Visibility & Focus State Reconciliation
**Source:** `client/src/context/DriverSocketContext.tsx`  
**Apply to:** `DriverSocketContext.tsx`, `DriverCockpitPage.tsx`, `DriverRoutePage.tsx`
```typescript
useEffect(() => {
  let timer: NodeJS.Timeout | null = null;
  const onFocusOrVisible = () => {
    if (document.visibilityState === 'visible') {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refetchState();
      }, 500); // 500ms debounce prevents tab-switching storms
    }
  };

  document.addEventListener('visibilitychange', onFocusOrVisible);
  window.addEventListener('focus', onFocusOrVisible);
  return () => {
    document.removeEventListener('visibilitychange', onFocusOrVisible);
    window.removeEventListener('focus', onFocusOrVisible);
    if (timer) clearTimeout(timer);
  };
}, [refetchState]);
```

---

## No Analog Found

*None. All 13 target files have exact or high-quality role matches in the existing codebase.*

---

## Metadata

**Analog search scope:**
- `server/src/controllers/`
- `server/src/services/`
- `server/src/middleware/`
- `server/tests/`
- `client/src/context/`
- `client/src/pages/driver/`
- `client/src/pages/admin/`
- `client/src/components/deliveries/`
- `client/src/components/admin/__tests__/`

**Files scanned:** 18  
**Pattern extraction date:** 2026-11-20  
