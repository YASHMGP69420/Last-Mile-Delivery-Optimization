const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
} = require('../../config/constants');
const matrixCache = require('./matrixCache');

/**
 * Normalizes input coordinates from various shapes:
 * - { lat, lng }
 * - { latitude, longitude }
 * - [lng, lat] (GeoJSON Point format)
 * @param {Object|Array} coord
 * @returns {{lat: number, lng: number}}
 */
function normalizeCoord(coord) {
  if (!coord) {
    throw new Error('Coordinate is null or undefined');
  }
  if (Array.isArray(coord) && coord.length >= 2) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error(`Invalid coordinate array: ${JSON.stringify(coord)}`);
    }
    return { lat, lng };
  }
  const lat = coord.lat !== undefined ? Number(coord.lat) : Number(coord.latitude);
  const lng = coord.lng !== undefined ? Number(coord.lng) : Number(coord.longitude);
  if (isNaN(lat) || isNaN(lng)) {
    throw new Error(`Invalid coordinate object: ${JSON.stringify(coord)}`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Coordinate values out of bounds: lat=${lat}, lng=${lng}`);
  }
  return { lat, lng };
}

/**
 * Exact Haversine formula calculation (Earth radius R = 6371 km).
 * @param {Object|Array} p1 - Origin
 * @param {Object|Array} p2 - Destination
 * @returns {number} Distance in kilometers
 */
function haversineDistance(p1, p2) {
  const c1 = normalizeCoord(p1);
  const c2 = normalizeCoord(p2);

  // Identical point fast-path
  if (c1.lat === c2.lat && c1.lng === c2.lng) {
    return 0.0;
  }

  const R = MAPPING_CONSTANTS.EARTH_RADIUS_KM || 6371.0;
  const toRad = Math.PI / 180;
  const dLat = (c2.lat - c1.lat) * toRad;
  const dLng = (c2.lng - c1.lng) * toRad;
  const lat1 = c1.lat * toRad;
  const lat2 = c2.lat * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  // Clamp floating-point inaccuracies
  const clampedA = Math.min(1.0, Math.max(0.0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return R * c;
}

/**
 * Calculates road network distance by applying the urban road curvature factor (1.35x).
 * @param {Object|Array} p1
 * @param {Object|Array} p2
 * @returns {number} Road distance in kilometers
 */
function roadDistance(p1, p2) {
  const hDist = haversineDistance(p1, p2);
  if (hDist === 0) return 0.0;
  const factor = MAPPING_CONSTANTS.URBAN_ROAD_CURVATURE_FACTOR || 1.35;
  return hDist * factor;
}

/**
 * Calculates travel duration for a given road distance and traffic scenario.
 * @param {number} distanceKm - Road distance in km
 * @param {string} scenario - Traffic scenario key
 * @returns {{ durationSeconds: number, durationMinutes: number }}
 */
function calculateDuration(distanceKm, scenario = TRAFFIC_SCENARIOS.FREE_FLOW) {
  if (distanceKm <= 0) {
    return { durationSeconds: 0, durationMinutes: 0.0 };
  }
  const multiplier = TRAFFIC_MULTIPLIERS[scenario] !== undefined
    ? TRAFFIC_MULTIPLIERS[scenario]
    : TRAFFIC_MULTIPLIERS.FREE_FLOW;

  const baseSpeedKmh = MAPPING_CONSTANTS.BHUBANESWAR_BASE_SPEED_KMH || 25.0;
  // duration in seconds = (distance / speed) * 3600 * multiplier
  const baseSeconds = (distanceKm / baseSpeedKmh) * 3600;
  const durationSeconds = Math.round(baseSeconds * multiplier);
  const durationMinutes = parseFloat((durationSeconds / 60).toFixed(2));

  return { durationSeconds, durationMinutes };
}

/**
 * Generates an N x M distance and duration matrix.
 * @param {Array<Object|Array>} origins
 * @param {Array<Object|Array>} destinations
 * @param {Object} options - { scenario, trafficScenario, skipCache }
 * @returns {Promise<Object>} MatrixResult
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('Origins must be a non-empty array');
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('Destinations must be a non-empty array');
  }

  const scenario = options.scenario || options.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!options.skipCache;

  const normOrigins = origins.map(normalizeCoord);
  const normDestinations = destinations.map(normalizeCoord);

  const matrix = [];
  const rows = [];

  for (let i = 0; i < normOrigins.length; i++) {
    const origin = normOrigins[i];
    const matrixRow = [];
    const elementRow = [];

    for (let j = 0; j < normDestinations.length; j++) {
      const destination = normDestinations[j];
      let cellData = null;

      if (!skipCache) {
        cellData = matrixCache.get(origin, destination, scenario);
      }

      if (!cellData) {
        const distKm = roadDistance(origin, destination);
        const distMeters = Math.round(distKm * 1000);
        const { durationSeconds, durationMinutes } = calculateDuration(distKm, scenario);

        cellData = {
          distanceMeters: distMeters,
          distanceKm: parseFloat(distKm.toFixed(3)),
          durationSeconds,
          durationMinutes,
          status: 'OK',
          source: 'SIMULATED',
        };

        if (!skipCache) {
          matrixCache.set(origin, destination, scenario, cellData);
        }
      }

      matrixRow.push(cellData);
      elementRow.push({
        distance: {
          text: `${cellData.distanceKm.toFixed(1)} km`,
          value: cellData.distanceMeters,
        },
        duration: {
          text: `${Math.ceil(cellData.durationMinutes)} mins`,
          value: cellData.durationSeconds,
        },
        status: cellData.status,
      });
    }

    matrix.push(matrixRow);
    rows.push({ elements: elementRow });
  }

  return {
    source: 'SIMULATED',
    scenario,
    origins: normOrigins,
    destinations: normDestinations,
    origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
    destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
    matrix,
    rows,
    status: 'OK',
  };
}

module.exports = {
  haversineDistance,
  roadDistance,
  calculateDuration,
  getDistanceMatrix,
  normalizeCoord,
};
