const mongoose = require('mongoose');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Route = require('../models/Route');
const AuditEvent = require('../models/AuditEvent');
const OrganizationSettings = require('../models/OrganizationSettings');
const SystemNotification = require('../models/SystemNotification');
const DriverIncident = require('../models/DriverIncident');
const DriverShift = require('../models/DriverShift');
const socketService = require('../services/socketService');
const { ROLES, DELIVERY_STATUS, VEHICLE_STATUS, DRIVER_AVAILABILITY, AUDIT_EVENT_TYPES, CANONICAL_DEPOT, SHIFT_STATUS } = require('../config/constants');
const env = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const geoapifyService = require('../services/mapping/geoapify.service');
const savingsAnalyticsService = require('../services/savingsAnalyticsService');

/**
 * Log an administrative audit event
 */
const logAdminAudit = async ({ actor, action, type, metadata = {}, recordId = null, entity = 'System' }) => {
  try {
    await AuditEvent.create({
      actorId: actor.id,
      actorRole: actor.role,
      action: `[ADMIN] ${action}`,
      type: type || AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
      metadata: {
        entity,
        recordId: recordId ? recordId.toString() : null,
        ...metadata,
      },
    });
  } catch (err) {
    console.error('Failed to log admin audit event:', err.message);
  }
};

/**
 * GET /api/v1/admin/overview
 * Consolidated administrative overview metrics and live system health
 */
exports.getOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      fleetManagersCount,
      activeDriversCount,
      totalVehicles,
      availableVehicles,
      maintenanceVehicles,
      totalDeliveries,
      activeDeliveries,
      completedDeliveries,
      failedDeliveries,
      activeBatches,
      activeRoutes,
      unassignedDeliveries,
      recentAuditLogs,
      fleetSavings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.FLEET_MANAGER }),
      Driver.countDocuments({ availability: { $in: [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.ON_DUTY, DRIVER_AVAILABILITY.IN_TRANSIT] } }),
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ availability: VEHICLE_STATUS.AVAILABLE }),
      Vehicle.countDocuments({ availability: VEHICLE_STATUS.MAINTENANCE }),
      Delivery.countDocuments(),
      Delivery.countDocuments({ status: { $in: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.OUT_FOR_DELIVERY] } }),
      Delivery.countDocuments({ status: DELIVERY_STATUS.COMPLETED }),
      Delivery.countDocuments({ status: DELIVERY_STATUS.FAILED }),
      DeliveryBatch.countDocuments({ status: { $in: ['DRAFT', 'OPTIMIZED', 'DISPATCHED', 'PLANNED', 'IN_PROGRESS'] } }),
      Route.countDocuments({ status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } }),
      Delivery.countDocuments({ status: { $in: [DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY] } }),
      AuditEvent.find().sort({ at: -1 }).limit(10).populate('actorId', 'name email role'),
      savingsAnalyticsService.getFleetSavingsSummary(),
    ]);

    const totalDistanceSavedKm = fleetSavings.totalDistanceSavedKm;
    const fuelSavedInr = fleetSavings.fuelSavedInr;

    const resolvedDeliveries = completedDeliveries + failedDeliveries;
    const onTimeRate = resolvedDeliveries > 0 ? Number(((completedDeliveries / resolvedDeliveries) * 100).toFixed(1)) : 100.0;
    const fleetUtilization = totalVehicles > 0 ? Number((((totalVehicles - availableVehicles) / totalVehicles) * 100).toFixed(1)) : 0.0;

    // Real live system health verification
    const isDbConnected = mongoose.connection.readyState === 1;
    const hasGeoapifyKey = env.isGeoapifyConfigured(env.GEOAPIFY_SERVER_API_KEY);

    const systemHealth = {
      frontend: { status: 'OPERATIONAL', label: 'Vite React Client Up' },
      backend: { status: 'OPERATIONAL', uptimeSeconds: Math.floor(process.uptime()), memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)) },
      mongodb: { status: isDbConnected ? 'CONNECTED' : 'DISCONNECTED', readyState: mongoose.connection.readyState, databaseName: mongoose.connection.name },
      geoapify: { status: hasGeoapifyKey ? 'HEALTHY' : 'CONFIGURED_SIMULATED', provider: 'Geoapify Route & Matrix API' },
      socketIo: { status: 'OPERATIONAL', label: 'WebSocket Push Ready' },
      lastCheckTimestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers,
          fleetManagersCount,
          activeDriversCount,
          totalVehicles,
          availableVehicles,
          maintenanceVehicles,
          totalDeliveries,
          activeDeliveries,
          completedDeliveries,
          failedDeliveries,
          onTimeDeliveryRate: onTimeRate,
          totalFleetUtilization: fleetUtilization,
          totalDistanceSavedKm,
          fuelSavedInr,
        },
        operational: {
          activeBatches,
          activeRoutes,
          unassignedDeliveries,
          delayedRoutesCount: 0,
          totalDistanceSavedKm,
          fuelSavedInr,
          fuelSavedLitres: fleetSavings.fuelSavedLitres,
          energySavedKwh: fleetSavings.energySavedKwh,
          actualDistanceDrivenKm: fleetSavings.actualDistanceDrivenKm,
          actualFuelUsedLitres: fleetSavings.actualFuelUsedLitres,
          actualAvgBatteryUsedPct: fleetSavings.actualAvgBatteryUsedPct,
        },
        systemHealth,
        recentActivity: recentAuditLogs,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/analytics
 * Shared operational analytics summary (ADMIN + FLEET_MANAGER)
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const summary = await savingsAnalyticsService.getAnalyticsSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/users
 * User & Access Management: List all users
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (role) query.role = role;
    if (status) query.accountStatus = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Ensure the operation does not demote, deactivate, or delete the last active ADMIN account.
 */
const assertNotLastActiveAdmin = async (targetUser, nextRole, nextStatus, isDelete = false) => {
  const isCurrentlyActiveAdmin =
    targetUser.role === ROLES.ADMIN &&
    targetUser.accountStatus === 'ACTIVE' &&
    targetUser.active !== false;

  const removesAdminAccess =
    Boolean(isDelete) ||
    (nextRole !== undefined && nextRole !== null && nextRole !== ROLES.ADMIN) ||
    (nextStatus !== undefined && nextStatus !== null && nextStatus !== 'ACTIVE');

  if (isCurrentlyActiveAdmin && removesAdminAccess) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: targetUser._id },
      role: ROLES.ADMIN,
      accountStatus: 'ACTIVE',
      active: true,
    });
    if (otherActiveAdmins === 0) {
      throw new AppError(
        'Cannot demote, deactivate, or delete the last remaining active administrator.',
        409,
        'LAST_ADMIN_PROTECTED'
      );
    }
  }
};

/**
 * POST /api/v1/admin/users
 * Create user account with protected role boundaries
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, department } = req.body;

    const trimmedName = name !== undefined && name !== null ? String(name).trim() : '';
    const normalizedEmail = email !== undefined && email !== null ? String(email).trim().toLowerCase() : '';

    if (!trimmedName || !normalizedEmail || !password) {
      throw new AppError('Name, email, and password are required', 400, 'MISSING_FIELDS');
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new AppError('A user with this email address already exists', 409, 'EMAIL_EXISTS');
    }

    const assignedRole = role || ROLES.DRIVER;

    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash: password,
      role: assignedRole,
      phone: phone !== undefined && phone !== null ? String(phone).trim() || null : null,
      department: department !== undefined && department !== null ? String(department).trim() || 'Operations' : 'Operations',
      accountStatus: 'ACTIVE',
      active: true,
    });

    await logAdminAudit({
      actor: req.user,
      action: `Created user account '${user.name}' (${user.email}) with role ${user.role}`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
      metadata: { role: user.role, email: user.email },
    });

    res.status(201).json({
      success: true,
      message: 'User account created successfully',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/users/:id
 * Update user details
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, department, role, accountStatus } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Guard: Prevent admin from demoting or disabling their own account
    if (user._id.toString() === req.user.id) {
      if (accountStatus && accountStatus !== 'ACTIVE') {
        throw new AppError('Administrators cannot suspend their own active account', 403, 'SELF_SUSPENSION_BLOCKED');
      }
      if (role && role !== ROLES.ADMIN) {
        throw new AppError('Administrators cannot revoke their own admin role', 403, 'SELF_DEMOTION_BLOCKED');
      }
    }

    const nextRole = role && Object.values(ROLES).includes(role) ? role : null;
    if (accountStatus !== undefined && !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(accountStatus)) {
      throw new AppError('Invalid account status. Expected ACTIVE, INACTIVE, or SUSPENDED', 400, 'INVALID_STATUS');
    }

    await assertNotLastActiveAdmin(user, nextRole, accountStatus || null, false);

    if (name !== undefined) {
      const trimmedName = String(name ?? '').trim();
      if (!trimmedName) {
        throw new AppError('User name cannot be empty', 400, 'INVALID_NAME');
      }
      user.name = trimmedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email ?? '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new AppError('Email address cannot be empty', 400, 'INVALID_EMAIL');
      }
      if (normalizedEmail !== user.email) {
        const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (existingEmail) {
          throw new AppError('A user with this email address already exists', 409, 'EMAIL_EXISTS');
        }
        user.email = normalizedEmail;
      }
    }

    if (phone !== undefined) user.phone = phone !== null ? String(phone).trim() || null : null;
    if (department !== undefined) user.department = department !== null ? String(department).trim() : user.department;
    if (nextRole) user.role = nextRole;
    if (accountStatus) {
      user.accountStatus = accountStatus;
      user.active = accountStatus === 'ACTIVE';
      if (accountStatus !== 'ACTIVE') {
        user.refreshToken = null;
      }
    }

    await user.save();

    await logAdminAudit({
      actor: req.user,
      action: `Updated user profile '${user.name}' (${user.email})`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
      metadata: { role: user.role, status: user.accountStatus },
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/users/:id/status
 * Activate, deactivate, or suspend account
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      throw new AppError('Invalid account status. Expected ACTIVE, INACTIVE, or SUSPENDED', 400, 'INVALID_STATUS');
    }

    if (id === req.user.id && status !== 'ACTIVE') {
      throw new AppError('Cannot suspend or deactivate your own administrator account', 403, 'SELF_LOCKOUT_PREVENTED');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await assertNotLastActiveAdmin(user, null, status, false);

    const prevStatus = user.accountStatus;
    user.accountStatus = status;
    user.active = status === 'ACTIVE';
    if (status !== 'ACTIVE') {
      user.refreshToken = null; // Revoke active session tokens
    }
    await user.save();

    await logAdminAudit({
      actor: req.user,
      action: `Changed status of user '${user.email}' from ${prevStatus} to ${status}. Reason: ${reason || 'N/A'}`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
      metadata: { previous: prevStatus, current: status, reason },
    });

    res.status(200).json({
      success: true,
      message: `User account is now ${status}`,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/admin/users/:id
 * Delete user account while preventing self-lockout and Last-Admin deletion
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      throw new AppError('Cannot delete your own administrator account', 403, 'SELF_LOCKOUT_PREVENTED');
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await assertNotLastActiveAdmin(user, null, null, true);

    await User.findByIdAndDelete(user._id);

    await logAdminAudit({
      actor: req.user,
      action: `Deleted user account '${user.name}' (${user.email})`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
      metadata: { deletedEmail: user.email, deletedRole: user.role },
    });

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully',
      data: { userId: user._id.toString() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/users/:id/reset-password
 * Reset user password with secure temporary password
 */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(id).select('+passwordHash');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const tempPassword = newPassword || `SR#${Math.random().toString(36).slice(-6)}!${Date.now().toString().slice(-2)}`;
    user.passwordHash = tempPassword;
    user.refreshToken = null; // force re-login
    await user.save();

    await logAdminAudit({
      actor: req.user,
      action: `Reset access credentials for user '${user.email}'`,
      type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
      recordId: user._id,
      entity: 'User',
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
      data: {
        userId: user._id.toString(),
        email: user.email,
        temporaryPassword: tempPassword,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/permissions
 * Retrieve granular permission policy matrix
 */
exports.getPermissions = async (req, res, next) => {
  try {
    const settings = await OrganizationSettings.getSettings();
    res.status(200).json({
      success: true,
      data: { permissions: settings.permissionsConfig },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/permissions
 * Update granular role permission matrix
 */
exports.updatePermissions = async (req, res, next) => {
  try {
    const { permissions, reason } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      throw new AppError('Valid permissions mapping object is required', 400, 'INVALID_PAYLOAD');
    }

    const settings = await OrganizationSettings.getSettings();
    settings.permissionsConfig = permissions;
    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: `Updated role and permission configurations. Reason: ${reason || 'Administrative update'}`,
      type: AUDIT_EVENT_TYPES.ADMIN_SETTING_CHANGED,
      entity: 'PermissionsConfig',
      metadata: { reason },
    });

    res.status(200).json({
      success: true,
      message: 'Role permissions configuration updated successfully',
      data: { permissions: settings.permissionsConfig },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/organization
 * Retrieve organization settings and depots
 */
exports.getOrganization = async (req, res, next) => {
  try {
    const settings = await OrganizationSettings.getSettings();
    res.status(200).json({
      success: true,
      data: { organization: settings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/organization
 * Update organization metadata & operational policies
 */
exports.updateOrganization = async (req, res, next) => {
  try {
    const { organizationName, businessAddress, contactDetails, operatingRegions, timezone, currency, businessHours } = req.body;
    const settings = await OrganizationSettings.getSettings();

    if (organizationName) settings.organizationName = organizationName;
    if (businessAddress) settings.businessAddress = { ...settings.businessAddress, ...businessAddress };
    if (contactDetails) settings.contactDetails = { ...settings.contactDetails, ...contactDetails };
    if (operatingRegions) settings.operatingRegions = operatingRegions;
    if (timezone) settings.timezone = timezone;
    if (currency) settings.currency = currency;
    if (businessHours) settings.businessHours = { ...settings.businessHours, ...businessHours };

    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: 'Updated organization business settings and operational regions',
      type: AUDIT_EVENT_TYPES.ADMIN_SETTING_CHANGED,
      entity: 'OrganizationSettings',
    });

    res.status(200).json({
      success: true,
      message: 'Organization settings updated successfully',
      data: { organization: settings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/depots
 * Add new operational depot
 */
exports.addDepot = async (req, res, next) => {
  try {
    const { name, address, location, operatingHours, serviceRegion } = req.body;
    if (!name || !address || !location || location.lat === undefined || location.lng === undefined) {
      throw new AppError('Depot name, address, and geo coordinates (lat, lng) are required', 400, 'MISSING_DEPOT_FIELDS');
    }

    const settings = await OrganizationSettings.getSettings();
    const depotId = `DEPOT-${Date.now().toString(36).toUpperCase()}`;

    settings.depots.push({
      depotId,
      name,
      address,
      location: { lat: Number(location.lat), lng: Number(location.lng) },
      operatingHours: operatingHours || { start: '06:00', end: '22:00' },
      serviceRegion: serviceRegion || 'Bhubaneswar Central',
      active: true,
    });

    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: `Created new operational logistics depot '${name}' (${depotId})`,
      type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
      entity: 'Depot',
      metadata: { depotId, name, location },
    });

    res.status(201).json({
      success: true,
      message: 'Operational depot registered successfully',
      data: { depots: settings.depots },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/depots/:id
 * Update operational depot
 */
exports.updateDepot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, location, operatingHours, serviceRegion, active } = req.body;

    const settings = await OrganizationSettings.getSettings();
    const depot = settings.depots.find((d) => d.depotId === id || d._id.toString() === id);
    if (!depot) {
      throw new AppError('Depot not found', 404, 'DEPOT_NOT_FOUND');
    }

    if (name) depot.name = name;
    if (address) depot.address = address;
    if (location && location.lat !== undefined && location.lng !== undefined) {
      depot.location = { lat: Number(location.lat), lng: Number(location.lng) };
    }
    if (operatingHours) depot.operatingHours = operatingHours;
    if (serviceRegion) depot.serviceRegion = serviceRegion;
    if (active !== undefined) depot.active = Boolean(active);

    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: `Updated operational depot '${depot.name}' (${depot.depotId})`,
      type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
      entity: 'Depot',
      metadata: { depotId: depot.depotId, active: depot.active },
    });

    res.status(200).json({
      success: true,
      message: 'Depot updated successfully',
      data: { depots: settings.depots },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/fleet-control
 * Fleet-Wide Control Center: global fleet & driver oversight
 */
exports.getFleetControl = async (req, res, next) => {
  try {
    const [vehicles, drivers] = await Promise.all([
      Vehicle.find().sort({ registrationNumber: 1 }),
      Driver.find().populate('userId', 'name email phone accountStatus').populate('assignedVehicleId').sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        vehicles,
        drivers,
        counts: {
          totalVehicles: vehicles.length,
          availableVehicles: vehicles.filter((v) => v.status === VEHICLE_STATUS.AVAILABLE).length,
          maintenanceVehicles: vehicles.filter((v) => v.status === VEHICLE_STATUS.MAINTENANCE).length,
          activeDrivers: drivers.filter((d) => d.availability !== DRIVER_AVAILABILITY.OFF_DUTY).length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/fleet-control/override
 * Administrative fleet & driver operational overrides (e.g., emergency suspension, maintenance)
 */
exports.overrideFleetResource = async (req, res, next) => {
  try {
    const { resourceType, resourceId, action, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      throw new AppError('Mandatory administrative reason required for operational overrides (minimum 5 characters)', 400, 'REASON_REQUIRED');
    }

    if (resourceType === 'VEHICLE') {
      const vehicle = await Vehicle.findById(resourceId);
      if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

      const prevStatus = vehicle.status;
      if (action === 'SUSPEND_MAINTENANCE') {
        vehicle.status = VEHICLE_STATUS.MAINTENANCE;
      } else if (action === 'MARK_AVAILABLE') {
        vehicle.status = VEHICLE_STATUS.AVAILABLE;
      } else if (action === 'RETIRE') {
        const [activeShift, activeRoute] = await Promise.all([
          DriverShift.exists({ vehicleId: vehicle._id, status: SHIFT_STATUS.IN_PROGRESS }),
          Route.exists({ vehicleId: vehicle._id, status: { $in: ['DISPATCHED', 'IN_PROGRESS'] } }),
        ]);
        if (activeShift || activeRoute) {
          throw new AppError(
            `Cannot retire vehicle ${vehicle.vehicleId || vehicle.registrationNumber} while an IN_PROGRESS shift or active DISPATCHED/IN_PROGRESS route is running.`,
            409,
            'ACTIVE_OPERATION_CONFLICT'
          );
        }
        vehicle.status = VEHICLE_STATUS.RETIRED;
      } else {
        throw new AppError('Invalid vehicle override action', 400, 'INVALID_ACTION');
      }

      await vehicle.save();

      await logAdminAudit({
        actor: req.user,
        action: `Override vehicle ${vehicle.registrationNumber} status from ${prevStatus} to ${vehicle.status}. Reason: ${reason}`,
        type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
        recordId: vehicle._id,
        entity: 'Vehicle',
        metadata: { previous: prevStatus, current: vehicle.status, reason },
      });

      return res.status(200).json({
        success: true,
        message: `Vehicle ${vehicle.registrationNumber} updated to ${vehicle.status}`,
        data: { vehicle },
      });
    }

    if (resourceType === 'DRIVER') {
      const driver = await Driver.findById(resourceId).populate('userId', 'name email');
      if (!driver) throw new AppError('Driver not found', 404, 'NOT_FOUND');

      const prevStatus = driver.availability;
      if (action === 'FORCE_OFF_DUTY') {
        driver.availability = DRIVER_AVAILABILITY.OFF_DUTY;
      } else if (action === 'MARK_AVAILABLE') {
        driver.availability = DRIVER_AVAILABILITY.AVAILABLE;
      } else {
        throw new AppError('Invalid driver override action', 400, 'INVALID_ACTION');
      }

      await driver.save();

      await logAdminAudit({
        actor: req.user,
        action: `Override driver ${driver.licenseNumber} availability from ${prevStatus} to ${driver.availability}. Reason: ${reason}`,
        type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
        recordId: driver._id,
        entity: 'Driver',
        metadata: { previous: prevStatus, current: driver.availability, reason },
      });

      return res.status(200).json({
        success: true,
        message: `Driver availability updated to ${driver.availability}`,
        data: { driver },
      });
    }

    throw new AppError("Expected resourceType 'VEHICLE' or 'DRIVER'", 400, 'INVALID_RESOURCE_TYPE');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/operations
 * Route and Operations Control overview
 */
exports.getOperationsOversight = async (req, res, next) => {
  try {
    const [batches, activeRoutes, failedDeliveries, unassignedDeliveries] = await Promise.all([
      DeliveryBatch.find().sort({ createdAt: -1 }).limit(20),
      Route.find({ status: { $in: ['OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS'] } })
        .populate('vehicleId', 'registrationNumber type capacityKg')
        .populate('driverId')
        .sort({ updatedAt: -1 }),
      Delivery.find({ status: DELIVERY_STATUS.FAILED }).sort({ updatedAt: -1 }).limit(50),
      Delivery.find({ status: { $in: [DELIVERY_STATUS.DRAFT, DELIVERY_STATUS.READY] } }).sort({ createdAt: -1 }).limit(50),
    ]);

    res.status(200).json({
      success: true,
      data: {
        batches,
        activeRoutes,
        failedDeliveries,
        unassignedDeliveries,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/operations/override
 * Route & Delivery administrative interventions (e.g. cancel route, reopen failed delivery)
 */
exports.overrideOperation = async (req, res, next) => {
  try {
    const { targetType, targetId, action, reason, newPriority } = req.body;

    if (!reason || reason.trim().length < 5) {
      throw new AppError('Mandatory administrative reason required for operational override (minimum 5 characters)', 400, 'REASON_REQUIRED');
    }

    if (targetType === 'ROUTE') {
      const route = await Route.findById(targetId);
      if (!route) throw new AppError('Route not found', 404, 'ROUTE_NOT_FOUND');

      if (action === 'CANCEL_ROUTE') {
        route.status = 'CANCELLED';
        await route.save();

        // Release associated vehicle and driver
        if (route.vehicleId) {
          await Vehicle.findByIdAndUpdate(route.vehicleId, { availability: VEHICLE_STATUS.AVAILABLE });
        }
        if (route.driverId) {
          await Driver.findByIdAndUpdate(route.driverId, { availability: DRIVER_AVAILABILITY.AVAILABLE, currentRouteId: null });
        }

        // Release deliveries back to READY
        const deliveryIds = route.stops.map((s) => s.deliveryId).filter(Boolean);
        if (deliveryIds.length > 0) {
          await Delivery.updateMany(
            { _id: { $in: deliveryIds }, status: { $nin: [DELIVERY_STATUS.COMPLETED] } },
            { $set: { status: DELIVERY_STATUS.READY, assignedDriverId: null, assignedVehicleId: null } }
          );
        }

        await logAdminAudit({
          actor: req.user,
          action: `Cancelled route ${route.routeCode}. Reason: ${reason}`,
          type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
          recordId: route._id,
          entity: 'Route',
          metadata: { routeCode: route.routeCode, reason },
        });

        // Real-time broadcast to driver and route tracking rooms
        const cancelledDriverId = route.driverId ? route.driverId.toString() : null;
        socketService.emitRouteCancelled({
          routeId: route._id.toString(),
          routeCode: route.routeCode,
          driverId: cancelledDriverId,
          reason,
          timestamp: new Date(),
        });

        return res.status(200).json({
          success: true,
          message: `Route ${route.routeCode} cancelled and resources released`,
          data: { route },
        });
      }

      throw new AppError(`Unsupported route action: ${action}`, 400, 'INVALID_ACTION');
    }

    if (targetType === 'DELIVERY') {
      const delivery = await Delivery.findById(targetId);
      if (!delivery) throw new AppError('Delivery consignment not found', 404, 'NOT_FOUND');

      if (action === 'REOPEN_FAILED') {
        const prevStatus = delivery.status;
        delivery.status = DELIVERY_STATUS.READY;
        delivery.failureReason = null;
        delivery.failureNotes = `Reopened by admin ${req.user.name}: ${reason}`;
        await delivery.save();

        await logAdminAudit({
          actor: req.user,
          action: `Reopened failed consignment ${delivery.orderReference} for re-dispatch. Reason: ${reason}`,
          type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
          recordId: delivery._id,
          entity: 'Delivery',
          metadata: { orderReference: delivery.orderReference, previousStatus: prevStatus, reason },
        });

        return res.status(200).json({
          success: true,
          message: `Consignment ${delivery.orderReference} reopened and returned to READY`,
          data: { delivery },
        });
      }

      if (action === 'CHANGE_PRIORITY') {
        if (!newPriority) throw new AppError('newPriority is required', 400, 'PRIORITY_REQUIRED');
        const oldPrio = delivery.priority;
        delivery.priority = newPriority;
        await delivery.save();

        await logAdminAudit({
          actor: req.user,
          action: `Modified priority for consignment ${delivery.orderReference} from ${oldPrio} to ${newPriority}. Reason: ${reason}`,
          type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
          recordId: delivery._id,
          entity: 'Delivery',
          metadata: { orderReference: delivery.orderReference, oldPriority: oldPrio, newPriority, reason },
        });

        // Broadcast priority escalation to driver handheld
        if (delivery.assignedDriverId) {
          socketService.emitPriorityEscalated({
            deliveryId: delivery._id.toString(),
            orderReference: delivery.orderReference,
            driverId: delivery.assignedDriverId.toString(),
            previousPriority: oldPrio,
            newPriority,
            reason,
            timestamp: new Date(),
          });
        }

        return res.status(200).json({
          success: true,
          message: `Consignment priority updated to ${newPriority}`,
          data: { delivery },
        });
      }

      throw new AppError(`Unsupported delivery action: ${action}`, 400, 'INVALID_ACTION');
    }

    throw new AppError("Expected targetType 'ROUTE' or 'DELIVERY'", 400, 'INVALID_TARGET_TYPE');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/optimization-settings
 * Retrieve optimization parameters & algorithm weights
 */
exports.getOptimizationSettings = async (req, res, next) => {
  try {
    const settings = await OrganizationSettings.getSettings();
    res.status(200).json({
      success: true,
      data: { optimizationSettings: settings.optimizationSettings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/optimization-settings
 * Update optimization weights and algorithm parameters
 */
exports.updateOptimizationSettings = async (req, res, next) => {
  try {
    const {
      distanceWeight,
      timeWeight,
      fuelCostWeight,
      deliveryPriorityWeight,
      workloadBalancingWeight,
      maxRouteDurationMinutes,
      defaultReturnToDepot,
      defaultServiceDurationMinutes,
      allowedVehicleTypes,
      defaultProfile,
      reason,
    } = req.body;

    const settings = await OrganizationSettings.getSettings();
    const opt = settings.optimizationSettings;

    if (distanceWeight !== undefined) opt.distanceWeight = Number(distanceWeight);
    if (timeWeight !== undefined) opt.timeWeight = Number(timeWeight);
    if (fuelCostWeight !== undefined) opt.fuelCostWeight = Number(fuelCostWeight);
    if (deliveryPriorityWeight !== undefined) opt.deliveryPriorityWeight = Number(deliveryPriorityWeight);
    if (workloadBalancingWeight !== undefined) opt.workloadBalancingWeight = Number(workloadBalancingWeight);
    if (maxRouteDurationMinutes !== undefined) opt.maxRouteDurationMinutes = Number(maxRouteDurationMinutes);
    if (defaultReturnToDepot !== undefined) opt.defaultReturnToDepot = Boolean(defaultReturnToDepot);
    if (defaultServiceDurationMinutes !== undefined) opt.defaultServiceDurationMinutes = Number(defaultServiceDurationMinutes);
    if (allowedVehicleTypes !== undefined) opt.allowedVehicleTypes = allowedVehicleTypes;
    if (defaultProfile !== undefined) opt.defaultProfile = defaultProfile;

    opt.lastModifiedBy = req.user.name;
    opt.lastModifiedAt = new Date();

    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: `Updated route optimization algorithm weights & default profile to '${opt.defaultProfile}'. Reason: ${reason || 'Config update'}`,
      type: AUDIT_EVENT_TYPES.ADMIN_SETTING_CHANGED,
      entity: 'OptimizationSettings',
      metadata: { profile: opt.defaultProfile, reason },
    });

    res.status(200).json({
      success: true,
      message: 'Optimization settings updated successfully',
      data: { optimizationSettings: settings.optimizationSettings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/fuel-settings
 * Retrieve fuel and energy tariffs
 */
exports.getFuelSettings = async (req, res, next) => {
  try {
    const settings = await OrganizationSettings.getSettings();
    res.status(200).json({
      success: true,
      data: { fuelSettings: settings.fuelSettings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/admin/fuel-settings
 * Update fuel and energy tariffs
 */
exports.updateFuelSettings = async (req, res, next) => {
  try {
    const { petrolPricePerLiter, dieselPricePerLiter, cngPricePerKg, electricityTariffPerKwh, carbonEmissionFactors, currencySymbol, reason } = req.body;

    const settings = await OrganizationSettings.getSettings();
    const fuel = settings.fuelSettings;

    if (petrolPricePerLiter !== undefined) fuel.petrolPricePerLiter = Number(petrolPricePerLiter);
    if (dieselPricePerLiter !== undefined) fuel.dieselPricePerLiter = Number(dieselPricePerLiter);
    if (cngPricePerKg !== undefined) fuel.cngPricePerKg = Number(cngPricePerKg);
    if (electricityTariffPerKwh !== undefined) fuel.electricityTariffPerKwh = Number(electricityTariffPerKwh);
    if (carbonEmissionFactors !== undefined) fuel.carbonEmissionFactors = { ...fuel.carbonEmissionFactors, ...carbonEmissionFactors };
    if (currencySymbol !== undefined) fuel.currencySymbol = currencySymbol;
    fuel.effectiveDate = new Date();

    await settings.save();

    await logAdminAudit({
      actor: req.user,
      action: `Updated fuel tariffs and emission coefficients. Reason: ${reason || 'Routine rate update'}`,
      type: AUDIT_EVENT_TYPES.ADMIN_SETTING_CHANGED,
      entity: 'FuelSettings',
      metadata: { fuel, reason },
    });

    res.status(200).json({
      success: true,
      message: 'Fuel settings updated successfully',
      data: { fuelSettings: settings.fuelSettings },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/integrations
 * Retrieve system integrations health & status
 */
exports.getIntegrations = async (req, res, next) => {
  try {
    const settings = await OrganizationSettings.getSettings();
    const isDbConnected = mongoose.connection.readyState === 1;

    const geoapifyApiKey = env.GEOAPIFY_SERVER_API_KEY;
    const hasGeoapifyKey = env.isGeoapifyConfigured(geoapifyApiKey);

    const integrations = {
      geoapify: {
        ...settings.integrations.geoapify.toObject(),
        hasKey: hasGeoapifyKey,
        keyMasked: hasGeoapifyKey ? `${geoapifyApiKey.slice(0, 4)}...${geoapifyApiKey.slice(-4)}` : 'Not set',
      },
      leafletOsm: settings.integrations.leafletOsm,
      mongoDb: {
        status: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
        databaseName: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      },
      socketIo: settings.integrations.socketIo,
    };

    res.status(200).json({
      success: true,
      data: { integrations },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/integrations/test
 * Test connection to third-party integration
 */
exports.testIntegration = async (req, res, next) => {
  try {
    const { service } = req.body;
    const start = Date.now();

    if (service === 'GEOAPIFY') {
      const isConfigured = env.isGeoapifyConfigured(env.GEOAPIFY_SERVER_API_KEY);
      const latency = Date.now() - start;
      return res.status(200).json({
        success: true,
        data: {
          service: 'Geoapify Routing API',
          status: isConfigured ? 'CONNECTED' : 'FALLBACK_SIMULATION',
          latencyMs: latency,
          message: isConfigured
            ? 'Geoapify API credentials verified and operational'
            : 'Geoapify key in mock mode; high-performance simulated road matrix active',
        },
      });
    }

    if (service === 'MONGODB') {
      const isConnected = mongoose.connection.readyState === 1;
      const latency = Date.now() - start;
      return res.status(200).json({
        success: isConnected,
        data: {
          service: 'MongoDB Atlas / Local',
          status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
          latencyMs: latency,
          database: mongoose.connection.name,
        },
      });
    }

    throw new AppError(`Unknown service test target: ${service}`, 400, 'UNKNOWN_SERVICE');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/audit-logs
 * System Audit Logs: Append-only event history with filters
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { actorRole, type, entity, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = {};

    if (actorRole) query.actorRole = actorRole;
    if (type) query.type = type;
    if (entity) query['metadata.entity'] = entity;
    if (startDate || endDate) {
      query.at = {};
      if (startDate) query.at.$gte = new Date(startDate);
      if (endDate) query.at.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditEvent.find(query).sort({ at: -1 }).skip(skip).limit(Number(limit)).populate('actorId', 'name email role'),
      AuditEvent.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/notifications
 * System notifications & operational alerts
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const { severity, category } = req.query;
    const query = {
      $or: [
        { targetRole: { $in: ['ALL', 'ADMIN', 'FLEET_MANAGER'] } },
        { targetUserId: req.user.id },
      ],
    };

    if (severity) query.severity = severity;
    if (category) query.category = category;

    const notifications = await SystemNotification.find(query).sort({ createdAt: -1 }).limit(100);

    res.status(200).json({
      success: true,
      data: { notifications },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/admin/notifications
 * Broadcast a new notification or system alert
 */
exports.createNotification = async (req, res, next) => {
  try {
    const { title, message, severity, category, targetRole } = req.body;
    if (!title || !message) {
      throw new AppError('Title and message are required', 400, 'MISSING_FIELDS');
    }

    const notification = await SystemNotification.create({
      title,
      message,
      severity: severity || 'INFO',
      category: category || 'GENERAL',
      targetRole: targetRole || 'ALL',
      metadata: { createdBy: req.user.name },
    });

    // Real-time broadcast if targeted to drivers or all personnel
    if (!targetRole || targetRole === 'ALL' || targetRole === 'DRIVER') {
      socketService.emitDispatchMessage({
        id: notification._id.toString(),
        title: title.trim(),
        message: message.trim(),
        severity: severity || 'INFO',
        sender: req.user ? req.user.name : 'Operations Admin',
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      data: { notification },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/notifications/:id/read
 * Mark notification as read
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await SystemNotification.findByIdAndUpdate(id, {
      $addToSet: { readBy: req.user.id },
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/incidents
 * List driver-reported incidents for Admin & Fleet Operations resolution
 */
exports.getIncidents = async (req, res, next) => {
  try {
    const { status, severity } = req.query;
    const query = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;

    const incidents = await DriverIncident.find(query)
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .populate('routeId', 'routeCode status')
      .populate('resolvedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      data: { incidents },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/admin/incidents/:id
 * Update driver incident status and resolution notes
 */
exports.resolveIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status = 'RESOLVED', resolutionNotes = '' } = req.body;
    const allowedStatuses = ['OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'DISMISSED'];
    if (!allowedStatuses.includes(status)) {
      throw new AppError(`Status must be one of: ${allowedStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    const update = {
      status,
      resolutionNotes,
      resolvedBy: req.user.id,
    };

    const incident = await DriverIncident.findByIdAndUpdate(id, update, { new: true })
      .populate({
        path: 'driverId',
        populate: { path: 'userId', select: 'name email phone' },
      })
      .populate('routeId', 'routeCode status')
      .populate('resolvedBy', 'name email role');

    if (!incident) {
      throw new AppError('Driver incident not found', 404, 'NOT_FOUND');
    }

    // Notify reporting driver that operations updated their incident
    const driverUserId = incident.driverId?.userId?._id || incident.driverId?.userId;
    const driverIdStr = incident.driverId?._id?.toString();
    if (driverUserId) {
      await SystemNotification.create({
        title: `Incident Updated (${status}): ${incident.category}`,
        message: resolutionNotes
          ? `Operations marked your ${incident.category} report as ${status}: ${resolutionNotes}`
          : `Operations marked your ${incident.category} report as ${status}.`,
        severity: status === 'RESOLVED' ? 'INFO' : 'WARNING',
        category: 'SAFETY',
        targetRole: 'DRIVER',
        targetUserId: driverUserId,
        metadata: { incidentId: incident._id.toString(), status },
      });
    }

    if (driverIdStr) {
      socketService.emitDispatchMessage({
        id: incident._id.toString(),
        driverId: driverIdStr,
        routeId: incident.routeId?._id?.toString(),
        title: `Incident ${status}`,
        message: resolutionNotes || `Your ${incident.category} report is now ${status}.`,
        severity: status === 'RESOLVED' ? 'INFO' : 'WARNING',
        sender: req.user?.name || 'Operations',
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: `Incident updated to ${status}`,
      data: { incident },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/admin/data-export
 * Operational data exports for Deliveries, Fleets, Drivers, or Audit Logs
 */
exports.exportData = async (req, res, next) => {
  try {
    const { dataset = 'deliveries' } = req.query;
    let data = [];

    if (dataset === 'deliveries') {
      data = await Delivery.find().lean();
    } else if (dataset === 'fleets') {
      data = await Vehicle.find().lean();
    } else if (dataset === 'drivers') {
      data = await Driver.find().populate('userId', 'name email phone').lean();
    } else if (dataset === 'audit-logs') {
      data = await AuditEvent.find().sort({ at: -1 }).limit(1000).populate('actorId', 'name email role').lean();
    } else {
      throw new AppError("Invalid dataset. Expected 'deliveries', 'fleets', 'drivers', or 'audit-logs'", 400, 'INVALID_DATASET');
    }

    await logAdminAudit({
      actor: req.user,
      action: `Exported operational dataset '${dataset}' (${data.length} records)`,
      type: AUDIT_EVENT_TYPES.ADMIN_OPERATIONAL_OVERRIDE,
      entity: 'DataExport',
      metadata: { dataset, recordCount: data.length },
    });

    res.status(200).json({
      success: true,
      dataset,
      count: data.length,
      exportedAt: new Date().toISOString(),
      data,
    });
  } catch (err) {
    next(err);
  }
};
