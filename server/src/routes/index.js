const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const vehicleRoutes = require('./vehicleRoutes');
const driverRoutes = require('./driverRoutes');
const deliveryRoutes = require('./deliveryRoutes');
const batchRoutes = require('./batchRoutes');
const routeRoutes = require('./routeRoutes');
const fleetRoutes = require('./fleetRoutes'); // new fleet routes
const adminRoutes = require('./adminRoutes');
const driverHudRoutes = require('./driverHudRoutes');
const telemetryRoutes = require('./telemetryRoutes');

const mongoose = require('mongoose');

// API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SmartRoute API v1 operational',
    timestamp: new Date().toISOString(),
  });
});

// Production Readiness & Liveness Check
router.get('/health/ready', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? 200 : 503;
  res.status(status).json({
    success: isDbConnected,
    status: isDbConnected ? 'READY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      api: 'UP',
      database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
    },
  });
});

// Mount modules
router.use('/auth', authRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/drivers', driverRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/batches', batchRoutes);
router.use('/routes', routeRoutes);
router.use('/fleets', fleetRoutes); // new fleet routes
router.use('/admin', adminRoutes);
router.use('/driver-hud', driverHudRoutes);
router.use('/telemetry', telemetryRoutes);

module.exports = router;
