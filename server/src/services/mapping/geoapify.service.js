const axios = require('axios');
const env = require('../../config/env');
const simulatedTrafficService = require('./simulatedTrafficService');

// Geoapify endpoints
const TILE_URL = 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png';
const AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search';
const MATRIX_URL = 'https://api.geoapify.com/v1/routing/matrix';
const ROUTE_URL = 'https://api.geoapify.com/v1/routing';

/** Helper to format points for Geoapify */
function formatPoints(points) {
  // points: [{lat, lng}] -> "lat,lng|lat,lng"
  return points.map(p => `${p.lat},${p.lng}`).join('|');
}

/** Retrieve distance matrix between origins and destinations */
async function getDistanceMatrix(origins, destinations, options = {}) {
  const apiKey = env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_SERVER_API_KEY;
  const isPlaceholderKey = !apiKey || apiKey === 'YOUR_GEOAPIFY_SERVER_KEY';

  if (!isPlaceholderKey && !options.forceSimulation) {
    try {
      const params = new URLSearchParams({
        apiKey,
        mode: options.mode || 'drive',
        origins: formatPoints(origins),
        destinations: formatPoints(destinations),
        units: 'metric',
      });
      const url = `${MATRIX_URL}?${params.toString()}`;
      const resp = await axios.get(url, { timeout: 8000 });

      if (resp.data && resp.data.sources_to_targets) {
        // Convert Geoapify sources_to_targets to standardized matrix rows format
        const rows = resp.data.sources_to_targets.map((row) => ({
          elements: row.map((elem) => ({
            status: elem.distance !== null && elem.distance !== undefined ? 'OK' : 'ZERO_RESULTS',
            distance: { value: elem.distance || 0, text: `${((elem.distance || 0) / 1000).toFixed(1)} km` },
            duration: { value: elem.time || 0, text: `${Math.ceil((elem.time || 0) / 60)} mins` },
          })),
        }));

        return {
          source: 'GEOAPIFY',
          rows,
          status: 'OK',
          raw: resp.data,
        };
      } else if (resp.data && resp.data.rows) {
        return resp.data;
      }
    } catch (err) {
      // Geoapify failed (quota, 401, timeout, network error) -> Fall back to deterministic simulated matrix
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Geoapify] Distance matrix request failed (${err.message}). Using simulated Bhubaneswar traffic matrix.`);
      }
    }
  }

  // Robust simulated fallback matching Bhubaneswar traffic physics
  return simulatedTrafficService.getDistanceMatrix(origins, destinations, options);
}

/** Retrieve full route geometry for ordered stops */
async function getRouteGeometry(stops, options = {}) {
  const apiKey = env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_SERVER_API_KEY;
  const isPlaceholderKey = !apiKey || apiKey === 'YOUR_GEOAPIFY_SERVER_KEY';

  if (!isPlaceholderKey && Array.isArray(stops) && stops.length >= 2) {
    try {
      const params = new URLSearchParams({
        apiKey,
        mode: options.mode || 'drive',
        waypoints: formatPoints(stops),
        units: 'metric',
      });
      const url = `${ROUTE_URL}?${params.toString()}`;
      const resp = await axios.get(url, { timeout: 10000 });

      if (resp.data && resp.data.features?.[0]?.geometry?.coordinates) {
        const geometry = resp.data.features[0].geometry.coordinates;
        // Convert [lng, lat] to [lat, lng] for Leaflet
        const latLng = geometry.map(coord => [coord[1], coord[0]]);
        return { geometry: latLng, raw: resp.data, source: 'GEOAPIFY' };
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Geoapify] Routing geometry failed (${err.message}). Falling back to point-to-point connections.`);
      }
    }
  }

  // Fallback geometry connecting stop coordinates sequentially
  const fallbackGeometry = stops.map(s => [s.lat, s.lng]);
  return { geometry: fallbackGeometry, raw: null, source: 'SIMULATED' };
}

module.exports = {
  getDistanceMatrix,
  getRouteGeometry,
  TILE_URL,
  AUTOCOMPLETE_URL,
  GEOCODE_URL,
};
