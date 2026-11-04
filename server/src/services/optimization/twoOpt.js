/**
 * Bounded 2-Opt local search optimization.
 * 
 * @param {Array<number>} initialTour - [0, s1, s2, ..., sm, 0] including depot
 * @param {Function} getDistance - (i, j) => number (distance in km)
 * @param {Function} getDuration - (i, j) => number (travel duration in minutes)
 * @param {Array<Object>} points - Matrix points metadata
 * @param {Object} [options] - { maxIterations: 1000, epsilon: 0.001 }
 * @returns {{
 *   tourIndices: number[],
 *   stopSequence: number[],
 *   totalDistanceKm: number,
 *   totalDurationMin: number,
 *   iterations: number,
 *   converged: boolean
 * }}
 */
function optimize2Opt(initialTour = [], getDistance, getDuration, points = [], options = {}) {
  const maxIterations = options.maxIterations || 1000;
  const epsilon = options.epsilon || 0.001; // 1 meter threshold

  // Handle trivial routes (0 or 1 customer stops: length <= 3)
  if (!initialTour || initialTour.length <= 3) {
    const distance = computeTourDistance(initialTour || [], getDistance);
    const duration = computeTourDuration(initialTour || [], getDuration, points);
    return {
      tourIndices: initialTour ? [...initialTour] : [],
      stopSequence: initialTour && initialTour.length > 2 ? initialTour.slice(1, -1) : [],
      totalDistanceKm: parseFloat(distance.toFixed(3)),
      totalDurationMin: parseFloat(duration.toFixed(2)),
      iterations: 0,
      converged: true,
    };
  }

  const initialDistance = computeTourDistance(initialTour, getDistance);

  let tour = [...initialTour];
  const numNodes = tour.length;
  const maxStopIndex = numNodes - 2; // Last customer stop index in tour array

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < maxStopIndex; i++) {
      for (let k = i + 1; k <= maxStopIndex; k++) {
        const u1 = tour[i - 1];
        const v1 = tour[i];
        const u2 = tour[k];
        const v2 = tour[k + 1];

        // Evaluate delta: removing (u1, v1) and (u2, v2), adding (u1, u2) and (v1, v2)
        let delta = (getDistance(u1, u2) + getDistance(v1, v2)) - (getDistance(u1, v1) + getDistance(u2, v2));

        // Account for directed (asymmetric) edges inside reversed subsegment
        for (let j = i; j < k; j++) {
          delta += (getDistance(tour[j + 1], tour[j]) - getDistance(tour[j], tour[j + 1]));
        }

        // Strict cost improvement evaluation
        if (delta < -epsilon) {
          // Perform 2-opt swap: reverse subsegment tour[i...k]
          reverseSubtour(tour, i, k);
          improved = true;
          break; // First improvement strategy
        }
      }
      if (improved) break;
    }
  }

  let totalDistanceKm = computeTourDistance(tour, getDistance);

  // Invariant guarantee: total distance must never exceed initial baseline
  if (totalDistanceKm > initialDistance + 1e-6) {
    tour = [...initialTour];
    totalDistanceKm = initialDistance;
  }

  const totalDurationMin = computeTourDuration(tour, getDuration, points);

  return {
    tourIndices: tour,
    stopSequence: tour.slice(1, -1),
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(3)),
    totalDurationMin: parseFloat(totalDurationMin.toFixed(2)),
    iterations,
    converged: !improved,
  };
}

/** Reverse in-place slice between i and k inclusive */
function reverseSubtour(arr, i, k) {
  while (i < k) {
    const temp = arr[i];
    arr[i] = arr[k];
    arr[k] = temp;
    i++;
    k--;
  }
}

function computeTourDistance(tour, getDistance) {
  if (!tour || tour.length < 2) return 0;
  let dist = 0;
  for (let k = 0; k < tour.length - 1; k++) {
    dist += getDistance(tour[k], tour[k + 1]);
  }
  return dist;
}

function computeTourDuration(tour, getDuration, points) {
  if (!tour || tour.length < 2) return 0;
  let dur = 0;
  for (let k = 0; k < tour.length - 1; k++) {
    dur += getDuration(tour[k], tour[k + 1]);
    const stopNode = tour[k + 1];
    // Add service duration if valid delivery stop
    if (stopNode !== 0 && points && points[stopNode] && points[stopNode].delivery) {
      dur += (points[stopNode].delivery.serviceDurationMinutes !== undefined
        ? points[stopNode].delivery.serviceDurationMinutes
        : 10);
    }
  }
  return dur;
}

module.exports = {
  optimize2Opt,
  computeTourDistance,
  computeTourDuration,
};
