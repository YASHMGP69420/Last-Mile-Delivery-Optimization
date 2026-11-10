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

maintenanceRecordSchema.pre('validate', function (next) {
  if (
    this.cost !== undefined &&
    this.cost !== null &&
    (Number.isNaN(Number(this.cost)) || Number(this.cost) < 0)
  ) {
    this.invalidate('cost', 'Maintenance cost cannot be negative');
  }
  if (this.nextServiceDate && this.serviceDate) {
    const service = new Date(this.serviceDate);
    const nextService = new Date(this.nextServiceDate);
    if (
      !Number.isNaN(service.getTime()) &&
      !Number.isNaN(nextService.getTime()) &&
      nextService < service
    ) {
      this.invalidate('nextServiceDate', 'Next service date must be on or after the service date');
    }
  }
  next();
});

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
