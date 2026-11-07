const express = require('express');
const router = express.Router();
const driverHudController = require('../controllers/driverHudController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Guard all driver HUD endpoints: authenticate & allow DRIVER, ADMIN, FLEET_MANAGER
router.use(authenticate);
router.use(authorize(ROLES.DRIVER, ROLES.ADMIN, ROLES.FLEET_MANAGER));

// Cockpit Dashboard
router.get('/dashboard', driverHudController.getDashboard);

// Shift & Attendance Tools
router.post('/shifts/start', driverHudController.startShift);
router.post('/shifts/break', driverHudController.toggleBreak);
router.post('/shifts/end', driverHudController.endShift);

// Pre-trip Vehicle Checklist
router.post('/vehicle-check', driverHudController.submitVehicleCheck);

// Navigation & Active Route & Live Location
router.get('/route', driverHudController.getActiveRoute);
router.post('/route/claim', driverHudController.claimRoute);
router.post('/location', driverHudController.updateLocation);

// Consignment Execution & Status Management
router.get('/deliveries', driverHudController.getDeliveries);
router.get('/deliveries/:id', driverHudController.getDeliveryById);
router.post('/deliveries/:id/arrived', driverHudController.markDeliveryArrived);
router.post('/deliveries/:id/complete', driverHudController.completeDelivery);
router.post('/deliveries/:id/fail', driverHudController.failDelivery);

// Incidents & Support
router.get('/incidents', driverHudController.getIncidents);
router.post('/incidents', driverHudController.reportIncident);

// Profile & Notifications
router.get('/profile', driverHudController.getProfile);
router.get('/notifications', driverHudController.getNotifications);

module.exports = router;