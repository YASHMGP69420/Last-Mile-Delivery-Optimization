const googleMapsService = require('./googleMapsService');
const simulatedTrafficService = require('./simulatedTrafficService');
const matrixCache = require('./matrixCache');
const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
} = require('../../config/constants');

module.exports = {
  // Main Distance Matrix API
  getDistanceMatrix: googleMapsService.getDistanceMatrix,

  // Direct Simulated Distance & Duration Computations
  haversineDistance: simulatedTrafficService.haversineDistance,
  roadDistance: simulatedTrafficService.roadDistance,
  calculateDuration: simulatedTrafficService.calculateDuration,
  normalizeCoord: simulatedTrafficService.normalizeCoord,

  // Cache Operations
  clearCache: () => matrixCache.clear(),
  getCacheStats: () => matrixCache.getStats(),

  // Enums & Constants
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
};
