// server/src/services/csvVehicleImportService.js
const Papa = require('papaparse');
const Vehicle = require('../models/Vehicle');
const { AppError } = require('../middleware/errorHandler');
const { VEHICLE_TYPES, VEHICLE_STATUS, FUEL_TYPES } = require('../config/constants');

/** Helper to safely trim values */
const safeTrim = (val, def = '') => (val === undefined || val === null ? def : String(val).trim());

const hasValue = (val) => val !== undefined && val !== null && String(val).trim() !== '';

const extractVehicleId = (row) =>
  safeTrim(row?.vehicleId ?? row?.VehicleID ?? row?.vehicle_id).toUpperCase();

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
const validateRow = (row, rowIndex, existingIds, dbCollisionSet = new Set()) => {
  const errors = [];
  const vehicleId = extractVehicleId(row);
  if (!vehicleId) {
    errors.push({ row: rowIndex, field: 'vehicleId', message: 'Vehicle ID is required' });
  } else if (existingIds.has(vehicleId)) {
    errors.push({ row: rowIndex, field: 'vehicleId', message: `Duplicate vehicleId '${vehicleId}' in file` });
  } else {
    existingIds.add(vehicleId);
    if (dbCollisionSet.has(vehicleId)) {
      errors.push({ row: rowIndex, field: 'vehicleId', message: `Vehicle ID '${vehicleId}' already exists in database` });
    }
  }

  const makeModel = safeTrim(row.makeModel ?? row.make_model);
  if (!makeModel) errors.push({ row: rowIndex, field: 'makeModel', message: 'Make/Model required' });

  const type = safeTrim(row.type);
  if (!type) errors.push({ row: rowIndex, field: 'type', message: 'Vehicle type required' });
  else if (!Object.values(VEHICLE_TYPES).includes(type)) {
    errors.push({ row: rowIndex, field: 'type', message: `Invalid type '${type}'` });
  }

  const rawCapacityKg = row.capacityKg ?? row.capacity_kg;
  const capacityKg = hasValue(rawCapacityKg) ? Number(rawCapacityKg) : NaN;
  if (!Number.isFinite(capacityKg) || capacityKg <= 0) {
    errors.push({ row: rowIndex, field: 'capacityKg', message: 'capacityKg must be > 0' });
  }

  const rawCapacityM3 = row.capacityM3 ?? row.capacity_m3;
  let capacityM3;
  if (hasValue(rawCapacityM3)) {
    capacityM3 = Number(rawCapacityM3);
    if (!Number.isFinite(capacityM3) || capacityM3 <= 0) {
      errors.push({ row: rowIndex, field: 'capacityM3', message: 'capacityM3 must be > 0' });
    }
  }

  const rawTankCapacity = row.tankCapacityLitres ?? row.tank_capacity_litres;
  let tankCapacityLitres;
  if (hasValue(rawTankCapacity)) {
    tankCapacityLitres = Number(rawTankCapacity);
    if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres <= 0) {
      errors.push({ row: rowIndex, field: 'tankCapacityLitres', message: 'tankCapacityLitres must be > 0' });
    }
  }

  const rawLastOdometer = row.lastOdometerKm ?? row.last_odometer_km;
  let lastOdometerKm;
  if (hasValue(rawLastOdometer)) {
    lastOdometerKm = Number(rawLastOdometer);
    if (!Number.isFinite(lastOdometerKm) || lastOdometerKm < 0) {
      errors.push({ row: rowIndex, field: 'lastOdometerKm', message: 'lastOdometerKm must be >= 0' });
    }
  }

  const fuelType = safeTrim(row.fuelType ?? row.fuel_type);
  if (!fuelType) errors.push({ row: rowIndex, field: 'fuelType', message: 'fuelType required' });
  else if (!Object.values(FUEL_TYPES).includes(fuelType)) {
    errors.push({ row: rowIndex, field: 'fuelType', message: `Invalid fuelType '${fuelType}'` });
  }

  const rawKmPerLitre = row.kmPerLitre ?? row.km_per_litre;
  const rawEnergyKWhPerKm = row.energyKWhPerKm ?? row.energy_kwh_per_km;
  const kmPerLitre = hasValue(rawKmPerLitre) ? Number(rawKmPerLitre) : null;
  const energyKWhPerKm = hasValue(rawEnergyKWhPerKm) ? Number(rawEnergyKWhPerKm) : null;

  if (fuelType === FUEL_TYPES.ELECTRIC) {
    if (energyKWhPerKm === null || !Number.isFinite(energyKWhPerKm) || energyKWhPerKm <= 0) {
      errors.push({ row: rowIndex, field: 'energyKWhPerKm', message: 'Electric vehicles need energyKWhPerKm > 0' });
    }
  } else {
    if (kmPerLitre === null || !Number.isFinite(kmPerLitre) || kmPerLitre <= 0) {
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
    capacityM3,
    fuelType,
    kmPerLitre: kmPerLitre ?? undefined,
    energyKWhPerKm: energyKWhPerKm ?? undefined,
    tankCapacityLitres,
    lastOdometerKm,
    availability,
    fleetId: fleetId ? safeTrim(fleetId) : undefined,
  };

  return { errors, vehicleData };
};

/** Process CSV – create vehicles (dryRun optional) */
const processVehicleCsv = async (csvText, options = {}) => {
  const { dryRun = true } = options;
  const { data: rows, errors: parseErrors } = parseCsv(csvText);
  const existingIds = new Set();
  const validVehiclesData = [];
  const summary = {
    dryRun,
    totalRows: rows.length,
    created: 0,
    errors: [],
    preview: [],
  };

  const incomingIds = Array.from(new Set(rows.map(extractVehicleId).filter(Boolean)));
  const dbCollisions = incomingIds.length > 0
    ? await Vehicle.find({ vehicleId: { $in: incomingIds } }).select('vehicleId').lean()
    : [];
  const dbCollisionSet = new Set(dbCollisions.map((v) => String(v.vehicleId).toUpperCase()));

  for (let i = 0; i < rows.length; i++) {
    const { errors, vehicleData } = validateRow(rows[i], i + 1, existingIds, dbCollisionSet);
    if (errors.length) {
      summary.errors.push(...errors);
      continue;
    }
    validVehiclesData.push(vehicleData);
  }

  // Merge any Papa parse errors
  if (parseErrors.length) {
    summary.errors.push(...parseErrors.map((e) => ({ row: e.row, field: 'parse', message: e.message })));
  }

  if (dryRun) {
    summary.created = validVehiclesData.length;
    summary.preview = validVehiclesData.slice(0, 10);
    return summary;
  }

  if (summary.errors.length > 0) {
    throw new AppError(
      `Vehicle CSV validation failed with ${summary.errors.length} error(s)`,
      422,
      'CSV_VALIDATION_FAILED',
      summary.errors
    );
  }

  for (const vehicleData of validVehiclesData) {
    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();
    summary.created += 1;
  }

  return summary;
};

module.exports = { processVehicleCsv };
