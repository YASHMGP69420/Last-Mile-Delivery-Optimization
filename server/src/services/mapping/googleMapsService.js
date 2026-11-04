const axios = require('axios');
const matrixCache = require('./matrixCache');
const simulatedTrafficService = require('./simulatedTrafficService');
const { MAPPING_CONSTANTS, TRAFFIC_SCENARIOS } = require('../../config/constants');
const env = require('../../config/env');

const GOOGLE_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

/**
 * Builds Google Distance Matrix request URL.
 */
function buildUrl(origins, destinations, key) {
  const format = pts => pts.map(p => `${p.lat},${p.lng}`).join('|');
  const params = new URLSearchParams({
    origins: format(origins),
    destinations: format(destinations),
    key,
    units: 'metric',
  });
  return `${GOOGLE_API_URL}?${params.toString()}`;
}

/**
 * Sleeps for ms (used in retry backoff).
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Dispatches a single Google Distance Matrix API call with timeout and retries.
 */
async function fetchGoogleMatrixChunk(origins, destinations, apiKey, retries = MAPPING_CONSTANTS.GOOGLE_MAPS_MAX_RETRIES) {
  const url = buildUrl(origins, destinations, apiKey);
  let attempt = 0;
  let lastError = null;

  const timeoutMs = (env && env.GOOGLE_MAPS_TIMEOUT_MS) || MAPPING_CONSTANTS.GOOGLE_MAPS_TIMEOUT_MS || 5000;

  while (attempt <= retries) {
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
      });

      const data = response.data;
      if (data.status === 'OK') {
        return data;
      }

      // Check for unrecoverable quota / key errors -> immediately fail to fallback
      if (['OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT', 'REQUEST_DENIED'].includes(data.status)) {
        const err = new Error(`Google Maps API Quota/Auth Error: ${data.status}`);
        err.isQuotaError = true;
        err.code = data.status;
        throw err;
      }

      throw new Error(`Google Maps API error status: ${data.status}`);
    } catch (err) {
      lastError = err;
      if (err.isQuotaError) throw err; // Don't retry quota errors
      attempt++;
      if (attempt <= retries) {
        await sleep(attempt * 250);
      }
    }
  }

  throw lastError;
}

/**
 * Retrieves Distance Matrix with dual-mode fallback and caching.
 * @param {Array} origins
 * @param {Array} destinations
 * @param {Object} options - { scenario, trafficScenario, forceSimulation, skipCache }
 * @returns {Promise<Object>}
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('Origins must be a non-empty array');
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('Destinations must be a non-empty array');
  }

  const opts = options || {};
  const scenario = opts.scenario || opts.trafficScenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!opts.skipCache;
  const forceSimulation = !!opts.forceSimulation;

  const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
  const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);

  // 1. If forceSimulation or API key missing -> transparent simulation fallback
  const apiKey = (env && env.GOOGLE_MAPS_API_KEY) || process.env.GOOGLE_MAPS_API_KEY;
  if (forceSimulation || !apiKey || apiKey.trim() === '' || apiKey === 'mock_key') {
    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);
  }

  // 2. Cache evaluation: check if ALL pairs are already in cache
  if (!skipCache) {
    let allCached = true;
    const cachedMatrix = [];
    const cachedRows = [];

    for (let i = 0; i < normOrigins.length; i++) {
      const matrixRow = [];
      const elementRow = [];
      for (let j = 0; j < normDestinations.length; j++) {
        const hit = matrixCache.get(normOrigins[i], normDestinations[j], scenario);
        if (!hit) {
          allCached = false;
          break;
        }
        matrixRow.push(hit);
        elementRow.push({
          distance: { text: `${hit.distanceKm.toFixed(1)} km`, value: hit.distanceMeters },
          duration: { text: `${Math.ceil(hit.durationMinutes)} mins`, value: hit.durationSeconds },
          status: hit.status,
        });
      }
      if (!allCached) break;
      cachedMatrix.push(matrixRow);
      cachedRows.push({ elements: elementRow });
    }

    if (allCached) {
      return {
        source: 'CACHE',
        scenario,
        origins: normOrigins,
        destinations: normDestinations,
        origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
        destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
        matrix: cachedMatrix,
        rows: cachedRows,
        status: 'OK',
      };
    }
  }

  // 3. Query Google Distance Matrix with chunking if total elements > 100
  try {
    const originChunkSize = 10;
    const destChunkSize = 10;
    const fullMatrix = Array.from({ length: normOrigins.length }, () => new Array(normDestinations.length));
    const fullRows = Array.from({ length: normOrigins.length }, () => ({ elements: new Array(normDestinations.length) }));

    for (let i = 0; i < normOrigins.length; i += originChunkSize) {
      const originSub = normOrigins.slice(i, i + originChunkSize);
      for (let j = 0; j < normDestinations.length; j += destChunkSize) {
        const destSub = normDestinations.slice(j, j + destChunkSize);

        const chunkResult = await fetchGoogleMatrixChunk(originSub, destSub, apiKey);

        // Process chunk rows
        for (let rowIdx = 0; rowIdx < chunkResult.rows.length; rowIdx++) {
          const globalRow = i + rowIdx;
          const elements = chunkResult.rows[rowIdx].elements;

          for (let colIdx = 0; colIdx < elements.length; colIdx++) {
            const globalCol = j + colIdx;
            const el = elements[colIdx];
            const originCoord = normOrigins[globalRow];
            const destCoord = normDestinations[globalCol];

            let cellData;
            if (el.status === 'OK') {
              cellData = {
                distanceMeters: el.distance.value,
                distanceKm: parseFloat((el.distance.value / 1000).toFixed(3)),
                durationSeconds: el.duration.value,
                durationMinutes: parseFloat((el.duration.value / 60).toFixed(2)),
                status: 'OK',
                source: 'GOOGLE_MAPS',
              };
            } else {
              // Granular element fallback for ZERO_RESULTS or NOT_FOUND
              const simDistKm = simulatedTrafficService.roadDistance(originCoord, destCoord);
              const simDuration = simulatedTrafficService.calculateDuration(simDistKm, scenario);
              cellData = {
                distanceMeters: Math.round(simDistKm * 1000),
                distanceKm: parseFloat(simDistKm.toFixed(3)),
                durationSeconds: simDuration.durationSeconds,
                durationMinutes: simDuration.durationMinutes,
                status: 'FALLBACK_SIMULATED',
                source: 'SIMULATED',
              };
            }

            if (!skipCache) {
              matrixCache.set(originCoord, destCoord, scenario, cellData);
            }

            fullMatrix[globalRow][globalCol] = cellData;
            fullRows[globalRow].elements[globalCol] = {
              distance: { text: `${cellData.distanceKm.toFixed(1)} km`, value: cellData.distanceMeters },
              duration: { text: `${Math.ceil(cellData.durationMinutes)} mins`, value: cellData.durationSeconds },
              status: cellData.status,
            };
          }
        }
      }
    }

    return {
      source: 'GOOGLE_MAPS',
      scenario,
      origins: normOrigins,
      destinations: normDestinations,
      origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
      destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
      matrix: fullMatrix,
      rows: fullRows,
      status: 'OK',
    };
  } catch (err) {
    console.warn(`[GoogleMapsService] Network/Quota Error (${err.message}). Falling back to simulated traffic service.`);
    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, opts);
  }
}

module.exports = {
  getDistanceMatrix,
  buildUrl,
  fetchGoogleMatrixChunk,
};
