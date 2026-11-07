const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Guard all telemetry routes
router.use(authenticate);

// Ingestion: Drivers, Managers, Admins can post telemetry
router.post(
  '/',
  authorize(ROLES.DRIVER, ROLES.FLEET_MANAGER, ROLES.ADMIN),
  telemetryController.ingestTelemetry
);

// Real-time fleet snapshot: All authenticated internal roles
router.get(
  '/live',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DISPATCHER, ROLES.DRIVER),
  telemetryController.getLiveFleet
);

// Breadcrumb history
router.get(
  '/history/:vehicleId',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DISPATCHER),
  telemetryController.getVehicleHistory
);

// Telemetry Alerts
router.get(
  '/alerts',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DISPATCHER),
  telemetryController.getAlerts
);

// Alert Acknowledgment
router.post(
  '/alerts/:id/ack',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  telemetryController.acknowledgeAlert
);

module.exports = router;
