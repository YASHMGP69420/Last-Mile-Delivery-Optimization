const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES, VEHICLE_STATUS, DRIVER_AVAILABILITY } = require('../config/constants');

/**
 * GET /api/v1/drivers
 */
const getDrivers = async (req, res, next) => {
  try {
    const { availability, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (availability) {
      filter.availability = availability;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [drivers, total] = await Promise.all([
      Driver.find(filter)
        .populate('userId', 'name email phone role')
        .populate('assignedVehicleId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Driver.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        drivers,
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
 * POST /api/v1/drivers
 */
const createDriver = async (req, res, next) => {
  try {
    const { userId, licenseNumber, phone } = req.body;
    if (!userId || !licenseNumber || !phone) {
      throw new AppError('userId, licenseNumber, and phone are required', 400, 'MISSING_FIELDS');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Associated User not found', 404, 'USER_NOT_FOUND');
    }

    const existing = await Driver.findOne({ licenseNumber: licenseNumber.toUpperCase().trim() });
    if (existing) {
      throw new AppError(`License number '${licenseNumber}' already registered`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    const driver = new Driver({
      userId,
      licenseNumber: licenseNumber.toUpperCase().trim(),
      phone: phone.trim(),
    });
    await driver.save();

    res.status(201).json({
      success: true,
      message: 'Driver profile created',
      data: {
        driver,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/drivers/:id
 */
const getDriverById = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('userId', 'name email phone role')
      .populate('assignedVehicleId');

    if (!driver) {
      throw new AppError('Driver not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        driver,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/drivers/:id
 */
const updateDriver = async (req, res, next) => {
  try {
    const { phone, availability, rating } = req.body;
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      throw new AppError('Driver not found', 404, 'NOT_FOUND');
    }

    if (phone !== undefined) driver.phone = phone.trim();
    if (availability !== undefined) driver.availability = availability;
    if (rating !== undefined) driver.rating = rating;

    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Driver updated successfully',
      data: {
        driver,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/drivers/:id/assign
 * 1:1 Vehicle-Driver Mutual Exclusivity
 */
const assignVehicle = async (req, res, next) => {
  let driver = null;
  try {
    const { vehicleId } = req.body;
    if (!vehicleId) {
      throw new AppError('Target vehicleId is required for assignment', 400, 'MISSING_VEHICLE_ID');
    }

    driver = await Driver.findById(req.params.id);
    if (!driver) {
      throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    if (vehicle.availability === VEHICLE_STATUS.RETIRED || vehicle.availability === VEHICLE_STATUS.MAINTENANCE) {
      throw new AppError(`Vehicle is currently in ${vehicle.availability} status and cannot be assigned`, 400, 'VEHICLE_UNAVAILABLE');
    }

    if (vehicle.availability === VEHICLE_STATUS.IN_TRANSIT) {
      throw new AppError('Vehicle is currently in active transit and cannot be assigned', 409, 'VEHICLE_IN_ACTIVE_TRANSIT');
    }

    if (driver.availability === DRIVER_AVAILABILITY.IN_TRANSIT) {
      throw new AppError('Driver is currently in active transit on a route', 409, 'DRIVER_IN_ACTIVE_TRANSIT');
    }

    // If target vehicle is currently assigned to another driver, check if that driver is in transit
    const previousDriverIdOnVehicle = vehicle.assignedDriverId;
    if (previousDriverIdOnVehicle && previousDriverIdOnVehicle.toString() !== driver._id.toString()) {
      const formerDriver = await Driver.findById(previousDriverIdOnVehicle);
      if (formerDriver && formerDriver.availability === DRIVER_AVAILABILITY.IN_TRANSIT) {
        throw new AppError('Vehicle is currently in active transit with another driver', 409, 'VEHICLE_IN_ACTIVE_TRANSIT');
      }
    }

    // If driver already had a different assigned vehicle, release that former vehicle first
    // so that the partial unique index on Vehicle.assignedDriverId allows assignment to the new vehicle
    let previousVehicleIdOfDriver = null;
    if (driver.assignedVehicleId && driver.assignedVehicleId.toString() !== vehicle._id.toString()) {
      previousVehicleIdOfDriver = driver.assignedVehicleId;
      await Vehicle.findByIdAndUpdate(previousVehicleIdOfDriver, {
        assignedDriverId: null,
        availability: VEHICLE_STATUS.AVAILABLE,
      });
    }

    // Atomic compare-and-swap update on Vehicle:
    // Guarantees vehicle is acquired only if its assignedDriverId has not changed concurrently
    let updatedVehicle = null;
    try {
      updatedVehicle = await Vehicle.findOneAndUpdate(
        {
          _id: vehicle._id,
          availability: { $nin: [VEHICLE_STATUS.RETIRED, VEHICLE_STATUS.MAINTENANCE, VEHICLE_STATUS.IN_TRANSIT] },
          assignedDriverId: previousDriverIdOnVehicle,
        },
        {
          assignedDriverId: driver._id,
          availability: VEHICLE_STATUS.ASSIGNED,
        },
        { new: true }
      );

      if (!updatedVehicle) {
        if (previousVehicleIdOfDriver) {
          await Vehicle.findByIdAndUpdate(previousVehicleIdOfDriver, {
            assignedDriverId: driver._id,
            availability: VEHICLE_STATUS.ASSIGNED,
          });
        }
        throw new AppError('Vehicle is no longer available or was concurrently assigned', 409, 'CONCURRENCY_CONFLICT');
      }
    } catch (err) {
      if (previousVehicleIdOfDriver) {
        await Vehicle.findByIdAndUpdate(previousVehicleIdOfDriver, {
          assignedDriverId: driver._id,
          availability: VEHICLE_STATUS.ASSIGNED,
        });
      }
      throw err;
    }

    // If target vehicle was assigned to a former driver, release that former driver
    if (previousDriverIdOnVehicle && previousDriverIdOnVehicle.toString() !== driver._id.toString()) {
      await Driver.findByIdAndUpdate(previousDriverIdOnVehicle, {
        assignedVehicleId: null,
      });
    }

    // Atomically pair driver
    driver.assignedVehicleId = vehicle._id;
    driver.availability = DRIVER_AVAILABILITY.AVAILABLE;
    await driver.save();

    await recordAuditEvent({
      type: AUDIT_EVENT_TYPES.ASSIGNMENT_CHANGE,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Assigned vehicle ${vehicle.vehicleId} to driver ${driver.licenseNumber}`,
      metadata: { driverId: driver._id, vehicleId: vehicle._id },
    });

    res.status(200).json({
      success: true,
      message: 'Vehicle assigned to driver successfully',
      data: {
        driver,
        vehicle: updatedVehicle,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('Vehicle or driver is already concurrently assigned', 409, 'CONCURRENCY_CONFLICT'));
    }
    next(error);
  }
};

/**
 * PUT /api/v1/drivers/:id/unassign
 */
const unassignVehicle = async (req, res, next) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
    }

    if (driver.availability === DRIVER_AVAILABILITY.IN_TRANSIT) {
      throw new AppError('Driver is currently in active transit and cannot be unassigned', 409, 'DRIVER_IN_ACTIVE_TRANSIT');
    }

    let vehicle = null;
    if (driver.assignedVehicleId) {
      vehicle = await Vehicle.findByIdAndUpdate(
        driver.assignedVehicleId,
        { assignedDriverId: null, availability: VEHICLE_STATUS.AVAILABLE },
        { new: true }
      );
      driver.assignedVehicleId = null;
      await driver.save();

      await recordAuditEvent({
        type: AUDIT_EVENT_TYPES.ASSIGNMENT_CHANGE,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: `Unassigned vehicle from driver ${driver.licenseNumber}`,
        metadata: { driverId: driver._id },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle unassigned from driver successfully',
      data: {
        driver,
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDrivers,
  createDriver,
  getDriverById,
  updateDriver,
  assignVehicle,
  unassignVehicle,
};
