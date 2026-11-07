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
 * @param {Object} [tariffs] - Optional custom fuel tariffs and emissions from OrganizationSettings
 * @returns {{
 *   fuelConsumed: number,
 *   fuelUnit: string,
 *   costInr: number,
 *   co2Kg: number,
 *   costPerKm: number
 * }}
 */
function scoreRouteCost(distanceKm, vehicle, tariffs = {}) {
  const dist = Math.max(0, Number(distanceKm) || 0);
  const rawFuelType = (vehicle && vehicle.fuelType) || FUEL_TYPES.DIESEL;
  const fuelType = String(rawFuelType).toUpperCase();

  const electricityRate = tariffs.electricityTariffPerKwh || tariffs.ELECTRICITY_INR_PER_KWH || RATES.ELECTRICITY_INR_PER_KWH;
  const dieselRate = tariffs.dieselPricePerLiter || tariffs.DIESEL_INR_PER_LITRE || RATES.DIESEL_INR_PER_LITRE;
  const petrolRate = tariffs.petrolPricePerLiter || tariffs.PETROL_INR_PER_LITRE || RATES.PETROL_INR_PER_LITRE;

  if (fuelType === 'ELECTRIC' || fuelType === 'EV') {
    const kwhPerKm = (vehicle && vehicle.energyKWhPerKm && vehicle.energyKWhPerKm > 0)
      ? Number(vehicle.energyKWhPerKm)
      : (vehicle && vehicle.energyEfficiency && vehicle.energyEfficiency > 0)
      ? Number(vehicle.energyEfficiency)
      : RATES.DEFAULT_EV_KWH_PER_KM;

    const energyKWh = dist * kwhPerKm;
    const costInr = energyKWh * electricityRate;
    const co2Rate = tariffs.carbonEmissionFactors?.electricGramsPerKm !== undefined
      ? tariffs.carbonEmissionFactors.electricGramsPerKm / 1000
      : RATES.CO2_EV_KG_PER_KM;
    const co2Kg = dist * co2Rate;

    return {
      fuelConsumed: parseFloat(energyKWh.toFixed(2)),
      fuelUnit: 'kWh',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat((kwhPerKm * electricityRate).toFixed(2)),
    };
  }

  if (fuelType === 'PETROL') {
    const kmPerLitre = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
      ? Number(vehicle.kmPerLitre)
      : (vehicle && vehicle.fuelEfficiency && vehicle.fuelEfficiency > 0)
      ? Number(vehicle.fuelEfficiency)
      : (1.0 / RATES.DEFAULT_PETROL_L_PER_KM);

    const litres = dist / kmPerLitre;
    const costInr = litres * petrolRate;
    const co2Rate = tariffs.carbonEmissionFactors?.petrolGramsPerKm !== undefined
      ? tariffs.carbonEmissionFactors.petrolGramsPerKm / 1000
      : RATES.CO2_PETROL_KG_PER_KM;
    const co2Kg = dist * co2Rate;

    return {
      fuelConsumed: parseFloat(litres.toFixed(2)),
      fuelUnit: 'L',
      costInr: parseFloat(costInr.toFixed(2)),
      co2Kg: parseFloat(co2Kg.toFixed(3)),
      costPerKm: parseFloat(((1.0 / kmPerLitre) * petrolRate).toFixed(2)),
    };
  }

  // Default: DIESEL
  const kmPerLitre = (vehicle && vehicle.kmPerLitre && vehicle.kmPerLitre > 0)
    ? Number(vehicle.kmPerLitre)
    : (vehicle && vehicle.fuelEfficiency && vehicle.fuelEfficiency > 0)
    ? Number(vehicle.fuelEfficiency)
    : (1.0 / RATES.DEFAULT_DIESEL_L_PER_KM);

  const litres = dist / kmPerLitre;
  const costInr = litres * dieselRate;
  const co2Rate = tariffs.carbonEmissionFactors?.dieselGramsPerKm !== undefined
    ? tariffs.carbonEmissionFactors.dieselGramsPerKm / 1000
    : RATES.CO2_DIESEL_KG_PER_KM;
  const co2Kg = dist * co2Rate;

  return {
    fuelConsumed: parseFloat(litres.toFixed(2)),
    fuelUnit: 'L',
    costInr: parseFloat(costInr.toFixed(2)),
    co2Kg: parseFloat(co2Kg.toFixed(3)),
    costPerKm: parseFloat(((1.0 / kmPerLitre) * dieselRate).toFixed(2)),
  };
}

/**
 * Calculates comparative deltas between baseline and optimized metrics.
 * 
 * @param {Object} baseline - { totalDistanceKm, totalDurationMin, costInr, co2Kg, fuelConsumed, fuelUnit }
 * @param {Object} optimized - { totalDistanceKm, totalDurationMin, costInr, co2Kg, fuelConsumed, fuelUnit }
 * @returns {{
 *   distanceSavedKm: number,
 *   percentDistanceReduction: number,
 *   timeSavedMin: number,
 *   percentTimeReduction: number,
 *   costSavedInr: number,
 *   percentCostReduction: number,
 *   fuelSaved: number,
 *   percentFuelReduction: number,
 *   fuelUnit: string,
 *   co2AvoidedKg: number,
 *   isImproved: boolean,
 *   message: string
 * }}
 */
function calculateDeltas(baseline = {}, optimized = {}) {
  const baseDist = Math.max(0, Number(baseline.totalDistanceKm) || 0);
  const optDist = Math.max(0, Number(optimized.totalDistanceKm) || 0);
  const distSaved = Math.max(0, baseDist - optDist);
  const percentDistance = baseDist > 0 ? (distSaved / baseDist) * 100 : 0.0;

  const baseTime = Math.max(0, Number(baseline.totalDurationMin) || 0);
  const optTime = Math.max(0, Number(optimized.totalDurationMin) || 0);
  const timeSaved = Math.max(0, baseTime - optTime);
  const percentTime = baseTime > 0 ? (timeSaved / baseTime) * 100 : 0.0;

  const baseCost = Math.max(0, Number(baseline.costInr) || 0);
  const optCost = Math.max(0, Number(optimized.costInr) || 0);
  const costSaved = Math.max(0, baseCost - optCost);
  const percentCost = baseCost > 0 ? (costSaved / baseCost) * 100 : 0.0;

  const baseFuel = Math.max(0, Number(baseline.fuelConsumed) || 0);
  const optFuel = Math.max(0, Number(optimized.fuelConsumed) || 0);
  const fuelSaved = Math.max(0, baseFuel - optFuel);
  const percentFuel = baseFuel > 0 ? (fuelSaved / baseFuel) * 100 : 0.0;
  const fuelUnit = optimized.fuelUnit || baseline.fuelUnit || 'L';

  const baseCo2 = Math.max(0, Number(baseline.co2Kg) || 0);
  const optCo2 = Math.max(0, Number(optimized.co2Kg) || 0);
  const co2Avoided = Math.max(0, baseCo2 - optCo2);

  const isImproved = distSaved > 0.01 || costSaved > 0.05 || timeSaved > 0.1;
  const message = isImproved
    ? `Route optimization reduced distance by ${distSaved.toFixed(2)} km (${percentDistance.toFixed(1)}%) and operational costs by ₹${costSaved.toFixed(2)} (${percentCost.toFixed(1)}%).`
    : 'No measurable improvement found. The current route is already optimal among the evaluated alternatives.';

  return {
    distanceSavedKm: parseFloat(distSaved.toFixed(2)),
    percentDistanceReduction: parseFloat(percentDistance.toFixed(2)),
    timeSavedMin: parseFloat(timeSaved.toFixed(1)),
    percentTimeReduction: parseFloat(percentTime.toFixed(1)),
    costSavedInr: parseFloat(costSaved.toFixed(2)),
    percentCostReduction: parseFloat(percentCost.toFixed(2)),
    fuelSaved: parseFloat(fuelSaved.toFixed(2)),
    percentFuelReduction: parseFloat(percentFuel.toFixed(2)),
    fuelUnit,
    co2AvoidedKg: parseFloat(co2Avoided.toFixed(3)),
    isImproved,
    message,
  };
}

module.exports = {
  RATES,
  scoreRouteCost,
  calculateDeltas,
};
