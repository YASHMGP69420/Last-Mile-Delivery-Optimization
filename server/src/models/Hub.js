const mongoose = require('mongoose');

const hubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hub name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Hub code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Hub address is required'],
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
    contactPhone: {
      type: String,
      trim: true,
      default: null,
    },
    operatingHours: {
      open: {
        type: String,
        default: '08:00',
        trim: true,
      },
      close: {
        type: String,
        default: '20:00',
        trim: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isCanonical: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
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

const Hub = mongoose.model('Hub', hubSchema);

module.exports = Hub;
