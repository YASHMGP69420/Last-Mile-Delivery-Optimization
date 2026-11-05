const mongoose = require('mongoose');
const { VEHICLE_STATUS, VEHICLE_TYPES, FUEL_TYPES } = require('../config/constants');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      required: [true, 'Vehicle ID / registration plate is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    makeModel: {
      type: String,
      required: [true, 'Make and model is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: Object.values(VEHICLE_TYPES),
    },
    capacityKg: {
      type: Number,
      required: [true, 'Payload capacity in kg is required'],
      min: [0.1, 'Capacity must be strictly positive'],
    },
    capacityM3: {
      type: Number,
      min: [0.01, 'Volumetric capacity must be strictly positive'],
      default: null,
    },
    fuelType: {
      type: String,
      required: [true, 'Fuel type is required'],
      enum: Object.values(FUEL_TYPES),
    },
    kmPerLitre: {
      type: Number,
      min: [0.1, 'kmPerLitre must be strictly positive'],
      default: null,
    },
    energyKWhPerKm: {
      type: Number,
      min: [0.01, 'energyKWhPerKm must be strictly positive'],
      default: null,
    },
    availability: {
      type: String,
      required: true,
      enum: Object.values(VEHICLE_STATUS),
      default: VEHICLE_STATUS.AVAILABLE,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    batterySoC: {
      type: Number,
      min: [0, 'Battery SoC cannot be less than 0%'],
      max: [100, 'Battery SoC cannot exceed 100%'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.status = ret.availability;
        ret.registrationNumber = ret.vehicleId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

vehicleSchema.index({ availability: 1 });
vehicleSchema.index({ fuelType: 1 });
vehicleSchema.index(
  { assignedDriverId: 1 },
  { unique: true, partialFilterExpression: { assignedDriverId: { $type: 'objectId' } } }
);

vehicleSchema.virtual('status')
  .get(function () {
    return this.availability;
  })
  .set(function (val) {
    this.availability = val;
  });

vehicleSchema.virtual('registrationNumber')
  .get(function () {
    return this.vehicleId;
  })
  .set(function (val) {
    this.vehicleId = val;
  });

// Fuel efficiency validation hook
vehicleSchema.pre('validate', function (next) {
  if (this.fuelType === FUEL_TYPES.ELECTRIC) {
    if (!this.energyKWhPerKm || this.energyKWhPerKm <= 0) {
      this.invalidate('energyKWhPerKm', 'Electric vehicles must specify energyKWhPerKm > 0');
    }
    this.kmPerLitre = null;
  } else {
    if (!this.kmPerLitre || this.kmPerLitre <= 0) {
      this.invalidate('kmPerLitre', 'Combustion vehicles (Petrol/Diesel) must specify kmPerLitre > 0');
    }
    this.energyKWhPerKm = null;
  }
  next();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
