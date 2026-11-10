const mongoose = require('mongoose');
const { NOTIFICATION_SEVERITIES } = require('../config/constants');

const systemNotificationSchema = new mongoose.Schema(
  {
    targetRole: {
      type: String,
      enum: ['ALL', 'ADMIN', 'FLEET_MANAGER', 'DRIVER'],
      default: 'ADMIN',
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(NOTIFICATION_SEVERITIES),
      default: NOTIFICATION_SEVERITIES.INFO,
    },
    category: {
      type: String,
      enum: ['SYSTEM_HEALTH', 'INTEGRATION', 'FLEET', 'ROUTE', 'SECURITY', 'SAFETY', 'GENERAL'],
      default: 'GENERAL',
    },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
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

systemNotificationSchema.index({ severity: 1, createdAt: -1 });

const SystemNotification = mongoose.model('SystemNotification', systemNotificationSchema);

module.exports = SystemNotification;