const crypto = require('crypto');
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
    const { email, password, identifier } = req.body;
    const loginIdentifier = (email || identifier || '').trim();
    if (!loginIdentifier || !password) {
      throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    let user = null;
    const cleanId = loginIdentifier.toLowerCase();

    // 1. Lookup user by email
    user = await User.findOne({ email: cleanId }).select('+passwordHash');

    // 2. If not found, lookup by phone number or commercial license number
    if (!user) {
      user = await User.findOne({ phone: loginIdentifier }).select('+passwordHash');
    }

    if (!user) {
      const driverRecord = await Driver.findOne({
        $or: [
          { phone: loginIdentifier },
          { licenseNumber: new RegExp(`^${loginIdentifier}$`, 'i') },
        ],
      });
      if (driverRecord && driverRecord.userId) {
        user = await User.findById(driverRecord.userId).select('+passwordHash');
      }
    }

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
      if (!driverProfile) {
        throw new AppError('Driver profile not found. Please contact administration.', 404, 'DRIVER_PROFILE_MISSING');
      }
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
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(decoded.sub).select('+refreshToken');
    if (!user || !user.active || (user.accountStatus && user.accountStatus !== 'ACTIVE')) {
      throw new AppError('User not found or deactivated', 401, 'USER_INACTIVE');
    }

    // Constant-time comparison against stored refreshToken (prevents re-use after logout / password reset)
    const storedToken = user.refreshToken || '';
    const storedBuf = Buffer.from(storedToken, 'utf8');
    const incomingBuf = Buffer.from(refreshToken, 'utf8');
    const tokensMatch =
      storedBuf.length > 0 &&
      storedBuf.length === incomingBuf.length &&
      crypto.timingSafeEqual(storedBuf, incomingBuf);

    if (!tokensMatch) {
      throw new AppError('Refresh token has been revoked or superseded', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Rotate refresh token so the submitted token cannot be replayed
    const token = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        token,
        refreshToken: newRefreshToken,
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
      passwordHash: password, // Model pre-save hook will hash this
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

/**
 * POST /api/v1/auth/register
 * Public account registration for Admin, Fleet Manager, and Driver
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, licenseNumber } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400, 'MISSING_FIELDS');
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400, 'PASSWORD_TOO_SHORT');
    }

    // Admin and Fleet Manager accounts cannot be self-registered publicly
    if (role === ROLES.ADMIN || role === ROLES.FLEET_MANAGER) {
      throw new AppError(
        'Admin and Fleet Manager accounts cannot be self-registered. They are provisioned directly by corporate administration.',
        403,
        'REGISTRATION_ROLE_FORBIDDEN'
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    // Public self-registration is strictly for Drivers
    const userRole = ROLES.DRIVER;

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash: password, // Model pre-save hook will hash this
      role: userRole,
      phone: phone ? phone.trim() : null,
      active: true,
      accountStatus: 'ACTIVE',
      department: 'Fleet Operations (Mobile)',
    });

    await user.save();

    let driverProfile = null;
    if (user.role === ROLES.DRIVER) {
      const license = licenseNumber ? licenseNumber.toUpperCase().trim() : null;
      if (!license) {
        throw new AppError('Driver registration requires a license number', 400, 'MISSING_LICENSE');
      }
      driverProfile = new Driver({
        userId: user._id,
        licenseNumber: license,
        phone: phone || 'N/A',
        status: 'AVAILABLE',
        availability: 'AVAILABLE',
      });
      await driverProfile.save();
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
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
          assignedVehicle: null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/google
 * Google OAuth sign in & account linking for Admin, Fleet Manager, and Driver
 */
const googleAuth = async (req, res, next) => {
  try {
    const { credential, profile, role } = req.body;

    let googleData = null;

    // 1. If a raw JWT credential was passed from Google Identity Services, decode it
    if (credential && typeof credential === 'string') {
      try {
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          googleData = {
            googleId: decoded.sub,
            email: decoded.email.toLowerCase().trim(),
            name: decoded.name || decoded.email.split('@')[0],
            avatarUrl: decoded.picture || null,
          };
        }
      } catch (e) {
        // Fall through to profile check
      }
    }

    // 2. If structured profile or demo payload was passed
    if (!googleData && profile && profile.email) {
      googleData = {
        googleId: profile.googleId || profile.sub || `google_${Date.now()}`,
        email: profile.email.toLowerCase().trim(),
        name: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.avatarUrl || profile.picture || null,
      };
    }

    if (!googleData || !googleData.email) {
      throw new AppError('Invalid Google authentication payload', 400, 'INVALID_GOOGLE_AUTH');
    }

    // 3. Find existing user by googleId OR email
    let user = await User.findOne({
      $or: [{ googleId: googleData.googleId }, { email: googleData.email }],
    });

    const validRoles = [ROLES.ADMIN, ROLES.FLEET_MANAGER, ROLES.DRIVER];
    const requestedRole = role && validRoles.includes(role) ? role : ROLES.DRIVER;

    if (user) {
      if (!user.googleId) user.googleId = googleData.googleId;
      if (!user.avatarUrl && googleData.avatarUrl) user.avatarUrl = googleData.avatarUrl;
      if (!user.active) {
        throw new AppError('User account is deactivated', 401, 'USER_INACTIVE');
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      user = new User({
        name: googleData.name,
        email: googleData.email,
        googleId: googleData.googleId,
        avatarUrl: googleData.avatarUrl,
        role: requestedRole,
        active: true,
        accountStatus: 'ACTIVE',
        department: requestedRole === ROLES.DRIVER ? 'Fleet Operations (Mobile)' : 'Logistics Operations',
        lastLogin: new Date(),
      });
      await user.save();
    }

    // 4. If Driver role, ensure linked Driver document exists
    let driverProfile = null;
    if (user.role === ROLES.DRIVER) {
      driverProfile = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
      if (!driverProfile) {
        throw new AppError('Driver profile not found. Please contact administration.', 404, 'DRIVER_PROFILE_MISSING');
      }
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatarUrl: user.avatarUrl || null,
          driverId: driverProfile ? driverProfile._id.toString() : null,
          assignedVehicle: driverProfile ? driverProfile.assignedVehicleId : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  googleAuth,
  refresh,
  logout,
  provisionUser,
  getMe,
};
