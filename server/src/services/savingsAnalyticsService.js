const Route = require('../models/Route');
const DriverShift = require('../models/DriverShift');
const Delivery = require('../models/Delivery');
const { scoreRouteCost } = require('./optimization/costScorer');
const { DELIVERY_STATUS, SHIFT_STATUS } = require('../config/constants');

const ACTIVE_SAVINGS_ROUTE_STATUSES = ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED'];

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

module.exports = {
  computeRouteFuelSaved,
  getFleetSavingsSummary,
  getDriverPerformanceMetricsMap,
};
