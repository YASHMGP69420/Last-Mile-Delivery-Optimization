const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

router.use(authenticate);

router.post('/reset-test-drivers', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), async (req, res, next) => {
  try {
    await Driver.updateMany({}, { $set: { availability: 'AVAILABLE', currentRouteId: null } });
    await Vehicle.updateMany({}, { $set: { availability: 'AVAILABLE' } });
    res.json({ success: true, message: 'Test drivers and vehicles reset to AVAILABLE' });
  } catch (err) {
    next(err);
  }
});

router.get('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.getDrivers);
router.post('/', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.createDriver);
router.post(
  '/import-csv',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  express.text({ type: ['text/csv', 'application/json'], limit: '10mb' }),
  driverController.importCsv
);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.getDriverById);
router.put('/:id', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.updateDriver);
router.put('/:id/assign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.assignVehicle);
router.put('/:id/unassign', authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER), driverController.unassignVehicle);

module.exports = router;
