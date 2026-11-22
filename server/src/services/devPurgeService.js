const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Route = require('../models/Route');
const RouteAssignment = require('../models/RouteAssignment');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const VehicleAssignment = require('../models/VehicleAssignment');
const TelemetryPing = require('../models/TelemetryPing');
const TelemetryAlert = require('../models/TelemetryAlert');
const DriverShift = require('../models/DriverShift');
const DriverIncident = require('../models/DriverIncident');
const VehicleChecklist = require('../models/VehicleChecklist');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const AuditEvent = require('../models/AuditEvent');
const SystemNotification = require('../models/SystemNotification');
const User = require('../models/User');
const { ROLES, AUDIT_EVENT_TYPES } = require('../config/constants');

/**
 * Hard reset & database purge service for development and testing.
 * Wipes all operational collections and driver user logins,
 * while strictly preserving all administrator accounts and sessions.
 *
 * @param {string|mongoose.Types.ObjectId} actorId - ID of admin initiating the purge
 * @returns {Promise<{ deletedCount: number, deletedCounts: Record<string, number> }>}
 */
async function purgeAllOperationalData(actorId) {
  // Execute cascade deletion across secondary and core operational collections
  const [
    delRes,
    batchRes,
    routeRes,
    routeAssignRes,
    vehRes,
    driverRes,
    vehAssignRes,
    pingRes,
    alertRes,
    shiftRes,
    incidentRes,
    checklistRes,
    maintRes,
    eventRes,
    notifRes,
    driverUserRes,
  ] = await Promise.all([
    Delivery.deleteMany({}),
    DeliveryBatch.deleteMany({}),
    Route.deleteMany({}),
    RouteAssignment.deleteMany({}),
    Vehicle.deleteMany({}),
    Driver.deleteMany({}),
    VehicleAssignment.deleteMany({}),
    TelemetryPing.deleteMany({}),
    TelemetryAlert.deleteMany({}),
    DriverShift.deleteMany({}),
    DriverIncident.deleteMany({}),
    VehicleChecklist.deleteMany({}),
    MaintenanceRecord.deleteMany({}),
    AuditEvent.deleteMany({}),
    SystemNotification.deleteMany({}),
    User.deleteMany({ role: ROLES.DRIVER }),
  ]);

  const counts = {
    deliveries: delRes.deletedCount || 0,
    deliveryBatches: batchRes.deletedCount || 0,
    routes: routeRes.deletedCount || 0,
    routeAssignments: routeAssignRes.deletedCount || 0,
    vehicles: vehRes.deletedCount || 0,
    drivers: driverRes.deletedCount || 0,
    vehicleAssignments: vehAssignRes.deletedCount || 0,
    telemetryPings: pingRes.deletedCount || 0,
    telemetryAlerts: alertRes.deletedCount || 0,
    driverShifts: shiftRes.deletedCount || 0,
    driverIncidents: incidentRes.deletedCount || 0,
    vehicleChecklists: checklistRes.deletedCount || 0,
    maintenanceRecords: maintRes.deletedCount || 0,
    deliveryEvents: eventRes.deletedCount || 0,
    systemNotifications: notifRes.deletedCount || 0,
    driverUsers: driverUserRes.deletedCount || 0,
  };

  const deletedCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

  // Record audit log for the purge action
  if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
    try {
      await AuditEvent.create({
        actorId,
        actorRole: ROLES.ADMIN,
        action: '[ADMIN] OPERATIONAL_DATABASE_PURGE',
        type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
        metadata: {
          entity: 'System',
          deletedCounts: counts,
          totalDeleted: deletedCount,
        },
      });
    } catch (auditErr) {
      console.error('[devPurgeService] Failed to create audit event:', auditErr.message);
    }
  }

  return {
    deletedCount,
    deletedCounts: counts,
  };
}

module.exports = {
  purgeAllOperationalData,
};
