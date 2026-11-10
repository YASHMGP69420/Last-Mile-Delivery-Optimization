const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { assertNoActiveDriverOrVehicleOperations } = require('../services/resourceGuardService');
const { AUDIT_EVENT_TYPES, VEHICLE_STATUS, FUEL_TYPES } = require('../config/constants');

const isProvided = (val) => val !== undefined && val !== null && val !== '';

const parseFiniteNumber = (val, fieldName) => {
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new AppError(`${fieldName} must be a valid finite number`, 400, 'INVALID_VEHICLE_SPEC');
  }
  return num;
};

const validatePositiveSpec = (val, fieldName) => {
  const num = parseFiniteNumber(val, fieldName);
  if (num <= 0) {
    throw new AppError(`${fieldName} must be strictly positive (> 0)`, 400, 'INVALID_VEHICLE_SPEC');
  }
  return num;
};

const validateNonNegativeSpec = (val, fieldName) => {
  const num = parseFiniteNumber(val, fieldName);
  if (num < 0) {
    throw new AppError(`${fieldName} cannot be negative`, 400, 'INVALID_VEHICLE_SPEC');
  }
  return num;
};

const validateBatterySoC = (val) => {
  const num = parseFiniteNumber(val, 'batterySoC');
  if (num < 0 || num > 100) {
    throw new AppError('batterySoC must be between 0 and 100', 400, 'INVALID_VEHICLE_SPEC');
  }
  return num;
};

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
 * POST /api/v1/vehicles/import-csv
 */
const importCsv = async (req, res, next) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : req.body.csvContent;
    const { dryRun = true } = req.body || {};
    const { processVehicleCsv } = require('../services/csvVehicleImportService');
    const result = await processVehicleCsv(csvContent, { dryRun });
    res.status(200).json({
      success: true,
      message: dryRun ? 'Dry‑run vehicle CSV completed' : 'Vehicles imported',
      data: result,
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
      lastOdometerKm,
      lastFuelLitres,
      tankCapacityLitres,
    } = req.body;

    const normalizedVehicleId = String(vehicleId ?? '').trim().toUpperCase();
    const normalizedMakeModel = typeof makeModel === 'string' ? makeModel.trim() : makeModel;

    if (!normalizedVehicleId) {
      throw new AppError('Vehicle ID / registration plate is required', 400, 'INVALID_VEHICLE_SPEC');
    }
    if (!normalizedMakeModel) {
      throw new AppError('Make and model is required', 400, 'INVALID_VEHICLE_SPEC');
    }

    const existing = await Vehicle.findOne({ vehicleId: normalizedVehicleId });
    if (existing) {
      throw new AppError(`Vehicle with license plate '${normalizedVehicleId}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    if (!isProvided(capacityKg)) {
      throw new AppError('capacityKg must be strictly positive (> 0)', 400, 'INVALID_VEHICLE_SPEC');
    }
    const validatedCapacityKg = validatePositiveSpec(capacityKg, 'capacityKg');
    const validatedCapacityM3 = isProvided(capacityM3) ? validatePositiveSpec(capacityM3, 'capacityM3') : null;
    const validatedTankCapacity = isProvided(tankCapacityLitres)
      ? validatePositiveSpec(tankCapacityLitres, 'tankCapacityLitres')
      : null;
    const validatedLastOdometer = isProvided(lastOdometerKm)
      ? validateNonNegativeSpec(lastOdometerKm, 'lastOdometerKm')
      : null;
    const validatedLastFuel = isProvided(lastFuelLitres)
      ? validateNonNegativeSpec(lastFuelLitres, 'lastFuelLitres')
      : null;
    const validatedBatterySoC = isProvided(batterySoC) ? validateBatterySoC(batterySoC) : null;

    let validatedKmPerLitre = null;
    let validatedEnergyKWhPerKm = null;
    if (fuelType === FUEL_TYPES.ELECTRIC) {
      if (!isProvided(energyKWhPerKm)) {
        throw new AppError('Electric vehicles must specify energyKWhPerKm > 0', 400, 'INVALID_VEHICLE_SPEC');
      }
      validatedEnergyKWhPerKm = validatePositiveSpec(energyKWhPerKm, 'energyKWhPerKm');
    } else if (fuelType === FUEL_TYPES.PETROL || fuelType === FUEL_TYPES.DIESEL) {
      if (!isProvided(kmPerLitre)) {
        throw new AppError('Combustion vehicles (Petrol/Diesel) must specify kmPerLitre > 0', 400, 'INVALID_VEHICLE_SPEC');
      }
      validatedKmPerLitre = validatePositiveSpec(kmPerLitre, 'kmPerLitre');
    } else {
      if (isProvided(kmPerLitre)) validatedKmPerLitre = validatePositiveSpec(kmPerLitre, 'kmPerLitre');
      if (isProvided(energyKWhPerKm)) validatedEnergyKWhPerKm = validatePositiveSpec(energyKWhPerKm, 'energyKWhPerKm');
    }

    const vehicle = new Vehicle({
      vehicleId: normalizedVehicleId,
      makeModel: normalizedMakeModel,
      type,
      capacityKg: validatedCapacityKg,
      capacityM3: validatedCapacityM3,
      fuelType,
      kmPerLitre: validatedKmPerLitre,
      energyKWhPerKm: validatedEnergyKWhPerKm,
      batterySoC: validatedBatterySoC,
      lastOdometerKm: validatedLastOdometer,
      lastFuelLitres: validatedLastFuel,
      tankCapacityLitres: validatedTankCapacity,
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
      type,
      capacityKg,
      capacityM3,
      fuelType,
      availability,
      batterySoC,
      kmPerLitre,
      energyKWhPerKm,
      lastOdometerKm,
      lastFuelLitres,
      tankCapacityLitres,
    } = req.body;

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
    }

    if (availability === VEHICLE_STATUS.RETIRED) {
      await assertNoActiveDriverOrVehicleOperations({
        vehicleIds: [vehicle._id],
        driverIds: vehicle.assignedDriverId ? [vehicle.assignedDriverId] : [],
        actionLabel: 'retire vehicle',
      });
    }

    if (makeModel !== undefined) {
      const trimmedMake = String(makeModel ?? '').trim();
      if (!trimmedMake) {
        throw new AppError('makeModel cannot be empty', 400, 'INVALID_VEHICLE_SPEC');
      }
      vehicle.makeModel = trimmedMake;
    }
    if (type !== undefined) vehicle.type = type;
    if (fuelType !== undefined) vehicle.fuelType = fuelType;

    if (capacityKg !== undefined) {
      if (!isProvided(capacityKg)) {
        throw new AppError('capacityKg must be strictly positive (> 0)', 400, 'INVALID_VEHICLE_SPEC');
      }
      vehicle.capacityKg = validatePositiveSpec(capacityKg, 'capacityKg');
    }
    if (capacityM3 !== undefined) {
      vehicle.capacityM3 = isProvided(capacityM3) ? validatePositiveSpec(capacityM3, 'capacityM3') : null;
    }
    if (tankCapacityLitres !== undefined) {
      vehicle.tankCapacityLitres = isProvided(tankCapacityLitres)
        ? validatePositiveSpec(tankCapacityLitres, 'tankCapacityLitres')
        : null;
    }
    // D-03: Fleet Manager / Admin may set or lower lastOdometerKm to any non-negative finite number
    if (lastOdometerKm !== undefined) {
      vehicle.lastOdometerKm = isProvided(lastOdometerKm)
        ? validateNonNegativeSpec(lastOdometerKm, 'lastOdometerKm')
        : null;
    }
    if (lastFuelLitres !== undefined) {
      vehicle.lastFuelLitres = isProvided(lastFuelLitres)
        ? validateNonNegativeSpec(lastFuelLitres, 'lastFuelLitres')
        : null;
    }
    if (batterySoC !== undefined) {
      vehicle.batterySoC = isProvided(batterySoC) ? validateBatterySoC(batterySoC) : null;
    }
    if (kmPerLitre !== undefined) {
      vehicle.kmPerLitre = isProvided(kmPerLitre) ? validatePositiveSpec(kmPerLitre, 'kmPerLitre') : null;
    }
    if (energyKWhPerKm !== undefined) {
      vehicle.energyKWhPerKm = isProvided(energyKWhPerKm)
        ? validatePositiveSpec(energyKWhPerKm, 'energyKWhPerKm')
        : null;
    }
    if (availability !== undefined) {
      vehicle.availability = availability;
      if (availability === VEHICLE_STATUS.RETIRED && vehicle.assignedDriverId) {
        await Driver.findByIdAndUpdate(vehicle.assignedDriverId, { assignedVehicleId: null });
        vehicle.assignedDriverId = null;
      }
    }

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

    await assertNoActiveDriverOrVehicleOperations({
      vehicleIds: [vehicle._id],
      driverIds: vehicle.assignedDriverId ? [vehicle.assignedDriverId] : [],
      actionLabel: 'retire vehicle',
    });

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

/**
 * POST /api/v1/vehicles/:id/maintenance
 * Log a maintenance record for a vehicle
 */
const logMaintenance = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
    }

    const { serviceDate, type, cost, notes, nextServiceDate } = req.body;
    const trimmedType = typeof type === 'string' ? type.trim() : '';

    if (!serviceDate || !trimmedType) {
      throw new AppError('Service date and maintenance type are required', 400, 'MISSING_FIELDS');
    }

    const parsedServiceDate = new Date(serviceDate);
    if (Number.isNaN(parsedServiceDate.getTime())) {
      throw new AppError('Service date must be a valid date', 400, 'INVALID_SERVICE_DATE_RANGE');
    }

    if (!isProvided(cost) || !Number.isFinite(Number(cost)) || Number(cost) < 0) {
      throw new AppError('Maintenance cost must be a non-negative finite number', 400, 'INVALID_MAINTENANCE_COST');
    }

    let parsedNextServiceDate;
    if (isProvided(nextServiceDate)) {
      parsedNextServiceDate = new Date(nextServiceDate);
      if (Number.isNaN(parsedNextServiceDate.getTime()) || parsedNextServiceDate < parsedServiceDate) {
        throw new AppError('Next service date must be on or after the service date', 400, 'INVALID_SERVICE_DATE_RANGE');
      }
    }

    const record = new MaintenanceRecord({
      vehicleId: vehicle._id,
      serviceDate: parsedServiceDate,
      type: trimmedType,
      cost: Number(cost),
      notes: typeof notes === 'string' ? notes.trim() : notes,
      nextServiceDate: parsedNextServiceDate,
    });

    await record.save();

    await recordAuditEvent({
      type: AUDIT_EVENT_TYPES.STATUS_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Logged maintenance record for vehicle ${vehicle.vehicleId}`,
      metadata: { vehicleId: vehicle.vehicleId, maintenanceType: trimmedType },
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance record logged successfully',
      data: record,
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
  importCsv,
  logMaintenance,
};
