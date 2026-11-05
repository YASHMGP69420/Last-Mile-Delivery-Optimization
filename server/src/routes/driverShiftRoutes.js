const express = require('express');
const router = express.Router();
const driverShiftController = require('../controllers/driverShiftController');
const { authorize, authenticate } = require('../middleware/auth');

// All routes require authentication and appropriate role (FLEET_MANAGER or ADMIN)
router.use(authenticate);
router.use(authorize(['ADMIN', 'FLEET_MANAGER']));

router.post('/', driverShiftController.createShift);
router.get('/', driverShiftController.getShifts);
router.put('/:id', driverShiftController.updateShift);
router.delete('/:id', driverShiftController.deleteShift);

module.exports = router;
