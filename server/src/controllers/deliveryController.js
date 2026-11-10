const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const AuditEvent = require('../models/AuditEvent');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { processCsvManifest } = require('../services/csvImportService');
const {
  DELIVERY_STATUS,
  AUDIT_EVENT_TYPES,
  FAILURE_REASONS,
  ROLES,
} = require('../config/constants');

// Allowed status machine transitions
const VALID_TRANSITIONS = {
  [DELIVERY_STATUS.DRAFT]: [DELIVERY_STATUS.READY],
  [DELIVERY_STATUS.READY]: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.DRAFT],
  [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.OUT_FOR_DELIVERY, DELIVERY_STATUS.READY],
  [DELIVERY_STATUS.OUT_FOR_DELIVERY]: [DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED],
  [DELIVERY_STATUS.FAILED]: [DELIVERY_STATUS.READY],
  [DELIVERY_STATUS.COMPLETED]: [],
};

/**
 * Verifies driver ownership of a consignment to prevent BOLA / IDOR attacks.
 * ADMIN and FLEET_MANAGER roles bypass this check.
 */
const verifyDriverOwnership = async (delivery, user) => {
  if (user && user.role === ROLES.DRIVER) {
    if (!delivery.assignedDriverId) {
      throw new AppError('Drivers can only update deliveries assigned to them', 403, 'FORBIDDEN');
    }

    const assignedDriverStr = delivery.assignedDriverId.toString();

    // 1. Direct match against driverProfileId or user sub/id
    if (user.driverProfileId && assignedDriverStr === user.driverProfileId.toString()) {
      return;
    }
    if ((user.id && assignedDriverStr === user.id.toString()) || (user.sub && assignedDriverStr === user.sub.toString())) {
      return;
    }

    // 2. Lookup Driver document associated with user._id
    const driver = await Driver.findOne({ userId: user.id || user.sub });
    if (!driver || assignedDriverStr !== driver._id.toString()) {
      throw new AppError('Drivers can only update deliveries assigned to them', 403, 'FORBIDDEN');
    }
  }
};


/**
 * GET /api/v1/deliveries
 */
const getDeliveries = async (req, res, next) => {
  try {
    const { batchId, status, priority, zone, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (batchId) filter.batchId = batchId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (zone) filter['address.zone'] = zone;

    if (search) {
      filter.$or = [
        { orderReference: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'address.street': { $regex: search, $options: 'i' } },
        { 'address.postalCode': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [deliveries, total] = await Promise.all([
      Delivery.find(filter)
        .populate('batchId', 'code name date')
        .populate('assignedVehicleId', 'vehicleId makeModel type')
        .populate({
          path: 'assignedDriverId',
          select: 'licenseNumber phone userId',
          populate: { path: 'userId', select: 'name' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Delivery.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        deliveries,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const PHONE_FORMAT_REGEX = /^\+?[0-9\s\-()]{10,20}$/;
const POSTAL_CODE_REGEX = /^\d{6}$/;

const parseTimeToMinutes = (timeStr) => {
  if (typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  if (!TIME_REGEX.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(':').map(Number);
  return { hours, minutes, totalMinutes: hours * 60 + minutes };
};

const formatTimeHHmm = ({ hours, minutes }) =>
  `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

const validateAndNormalizeDeliveryInput = (payload, { isUpdate = false, existingDelivery = null } = {}) => {
  const existingCustomer = existingDelivery?.customer?.toObject
    ? existingDelivery.customer.toObject()
    : (existingDelivery?.customer || {});
  const existingAddress = existingDelivery?.address?.toObject
    ? existingDelivery.address.toObject()
    : (existingDelivery?.address || {});
  const existingTimeWindow = existingDelivery?.timeWindow?.toObject
    ? existingDelivery.timeWindow.toObject()
    : (existingDelivery?.timeWindow || {});

  let normalizedOrderReference;
  if (!isUpdate || payload.orderReference !== undefined) {
    normalizedOrderReference = String(payload.orderReference ?? '').trim().toUpperCase();
    if (!normalizedOrderReference) {
      throw new AppError('Order reference is required', 400, 'INVALID_ORDER_REFERENCE');
    }
  }

  const incomingCustomer = payload.customer !== undefined ? payload.customer : {};
  if (payload.customer !== undefined && (typeof payload.customer !== 'object' || payload.customer === null || Array.isArray(payload.customer))) {
    throw new AppError('Customer details must be an object', 400, 'INVALID_CUSTOMER_NAME');
  }
  const mergedCustomer = isUpdate
    ? { ...existingCustomer, ...incomingCustomer }
    : incomingCustomer;

  const customerName = String(mergedCustomer?.name ?? '').trim();
  if (!customerName) {
    throw new AppError('Customer name is required', 400, 'INVALID_CUSTOMER_NAME');
  }

  const customerPhone = String(mergedCustomer?.phone ?? '').trim();
  const phoneDigits = customerPhone.replace(/\D/g, '');
  if (!PHONE_FORMAT_REGEX.test(customerPhone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
    throw new AppError('Customer phone must be a valid 10–15 digit phone number', 400, 'INVALID_PHONE');
  }

  const normalizedCustomer = {
    name: customerName,
    phone: customerPhone,
  };
  if (mergedCustomer?.email !== undefined && mergedCustomer?.email !== null) {
    const trimmedEmail = String(mergedCustomer.email).trim().toLowerCase();
    normalizedCustomer.email = trimmedEmail || null;
  }

  const incomingAddress = payload.address !== undefined ? payload.address : {};
  if (payload.address !== undefined && (typeof payload.address !== 'object' || payload.address === null || Array.isArray(payload.address))) {
    throw new AppError('Address details must be an object', 400, 'INVALID_ADDRESS');
  }
  const mergedAddress = isUpdate
    ? { ...existingAddress, ...incomingAddress }
    : incomingAddress;

  const street = String(mergedAddress?.street ?? '').trim();
  if (!street) {
    throw new AppError('Street address is required', 400, 'INVALID_ADDRESS');
  }

  const postalCode = String(mergedAddress?.postalCode ?? '').trim();
  if (!POSTAL_CODE_REGEX.test(postalCode)) {
    throw new AppError('Postal code must be a valid 6-digit pincode', 400, 'INVALID_POSTAL_CODE');
  }

  const normalizedAddress = {
    street,
    city: String(mergedAddress?.city || 'Bhubaneswar').trim() || 'Bhubaneswar',
    zone: String(mergedAddress?.zone || 'Other').trim() || 'Other',
    postalCode,
  };

  const rawWeight = isUpdate && payload.weightKg === undefined
    ? existingDelivery?.weightKg
    : payload.weightKg;
  const parsedWeight = Number(rawWeight);
  if (rawWeight === undefined || rawWeight === null || rawWeight === '' || !Number.isFinite(parsedWeight) || parsedWeight <= 0) {
    throw new AppError('Consignment weight must be strictly positive (> 0)', 400, 'INVALID_WEIGHT');
  }

  let parsedVolume;
  if (payload.volumeM3 !== undefined) {
    parsedVolume = Number(payload.volumeM3);
    if (payload.volumeM3 === null || payload.volumeM3 === '' || !Number.isFinite(parsedVolume) || parsedVolume < 0) {
      throw new AppError('Consignment volume cannot be negative (>= 0)', 400, 'INVALID_VOLUME');
    }
  } else {
    parsedVolume = isUpdate ? (existingDelivery?.volumeM3 ?? 0.01) : 0.01;
  }

  let parsedServiceDuration;
  if (payload.serviceDurationMinutes !== undefined) {
    parsedServiceDuration = Number(payload.serviceDurationMinutes);
    if (
      payload.serviceDurationMinutes === null ||
      payload.serviceDurationMinutes === '' ||
      !Number.isFinite(parsedServiceDuration) ||
      parsedServiceDuration <= 0
    ) {
      throw new AppError('Service duration must be strictly positive (> 0 minutes)', 400, 'INVALID_SERVICE_DURATION');
    }
  } else {
    parsedServiceDuration = isUpdate ? (existingDelivery?.serviceDurationMinutes ?? 10) : 10;
  }

  let normalizedTimeWindow;
  if (!isUpdate && payload.timeWindow === undefined) {
    normalizedTimeWindow = { start: '09:00', end: '17:00' };
  } else {
    const incomingTw = payload.timeWindow !== undefined ? payload.timeWindow : {};
    if (payload.timeWindow !== undefined && (typeof payload.timeWindow !== 'object' || payload.timeWindow === null || Array.isArray(payload.timeWindow))) {
      throw new AppError('Invalid time window format', 400, 'INVALID_TIME_WINDOW');
    }
    const startStr = incomingTw.start !== undefined
      ? String(incomingTw.start ?? '').trim()
      : (existingTimeWindow.start || '09:00');
    const endStr = incomingTw.end !== undefined
      ? String(incomingTw.end ?? '').trim()
      : (existingTimeWindow.end || '17:00');

    const startParsed = parseTimeToMinutes(startStr);
    const endParsed = parseTimeToMinutes(endStr);
    if (!startParsed || !endParsed || startParsed.totalMinutes >= endParsed.totalMinutes) {
      throw new AppError('Invalid time window: start time must precede end time', 400, 'INVALID_TIME_WINDOW');
    }
    normalizedTimeWindow = {
      start: formatTimeHHmm(startParsed),
      end: formatTimeHHmm(endParsed),
    };
  }

  return {
    orderReference: normalizedOrderReference,
    customer: normalizedCustomer,
    address: normalizedAddress,
    weightKg: parsedWeight,
    volumeM3: parsedVolume,
    serviceDurationMinutes: parsedServiceDuration,
    timeWindow: normalizedTimeWindow,
  };
};

const syncBatchMetrics = async (batchId) => {
  if (!batchId) return;
  const batch = await DeliveryBatch.findById(batchId);
  if (!batch) return;
  const deliveries = await Delivery.find({ _id: { $in: batch.deliveryIds } });
  const totalWeightKg = deliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0);
  const assignedDeliveries = deliveries.filter(
    (d) => d.status === DELIVERY_STATUS.ASSIGNED || d.status === DELIVERY_STATUS.OUT_FOR_DELIVERY
  ).length;
  batch.metrics = {
    totalDeliveries: deliveries.length,
    totalWeightKg: Math.round(totalWeightKg * 10) / 10,
    assignedDeliveries,
  };
  await batch.save();
};

/**
 * POST /api/v1/deliveries
 */
const createDelivery = async (req, res, next) => {
  try {
    const {
      location,
      priority,
      batchId,
      status,
    } = req.body;

    const normalized = validateAndNormalizeDeliveryInput(req.body, { isUpdate: false });

    const existing = await Delivery.findOne({ orderReference: normalized.orderReference });
    if (existing) {
      throw new AppError(`Consignment with reference '${normalized.orderReference}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    const delivery = new Delivery({
      orderReference: normalized.orderReference,
      customer: normalized.customer,
      address: normalized.address,
      location: location || {
        type: 'Point',
        coordinates: [85.8645, 20.2961],
        geocoded: false,
        geocodingSource: 'SIMULATED',
      },
      weightKg: normalized.weightKg,
      volumeM3: normalized.volumeM3,
      priority: priority || 'Standard',
      timeWindow: normalized.timeWindow,
      serviceDurationMinutes: normalized.serviceDurationMinutes,
      batchId: batchId || null,
      status: status || DELIVERY_STATUS.DRAFT,
    });

    await delivery.save();

    if (batchId) {
      await DeliveryBatch.findByIdAndUpdate(batchId, {
        $push: { deliveryIds: delivery._id },
        $inc: {
          'metrics.totalDeliveries': 1,
          'metrics.totalWeightKg': delivery.weightKg,
        },
      });
    }

    await recordAuditEvent({
      deliveryId: delivery._id,
      batchId: delivery.batchId,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Created delivery consignment ${delivery.orderReference}`,
      metadata: { initialStatus: delivery.status },
    });

    res.status(201).json({
      success: true,
      message: 'Delivery consignment created successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/deliveries/:id
 */
const getDeliveryById = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('batchId', 'code name date shift')
      .populate('assignedVehicleId')
      .populate({
        path: 'assignedDriverId',
        select: 'licenseNumber phone userId rating',
        populate: { path: 'userId', select: 'name email' },
      });

    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    const timeline = await AuditEvent.find({ deliveryId: delivery._id })
      .populate('actorId', 'name email role')
      .sort({ at: 1 });

    res.status(200).json({
      success: true,
      data: {
        delivery,
        timeline,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/deliveries/:id
 */
const updateDelivery = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED, DELIVERY_STATUS.OUT_FOR_DELIVERY].includes(delivery.status)) {
      throw new AppError(`Cannot amend delivery in status '${delivery.status}'`, 400, 'DELIVERY_LOCKED');
    }

    const previousBatchId = delivery.batchId ? delivery.batchId.toString() : null;
    const previousWeightKg = delivery.weightKg;

    const normalized = validateAndNormalizeDeliveryInput(req.body, {
      isUpdate: true,
      existingDelivery: delivery,
    });

    const {
      location,
      priority,
      batchId,
    } = req.body;

    if (normalized.orderReference !== undefined && normalized.orderReference !== delivery.orderReference) {
      const dup = await Delivery.findOne({
        orderReference: normalized.orderReference,
        _id: { $ne: delivery._id },
      });
      if (dup) {
        throw new AppError(`Consignment with reference '${normalized.orderReference}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
      }
      delivery.orderReference = normalized.orderReference;
    }

    delivery.customer = normalized.customer;
    delivery.address = normalized.address;
    if (location) delivery.location = { ...delivery.location.toObject(), ...location };
    delivery.weightKg = normalized.weightKg;
    delivery.volumeM3 = normalized.volumeM3;
    if (priority) delivery.priority = priority;
    delivery.timeWindow = normalized.timeWindow;
    delivery.serviceDurationMinutes = normalized.serviceDurationMinutes;
    if (batchId !== undefined) delivery.batchId = batchId;

    await delivery.save();

    const nextBatchId = delivery.batchId ? delivery.batchId.toString() : null;
    if (previousBatchId && previousBatchId !== nextBatchId) {
      await DeliveryBatch.findByIdAndUpdate(previousBatchId, { $pull: { deliveryIds: delivery._id } });
      await syncBatchMetrics(previousBatchId);
    }
    if (nextBatchId && previousBatchId !== nextBatchId) {
      await DeliveryBatch.findByIdAndUpdate(nextBatchId, { $addToSet: { deliveryIds: delivery._id } });
      await syncBatchMetrics(nextBatchId);
    } else if (nextBatchId && delivery.weightKg !== previousWeightKg) {
      await syncBatchMetrics(nextBatchId);
    }

    res.status(200).json({
      success: true,
      message: 'Delivery consignment updated',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/deliveries/import-csv
 */
const importCsvManifest = async (req, res, next) => {
  try {
    const isDryRun = req.query.dryRun !== undefined
      ? (req.query.dryRun === 'true' || req.query.dryRun === '')
      : (req.body && req.body.dryRun !== undefined
        ? (req.body.dryRun === true || req.body.dryRun === 'true')
        : true);

    const batchId = req.query.batchId || (req.body && req.body.batchId) || null;

    let inputData = null;
    if (req.body && Array.isArray(req.body.rows)) {
      inputData = req.body.rows;
    } else if (req.file) {
      inputData = req.file.buffer.toString('utf-8');
    } else if (typeof req.body === 'string') {
      inputData = req.body;
    } else if (req.body && req.body.csvContent) {
      inputData = req.body.csvContent;
    } else {
      throw new AppError('CSV content must be provided as text body, JSON rows array, or file upload', 400, 'MISSING_CSV_CONTENT');
    }

    if (typeof inputData === 'string' && !inputData.trim()) {
      throw new AppError('CSV content cannot be empty', 400, 'EMPTY_CSV_CONTENT');
    }

    const result = await processCsvManifest(inputData, {
      dryRun: isDryRun,
      batchId,
      actor: req.user,
    });

    const statusCode = result.dryRun ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      message: result.dryRun
        ? `CSV dry-run validation complete: ${result.validCount} valid, ${result.errorCount} errors`
        : `Successfully imported ${result.validCount} delivery consignments`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/deliveries/:id/assign
 */
const assignDelivery = async (req, res, next) => {
  try {
    const { vehicleId, driverId } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Terminal state protection: deliveries in COMPLETED or FAILED cannot be re-assigned
    if ([DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED].includes(delivery.status)) {
      throw new AppError(
        `Cannot re-assign delivery in terminal status '${delivery.status}'`,
        400,
        'DELIVERY_TERMINAL'
      );
    }

    let finalDriverId = driverId;
    if (driverId && mongoose.Types.ObjectId.isValid(driverId)) {
      const driverDoc = await Driver.findOne({ $or: [{ _id: driverId }, { userId: driverId }] });
      if (driverDoc) {
        finalDriverId = driverDoc._id;
      }
    }

    let finalVehicleId = vehicleId;
    if (vehicleId) {
      const vehFilter = mongoose.Types.ObjectId.isValid(vehicleId)
        ? { $or: [{ _id: vehicleId }, { vehicleId }] }
        : { vehicleId };
      const vehDoc = await Vehicle.findOne(vehFilter);
      if (vehDoc) {
        finalVehicleId = vehDoc._id;
      }
    }

    // Strict 'Current Assignment' check: A vehicle cannot be assigned to a new route if it is already active in another one
    const existingAssignment = await Delivery.findOne({
      assignedVehicleId: finalVehicleId,
      status: { $in: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.OUT_FOR_DELIVERY] },
    });
    if (existingAssignment && existingAssignment._id.toString() !== req.params.id) {
      throw new AppError(`Vehicle ${finalVehicleId} is already active in another delivery assignment`, 400, 'VEHICLE_ALREADY_ASSIGNED');
    }

    delivery.assignedVehicleId = finalVehicleId || delivery.assignedVehicleId;
    delivery.assignedDriverId = finalDriverId || delivery.assignedDriverId;
    delivery.status = DELIVERY_STATUS.ASSIGNED;
    await delivery.save();

    await recordAuditEvent({
      deliveryId: delivery._id,
      batchId: delivery.batchId,
      type: AUDIT_EVENT_TYPES.ASSIGNMENT_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Assigned delivery ${delivery.orderReference} to driver and vehicle`,
      metadata: { vehicleId, driverId, toStatus: DELIVERY_STATUS.ASSIGNED },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery assigned successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/deliveries/:id/status
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { status: targetStatus, failureReason, failureNotes, pod } = req.body;
    if (!targetStatus) {
      throw new AppError('Target status is required', 400, 'MISSING_STATUS');
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    const currentStatus = delivery.status;
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedTargets.includes(targetStatus)) {
      throw new AppError(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowedTargets.join(', ')}]`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Validation for OUT_FOR_DELIVERY -> FAILED (requires failureReason)
    if (targetStatus === DELIVERY_STATUS.FAILED) {
      const reason = failureReason || req.body.reason;
      if (!reason) {
        throw new AppError('Transition to FAILED requires failureReason', 400, 'MISSING_FAILURE_REASON');
      }
      delivery.failureReason = reason;
      delivery.failureNotes = failureNotes || req.body.notes || null;
    }

    // Enforce Driver ownership check (BOLA prevention)
    await verifyDriverOwnership(delivery, req.user);

    // Validation for OUT_FOR_DELIVERY -> COMPLETED (requires POD)
    if (targetStatus === DELIVERY_STATUS.COMPLETED) {
      if (!pod || (typeof pod !== 'object')) {
        throw new AppError('Transition to COMPLETED requires valid Proof of Delivery (POD) data', 400, 'MISSING_POD_DATA');
      }
      if (!pod.otp && !pod.signatureSvg && !pod.photoUrl) {
        throw new AppError('POD must include at least one verification method (OTP, Signature, or Photo)', 400, 'INCOMPLETE_POD');
      }
      if (!delivery.proofOfDelivery) {
        delivery.proofOfDelivery = {};
      }
      if (pod.otp !== undefined) delivery.proofOfDelivery.otp = pod.otp;
      if (pod.otpVerified !== undefined) delivery.proofOfDelivery.otpVerified = pod.otpVerified;
      else if (pod.otp) delivery.proofOfDelivery.otpVerified = true;
      if (pod.signatureSvg !== undefined) delivery.proofOfDelivery.signatureSvg = pod.signatureSvg;
      if (pod.photoUrl !== undefined) delivery.proofOfDelivery.photoUrl = pod.photoUrl;
      if (pod.photoCoordinates) delivery.proofOfDelivery.photoCoordinates = pod.photoCoordinates;
      if (pod.temperatureReading !== undefined) delivery.proofOfDelivery.temperatureReading = pod.temperatureReading;
      if (pod.notes || pod.handoverNotes) delivery.proofOfDelivery.handoverNotes = pod.notes || pod.handoverNotes;
    }

    delivery.status = targetStatus;
    await delivery.save();

    await recordAuditEvent({
      deliveryId: delivery._id,
      batchId: delivery.batchId,
      type: targetStatus === DELIVERY_STATUS.FAILED
        ? AUDIT_EVENT_TYPES.EXCEPTION_REPORTED
        : AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Status transitioned from ${currentStatus} to ${targetStatus}`,
      metadata: {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        failureReason: delivery.failureReason,
        podVerified: delivery.proofOfDelivery.otpVerified,
      },
    });

    res.status(200).json({
      success: true,
      message: `Delivery status transitioned to ${targetStatus}`,
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/deliveries/:id/complete
 */
const completeDelivery = async (req, res, next) => {
  try {
    const { otp, signatureSvg, notes, photoUrl, photoCoordinates, temperatureReading } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Enforce lifecycle state machine: must be OUT_FOR_DELIVERY
    if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
      throw new AppError(
        `Consignment can only be completed when in 'OUT_FOR_DELIVERY' status. Current status: '${delivery.status}'`,
        400,
        'CANNOT_COMPLETE_DELIVERY_NOT_OUT_FOR_DELIVERY'
      );
    }

    // Enforce Driver ownership check (BOLA prevention)
    await verifyDriverOwnership(delivery, req.user);

    if (!otp && !signatureSvg && !photoUrl) {
      throw new AppError('POD must include at least one verification method (OTP, Signature, or Photo)', 400, 'INCOMPLETE_POD');
    }

    if (!delivery.proofOfDelivery) {
      delivery.proofOfDelivery = {};
    }
    if (otp !== undefined) delivery.proofOfDelivery.otp = otp;
    delivery.proofOfDelivery.otpVerified = Boolean(otp);
    if (signatureSvg !== undefined) delivery.proofOfDelivery.signatureSvg = signatureSvg;
    if (photoUrl !== undefined) delivery.proofOfDelivery.photoUrl = photoUrl;
    if (photoCoordinates) delivery.proofOfDelivery.photoCoordinates = photoCoordinates;
    if (temperatureReading !== undefined) delivery.proofOfDelivery.temperatureReading = temperatureReading;
    if (notes !== undefined) delivery.proofOfDelivery.handoverNotes = notes;

    const currentStatus = delivery.status;
    delivery.status = DELIVERY_STATUS.COMPLETED;
    await delivery.save();

    await recordAuditEvent({
      deliveryId: delivery._id,
      batchId: delivery.batchId,
      type: AUDIT_EVENT_TYPES.POD_RECORDED,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Delivery ${delivery.orderReference} completed with POD`,
      metadata: { fromStatus: currentStatus, toStatus: DELIVERY_STATUS.COMPLETED, otpVerified: Boolean(otp) },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery completed successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/deliveries/:id/fail
 */
const failDelivery = async (req, res, next) => {
  try {
    const reason = req.body.failureReason || req.body.reason;
    if (!reason) {
      throw new AppError('Delivery failure requires reason or failureReason code', 400, 'MISSING_FAILURE_REASON');
    }

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    // Enforce lifecycle state machine: must be OUT_FOR_DELIVERY
    if (delivery.status !== DELIVERY_STATUS.OUT_FOR_DELIVERY) {
      throw new AppError(
        `Consignment can only be failed when in 'OUT_FOR_DELIVERY' status. Current status: '${delivery.status}'`,
        400,
        'CANNOT_FAIL_DELIVERY_NOT_OUT_FOR_DELIVERY'
      );
    }

    // Enforce Driver ownership check (BOLA prevention)
    await verifyDriverOwnership(delivery, req.user);

    const currentStatus = delivery.status;
    delivery.status = DELIVERY_STATUS.FAILED;
    delivery.failureReason = reason;
    delivery.failureNotes = req.body.notes || req.body.failureNotes || null;
    await delivery.save();

    await recordAuditEvent({
      deliveryId: delivery._id,
      batchId: delivery.batchId,
      type: AUDIT_EVENT_TYPES.EXCEPTION_REPORTED,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Delivery ${delivery.orderReference} failed: ${reason}`,
      metadata: { fromStatus: currentStatus, toStatus: DELIVERY_STATUS.FAILED, reason },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery marked as failed',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/deliveries/:id
 */
const deleteDelivery = async (req, res, next) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      throw new AppError('Delivery not found', 404, 'NOT_FOUND');
    }

    if (![DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY].includes(delivery.status)) {
      throw new AppError(`Cannot delete delivery in status '${delivery.status}'`, 400, 'DELIVERY_NOT_DELETABLE');
    }

    if (delivery.batchId) {
      await DeliveryBatch.findByIdAndUpdate(delivery.batchId, {
        $pull: { deliveryIds: delivery._id },
        $inc: {
          'metrics.totalDeliveries': -1,
          'metrics.totalWeightKg': -delivery.weightKg,
        },
      });
    }

    await Delivery.findByIdAndDelete(delivery._id);

    res.status(200).json({
      success: true,
      message: 'Delivery deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeliveries,
  createDelivery,
  getDeliveryById,
  updateDelivery,
  importCsvManifest,
  assignDelivery,
  updateDeliveryStatus,
  completeDelivery,
  failDelivery,
  deleteDelivery,
};
