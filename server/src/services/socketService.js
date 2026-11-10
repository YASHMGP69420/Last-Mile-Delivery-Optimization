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
 * Emit route dispatch event to target driver, route, and management rooms
 */
const emitRouteDispatched = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.to('management').emit('route:dispatched', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('route:dispatched', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:dispatched', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit route:dispatched: ${err.message}`);
  }
};

/**
 * Emit stop sequence reorder event to active driver & management
 */
const emitRouteReordered = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.to('management').emit('route:reordered', payload);
    ioInstance.to('management').emit('route:updated', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('route:reordered', payload);
      ioInstance.to(`driver:${payload.driverId}`).emit('route:updated', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:reordered', payload);
      ioInstance.to(`route:${payload.routeId}`).emit('route:updated', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit route:reordered: ${err.message}`);
  }
};

/**
 * Emit route cancellation event to target driver & management
 */
const emitRouteCancelled = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.to('management').emit('route:cancelled', payload);
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
    ioInstance.to('management').emit('stop:cancelled', payload);
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
    ioInstance.to('management').emit('stop:priority_escalated', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('stop:priority_escalated', payload);
    }
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit stop:priority_escalated: ${err.message}`);
  }
};

/**
 * Emit direct operational message to driver (or global driver broadcast when target driverId is omitted)
 */
const emitDispatchMessage = (payload) => {
  if (!ioInstance) return;
  try {
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('dispatch:message', payload);
    } else {
      ioInstance.emit('dispatch:message', payload);
    }
    ioInstance.to('management').emit('dispatch:message', payload);
  } catch (err) {
    console.warn(`[SocketBroadcast] Failed to emit dispatch:message: ${err.message}`);
  }
};

/**
 * Emit delivery status change (e.g., driver arrived, completed, or failed stop)
 */
const emitDeliveryUpdated = (payload) => {
  if (!ioInstance) return;
  try {
    ioInstance.to('management').emit('delivery:updated', payload);
    if (payload.driverId) {
      ioInstance.to(`driver:${payload.driverId}`).emit('delivery:updated', payload);
    }
    if (payload.routeId) {
      ioInstance.to(`route:${payload.routeId}`).emit('route:progress', payload);
      ioInstance.to('management').emit('route:progress', payload);
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
  ioInstance.to('management').emit('telemetry:ping', pingData);
  if (pingData.driverId) {
    ioInstance.to(`driver:${pingData.driverId}`).emit('telemetry:driver:update', pingData);
  }
  if (pingData.routeId) {
    ioInstance.to(`route:${pingData.routeId}`).emit('telemetry:route:update', pingData);
  }
};

/**
 * Emit telemetry / safety system alert to management & target driver
 */
const emitTelemetryAlert = (alertData) => {
  if (!ioInstance) return;
  ioInstance.to('management').emit('telemetry:alert', alertData);
  if (alertData?.driverId) {
    ioInstance.to(`driver:${alertData.driverId}`).emit('telemetry:alert', alertData);
  }
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
