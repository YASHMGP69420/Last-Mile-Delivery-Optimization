const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const DeliveryBatch = require('../models/DeliveryBatch');
const Route = require('../models/Route');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const OrganizationSettings = require('../models/OrganizationSettings');
const { scoreRouteCost } = require('./optimization/costScorer');
const { buildMatrix } = require('./optimization/matrixBuilder');
const { constructOriginalRoute } = require('./optimization/originalOrder');
const {
  DELIVERY_STATUS,
  VEHICLE_STATUS,
  DRIVER_AVAILABILITY,
  CANONICAL_DEPOT,
} = require('../config/constants');
const { AppError } = require('../middleware/errorHandler');

/**
 * Validates the dispatch eligibility for a route or batch of deliveries.
 * 
 * Separates delivery operational readiness from route optimization status:
 * Optimization is an enhancement, not a requirement for dispatch.
 * 
 * @param {Object} params
 * @param {string} [params.routeId] - Existing Route ObjectId
 * @param {string} [params.batchId] - DeliveryBatch ObjectId
 * @param {string} [params.vehicleId] - Vehicle ObjectId
 * @param {string} [params.driverId] - Driver ObjectId
 * @param {Array<string>} [params.stopSequence] - Explicit array of Delivery ObjectIds
 * @param {Array<string>} [params.deliveryIds] - Explicit array of Delivery ObjectIds
 * @param {boolean} [params.allowPartialEligible=true] - Whether to allow dispatching if only some deliveries are eligible
 * @returns {Promise<{
 *   canDispatch: boolean,
 *   error: string | null,
 *   ineligibilityReasons: string[],
 *   eligibleDeliveries: any[],
 *   ineligibleDeliveries: Array<{ deliveryId: string, orderReference: string, reason: string }>,
 *   route: any | null,
 *   batch: any | null,
 *   vehicle: any | null,
 *   driver: any | null,
 *   totalPayloadKg: number,
 *   capacityKg: number,
 *   excessKg: number
 * }>}
 */
async function validateDispatchEligibility({
  routeId,
  batchId,
  vehicleId,
  driverId,
  stopSequence,
  deliveryIds,
  allowPartialEligible = true,
} = {}) {
  const ineligibilityReasons = [];
  const ineligibleDeliveries = [];
  let route = null;
  let batch = null;
  let vehicle = null;
  let driver = null;

  // 1. Resolve Route if provided
  if (routeId) {
    if (mongoose.Types.ObjectId.isValid(routeId)) {
      route = await Route.findById(routeId);
    }
  }

  // If route exists, check if already dispatched or completed
  if (route) {
    if (['DISPATCHED', 'IN_PROGRESS', 'COMPLETED'].includes(route.status)) {
      const msg = `Route ${route.routeCode || route._id} is already in status '${route.status}' and cannot be re-dispatched`;
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries: [],
        ineligibleDeliveries: [],
        route,
        batch: null,
        vehicle: null,
        driver: null,
        totalPayloadKg: 0,
        capacityKg: 0,
        excessKg: 0,
      };
    }
  }

  // 2. Resolve Batch
  const finalBatchId = batchId || (route && route.batchId);
  if (finalBatchId) {
    if (mongoose.Types.ObjectId.isValid(finalBatchId)) {
      batch = await DeliveryBatch.findById(finalBatchId);
    }
  }

  // 3. Resolve Deliveries
  let deliveries = [];
  const candidateIds = (Array.isArray(deliveryIds) && deliveryIds.length > 0)
    ? deliveryIds
    : (Array.isArray(stopSequence) && stopSequence.length > 0)
    ? stopSequence
    : (route && Array.isArray(route.stops) && route.stops.length > 0)
    ? route.stops.map((s) => s.deliveryId).filter(Boolean)
    : null;

  if (candidateIds && candidateIds.length > 0) {
    const validCandidateIds = candidateIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validCandidateIds.length > 0) {
      deliveries = await Delivery.find({ _id: { $in: validCandidateIds } });
      // Preserve explicit order if candidateIds provided
      const delivMap = new Map(deliveries.map((d) => [d._id.toString(), d]));
      deliveries = validCandidateIds.map((id) => delivMap.get(id.toString())).filter(Boolean);
    }
  } else if (batch) {
    deliveries = await Delivery.find({ batchId: batch._id });
  }

  // Check if zero deliveries found in batch/request
  if (!deliveries || deliveries.length === 0) {
    const msg = 'Batch has no deliveries.';
    ineligibilityReasons.push(msg);
    return {
      canDispatch: false,
      error: msg,
      ineligibilityReasons,
      eligibleDeliveries: [],
      ineligibleDeliveries: [],
      route,
      batch,
      vehicle: null,
      driver: null,
      totalPayloadKg: 0,
      capacityKg: 0,
      excessKg: 0,
    };
  }

  // Find all active routes to detect conflicting assignments
  const activeRoutes = await Route.find({
    status: { $in: ['DISPATCHED', 'IN_PROGRESS'] },
    _id: route ? { $ne: route._id } : { $exists: true },
  }).select('_id routeCode stops vehicleId driverId');

  const deliveryToActiveRouteMap = new Map();
  for (const r of activeRoutes) {
    if (Array.isArray(r.stops)) {
      for (const stop of r.stops) {
        if (stop.deliveryId) {
          deliveryToActiveRouteMap.set(stop.deliveryId.toString(), r);
        }
      }
    }
  }

  // 4. Validate Each Delivery Individually
  const eligibleDeliveries = [];
  for (const deliv of deliveries) {
    const delivIdStr = deliv._id.toString();
    const ref = deliv.orderReference || deliv._id;

    // Check completed
    if (deliv.status === DELIVERY_STATUS.COMPLETED) {
      const reason = `Delivery ${ref} is already delivered.`;
      ineligibilityReasons.push(reason);
      ineligibleDeliveries.push({ deliveryId: delivIdStr, orderReference: ref, reason });
      continue;
    }

    // Check failed or cancelled
    if (deliv.status === DELIVERY_STATUS.FAILED || deliv.status === 'CANCELLED') {
      const reason = `Delivery ${ref} is cancelled.`;
      ineligibilityReasons.push(reason);
      ineligibleDeliveries.push({ deliveryId: delivIdStr, orderReference: ref, reason });
      continue;
    }

    // Check if assigned to another active route
    const conflictingRoute = deliveryToActiveRouteMap.get(delivIdStr);
    if (conflictingRoute) {
      const reason = `Delivery ${ref} is assigned to active route ${conflictingRoute.routeCode || conflictingRoute._id}.`;
      ineligibilityReasons.push(reason);
      ineligibleDeliveries.push({ deliveryId: delivIdStr, orderReference: ref, reason });
      continue;
    }

    // Otherwise, delivery is eligible (DRAFT, READY, or ASSIGNED to this route/batch)
    eligibleDeliveries.push(deliv);
  }

  // If no deliveries are eligible
  if (eligibleDeliveries.length === 0) {
    const msg = 'Cannot dispatch due to no eligible deliveries.';
    return {
      canDispatch: false,
      error: msg,
      ineligibilityReasons,
      eligibleDeliveries: [],
      ineligibleDeliveries,
      route,
      batch,
      vehicle: null,
      driver: null,
      totalPayloadKg: 0,
      capacityKg: 0,
      excessKg: 0,
    };
  }

  // 5. Resolve & Validate Vehicle
  const finalVehicleId = vehicleId || (route && route.vehicleId);
  let totalPayloadKg = eligibleDeliveries.reduce((sum, d) => sum + (Number(d.weightKg) || 0), 0);
  totalPayloadKg = parseFloat(totalPayloadKg.toFixed(2));
  let capacityKg = 1000;
  let excessKg = 0;

  if (finalVehicleId) {
    if (mongoose.Types.ObjectId.isValid(finalVehicleId)) {
      vehicle = await Vehicle.findById(finalVehicleId);
    }
    if (!vehicle) {
      const msg = 'Assigned vehicle does not exist.';
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle: null,
        driver: null,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }

    capacityKg = Number(vehicle.capacityKg) || 1000;

    // Check vehicle status
    if ([VEHICLE_STATUS.MAINTENANCE, VEHICLE_STATUS.RETIRED].includes(vehicle.availability)) {
      const msg = `Assigned vehicle ${vehicle.vehicleId || vehicle._id} is unavailable (status: ${vehicle.availability}).`;
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle,
        driver: null,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }

    // Check if vehicle is already in transit on another active route
    const vehicleActiveRoute = activeRoutes.find(
      (r) => r.vehicleId && r.vehicleId.toString() === vehicle._id.toString()
    );
    if (vehicleActiveRoute) {
      const msg = `Assigned vehicle ${vehicle.vehicleId || vehicle._id} is currently in transit on another route.`;
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle,
        driver: null,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }

    // Capacity Check
    if (totalPayloadKg > capacityKg) {
      excessKg = parseFloat((totalPayloadKg - capacityKg).toFixed(2));
      const msg = `Vehicle exceeds weight capacity by ${excessKg} kg.`;
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle,
        driver: null,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }
  } else {
    const msg = 'A valid vehicle must be assigned prior to dispatch.';
    ineligibilityReasons.push(msg);
    return {
      canDispatch: false,
      error: msg,
      ineligibilityReasons,
      eligibleDeliveries,
      ineligibleDeliveries,
      route,
      batch,
      vehicle: null,
      driver: null,
      totalPayloadKg,
      capacityKg,
      excessKg,
    };
  }

  // 6. Resolve & Validate Driver
  const finalDriverId = driverId || (route && route.driverId);
  if (finalDriverId) {
    if (mongoose.Types.ObjectId.isValid(finalDriverId)) {
      driver = await Driver.findById(finalDriverId);
    }
    if (!driver) {
      const msg = 'Assigned driver profile does not exist.';
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle,
        driver: null,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }

    // Check if driver is already in transit on another active route
    const driverActiveRoute = activeRoutes.find(
      (r) => r.driverId && r.driverId.toString() === driver._id.toString()
    );
    if (driverActiveRoute || (driver.currentRouteId && (!route || driver.currentRouteId.toString() !== route._id.toString()) && driver.availability === DRIVER_AVAILABILITY.IN_TRANSIT)) {
      const msg = 'Driver is currently on another active route.';
      ineligibilityReasons.push(msg);
      return {
        canDispatch: false,
        error: msg,
        ineligibilityReasons,
        eligibleDeliveries,
        ineligibleDeliveries,
        route,
        batch,
        vehicle,
        driver,
        totalPayloadKg,
        capacityKg,
        excessKg,
      };
    }
  } else {
    const msg = 'A valid driver must be assigned prior to dispatch.';
    ineligibilityReasons.push(msg);
    return {
      canDispatch: false,
      error: msg,
      ineligibilityReasons,
      eligibleDeliveries,
      ineligibleDeliveries,
      route,
      batch,
      vehicle,
      driver: null,
      totalPayloadKg,
      capacityKg,
      excessKg,
    };
  }

  // 7. Check partial dispatch policy
  if (!allowPartialEligible && ineligibleDeliveries.length > 0) {
    const msg = `Batch contains ${ineligibleDeliveries.length} ineligible deliveries.`;
    return {
      canDispatch: false,
      error: msg,
      ineligibilityReasons,
      eligibleDeliveries,
      ineligibleDeliveries,
      route,
      batch,
      vehicle,
      driver,
      totalPayloadKg,
      capacityKg,
      excessKg,
    };
  }

  return {
    canDispatch: true,
    error: null,
    ineligibilityReasons,
    eligibleDeliveries,
    ineligibleDeliveries,
    route,
    batch,
    vehicle,
    driver,
    totalPayloadKg,
    capacityKg,
    excessKg,
  };
}

/**
 * Calculates road network or straight-line distance metrics for an arbitrary delivery stop sequence
 * without requiring the optimization engine.
 * 
 * @param {Array<Object>} deliveries - Deliveries in their designated stop order
 * @param {Object} depot - Depot object or default canonical depot
 * @param {Object} vehicle - Assigned vehicle document
 * @param {Object} tariffs - Fuel tariff overrides
 * @returns {Promise<{
 *   stops: Array<Object>,
 *   metrics: Object,
 *   polylineCoords: Array<[number, number]>
 * }>}
 */
async function calculateStopSequenceMetrics(deliveries = [], depot = CANONICAL_DEPOT, vehicle = {}, tariffs = {}) {
  const depotGeo = (depot && depot.geo) || (CANONICAL_DEPOT && CANONICAL_DEPOT.geo) || { lat: 20.2961, lng: 85.8645 };

  if (!deliveries || deliveries.length === 0) {
    const defaultCost = scoreRouteCost(0, vehicle, tariffs);
    return {
      stops: [],
      metrics: {
        totalStops: 0,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        totalWeightKg: 0,
        costInr: defaultCost.costInr,
        co2Kg: defaultCost.co2Kg,
        fuelConsumed: defaultCost.fuelConsumed,
        fuelUnit: defaultCost.fuelUnit,
      },
      polylineCoords: [[depotGeo.lng, depotGeo.lat]],
    };
  }

  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let totalWeightKg = 0;

  // Try to use matrix builder for accurate travel times if possible
  let matrix = null;
  try {
    matrix = await buildMatrix(depot, deliveries, { trafficScenario: 'FREE_FLOW' });
  } catch (mErr) {
    // If matrix builder fails (e.g. offline/mocked), fallback to haversine math
  }

  const stops = [];
  const polylineCoords = [[depotGeo.lng, depotGeo.lat]];

  // Function to compute fallback haversine distance
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c * 1.3).toFixed(3)); // 1.3 road winding factor
  };

  let prevLat = depotGeo.lat;
  let prevLng = depotGeo.lng;

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    const coords = (d.location && d.location.coordinates) || [85.8645, 20.2961];
    const dLng = coords[0];
    const dLat = coords[1];

    let legDist = 0;
    let legDur = 0;

    if (matrix && matrix.getDistanceKm && matrix.points) {
      const idxPrev = i === 0 ? 0 : i;
      const idxCurr = i + 1;
      legDist = matrix.getDistanceKm(idxPrev, idxCurr);
      legDur = matrix.getDurationMin(idxPrev, idxCurr);
    } else {
      legDist = haversineKm(prevLat, prevLng, dLat, dLng);
      legDur = parseFloat(((legDist / 25) * 60).toFixed(1)); // 25 km/h urban speed
    }

    const serviceDuration = Number(d.serviceDurationMinutes) || 10;
    legDur += serviceDuration;

    totalDistanceKm += legDist;
    totalDurationMin += legDur;
    totalWeightKg += Number(d.weightKg) || 0;

    prevLat = dLat;
    prevLng = dLng;
    polylineCoords.push([dLng, dLat]);

    stops.push({
      sequence: i + 1,
      deliveryId: d._id,
      orderReference: d.orderReference || `ORD-${i + 1}`,
      customer: {
        name: (d.customer && d.customer.name) || 'Customer',
        phone: (d.customer && d.customer.phone) || '9999999999',
      },
      address: {
        street: (d.address && d.address.street) || 'Address',
        zone: (d.address && d.address.zone) || 'Rasulgarh',
        city: (d.address && d.address.city) || 'Bhubaneswar',
        postalCode: (d.address && d.address.postalCode) || '751010',
      },
      location: {
        lat: dLat,
        lng: dLng,
      },
      weightKg: Number(d.weightKg) || 0,
      priority: d.priority || 'STANDARD',
      timeWindow: {
        start: (d.timeWindow && d.timeWindow.start) || '09:00',
        end: (d.timeWindow && d.timeWindow.end) || '18:00',
      },
      distanceFromPrevKm: parseFloat(legDist.toFixed(2)),
      durationFromPrevMin: parseFloat(legDur.toFixed(1)),
      status: 'PENDING',
    });
  }

  // Return leg back to depot
  let returnDist = 0;
  let returnDur = 0;
  if (matrix && matrix.getDistanceKm && matrix.points) {
    returnDist = matrix.getDistanceKm(deliveries.length, 0);
    returnDur = matrix.getDurationMin(deliveries.length, 0);
  } else {
    returnDist = haversineKm(prevLat, prevLng, depotGeo.lat, depotGeo.lng);
    returnDur = parseFloat(((returnDist / 25) * 60).toFixed(1));
  }
  totalDistanceKm += returnDist;
  totalDurationMin += returnDur;
  polylineCoords.push([depotGeo.lng, depotGeo.lat]);

  totalDistanceKm = parseFloat(totalDistanceKm.toFixed(2));
  totalDurationMin = parseFloat(totalDurationMin.toFixed(1));
  totalWeightKg = parseFloat(totalWeightKg.toFixed(2));

  const costData = scoreRouteCost(totalDistanceKm, vehicle, tariffs);

  return {
    stops,
    metrics: {
      totalStops: stops.length,
      totalDistanceKm,
      totalDurationMin,
      totalWeightKg,
      costInr: costData.costInr,
      co2Kg: costData.co2Kg,
      fuelConsumed: costData.fuelConsumed,
      fuelUnit: costData.fuelUnit,
    },
    polylineCoords,
  };
}

/**
 * Creates or updates a Route record using the exact sequence provided, without
 * requiring the optimization engine.
 */
async function createOrUpdateRouteFromSequence({
  batch,
  deliveries,
  vehicle,
  driver,
  tariffs = {},
  isOptimized = false,
  algorithmUsed = 'ORIGINAL_MANIFEST',
}) {
  const depot = (batch && batch.depot) || CANONICAL_DEPOT;
  const { stops, metrics, polylineCoords } = await calculateStopSequenceMetrics(
    deliveries,
    depot,
    vehicle,
    tariffs
  );

  const routeCode = `RT-${(batch && batch.code) || 'UNASSIGNED'}-${Date.now().toString().slice(-4)}`;

  const routeDoc = new Route({
    routeCode,
    batchId: batch ? batch._id : null,
    vehicleId: vehicle._id,
    driverId: driver ? driver._id : null,
    status: isOptimized ? 'OPTIMIZED' : 'DRAFT',
    depot: {
      name: depot.name || CANONICAL_DEPOT.name,
      address: depot.address || CANONICAL_DEPOT.address,
      geo: {
        lat: depot.geo ? depot.geo.lat : CANONICAL_DEPOT.geo.lat,
        lng: depot.geo ? depot.geo.lng : CANONICAL_DEPOT.geo.lng,
      },
    },
    stops,
    metrics,
    baseline: {
      totalDistanceKm: metrics.totalDistanceKm,
      totalDurationMin: metrics.totalDurationMin,
      costInr: metrics.costInr,
      co2Kg: metrics.co2Kg,
    },
    deltas: {
      distanceSavedKm: 0.0,
      timeSavedMin: 0.0,
      costSavedInr: 0.0,
      co2AvoidedKg: 0.0,
      percentDistanceReduction: 0.0,
    },
    optimizationMetadata: {
      algorithm: algorithmUsed,
      maxIterations: 0,
      executedIterations: 0,
      trafficScenario: 'FREE_FLOW',
      matrixSource: 'GEOAPIFY_OR_FALLBACK',
      converged: true,
    },
    version: 1,
  });

  await routeDoc.save();
  return { route: routeDoc, polylineCoords };
}

module.exports = {
  validateDispatchEligibility,
  calculateStopSequenceMetrics,
  createOrUpdateRouteFromSequence,
};
