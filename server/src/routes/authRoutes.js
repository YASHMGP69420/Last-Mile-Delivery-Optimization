const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { authRateLimiter } = require('../middleware/rateLimiter');

// Public endpoints
router.post('/login', authRateLimiter, authController.login);
router.post('/register', authRateLimiter, authController.register);
router.post('/google', authController.googleAuth);
router.post('/refresh', authController.refresh);

// Authenticated endpoints
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

// Admin-only user provisioning
router.post('/users', authenticate, authorize(ROLES.ADMIN), authController.provisionUser);

module.exports = router;
