const AuditEvent = require('../models/AuditEvent');

/**
 * Record an immutable audit event in the system
 * @param {Object} params
 * @param {String} [params.deliveryId]
 * @param {String} [params.batchId]
 * @param {String} [params.routeId]
 * @param {String} params.type
 * @param {String} params.actorId
 * @param {String} params.actorRole
 * @param {String} params.action
 * @param {Object} [params.metadata]
 */
const recordAuditEvent = async ({
  deliveryId = null,
  batchId = null,
  routeId = null,
  type,
  actorId,
  actorRole,
  action,
  metadata = {},
}) => {
  try {
    const event = new AuditEvent({
      deliveryId,
      batchId,
      routeId,
      type,
      actorId,
      actorRole,
      action,
      metadata,
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
