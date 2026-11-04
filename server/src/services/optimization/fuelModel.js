// server/src/services/optimization/fuelModel.js
/**
 * Fuel model – estimates fuel consumption (or energy usage) for a given route.
 * Supports ICE (combustion) and EV (electric) vehicles.
 *
 * Input: vehicle spec { fuelType: 'ICE'|'EV', fuelEfficiency: number (km/l) or energyEfficiency: number (kWh/km) }
 *        routeDistanceKm: total distance of the route in km.
 * Output: { fuelConsumed: number, unit: string }
 */
function estimateFuel(vehicle, routeDistanceKm) {
  if (!vehicle || typeof routeDistanceKm !== 'number') {
    throw new Error('Invalid arguments to estimateFuel');
  }
  if (vehicle.fuelType === 'ICE') {
    // fuelEfficiency is km per litre
    const litres = routeDistanceKm / vehicle.fuelEfficiency;
    return { fuelConsumed: litres, unit: 'L' };
  }
  if (vehicle.fuelType === 'EV') {
    // energyEfficiency is kWh per km
    const kWh = routeDistanceKm * vehicle.energyEfficiency;
    return { fuelConsumed: kWh, unit: 'kWh' };
  }
  // default fallback – treat as ICE with 10 km/L
  const litres = routeDistanceKm / 10;
  return { fuelConsumed: litres, unit: 'L' };
}

module.exports = { estimateFuel };
