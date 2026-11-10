const { AppError } = require('../middleware/errorHandler');

/**
 * Determine the fuel/charge unit and upper bound for a vehicle.
 * Electric vehicles use 0-100%, while Petrol/Diesel vehicles use tankCapacityLitres
 * if configured, falling back to 500 L for Trucks and 200 L for Bikes/Vans.
 */
function getFuelUpperCap(vehicle) {
  const isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';
  if (isElectric) {
    return { isElectric: true, unit: '%', max: 100 };
  }

  const customCap = Number(vehicle?.tankCapacityLitres);
  if (Number.isFinite(customCap) && customCap > 0) {
    return { isElectric: false, unit: 'L', max: customCap };
  }

  const isTruck = String(vehicle?.type || '').toUpperCase() === 'TRUCK';
  return { isElectric: false, unit: 'L', max: isTruck ? 500 : 200 };
}

/**
 * Enforce non-negative odometer reading and continuity against a baseline reading.
 */
function validateOdometerContinuity(enteredKm, baselineKm, label = 'Odometer') {
  if (enteredKm === null || enteredKm === undefined) {
    return;
  }

  if (typeof enteredKm !== 'number' || !Number.isFinite(enteredKm) || enteredKm < 0) {
    throw new AppError(
      `${label} must be a non-negative number.`,
      400,
      'INVALID_ODOMETER_READING'
    );
  }

  if (
    baselineKm !== null &&
    baselineKm !== undefined &&
    Number.isFinite(Number(baselineKm)) &&
    enteredKm < Number(baselineKm)
  ) {
    throw new AppError(
      `${label} (${enteredKm} km) cannot be less than last recorded odometer (${baselineKm} km).`,
      400,
      'INVALID_ODOMETER_READING'
    );
  }
}

/**
 * Enforce fuel/charge bounds (0-100% for EVs, 0-tankCap L for Petrol/Diesel).
 */
function validateFuelLevel(enteredValue, vehicle, label = 'Fuel/charge') {
  if (enteredValue === null || enteredValue === undefined) {
    return;
  }

  const cap = getFuelUpperCap(vehicle);
  const unitLabel = cap.isElectric ? '%' : 'L';
  const metricName = cap.isElectric ? 'battery charge' : 'fuel level';

  if (
    typeof enteredValue !== 'number' ||
    !Number.isFinite(enteredValue) ||
    enteredValue < 0 ||
    enteredValue > cap.max
  ) {
    throw new AppError(
      `${label} ${metricName} must be between 0 and ${cap.max} ${unitLabel}.`,
      400,
      'INVALID_FUEL_LEVEL'
    );
  }
}

module.exports = {
  getFuelUpperCap,
  validateOdometerContinuity,
  validateFuelLevel,
};
