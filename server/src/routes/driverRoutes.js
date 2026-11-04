const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.getDrivers);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.createDriver);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.getDriverById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.updateDriver);
router.put('/:id/assign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.assignVehicle);
router.put('/:id/unassign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.unassignVehicle);

module.exports = router;
