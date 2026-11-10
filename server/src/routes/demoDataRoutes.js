const express = require('express');
const router = express.Router();
const demoDataController = require('../controllers/demoDataController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// Strictly Admin-only removable Demo Dataset management endpoints
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/status', demoDataController.getStatus);
router.post('/import', demoDataController.importDemoData);
router.delete('/', demoDataController.deleteDemoData);

module.exports = router;
