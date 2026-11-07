const { constructOriginalRoute } = require('./originalOrder');
const { constructNearestNeighborRoute } = require('./nearestNeighbor');
const { optimize2Opt, computeTourDistance, computeTourDuration } = require('./twoOpt');
const { optimizeOrOpt } = require('./orOpt');
const { scoreRouteCost, calculateDeltas } = require('./costScorer');

/**
 * Master Route Optimization Engine.
 * 
 * Takes a depot, a sequence of stop indices (in original manifest order),
 * distance and duration query functions, vehicle specs, and optimization options.
 * Evaluates candidate sequences, selects the best valid solution, and computes true deltas.
 * 
 * @param {Object} params
 * @param {number} params.depotIndex - Index 0
 * @param {number[]} params.stopIndices - Assigned delivery indices in original order
 * @param {Function} params.getDistanceKm - (i, j) => number (km)
 * @param {Function} params.getDurationMin - (i, j) => number (minutes)
 * @param {Array<Object>} params.points - Matrix metadata points
 * @param {Object} params.vehicle - Assigned vehicle
 * @param {Object} [params.options] - { algorithm, maxIterations, epsilon, tariffs, ... }
 * @returns {{
 *   baseline: Object,
 *   optimized: Object,
 *   deltas: Object,
 *   algorithmUsed: string,
 *   candidatesEvaluated: number,
 *   converged: boolean,
 *   iterations: number
 * }}
 */
function runRouteOptimization({
  depotIndex = 0,
  stopIndices = [],
  getDistanceKm,
  getDurationMin,
  points = [],
  vehicle,
  options = {},
}) {
  const tariffs = options.tariffs || {};
  const requestedAlgo = String(options.algorithm || options.strategy || 'AUTO').toUpperCase();

  // 1. Compute True Baseline: Original Input Sequence
  const baselineRoute = constructOriginalRoute(depotIndex, stopIndices, getDistanceKm, getDurationMin, points);
  const baselineCost = scoreRouteCost(baselineRoute.totalDistanceKm, vehicle, tariffs);
  const baselineMetrics = {
    totalDistanceKm: baselineRoute.totalDistanceKm,
    totalDurationMin: baselineRoute.totalDurationMin,
    costInr: baselineCost.costInr,
    fuelConsumed: baselineCost.fuelConsumed,
    fuelUnit: baselineCost.fuelUnit,
    co2Kg: baselineCost.co2Kg,
    stopsCount: baselineRoute.stopSequence.length,
  };

  if (!stopIndices || stopIndices.length === 0) {
    const deltas = calculateDeltas(baselineMetrics, baselineMetrics);
    return {
      baseline: { ...baselineRoute, metrics: baselineMetrics },
      optimized: { ...baselineRoute, metrics: baselineMetrics },
      deltas,
      algorithmUsed: 'ORIGINAL_ORDER',
      candidatesEvaluated: 1,
      converged: true,
      iterations: 0,
    };
  }

  // 2. Generate Candidate Solutions
  const candidates = [];

  // Candidate 0: Baseline (Original Order)
  candidates.push({
    name: 'ORIGINAL_ORDER',
    route: baselineRoute,
    cost: baselineCost,
    iterations: 0,
  });

  // Candidate 1: Nearest Neighbor
  if (['AUTO', 'NEAREST_NEIGHBOR', '2-OPT', '2-OPT_TSP_NN', 'OR-OPT', 'LOCAL_SEARCH'].includes(requestedAlgo)) {
    const nnRoute = constructNearestNeighborRoute(depotIndex, stopIndices, getDistanceKm, getDurationMin, points);
    const nnCost = scoreRouteCost(nnRoute.totalDistanceKm, vehicle, tariffs);
    candidates.push({
      name: 'NEAREST_NEIGHBOR',
      route: nnRoute,
      cost: nnCost,
      iterations: 1,
    });
  }

  // Candidate 2: 2-Opt initialized from Original Order
  if (['AUTO', '2-OPT', '2-OPT_TSP_NN', 'LOCAL_SEARCH'].includes(requestedAlgo)) {
    const twoOptFromOriginal = optimize2Opt(baselineRoute.tourIndices, getDistanceKm, getDurationMin, points, options);
    const cost2OptOrig = scoreRouteCost(twoOptFromOriginal.totalDistanceKm, vehicle, tariffs);
    candidates.push({
      name: '2-OPT_FROM_ORIGINAL',
      route: twoOptFromOriginal,
      cost: cost2OptOrig,
      iterations: twoOptFromOriginal.iterations,
    });
  }

  // Candidate 3: 2-Opt initialized from Nearest Neighbor
  let nnTourIndices = null;
  const nnCandidate = candidates.find(c => c.name === 'NEAREST_NEIGHBOR');
  if (nnCandidate) {
    nnTourIndices = nnCandidate.route.tourIndices;
  } else {
    const nnRoute = constructNearestNeighborRoute(depotIndex, stopIndices, getDistanceKm, getDurationMin, points);
    nnTourIndices = nnRoute.tourIndices;
  }

  if (['AUTO', '2-OPT', '2-OPT_TSP_NN', 'LOCAL_SEARCH'].includes(requestedAlgo)) {
    const twoOptFromNN = optimize2Opt(nnTourIndices, getDistanceKm, getDurationMin, points, options);
    const cost2OptNN = scoreRouteCost(twoOptFromNN.totalDistanceKm, vehicle, tariffs);
    candidates.push({
      name: '2-OPT_TSP_NN',
      route: twoOptFromNN,
      cost: cost2OptNN,
      iterations: twoOptFromNN.iterations,
    });
  }

  // Candidate 4: Or-Opt (Relocate search initialized from best 2-opt)
  if (['AUTO', 'OR-OPT', 'LOCAL_SEARCH'].includes(requestedAlgo)) {
    const best2OptCandidate = candidates
      .filter(c => c.name.startsWith('2-OPT') || c.name === 'NEAREST_NEIGHBOR')
      .sort((a, b) => a.route.totalDistanceKm - b.route.totalDistanceKm)[0];

    const seedTour = best2OptCandidate ? best2OptCandidate.route.tourIndices : baselineRoute.tourIndices;
    const orOptRes = optimizeOrOpt(seedTour, getDistanceKm, getDurationMin, points, options);
    const costOrOpt = scoreRouteCost(orOptRes.totalDistanceKm, vehicle, tariffs);
    candidates.push({
      name: 'OR-OPT_RELOCATE',
      route: orOptRes,
      cost: costOrOpt,
      iterations: orOptRes.iterations,
    });
  }

  // 3. Selection: Find Best Valid Solution
  // Filter by requested algorithm if strict single-algorithm requested
  let eligibleCandidates = candidates;
  if (requestedAlgo === 'NEAREST_NEIGHBOR') {
    eligibleCandidates = candidates.filter(c => c.name === 'NEAREST_NEIGHBOR' || c.name === 'ORIGINAL_ORDER');
  } else if (requestedAlgo === 'ORIGINAL') {
    eligibleCandidates = candidates.filter(c => c.name === 'ORIGINAL_ORDER');
  }

  // Sort by lowest distance, then lowest duration
  eligibleCandidates.sort((a, b) => {
    if (Math.abs(a.route.totalDistanceKm - b.route.totalDistanceKm) > 0.001) {
      return a.route.totalDistanceKm - b.route.totalDistanceKm;
    }
    return a.route.totalDurationMin - b.route.totalDurationMin;
  });

  const bestCandidate = eligibleCandidates[0];
  const optRoute = bestCandidate.route;
  const optCost = bestCandidate.cost;

  // Enforce invariant: Optimized distance can never exceed baseline distance
  let finalOptRoute = optRoute;
  let finalOptCost = optCost;
  let finalAlgoUsed = bestCandidate.name;
  let totalIterations = bestCandidate.iterations;

  if (optRoute.totalDistanceKm > baselineRoute.totalDistanceKm + 1e-4) {
    finalOptRoute = baselineRoute;
    finalOptCost = baselineCost;
    finalAlgoUsed = 'ORIGINAL_ORDER';
    totalIterations = 0;
  }

  const optMetrics = {
    totalDistanceKm: finalOptRoute.totalDistanceKm,
    totalDurationMin: finalOptRoute.totalDurationMin,
    costInr: finalOptCost.costInr,
    fuelConsumed: finalOptCost.fuelConsumed,
    fuelUnit: finalOptCost.fuelUnit,
    co2Kg: finalOptCost.co2Kg,
    stopsCount: finalOptRoute.stopSequence.length,
  };

  const deltas = calculateDeltas(baselineMetrics, optMetrics);

  return {
    baseline: {
      ...baselineRoute,
      metrics: baselineMetrics,
    },
    optimized: {
      ...finalOptRoute,
      metrics: optMetrics,
    },
    deltas,
    algorithmUsed: finalAlgoUsed,
    candidatesEvaluated: candidates.length,
    converged: Boolean(finalOptRoute.converged ?? true),
    iterations: totalIterations,
  };
}

module.exports = { runRouteOptimization };
