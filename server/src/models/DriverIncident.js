const mongoose = require('mongoose');
const { INCIDENT_CATEGORIES } = require('../config/constants');

const driverIncidentSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver ID is required'],
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Delivery',
      default: null,
    },
    category: {
      type: String,
      enum: Object.values(INCIDENT_CATEGORIES),
      required: [true, 'Incident category is required'],
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
      trim: true,
    },
    locationCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    photoEvidenceUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'DISMISSED'],
      default: 'OPEN',
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

driverIncidentSchema.index({ status: 1, createdAt: -1 });

const DriverIncident = mongoose.model('DriverIncident', driverIncidentSchema);

module.exports = DriverIncident;