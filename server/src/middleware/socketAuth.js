const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const { ROLES } = require('../config/constants');
const { isTokenBlacklisted } = require('./auth');
const Driver = require('../models/Driver');
const Route = require('../models/Route');

const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.FLEET_MANAGER, 'DISPATCHER'];

/**
 * Extracts authentication token from socket handshake
 */
const extractToken = (handshake) => {
  if (!handshake) return null;

  // 1. Check socket.handshake.auth.token
  if (handshake.auth && typeof handshake.auth.token === 'string') {
    return handshake.auth.token.trim();
  }

  // 2. Check Authorization header
  if (handshake.headers && handshake.headers.authorization) {
    const parts = handshake.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
    return handshake.headers.authorization.trim();
  }

  // 3. Fallback to query parameter
  if (handshake.query && typeof handshake.query.token === 'string') {
    return handshake.query.token.trim();
  }

  return null;
};

/**
 * Socket.IO Handshake Authentication Middleware
 * Validates JWT access token and binds decoded user to socket
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const token = extractToken(socket.handshake);
    if (!token) {
      const err = new Error('AUTHENTICATION_REQUIRED');
      err.data = {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Valid JWT authentication token required to establish WebSocket session.',
      };
      return next(err);
    }

    if (isTokenBlacklisted(token)) {
      const err = new Error('TOKEN_REVOKED');
      err.data = {
        code: 'TOKEN_REVOKED',
        message: 'Authentication token has been revoked.',
      };
      return next(err);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    socket.token = token;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const authErr = new Error('TOKEN_EXPIRED');
      authErr.data = {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired. Please refresh session.',
      };
      return next(authErr);
    }
    const authErr = new Error('INVALID_TOKEN');
    authErr.data = {
      code: 'INVALID_TOKEN',
      message: 'Authentication token verification failed.',
    };
    return next(authErr);
  }
};

/**
 * Registers secure room subscription handlers on authenticated socket
 */
const registerAuthorizedSocketHandlers = (socket, io) => {
  const user = socket.user;

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (user: ${user?.email}, role: ${user?.role})`);
  }

  // ----------------------------------------------------
  // driver:join — subscribe to driver-specific events
  // ----------------------------------------------------
  socket.on('driver:join', async (data, ack) => {
    try {
      const driverId = data?.driverId;
      if (!driverId) {
        const error = { code: 'BAD_REQUEST', message: 'driverId is required' };
        socket.emit('error', error);
        if (typeof ack === 'function') ack({ success: false, ...error });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(driverId)) {
        const error = { code: 'INVALID_ID', message: 'driverId must be a valid ObjectId' };
        socket.emit('error', error);
        if (typeof ack === 'function') ack({ success: false, ...error });
        return;
      }

      // Management roles have global driver room visibility
      if (MANAGEMENT_ROLES.includes(user.role)) {
        const room = `driver:${driverId}`;
        socket.join(room);
        if (typeof ack === 'function') ack({ success: true, room });
        return;
      }

      // Drivers can only join their own room
      if (user.role === ROLES.DRIVER) {
        const driverDoc = await Driver.findOne({ userId: user.id }).lean();
        if (!driverDoc || driverDoc._id.toString() !== driverId.toString()) {
          const error = {
            code: 'FORBIDDEN',
            message: 'Unauthorized driver room access: drivers may only subscribe to their own updates.',
          };
          socket.emit('error', error);
          if (typeof ack === 'function') ack({ success: false, ...error });
          return;
        }

        const room = `driver:${driverId}`;
        socket.join(room);
        if (typeof ack === 'function') ack({ success: true, room });
        return;
      }

      const error = { code: 'FORBIDDEN', message: 'Insufficient role permissions to join driver room' };
      socket.emit('error', error);
      if (typeof ack === 'function') ack({ success: false, ...error });
    } catch (err) {
      const error = { code: 'INTERNAL_ERROR', message: err.message };
      socket.emit('error', error);
      if (typeof ack === 'function') ack({ success: false, ...error });
    }
  });

  // ----------------------------------------------------
  // driver:leave
  // ----------------------------------------------------
  socket.on('driver:leave', (data, ack) => {
    const driverId = data?.driverId;
    if (driverId) {
      socket.leave(`driver:${driverId}`);
      if (typeof ack === 'function') ack({ success: true });
    }
  });

  // ----------------------------------------------------
  // route:join — subscribe to route-specific progress & dispatch events
  // ----------------------------------------------------
  socket.on('route:join', async (data, ack) => {
    try {
      const routeId = data?.routeId;
      if (!routeId) {
        const error = { code: 'BAD_REQUEST', message: 'routeId is required' };
        socket.emit('error', error);
        if (typeof ack === 'function') ack({ success: false, ...error });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        const error = { code: 'INVALID_ID', message: 'routeId must be a valid ObjectId' };
        socket.emit('error', error);
        if (typeof ack === 'function') ack({ success: false, ...error });
        return;
      }

      // Management roles have global route room visibility
      if (MANAGEMENT_ROLES.includes(user.role)) {
        const room = `route:${routeId}`;
        socket.join(room);
        if (typeof ack === 'function') ack({ success: true, room });
        return;
      }

      // Drivers can only join routes assigned to them
      if (user.role === ROLES.DRIVER) {
        const driverDoc = await Driver.findOne({ userId: user.id }).lean();
        if (!driverDoc) {
          const error = { code: 'FORBIDDEN', message: 'Driver profile not found' };
          socket.emit('error', error);
          if (typeof ack === 'function') ack({ success: false, ...error });
          return;
        }

        const routeDoc = await Route.findOne({ _id: routeId, driverId: driverDoc._id }).lean();
        if (!routeDoc) {
          const error = {
            code: 'FORBIDDEN',
            message: 'Unauthorized route room access: route is not assigned to your account.',
          };
          socket.emit('error', error);
          if (typeof ack === 'function') ack({ success: false, ...error });
          return;
        }

        const room = `route:${routeId}`;
        socket.join(room);
        if (typeof ack === 'function') ack({ success: true, room });
        return;
      }

      const error = { code: 'FORBIDDEN', message: 'Insufficient role permissions to join route room' };
      socket.emit('error', error);
      if (typeof ack === 'function') ack({ success: false, ...error });
    } catch (err) {
      const error = { code: 'INTERNAL_ERROR', message: err.message };
      socket.emit('error', error);
      if (typeof ack === 'function') ack({ success: false, ...error });
    }
  });

  // ----------------------------------------------------
  // route:leave
  // ----------------------------------------------------
  socket.on('route:leave', (data, ack) => {
    const routeId = data?.routeId;
    if (routeId) {
      socket.leave(`route:${routeId}`);
      if (typeof ack === 'function') ack({ success: true });
    }
  });

  // ----------------------------------------------------
  // disconnect
  // ----------------------------------------------------
  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (user: ${user?.email})`);
    }
  });
};

module.exports = {
  extractToken,
  socketAuthMiddleware,
  registerAuthorizedSocketHandlers,
};
