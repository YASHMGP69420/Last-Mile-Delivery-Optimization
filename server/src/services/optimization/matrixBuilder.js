const googleMapsService = require('../mapping/googleMapsService');
const { CANONICAL_DEPOT } = require('../../config/constants');
const { AppError } = require('../../middleware/errorHandler');

/**
 * Builds distance and duration matrices for depot + delivery stops.
 * 
 * @param {Object} depot - { name, address, geo: { lat, lng } }
 * @param {Array<Object>} deliveries - Array of Delivery Mongoose documents or plain objects
 * @param {Object} [options] - { trafficScenario: 'FREE_FLOW' | 'MORNING_RUSH' | ... }
 * @returns {Promise<{
 *   points: Array<{ id: string, type: 'DEPOT'|'DELIVERY', lat: number, lng: number, ref: string, delivery?: Object }>,
 *   distancesKm: number[][],
 *   durationsMin: number[][],
 *   trafficScenario: string,
 *   source: string,
 *   getDistanceKm: (i: number, j: number) => number,
 *   getDurationMin: (i: number, j: number) => number
 * }>}
 */
async function buildMatrix(depot, deliveries = [], options = {}) {
  let depotGeo = null;
  if (!depot) {
    depotGeo = CANONICAL_DEPOT && CANONICAL_DEPOT.geo;
  } else if (depot.geo) {
    depotGeo = depot.geo;
  } else if (depot.lat !== undefined && depot.lng !== undefined) {
    depotGeo = { lat: Number(depot.lat), lng: Number(depot.lng) };
  } else {
    depotGeo = null;
  }

  if (!depotGeo || typeof depotGeo.lat !== 'number' || typeof depotGeo.lng !== 'number' || isNaN(depotGeo.lat) || isNaN(depotGeo.lng)) {
    throw new AppError('Valid depot coordinates are required for matrix generation', 400, 'INVALID_DEPOT_COORDINATES');
  }

  const trafficScenario = options.trafficScenario || options.scenario || 'FREE_FLOW';

  // Index 0 is always depot
  const points = [
    {
      id: 'DEPOT',
      type: 'DEPOT',
      lat: depotGeo.lat,
      lng: depotGeo.lng,
      ref: (depot && depot.name) || CANONICAL_DEPOT.name || 'Rasulgarh Depot',
    },
  ];

  for (const delivery of deliveries) {
    let lat, lng;
    if (delivery.location && Array.isArray(delivery.location.coordinates) && delivery.location.coordinates.length >= 2) {
      // GeoJSON [longitude, latitude]
      lng = Number(delivery.location.coordinates[0]);
      lat = Number(delivery.location.coordinates[1]);
    } else if (delivery.lat !== undefined && delivery.lng !== undefined) {
      lat = Number(delivery.lat);
      lng = Number(delivery.lng);
    } else if (delivery.location && delivery.location.lat !== undefined && delivery.location.lng !== undefined) {
      lat = Number(delivery.location.lat);
      lng = Number(delivery.location.lng);
    }

    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError(
        `Delivery ${delivery.orderReference || delivery._id || delivery.id} has invalid or un-geocoded coordinates`,
        422,
        'UNRESOLVED_GEOCODE'
      );
    }

    points.push({
      id: (delivery._id || delivery.id || '').toString(),
      type: 'DELIVERY',
      lat,
      lng,
      ref: delivery.orderReference || delivery.id || (delivery._id ? delivery._id.toString() : ''),
      delivery,
    });
  }

  const origins = points.map(p => ({ lat: p.lat, lng: p.lng }));
  const destinations = origins;

  // Query mapping service (Google Maps facade with automatic simulated fallback)
  const matrixResult = await googleMapsService.getDistanceMatrix(origins, destinations, {
    scenario: trafficScenario,
    trafficScenario,
    forceSimulation: options.forceSimulation,
  });

  const numPoints = points.length;
  const distancesKm = Array.from({ length: numPoints }, () => new Array(numPoints).fill(0));
  const durationsMin = Array.from({ length: numPoints }, () => new Array(numPoints).fill(0));

  if (matrixResult && Array.isArray(matrixResult.rows)) {
    for (let i = 0; i < numPoints; i++) {
      const row = matrixResult.rows[i];
      if (!row || !Array.isArray(row.elements)) continue;
      for (let j = 0; j < numPoints; j++) {
        const elem = row.elements[j];
        if (i === j) {
          distancesKm[i][j] = 0.0;
          durationsMin[i][j] = 0.0;
        } else if (elem && (elem.status === 'OK' || elem.status === 'FALLBACK_SIMULATED')) {
          distancesKm[i][j] = parseFloat((elem.distance.value / 1000).toFixed(3));
          durationsMin[i][j] = parseFloat((elem.duration.value / 60).toFixed(2));
        } else {
          distancesKm[i][j] = 9999.0;
          durationsMin[i][j] = 9999.0;
        }
      }
    }
  }

  return {
    points,
    distancesKm,
    durationsMin,
    trafficScenario,
    source: matrixResult.source || 'SIMULATED',
    getDistanceKm: (i, j) => distancesKm[i][j],
    getDurationMin: (i, j) => durationsMin[i][j],
  };
}

module.exports = { buildMatrix };
