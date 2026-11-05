const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const Delivery = require('../models/Delivery');
const DriverShift = require('../models/DriverShift');
const VehicleChecklist = require('../models/VehicleChecklist');
const DriverIncident = require('../models/DriverIncident');
const SystemNotification = require('../models/SystemNotification');
const AuditEvent = require('../models/AuditEvent');
const {
  ROLES,
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  SHIFT_STATUS,
  CHECKLIST_STATUS,
  FAILURE_REASONS,
  AUDIT_EVENT_TYPES,
} = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

/**
 * Helper to resolve driver document for authenticated user
 */
const resolveDriver = async (req) => {
  let driver = null;
  if (req.user.role === ROLES.DRIVER) {
    driver = await Driver.findOne({ userId: req.user.id }).populate('assignedVehicleId');
    if (!driver) {
      throw new AppError('Driver operational profile not found for this user account', 404, 'DRIVER_PROFILE_NOT_FOUND');
    }
  } else if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.FLEET_MANAGER) {
    // Admin / Manager simulation mode: use requested driverId or first available
    const driverId = req.query.driverId || req.body.driverId;
    if (driverId) {
      driver = await Driver.findById(driverId).populate('assignedVehicleId');
    } else {
      driver = await Driver.findOne().populate('assignedVehicleId');
    }
    if (!driver) {
      throw new AppError('No driver record available in database', 404, 'NO_DRIVERS_FOUND');
    }
  } else {
    throw new AppError('Access restricted to Driver accounts', 403, 'FORBIDDEN');
  }
  return driver;
};

/**
 * GET /api/v1/driver-hud/dashboard
 * Real-time operational cockpit dashboard metrics
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);

    // Active shift
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeShift = await DriverShift.findOne({
      driverId: driver._id,
      status: { $in: [SHIFT_STATUS.IN_PROGRESS, SHIFT_STATUS.SCHEDULED] },
    }).sort({ createdAt: -1 });

    // Active Route
    const activeRoute = await Route.findOne({
      driverId: driver._id,
      status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
    }).populate('vehicleId', 'registrationNumber type fuelType capacityKg status');

    // Pre-trip checklist for vehicle today
    let latestChecklist = null;
    if (driver.assignedVehicleId) {
      latestChecklist = await VehicleChecklist.findOne({
        vehicleId: driver.assignedVehicleId._id || driver.assignedVehicleId,
        createdAt: { $gte: today },
      }).sort({ createdAt: -1 });
    }

    // Performance metrics
    let assignedCount = 0;
    let completedCount = 0;
    let remainingCount = 0;
    let failedCount = 0;
    let routeDistanceKm = 0;
    let routeEta = 'N/A';

    if (activeRoute) {
      routeDistanceKm = activeRoute.metrics?.totalDistanceKm || 0;
      routeEta = activeRoute.metrics?.estimatedDurationMinutes ? `${activeRoute.metrics.estimatedDurationMinutes} mins` : 'Pending';

      assignedCount = activeRoute.stops.length;
      completedCount = activeRoute.stops.filter((s) => s.status === 'COMPLETED').length;
      failedCount = activeRoute.stops.filter((s) => s.status === 'FAILED').length;
      remainingCount = assignedCount - completedCount - failedCount;
    }

    res.status(200).json({
      success: true,
      data: {
        driver: {
          id: driver._id.toString(),
          name: req.user.name,
          licenseNumber: driver.licenseNumber,
          phone: driver.phone,
          availability: driver.availability,
          rating: driver.rating,
          onTimeRuns: driver.onTimeRuns,
        },
        shift: activeShift
          ? {
              id: activeShift._id.toString(),
              status: activeShift.status,
              startTime: activeShift.startTime,
              endTime: activeShift.endTime,
              breakMinutes: activeShift.breakDurationMinutes,
            }
          : null,
        vehicle: driver.assignedVehicleId
          ? {
              id: driver.assignedVehicleId._id?.toString() || driver.assignedVehicleId.toString(),
              registrationNumber: driver.assignedVehicleId.registrationNumber || 'Assigned Van',
              type: driver.assignedVehicleId.type || 'Van',
              fuelType: driver.assignedVehicleId.fuelType || 'Electric',
              status: driver.assignedVehicleId.status || 'AVAILABLE',
            }
          : null,
        checklistCompleted: Boolean(latestChecklist && latestChecklist.status === 'PASSED'),
        latestChecklist,
        activeRoute: activeRoute
          ? {
              id: activeRoute._id.toString(),
              routeCode: activeRoute.routeCode,
              batchId: activeRoute.batchId,
              status: activeRoute.status,
              depot: activeRoute.depot,
              totalStops: assignedCount,
              completedStops: completedCount,
              remainingStops: remainingCount,
              failedStops: failedCount,
              totalDistanceKm: routeDistanceKm,
              eta: routeEta,
            }
          : null,
        metrics: {
          assignedDeliveries: assignedCount,
          completedDeliveries: completedCount,
          remainingStops: remainingCount,
          failedDeliveries: failedCount,
          todayDistanceKm: routeDistanceKm,
          currentRouteEta: routeEta,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/shifts/start
 * Clock in and start active shift
 */
exports.startShift = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);

    // Check if shift already in progress
    const active = await DriverShift.findOne({
      driverId: driver._id,
      status: SHIFT_STATUS.IN_PROGRESS,
    });
    if (active) {
      return res.status(200).json({
        success: true,
        message: 'Shift is already in progress',
        data: { shift: active },
      });
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const shift = await DriverShift.create({
      driverId: driver._id,
      date: today,
      startTime: timeStr,
      endTime: '18:00',
      status: SHIFT_STATUS.IN_PROGRESS,
      breakDurationMinutes: 0,
      notes: 'Driver started shift via Driver Cockpit',
    });

    driver.availability = DRIVER_AVAILABILITY.ON_DUTY;
    await driver.save();

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Clocked in shift at ${timeStr}`,
      type: AUDIT_EVENT_TYPES.SHIFT_CHANGE,
      metadata: { shiftId: shift._id.toString(), driverId: driver._id.toString() },
    });

    res.status(201).json({
      success: true,
      message: 'Shift started successfully',
      data: { shift },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/shifts/break
 * Toggle break status
 */
exports.toggleBreak = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { onBreak, breakDurationMinutes } = req.body;

    const shift = await DriverShift.findOne({
      driverId: driver._id,
      status: SHIFT_STATUS.IN_PROGRESS,
    });
    if (!shift) {
      throw new AppError('No active shift found. Start shift before taking a break', 400, 'NO_ACTIVE_SHIFT');
    }

    if (onBreak) {
      driver.availability = DRIVER_AVAILABILITY.ON_BREAK;
    } else {
      driver.availability = DRIVER_AVAILABILITY.ON_DUTY;
      if (breakDurationMinutes) {
        shift.breakDurationMinutes += Number(breakDurationMinutes);
        await shift.save();
      }
    }
    await driver.save();

    res.status(200).json({
      success: true,
      message: onBreak ? 'Break started' : 'Break ended, back on duty',
      data: { availability: driver.availability, shift },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/shifts/end
 * Clock out and end shift with safety check
 */
exports.endShift = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { handoverNotes } = req.body;

    // Safety guard: check if active route has remaining incomplete deliveries
    const activeRoute = await Route.findOne({
      driverId: driver._id,
      status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
    });

    if (activeRoute) {
      const pendingStops = activeRoute.stops.filter((s) => s.status === 'PENDING' || s.status === 'ARRIVED');
      if (pendingStops.length > 0 && (!handoverNotes || handoverNotes.trim().length < 5)) {
        throw new AppError(
          `Cannot end shift: Route ${activeRoute.routeCode} has ${pendingStops.length} incomplete deliveries. Provide handover notes or complete remaining consignments.`,
          400,
          'INCOMPLETE_DELIVERIES_HANDOVER_REQUIRED'
        );
      }
    }

    const shift = await DriverShift.findOne({
      driverId: driver._id,
      status: SHIFT_STATUS.IN_PROGRESS,
    });

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (shift) {
      shift.endTime = timeStr;
      shift.status = SHIFT_STATUS.COMPLETED;
      if (handoverNotes) shift.notes = `${shift.notes || ''} | Handover: ${handoverNotes}`;
      await shift.save();
    }

    driver.availability = DRIVER_AVAILABILITY.OFF_DUTY;
    await driver.save();

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Clocked out shift at ${timeStr}`,
      type: AUDIT_EVENT_TYPES.SHIFT_CHANGE,
      metadata: { shiftId: shift?._id?.toString(), handoverNotes },
    });

    res.status(200).json({
      success: true,
      message: 'Shift ended successfully',
      data: { shift },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/vehicle-check
 * Submit pre-trip vehicle checklist
 */
exports.submitVehicleCheck = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const {
      vehicleId,
      odometerReadingKm = 0,
      fuelOrBatteryLevelPercent = 100,
      items,
      overallNotes = '',
      photoEvidenceUrl = '',
    } = req.body;

    const targetVehicleId = vehicleId || (driver.assignedVehicleId?._id || driver.assignedVehicleId);
    if (!targetVehicleId) {
      throw new AppError('No vehicle assigned or specified for inspection', 400, 'NO_VEHICLE_ASSIGNED');
    }

    const vehicle = await Vehicle.findById(targetVehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle record not found', 404, 'VEHICLE_NOT_FOUND');
    }

    // Evaluate critical items: brakes, tyres, lights, documents
    let hasCriticalFailure = false;
    let needsAttention = false;

    if (items) {
      const criticalKeys = ['brakes', 'tyres', 'lights', 'documents'];
      for (const key of criticalKeys) {
        if (items[key]?.status === CHECKLIST_STATUS.NEEDS_ATTENTION) {
          hasCriticalFailure = true;
          break;
        }
      }
      for (const key of Object.keys(items)) {
        if (items[key]?.status === CHECKLIST_STATUS.NEEDS_ATTENTION) {
          needsAttention = true;
        }
      }
    }

    const checklistStatus = hasCriticalFailure
      ? 'FAILED_CRITICAL'
      : needsAttention
      ? 'NEEDS_ATTENTION'
      : 'PASSED';

    const checklist = await VehicleChecklist.create({
      vehicleId: vehicle._id,
      driverId: driver._id,
      odometerReadingKm,
      fuelOrBatteryLevelPercent,
      items: items || {},
      hasCriticalFailure,
      status: checklistStatus,
      overallNotes,
      photoEvidenceUrl,
    });

    // If critical failure: suspend vehicle to MAINTENANCE and notify managers
    if (hasCriticalFailure) {
      vehicle.status = VEHICLE_STATUS.MAINTENANCE;
      await vehicle.save();

      await SystemNotification.create({
        title: `CRITICAL: Vehicle ${vehicle.registrationNumber} failed pre-trip safety check`,
        message: `Driver ${req.user.name} reported critical inspection failure on ${vehicle.registrationNumber}. Vehicle automatically placed in MAINTENANCE status. Notes: ${overallNotes || 'None'}`,
        severity: 'CRITICAL',
        category: 'SAFETY',
        targetRole: 'FLEET_MANAGER',
        metadata: { vehicleId: vehicle._id.toString(), driverId: driver._id.toString() },
      });
    }

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Submitted pre-trip checklist for ${vehicle.registrationNumber} (Result: ${checklistStatus})`,
      type: AUDIT_EVENT_TYPES.DRIVER_CHECKLIST_SUBMITTED,
      metadata: { vehicleId: vehicle._id.toString(), checklistStatus, hasCriticalFailure },
    });

    res.status(201).json({
      success: true,
      message: hasCriticalFailure
        ? 'Pre-trip checklist flagged CRITICAL safety items. Vehicle suspended to MAINTENANCE.'
        : 'Pre-trip inspection passed successfully.',
      data: { checklist, vehicleStatus: vehicle.status },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/route
 * Driver Navigation: Get active route geometry and stops
 */
exports.getActiveRoute = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);

    const route = await Route.findOne({
      driverId: driver._id,
      status: { $in: ['DISPATCHED', 'IN_PROGRESS', 'OPTIMIZED'] },
    }).populate('vehicleId', 'registrationNumber type fuelType capacityKg status');

    if (!route) {
      return res.status(200).json({
        success: true,
        data: { route: null, message: 'No active route currently dispatched for this driver' },
      });
    }

    // Populate actual delivery objects to include address, phone, customer, package weight
    const deliveryIds = route.stops.map((s) => s.deliveryId).filter(Boolean);
    const deliveries = await Delivery.find({ _id: { $in: deliveryIds } }).lean();
    const deliveryMap = new Map(deliveries.map((d) => [d._id.toString(), d]));

    const enrichedStops = route.stops.map((s) => {
      const del = deliveryMap.get(s.deliveryId?.toString()) || {};
      return {
        ...s.toObject(),
        delivery: del,
        coordinates: s.location ? [s.location.lng, s.location.lat] : [85.8645, 20.2961],
      };
    });

    res.status(200).json({
      success: true,
      data: {
        route: {
          ...route.toObject(),
          stops: enrichedStops,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/deliveries
 * List consignments for the driver's active route with status filtering
 */
exports.getDeliveries = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { status } = req.query;

    const route = await Route.findOne({
      driverId: driver._id,
      status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
    });

    if (!route) {
      return res.status(200).json({
        success: true,
        data: { deliveries: [] },
      });
    }

    const deliveryIds = route.stops.map((s) => s.deliveryId).filter(Boolean);
    const query = { _id: { $in: deliveryIds } };

    if (status && status !== 'ALL') {
      if (status === 'PENDING') {
        query.status = { $in: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.READY] };
      } else if (status === 'IN_TRANSIT') {
        query.status = DELIVERY_STATUS.OUT_FOR_DELIVERY;
      } else {
        query.status = status;
      }
    }

    const deliveries = await Delivery.find(query).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: { deliveries, routeCode: route.routeCode },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/deliveries/:id
 * Delivery details for single consignment
 */
exports.getDeliveryById = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      throw new AppError('Delivery consignment not found', 404, 'NOT_FOUND');
    }

    // BOLA Check: Verify delivery belongs to driver's active route or assignedDriverId
    const isAssigned = delivery.assignedDriverId?.toString() === driver._id.toString();
    const route = await Route.findOne({
      driverId: driver._id,
      'stops.deliveryId': delivery._id,
    });

    if (!isAssigned && !route && req.user.role === ROLES.DRIVER) {
      throw new AppError('Access denied: Consignment not assigned to this driver', 403, 'BOLA_VIOLATION');
    }

    res.status(200).json({
      success: true,
      data: { delivery },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/deliveries/:id/arrived
 * Mark arrival at delivery stop
 */
exports.markDeliveryArrived = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) throw new AppError('Delivery not found', 404, 'NOT_FOUND');

    delivery.status = DELIVERY_STATUS.OUT_FOR_DELIVERY;
    await delivery.save();

    // Update stop status in Route
    await Route.updateOne(
      { driverId: driver._id, 'stops.deliveryId': delivery._id },
      { $set: { 'stops.$.status': 'ARRIVED', status: 'IN_PROGRESS' } }
    );

    res.status(200).json({
      success: true,
      message: 'Marked arrived at customer destination',
      data: { delivery },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/deliveries/:id/complete
 * Submit Proof of Delivery (POD) and complete consignment
 */
exports.completeDelivery = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;
    const { recipientName, otp, signatureSvg, photoUrl, handoverNotes, temperatureReading } = req.body;

    const delivery = await Delivery.findById(id);
    if (!delivery) throw new AppError('Delivery not found', 404, 'NOT_FOUND');

    // OTP verification if configured on delivery
    let otpVerified = true;
    if (delivery.proofOfDelivery?.otp && otp) {
      otpVerified = delivery.proofOfDelivery.otp === String(otp).trim();
      if (!otpVerified) {
        throw new AppError('Invalid delivery verification PIN / OTP', 400, 'INVALID_OTP');
      }
    }

    delivery.status = DELIVERY_STATUS.COMPLETED;
    delivery.proofOfDelivery = {
      otp: otp || delivery.proofOfDelivery?.otp || null,
      otpVerified,
      signatureSvg: signatureSvg || null,
      photoUrl: photoUrl || null,
      handoverNotes: handoverNotes || `Delivered to ${recipientName || delivery.customer.name}`,
      temperatureReading: temperatureReading !== undefined ? Number(temperatureReading) : null,
    };
    await delivery.save();

    // Update stop in Route
    const route = await Route.findOne({ driverId: driver._id, 'stops.deliveryId': delivery._id });
    if (route) {
      await Route.updateOne(
        { _id: route._id, 'stops.deliveryId': delivery._id },
        { $set: { 'stops.$.status': 'COMPLETED' } }
      );

      // Check if all stops in route are completed
      const updatedRoute = await Route.findById(route._id);
      const remaining = updatedRoute.stops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
      if (remaining.length === 0) {
        updatedRoute.status = 'COMPLETED';
        await updatedRoute.save();

        driver.onTimeRuns = (driver.onTimeRuns || 0) + 1;
        driver.availability = DRIVER_AVAILABILITY.AVAILABLE;
        driver.currentRouteId = null;
        await driver.save();
      }
    }

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Completed delivery for order ${delivery.orderReference} with POD`,
      type: AUDIT_EVENT_TYPES.POD_RECORDED,
      deliveryId: delivery._id,
      metadata: { orderReference: delivery.orderReference, recipientName, otpVerified },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery successfully completed with Proof of Delivery',
      data: { delivery },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/deliveries/:id/fail
 * Report failed delivery with mandatory reason
 */
exports.failDelivery = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;
    const { failureReason, failureNotes } = req.body;

    if (!failureReason || !Object.values(FAILURE_REASONS).includes(failureReason)) {
      throw new AppError(
        `Valid failure reason code required: [${Object.values(FAILURE_REASONS).join(', ')}]`,
        400,
        'INVALID_FAILURE_REASON'
      );
    }

    const delivery = await Delivery.findById(id);
    if (!delivery) throw new AppError('Delivery not found', 404, 'NOT_FOUND');

    delivery.status = DELIVERY_STATUS.FAILED;
    delivery.failureReason = failureReason;
    delivery.failureNotes = failureNotes || `Driver reported delivery failure: ${failureReason}`;
    await delivery.save();

    // Update stop in Route
    await Route.updateOne(
      { driverId: driver._id, 'stops.deliveryId': delivery._id },
      { $set: { 'stops.$.status': 'FAILED' } }
    );

    // Alert Fleet Manager
    await SystemNotification.create({
      title: `Delivery Exception: ${delivery.orderReference}`,
      message: `Driver ${req.user.name} reported failed delivery for order ${delivery.orderReference}. Reason: ${failureReason}. Notes: ${delivery.failureNotes}`,
      severity: 'WARNING',
      category: 'ROUTE',
      targetRole: 'FLEET_MANAGER',
      metadata: { deliveryId: delivery._id.toString(), orderReference: delivery.orderReference, reason: failureReason },
    });

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Reported delivery failure for order ${delivery.orderReference}: ${failureReason}`,
      type: AUDIT_EVENT_TYPES.EXCEPTION_REPORTED,
      deliveryId: delivery._id,
      metadata: { orderReference: delivery.orderReference, failureReason, failureNotes },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery failure recorded and operational alert dispatched',
      data: { delivery },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/incidents
 * Report incident or request roadside/route support
 */
exports.reportIncident = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { category, severity = 'MEDIUM', description, locationCoordinates, photoEvidenceUrl, deliveryId, routeId } = req.body;

    if (!category || !description) {
      throw new AppError('Incident category and description are required', 400, 'MISSING_FIELDS');
    }

    const incident = await DriverIncident.create({
      driverId: driver._id,
      routeId: routeId || driver.currentRouteId || null,
      deliveryId: deliveryId || null,
      category,
      severity,
      description,
      locationCoordinates: locationCoordinates || null,
      photoEvidenceUrl: photoEvidenceUrl || '',
      status: 'OPEN',
    });

    // High severity incidents trigger emergency alert
    const isEmergency = severity === 'HIGH' || severity === 'CRITICAL' || category === 'ACCIDENT_OR_SAFETY';
    await SystemNotification.create({
      title: `${isEmergency ? 'EMERGENCY: ' : ''}Driver Incident Report (${category})`,
      message: `Driver ${req.user.name} reported ${category} [${severity}]: ${description}`,
      severity: isEmergency ? 'CRITICAL' : 'WARNING',
      category: 'SAFETY',
      targetRole: 'FLEET_MANAGER',
      metadata: { incidentId: incident._id.toString(), driverId: driver._id.toString() },
    });

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Reported incident (${category}): ${description.slice(0, 50)}...`,
      type: AUDIT_EVENT_TYPES.DRIVER_INCIDENT_REPORTED,
      metadata: { incidentId: incident._id.toString(), category, severity },
    });

    res.status(201).json({
      success: true,
      message: 'Incident reported. Fleet operations center notified.',
      data: { incident },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/incidents
 * List incidents reported by driver
 */
exports.getIncidents = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const incidents = await DriverIncident.find({ driverId: driver._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { incidents },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/profile
 * Driver profile & performance analytics
 */
exports.getProfile = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);

    // Lifetime statistics
    const [totalCompleted, totalFailed, totalChecklists] = await Promise.all([
      Delivery.countDocuments({ assignedDriverId: driver._id, status: DELIVERY_STATUS.COMPLETED }),
      Delivery.countDocuments({ assignedDriverId: driver._id, status: DELIVERY_STATUS.FAILED }),
      VehicleChecklist.countDocuments({ driverId: driver._id }),
    ]);

    const totalRuns = totalCompleted + totalFailed;
    const onTimePercentage = totalRuns > 0 ? Number(((totalCompleted / totalRuns) * 100).toFixed(1)) : 100.0;

    res.status(200).json({
      success: true,
      data: {
        driver: {
          id: driver._id.toString(),
          name: req.user.name,
          email: req.user.email,
          phone: driver.phone,
          licenseNumber: driver.licenseNumber,
          availability: driver.availability,
          rating: driver.rating,
          assignedVehicle: driver.assignedVehicleId,
          createdAt: driver.createdAt,
        },
        performance: {
          totalCompletedDeliveries: totalCompleted,
          totalFailedDeliveries: totalFailed,
          onTimeDeliveryPercentage: onTimePercentage,
          completedRuns: driver.onTimeRuns,
          preTripInspectionsCompleted: totalChecklists,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/driver-hud/notifications
 * Driver notifications
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const notifications = await SystemNotification.find({
      $or: [
        { targetRole: { $in: ['ALL', 'DRIVER'] } },
        { targetUserId: driver.userId },
      ],
    }).sort({ createdAt: -1 }).limit(50);

    res.status(200).json({
      success: true,
      data: { notifications },
    });
  } catch (err) {
    next(err);
  }
};
