const express = require('express');
const router = express.Router();
const hubController = require('../controllers/hubController');
const { authenticate, authorize } = require('../middleware/auth');
const { operationalCrudRateLimiter } = require('../middleware/rateLimiter');
const { ROLES } = require('../config/constants');

// All hub endpoints require authentication and Admin/Fleet Manager authorization
router.use(authenticate);
router.use(operationalCrudRateLimiter);
router.use(authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER));

router.get('/', hubController.getHubs);
router.post('/', hubController.createHub);
router.get('/:id', hubController.getHubById);
router.put('/:id', hubController.updateHub);
router.delete('/:id', hubController.deleteHub);
router.patch('/:id/toggle-active', hubController.toggleHubActive);

module.exports = router;
