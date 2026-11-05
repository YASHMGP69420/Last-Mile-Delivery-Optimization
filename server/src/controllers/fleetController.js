// server/src/controllers/fleetController.js
const Fleet = require('../models/Fleet');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { recordAuditEvent } = require('../services/auditService');
const { AUDIT_EVENT_TYPES } = require('../config/constants');

/** GET /api/v1/fleets - list all fleets (admin only) */
const getFleets = async (req, res, next) => {
  try {
    const fleets = await Fleet.find().populate({ path: 'ownerId', select: 'name email' }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { fleets } });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/fleets - create a single fleet */
const createFleet = async (req, res, next) => {
  try {
    const { name, description, ownerEmail } = req.body;
    if (!name) throw new AppError('Fleet name is required', 400, 'MISSING_NAME');
    const existing = await Fleet.findOne({ name: name.trim() });
    if (existing) throw new AppError(`Fleet with name '${name}' already exists`, 409, 'DUPLICATE_KEY_CONFLICT');
    let ownerId = null;
    if (ownerEmail) {
      const user = await User.findOne({ email: ownerEmail.toLowerCase().trim() });
      if (!user) throw new AppError(`Owner email '${ownerEmail}' not found`, 404, 'OWNER_NOT_FOUND');
      ownerId = user._id;
    }
    const fleet = new Fleet({ name: name.trim(), description: description || '', ownerId });
    await fleet.save();
    await recordAuditEvent({
      type: AUDIT_EVENT_TYPES.CSV_IMPORTED, // reuse generic audit type
      actorId: req.user.id,
      actorRole: req.user.role,
      action: `Created fleet ${fleet.name}`,
      metadata: { fleetId: fleet._id },
    });
    res.status(201).json({ success: true, message: 'Fleet created', data: { fleet } });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/fleets/import-csv - bulk import fleets */
const importCsv = async (req, res, next) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : req.body.csvContent;
    const { dryRun = true } = req.body || {};
    const { processFleetCsv } = require('../services/csvFleetImportService');
    const result = await processFleetCsv(csvContent, { dryRun });
    res.status(200).json({ success: true, message: dryRun ? 'Dry‑run fleet CSV completed' : 'Fleets imported', data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFleets, createFleet, importCsv };
