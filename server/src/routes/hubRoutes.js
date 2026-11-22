const express = require('express');
const router = express.Router();
const hubController = require('../controllers/hubController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All hub endpoints require authentication and Admin/Fleet Manager authorization
router.use(authenticate);
router.use(authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER));

router.get('/', hubController.getHubs);
router.post('/', hubController.createHub);

module.exports = router;
