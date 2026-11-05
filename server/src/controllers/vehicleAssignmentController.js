/**
 * Vehicle Assignment Controller
 * Handles assigning a vehicle (and driver) to a route and validates conflicts.
 */

const VehicleAssignment = require('../models/VehicleAssignment');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const { AppError } = require('../middleware/errorHandler');
const { VEHICLE_STATUS, DRIVER_AVAILABILITY } = require('../config/constants');

/** Assign a vehicle to a driver for a specific route */
exports.createAssignment = async (req, res, next) => {
  try {
    const { vehicleId, driverId, routeId, startTime, endTime } = req.body;
    if (!vehicleId || !driverId || !routeId || !startTime || !endTime) {
      throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Verify vehicle and driver exist and are available
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) throw new AppError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    if (vehicle.availability !== VEHICLE_STATUS.AVAILABLE) {
      throw new AppError('Vehicle not available for assignment', 409, 'VEHICLE_UNAVAILABLE');
    }

    const driver = await Driver.findById(driverId);
    if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');
    if (driver.availability !== DRIVER_AVAILABILITY.AVAILABLE) {
      throw new AppError('Driver not available for assignment', 409, 'DRIVER_UNAVAILABLE');
    }

    const assignment = await VehicleAssignment.create({ vehicleId, driverId, routeId, startTime, endTime });
    // Update statuses atomically
    await Promise.all([
      Vehicle.findByIdAndUpdate(vehicleId, { availability: VEHICLE_STATUS.ASSIGNED, assignedDriverId: driverId }),
      Driver.findByIdAndUpdate(driverId, { availability: DRIVER_AVAILABILITY.ON_DUTY, assignedVehicleId: vehicleId }),
    ]);

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

/** Get assignments – filterable */
exports.getAssignments = async (req, res, next) => {
  try {
    const { vehicleId, driverId, routeId, status } = req.query;
    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (driverId) filter.driverId = driverId;
    if (routeId) filter.routeId = routeId;
    if (status) filter.status = status;
    const assignments = await VehicleAssignment.find(filter).populate('vehicleId driverId routeId');
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

/** Cancel an assignment */
exports.cancelAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await VehicleAssignment.findById(id);
    if (!assignment) throw new AppError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    if (['COMPLETED', 'CANCELLED'].includes(assignment.status)) {
      throw new AppError('Cannot cancel a completed or already cancelled assignment', 400, 'INVALID_STATE');
    }
    assignment.status = 'CANCELLED';
    await assignment.save();
    // Release vehicle and driver
    await Promise.all([
      Vehicle.findByIdAndUpdate(assignment.vehicleId, { availability: VEHICLE_STATUS.AVAILABLE, assignedDriverId: null }),
      Driver.findByIdAndUpdate(assignment.driverId, { availability: DRIVER_AVAILABILITY.AVAILABLE, assignedVehicleId: null }),
    ]);
    res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};
