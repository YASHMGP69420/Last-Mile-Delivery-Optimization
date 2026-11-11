const rateLimit = require('express-rate-limit');

const AUTH_LIMIT_MESSAGE =
  'Too many authentication attempts from this IP, please try again after 15 minutes';

/**
 * Rate limiter for authentication endpoints to prevent brute-force attacks.
 * Limits each IP to 30 requests every 15 minutes.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 auth attempts per windowMs
  message: {
    success: false,
    message: AUTH_LIMIT_MESSAGE,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: AUTH_LIMIT_MESSAGE,
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter for operational API routes that perform DB work.
 */
const operationalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authRateLimiter,
  operationalRateLimiter,
};
