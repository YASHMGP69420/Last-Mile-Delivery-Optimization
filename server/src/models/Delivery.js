const mongoose = require('mongoose');
const {
  DELIVERY_STATUS,
  PRIORITY_LEVELS,
  FAILURE_REASONS,
  BHUBANESWAR_ZONES,
} = require('../config/constants');

const deliverySchema = new mongoose.Schema(
  {
    orderReference: {
      type: String,
      required: [true, 'Order reference / tracking ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBatch',
      default: null,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, 'Customer contact number is required'],
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: null,
      },
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true,
      },
      city: {
        type: String,
        required: true,
        default: 'Bhubaneswar',
      },
      zone: {
        type: String,
        required: true,
        enum: BHUBANESWAR_ZONES,
        default: 'Other',
      },
      postalCode: {
        type: String,
        required: [true, 'Postal pincode is required'],
        trim: true,
      },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [85.8645, 20.2961],
      },
      geocoded: {
        type: Boolean,
        default: false,
      },
      geocodingConfidence: {
        type: Number,
        default: 0.0,
      },
      geocodingSource: {
        type: String,
        enum: ['GOOGLE_MAPS', 'CACHE', 'MANUAL', 'SIMULATED'],
        default: 'SIMULATED',
      },
    },
    weightKg: {
      type: Number,
      required: [true, 'Consignment weight in kg is required'],
      min: [0.01, 'Weight must be strictly positive'],
    },
    volumeM3: {
      type: Number,
      default: 0.01,
      min: [0, 'Volume cannot be negative'],
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(PRIORITY_LEVELS),
      default: PRIORITY_LEVELS.STANDARD,
    },
    timeWindow: {
      start: {
        type: String,
        required: [true, 'Start time window (HH:mm) is required'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time window start format (HH:mm)'],
      },
      end: {
        type: String,
        required: [true, 'End time window (HH:mm) is required'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time window end format (HH:mm)'],
      },
    },
    serviceDurationMinutes: {
      type: Number,
      default: 10,
      min: [1, 'Service duration must be at least 1 minute'],
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(DELIVERY_STATUS),
      default: DELIVERY_STATUS.DRAFT,
    },
    isDemoData: {
      type: Boolean,
      default: false,
      index: true,
    },
    assignedVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    proofOfDelivery: {
      otp: {
        type: String,
        default: null,
      },
      otpVerified: {
        type: Boolean,
        default: false,
      },
      signatureSvg: {
        type: String,
        default: null,
      },
      photoUrl: {
        type: String,
        default: null,
      },
      photoCoordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      temperatureReading: {
        type: Number,
        default: null,
      },
      handoverNotes: {
        type: String,
        default: null,
      },
    },
    failureReason: {
      type: String,
      enum: [...Object.values(FAILURE_REASONS), null],
      default: null,
    },
    failureNotes: {
      type: String,
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

deliverySchema.index({ batchId: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ priority: 1 });
deliverySchema.index({ 'address.zone': 1 });
deliverySchema.index({ location: '2dsphere' });
deliverySchema.index({ assignedDriverId: 1 });
deliverySchema.index({ assignedVehicleId: 1 });

// Time window validation hook
deliverySchema.pre('validate', function (next) {
  if (this.timeWindow && this.timeWindow.start && this.timeWindow.end) {
    if (this.timeWindow.start >= this.timeWindow.end) {
      this.invalidate('timeWindow', 'Invalid time window: start time must precede end time');
    }
  }
  next();
});

const Delivery = mongoose.model('Delivery', deliverySchema);

module.exports = Delivery;

