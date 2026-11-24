const rateLimit = require('express-rate-limit');

const AUTH_LIMIT_MESSAGE =
  'Too many authentication attempts from this IP, please try again after 15 minutes.';

/**
 * Helper to determine if we should bypass rate limiting during tests.
 * Rate limiting is skipped in 'test' environment unless explicitly enabled via ENABLE_TEST_RATE_LIMIT='true'.
 */
const isTestEnv = () =>
  process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_RATE_LIMIT !== 'true';

/**
 * Factory for tiered rate limiters using express-rate-limit v7 standards.
 */
const createRateLimiter = ({
  windowMs,
  max,
  message,
  code = 'RATE_LIMIT_EXCEEDED',
  keyGenerator = (req) => req.user?.id || req.ip,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return RateLimit-* IETF standard headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    keyGenerator,
    skip: isTestEnv,
    message: {
      success: false,
      message,
      error: {
        code,
        message,
      },
    },
  });

/**
 * Tier 1: Telemetry Ingestion (120 pings per minute per driver/user)
 * Accommodates ~1Hz GPS telemetry bursts during navigation while preventing flood attacks.
 */
const telemetryRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: 'Telemetry ingestion limit exceeded (max 120 pings/min).',
  code: 'TELEMETRY_RATE_LIMIT_EXCEEDED',
});

/**
 * Tier 2: Operational CRUD & State Transitions (100 requests per minute per user)
 * Applied to deliveries, routes, vehicles, and hubs.
 */
const operationalCrudRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Operational request limit exceeded (max 100 req/min).',
  code: 'CRUD_RATE_LIMIT_EXCEEDED',
});

// Backward compatibility alias for operational endpoints
const operationalRateLimiter = operationalCrudRateLimiter;

/**
 * Tier 3: Heavy Operations (15 requests per 15 minutes per user)
 * Applied to batch CSV imports, manifest exports, and dev-purge operations.
 */
const heavyOpsRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: 'Heavy operation rate limit exceeded. Please wait 15 minutes before retrying.',
  code: 'HEAVY_OPS_RATE_LIMIT_EXCEEDED',
});

/**
 * Tier 4: Authentication (30 attempts per 15 minutes per IP)
 * Prevents brute-forcing on credentials, Google auth, and OTP endpoints.
 */
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: AUTH_LIMIT_MESSAGE,
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
  keyGenerator: (req) => req.ip,
});

/**
 * Global API Baseline (600 requests per 15 minutes per IP)
 * Restricts public / unauthenticated scraper abuse across /api/v1.
 */
const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    success: false,
    message: 'Global API request rate limit exceeded.',
    error: {
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      message: 'Global API request rate limit exceeded.',
    },
  },
});

module.exports = {
  isTestEnv,
  createRateLimiter,
  telemetryRateLimiter,
  operationalCrudRateLimiter,
  operationalRateLimiter,
  heavyOpsRateLimiter,
  authRateLimiter,
  globalApiRateLimiter,
};
