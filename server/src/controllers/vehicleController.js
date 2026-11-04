const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES, VEHICLE_STATUS } = require('../config/constants');

/**
 * GET /api/v1/vehicles
 */
const getVehicles = async (req, res, next) => {
  try {
    const { status, availability, fuelType, type, page = 1, limit = 50 } = req.query;
    const filter = {};

    const targetStatus = status || availability;
    if (targetStatus) {
      filter.availability = targetStatus;
    }
    if (fuelType) {
      filter.fuelType = fuelType;
    }
    if (type) {
      filter.type = type;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter)
        .populate({
          path: 'assignedDriverId',
          select: 'licenseNumber phone rating availability userId',
          populate: { path: 'userId', select: 'name email' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Vehicle.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        vehicles,
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
 * POST /api/v1/vehicles
 */
const createVehicle = async (req, res, next) => {
  try {
    const {
      vehicleId,
      makeModel,
      type,
      capacityKg,
      capacityM3,
      fuelType,
      kmPerLitre,
      energyKWhPerKm,
      batterySoC,
    } = req.body;

    const existing = await Vehicle.findOne({ vehicleId: (vehicleId || '').toUpperCase().trim() });
    if (existing) {
      throw new AppError(`Vehicle with license plate '${vehicleId}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    const vehicle = new Vehicle({
      vehicleId: (vehicleId || '').toUpperCase().trim(),
      makeModel,
      type,
      capacityKg,
      capacityM3,
      fuelType,
      kmPerLitre,
      energyKWhPerKm,
      batterySoC,
    });

    await vehicle.save();

    await recordAuditEvent({
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Registered new vehicle ${vehicle.vehicleId}`,
      metadata: { vehicleId: vehicle.vehicleId, type: vehicle.type, fuelType: vehicle.fuelType },
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/vehicles/:id
 */
const getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate({
      path: 'assignedDriverId',
      select: 'licenseNumber phone rating availability userId',
      populate: { path: 'userId', select: 'name email' },
    });

    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/vehicles/:id
 */
const updateVehicle = async (req, res, next) => {
  try {
    const {
      makeModel,
      capacityKg,
      capacityM3,
      availability,
      batterySoC,
      kmPerLitre,
      energyKWhPerKm,
    } = req.body;

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
    }

    if (makeModel !== undefined) vehicle.makeModel = makeModel;
    if (capacityKg !== undefined) vehicle.capacityKg = capacityKg;
    if (capacityM3 !== undefined) vehicle.capacityM3 = capacityM3;
    if (availability !== undefined) vehicle.availability = availability;
    if (batterySoC !== undefined) vehicle.batterySoC = batterySoC;
    if (kmPerLitre !== undefined) vehicle.kmPerLitre = kmPerLitre;
    if (energyKWhPerKm !== undefined) vehicle.energyKWhPerKm = energyKWhPerKm;

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/vehicles/:id
 */
const deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
    }

    // Soft-delete / retire
    vehicle.availability = VEHICLE_STATUS.RETIRED;

    // If driver was paired, unpair driver
    if (vehicle.assignedDriverId) {
      await Driver.findByIdAndUpdate(vehicle.assignedDriverId, {
        assignedVehicleId: null,
      });
      vehicle.assignedDriverId = null;
    }

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Vehicle retired successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
};
