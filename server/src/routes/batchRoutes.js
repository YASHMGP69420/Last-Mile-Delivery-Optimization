const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.getBatches);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.createBatch);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.getBatchById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatch);
router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.updateBatchStatus);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), batchController.deleteBatch);

module.exports = router;
