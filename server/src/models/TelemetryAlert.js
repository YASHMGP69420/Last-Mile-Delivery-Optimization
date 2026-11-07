const mongoose = require('mongoose');

const telemetryAlertSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    alertType: {
      type: String,
      required: true,
      enum: ['OVERSPEED', 'LOW_BATTERY', 'STALE_SIGNAL', 'GEOFENCE_DEVIATION', 'EMERGENCY_SOS'],
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'WARNING',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
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

telemetryAlertSchema.index({ acknowledged: 1, createdAt: -1 });
telemetryAlertSchema.index({ driverId: 1, createdAt: -1 });
telemetryAlertSchema.index({ vehicleId: 1, createdAt: -1 });
telemetryAlertSchema.index({ createdAt: -1 });

const TelemetryAlert = mongoose.model('TelemetryAlert', telemetryAlertSchema);

module.exports = TelemetryAlert;
