const DEV_LOCALHOST_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

/**
 * Trim whitespace and strip trailing slashes from an origin string.
 */
function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

/**
 * Parse comma-separated CLIENT_ORIGIN values into a deduplicated, normalized array.
 * Appends localhost dev origins only outside NODE_ENV=production.
 */
function parseAllowedOrigins(rawClientOrigin = '', nodeEnv = process.env.NODE_ENV) {
  const parsed = String(rawClientOrigin || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (nodeEnv !== 'production') {
    return Array.from(new Set([...parsed, ...DEV_LOCALHOST_ORIGINS]));
  }

  return Array.from(new Set(parsed));
}

/**
 * Check whether an Origin header's host matches the request's Host or X-Forwarded-Host header.
 * Supports both Express requests and raw Node/Engine.IO IncomingMessage instances.
 */
function isSameRequestHost(origin, req) {
  try {
    const originHost = new URL(origin).host;
    const rawHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
    const requestHost = rawHost ? String(rawHost).split(',')[0].trim() : '';
    return Boolean(
      originHost && requestHost && originHost.toLowerCase() === requestHost.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Build a cors(delegate) options callback shared by Express and Socket.IO.
 */
function createCorsOptionsDelegate({
  allowedOrigins = [],
  nodeEnv = process.env.NODE_ENV,
  serveClient = false,
  methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
} = {}) {
  const normalizedAllowed = Array.isArray(allowedOrigins)
    ? allowedOrigins.map(normalizeOrigin).filter(Boolean)
    : [];

  return (req, callback) => {
    const rawOrigin = req?.headers?.origin;
    if (!rawOrigin || nodeEnv !== 'production') {
      return callback(null, { origin: true, credentials: true, methods });
    }

    const normalized = normalizeOrigin(rawOrigin);
    if (
      normalizedAllowed.includes(normalized) ||
      (serveClient && isSameRequestHost(normalized, req))
    ) {
      return callback(null, { origin: true, credentials: true, methods });
    }

    const err = new Error('Blocked by CORS');
    err.statusCode = 403;
    err.code = 'CORS_BLOCKED';
    return callback(err);
  };
}

module.exports = {
  DEV_LOCALHOST_ORIGINS,
  normalizeOrigin,
  parseAllowedOrigins,
  isSameRequestHost,
  createCorsOptionsDelegate,
};
