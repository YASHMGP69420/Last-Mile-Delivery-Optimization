const mongoose = require('mongoose');
const { AUDIT_EVENT_TYPES } = require('../config/constants');

const auditEventSchema = new mongoose.Schema(
  {
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Delivery',
      default: null,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeliveryBatch',
      default: null,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    type: {
      type: String,
      required: [true, 'Audit event type is required'],
      enum: Object.values(AUDIT_EVENT_TYPES),
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
    },
    actorRole: {
      type: String,
      required: [true, 'Actor role is required'],
      enum: ['ADMIN', 'FLEET_MANAGER', 'DRIVER', 'SYSTEM'],
    },
    action: {
      type: String,
      required: [true, 'Action description is required'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    isDemoData: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: false,
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

auditEventSchema.index({ deliveryId: 1, at: -1 });
auditEventSchema.index({ routeId: 1, at: -1 });
auditEventSchema.index({ actorId: 1, at: -1 });
auditEventSchema.index({ at: -1 });

const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);

module.exports = AuditEvent;
