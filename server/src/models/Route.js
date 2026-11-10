const mongoose = require('mongoose');
const { CANONICAL_DEPOT } = require('../config/constants');

const routeStopSchema = new mongoose.Schema(
  {
    sequence: {
      type: Number,
      required: true,
      min: 1,
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Delivery',
      required: true,
    },
    orderReference: {
      type: String,
      required: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    address: {
      street: { type: String, required: true },
      zone: { type: String, required: true },
      city: { type: String, default: 'Bhubaneswar' },
      postalCode: { type: String, required: true },
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    weightKg: {
      type: Number,
      required: true,
    },
    priority: {
      type: String,
      required: true,
    },
    timeWindow: {
      start: { type: String, required: true },
      end: { type: String, required: true },
    },
    eta: {
      type: String,
      default: null,
    },
    distanceFromPrevKm: {
      type: Number,
      default: 0.0,
    },
    durationFromPrevMin: {
      type: Number,
      default: 0.0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ARRIVED', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    routeCode: {
      type: String,
      required: [true, 'Route code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBatch',
      required: [true, 'Associated batch ID is required'],
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Assigned vehicle ID is required'],
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
    },
    depot: {
      name: { type: String, default: CANONICAL_DEPOT.name },
      address: { type: String, default: CANONICAL_DEPOT.address },
      geo: {
        lat: { type: Number, default: CANONICAL_DEPOT.geo.lat },
        lng: { type: Number, default: CANONICAL_DEPOT.geo.lng },
      },
    },
    stops: [routeStopSchema],
    metrics: {
      totalStops: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0.0 },
      totalDurationMin: { type: Number, default: 0.0 },
      totalWeightKg: { type: Number, default: 0.0 },
      costInr: { type: Number, default: 0.0 },
      co2Kg: { type: Number, default: 0.0 },
      fuelConsumed: { type: Number, default: 0.0 },
      fuelUnit: { type: String, default: 'L' },
    },
    baseline: {
      totalDistanceKm: { type: Number, default: 0.0 },
      totalDurationMin: { type: Number, default: 0.0 },
      costInr: { type: Number, default: 0.0 },
      co2Kg: { type: Number, default: 0.0 },
    },
    deltas: {
      distanceSavedKm: { type: Number, default: 0.0 },
      timeSavedMin: { type: Number, default: 0.0 },
      costSavedInr: { type: Number, default: 0.0 },
      co2AvoidedKg: { type: Number, default: 0.0 },
      percentDistanceReduction: { type: Number, default: 0.0 },
    },
    optimizationMetadata: {
      algorithm: { type: String, default: '2-OPT_TSP_NN' },
      maxIterations: { type: Number, default: 1000 },
      executedIterations: { type: Number, default: 0 },
      trafficScenario: { type: String, default: 'FREE_FLOW' },
      matrixSource: { type: String, default: 'SIMULATED' },
      converged: { type: Boolean, default: true },
    },
    version: {
      type: Number,
      default: 1,
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
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

routeSchema.index({ batchId: 1, status: 1 });
routeSchema.index({ vehicleId: 1 });
routeSchema.index({ driverId: 1 });

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;
