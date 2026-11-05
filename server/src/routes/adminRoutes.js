const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Guard all admin routes: require authentication and ADMIN role exclusively
router.use(authenticate);
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

// System Notifications & Alerts
router.get('/notifications', adminController.getNotifications);
router.post('/notifications', adminController.createNotification);
router.patch('/notifications/:id/read', adminController.markNotificationRead);

// Data Management & Exports
router.get('/data-export', adminController.exportData);

module.exports = router;