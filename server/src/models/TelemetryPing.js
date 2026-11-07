const mongoose = require('mongoose');

const telemetryPingSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver ID is required for telemetry ingestion'],
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    source: {
      type: String,
      enum: ['MOBILE_APP_GPS', 'VEHICLE_OBD2_CANBUS', 'SIMULATOR'],
      default: 'MOBILE_APP_GPS',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates [lng, lat] are required'],
        validate: {
          validator: function (val) {
            return (
              Array.isArray(val) &&
              val.length === 2 &&
              typeof val[0] === 'number' &&
              typeof val[1] === 'number' &&
              !isNaN(val[0]) &&
              !isNaN(val[1]) &&
              val[0] >= -180 &&
              val[0] <= 180 &&
              val[1] >= -90 &&
              val[1] <= 90
            );
          },
          message: 'Coordinates must be valid [longitude, latitude] numbers within geographic bounds',
        },
      },
    },
    accuracyMeters: {
      type: Number,
      min: [0, 'Accuracy cannot be negative'],
      default: 5.0,
    },
    speedKmh: {
      type: Number,
      min: [0, 'Speed cannot be negative'],
      default: 0.0,
    },
    headingDegrees: {
      type: Number,
      min: [0, 'Heading must be between 0 and 360 degrees'],
      max: [360, 'Heading must be between 0 and 360 degrees'],
      default: 0.0,
    },
    altitudeMeters: {
      type: Number,
      default: null,
    },
    batteryPercent: {
      type: Number,
      min: [0, 'Battery percentage cannot be below 0'],
      max: [100, 'Battery percentage cannot exceed 100'],
      default: null,
    },
    // Distinct hardware sensors: OBD-II / CAN-Bus vehicle diagnostics
    hardwareSensors: {
      connected: {
        type: Boolean,
        default: false,
      },
      engineRpm: {
        type: Number,
        default: null,
      },
      fuelLevelPercent: {
        type: Number,
        default: null,
      },
      coolantTempC: {
        type: Number,
        default: null,
      },
      odometerKm: {
        type: Number,
        default: null,
      },
      diagnosticTroubleCodes: {
        type: [String],
        default: [],
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
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

telemetryPingSchema.index({ 'location.coordinates': '2dsphere' });
telemetryPingSchema.index({ driverId: 1, timestamp: -1 });
telemetryPingSchema.index({ vehicleId: 1, timestamp: -1 });
telemetryPingSchema.index({ timestamp: -1 });

const TelemetryPing = mongoose.model('TelemetryPing', telemetryPingSchema);

module.exports = TelemetryPing;
