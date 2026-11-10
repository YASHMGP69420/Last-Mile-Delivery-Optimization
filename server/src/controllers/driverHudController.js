const mongoose = require('mongoose');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Route = require('../models/Route');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const VehicleAssignment = require('../models/VehicleAssignment');
const RouteAssignment = require('../models/RouteAssignment');
const DriverShift = require('../models/DriverShift');
const VehicleChecklist = require('../models/VehicleChecklist');
const DriverIncident = require('../models/DriverIncident');
const SystemNotification = require('../models/SystemNotification');
const AuditEvent = require('../models/AuditEvent');
const telemetryService = require('../services/telemetryService');
const socketService = require('../services/socketService');
const savingsAnalyticsService = require('../services/savingsAnalyticsService');
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

  // 1. If this authenticated user has a linked Driver document, ALWAYS use it
  if (req.user && req.user.id) {
    driver = await Driver.findOne({ userId: req.user.id }).populate('assignedVehicleId');
    if (driver) {
      return driver;
    }
  }

  // 2. If authenticated as DRIVER role without profile, auto-heal / provision it
  if (req.user.role === ROLES.DRIVER) {
    const cleanLicense = `OD-DL-${req.user.id.toString().slice(-6).toUpperCase()}`;
    driver = await Driver.create({
      userId: req.user.id,
      licenseNumber: cleanLicense,
      phone: req.user.phone || '+91 94370 00000',
      availability: DRIVER_AVAILABILITY.AVAILABLE,
    });
    driver = await Driver.findById(driver._id).populate('assignedVehicleId');
    return driver;
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
    return driver;
  } else {
    throw new AppError('Access restricted to Driver accounts', 403, 'FORBIDDEN');
  }
};

/**
 * Helper to resolve the active dispatched route for a driver.
 * Prioritizes:
 * 1. driver.currentRouteId (if DISPATCHED or IN_PROGRESS or OPTIMIZED)
 * 2. Newest route where driverId === driver._id
 * 3. Newest route dispatched to driver.assignedVehicleId (with auto-binding)
 */
async function findActiveRouteForDriver(driver, populateVehicle = true) {
  let route = null;
  const statusFilter = { $in: ['DISPATCHED', 'IN_PROGRESS', 'OPTIMIZED'] };

  // 1. Check currentRouteId
  if (driver.currentRouteId) {
    let q = Route.findOne({ _id: driver.currentRouteId, status: statusFilter });
    if (populateVehicle) q = q.populate('vehicleId', 'vehicleId registrationNumber type fuelType capacityKg status');
    route = await q;
  }

  // 2. Query newest dispatched route by driverId
  if (!route) {
    let q = Route.findOne({ driverId: driver._id, status: statusFilter })
      .sort({ dispatchedAt: -1, updatedAt: -1, createdAt: -1 });
    if (populateVehicle) q = q.populate('vehicleId', 'vehicleId registrationNumber type fuelType capacityKg status');
    route = await q;
  }

  // 3. Fallback: check if a route is dispatched to the driver's assigned vehicle
  if (!route && driver.assignedVehicleId) {
    const vId = driver.assignedVehicleId._id || driver.assignedVehicleId;
    let q = Route.findOne({ vehicleId: vId, status: statusFilter })
      .sort({ dispatchedAt: -1, updatedAt: -1, createdAt: -1 });
    if (populateVehicle) q = q.populate('vehicleId', 'vehicleId registrationNumber type fuelType capacityKg status');
    route = await q;

    if (route) {
      // Auto-bind route to this driver
      route.driverId = driver._id;
      await route.save();
      driver.currentRouteId = route._id;
      if (driver.availability === DRIVER_AVAILABILITY.AVAILABLE) {
        driver.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
      }
      await driver.save();
    }
  }

  return route;
}

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
    const activeRoute = await findActiveRouteForDriver(driver, true);

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
              fuelUnit: activeShift.fuelUnit || 'L',
              startOdometerKm: activeShift.startOdometerKm ?? null,
              startFuelOrCharge: activeShift.startFuelOrCharge ?? null,
              telemetryCapturedAtStart: Boolean(activeShift.telemetryCapturedAtStart),
            }
          : null,
        vehicle: driver.assignedVehicleId
          ? {
              id: driver.assignedVehicleId._id?.toString() || driver.assignedVehicleId.toString(),
              registrationNumber: driver.assignedVehicleId.vehicleId || driver.assignedVehicleId.registrationNumber || 'Assigned Van',
              model: driver.assignedVehicleId.makeModel || driver.assignedVehicleId.model || 'Fleet Unit',
              type: driver.assignedVehicleId.type || 'Van',
              fuelType: driver.assignedVehicleId.fuelType || 'Electric',
              capacityKg: driver.assignedVehicleId.capacityKg ?? null,
              currentPayloadKg: activeRoute
                ? Number(
                    activeRoute.stops
                      .filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED')
                      .reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0)
                      .toFixed(1)
                  )
                : 0,
              batteryLevelPercent:
                String(driver.assignedVehicleId.fuelType || '').toUpperCase() === 'ELECTRIC' &&
                activeShift?.startFuelOrCharge !== null &&
                activeShift?.startFuelOrCharge !== undefined
                  ? activeShift.startFuelOrCharge
                  : driver.assignedVehicleId.batterySoC ?? latestChecklist?.fuelOrBatteryLevelPercent ?? null,
              fuelLevelPercent: latestChecklist?.fuelOrBatteryLevelPercent ?? null,
              fuelRemainingLitres:
                String(driver.assignedVehicleId.fuelType || '').toUpperCase() !== 'ELECTRIC' &&
                activeShift?.startFuelOrCharge !== null &&
                activeShift?.startFuelOrCharge !== undefined
                  ? activeShift.startFuelOrCharge
                  : null,
              status: driver.assignedVehicleId.availability || driver.assignedVehicleId.status || 'AVAILABLE',
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

function parseNumericField(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * POST /api/v1/driver-hud/shifts/start
 * Clock in and start active shift (with optional/required odometer & fuel/charge reading)
 */
exports.startShift = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const vehicle = driver.assignedVehicleId || null;
    const isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';
    const fuelUnit = isElectric ? '%' : 'L';

    const rawOdo = req.body?.odometerKm ?? req.body?.startOdometerKm;
    const rawFuel = req.body?.remainingFuelOrCharge ?? req.body?.startFuelOrCharge;
    const requireTelemetry = Boolean(req.body?.requireTelemetry);

    const startOdometerKm = parseNumericField(rawOdo);
    const startFuelOrCharge = parseNumericField(rawFuel);

    if (requireTelemetry && vehicle && (startOdometerKm === null || startFuelOrCharge === null)) {
      throw new AppError(
        'Starting odometer reading and remaining fuel/charge are required to begin your shift.',
        400,
        'INVALID_SHIFT_TELEMETRY'
      );
    }

    if (startOdometerKm !== null && (Number.isNaN(startOdometerKm) || startOdometerKm < 0)) {
      throw new AppError('Starting odometer reading must be a non-negative number.', 400, 'INVALID_ODOMETER_READING');
    }

    if (
      startFuelOrCharge !== null &&
      (Number.isNaN(startFuelOrCharge) || startFuelOrCharge < 0 || (isElectric && startFuelOrCharge > 100))
    ) {
      throw new AppError(
        isElectric
          ? 'Starting battery charge percentage must be between 0 and 100.'
          : 'Starting remaining fuel in litres must be a non-negative number.',
        400,
        'INVALID_FUEL_LEVEL'
      );
    }

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

    const hasTelemetry = startOdometerKm !== null && startFuelOrCharge !== null;

    const shift = await DriverShift.create({
      driverId: driver._id,
      vehicleId: vehicle ? vehicle._id : null,
      fuelUnit,
      date: today,
      startTime: timeStr,
      endTime: '18:00',
      status: SHIFT_STATUS.IN_PROGRESS,
      breakDurationMinutes: 0,
      startOdometerKm,
      startFuelOrCharge,
      telemetryCapturedAtStart: hasTelemetry,
      notes: 'Driver started shift via Driver Cockpit',
    });

    if (isElectric && vehicle?._id && startFuelOrCharge !== null) {
      await Vehicle.findByIdAndUpdate(vehicle._id, { batterySoC: Math.round(startFuelOrCharge) });
    }

    driver.availability = DRIVER_AVAILABILITY.ON_DUTY;
    await driver.save();

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: hasTelemetry
        ? `[DRIVER] Clocked in at ${timeStr} (Odo: ${startOdometerKm} km, Remaining: ${startFuelOrCharge}${fuelUnit})`
        : `[DRIVER] Clocked in shift at ${timeStr}`,
      type: AUDIT_EVENT_TYPES.SHIFT_CHANGE,
      metadata: {
        shiftId: shift._id.toString(),
        driverId: driver._id.toString(),
        startOdometerKm,
        startFuelOrCharge,
        fuelUnit,
      },
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
 * Toggle driver break status
 */
exports.toggleBreak = async (req, res, next) => {
  try {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BREAK_DISABLED',
        message: 'Driver break option has been removed by fleet operations policy. Couriers remain on active duty throughout their dispatch shift.',
      },
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
    const { handoverNotes, requireTelemetry } = req.body || {};
    const vehicle = driver.assignedVehicleId || null;

    const rawEndOdo = req.body?.odometerKm ?? req.body?.endOdometerKm;
    const rawEndFuel = req.body?.remainingFuelOrCharge ?? req.body?.endFuelOrCharge;
    const endOdometerKm = parseNumericField(rawEndOdo);
    const endFuelOrCharge = parseNumericField(rawEndFuel);

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

    const isElectric =
      shift?.fuelUnit === '%' || String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';

    if (requireTelemetry && vehicle && (endOdometerKm === null || endFuelOrCharge === null)) {
      throw new AppError(
        'Closing odometer reading and remaining fuel/charge are required to end your shift.',
        400,
        'INVALID_SHIFT_TELEMETRY'
      );
    }

    if (endOdometerKm !== null && (Number.isNaN(endOdometerKm) || endOdometerKm < 0)) {
      throw new AppError('Closing odometer reading must be a non-negative number.', 400, 'INVALID_ODOMETER_READING');
    }

    if (
      shift &&
      shift.startOdometerKm !== null &&
      endOdometerKm !== null &&
      endOdometerKm < shift.startOdometerKm
    ) {
      throw new AppError(
        `Closing odometer (${endOdometerKm} km) cannot be less than starting odometer (${shift.startOdometerKm} km).`,
        400,
        'INVALID_ODOMETER_READING'
      );
    }

    if (
      endFuelOrCharge !== null &&
      (Number.isNaN(endFuelOrCharge) || endFuelOrCharge < 0 || (isElectric && endFuelOrCharge > 100))
    ) {
      throw new AppError(
        isElectric
          ? 'Remaining battery charge percentage must be between 0 and 100.'
          : 'Remaining fuel in litres must be a non-negative number.',
        400,
        'INVALID_FUEL_LEVEL'
      );
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (shift) {
      shift.endTime = timeStr;
      shift.status = SHIFT_STATUS.COMPLETED;
      if (endOdometerKm !== null) {
        shift.endOdometerKm = endOdometerKm;
        shift.actualDistanceKm =
          shift.startOdometerKm !== null
            ? Number(Math.max(0, endOdometerKm - shift.startOdometerKm).toFixed(2))
            : 0;
      }
      if (endFuelOrCharge !== null) {
        shift.endFuelOrCharge = endFuelOrCharge;
        shift.actualFuelOrChargeUsed =
          shift.startFuelOrCharge !== null
            ? Number(Math.max(0, shift.startFuelOrCharge - endFuelOrCharge).toFixed(2))
            : 0;
      }
      if (endOdometerKm !== null && endFuelOrCharge !== null) {
        shift.telemetryCapturedAtEnd = true;
      }
      if (handoverNotes) shift.notes = `${shift.notes || ''} | Handover: ${handoverNotes}`;
      await shift.save();
    }

    if (isElectric && vehicle?._id && endFuelOrCharge !== null) {
      await Vehicle.findByIdAndUpdate(vehicle._id, { batterySoC: Math.round(endFuelOrCharge) });
    }

    driver.availability = DRIVER_AVAILABILITY.OFF_DUTY;
    await driver.save();

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action:
        shift?.telemetryCapturedAtEnd
          ? `[DRIVER] Clocked out at ${timeStr} (Driven: ${shift.actualDistanceKm} km, Used: ${shift.actualFuelOrChargeUsed}${shift.fuelUnit})`
          : `[DRIVER] Clocked out shift at ${timeStr}`,
      type: AUDIT_EVENT_TYPES.SHIFT_CHANGE,
      metadata: {
        shiftId: shift?._id?.toString(),
        handoverNotes,
        endOdometerKm,
        endFuelOrCharge,
        actualDistanceKm: shift?.actualDistanceKm || 0,
        actualFuelOrChargeUsed: shift?.actualFuelOrChargeUsed || 0,
      },
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

      const alertNotif = await SystemNotification.create({
        title: `CRITICAL: Vehicle ${vehicle.vehicleId || vehicle.registrationNumber || 'Unit'} failed pre-trip safety check`,
        message: `Driver ${req.user.name} reported critical inspection failure on ${vehicle.vehicleId || vehicle.registrationNumber || 'vehicle'}. Vehicle automatically placed in MAINTENANCE status. Notes: ${overallNotes || 'None'}`,
        severity: 'CRITICAL',
        category: 'SAFETY',
        targetRole: 'FLEET_MANAGER',
        metadata: { vehicleId: vehicle._id.toString(), driverId: driver._id.toString() },
      });

      socketService.emitTelemetryAlert({
        id: alertNotif._id.toString(),
        alertType: 'VEHICLE_SAFETY_FAILURE',
        severity: 'CRITICAL',
        vehicleId: vehicle._id.toString(),
        driverId: driver._id.toString(),
        message: alertNotif.message,
        createdAt: alertNotif.createdAt,
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

    const route = await findActiveRouteForDriver(driver, true);

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

    const route = await findActiveRouteForDriver(driver, false);

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
 * Internal helper: finalize route, release Driver + Vehicle, close assignments & batch when all stops are terminal
 */
const finalizeRouteIfFinished = async ({ routeId, driver, incrementCompletedRuns = false }) => {
  if (!routeId) return null;
  const updatedRoute = await Route.findById(routeId);
  if (!updatedRoute) return null;

  const remaining = updatedRoute.stops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
  if (remaining.length > 0) return updatedRoute;

  updatedRoute.status = 'COMPLETED';
  updatedRoute.completedAt = new Date();
  await updatedRoute.save();

  if (incrementCompletedRuns) {
    driver.onTimeRuns = (driver.onTimeRuns || 0) + 1;
  }
  driver.availability = DRIVER_AVAILABILITY.AVAILABLE;
  driver.currentRouteId = null;
  await driver.save();

  if (updatedRoute.vehicleId) {
    await Vehicle.findByIdAndUpdate(updatedRoute.vehicleId, {
      availability: VEHICLE_STATUS.AVAILABLE,
    });
  }

  await Promise.all([
    VehicleAssignment.updateMany(
      { routeId: updatedRoute._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } },
      { $set: { status: 'COMPLETED', endTime: new Date() } }
    ),
    RouteAssignment.updateMany(
      { routeId: updatedRoute._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } },
      { $set: { status: 'COMPLETED' } }
    ),
  ]);

  if (updatedRoute.batchId) {
    const otherActiveRoute = await Route.findOne({
      batchId: updatedRoute.batchId,
      _id: { $ne: updatedRoute._id },
      status: { $in: ['DRAFT', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS'] },
    }).lean();
    if (!otherActiveRoute) {
      await DeliveryBatch.findByIdAndUpdate(updatedRoute.batchId, { status: 'CLOSED' });
    }
  }

  return updatedRoute;
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
    const route = await Route.findOne({ driverId: driver._id, 'stops.deliveryId': delivery._id });
    if (route) {
      await Route.updateOne(
        { _id: route._id, 'stops.deliveryId': delivery._id },
        { $set: { 'stops.$.status': 'ARRIVED', status: 'IN_PROGRESS' } }
      );
    }

    socketService.emitDeliveryUpdated({
      deliveryId: delivery._id.toString(),
      orderReference: delivery.orderReference,
      status: 'OUT_FOR_DELIVERY',
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

/**
 * POST /api/v1/driver-hud/deliveries/:id/complete
 * Submit Proof of Delivery (POD) and complete consignment
 */
exports.completeDelivery = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { id } = req.params;
    const podBody = req.body?.pod && typeof req.body.pod === 'object' ? req.body.pod : {};
    const recipientName = req.body.recipientName ?? podBody.recipientName;
    const otp = req.body.otp ?? podBody.otp;
    const signatureSvg = req.body.signatureSvg ?? req.body.signature ?? podBody.signatureSvg ?? podBody.signature;
    const photoUrl = req.body.photoUrl ?? req.body.photo ?? podBody.photoUrl ?? podBody.photo;
    const handoverNotes = req.body.handoverNotes ?? req.body.notes ?? podBody.handoverNotes ?? podBody.notes;
    const temperatureReading = req.body.temperatureReading ?? podBody.temperatureReading;

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

    // Update stop in Route and release route/driver/vehicle/batch if finished
    const route = await Route.findOne({ driverId: driver._id, 'stops.deliveryId': delivery._id });
    if (route) {
      await Route.updateOne(
        { _id: route._id, 'stops.deliveryId': delivery._id },
        { $set: { 'stops.$.status': 'COMPLETED' } }
      );
      await finalizeRouteIfFinished({ routeId: route._id, driver, incrementCompletedRuns: true });
    }

    await AuditEvent.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `[DRIVER] Completed delivery for order ${delivery.orderReference} with POD`,
      type: AUDIT_EVENT_TYPES.POD_RECORDED,
      deliveryId: delivery._id,
      metadata: { orderReference: delivery.orderReference, recipientName, otpVerified },
    });

    socketService.emitDeliveryUpdated({
      deliveryId: delivery._id.toString(),
      orderReference: delivery.orderReference,
      status: 'COMPLETED',
      routeId: route?._id?.toString(),
      driverId: driver._id.toString(),
      driverName: req.user.name,
      timestamp: new Date(),
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

    // Update stop in Route and finalize if all stops are now terminal
    const route = await Route.findOne({ driverId: driver._id, 'stops.deliveryId': delivery._id });
    if (route) {
      await Route.updateOne(
        { _id: route._id, 'stops.deliveryId': delivery._id },
        { $set: { 'stops.$.status': 'FAILED' } }
      );
      await finalizeRouteIfFinished({ routeId: route._id, driver, incrementCompletedRuns: false });
    }

    // Alert Fleet Manager & Admin
    const alertNotif = await SystemNotification.create({
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

    socketService.emitDeliveryUpdated({
      deliveryId: delivery._id.toString(),
      orderReference: delivery.orderReference,
      status: 'FAILED',
      failureReason,
      routeId: route?._id?.toString(),
      driverId: driver._id.toString(),
      driverName: req.user.name,
      timestamp: new Date(),
    });

    socketService.emitTelemetryAlert({
      id: alertNotif._id.toString(),
      alertType: 'DELIVERY_FAILED',
      severity: 'WARNING',
      driverId: driver._id.toString(),
      routeId: route?._id?.toString(),
      message: alertNotif.message,
      createdAt: alertNotif.createdAt,
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
    const alertNotif = await SystemNotification.create({
      title: `${isEmergency ? 'EMERGENCY: ' : ''}Driver Incident Report (${category})`,
      message: `Driver ${req.user.name} reported ${category} [${severity}]: ${description}`,
      severity: isEmergency ? 'CRITICAL' : 'WARNING',
      category: 'SAFETY',
      targetRole: 'FLEET_MANAGER',
      metadata: { incidentId: incident._id.toString(), driverId: driver._id.toString() },
    });

    socketService.emitTelemetryAlert({
      id: alertNotif._id.toString(),
      incidentId: incident._id.toString(),
      alertType: 'DRIVER_INCIDENT',
      severity: alertNotif.severity,
      driverId: driver._id.toString(),
      routeId: incident.routeId?.toString(),
      message: alertNotif.message,
      createdAt: alertNotif.createdAt,
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

    // Lifetime statistics & savings attribution
    const [totalCompleted, totalFailed, totalChecklists, metricsMap] = await Promise.all([
      Delivery.countDocuments({ assignedDriverId: driver._id, status: DELIVERY_STATUS.COMPLETED }),
      Delivery.countDocuments({ assignedDriverId: driver._id, status: DELIVERY_STATUS.FAILED }),
      VehicleChecklist.countDocuments({ driverId: driver._id }),
      savingsAnalyticsService.getDriverPerformanceMetricsMap([driver._id]),
    ]);

    const driverStats = metricsMap.get(driver._id.toString()) || {};
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
          kmSaved: driverStats.kmSaved ?? 0,
          fuelSavedLitres: driverStats.fuelSavedLitres ?? 0,
          energySavedKwh: driverStats.energySavedKwh ?? 0,
          costSavedInr: driverStats.costSavedInr ?? 0,
          actualDistanceKm: driverStats.actualDistanceKm ?? 0,
          actualFuelUsedLitres: driverStats.actualFuelUsedLitres ?? 0,
          actualChargeUsedPct: driverStats.actualChargeUsedPct ?? 0,
          shiftsCompleted: driverStats.shiftsCompleted ?? 0,
          recentShifts: driverStats.recentShifts || [],
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

/**
 * PATCH /api/v1/driver-hud/notifications/:id/read
 * Mark driver notification as read / acknowledged
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await SystemNotification.findByIdAndUpdate(id, {
      $addToSet: { readBy: req.user.id },
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/location
 * Driver live GPS update endpoint
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { coordinates, accuracyMeters, speedKmh, headingDegrees, altitudeMeters, batteryPercent } = req.body;

    const payload = {
      driverId: driver._id,
      vehicleId: driver.assignedVehicleId?._id || driver.assignedVehicleId || null,
      routeId: driver.currentRouteId || null,
      source: 'MOBILE_APP_GPS',
      coordinates,
      accuracyMeters,
      speedKmh,
      headingDegrees,
      altitudeMeters,
      batteryPercent,
      timestamp: new Date(),
    };

    const result = await telemetryService.recordTelemetry(payload, req.user);

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/driver-hud/route/claim
 * Driver manually claims/binds an unassigned or vehicle-dispatched route
 */
exports.claimRoute = async (req, res, next) => {
  try {
    const driver = await resolveDriver(req);
    const { routeId } = req.body;

    let route = null;
    if (routeId) {
      route = await Route.findById(routeId);
    } else if (driver.assignedVehicleId) {
      const vId = driver.assignedVehicleId._id || driver.assignedVehicleId;
      route = await Route.findOne({
        vehicleId: vId,
        status: { $in: ['DISPATCHED', 'IN_PROGRESS', 'OPTIMIZED'] },
      }).sort({ dispatchedAt: -1, updatedAt: -1 });
    }

    if (!route) {
      // Only claim genuinely unassigned dispatched/in-progress routes so no active driver route is hijacked
      route = await Route.findOne({
        driverId: null,
        status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
      }).sort({ dispatchedAt: -1, updatedAt: -1 });
    }

    if (!route) {
      throw new AppError('No eligible active route found to claim', 404, 'ROUTE_NOT_FOUND');
    }

    route.driverId = driver._id;
    if (route.status === 'DRAFT' || route.status === 'OPTIMIZED') {
      route.status = 'DISPATCHED';
      route.dispatchedAt = new Date();
    }
    await route.save();

    driver.currentRouteId = route._id;
    driver.availability = DRIVER_AVAILABILITY.IN_TRANSIT;
    if (route.vehicleId && (!driver.assignedVehicleId || driver.assignedVehicleId.toString() !== route.vehicleId.toString())) {
      driver.assignedVehicleId = route.vehicleId;
      await Vehicle.findByIdAndUpdate(route.vehicleId, {
        assignedDriverId: driver._id,
        availability: VEHICLE_STATUS.IN_TRANSIT,
      });
    }
    await driver.save();

    // Broadcast update
    socketService.emitRouteDispatched({
      routeId: route._id.toString(),
      routeCode: route.routeCode,
      driverId: driver._id.toString(),
      vehicleId: route.vehicleId ? route.vehicleId.toString() : null,
      stopsCount: route.stops ? route.stops.length : 0,
      version: route.version || 1,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: `Route #${route.routeCode} successfully claimed and assigned to your driver cockpit`,
      data: { route },
    });
  } catch (err) {
    next(err);
  }
};
