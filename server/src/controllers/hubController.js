const Hub = require('../models/Hub');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES } = require('../config/constants');

/**
 * GET /api/v1/hubs
 * List all logistics hubs with optional isActive filter
 */
const getHubs = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};

    if (isActive !== undefined && isActive !== null && isActive !== '') {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }

    const hubs = await Hub.find(filter).sort({ isCanonical: -1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        hubs,
        total: hubs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/hubs
 * Register a new logistics hub
 */
const createHub = async (req, res, next) => {
  try {
    const {
      name,
      code,
      address,
      location,
      contactPhone,
      operatingHours,
      isActive = true,
      isCanonical = false,
    } = req.body;

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const normalizedAddress = typeof address === 'string' ? address.trim() : '';

    if (!normalizedName) {
      throw new AppError('Hub name is required', 400, 'INVALID_HUB_SPEC');
    }
    if (!normalizedCode) {
      throw new AppError('Hub code is required', 400, 'INVALID_HUB_SPEC');
    }
    if (!normalizedAddress) {
      throw new AppError('Hub address is required', 400, 'INVALID_HUB_SPEC');
    }
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      throw new AppError('Valid location coordinates (lat, lng) are required', 400, 'INVALID_HUB_SPEC');
    }
    if (location.lat < -90 || location.lat > 90) {
      throw new AppError('Latitude must be between -90 and 90', 400, 'INVALID_HUB_SPEC');
    }
    if (location.lng < -180 || location.lng > 180) {
      throw new AppError('Longitude must be between -180 and 180', 400, 'INVALID_HUB_SPEC');
    }

    // Check code uniqueness
    const existing = await Hub.findOne({ code: normalizedCode });
    if (existing) {
      throw new AppError(`A hub with code '${normalizedCode}' already exists`, 409, 'DUPLICATE_HUB_CODE');
    }

    const hub = new Hub({
      name: normalizedName,
      code: normalizedCode,
      address: normalizedAddress,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
      contactPhone: contactPhone ? String(contactPhone).trim() : null,
      operatingHours: operatingHours || { open: '08:00', close: '20:00' },
      isActive: Boolean(isActive),
      isCanonical: Boolean(isCanonical),
    });

    await hub.save();

    if (req.user) {
      try {
        await recordAuditEvent({
          type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
          actorId: req.user.id,
          actorRole: req.user.role,
          action: `Created new logistics hub ${hub.code}`,
          metadata: { hubId: hub._id, code: hub.code, name: hub.name },
        });
      } catch (_) {
        // Non-blocking audit recording
      }
    }

    res.status(201).json({
      success: true,
      message: 'Hub created successfully',
      data: {
        hub,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHubs,
  createHub,
};
