const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All route operations require authentication
router.use(authenticate);

// Optimization & Dispatch: restricted to ADMIN and FLEET_MANAGER
router.post(
  '/optimize',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.optimizeRoutes
);

router.post(
  '/:id/dispatch',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.dispatchRoute
);

// Route Queries: accessible by ADMIN, FLEET_MANAGER, and DRIVER (with BOLA)
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  routeController.getRoutes
);

router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  routeController.getRouteById
);

module.exports = router;
