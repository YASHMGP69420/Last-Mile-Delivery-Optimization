const mongoose = require('mongoose');
const DeliveryBatch = require('../models/DeliveryBatch');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Route = require('../models/Route');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES, CANONICAL_DEPOT, DELIVERY_STATUS, VEHICLE_STATUS } = require('../config/constants');
const { assertNoActiveDriverOrVehicleOperations } = require('../services/resourceGuardService');
const Papa = require('papaparse');

const ALLOWED_BATCH_STATUSES = ['DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED'];

/**
 * Recalculate and update batch metrics from its constituent deliveries
 */
const recalculateBatchMetrics = async (batch) => {
  const deliveries = await Delivery.find({ _id: { $in: batch.deliveryIds } });
  const totalWeightKg = deliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0);
  const assignedCount = deliveries.filter((d) => d.status === DELIVERY_STATUS.ASSIGNED || d.status === DELIVERY_STATUS.OUT_FOR_DELIVERY).length;

  batch.metrics = {
    totalDeliveries: deliveries.length,
    totalWeightKg: Math.round(totalWeightKg * 10) / 10,
    assignedDeliveries: assignedCount,
  };
  return batch;
};

/**
 * GET /api/v1/batches
 * List delivery batches with search and status filtering
 */
const getBatches = async (req, res, next) => {
  try {
    const { status, date, search, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    if (date) {
      filter.date = date;
    }
    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { code: { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { shift: { $regex: s, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [batches, total] = await Promise.all([
      DeliveryBatch.find(filter)
        .populate('vehicleIds', 'vehicleId makeModel type availability capacityKg fuelType')
        .populate({
          path: 'driverIds',
          select: 'licenseNumber phone rating userId availability',
          populate: { path: 'userId', select: 'name email' },
        })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DeliveryBatch.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        batches,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const assertDeliveriesEligibleForBatch = async (deliveryIds, { excludeBatchId = null } = {}) => {
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) return [];
  const deliveries = await Delivery.find({ _id: { $in: deliveryIds } });
  if (deliveries.length !== deliveryIds.length) {
    throw new AppError('One or more delivery IDs were not found', 404, 'DELIVERIES_NOT_FOUND');
  }

  for (const d of deliveries) {
    if (
      d.status === DELIVERY_STATUS.COMPLETED ||
      d.status === DELIVERY_STATUS.OUT_FOR_DELIVERY ||
      d.status === 'CANCELLED'
    ) {
      throw new AppError(
        `Delivery ${d.orderReference} is in status '${d.status}' and cannot be included in a batch`,
        400,
        'INELIGIBLE_DELIVERY_STATUS'
      );
    }
  }

  const activeRouteWithDelivery = await Route.exists({
    status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
    'stops.deliveryId': { $in: deliveryIds },
  });
  if (activeRouteWithDelivery) {
    throw new AppError(
      'One or more selected deliveries are already assigned to an active DISPATCHED or IN_PROGRESS route',
      409,
      'DELIVERY_IN_ACTIVE_ROUTE'
    );
  }

  const excludeStr = excludeBatchId ? excludeBatchId.toString() : null;
  const referencedBatchIds = [
    ...new Set(
      deliveries
        .filter((d) => d.batchId && (!excludeStr || d.batchId.toString() !== excludeStr))
        .map((d) => d.batchId.toString())
    ),
  ];

  const activeBatches = referencedBatchIds.length > 0
    ? await DeliveryBatch.find({
        _id: { $in: referencedBatchIds },
        status: { $ne: 'CLOSED' },
      }).select('code')
    : [];
  const activeBatchCodeById = new Map(activeBatches.map((b) => [b._id.toString(), b.code]));

  const conflictingDeliveries = [];
  const conflictingBatchCodes = new Set();

  for (const d of deliveries) {
    const dBatchStr = d.batchId ? d.batchId.toString() : null;
    if (excludeStr && dBatchStr === excludeStr) continue;

    const activeBatchCode = dBatchStr ? activeBatchCodeById.get(dBatchStr) : null;
    const isDirectAssigned = d.status === DELIVERY_STATUS.ASSIGNED && (!dBatchStr || Boolean(activeBatchCode));

    if (activeBatchCode || isDirectAssigned) {
      conflictingDeliveries.push(d.orderReference);
      if (activeBatchCode) {
        conflictingBatchCodes.add(activeBatchCode);
      }
    }
  }

  if (conflictingDeliveries.length > 0) {
    const refs = conflictingDeliveries.join(', ');
    const batchSummary = conflictingBatchCodes.size > 0
      ? `active batch ${Array.from(conflictingBatchCodes).join(', ')}`
      : 'an active consignment assignment';
    const actionVerb = excludeStr ? 'add to batch' : 'create batch';
    throw new AppError(
      `Cannot ${actionVerb} because consignment(s) ${refs} are already assigned to ${batchSummary}`,
      409,
      'DELIVERY_ALREADY_IN_BATCH'
    );
  }

  return deliveries;
};

const assertFleetEligibleForBatch = async ({ vehicleIds = [], driverIds = [] } = {}) => {
  const validVehicleIds = (Array.isArray(vehicleIds) ? vehicleIds : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  const validDriverIds = (Array.isArray(driverIds) ? driverIds : [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validVehicleIds.length === 0 && validDriverIds.length === 0) {
    return;
  }

  if (validVehicleIds.length > 0) {
    const vehicles = await Vehicle.find({ _id: { $in: validVehicleIds } }).select('vehicleId availability');
    const unavailableVehicle = vehicles.find(
      (v) => v.availability === VEHICLE_STATUS.MAINTENANCE || v.availability === VEHICLE_STATUS.RETIRED
    );
    if (unavailableVehicle) {
      throw new AppError(
        `Vehicle ${unavailableVehicle.vehicleId} is currently ${unavailableVehicle.availability} and cannot be assigned to a batch`,
        409,
        'VEHICLE_UNAVAILABLE_FOR_SHIFT'
      );
    }
  }

  if (validDriverIds.length > 0) {
    await Driver.find({ _id: { $in: validDriverIds } }).select('_id availability');
  }

  await assertNoActiveDriverOrVehicleOperations({
    vehicleIds: validVehicleIds,
    driverIds: validDriverIds,
    actionLabel: 'assign fleet resources to batch',
  });
};

/**
 * POST /api/v1/batches
 * Create a new operational delivery batch
 */
const createBatch = async (req, res, next) => {
  try {
    const {
      code,
      name,
      date,
      shift,
      depot,
      deliveryIds = [],
      vehicleIds = [],
      driverIds = [],
    } = req.body;

    const rawCode = code !== undefined && code !== null ? String(code).trim() : '';
    const formattedCode = (rawCode || `BATCH-${Date.now().toString().slice(-6)}`).toUpperCase();
    const normalizedName = (name !== undefined && name !== null ? String(name).trim() : '') || `Dispatch Batch ${formattedCode}`;

    const existing = await DeliveryBatch.findOne({ code: formattedCode });
    if (existing) {
      throw new AppError(`Batch with code '${formattedCode}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    let totalWeightKg = 0;
    if (Array.isArray(deliveryIds) && deliveryIds.length > 0) {
      const uniqueIds = [...new Set(deliveryIds.map((id) => id.toString()))];
      const deliveries = await assertDeliveriesEligibleForBatch(uniqueIds);
      totalWeightKg = deliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0);
    }

    if (
      (Array.isArray(vehicleIds) && vehicleIds.length > 0) ||
      (Array.isArray(driverIds) && driverIds.length > 0)
    ) {
      await assertFleetEligibleForBatch({ vehicleIds, driverIds });
    }

    const batch = new DeliveryBatch({
      code: formattedCode,
      name: normalizedName,
      date: date || new Date().toISOString().split('T')[0],
      shift: shift ? String(shift).trim() : 'Shift A (08:00 - 17:00)',
      depot: depot || CANONICAL_DEPOT,
      deliveryIds,
      vehicleIds,
      driverIds,
      status: 'DRAFT',
      metrics: {
        totalDeliveries: deliveryIds.length,
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        assignedDeliveries: 0,
      },
    });

    await batch.save();

    // Bind deliveries to this batch
    if (deliveryIds.length > 0) {
      await Delivery.updateMany({ _id: { $in: deliveryIds } }, { batchId: batch._id });
    }

    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Created operational delivery batch ${batch.code}`,
      metadata: { totalDeliveries: deliveryIds.length },
    });

    await batch.populate([
      { path: 'vehicleIds', select: 'vehicleId makeModel type availability capacityKg' },
      {
        path: 'driverIds',
        select: 'licenseNumber phone userId',
        populate: { path: 'userId', select: 'name email' },
      },
    ]);

    res.status(201).json({
      success: true,
      message: 'Delivery batch created successfully',
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/batches/:id
 * Retrieve single batch with full populated references
 */
const getBatchById = async (req, res, next) => {
  try {
    const batch = await DeliveryBatch.findById(req.params.id)
      .populate('deliveryIds')
      .populate('vehicleIds')
      .populate({
        path: 'driverIds',
        select: 'licenseNumber phone rating userId availability',
        populate: { path: 'userId', select: 'name email' },
      });

    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/batches/:id
 * Update batch details, shift, depot, or attached deliveries
 */
const updateBatch = async (req, res, next) => {
  try {
    const { name, date, shift, depot, deliveryIds, vehicleIds, driverIds } = req.body;
    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    if (name) batch.name = name;
    if (shift) batch.shift = shift;
    if (depot) batch.depot = depot;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError('Date must be formatted as YYYY-MM-DD', 400, 'INVALID_DATE_FORMAT');
      }
      batch.date = date;
    }
    if (vehicleIds) batch.vehicleIds = vehicleIds;
    if (driverIds) batch.driverIds = driverIds;

    if (deliveryIds && Array.isArray(deliveryIds)) {
      // Unlink removed deliveries
      await Delivery.updateMany({ batchId: batch._id, _id: { $nin: deliveryIds } }, { batchId: null });
      // Link new deliveries
      await Delivery.updateMany({ _id: { $in: deliveryIds } }, { batchId: batch._id });

      batch.deliveryIds = deliveryIds;
      await recalculateBatchMetrics(batch);
    }

    await batch.save();

    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Updated delivery batch ${batch.code}`,
      metadata: { totalDeliveries: batch.deliveryIds.length },
    });

    res.status(200).json({
      success: true,
      message: 'Batch updated successfully',
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/batches/:id/duplicate
 * Duplicate batch with a new code and DRAFT status
 */
const duplicateBatch = async (req, res, next) => {
  try {
    const sourceBatch = await DeliveryBatch.findById(req.params.id);
    if (!sourceBatch) {
      throw new AppError('Delivery batch to duplicate not found', 404, 'NOT_FOUND');
    }

    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const newCode = `${sourceBatch.code}-CP${uniqueSuffix}`;

    const newBatch = new DeliveryBatch({
      code: newCode,
      name: `Copy of ${sourceBatch.name}`,
      date: new Date().toISOString().split('T')[0],
      shift: sourceBatch.shift,
      depot: sourceBatch.depot,
      deliveryIds: [], // Fresh duplicate begins with empty delivery manifest
      vehicleIds: sourceBatch.vehicleIds,
      driverIds: sourceBatch.driverIds,
      status: 'DRAFT',
      metrics: {
        totalDeliveries: 0,
        totalWeightKg: 0,
        assignedDeliveries: 0,
      },
    });

    await newBatch.save();

    await recordAuditEvent({
      batchId: newBatch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Duplicated batch ${sourceBatch.code} -> ${newBatch.code}`,
      metadata: { originalBatchId: sourceBatch._id.toString() },
    });

    res.status(201).json({
      success: true,
      message: `Batch duplicated successfully as ${newBatch.code}`,
      data: {
        batch: newBatch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/batches/:id/deliveries
 * Add eligible deliveries to an existing batch and recalculate metrics
 */
const addDeliveriesToBatch = async (req, res, next) => {
  try {
    const { deliveryIds } = req.body;
    if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
      throw new AppError('deliveryIds array is required', 400, 'MISSING_DELIVERY_IDS');
    }

    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    if (batch.status === 'CLOSED') {
      throw new AppError('Cannot add deliveries to a CLOSED batch', 400, 'BATCH_CLOSED');
    }

    // Verify all deliveries exist and are eligible (not completed, out for delivery, cancelled, in active route, or in another active batch)
    const uniqueIncomingIds = [...new Set(deliveryIds.map((id) => id.toString()))];
    await assertDeliveriesEligibleForBatch(uniqueIncomingIds, { excludeBatchId: batch._id });

    // Merge delivery IDs avoiding duplicates
    const currentIdStrings = batch.deliveryIds.map((id) => id.toString());
    const newIds = uniqueIncomingIds.filter((id) => !currentIdStrings.includes(id));

    batch.deliveryIds.push(...newIds);
    await recalculateBatchMetrics(batch);
    await batch.save();

    // Bind deliveries to this batch
    await Delivery.updateMany({ _id: { $in: newIds } }, { batchId: batch._id });

    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Added ${newIds.length} consignments to batch ${batch.code}`,
      metadata: { addedCount: newIds.length, totalDeliveries: batch.metrics.totalDeliveries },
    });

    res.status(200).json({
      success: true,
      message: `Successfully added ${newIds.length} deliveries to batch`,
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/batches/:id/deliveries/:deliveryId
 * Remove a delivery from a batch and unbind it
 */
const removeDeliveryFromBatch = async (req, res, next) => {
  try {
    const { id, deliveryId } = req.params;
    const batch = await DeliveryBatch.findById(id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    if (batch.status === 'CLOSED') {
      throw new AppError('Cannot modify deliveries in a CLOSED batch', 400, 'BATCH_CLOSED');
    }

    batch.deliveryIds = batch.deliveryIds.filter((dId) => dId.toString() !== deliveryId);
    await recalculateBatchMetrics(batch);
    await batch.save();

    // Unbind delivery
    await Delivery.findByIdAndUpdate(deliveryId, {
      batchId: null,
      status: DELIVERY_STATUS.READY,
    });

    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Removed consignment ${deliveryId} from batch ${batch.code}`,
      metadata: { remainingDeliveries: batch.metrics.totalDeliveries },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery removed from batch successfully',
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/batches/:id/assign
 * Assign vehicles and drivers to a batch
 */
const assignBatchFleet = async (req, res, next) => {
  try {
    const { vehicleIds = [], driverIds = [] } = req.body;
    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    let targetVehicleIds = batch.vehicleIds || [];
    if (vehicleIds && Array.isArray(vehicleIds) && vehicleIds.length > 0) {
      const validIds = vehicleIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const vehicles = await Vehicle.find({
        $or: [
          { _id: { $in: validIds } },
          { vehicleId: { $in: vehicleIds } },
        ],
      });
      if (vehicles.length > 0) {
        targetVehicleIds = vehicles.map((v) => v._id);
      }
    } else if (vehicleIds && Array.isArray(vehicleIds) && vehicleIds.length === 0) {
      targetVehicleIds = [];
    }

    let targetDriverIds = batch.driverIds || [];
    if (driverIds && Array.isArray(driverIds) && driverIds.length > 0) {
      const validIds = driverIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const drivers = await Driver.find({
        $or: [
          { _id: { $in: validIds } },
          { userId: { $in: validIds } },
        ],
      });
      if (drivers.length > 0) {
        targetDriverIds = drivers.map((d) => d._id);
      }
    } else if (driverIds && Array.isArray(driverIds) && driverIds.length === 0) {
      targetDriverIds = [];
    }

    if (targetVehicleIds.length > 0 || targetDriverIds.length > 0) {
      await assertFleetEligibleForBatch({
        vehicleIds: targetVehicleIds,
        driverIds: targetDriverIds,
      });
    }

    // Check if assignments actually changed to prevent duplicate writes & audit noise
    const currentVehStr = (batch.vehicleIds || []).map((id) => id.toString()).sort().join(',');
    const newVehStr = targetVehicleIds.map((id) => id.toString()).sort().join(',');
    const currentDrvStr = (batch.driverIds || []).map((id) => id.toString()).sort().join(',');
    const newDrvStr = targetDriverIds.map((id) => id.toString()).sort().join(',');

    if (currentVehStr !== newVehStr || currentDrvStr !== newDrvStr) {
      batch.vehicleIds = targetVehicleIds;
      batch.driverIds = targetDriverIds;
      await batch.save();

      await recordAuditEvent({
        batchId: batch._id,
        type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: `Assigned fleet resources to batch ${batch.code}`,
        metadata: { vehicleCount: batch.vehicleIds.length, driverCount: batch.driverIds.length },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Fleet assigned to batch successfully',
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/batches/:id/export
 * Export batch consignment manifest as CSV
 */
const exportBatchCsv = async (req, res, next) => {
  try {
    const batch = await DeliveryBatch.findById(req.params.id).populate('deliveryIds');
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    const rows = (batch.deliveryIds || []).map((d) => ({
      'Order Reference': d.orderReference,
      'Recipient Name': d.customer?.name || '',
      'Recipient Phone': d.customer?.phone || '',
      'Street Address': d.address?.street || '',
      'Zone': d.address?.zone || '',
      'Priority': d.priority || 'STANDARD',
      'Weight (kg)': d.weightKg || 1,
      'Time Window Start': d.timeWindow?.start || '',
      'Time Window End': d.timeWindow?.end || '',
      'Status': d.status,
      'Longitude': d.location?.coordinates?.[0] || '',
      'Latitude': d.location?.coordinates?.[1] || '',
    }));

    const csvString = Papa.unparse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="manifest-${batch.code}.csv"`);
    res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};

const assertNoActiveRoutesOnBatch = async (batch, actionLabel) => {
  const hasActiveRoutes = await Route.exists({
    batchId: batch._id,
    status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
  });
  if (hasActiveRoutes) {
    throw new AppError(
      `Cannot ${actionLabel} batch ${batch.code} while active routes are DISPATCHED or IN_PROGRESS.`,
      409,
      'BATCH_HAS_ACTIVE_ROUTES'
    );
  }
};

/**
 * PATCH /api/v1/batches/:id/status
 */
const updateBatchStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      throw new AppError('Status is required', 400, 'MISSING_STATUS');
    }
    if (!ALLOWED_BATCH_STATUSES.includes(status)) {
      throw new AppError(
        `Invalid batch status '${status}'. Allowed: ${ALLOWED_BATCH_STATUSES.join(', ')}`,
        400,
        'INVALID_BATCH_STATUS'
      );
    }

    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    if (status === 'CLOSED') {
      await assertNoActiveRoutesOnBatch(batch, 'close');
    }

    batch.status = status;
    await batch.save();

    res.status(200).json({
      success: true,
      message: `Batch status updated to ${status}`,
      data: {
        batch,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/batches/:id
 */
const deleteBatch = async (req, res, next) => {
  try {
    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    await assertNoActiveRoutesOnBatch(batch, 'delete');

    // Unbind all deliveries
    await Delivery.updateMany({ batchId: batch._id }, { batchId: null });
    await DeliveryBatch.findByIdAndDelete(batch._id);

    await recordAuditEvent({
      batchId: batch._id,
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Deleted delivery batch ${batch.code} and unbound consignments`,
      metadata: { deletedBatchCode: batch.code },
    });

    res.status(200).json({
      success: true,
      message: 'Delivery batch deleted and deliveries unbound',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBatches,
  createBatch,
  getBatchById,
  updateBatch,
  duplicateBatch,
  addDeliveriesToBatch,
  removeDeliveryFromBatch,
  assignBatchFleet,
  exportBatchCsv,
  updateBatchStatus,
  deleteBatch,
};
