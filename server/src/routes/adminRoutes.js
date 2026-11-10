const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Authenticate all routes in this router
router.use(authenticate);

// Shared Operations Alerts & Driver Incidents (accessible to both ADMIN and FLEET_MANAGER)
router.get('/notifications', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), adminController.getNotifications);
router.post('/notifications', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), adminController.createNotification);
router.patch('/notifications/:id/read', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), adminController.markNotificationRead);
router.get('/incidents', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), adminController.getIncidents);
router.patch('/incidents/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), adminController.resolveIncident);

// Guard remaining administrative governance routes to ADMIN role exclusively
router.use(authorize(ROLES.ADMIN));

// Overview & Live Health
router.get('/overview', adminController.getOverview);

// User & Access Management
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Role & Permissions Configuration
router.get('/permissions', adminController.getPermissions);
router.put('/permissions', adminController.updatePermissions);

// Organization & Depots
router.get('/organization', adminController.getOrganization);
router.put('/organization', adminController.updateOrganization);
router.post('/depots', adminController.addDepot);
router.put('/depots/:id', adminController.updateDepot);

// Fleet-Wide Control Center & Operational Overrides
router.get('/fleet-control', adminController.getFleetControl);
router.post('/fleet-control/override', adminController.overrideFleetResource);

// Operations Oversight & Overrides
router.get('/operations', adminController.getOperationsOversight);
router.post('/operations/override', adminController.overrideOperation);

// Optimization Configuration
router.get('/optimization-settings', adminController.getOptimizationSettings);
router.put('/optimization-settings', adminController.updateOptimizationSettings);

// Fuel & Operational Policy Settings
router.get('/fuel-settings', adminController.getFuelSettings);
router.put('/fuel-settings', adminController.updateFuelSettings);

// Integration Management
router.get('/integrations', adminController.getIntegrations);
router.post('/integrations/test', adminController.testIntegration);

// System Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// Data Management & Exports
router.get('/data-export', adminController.exportData);

module.exports = router;