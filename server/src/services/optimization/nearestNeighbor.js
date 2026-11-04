const { PRIORITY_LEVELS } = require('../../config/constants');

const PRIORITY_SCORES = {
  [PRIORITY_LEVELS.COLD_CHAIN]: 3,
  [PRIORITY_LEVELS.URGENT]: 2,
  [PRIORITY_LEVELS.STANDARD]: 1,
};

/**
 * Builds an initial baseline route using the greedy Nearest Neighbor heuristic.
 * 
 * @param {number} depotIndex - Index of depot in matrix (always 0)
 * @param {Array<number>} stopIndices - Indices of assigned deliveries in the distance matrix
 * @param {Function} getDistance - (i, j) => number (distance in km)
 * @param {Function} getDuration - (i, j) => number (travel duration in minutes)
 * @param {Array<Object>} points - Metadata points array from matrixBuilder
 * @returns {{
 *   tourIndices: number[], // [0, s1, s2, ..., sm, 0]
 *   stopSequence: number[], // [s1, s2, ..., sm]
 *   totalDistanceKm: number,
 *   totalDurationMin: number
 * }}
 */
function constructNearestNeighborRoute(depotIndex = 0, stopIndices = [], getDistance, getDuration, points = []) {
  if (!stopIndices || stopIndices.length === 0) {
    return {
      tourIndices: [depotIndex, depotIndex],
      stopSequence: [],
      totalDistanceKm: 0.0,
      totalDurationMin: 0.0,
    };
  }

  const unvisited = new Set(stopIndices);
  const stopSequence = [];
  let current = depotIndex;

  while (unvisited.size > 0) {
    let nearestIndex = -1;
    let nearestDist = Infinity;
    let highestPriority = -1;

    for (const candidate of unvisited) {
      const d = getDistance(current, candidate);
      const pt = points[candidate];
      const prio = (pt && pt.delivery && PRIORITY_SCORES[pt.delivery.priority]) || 1;

      if (d < nearestDist - 1e-4) {
        nearestDist = d;
        nearestIndex = candidate;
        highestPriority = prio;
      } else if (Math.abs(d - nearestDist) <= 1e-4) {
        // Tie-breaker 1: Priority score
        if (prio > highestPriority) {
          nearestDist = d;
          nearestIndex = candidate;
          highestPriority = prio;
        } else if (prio === highestPriority) {
          // Tie-breaker 2: Deterministic index ordering
          if (nearestIndex === -1 || candidate < nearestIndex) {
            nearestIndex = candidate;
          }
        }
      }
    }

    stopSequence.push(nearestIndex);
    unvisited.delete(nearestIndex);
    current = nearestIndex;
  }

  // Complete closed loop: Depot -> Stops -> Depot
  const tourIndices = [depotIndex, ...stopSequence, depotIndex];

  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  for (let k = 0; k < tourIndices.length - 1; k++) {
    const from = tourIndices[k];
    const to = tourIndices[k + 1];
    totalDistanceKm += getDistance(from, to);
    totalDurationMin += getDuration(from, to);

    // Add service duration for delivery stop
    if (to !== depotIndex && points[to] && points[to].delivery) {
      totalDurationMin += (points[to].delivery.serviceDurationMinutes !== undefined
        ? points[to].delivery.serviceDurationMinutes
        : 10);
    }
  }

  return {
    tourIndices,
    stopSequence,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(3)),
    totalDurationMin: parseFloat(totalDurationMin.toFixed(2)),
  };
}

module.exports = { constructNearestNeighborRoute };
