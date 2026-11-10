const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

// Batch Queries & Operations
router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.getBatches);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.createBatch);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.getBatchById);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatch);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatch);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatch);
router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatchStatus);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.deleteBatch);

// Advanced Batch Management & Operations
router.post('/:id/duplicate', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.duplicateBatch);
router.post('/:id/deliveries', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.addDeliveriesToBatch);
router.delete('/:id/deliveries/:deliveryId', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.removeDeliveryFromBatch);
router.post('/:id/assign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.assignBatchFleet);
router.get('/:id/export', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.exportBatchCsv);

module.exports = router;
