const { FUEL_TYPES } = require('../../config/constants');

const RATES = {
  ELECTRICITY_INR_PER_KWH: 8.00,
  DIESEL_INR_PER_LITRE: 95.00,
  PETROL_INR_PER_LITRE: 103.00,
  DEFAULT_EV_KWH_PER_KM: 0.18,
  DEFAULT_DIESEL_L_PER_KM: 0.08, // 12.5 km/L
  DEFAULT_PETROL_L_PER_KM: 0.0667, // 15.0 km/L
  CO2_DIESEL_KG_PER_KM: 0.210, // 210 g CO2/km
  CO2_PETROL_KG_PER_KM: 0.230, // 230 g CO2/km
  CO2_EV_KG_PER_KM: 0.0,       // 0 g CO2/km direct tailpipe
};

/**
 * Computes energy consumption, financial cost (INR), and CO2 emissions for a route distance.
 * 
 * @param {number} distanceKm - Total route distance in kilometers
 * @param {Object} vehicle - Vehicle object with fuelType, kmPerLitre, energyKWhPerKm
 * @returns {{
 *   fuelConsumed: number,
 *   fuelUnit: string,
 *   costInr: number,
 *   co2Kg: number,
 *   costPerKm: number
 * }}
 */
function scoreRouteCost(distanceKm, vehicle) {
  const dist = Math.max(0, Number(distanceKm) || 0);
  const fuelType = (vehicle && vehicle.fuelType) || FUEL_TYPES.DIESEL;

  if (fuelType === FUEL_TYPES.ELECTRIC) {
    const kwhPerKm = (vehicle && vehicle.energyKWhPerKm && vehicle.energyKWhPerKm > 0)
      ? Number(vehicle.energyKWhPerKm)
      : RATES.DEFAULT_EV_KWH_PER_KM;

    const energyKWh = dist * kwhPerKm;
    const costInr = energyKWh * RATES.ELECTRICITY_INR_PER_KWH;
    const co2Kg = dist * RATES.CO2_EV_KG_PER_KM;

    return {
      fuelConsumed: parseFloat(energyKWh.toFixed(2)),
      fuelUnit: 'kWh',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat((kwhPerKm * RATES.ELECTRICITY_INR_PER_KWH).toFixed(2)),
    };
  }

  if (fuelType === FUEL_TYPES.PETROL) {
    const litresPerKm = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
      ? (1.0 / Number(vehicle.kmPerLitre))
      : RATES.DEFAULT_PETROL_L_PER_KM;

    const litres = dist * litresPerKm;
    const costInr = litres * RATES.PETROL_INR_PER_LITRE;
    const co2Kg = dist * RATES.CO2_PETROL_KG_PER_KM;

    return {
      fuelConsumed: parseFloat(litres.toFixed(2)),
      fuelUnit: 'L',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat((litresPerKm * RATES.PETROL_INR_PER_LITRE).toFixed(2)),
    };
  }

  // Default: DIESEL
  const litresPerKm = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
    ? (1.0 / Number(vehicle.kmPerLitre))
    : RATES.DEFAULT_DIESEL_L_PER_KM;

  const litres = dist * litresPerKm;
  const costInr = litres * RATES.DIESEL_INR_PER_LITRE;
  const co2Kg = dist * RATES.CO2_DIESEL_KG_PER_KM;

  return {
    fuelConsumed: parseFloat(litres.toFixed(2)),
    fuelUnit: 'L',
    costInr: parseFloat(costInr.toFixed(2)),
    co2Kg: parseFloat(co2Kg.toFixed(3)),
    costPerKm: parseFloat((litresPerKm * RATES.DIESEL_INR_PER_LITRE).toFixed(2)),
  };
}

/**
 * Calculates comparative deltas between baseline and optimized metrics.
 * 
 * @param {Object} baseline - { totalDistanceKm, totalDurationMin, costInr, co2Kg }
 * @param {Object} optimized - { totalDistanceKm, totalDurationMin, costInr, co2Kg }
 * @returns {{
 *   distanceSavedKm: number,
 *   timeSavedMin: number,
 *   costSavedInr: number,
 *   co2AvoidedKg: number,
 *   percentDistanceReduction: number
 * }}
 */
function calculateDeltas(baseline = {}, optimized = {}) {
  const baseDist = Math.max(0, Number(baseline.totalDistanceKm) || 0);
  const optDist = Math.max(0, Number(optimized.totalDistanceKm) || 0);
  const distSaved = Math.max(0, baseDist - optDist);

  const baseTime = Math.max(0, Number(baseline.totalDurationMin) || 0);
  const optTime = Math.max(0, Number(optimized.totalDurationMin) || 0);
  const timeSaved = Math.max(0, baseTime - optTime);

  const baseCost = Math.max(0, Number(baseline.costInr) || 0);
  const optCost = Math.max(0, Number(optimized.costInr) || 0);
  const costSaved = Math.max(0, baseCost - optCost);

  const baseCo2 = Math.max(0, Number(baseline.co2Kg) || 0);
  const optCo2 = Math.max(0, Number(optimized.co2Kg) || 0);
  const co2Avoided = Math.max(0, baseCo2 - optCo2);

  const percentReduction = baseDist > 0 ? (distSaved / baseDist) * 100 : 0.0;

  return {
    distanceSavedKm: parseFloat(distSaved.toFixed(2)),
    timeSavedMin: parseFloat(timeSaved.toFixed(1)),
    costSavedInr: parseFloat(costSaved.toFixed(2)),
    co2AvoidedKg: parseFloat(co2Avoided.toFixed(3)),
    percentDistanceReduction: parseFloat(percentReduction.toFixed(2)),
  };
}

module.exports = {
  RATES,
  scoreRouteCost,
  calculateDeltas,
};
