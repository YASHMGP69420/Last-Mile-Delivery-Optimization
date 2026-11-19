const mongoose = require('mongoose');
const Route = require('../models/Route');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const DriverShift = require('../models/DriverShift');
const VehicleAssignment = require('../models/VehicleAssignment');
const AuditEvent = require('../models/AuditEvent');
const SystemNotification = require('../models/SystemNotification');
const socketService = require('./socketService');
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

/**
 * Execute atomic mishap orphan recovery cascade
 * Rescues uncompleted deliveries to READY with Urgent priority,
 * preserves completed POD signatures intact,
 * cancels active route, force-closes driver shift,
 * and releases or marks maintenance for assigned vehicles.
 */
const recoverDriverMishapCascade = async ({
  driverId = null,
  routeId = null,
  actor = null,
  reason = 'DRIVER_ACCOUNT_DELETED',
  mishapCategory = 'DRIVER_REMOVED',
} = {}) => {
  let activeRouteData = null;
  const rescuedDeliveryIds = [];
  let closedShiftId = null;
  let targetVehicleId = null;

  await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // 1. Locate active route
    const routeQuery = {
      status: { $in: ['DISPATCHED', 'IN_PROGRESS', 'OPTIMIZED'] },
    };
    if (routeId) {
      routeQuery._id = routeId;
    } else if (driverId) {
      routeQuery.driverId = driverId;
    }

    const activeRoute = (routeId || driverId)
      ? await Route.findOne(routeQuery, null, sessionOpts)
      : null;

    // 2. Locate active shift
    const shiftQuery = {
      status: SHIFT_STATUS.IN_PROGRESS,
    };
    if (driverId) {
      shiftQuery.driverId = driverId;
    } else if (activeRoute?.driverId) {
      shiftQuery.driverId = activeRoute.driverId;
    }

    const activeShift = (driverId || activeRoute?.driverId)
      ? await DriverShift.findOne(shiftQuery, null, sessionOpts)
      : null;

    const resolvedDriverId = driverId || activeRoute?.driverId || activeShift?.driverId || null;

    // 3. Process route stops & deliveries
    if (activeRoute) {
      activeRouteData = {
        _id: activeRoute._id,
        routeCode: activeRoute.routeCode,
        driverId: resolvedDriverId ? resolvedDriverId.toString() : null,
      };

      if (activeRoute.vehicleId) {
        targetVehicleId = activeRoute.vehicleId;
      }

      for (const stop of activeRoute.stops) {
        if (stop.status === 'COMPLETED') {
          // Preserve completed deliveries and proofOfDelivery intact per D-02
          continue;
        }

        // Uncompleted stop (PENDING, ARRIVED, OUT_FOR_DELIVERY, FAILED)
        // Transition delivery to READY with Urgent priority and cleared assignments
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
        stop.status = 'FAILED';

        // Record AuditEvent for each rescued delivery
        const actorId = actor?._id || actor?.id || resolvedDriverId || new mongoose.Types.ObjectId();
        const actorRole = actor?.role || 'SYSTEM';

        const auditDoc = new AuditEvent({
          deliveryId: stop.deliveryId,
          routeId: activeRoute._id,
          batchId: activeRoute.batchId || null,
          type: AUDIT_EVENT_TYPES.EXCEPTION_REPORTED,
          actorId,
          actorRole,
          action: `[MISHAP_RESCUE] Consignment rescued to READY dispatch pool with Urgent priority. Reason: ${reason}`,
          metadata: {
            previousRouteCode: activeRoute.routeCode,
            mishapCategory,
            reason,
          },
        });
        await auditDoc.save(sessionOpts);
      }

      // Cancel route with reason per D-03
      activeRoute.status = 'CANCELLED';
      activeRoute.cancellationReason = reason;
      await activeRoute.save(sessionOpts);
    }

    // 4. Force-close driver shift per D-03
    if (activeShift) {
      activeShift.status = SHIFT_STATUS.FORCE_CLOSED;
      activeShift.endTime = new Date().toTimeString().slice(0, 5);
      activeShift.notes = (activeShift.notes ? activeShift.notes + ' | ' : '') + `Force-closed: ${reason}`;
      await activeShift.save(sessionOpts);
      closedShiftId = activeShift._id.toString();
    }

    // 5. Unlink vehicle assignments
    const vAssignQuery = { status: { $in: ['PENDING', 'ACTIVE'] } };
    const vOr = [];
    if (resolvedDriverId) vOr.push({ driverId: resolvedDriverId });
    if (activeRoute?._id) vOr.push({ routeId: activeRoute._id });
    if (targetVehicleId) vOr.push({ vehicleId: targetVehicleId });
    if (vOr.length > 0) {
      vAssignQuery.$or = vOr;
      await VehicleAssignment.updateMany(
        vAssignQuery,
        { $set: { status: 'CANCELLED' } },
        sessionOpts
      );
    }

    // 6. Reset Vehicle status & release locks
    const vehicleAvailability = mishapCategory === 'VEHICLE_BREAKDOWN'
      ? VEHICLE_STATUS.MAINTENANCE
      : VEHICLE_STATUS.AVAILABLE;

    if (targetVehicleId) {
      await Vehicle.findByIdAndUpdate(
        targetVehicleId,
        { $set: { assignedDriverId: null, availability: vehicleAvailability } },
        sessionOpts
      );
    }

    // 7. Update Driver if exists
    if (resolvedDriverId) {
      const driver = await Driver.findById(resolvedDriverId, null, sessionOpts);
      if (driver) {
        if (driver.assignedVehicleId && (!targetVehicleId || driver.assignedVehicleId.toString() !== targetVehicleId.toString())) {
          await Vehicle.findByIdAndUpdate(
            driver.assignedVehicleId,
            { $set: { assignedDriverId: null, availability: vehicleAvailability } },
            sessionOpts
          );
        }
        driver.assignedVehicleId = null;
        driver.currentRouteId = null;
        driver.availability = DRIVER_AVAILABILITY.OFF_DUTY;
        await driver.save(sessionOpts);
      }
    }

    // 8. Create critical SystemNotification per D-04
    const notifTitle = `[MISHAP ALERT] ${rescuedDeliveryIds.length} Consignments Rescued`;
    const notifMessage = `In-transit disruption occurred: ${reason}. Route ${activeRouteData?.routeCode || 'N/A'} cancelled, driver shift closed, and ${rescuedDeliveryIds.length} orders returned to dispatch pool with Urgent priority.`;

    const notificationDoc = new SystemNotification({
      title: notifTitle,
      message: notifMessage,
      category: 'SAFETY',
      severity: NOTIFICATION_SEVERITIES.CRITICAL,
      targetRole: 'ADMIN',
      metadata: {
        routeId: activeRouteData?._id?.toString() || null,
        routeCode: activeRouteData?.routeCode || null,
        driverId: resolvedDriverId ? resolvedDriverId.toString() : null,
        rescuedCount: rescuedDeliveryIds.length,
        mishapCategory,
        reason,
      },
    });
    await notificationDoc.save(sessionOpts);
  });

  // Post-commit: Multi-channel broadcast outside transaction boundary per D-04
  try {
    if (activeRouteData) {
      socketService.emitRouteCancelled({
        routeId: activeRouteData._id.toString(),
        routeCode: activeRouteData.routeCode,
        driverId: activeRouteData.driverId,
        reason,
        rescuedCount: rescuedDeliveryIds.length,
      });
    }

    socketService.emitDeliveriesReassigned({
      driverId: activeRouteData?.driverId || (driverId ? driverId.toString() : null),
      routeId: activeRouteData?._id?.toString() || null,
      routeCode: activeRouteData?.routeCode || null,
      rescuedDeliveryIds,
      count: rescuedDeliveryIds.length,
      reason,
    });

    socketService.emitDriverIncident({
      driverId: activeRouteData?.driverId || (driverId ? driverId.toString() : null),
      routeId: activeRouteData?._id?.toString() || null,
      routeCode: activeRouteData?.routeCode || null,
      incidentCategory: mishapCategory,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch (socketErr) {
    console.warn(`[SocketBroadcast] Failed to emit mishap recovery events: ${socketErr.message}`);
  }

  return {
    success: true,
    rescuedCount: rescuedDeliveryIds.length,
    rescuedDeliveryIds,
    routeId: activeRouteData?._id?.toString() || null,
    routeCode: activeRouteData?.routeCode || null,
    shiftId: closedShiftId,
    reason,
  };
};

module.exports = {
  recoverDriverMishapCascade,
};
