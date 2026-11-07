/**
 * Socket.IO Singleton Manager
 * Provides centralized real-time event emission across the application
 */
let ioInstance = null;

const setIo = (io) => {
  ioInstance = io;
};

const getIo = () => {
  return ioInstance;
};

/**
 * Emit route dispatch event to rooms and tracking namespace
 */
const emitRouteDispatched = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('route:dispatched', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('route:dispatched', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:dispatched', payload);
    }
    if (typeof ioInstance.of === 'function') {
      ioInstance.of('/socket/tracking').emit('route:dispatched', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit route:dispatched: ${err.message}`);
  }
};

/**
 * Emit stop sequence reorder event to active driver
 */
const emitRouteReordered = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('route:reordered', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('route:reordered', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:reordered', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit route:reordered: ${err.message}`);
  }
};

/**
 * Emit route cancellation event
 */
const emitRouteCancelled = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('route:cancelled', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('route:cancelled', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:cancelled', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit route:cancelled: ${err.message}`);
  }
};

/**
 * Emit stop cancelled event
 */
const emitStopCancelled = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('stop:cancelled', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('stop:cancelled', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('stop:cancelled', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit stop:cancelled: ${err.message}`);
  }
};

/**
 * Emit stop priority escalation event
 */
const emitPriorityEscalated = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('stop:priority_escalated', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('stop:priority_escalated', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit stop:priority_escalated: ${err.message}`);
  }
};

/**
 * Emit direct operational message to driver
 */
const emitDispatchMessage = (payload) => {
  if (!ioInstance) return;
  try {
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('dispatch:message', payload);
    } else {
      ioInstance.emit('dispatch:message', payload);
    }
    // Also emit as telemetry alert for backward compatibility
    ioInstance.emit('telemetry:alert', payload);
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit dispatch:message: ${err.message}`);
  }
};

/**
 * Emit delivery status change (e.g., driver completed or arrived at stop)
 */
const emitDeliveryUpdated = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('delivery:updated', payload);
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:progress', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit delivery:updated: ${err.message}`);
  }
};

/**
 * Emit live telemetry GPS ping
 */
const emitTelemetryPing = (pingData) => {
  if (!ioInstance) return;
  ioInstance.emit('telemetry:ping', pingData);
  if (pingData.driverId) {
    ioInstance.to(`driver:${pingData.driverId}`).emit('telemetry:driver:update', pingData);
  }
  if (pingData.routeId) {
    ioInstance.to(`route:${pingData.routeId}`).emit('telemetry:route:update', pingData);
  }
};

/**
 * Emit telemetry system alert
 */
const emitTelemetryAlert = (alertData) => {
  if (!ioInstance) return;
  ioInstance.emit('telemetry:alert', alertData);
};

module.exports = {
  setIo,
  getIo,
  emitRouteDispatched,
  emitRouteReordered,
  emitRouteCancelled,
  emitStopCancelled,
  emitPriorityEscalated,
  emitDispatchMessage,
  emitDeliveryUpdated,
  emitTelemetryPing,
  emitTelemetryAlert,
};
