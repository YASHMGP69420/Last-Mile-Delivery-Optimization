const DeliveryBatch = require('../models/DeliveryBatch');
const Delivery = require('../models/Delivery');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES, CANONICAL_DEPOT } = require('../config/constants');

/**
 * GET /api/v1/batches
 */
const getBatches = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) filter.date = date;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [batches, total] = await Promise.all([
      DeliveryBatch.find(filter)
        .populate('vehicleIds', 'vehicleId makeModel type availability')
        .populate({
          path: 'driverIds',
          select: 'licenseNumber phone rating userId availability',
          populate: { path: 'userId', select: 'name' },
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

/**
 * POST /api/v1/batches
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

    const existing = await DeliveryBatch.findOne({ code: (code || '').toUpperCase().trim() });
    if (existing) {
      throw new AppError(`Batch with code '${code}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    // Calculate metrics based on included deliveries
    let totalWeightKg = 0;
    if (deliveryIds.length > 0) {
      const deliveries = await Delivery.find({ _id: { $in: deliveryIds } });
      totalWeightKg = deliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0);
    }

    const batch = new DeliveryBatch({
      code: (code || '').toUpperCase().trim(),
      name,
      date: date || new Date().toISOString().split('T')[0],
      shift: shift || 'Shift A (08:00 - 17:00)',
      depot: depot || CANONICAL_DEPOT,
      deliveryIds,
      vehicleIds,
      driverIds,
      status: 'DRAFT',
      metrics: {
        totalDeliveries: deliveryIds.length,
        totalWeightKg,
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
 */
const updateBatch = async (req, res, next) => {
  try {
    const { name, shift, deliveryIds, vehicleIds, driverIds } = req.body;
    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
    }

    if (name) batch.name = name;
    if (shift) batch.shift = shift;
    if (vehicleIds) batch.vehicleIds = vehicleIds;
    if (driverIds) batch.driverIds = driverIds;

    if (deliveryIds) {
      // Unlink removed deliveries
      await Delivery.updateMany({ batchId: batch._id, _id: { $nin: deliveryIds } }, { batchId: null });
      // Link new deliveries
      await Delivery.updateMany({ _id: { $in: deliveryIds } }, { batchId: batch._id });

      const deliveries = await Delivery.find({ _id: { $in: deliveryIds } });
      const totalWeightKg = deliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0);

      batch.deliveryIds = deliveryIds;
      batch.metrics.totalDeliveries = deliveryIds.length;
      batch.metrics.totalWeightKg = totalWeightKg;
    }

    await batch.save();

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
 * PATCH /api/v1/batches/:id/status
 */
const updateBatchStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      throw new AppError('Status is required', 400, 'MISSING_STATUS');
    }

    const batch = await DeliveryBatch.findById(req.params.id);
    if (!batch) {
      throw new AppError('Delivery batch not found', 404, 'NOT_FOUND');
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

    // Unbind all deliveries
    await Delivery.updateMany({ batchId: batch._id }, { batchId: null });
    await DeliveryBatch.findByIdAndDelete(batch._id);

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
  updateBatchStatus,
  deleteBatch,
};
