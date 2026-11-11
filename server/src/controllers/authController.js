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
const otpService = require('../services/otpService');
const otpDeliveryService = require('../services/otpDeliveryService');
const googleAuthService = require('../services/googleAuthService');
const demoDataService = require('../services/demoDataService');

function buildAuthUserPayload(user, driverProfile) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerified),
    phoneVerified: Boolean(user.phoneVerified),
    avatarUrl: user.avatarUrl || null,
    isDemoData: Boolean(user.isDemoData),
    driverId: driverProfile ? driverProfile._id.toString() : null,
    assignedVehicle: driverProfile ? driverProfile.assignedVehicleId || null : null,
  };
}

async function findUserByOtpTarget(target, channel) {
  if (channel === 'EMAIL') {
    return User.findOne({ email: target.toLowerCase().trim() });
  }
  const digits = String(target).replace(/\D/g, '');
  const candidates = Array.from(new Set([target, digits, `+${digits}`].filter(Boolean)));
  let user = await User.findOne({ phone: { $in: candidates } });
  if (!user) {
    const driver = await Driver.findOne({ phone: { $in: candidates } });
    if (driver && driver.userId) {
      user = await User.findById(driver.userId);
    }
  }
  return user;
}

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
          isDemoData: Boolean(user.isDemoData),
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
          isDemoData: Boolean(user.isDemoData),
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
 * POST /api/v1/auth/otp/send
 * Issues a 6-digit OTP via Email or Phone for LOGIN or REGISTER verification.
 */
const sendOtp = async (req, res, next) => {
  try {
    const { identifier, channel, purpose = 'LOGIN' } = req.body;
    if (!['REGISTER', 'LOGIN'].includes(purpose)) {
      throw new AppError('OTP purpose must be REGISTER or LOGIN', 400, 'INVALID_OTP_PURPOSE');
    }

    const normalized = otpService.normalizeOtpTarget(identifier, channel);
    const existingUser = await findUserByOtpTarget(normalized.target, normalized.channel);

    if (purpose === 'REGISTER' && existingUser) {
      throw new AppError(
        normalized.channel === 'EMAIL'
          ? 'An account with this email already exists'
          : 'An account with this phone number already exists',
        409,
        normalized.channel === 'EMAIL' ? 'EMAIL_EXISTS' : 'PHONE_EXISTS'
      );
    }

    if (purpose === 'LOGIN') {
      if (!existingUser) {
        throw new AppError('No account found for this email or phone. Please create a driver account first.', 404, 'ACCOUNT_NOT_FOUND');
      }
      if (!existingUser.active || (existingUser.accountStatus && existingUser.accountStatus !== 'ACTIVE')) {
        throw new AppError('User account is deactivated', 401, 'USER_INACTIVE');
      }
    }

    const otpMeta = await otpService.issueOtp({
      identifier: normalized.target,
      channel: normalized.channel,
      purpose,
    });

    res.status(200).json({
      success: true,
      message: `Verification code sent via ${otpMeta.channel === 'EMAIL' ? 'email' : 'SMS'}`,
      data: otpMeta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/otp/verify
 * Verifies a 6-digit OTP and returns a short-lived single-use verificationToken.
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { identifier, channel, purpose = 'REGISTER', code } = req.body;
    const verified = await otpService.verifyOtpCode({
      identifier,
      channel,
      purpose,
      code,
    });

    res.status(200).json({
      success: true,
      message: 'Verification code confirmed',
      data: verified,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/otp/login
 * Passwordless Email or Phone OTP sign-in for Driver, Fleet Manager, and Admin accounts.
 */
const otpLogin = async (req, res, next) => {
  try {
    const { identifier, channel, code, verificationToken } = req.body;
    const consumed = await otpService.consumeVerifiedOtp({
      identifier,
      channel,
      purpose: 'LOGIN',
      verificationToken,
      code,
    });

    const user = await findUserByOtpTarget(consumed.target, consumed.channel);
    if (!user || !user.active || (user.accountStatus && user.accountStatus !== 'ACTIVE')) {
      throw new AppError('User account not found or deactivated', 401, 'USER_INACTIVE');
    }

    let driverProfile = null;
    if (user.role === ROLES.DRIVER) {
      driverProfile = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
      if (!driverProfile) {
        throw new AppError('Driver profile not found. Please contact administration.', 404, 'DRIVER_PROFILE_MISSING');
      }
    }

    if (consumed.channel === 'EMAIL' && !user.emailVerified) {
      user.emailVerified = true;
    }
    if (consumed.channel === 'PHONE' && !user.phoneVerified) {
      user.phoneVerified = true;
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        refreshToken,
        user: buildAuthUserPayload(user, driverProfile),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/register
 * OTP-verified public driver self-registration (password optional / passwordless OTP).
 */
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      licenseNumber,
      otp,
      verificationToken,
      otpTarget,
      otpChannel,
    } = req.body;

    if (!name || !email || !phone) {
      throw new AppError('Full name, email, and phone number are required', 400, 'MISSING_FIELDS');
    }

    if (password && String(password).length < 6) {
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

    const license = licenseNumber ? String(licenseNumber).toUpperCase().trim() : null;
    if (!license) {
      throw new AppError('Driver registration requires a license number', 400, 'MISSING_LICENSE');
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPhone = otpService.normalizePhone(phone) || String(phone).trim();

    // Enforce verified email or phone OTP BEFORE creating the account
    const targetToVerify = otpTarget || (otpChannel === 'PHONE' ? cleanPhone : cleanEmail);
    const verifiedOtp = await otpService.consumeVerifiedOtp({
      identifier: targetToVerify,
      channel: otpChannel,
      purpose: 'REGISTER',
      verificationToken,
      code: otp,
    });

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const existingPhoneUser = await findUserByOtpTarget(cleanPhone, 'PHONE');
    if (existingPhoneUser) {
      throw new AppError('An account with this phone number already exists', 409, 'PHONE_EXISTS');
    }

    const existingLicense = await Driver.findOne({ licenseNumber: license });
    if (existingLicense) {
      throw new AppError('A driver with this license number is already registered', 409, 'LICENSE_EXISTS');
    }

    // Public self-registration is strictly for Drivers
    const userRole = ROLES.DRIVER;

    const user = new User({
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: password || undefined,
      role: userRole,
      phone: cleanPhone,
      emailVerified: verifiedOtp.channel === 'EMAIL',
      phoneVerified: verifiedOtp.channel === 'PHONE',
      active: true,
      accountStatus: 'ACTIVE',
      department: 'Fleet Operations (Mobile)',
    });

    await user.save();

    let driverProfile = null;
    try {
      driverProfile = new Driver({
        userId: user._id,
        licenseNumber: license,
        phone: cleanPhone,
        status: 'AVAILABLE',
        availability: 'AVAILABLE',
      });
      await driverProfile.save();
    } catch (driverErr) {
      await User.deleteOne({ _id: user._id });
      throw driverErr;
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
        user: buildAuthUserPayload(user, driverProfile),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/google
 * Verified Google Identity Services ID token authentication
 */
const googleAuth = async (req, res, next) => {
  try {
    const { credential, mode } = req.body;
    const googleData = await googleAuthService.verifyGoogleIdToken(credential);

    // Find existing user by verified googleId OR email
    let user = await User.findOne({
      $or: [{ googleId: googleData.googleId }, { email: googleData.email }],
    });

    if (!user && mode === 'SIGN_IN') {
      throw new AppError(
        `No account found for ${googleData.email}. Please create an account to continue.`,
        404,
        'ACCOUNT_NOT_FOUND',
        [{ email: googleData.email, name: googleData.name }]
      );
    }

    let isNewUser = false;
    if (user) {
      if (!user.active || (user.accountStatus && user.accountStatus !== 'ACTIVE')) {
        throw new AppError('User account is deactivated', 401, 'USER_INACTIVE');
      }
      if (!user.googleId) user.googleId = googleData.googleId;
      if (googleData.avatarUrl && !user.avatarUrl) user.avatarUrl = googleData.avatarUrl;
      user.emailVerified = true;
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      // New public Google sign-ins default strictly to Driver role (never self-elevate)
      user = new User({
        name: googleData.name,
        email: googleData.email,
        googleId: googleData.googleId,
        avatarUrl: googleData.avatarUrl,
        emailVerified: true,
        role: ROLES.DRIVER,
        active: true,
        accountStatus: 'ACTIVE',
        department: 'Fleet Operations (Mobile)',
        lastLogin: new Date(),
      });
      await user.save();
    }

    // Ensure linked Driver profile exists when role is DRIVER
    let driverProfile = null;
    if (user.role === ROLES.DRIVER) {
      driverProfile = await Driver.findOne({ userId: user._id }).populate('assignedVehicleId');
      if (!driverProfile) {
        try {
          const autoLicense = `GGL-${user._id.toString().slice(-8).toUpperCase()}`;
          driverProfile = await Driver.create({
            userId: user._id,
            licenseNumber: autoLicense,
            phone: user.phone || 'PENDING',
            availability: 'AVAILABLE',
          });
        } catch (driverErr) {
          if (isNewUser) {
            await User.deleteOne({ _id: user._id });
          }
          throw driverErr;
        }
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
        user: buildAuthUserPayload(user, driverProfile),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/otp/providers
 * Returns non-sensitive boolean flags indicating which OTP delivery channels are configured.
 */
const getOtpProviders = (req, res) => {
  res.status(200).json({
    success: true,
    data: otpDeliveryService.getOtpProviderStatus(),
  });
};

/**
 * POST /api/v1/auth/demo-login
 * Isolated one-click Demo Showcase authentication strictly for isDemoData=true accounts.
 */
const demoLogin = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    const { user, driverProfile } = await demoDataService.ensureDemoShowcaseUser(role);

    if (!user || user.isDemoData !== true) {
      throw new AppError(
        'Cannot sign in to a non-demo account via demo showcase',
        403,
        'DEMO_USER_ISOLATION_VIOLATION'
      );
    }

    if (!user.active || (user.accountStatus && user.accountStatus !== 'ACTIVE')) {
      throw new AppError('Demo showcase account is deactivated', 401, 'USER_INACTIVE');
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Demo showcase authentication successful',
      data: {
        token,
        refreshToken,
        user: buildAuthUserPayload(user, driverProfile),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  demoLogin,
  getOtpProviders,
  sendOtp,
  verifyOtp,
  otpLogin,
  register,
  googleAuth,
  refresh,
  logout,
  provisionUser,
  getMe,
};
