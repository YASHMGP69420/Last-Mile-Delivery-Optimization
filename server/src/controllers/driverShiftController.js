/**
 * Driver Shift Controller
 * Provides CRUD operations and conflict validation for driver shifts.
 */

const DriverShift = require('../models/DriverShift');
const Driver = require('../models/Driver');
const { AppError } = require('../middleware/errorHandler');
const { SHIFT_STATUS } = require('../config/constants');

/** Create a new shift */
exports.createShift = async (req, res, next) => {
  try {
    const { driverId, date, startTime, endTime, breakDurationMinutes, notes } = req.body;
    if (!driverId || !date || !startTime || !endTime) {
      throw new AppError('driverId, date, startTime and endTime are required', 400, 'MISSING_FIELDS');
    }
    // Ensure driver exists
    const driver = await Driver.findById(driverId);
    if (!driver) throw new AppError('Driver not found', 404, 'DRIVER_NOT_FOUND');

    // Conflict check: overlapping shift for same day
    const existing = await DriverShift.findOne({ driverId, date: new Date(date) });
    if (existing) {
      throw new AppError('Shift already exists for this driver on the given date', 409, 'SHIFT_CONFLICT');
    }

    const shift = await DriverShift.create({ driverId, date, startTime, endTime, breakDurationMinutes, notes });
    res.status(201).json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
};

/** Get shifts – optional filtering by driverId and date range */
exports.getShifts = async (req, res, next) => {
  try {
    const { driverId, startDate, endDate } = req.query;
    const filter = {};
    if (driverId) filter.driverId = driverId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const shifts = await DriverShift.find(filter).populate('driverId', 'licenseNumber phone');
    res.json({ success: true, data: shifts });
  } catch (err) {
    next(err);
  }
};

/** Update a shift */
exports.updateShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const shift = await DriverShift.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!shift) throw new AppError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
};

/** Delete a shift */
exports.deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shift = await DriverShift.findByIdAndDelete(id);
    if (!shift) throw new AppError('Shift not found', 404, 'SHIFT_NOT_FOUND');
    res.json({ success: true, message: 'Shift deleted' });
  } catch (err) {
    next(err);
  }
};
