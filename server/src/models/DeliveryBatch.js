const mongoose = require('mongoose');
const { CANONICAL_DEPOT } = require('../config/constants');

const batchSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Batch code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Batch name is required'],
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'Date string (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    },
    shift: {
      type: String,
      required: true,
      default: 'Shift A (08:00 - 17:00)',
    },
    depot: {
      name: {
        type: String,
        required: true,
        default: CANONICAL_DEPOT.name,
      },
      address: {
        type: String,
        required: true,
        default: CANONICAL_DEPOT.address,
      },
      geo: {
        lat: {
          type: Number,
          required: true,
          default: CANONICAL_DEPOT.geo.lat,
        },
        lng: {
          type: Number,
          required: true,
          default: CANONICAL_DEPOT.geo.lng,
        },
      },
    },
    deliveryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
      },
    ],
    vehicleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
      },
    ],
    driverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
      },
    ],
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED'],
      default: 'DRAFT',
    },
    metrics: {
      totalDeliveries: {
        type: Number,
        default: 0,
      },
      totalWeightKg: {
        type: Number,
        default: 0.0,
      },
      assignedDeliveries: {
        type: Number,
        default: 0,
      },
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

batchSchema.index({ date: 1 });
batchSchema.index({ status: 1 });

const DeliveryBatch = mongoose.model('DeliveryBatch', batchSchema);

module.exports = DeliveryBatch;
