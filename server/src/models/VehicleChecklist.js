const mongoose = require('mongoose');
const { CHECKLIST_STATUS } = require('../config/constants');

const checklistItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(CHECKLIST_STATUS),
      default: CHECKLIST_STATUS.PASS,
      required: true,
    },
    notes: { type: String, default: '' },
    isCritical: { type: Boolean, default: false },
  },
  { _id: false }
);

const vehicleChecklistSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle ID is required'],
      index: true,
    },
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
    },
    odometerReadingKm: {
      type: Number,
      min: 0,
      default: 0,
    },
    fuelOrBatteryLevelPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    items: {
      brakes: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: true }),
      },
      tyres: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: true }),
      },
      lights: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: true }),
      },
      indicators: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: false }),
      },
      mirrors: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: false }),
      },
      horn: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: false }),
      },
      bodyCondition: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: false }),
      },
      documents: {
        type: checklistItemSchema,
        default: () => ({ status: CHECKLIST_STATUS.PASS, isCritical: true }),
      },
    },
    hasCriticalFailure: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['PASSED', 'FAILED_CRITICAL', 'NEEDS_ATTENTION'],
      default: 'PASSED',
    },
    overallNotes: {
      type: String,
      default: '',
    },
    photoEvidenceUrl: {
      type: String,
      default: '',
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

vehicleChecklistSchema.index({ vehicleId: 1, createdAt: -1 });
vehicleChecklistSchema.index({ driverId: 1, createdAt: -1 });

const VehicleChecklist = mongoose.model('VehicleChecklist', vehicleChecklistSchema);

module.exports = VehicleChecklist;