// MaintenanceRecord model
// Tracks maintenance events for a vehicle.

const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
      index: true,
    },
    serviceDate: { type: Date, required: true },
    type: { type: String, required: true }, // e.g., 'Oil Change', 'Battery Check'
    cost: { type: Number, min: 0, default: 0 },
    notes: { type: String },
    nextServiceDate: { type: Date },
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

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
