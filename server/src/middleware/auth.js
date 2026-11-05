const jwt = require('jsonwebtoken');
const env = require('../config/env');

// In-memory blacklist for invalidated tokens upon logout
const tokenBlacklist = new Set();

/**
 * Generate Access Token (JWT)
 */
const generateAccessToken = (user) => {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN || '15m' });
};

/**
 * Generate Refresh Token (JWT)
 */
const generateRefreshToken = (user) => {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d' });
};

/**
 * Invalidate a token
 */
const blacklistToken = (token) => {
  if (token) {
    tokenBlacklist.add(token);
  }
};

/**
 * Authentication Middleware
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid format. Expected Bearer token.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_REVOKED',
        message: 'This session token has been revoked / logged out.',
      },
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please refresh your session.',
        },
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token verification failed.',
      },
    });
  }
};

/**
 * Role-Based Access Control Middleware Factory
 */
const authorize = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required before authorization.',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Requires one of roles: [${roles.join(', ')}]. Current role: '${req.user.role}'`,
        },
      });
    }

    next();
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  blacklistToken,
  authenticate,
  authorize,
};
