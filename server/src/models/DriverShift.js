// DriverShift model
// Represents a scheduled work shift for a driver.
// Fields include driver reference, date, start/end times, break duration, and status.

const mongoose = require('mongoose');
const { SHIFT_STATUS } = require('../config/constants'); // assume constants defined

const driverShiftSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      // store only the day component (time set to 00:00) for easier querying
    },
    startTime: { type: String, required: true }, // ISO time string e.g., "08:00"
    endTime: { type: String, required: true }, // ISO time string e.g., "17:00"
    breakDurationMinutes: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: Object.values(SHIFT_STATUS),
      default: SHIFT_STATUS.SCHEDULED,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    fuelUnit: {
      type: String,
      enum: ['L', '%'],
      default: 'L',
    },
    startOdometerKm: { type: Number, min: 0, default: null },
    startFuelOrCharge: { type: Number, min: 0, default: null },
    endOdometerKm: { type: Number, min: 0, default: null },
    endFuelOrCharge: { type: Number, min: 0, default: null },
    actualDistanceKm: { type: Number, min: 0, default: 0 },
    actualFuelOrChargeUsed: { type: Number, min: 0, default: 0 },
    telemetryCapturedAtStart: { type: Boolean, default: false },
    telemetryCapturedAtEnd: { type: Boolean, default: false },
    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Composite index for fast lookup of a driver's shifts on a given day
driverShiftSchema.index({ driverId: 1, date: 1 });

module.exports = mongoose.model('DriverShift', driverShiftSchema);
