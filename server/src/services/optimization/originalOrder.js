const { computeTourDistance, computeTourDuration } = require('./twoOpt');

/**
 * Builds the unoptimized baseline route using the original input delivery order.
 * Depot (0) -> s_1 -> s_2 -> ... -> s_m -> Depot (0)
 * 
 * @param {number} depotIndex - Index of depot in matrix (always 0)
 * @param {Array<number>} stopIndices - Indices of assigned deliveries in the original manifest order
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
function constructOriginalRoute(depotIndex = 0, stopIndices = [], getDistance, getDuration, points = []) {
  if (!stopIndices || stopIndices.length === 0) {
    return {
      tourIndices: [depotIndex, depotIndex],
      stopSequence: [],
      totalDistanceKm: 0.0,
      totalDurationMin: 0.0,
    };
  }

  const stopSequence = [...stopIndices];
  const tourIndices = [depotIndex, ...stopSequence, depotIndex];

  const totalDistanceKm = computeTourDistance(tourIndices, getDistance);
  const totalDurationMin = computeTourDuration(tourIndices, getDuration, points);

  return {
    tourIndices,
    stopSequence,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(3)),
    totalDurationMin: parseFloat(totalDurationMin.toFixed(2)),
  };
}

module.exports = { constructOriginalRoute };
