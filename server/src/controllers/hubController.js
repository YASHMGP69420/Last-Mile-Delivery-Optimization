const mongoose = require('mongoose');
const Hub = require('../models/Hub');
const Vehicle = require('../models/Vehicle');
const DeliveryBatch = require('../models/DeliveryBatch');
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
 * GET /api/v1/hubs/:id
 * Retrieve single hub by ID
 */
const getHubById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }
    const hub = await Hub.findById(id);
    if (!hub) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }
    res.status(200).json({
      success: true,
      data: {
        hub,
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

/**
 * PUT /api/v1/hubs/:id
 * Update an existing logistics hub
 */
const updateHub = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }
    const hub = await Hub.findById(id);
    if (!hub) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }

    const {
      name,
      code,
      address,
      location,
      contactPhone,
      operatingHours,
      isActive,
    } = req.body;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        throw new AppError('Hub name cannot be empty', 400, 'INVALID_HUB_SPEC');
      }
      hub.name = trimmedName;
    }

    if (code !== undefined) {
      const trimmedCode = String(code).trim().toUpperCase();
      if (!trimmedCode) {
        throw new AppError('Hub code cannot be empty', 400, 'INVALID_HUB_SPEC');
      }
      // Ensure code uniqueness excluding self
      const existing = await Hub.findOne({ code: trimmedCode, _id: { $ne: hub._id } });
      if (existing) {
        throw new AppError(`A hub with code '${trimmedCode}' already exists`, 409, 'DUPLICATE_HUB_CODE');
      }
      hub.code = trimmedCode;
    }

    if (address !== undefined) {
      const trimmedAddress = String(address).trim();
      if (!trimmedAddress) {
        throw new AppError('Hub address cannot be empty', 400, 'INVALID_HUB_SPEC');
      }
      hub.address = trimmedAddress;
    }

    if (location !== undefined) {
      if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        throw new AppError('Valid location coordinates (lat, lng) are required', 400, 'INVALID_HUB_SPEC');
      }
      if (location.lat < -90 || location.lat > 90) {
        throw new AppError('Latitude must be between -90 and 90', 400, 'INVALID_HUB_SPEC');
      }
      if (location.lng < -180 || location.lng > 180) {
        throw new AppError('Longitude must be between -180 and 180', 400, 'INVALID_HUB_SPEC');
      }
      hub.location = {
        lat: location.lat,
        lng: location.lng,
      };
    }

    if (contactPhone !== undefined) {
      hub.contactPhone = contactPhone ? String(contactPhone).trim() : null;
    }

    if (operatingHours !== undefined) {
      hub.operatingHours = {
        open: operatingHours.open || hub.operatingHours?.open || '08:00',
        close: operatingHours.close || hub.operatingHours?.close || '20:00',
      };
    }

    if (isActive !== undefined) {
      if (hub.isCanonical && !isActive) {
        throw new AppError('Cannot deactivate canonical primary hub', 400, 'CANNOT_DEACTIVATE_CANONICAL_HUB');
      }
      hub.isActive = Boolean(isActive);
    }

    await hub.save();

    if (req.user) {
      try {
        await recordAuditEvent({
          type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
          actorId: req.user.id,
          actorRole: req.user.role,
          action: `Updated logistics hub ${hub.code}`,
          metadata: { hubId: hub._id, code: hub.code, name: hub.name },
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      message: 'Hub updated successfully',
      data: {
        hub,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/hubs/:id
 * Delete a logistics hub with cascade guards
 */
const deleteHub = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }
    const hub = await Hub.findById(id);
    if (!hub) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }

    if (hub.isCanonical) {
      throw new AppError('Cannot delete canonical primary hub', 400, 'CANNOT_DELETE_CANONICAL_HUB');
    }

    // Cascade guard: active vehicles
    const activeVehicles = await Vehicle.countDocuments({
      homeHubId: hub._id,
      availability: { $ne: 'RETIRED' },
    });
    if (activeVehicles > 0) {
      throw new AppError(
        `Cannot delete hub in active use by ${activeVehicles} vehicle(s)`,
        409,
        'HUB_IN_ACTIVE_USE'
      );
    }

    // Cascade guard: active batches
    const activeBatches = await DeliveryBatch.countDocuments({
      hubId: hub._id,
      status: { $ne: 'CLOSED' },
    });
    if (activeBatches > 0) {
      throw new AppError(
        `Cannot delete hub with ${activeBatches} active batch(es)`,
        409,
        'HUB_IN_ACTIVE_USE'
      );
    }

    await Hub.deleteOne({ _id: hub._id });

    if (req.user) {
      try {
        await recordAuditEvent({
          type: AUDIT_EVENT_TYPES.ADMIN_USER_ACTION,
          actorId: req.user.id,
          actorRole: req.user.role,
          action: `Deleted logistics hub ${hub.code}`,
          metadata: { hubId: hub._id, code: hub.code, name: hub.name },
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      message: 'Hub deleted successfully',
      data: {
        hubId: id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/hubs/:id/toggle-active
 * Toggle active status of a hub
 */
const toggleHubActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }
    const hub = await Hub.findById(id);
    if (!hub) {
      throw new AppError('Hub not found', 404, 'HUB_NOT_FOUND');
    }

    if (hub.isCanonical && hub.isActive) {
      throw new AppError('Cannot deactivate canonical primary hub', 400, 'CANNOT_DEACTIVATE_CANONICAL_HUB');
    }

    hub.isActive = !hub.isActive;
    await hub.save();

    res.status(200).json({
      success: true,
      message: `Hub ${hub.isActive ? 'activated' : 'deactivated'} successfully`,
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
  getHubById,
  createHub,
  updateHub,
  deleteHub,
  toggleHubActive,
};
