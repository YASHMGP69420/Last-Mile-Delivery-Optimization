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
  '/evaluate-baseline',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER),
  routeController.evaluateBaseline
);

router.post(
  '/validate-dispatch',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.validateDispatch
);

router.post(
  '/dispatch',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.dispatchDirect
);

router.post(
  '/:id/dispatch',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.dispatchRoute
);

router.post(
  '/:id/push',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.pushRouteToHandheld
);

router.post(
  '/:id/reorder',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.reorderRouteStops
);

router.post(
  '/:id/reoptimize',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.reoptimizeRoute
);

router.post(
  '/:id/message',
  authorize(ROLES.ADMIN, ROLES.FLEET_MANAGER),
  routeController.sendRouteMessage
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
