const { PRIORITY_LEVELS, FUEL_TYPES } = require('../../config/constants');

const PRIORITY_ORDER = {
  [PRIORITY_LEVELS.COLD_CHAIN]: 0,
  [PRIORITY_LEVELS.URGENT]: 1,
  [PRIORITY_LEVELS.STANDARD]: 2,
};

/**
 * Packs deliveries into available vehicles respecting payload capacity limits.
 *
 * @param {Array<Object>} deliveries - Consignment objects with weightKg and priority
 * @param {Array<Object>} vehicles - Vehicle objects with capacityKg and fuelType
 * @param {Object} [options] - { vehicleTypePreference: 'EV' | 'ICE' | 'COST_OPTIMAL' }
 * @returns {{
 *   vehicleBins: Array<{
 *     vehicle: Object,
 *     deliveries: Array<Object>,
 *     totalWeightKg: number,
 *     remainingCapacityKg: number,
 *     utilizationPercent: number
 *   }>,
 *   unassignedDeliveries: Array<{
 *     deliveryId: string,
 *     orderReference: string,
 *     weightKg: number,
 *     priority: string,
 *     reason: string,
 *     details: string
 *   }>
 * }}
 */
function packDeliveries(deliveries = [], vehicles = [], options = {}) {
  const vehicleTypePreference = options.vehicleTypePreference || 'COST_OPTIMAL';

  if (!vehicles || vehicles.length === 0) {
    return {
      vehicleBins: [],
      unassignedDeliveries: deliveries.map(d => ({
        deliveryId: (d._id || d.id || '').toString(),
        orderReference: d.orderReference || '',
        weightKg: d.weightKg || 0,
        priority: d.priority || PRIORITY_LEVELS.STANDARD,
        reason: 'NO_AVAILABLE_VEHICLES',
        details: 'No active or eligible vehicles provided for allocation',
      })),
    };
  }

  // 1. Sort vehicles according to strategy
  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (vehicleTypePreference === 'EV') {
      const aIsEv = a.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      const bIsEv = b.fuelType === FUEL_TYPES.ELECTRIC ? 0 : 1;
      if (aIsEv !== bIsEv) return aIsEv - bIsEv;
    } else if (vehicleTypePreference === 'ICE') {
      const aIsIce = a.fuelType !== FUEL_TYPES.ELECTRIC ? 0 : 1;
      const bIsIce = b.fuelType !== FUEL_TYPES.ELECTRIC ? 0 : 1;
      if (aIsIce !== bIsIce) return aIsIce - bIsIce;
    }
    // Secondary sort: capacity descending
    return (b.capacityKg || 0) - (a.capacityKg || 0);
  });

  // Initialize vehicle bins
  const bins = sortedVehicles.map(vehicle => ({
    vehicle,
    deliveries: [],
    totalWeightKg: 0,
    remainingCapacityKg: vehicle.capacityKg || 0,
    utilizationPercent: 0,
  }));

  const maxFleetVehicleCapacity = Math.max(...sortedVehicles.map(v => v.capacityKg || 0));

  // Partition vehicle bin indices into preference tiers for Tiered Best-Fit Decreasing
  let preferredTierIndices = [];
  let fallbackTierIndices = [];

  if (vehicleTypePreference === 'EV') {
    for (let i = 0; i < bins.length; i++) {
      if (bins[i].vehicle.fuelType === FUEL_TYPES.ELECTRIC) {
        preferredTierIndices.push(i);
      } else {
        fallbackTierIndices.push(i);
      }
    }
  } else if (vehicleTypePreference === 'ICE') {
    for (let i = 0; i < bins.length; i++) {
      if (bins[i].vehicle.fuelType !== FUEL_TYPES.ELECTRIC) {
        preferredTierIndices.push(i);
      } else {
        fallbackTierIndices.push(i);
      }
    }
  } else {
    // Single tier for COST_OPTIMAL or unguided allocation
    preferredTierIndices = bins.map((_, i) => i);
  }

  // 2. Sort deliveries: Priority (Cold Chain -> Urgent -> Standard) -> Weight (Desc) -> Order Ref (Asc)
  const sortedDeliveries = [...deliveries].sort((a, b) => {
    const prioA = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 2;
    const prioB = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 2;
    if (prioA !== prioB) return prioA - prioB;

    const weightDiff = (b.weightKg || 0) - (a.weightKg || 0);
    if (Math.abs(weightDiff) > 1e-4) return weightDiff;

    const refA = (a.orderReference || (a._id || a.id || '').toString());
    const refB = (b.orderReference || (b._id || b.id || '').toString());
    return refA.localeCompare(refB);
  });

  const unassignedDeliveries = [];

  // Helper to find the best-fitting bin within a specific candidate tier of bin indices
  const findBestFitBin = (tierIndices, weight) => {
    let bestIdx = -1;
    let minRemaining = Infinity;
    for (const idx of tierIndices) {
      const bin = bins[idx];
      if (bin.remainingCapacityKg >= weight - 1e-6) {
        const remainingAfter = bin.remainingCapacityKg - weight;
        if (remainingAfter < minRemaining) {
          minRemaining = remainingAfter;
          bestIdx = idx;
        }
      }
    }
    return bestIdx;
  };

  // 3. Bin-Packing Allocation (Tiered Best-Fit Decreasing)
  for (const delivery of sortedDeliveries) {
    const weight = delivery.weightKg || 0;

    // Check individual stop feasibility against fleet absolute max
    if (weight > maxFleetVehicleCapacity) {
      unassignedDeliveries.push({
        deliveryId: (delivery._id || delivery.id || '').toString(),
        orderReference: delivery.orderReference || '',
        weightKg: weight,
        priority: delivery.priority || PRIORITY_LEVELS.STANDARD,
        reason: 'EXCEEDS_VEHICLE_MAX_CAPACITY',
        details: `Consignment weight (${weight} kg) exceeds maximum vehicle capacity (${maxFleetVehicleCapacity} kg) in the fleet`,
      });
      continue;
    }

    // Tiered Best-Fit Decreasing: Evaluate preferred tier first
    let bestBinIndex = findBestFitBin(preferredTierIndices, weight);

    // Fall back to non-preferred tier only when preferred tier cannot accommodate consignment
    if (bestBinIndex === -1 && fallbackTierIndices.length > 0) {
      bestBinIndex = findBestFitBin(fallbackTierIndices, weight);
    }

    if (bestBinIndex !== -1) {
      const targetBin = bins[bestBinIndex];
      targetBin.deliveries.push(delivery);
      targetBin.totalWeightKg = parseFloat((targetBin.totalWeightKg + weight).toFixed(2));
      targetBin.remainingCapacityKg = parseFloat((targetBin.remainingCapacityKg - weight).toFixed(2));
      targetBin.utilizationPercent = parseFloat(
        ((targetBin.totalWeightKg / targetBin.vehicle.capacityKg) * 100).toFixed(1)
      );
    } else {
      unassignedDeliveries.push({
        deliveryId: (delivery._id || delivery.id || '').toString(),
        orderReference: delivery.orderReference || '',
        weightKg: weight,
        priority: delivery.priority || PRIORITY_LEVELS.STANDARD,
        reason: 'CAPACITY_OVERFLOW',
        details: `Aggregate payload exceeded remaining fleet capacity; cannot fit consignment (${weight} kg)`,
      });
    }
  }

  return {
    vehicleBins: bins.filter(b => b.deliveries.length > 0),
    unassignedDeliveries,
  };
}

module.exports = { packDeliveries };
