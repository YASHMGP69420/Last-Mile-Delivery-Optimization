const Route = require('../models/Route');
const DriverShift = require('../models/DriverShift');
const Delivery = require('../models/Delivery');
const Vehicle = require('../models/Vehicle');
const { scoreRouteCost } = require('./optimization/costScorer');
const { DELIVERY_STATUS, SHIFT_STATUS, VEHICLE_STATUS, FUEL_TYPES } = require('../config/constants');

const ACTIVE_SAVINGS_ROUTE_STATUSES = ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED'];
const NON_DRAFT_ROUTE_STATUSES = ['OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED'];

/**
 * Computes exact fuel (Litres) or electricity (kWh) saved by an optimized route
 * from `route.deltas.distanceSavedKm` using the assigned vehicle's propulsion model.
 */
function computeRouteFuelSaved(routeDoc, vehicleDoc) {
  const distanceSavedKm = Math.max(0, Number(routeDoc?.deltas?.distanceSavedKm || 0));
  if (distanceSavedKm <= 0) {
    const unit =
      vehicleDoc && String(vehicleDoc.fuelType || '').toUpperCase() === 'ELECTRIC'
        ? 'kWh'
        : routeDoc?.metrics?.fuelUnit || 'L';
    return { fuelSaved: 0, fuelUnit: unit, distanceSavedKm: 0 };
  }

  const scored = scoreRouteCost(distanceSavedKm, vehicleDoc || null);
  return {
    fuelSaved: Number((scored.fuelConsumed || 0).toFixed(2)),
    fuelUnit: scored.fuelUnit || 'L',
    distanceSavedKm: Number(distanceSavedKm.toFixed(2)),
  };
}

/**
 * Aggregates fleet-wide route savings (km, L, kWh, INR) and logged shift odometer/fuel usage.
 */
async function getFleetSavingsSummary() {
  const [routes, completedShifts] = await Promise.all([
    Route.find({ status: { $in: ACTIVE_SAVINGS_ROUTE_STATUSES } })
      .populate('vehicleId', 'fuelType kmPerLitre energyKWhPerKm')
      .lean(),
    DriverShift.find({ status: SHIFT_STATUS.COMPLETED }).lean(),
  ]);

  let totalDistanceSavedKm = 0;
  let fuelSavedInr = 0;
  let fuelSavedLitres = 0;
  let energySavedKwh = 0;

  for (const r of routes) {
    totalDistanceSavedKm += Number(r.deltas?.distanceSavedKm || 0);
    fuelSavedInr += Number(r.deltas?.costSavedInr || 0);
    const { fuelSaved, fuelUnit } = computeRouteFuelSaved(r, r.vehicleId);
    if (fuelUnit === 'kWh') {
      energySavedKwh += fuelSaved;
    } else {
      fuelSavedLitres += fuelSaved;
    }
  }

  let actualDistanceDrivenKm = 0;
  let actualFuelUsedLitres = 0;
  let batteryDropSum = 0;
  let batteryShiftCount = 0;

  for (const s of completedShifts) {
    actualDistanceDrivenKm += Number(s.actualDistanceKm || 0);
    if (s.fuelUnit === '%') {
      if (s.telemetryCapturedAtEnd) {
        batteryDropSum += Number(s.actualFuelOrChargeUsed || 0);
        batteryShiftCount += 1;
      }
    } else {
      actualFuelUsedLitres += Number(s.actualFuelOrChargeUsed || 0);
    }
  }

  return {
    totalDistanceSavedKm: Number(totalDistanceSavedKm.toFixed(2)),
    fuelSavedInr: Number(fuelSavedInr.toFixed(2)),
    fuelSavedLitres: Number(fuelSavedLitres.toFixed(2)),
    energySavedKwh: Number(energySavedKwh.toFixed(2)),
    actualDistanceDrivenKm: Number(actualDistanceDrivenKm.toFixed(2)),
    actualFuelUsedLitres: Number(actualFuelUsedLitres.toFixed(2)),
    actualAvgBatteryUsedPct:
      batteryShiftCount > 0 ? Number((batteryDropSum / batteryShiftCount).toFixed(1)) : 0,
  };
}

/**
 * Computes per-driver performance, savings, deliveries made, and shift odometer/fuel usage
 * for a list of driver ObjectIds.
 */
async function getDriverPerformanceMetricsMap(driverIds = []) {
  const map = new Map();
  if (!Array.isArray(driverIds) || driverIds.length === 0) {
    return map;
  }

  for (const id of driverIds) {
    map.set(id.toString(), {
      deliveriesCompleted: 0,
      deliveriesFailed: 0,
      kmSaved: 0,
      fuelSavedLitres: 0,
      energySavedKwh: 0,
      costSavedInr: 0,
      actualDistanceKm: 0,
      actualFuelUsedLitres: 0,
      actualChargeUsedPct: 0,
      shiftsCompleted: 0,
      recentShifts: [],
    });
  }

  const [deliveryAgg, routes, shifts] = await Promise.all([
    Delivery.aggregate([
      {
        $match: {
          assignedDriverId: { $in: driverIds },
          status: { $in: [DELIVERY_STATUS.COMPLETED, DELIVERY_STATUS.FAILED] },
        },
      },
      {
        $group: {
          _id: { driverId: '$assignedDriverId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]),
    Route.find({
      driverId: { $in: driverIds },
      status: { $in: ACTIVE_SAVINGS_ROUTE_STATUSES },
    })
      .populate('vehicleId', 'fuelType kmPerLitre energyKWhPerKm')
      .lean(),
    DriverShift.find({
      driverId: { $in: driverIds },
      status: SHIFT_STATUS.COMPLETED,
    })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  for (const row of deliveryAgg) {
    const key = row._id.driverId.toString();
    const entry = map.get(key);
    if (!entry) continue;
    if (row._id.status === DELIVERY_STATUS.COMPLETED) {
      entry.deliveriesCompleted = row.count;
    } else if (row._id.status === DELIVERY_STATUS.FAILED) {
      entry.deliveriesFailed = row.count;
    }
  }

  for (const r of routes) {
    const key = r.driverId ? r.driverId.toString() : null;
    const entry = key ? map.get(key) : null;
    if (!entry) continue;

    entry.kmSaved += Number(r.deltas?.distanceSavedKm || 0);
    entry.costSavedInr += Number(r.deltas?.costSavedInr || 0);
    const { fuelSaved, fuelUnit } = computeRouteFuelSaved(r, r.vehicleId);
    if (fuelUnit === 'kWh') {
      entry.energySavedKwh += fuelSaved;
    } else {
      entry.fuelSavedLitres += fuelSaved;
    }
  }

  for (const s of shifts) {
    const key = s.driverId ? s.driverId.toString() : null;
    const entry = key ? map.get(key) : null;
    if (!entry) continue;

    entry.shiftsCompleted += 1;
    entry.actualDistanceKm += Number(s.actualDistanceKm || 0);
    if (s.fuelUnit === '%') {
      entry.actualChargeUsedPct += Number(s.actualFuelOrChargeUsed || 0);
    } else {
      entry.actualFuelUsedLitres += Number(s.actualFuelOrChargeUsed || 0);
    }

    if (entry.recentShifts.length < 5 && (s.telemetryCapturedAtStart || s.telemetryCapturedAtEnd)) {
      entry.recentShifts.push({
        id: s._id.toString(),
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        fuelUnit: s.fuelUnit || 'L',
        startOdometerKm: s.startOdometerKm,
        endOdometerKm: s.endOdometerKm,
        startFuelOrCharge: s.startFuelOrCharge,
        endFuelOrCharge: s.endFuelOrCharge,
        actualDistanceKm: Number((s.actualDistanceKm || 0).toFixed(2)),
        actualFuelOrChargeUsed: Number((s.actualFuelOrChargeUsed || 0).toFixed(2)),
      });
    }
  }

  for (const [, entry] of map) {
    entry.kmSaved = Number(entry.kmSaved.toFixed(2));
    entry.fuelSavedLitres = Number(entry.fuelSavedLitres.toFixed(2));
    entry.energySavedKwh = Number(entry.energySavedKwh.toFixed(2));
    entry.costSavedInr = Number(entry.costSavedInr.toFixed(2));
    entry.actualDistanceKm = Number(entry.actualDistanceKm.toFixed(2));
    entry.actualFuelUsedLitres = Number(entry.actualFuelUsedLitres.toFixed(2));
    entry.actualChargeUsedPct = Number(entry.actualChargeUsedPct.toFixed(1));
  }

  return map;
}

/**
 * Aggregates PRD KPIs, synchronized fleet savings, and Planned vs Actual
 * (Route vs DriverShift) metrics while excluding DRAFT and CANCELLED routes.
 */
async function getAnalyticsSummary() {
  const [fleetSavings, nonDraftRoutes, deliveries, vehicles, completedShiftsCount] =
    await Promise.all([
      getFleetSavingsSummary(),
      Route.find({ status: { $in: NON_DRAFT_ROUTE_STATUSES } })
        .populate('vehicleId', 'fuelType kmPerLitre energyKWhPerKm')
        .lean(),
      Delivery.find()
        .select('status weightKg address.zone createdAt updatedAt')
        .lean(),
      Vehicle.find()
        .select('availability fuelType capacityKg')
        .lean(),
      DriverShift.countDocuments({ status: SHIFT_STATUS.COMPLETED }),
    ]);

  const totalDeliveries = deliveries.length;
  let completedDeliveries = 0;
  let activeDeliveries = 0;
  let failedDeliveries = 0;
  let unassignedDeliveries = 0;
  let activeCargoKg = 0;
  let totalWeightKg = 0;
  const zoneCounts = {};

  for (const d of deliveries) {
    const weight = Number(d.weightKg || 0);
    totalWeightKg += weight;

    const zone = d.address?.zone || 'Other';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;

    if (d.status === DELIVERY_STATUS.COMPLETED) {
      completedDeliveries += 1;
    } else if (
      d.status === DELIVERY_STATUS.ASSIGNED ||
      d.status === DELIVERY_STATUS.OUT_FOR_DELIVERY
    ) {
      activeDeliveries += 1;
      activeCargoKg += weight;
    } else if (d.status === DELIVERY_STATUS.FAILED) {
      failedDeliveries += 1;
    } else if (
      d.status === DELIVERY_STATUS.DRAFT ||
      d.status === DELIVERY_STATUS.READY
    ) {
      unassignedDeliveries += 1;
    }
  }

  const deliveryCompletionRatePct =
    totalDeliveries > 0
      ? Number(((completedDeliveries / totalDeliveries) * 100).toFixed(1))
      : 0;

  const resolved = completedDeliveries + failedDeliveries;
  const hasResolvedDeliveries = resolved > 0;
  const onTimeDeliveryRatePct = hasResolvedDeliveries
    ? Number(((completedDeliveries / resolved) * 100).toFixed(1))
    : 0;

  const routeDispatchedAtByDeliveryId = new Map();
  let sumNonDraftDurationMin = 0;
  let totalPlannedStops = 0;
  let totalOperatingCostInr = 0;
  let sumBaseDist = 0;
  let sumOptDist = 0;
  let sumBaseCost = 0;
  let sumOptCost = 0;
  let totalCo2AvoidedKg = 0;

  for (const r of nonDraftRoutes) {
    if (r.dispatchedAt && Array.isArray(r.stops)) {
      for (const stop of r.stops) {
        if (stop.deliveryId) {
          routeDispatchedAtByDeliveryId.set(stop.deliveryId.toString(), r.dispatchedAt);
        }
      }
    }

    const stopsCount = Number(
      r.metrics?.totalStops || (Array.isArray(r.stops) ? r.stops.length : 0)
    );
    sumNonDraftDurationMin += Number(r.metrics?.totalDurationMin || 0);
    totalPlannedStops += stopsCount;
    totalOperatingCostInr += Number(r.metrics?.costInr || 0);
    totalCo2AvoidedKg += Number(r.deltas?.co2AvoidedKg || 0);

    const baseDist = Number(r.baseline?.totalDistanceKm || 0);
    if (baseDist > 0) {
      sumBaseDist += baseDist;
      sumOptDist += Number(r.metrics?.totalDistanceKm || 0);
    }

    const baseCost = Number(r.baseline?.costInr || 0);
    if (baseCost > 0) {
      sumBaseCost += baseCost;
      sumOptCost += Number(r.metrics?.costInr || 0);
    }
  }

  let completedDurationSumMin = 0;
  let completedDurationCount = 0;
  for (const d of deliveries) {
    if (d.status !== DELIVERY_STATUS.COMPLETED) continue;
    const endMs = d.updatedAt ? new Date(d.updatedAt).getTime() : NaN;
    const dispatchedAt = routeDispatchedAtByDeliveryId.get(d._id.toString());
    const startMs =
      dispatchedAt && d.updatedAt && new Date(d.updatedAt) >= new Date(dispatchedAt)
        ? new Date(dispatchedAt).getTime()
        : d.createdAt
        ? new Date(d.createdAt).getTime()
        : NaN;

    if (Number.isFinite(endMs) && Number.isFinite(startMs)) {
      completedDurationSumMin += Math.max(0, (endMs - startMs) / 60000);
      completedDurationCount += 1;
    }
  }

  const averageDeliveryTimeMin =
    completedDurationCount > 0
      ? Number((completedDurationSumMin / completedDurationCount).toFixed(1))
      : null;

  const avgPlannedStopDurationMin =
    totalPlannedStops > 0
      ? Number((sumNonDraftDurationMin / totalPlannedStops).toFixed(1))
      : null;

  const roundedTotalOperatingCostInr = Number(totalOperatingCostInr.toFixed(2));
  const fuelCostPerDeliveryInr =
    completedDeliveries > 0
      ? Number((roundedTotalOperatingCostInr / completedDeliveries).toFixed(2))
      : totalDeliveries > 0
      ? Number((roundedTotalOperatingCostInr / totalDeliveries).toFixed(2))
      : 0;

  const routeEfficiencyScorePct =
    sumBaseDist > 0
      ? Number((Math.max(0, (sumBaseDist - sumOptDist) / sumBaseDist) * 100).toFixed(1))
      : 0;

  const costEfficiencyPct =
    sumBaseCost > 0
      ? Number((Math.max(0, (sumBaseCost - sumOptCost) / sumBaseCost) * 100).toFixed(1))
      : 0;

  const nonRetired = vehicles.filter((v) => v.availability !== VEHICLE_STATUS.RETIRED);
  const activeVehicles = nonRetired.filter((v) =>
    [VEHICLE_STATUS.ASSIGNED, VEHICLE_STATUS.IN_TRANSIT].includes(v.availability)
  );
  const vehicleUtilizationRatePct =
    nonRetired.length > 0
      ? Number(((activeVehicles.length / nonRetired.length) * 100).toFixed(1))
      : 0;

  const activeCapacityKg = activeVehicles.reduce(
    (sum, v) => sum + Number(v.capacityKg || 0),
    0
  );
  const cargoLoadPct =
    activeCapacityKg > 0
      ? Number(((activeCargoKg / activeCapacityKg) * 100).toFixed(1))
      : 0;

  const executedRoutes = nonDraftRoutes.filter((r) =>
    ACTIVE_SAVINGS_ROUTE_STATUSES.includes(r.status)
  );

  let plannedBaselineDistanceKm = 0;
  let plannedOptimizedDistanceKm = 0;
  let plannedFuelLitres = 0;
  let plannedEnergyKwh = 0;
  let plannedBaselineFuelLitres = 0;
  let plannedCostInr = 0;

  for (const r of executedRoutes) {
    const baseDist = Number(r.baseline?.totalDistanceKm || 0);
    plannedBaselineDistanceKm += baseDist;
    plannedOptimizedDistanceKm += Number(r.metrics?.totalDistanceKm || 0);
    plannedCostInr += Number(r.metrics?.costInr || 0);

    if (r.metrics?.fuelUnit === 'kWh') {
      plannedEnergyKwh += Number(r.metrics?.fuelConsumed || 0);
    } else {
      plannedFuelLitres += Number(r.metrics?.fuelConsumed || 0);
    }

    if (baseDist > 0) {
      const scoredBaseline = scoreRouteCost(baseDist, r.vehicleId || null);
      if (scoredBaseline.fuelUnit !== 'kWh') {
        plannedBaselineFuelLitres += Number(scoredBaseline.fuelConsumed || 0);
      }
    }
  }

  const roundedPlannedOptimizedDistanceKm = Number(plannedOptimizedDistanceKm.toFixed(2));
  const distanceVarianceKm =
    completedShiftsCount > 0
      ? Number((fleetSavings.actualDistanceDrivenKm - roundedPlannedOptimizedDistanceKm).toFixed(2))
      : 0;

  const zoneBreakdown = Object.entries(zoneCounts)
    .map(([zone, count]) => ({
      zone,
      count,
      pct: totalDeliveries > 0 ? Number(((count / totalDeliveries) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const propulsionBreakdown = {
    electric: vehicles.filter(
      (v) => String(v.fuelType || '').toLowerCase() === FUEL_TYPES.ELECTRIC.toLowerCase()
    ).length,
    diesel: vehicles.filter(
      (v) => String(v.fuelType || '').toLowerCase() === FUEL_TYPES.DIESEL.toLowerCase()
    ).length,
    petrol: vehicles.filter(
      (v) => String(v.fuelType || '').toLowerCase() === FUEL_TYPES.PETROL.toLowerCase()
    ).length,
  };

  return {
    totalDeliveries,
    completedDeliveries,
    activeDeliveries,
    failedDeliveries,
    unassignedDeliveries,
    hasResolvedDeliveries,
    deliveryCompletionRatePct,
    onTimeDeliveryRatePct,
    averageDeliveryTimeMin,
    avgPlannedStopDurationMin,
    totalOperatingCostInr: roundedTotalOperatingCostInr,
    fuelCostPerDeliveryInr,
    routeEfficiencyScorePct,
    costEfficiencyPct,
    vehicleUtilizationRatePct,
    cargoLoadPct,
    activeCargoKg: Number(activeCargoKg.toFixed(2)),
    activeCapacityKg: Number(activeCapacityKg.toFixed(2)),
    totalWeightKg: Number(totalWeightKg.toFixed(2)),
    totalCo2AvoidedKg: Number(totalCo2AvoidedKg.toFixed(3)),
    totalDistanceSavedKm: fleetSavings.totalDistanceSavedKm,
    fuelSavedInr: fleetSavings.fuelSavedInr,
    fuelSavedLitres: fleetSavings.fuelSavedLitres,
    energySavedKwh: fleetSavings.energySavedKwh,
    actualDistanceDrivenKm: fleetSavings.actualDistanceDrivenKm,
    actualFuelUsedLitres: fleetSavings.actualFuelUsedLitres,
    actualAvgBatteryUsedPct: fleetSavings.actualAvgBatteryUsedPct,
    fleetSavings,
    plannedVsActual: {
      plannedBaselineDistanceKm: Number(plannedBaselineDistanceKm.toFixed(2)),
      plannedOptimizedDistanceKm: roundedPlannedOptimizedDistanceKm,
      plannedFuelLitres: Number(plannedFuelLitres.toFixed(2)),
      plannedEnergyKwh: Number(plannedEnergyKwh.toFixed(2)),
      plannedBaselineFuelLitres: Number(plannedBaselineFuelLitres.toFixed(2)),
      plannedCostInr: Number(plannedCostInr.toFixed(2)),
      actualDistanceKm: fleetSavings.actualDistanceDrivenKm,
      actualFuelLitres: fleetSavings.actualFuelUsedLitres,
      actualAvgBatteryUsedPct: fleetSavings.actualAvgBatteryUsedPct,
      completedShiftsCount,
      executedRoutesCount: executedRoutes.length,
      distanceVarianceKm,
    },
    zoneBreakdown,
    propulsionBreakdown,
    counts: {
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.filter((v) => v.availability === VEHICLE_STATUS.AVAILABLE).length,
      maintenanceVehicles: vehicles.filter((v) => v.availability === VEHICLE_STATUS.MAINTENANCE).length,
      nonRetiredVehicles: nonRetired.length,
      activeVehicles: activeVehicles.length,
      nonDraftRoutesCount: nonDraftRoutes.length,
    },
  };
}

module.exports = {
  computeRouteFuelSaved,
  getFleetSavingsSummary,
  getDriverPerformanceMetricsMap,
  getAnalyticsSummary,
};
