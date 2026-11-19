const mappingProviderFactory = require('./mappingProviderFactory');
const googleMapsService = require('./googleMapsService');
const simulatedTrafficService = require('./simulatedTrafficService');
const geoapifyService = require('./geoapify.service');
const matrixCache = require('./matrixCache');
const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
  CANONICAL_DEPOT,
} = require('../../config/constants');

module.exports = {
  // Main Distance Matrix API routed through MappingProviderFactory (D-03)
  getDistanceMatrix: (origins, destinations, options) =>
    mappingProviderFactory.getDistanceMatrix(origins, destinations, options),

  // Circuit Breaker Factory
  mappingProviderFactory,

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
  CANONICAL_DEPOT,

  // Providers & Helpers
  googleMapsService,
  simulatedTrafficService,
  geoapifyService,
};
