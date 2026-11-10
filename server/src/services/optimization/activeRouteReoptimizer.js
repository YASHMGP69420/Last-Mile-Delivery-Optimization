const TelemetryPing = require('../../models/TelemetryPing');
const Vehicle = require('../../models/Vehicle');
const OrganizationSettings = require('../../models/OrganizationSettings');
const socketService = require('../socketService');
const { recordAuditEvent } = require('../auditService');
const { AppError } = require('../../middleware/errorHandler');
const {
  AUDIT_EVENT_TYPES,
  CANONICAL_DEPOT,
  TRAFFIC_SCENARIOS,
} = require('../../config/constants');
const { roadDistance, calculateDuration } = require('../mapping/simulatedTrafficService');
const { buildMatrix } = require('./matrixBuilder');
const { runRouteOptimization } = require('./optimizerEngine');
const { constructNearestNeighborRoute } = require('./nearestNeighbor');
const { scoreRouteCost, calculateDeltas } = require('./costScorer');

const TERMINAL_ROUTE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const TERMINAL_STOP_STATUSES = new Set(['COMPLETED', 'FAILED']);
const VALID_TRAFFIC_SCENARIOS = new Set(Object.values(TRAFFIC_SCENARIOS));

function isFiniteCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseGeoCoord(coord) {
  if (!coord) return null;
  if (Array.isArray(coord) && coord.length >= 2) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    return isFiniteCoord(lat, lng) ? { lat, lng } : null;
  }
  const lat = Number(coord.lat ?? coord.latitude);
  const lng = Number(coord.lng ?? coord.longitude);
  return isFiniteCoord(lat, lng) ? { lat, lng } : null;
}

function formatEtaHHMM(baseDate, addMinutes) {
  const etaDate = new Date(baseDate.getTime() + Math.round(addMinutes) * 60000);
  const hours = String(etaDate.getHours()).padStart(2, '0');
  const mins = String(etaDate.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function toPlainStop(stop) {
  return typeof stop?.toObject === 'function' ? stop.toObject() : { ...stop };
}

/**
 * Resolves live anchor coordinates in strict priority order:
 * (a) Latest TelemetryPing for driverId or routeId
 * (b) Provided anchorCoordinates
 * (c) Last terminal stop location
 * (d) Route depot or canonical depot
 */
async function resolveAnchorCoordinates(route, anchorCoordinates, terminalStops) {
  const driverObjId = route.driverId?._id || route.driverId || null;
  const telemetryOr = [];
  if (driverObjId) telemetryOr.push({ driverId: driverObjId });
  if (route._id) telemetryOr.push({ routeId: route._id });

  if (telemetryOr.length > 0) {
    const latestPing = await TelemetryPing.findOne({ $or: telemetryOr })
      .sort({ timestamp: -1 })
      .lean();
    if (latestPing?.location?.coordinates) {
      const pingCoord = parseGeoCoord(latestPing.location.coordinates);
      if (pingCoord) {
        return pingCoord;
      }
    }
  }

  const providedCoord = parseGeoCoord(anchorCoordinates);
  if (providedCoord) {
    return providedCoord;
  }

  if (terminalStops.length > 0) {
    const lastTerminal = terminalStops[terminalStops.length - 1];
    const stopCoord = parseGeoCoord(lastTerminal?.location);
    if (stopCoord) {
      return stopCoord;
    }
  }

  const depotCoord = parseGeoCoord(route.depot?.geo) || parseGeoCoord(CANONICAL_DEPOT.geo);
  return depotCoord || { lat: 20.2961, lng: 85.8645 };
}

/**
 * Computes open-path + return-to-depot distance for a candidate pending stop index sequence.
 */
function measureOpenToDepotDistance(seq, matrix, depotGeo) {
  if (!seq || seq.length === 0) return { totalKm: 0, firstLegKm: 0 };
  const firstLegKm = matrix.getDistanceKm(0, seq[0]);
  let totalKm = firstLegKm;
  for (let i = 0; i < seq.length - 1; i++) {
    totalKm += matrix.getDistanceKm(seq[i], seq[i + 1]);
  }
  const lastPt = matrix.points[seq[seq.length - 1]];
  if (lastPt && depotGeo) {
    totalKm += roadDistance({ lat: lastPt.lat, lng: lastPt.lng }, depotGeo);
  }
  return { totalKm, firstLegKm };
}

/**
 * Re-optimizes pending stops of an active route in response to live traffic/incidents.
 * Terminal stops (COMPLETED, FAILED) remain locked in sequence at the front of route.stops.
 *
 * @param {Object} params
 * @param {Object} params.route - Route Mongoose document
 * @param {string} [params.trafficScenario=TRAFFIC_SCENARIOS.HEAVY_TRAFFIC]
 * @param {{lat: number, lng: number}|null} [params.anchorCoordinates=null]
 * @param {Object|null} [params.actor=null]
 * @param {string} [params.reason='Mid-shift traffic re-optimization']
 */
async function reoptimizeActiveRoute({
  route,
  trafficScenario = TRAFFIC_SCENARIOS.HEAVY_TRAFFIC,
  anchorCoordinates = null,
  actor = null,
  reason = 'Mid-shift traffic re-optimization',
} = {}) {
  if (!route) {
    throw new AppError('Route not found for mid-shift re-optimization', 404, 'ROUTE_NOT_FOUND');
  }

  if (TERMINAL_ROUTE_STATUSES.has(route.status)) {
    throw new AppError(
      `Cannot re-optimize route in '${route.status}' status`,
      400,
      'IMMUTABLE_ROUTE_STATUS'
    );
  }

  if (!VALID_TRAFFIC_SCENARIOS.has(trafficScenario)) {
    throw new AppError(
      `Invalid traffic scenario '${trafficScenario}'. Must be one of: ${Array.from(VALID_TRAFFIC_SCENARIOS).join(', ')}`,
      400,
      'INVALID_TRAFFIC_SCENARIO'
    );
  }

  const allStops = Array.isArray(route.stops) ? route.stops.map(toPlainStop) : [];
  const terminalStops = [];
  const pendingStops = [];

  for (const stop of allStops) {
    if (TERMINAL_STOP_STATUSES.has(stop.status)) {
      terminalStops.push(stop);
    } else {
      pendingStops.push(stop);
    }
  }

  if (pendingStops.length === 0) {
    return {
      reoptimized: false,
      skippedReason: 'NO_PENDING_STOPS',
      route,
      pendingStopsCount: 0,
    };
  }

  const anchor = await resolveAnchorCoordinates(route, anchorCoordinates, terminalStops);

  let vehicle = null;
  if (route.vehicleId && typeof route.vehicleId === 'object' && route.vehicleId.fuelType) {
    vehicle = route.vehicleId;
  } else if (route.vehicleId) {
    vehicle = await Vehicle.findById(route.vehicleId).lean();
  }

  let tariffs = {};
  try {
    const orgSettings = await OrganizationSettings.getSettings();
    if (orgSettings?.fuelSettings) {
      tariffs = typeof orgSettings.fuelSettings.toObject === 'function'
        ? orgSettings.fuelSettings.toObject()
        : orgSettings.fuelSettings;
    }
  } catch (err) {
    // Gracefully fallback to default costScorer tariffs
  }

  const depotGeo = parseGeoCoord(route.depot?.geo) || CANONICAL_DEPOT.geo;

  const matrix = await buildMatrix(
    { name: 'Live Anchor', geo: anchor },
    pendingStops.map((s) => ({
      _id: s.deliveryId,
      orderReference: s.orderReference,
      location: { lat: Number(s.location.lat), lng: Number(s.location.lng) },
    })),
    { trafficScenario }
  );

  let reorderedPending = [];
  let algorithmUsed = 'SINGLE_STOP_ETA_REFRESH';
  let executedIterations = 0;
  let converged = true;

  if (pendingStops.length >= 2) {
    const stopIndices = pendingStops.map((_, i) => i + 1);
    const optEngineRes = runRouteOptimization({
      depotIndex: 0,
      stopIndices,
      getDistanceKm: matrix.getDistanceKm,
      getDurationMin: matrix.getDurationMin,
      points: matrix.points,
      vehicle,
      options: { algorithm: 'AUTO', tariffs },
    });

    algorithmUsed = optEngineRes.algorithmUsed;
    executedIterations = optEngineRes.iterations || 0;
    converged = Boolean(optEngineRes.converged ?? true);

    // For open-ended mid-shift paths (Live Anchor -> pending stops -> Depot),
    // evaluate the optimizer sequence, its reverse orientation, and Nearest Neighbor
    // so closed-loop symmetry ties never override a closer first stop from live GPS.
    const nnRes = constructNearestNeighborRoute(
      0,
      stopIndices,
      matrix.getDistanceKm,
      matrix.getDurationMin,
      matrix.points
    );
    const candidates = [
      { seq: optEngineRes.optimized.stopSequence, algo: optEngineRes.algorithmUsed },
      { seq: [...optEngineRes.optimized.stopSequence].reverse(), algo: optEngineRes.algorithmUsed },
      { seq: nnRes.stopSequence, algo: 'NEAREST_NEIGHBOR' },
    ];

    let bestCandidate = candidates[0];
    let bestScore = measureOpenToDepotDistance(bestCandidate.seq, matrix, depotGeo);

    for (let i = 1; i < candidates.length; i++) {
      const score = measureOpenToDepotDistance(candidates[i].seq, matrix, depotGeo);
      const isStrictlyShorterTotal = score.totalKm < bestScore.totalKm - 0.001;
      const isTieWithCloserFirstLeg =
        Math.abs(score.totalKm - bestScore.totalKm) <= 0.001 &&
        score.firstLegKm < bestScore.firstLegKm - 0.001;
      if (isStrictlyShorterTotal || isTieWithCloserFirstLeg) {
        bestCandidate = candidates[i];
        bestScore = score;
      }
    }

    if (bestCandidate.algo === 'NEAREST_NEIGHBOR' && algorithmUsed === 'ORIGINAL_ORDER') {
      algorithmUsed = 'NEAREST_NEIGHBOR';
    }

    reorderedPending = bestCandidate.seq.map((ptIdx) => pendingStops[ptIdx - 1]);
  } else {
    reorderedPending = [pendingStops[0]];
  }

  // Recompute sequential leg distanceFromPrevKm, durationFromPrevMin, and HH:MM ETAs
  const now = new Date();
  let cumulativeElapsedMin = 0;
  let remainingLegDistanceKm = 0;
  let remainingLegDurationMin = 0;
  let prevCoord = anchor;

  const updatedPending = reorderedPending.map((stop, idx) => {
    const stopCoord = { lat: Number(stop.location.lat), lng: Number(stop.location.lng) };
    const legDistKm = parseFloat(roadDistance(prevCoord, stopCoord).toFixed(2));
    const { durationMinutes: legDurMin } = calculateDuration(legDistKm, trafficScenario);
    const roundedDurMin = parseFloat(legDurMin.toFixed(1));

    cumulativeElapsedMin += roundedDurMin;
    const eta = formatEtaHHMM(now, cumulativeElapsedMin);
    cumulativeElapsedMin += 10; // Standard 10 min service duration per stop

    remainingLegDistanceKm += legDistKm;
    remainingLegDurationMin += roundedDurMin + 10;
    prevCoord = stopCoord;

    return {
      sequence: terminalStops.length + idx + 1,
      deliveryId: stop.deliveryId,
      orderReference: stop.orderReference,
      customer: stop.customer,
      address: stop.address,
      location: stop.location,
      weightKg: stop.weightKg,
      priority: stop.priority,
      timeWindow: stop.timeWindow,
      eta,
      distanceFromPrevKm: legDistKm,
      durationFromPrevMin: roundedDurMin,
      status: stop.status,
    };
  });

  // Closing return-to-depot leg from final pending stop
  const returnDistKm = parseFloat(roadDistance(prevCoord, depotGeo).toFixed(2));
  const { durationMinutes: returnDurMin } = calculateDuration(returnDistKm, trafficScenario);

  const lockedTerminal = terminalStops.map((stop, idx) => ({
    sequence: idx + 1,
    deliveryId: stop.deliveryId,
    orderReference: stop.orderReference,
    customer: stop.customer,
    address: stop.address,
    location: stop.location,
    weightKg: stop.weightKg,
    priority: stop.priority,
    timeWindow: stop.timeWindow,
    eta: stop.eta ?? null,
    distanceFromPrevKm: Number(stop.distanceFromPrevKm) || 0,
    durationFromPrevMin: Number(stop.durationFromPrevMin) || 0,
    status: stop.status,
  }));

  const combinedStops = [...lockedTerminal, ...updatedPending];

  const completedDistanceKm = lockedTerminal.reduce(
    (sum, s) => sum + (Number(s.distanceFromPrevKm) || 0),
    0
  );
  const completedDurationMin = lockedTerminal.reduce(
    (sum, s) => sum + (Number(s.durationFromPrevMin) || 0),
    0
  );

  const totalDistanceKm = parseFloat(
    (completedDistanceKm + remainingLegDistanceKm + returnDistKm).toFixed(2)
  );
  const totalDurationMin = parseFloat(
    (completedDurationMin + remainingLegDurationMin + returnDurMin).toFixed(1)
  );
  const totalWeightKg = parseFloat(
    combinedStops.reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0).toFixed(2)
  );

  const costData = scoreRouteCost(totalDistanceKm, vehicle, tariffs);
  const newMetrics = {
    totalStops: combinedStops.length,
    totalDistanceKm,
    totalDurationMin,
    totalWeightKg,
    costInr: costData.costInr,
    co2Kg: costData.co2Kg,
    fuelConsumed: costData.fuelConsumed,
    fuelUnit: costData.fuelUnit,
  };

  const deltas = calculateDeltas(route.baseline || {}, newMetrics);

  route.stops = combinedStops;
  route.metrics = newMetrics;
  route.deltas = {
    distanceSavedKm: deltas.distanceSavedKm,
    timeSavedMin: deltas.timeSavedMin,
    costSavedInr: deltas.costSavedInr,
    co2AvoidedKg: deltas.co2AvoidedKg,
    percentDistanceReduction: deltas.percentDistanceReduction,
  };
  route.optimizationMetadata = {
    ...(route.optimizationMetadata?.toObject
      ? route.optimizationMetadata.toObject()
      : route.optimizationMetadata || {}),
    algorithm: algorithmUsed,
    executedIterations,
    trafficScenario,
    matrixSource: matrix.source,
    converged,
  };
  route.version = (route.version || 1) + 1;

  await route.save();

  const resolvedActorId = actor ? (actor.id || actor._id || null) : null;
  if (resolvedActorId) {
    await recordAuditEvent({
      routeId: route._id,
      batchId: route.batchId,
      type: AUDIT_EVENT_TYPES.ROUTE_OPTIMIZED,
      actorId: resolvedActorId,
      actorRole: actor.role || 'SYSTEM',
      action: `Mid-shift re-optimization for route ${route.routeCode} (${trafficScenario})`,
      metadata: {
        version: route.version,
        stopsCount: route.stops.length,
        pendingStopsCount: updatedPending.length,
        trafficScenario,
        algorithmUsed,
        anchor,
        reason,
      },
      isDemoData: Boolean(route.isDemoData),
    });
  }

  const driverId = route.driverId?._id
    ? route.driverId._id.toString()
    : route.driverId
      ? route.driverId.toString()
      : null;

  socketService.emitRouteReordered({
    routeId: route._id.toString(),
    routeCode: route.routeCode,
    driverId,
    version: route.version,
    stopsCount: route.stops.length,
    trafficScenario,
    reason,
    timestamp: new Date(),
  });

  return {
    reoptimized: true,
    route,
    version: route.version,
    pendingStopsCount: updatedPending.length,
    trafficScenario,
    anchor,
    stopSequence: route.stops.map((s) => s.deliveryId.toString()),
  };
}

module.exports = {
  reoptimizeActiveRoute,
};
