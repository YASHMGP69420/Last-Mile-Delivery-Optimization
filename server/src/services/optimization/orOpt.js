const { computeTourDistance, computeTourDuration } = require('./twoOpt');

/**
 * Or-Opt (Relocate / Block Insertion) local search heuristic.
 * Systematically tests moving blocks of length 3, 2, and 1 to all valid insertion points.
 * 
 * @param {Array<number>} initialTour - [0, s1, s2, ..., sm, 0]
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
function optimizeOrOpt(initialTour = [], getDistance, getDuration, points = [], options = {}) {
  const maxIterations = options.maxIterations || 500;
  const epsilon = options.epsilon || 0.001;

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

  let tour = [...initialTour];
  let improved = true;
  let iterations = 0;

  // Block sizes to relocate: 3, 2, 1
  const blockSizes = [3, 2, 1];

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (const blockSize of blockSizes) {
      const nStops = tour.length - 2; // Number of customer stops
      if (blockSize > nStops - 1) continue;

      for (let i = 1; i <= tour.length - 1 - blockSize; i++) {
        // Block to relocate: tour[i ... i + blockSize - 1]
        const block = tour.slice(i, i + blockSize);
        const prev = tour[i - 1];
        const next = tour[i + blockSize];

        // Cost reduction of removing the block
        // Remove: prev -> block[0], block[end] -> next; Add: prev -> next
        const costRemoved =
          getDistance(prev, block[0]) +
          getDistance(block[block.length - 1], next) -
          getDistance(prev, next);

        // Test inserting after each valid edge (j, j+1) outside the removed block
        for (let j = 0; j < tour.length - 1; j++) {
          if (j >= i - 1 && j <= i + blockSize - 1) {
            continue; // Cannot insert inside or immediately adjacent to removed block
          }

          const insPrev = tour[j];
          const insNext = tour[j + 1];

          // Cost addition of inserting the block between insPrev and insNext
          // Remove: insPrev -> insNext; Add: insPrev -> block[0], block[end] -> insNext
          const costAdded =
            getDistance(insPrev, block[0]) +
            getDistance(block[block.length - 1], insNext) -
            getDistance(insPrev, insNext);

          const netDelta = costAdded - costRemoved;

          if (netDelta < -epsilon) {
            // Reconstruct tour with block relocated
            const tourWithoutBlock = [...tour.slice(0, i), ...tour.slice(i + blockSize)];
            // Adjust insertion index if j was after the removed block
            const adjustedJ = j > i ? j - blockSize : j;

            tour = [
              ...tourWithoutBlock.slice(0, adjustedJ + 1),
              ...block,
              ...tourWithoutBlock.slice(adjustedJ + 1),
            ];

            improved = true;
            break;
          }
        }
        if (improved) break;
      }
      if (improved) break;
    }
  }

  const totalDistanceKm = computeTourDistance(tour, getDistance);
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

module.exports = { optimizeOrOpt };
