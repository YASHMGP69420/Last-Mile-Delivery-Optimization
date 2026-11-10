const mongoose = require('mongoose');
const { DRIVER_AVAILABILITY } = require('../config/constants');

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Associated User ID is required'],
      unique: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'Commercial driving license number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    assignedVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    availability: {
      type: String,
      required: true,
      enum: Object.values(DRIVER_AVAILABILITY),
      default: DRIVER_AVAILABILITY.AVAILABLE,
    },
    rating: {
      type: Number,
      required: true,
      min: [1.0, 'Rating cannot be below 1.0'],
      max: [5.0, 'Rating cannot exceed 5.0'],
      default: 4.9,
    },
    onTimeRuns: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currentRouteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    isDemoData: {
      type: Boolean,
      default: false,
      index: true,
    },
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

driverSchema.index(
  { assignedVehicleId: 1 },
  { unique: true, partialFilterExpression: { assignedVehicleId: { $type: 'objectId' } } }
);
driverSchema.index({ availability: 1 });

const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;
