// server/src/services/csvVehicleImportService.js
const Papa = require('papaparse');
const Vehicle = require('../models/Vehicle');
const { AppError } = require('../middleware/errorHandler');
const { VEHICLE_TYPES, VEHICLE_STATUS, FUEL_TYPES } = require('../config/constants');

/** Helper to safely trim values */
const safeTrim = (val, def = '') => (val === undefined || val === null ? def : String(val).trim());

/** Parse CSV text into rows */
const parseCsv = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return { data: [], errors: [] };
  return Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (typeof h === 'string' ? h.trim() : h),
  });
};

/** Validate a single vehicle row */
const validateRow = (row, rowIndex, existingIds) => {
  const errors = [];
  const vehicleId = safeTrim(row.vehicleId || row.VehicleID || row.vehicle_id);
  if (!vehicleId) {
    errors.push({ row: rowIndex, field: 'vehicleId', message: 'Vehicle ID is required' });
  } else if (existingIds.has(vehicleId)) {
    errors.push({ row: rowIndex, field: 'vehicleId', message: `Duplicate vehicleId '${vehicleId}' in file` });
  } else {
    existingIds.add(vehicleId);
  }

  const makeModel = safeTrim(row.makeModel || row.make_model);
  if (!makeModel) errors.push({ row: rowIndex, field: 'makeModel', message: 'Make/Model required' });

  const type = safeTrim(row.type);
  if (!type) errors.push({ row: rowIndex, field: 'type', message: 'Vehicle type required' });
  else if (!Object.values(VEHICLE_TYPES).includes(type)) {
    errors.push({ row: rowIndex, field: 'type', message: `Invalid type '${type}'` });
  }

  const capacityKg = Number(row.capacityKg || row.capacity_kg);
  if (isNaN(capacityKg) || capacityKg <= 0) {
    errors.push({ row: rowIndex, field: 'capacityKg', message: 'capacityKg must be > 0' });
  }

  const fuelType = safeTrim(row.fuelType);
  if (!fuelType) errors.push({ row: rowIndex, field: 'fuelType', message: 'fuelType required' });
  else if (!Object.values(FUEL_TYPES).includes(fuelType)) {
    errors.push({ row: rowIndex, field: 'fuelType', message: `Invalid fuelType '${fuelType}'` });
  }

  const kmPerLitre = row.kmPerLitre !== undefined ? Number(row.kmPerLitre) : null;
  const energyKWhPerKm = row.energyKWhPerKm !== undefined ? Number(row.energyKWhPerKm) : null;
  if (fuelType === FUEL_TYPES.ELECTRIC) {
    if (energyKWhPerKm === null || energyKWhPerKm <= 0) {
      errors.push({ row: rowIndex, field: 'energyKWhPerKm', message: 'Electric vehicles need energyKWhPerKm > 0' });
    }
  } else {
    if (kmPerLitre === null || kmPerLitre <= 0) {
      errors.push({ row: rowIndex, field: 'kmPerLitre', message: 'Combustion vehicles need kmPerLitre > 0' });
    }
  }

  const availability = safeTrim(row.availability) || VEHICLE_STATUS.AVAILABLE;
  if (!Object.values(VEHICLE_STATUS).includes(availability)) {
    errors.push({ row: rowIndex, field: 'availability', message: `Invalid availability '${availability}'` });
  }

  const fleetId = row.fleetId || row.fleet_id || null; // optional

  const vehicleData = {
    vehicleId,
    makeModel,
    type,
    capacityKg,
    fuelType,
    kmPerLitre: kmPerLitre ?? undefined,
    energyKWhPerKm: energyKWhPerKm ?? undefined,
    availability,
    fleetId: fleetId ? fleetId.trim() : undefined,
  };

  return { errors, vehicleData };
};

/** Process CSV – create vehicles (dryRun optional) */
const processVehicleCsv = async (csvText, options = {}) => {
  const { dryRun = true } = options;
  const { data: rows, errors: parseErrors } = parseCsv(csvText);
  const existingIds = new Set();
  const summary = {
    dryRun,
    totalRows: rows.length,
    created: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const { errors, vehicleData } = validateRow(rows[i], i + 1, existingIds);
    if (errors.length) {
      summary.errors.push(...errors);
      continue;
    }
    if (!dryRun) {
      // Actual DB write – let Mongoose handle uniqueness constraints
      const vehicle = new Vehicle(vehicleData);
      await vehicle.save();
    }
    summary.created += 1;
  }
  // Merge any Papa parse errors
  if (parseErrors.length) summary.errors.push(...parseErrors.map(e => ({ row: e.row, field: 'parse', message: e.message })));
  return summary;
};

module.exports = { processVehicleCsv };
