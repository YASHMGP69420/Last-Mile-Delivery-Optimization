const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

// Delivery manifest querying and creation
router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), deliveryController.getDeliveries);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), deliveryController.createDelivery);

// CSV Manifest Import (accepts JSON { csvContent, dryRun, rows } or raw text)
router.post(
  '/import-csv',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
  deliveryController.importCsvManifest
);

// Individual delivery operations
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER), deliveryController.getDeliveryById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), deliveryController.updateDelivery);
router.patch('/:id/assign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), deliveryController.assignDelivery);
router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  deliveryController.updateDeliveryStatus
);
router.post('/:id/complete', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER), deliveryController.completeDelivery);
router.post('/:id/fail', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER), deliveryController.failDelivery);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), deliveryController.deleteDelivery);

module.exports = router;
