const mongoose = require('mongoose');
const Route = require('../../models/Route');
const DeliveryBatch = require('../../models/DeliveryBatch');
const Delivery = require('../../models/Delivery');
const Vehicle = require('../../models/Vehicle');
const Driver = require('../../models/Driver');
const VehicleAssignment = require('../../models/VehicleAssignment');
const RouteAssignment = require('../../models/RouteAssignment');
const OrganizationSettings = require('../../models/OrganizationSettings');
const socketService = require('../socketService');
const {
  validateDispatchEligibility,
  createOrUpdateRouteFromSequence,
} = require('../dispatchEligibilityService');
const { recordAuditEvent } = require('../auditService');
const { withTransaction } = require('../../utils/transactionHelper');
const { AppError } = require('../../middleware/errorHandler');
const {
  AUDIT_EVENT_TYPES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
} = require('../../config/constants');

/**
 * Executes full dispatch lifecycle for a route or batch atomically.
 * Encapsulates pre-dispatch eligibility checks, multi-document transaction updates,
 * audit trail logging, and real-time Socket.IO broadcasts.
 *
 * @param {Object} params
 * @param {string} [params.routeId]
 * @param {string} [params.batchId]
 * @param {string} [params.vehicleId]
 * @param {string} [params.driverId]
 * @param {Array<string>} [params.confirmedStopSequence]
 * @param {Array<string>} [params.deliveryIds]
 * @param {Object} [params.req] - Express request context for user audit and app socket
 * @returns {Promise<Object>}
 */
async function executeDispatch({
  routeId,
  batchId,
  vehicleId,
  driverId,
  confirmedStopSequence,
  deliveryIds,
  req = {},
}) {
  let route = null;
  let batch = null;

  // 1. Resolve Target Route or Batch from routeId
  if (routeId && mongoose.Types.ObjectId.isValid(routeId)) {
    route = await Route.findById(routeId);
    if (!route) {
      batch = await DeliveryBatch.findById(routeId);
    }
  }

  // If not found yet and batchId is provided, resolve batch
  if (!batch && batchId && mongoose.Types.ObjectId.isValid(batchId)) {
    batch = await DeliveryBatch.findById(batchId);
  }

  if (!route && !batch) {
    throw new AppError(`Route not found for ID '${routeId}'`, 404, 'ROUTE_NOT_FOUND');
  }

  // If route exists, check if already dispatched or completed
  if (route && ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(route.status)) {
    throw new AppError(
      `Route ${route.routeCode || route._id} is already in status '${route.status}' and cannot be re-dispatched`,
      409,
      'INVALID_ROUTE_STATUS'
    );
  }

  // 2. Comprehensive Pre-Dispatch Eligibility Validation
  const validation = await validateDispatchEligibility({
    routeId: route ? route._id : undefined,
    batchId: batch ? batch._id : (route ? route.batchId : undefined),
    vehicleId: vehicleId || (route ? route.vehicleId : undefined),
    driverId: driverId || (route ? route.driverId : undefined),
    stopSequence: confirmedStopSequence || deliveryIds,
    allowPartialEligible: true,
  });

  if (!validation.canDispatch) {
    let statusCode = 400;
    let errorCode = 'DISPATCH_INELIGIBLE';
    const errLower = (validation.error || '').toLowerCase();

    if (errLower.includes('already in status')) {
      statusCode = 409;
      errorCode = 'INVALID_ROUTE_STATUS';
    } else if (errLower.includes('capacity')) {
      errorCode = 'CAPACITY_EXCEEDED';
    } else if (errLower.includes('vehicle')) {
      errorCode = 'VEHICLE_UNAVAILABLE';
    } else if (errLower.includes('driver')) {
      errorCode = 'DRIVER_UNAVAILABLE';
    } else if (errLower.includes('no eligible deliveries')) {
      errorCode = 'NO_ELIGIBLE_DELIVERIES';
    }

    throw new AppError(validation.error, statusCode, errorCode, {
      ineligibilityReasons: validation.ineligibilityReasons,
      ineligibleDeliveries: validation.ineligibleDeliveries,
    });
  }

  const { vehicle, driver, eligibleDeliveries, ineligibleDeliveries } = validation;
  const targetBatch = batch || validation.batch || (route ? await DeliveryBatch.findById(route.batchId) : null);

  // Retrieve OrganizationSettings for tariffs
  let tariffs = {};
  try {
    const settings = await OrganizationSettings.getSettings();
    tariffs = settings?.tariffs || {};
  } catch {
    tariffs = {};
  }

  // 3. If Route does not yet exist, create it in original manifest sequence
  if (!route) {
    const created = await createOrUpdateRouteFromSequence({
      batch: targetBatch,
      deliveries: eligibleDeliveries,
      vehicle,
      driver,
      tariffs,
      isOptimized: false,
      algorithmUsed: 'ORIGINAL_MANIFEST',
    });
    route = created.route;
  } else if (ineligibleDeliveries.length > 0) {
    const eligibleIdSet = new Set(eligibleDeliveries.map((d) => d._id.toString()));
    route.stops = route.stops
      .filter((s) => s.deliveryId && eligibleIdSet.has(s.deliveryId.toString()))
      .map((s, idx) => {
        s.sequence = idx + 1;
        return s;
      });
    route.metrics.totalStops = route.stops.length;
  }

  // 4. Execute Multi-Collection State Machine Transitions Atomically
  await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // 4a. Transition Route
    route.status = 'DISPATCHED';
    route.driverId = driver._id;
    route.vehicleId = vehicle._id;
    route.dispatchedAt = new Date();
    route.version = (route.version || 1) + 1;
    await route.save(sessionOpts);

    // 4b. Create or Update VehicleAssignment & RouteAssignment records idempotently
    try {
      await VehicleAssignment.findOneAndUpdate(
        { routeId: route._id, vehicleId: vehicle._id, driverId: driver._id, status: { $in: ['PENDING', 'ACTIVE'] } },
        {
          $set: {
            startTime: new Date(),
            endTime: new Date(Date.now() + (route.metrics?.totalDurationMin || 60) * 60000),
            status: 'PENDING',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOpts }
      );
    } catch (assignErr) {
      console.warn(`[Dispatch] VehicleAssignment upsert note: ${assignErr.message}`);
    }

    try {
      await RouteAssignment.findOneAndUpdate(
        { routeId: route._id, vehicleId: vehicle._id, driverId: driver._id, status: { $in: ['PENDING', 'DISPATCHED', 'IN_PROGRESS'] } },
        {
          $set: {
            startTime: new Date(),
            expectedEndTime: new Date(Date.now() + (route.metrics?.totalDurationMin || 60) * 60000),
            status: 'PENDING',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOpts }
      );
    } catch (raErr) {
      console.warn(`[Dispatch] RouteAssignment upsert note: ${raErr.message}`);
    }

    // 4c. Release previous vehicle/driver mutual bindings
    await Vehicle.updateMany(
      { _id: { $ne: vehicle._id }, assignedDriverId: driver._id },
      { $set: { assignedDriverId: null, availability: VEHICLE_STATUS.AVAILABLE } },
      sessionOpts
    );

    if (driver.assignedVehicleId && driver.assignedVehicleId.toString() !== vehicle._id.toString()) {
      await Vehicle.findByIdAndUpdate(
        driver.assignedVehicleId,
        { assignedDriverId: null, availability: VEHICLE_STATUS.AVAILABLE },
        sessionOpts
      );
    }
    if (vehicle.assignedDriverId && vehicle.assignedDriverId.toString() !== driver._id.toString()) {
      await Driver.findByIdAndUpdate(
        vehicle.assignedDriverId,
        { assignedVehicleId: null },
        sessionOpts
      );
    }

    vehicle.availability = VEHICLE_STATUS.IN_TRANSIT;
    vehicle.assignedDriverId = driver._id;
    await vehicle.save(sessionOpts);

    driver.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
    driver.assignedVehicleId = vehicle._id;
    driver.currentRouteId = route._id;
    await driver.save(sessionOpts);

    // 4d. Transition Associated Deliveries to ASSIGNED
    const deliveryIdsToUpdate = eligibleDeliveries.map((d) => d._id);
    if (deliveryIdsToUpdate.length > 0) {
      await Delivery.updateMany(
        { _id: { $in: deliveryIdsToUpdate } },
        {
          $set: {
            status: DELIVERY_STATUS.ASSIGNED,
            assignedVehicleId: vehicle._id,
            assignedDriverId: driver._id,
          },
        },
        sessionOpts
      );
    }

    // 4e. Update Batch Metrics
    if (targetBatch) {
      targetBatch.metrics = targetBatch.metrics || {};
      targetBatch.metrics.assignedDeliveries = (targetBatch.metrics.assignedDeliveries || 0) + deliveryIdsToUpdate.length;
      if (targetBatch.status === 'READY' || targetBatch.status === 'DRAFT') {
        targetBatch.status = 'PLANNED';
      }
      await targetBatch.save(sessionOpts);
    }

    // 4f. Immutable Audit Event
    const isOriginal = route.optimizationMetadata?.algorithm === 'ORIGINAL_MANIFEST';
    await recordAuditEvent({
      routeId: route._id,
      batchId: route.batchId,
      type: AUDIT_EVENT_TYPES.ROUTE_DISPATCHED,
      actorId: req.user ? (req.user.id || req.user._id) : null,
      actorRole: req.user ? req.user.role : 'ADMIN',
      action: `Dispatched route ${route.routeCode} with ${route.stops.length} stops to driver ${driver.licenseNumber || driver._id}${isOriginal ? ' (dispatched without optimization)' : ''}`,
      metadata: {
        version: route.version,
        driverId: driver._id,
        vehicleId: vehicle._id,
        stopsCount: route.stops.length,
        isOriginalSequence: isOriginal,
        ineligibleDeliveriesCount: ineligibleDeliveries.length,
      },
    });
  });

  // 5. Real-Time Broadcast (Post-Commit)
  const dispatchPayload = {
    routeId: route._id.toString(),
    routeCode: route.routeCode,
    driverId: driver._id.toString(),
    vehicleId: vehicle._id.toString(),
    stopsCount: route.stops.length,
    version: route.version,
  };

  // Broadcast using centralized room-scoped socketService
  try {
    socketService.emitRouteDispatched(dispatchPayload);
  } catch (err) {
    console.warn(`[SocketService] emitRouteDispatched warning: ${err.message}`);
  }

  return {
    route,
    version: route.version,
    status: 'DISPATCHED',
    dispatchedStopsCount: route.stops.length,
    ineligibleDeliveries,
  };
}

module.exports = {
  executeDispatch,
};
