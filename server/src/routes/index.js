const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const vehicleRoutes = require('./vehicleRoutes');
const driverRoutes = require('./driverRoutes');
const deliveryRoutes = require('./deliveryRoutes');
const batchRoutes = require('./batchRoutes');
const routeRoutes = require('./routeRoutes');

// API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SmartRoute API v1 operational',
    timestamp: new Date().toISOString(),
  });
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/drivers', driverRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/batches', batchRoutes);
router.use('/routes', routeRoutes);

module.exports = router;
