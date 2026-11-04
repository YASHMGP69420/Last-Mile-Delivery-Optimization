const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All vehicle routes require authentication
router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), vehicleController.getVehicles);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), vehicleController.createVehicle);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), vehicleController.getVehicleById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), vehicleController.updateVehicle);
router.delete('/:id', authorize(ROLES.ADMIN), vehicleController.deleteVehicle);

module.exports = router;
