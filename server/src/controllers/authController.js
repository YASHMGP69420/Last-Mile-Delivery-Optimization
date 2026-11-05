const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const env = require('../config/env');
const { ROLES } = require('../config/constants');
const {
  generateAccessToken,
  generateRefreshToken,
  blacklistToken,
} = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user || !user.active) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    let driverProfile = null;
    if (user.role === ROLES.DRIVER) {
      driverProfile = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
    }

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          driverId: driverProfile ? driverProfile._id.toString() : null,
          assignedVehicle: driverProfile ? driverProfile.assignedVehicleId : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(decoded.sub);
    if (!user || !user.active) {
      throw new AppError('User not found or deactivated', 401, 'USER_INACTIVE');
    }

    const token = generateAccessToken(user);

    res.status(200).json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    if (req.token) {
      blacklistToken(req.token);
    }
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/users (ADMIN only)
 */
const provisionUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, licenseNumber } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400, 'MISSING_FIELDS');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      throw new AppError(`User with email '${email}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    }

    const user = new User({
      name,
      email,
      passwordHash: password,
      role: role || ROLES.DRIVER,
      phone: phone || null,
      active: true,
    });
    await user.save();

    let driver = null;
    if (user.role === ROLES.DRIVER) {
      if (!licenseNumber) {
        throw new AppError('Driver role requires licenseNumber', 400, 'MISSING_LICENSE');
      }
      driver = new Driver({
        userId: user._id,
        licenseNumber: licenseNumber.toUpperCase().trim(),
        phone: phone || 'N/A',
      });
      await driver.save();
    }

    res.status(201).json({
      success: true,
      message: 'User provisioned successfully',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
        driver,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    let driver = null;
    if (user.role === ROLES.DRIVER) {
      driver = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          driverId: driver ? driver._id.toString() : null,
          assignedVehicle: driver ? driver.assignedVehicleId : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout,
  provisionUser,
  getMe,
};
