// VehicleAssignment model
// Represents an assignment of a vehicle (and driver) to a specific route.

const mongoose = require('mongoose');
const { VEHICLE_STATUS } = require('../config/constants'); // status enum defined elsewhere

const vehicleAssignmentSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
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

// Ensure a vehicle cannot have overlapping active assignments (partial filter on status)
vehicleAssignmentSchema.index(
  { vehicleId: 1, startTime: 1, endTime: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'ACTIVE'] } } }
);

module.exports = mongoose.model('VehicleAssignment', vehicleAssignmentSchema);
