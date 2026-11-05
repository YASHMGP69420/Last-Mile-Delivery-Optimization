// server/src/routes/fleetRoutes.js
const express = require('express');
const router = express.Router();
const fleetController = require('../controllers/fleetController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All fleet routes require authentication
router.use(authenticate);

// GET all fleets – admin only
router.get('/', authorize(ROLES.ADMIN), fleetController.getFleets);

// POST a single fleet – admin only
router.post('/', authorize(ROLES.ADMIN), fleetController.createFleet);

// CSV bulk import – admin only
router.post('/import-csv',
  authorize(ROLES.ADMIN),
  express.text({ type: ['text/csv', 'application/json'], limit: '10mb' }),
  fleetController.importCsv);

module.exports = router;
