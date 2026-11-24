const mongoose = require('mongoose');
const AuditEvent = require('../models/AuditEvent');

/**
 * Record an immutable audit event in the system
 * @param {Object} params
 * @param {String} [params.deliveryId]
 * @param {String} [params.batchId]
 * @param {String} [params.routeId]
 * @param {String} params.type
 * @param {String} [params.actorId]
 * @param {String} [params.actorRole]
 * @param {String} params.action
 * @param {Object} [params.metadata]
 * @param {Boolean} [params.isDemoData]
 */
const recordAuditEvent = async ({
  deliveryId = null,
  batchId = null,
  routeId = null,
  type,
  actorId = null,
  actorRole = 'SYSTEM',
  action,
  metadata = {},
  isDemoData = false,
}) => {
  try {
    const toValidObjectId = (val) => (val && mongoose.Types.ObjectId.isValid(String(val)) ? val : null);

    const event = new AuditEvent({
      deliveryId: toValidObjectId(deliveryId),
      batchId: toValidObjectId(batchId),
      routeId: toValidObjectId(routeId),
      type,
      actorId: toValidObjectId(actorId),
      actorRole: actorRole || 'SYSTEM',
      action,
      metadata,
      isDemoData: Boolean(isDemoData),
    });
    return await event.save();
  } catch (error) {
    console.error(`[AuditEvent] Failed to persist audit event: ${error.message}`);
    // Non-blocking in production, but log error
    return null;
  }
};

module.exports = {
  recordAuditEvent,
};
