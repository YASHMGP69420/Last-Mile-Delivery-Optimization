const axios = require('axios');
const env = require('../../config/env');

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
  if (!apiKey) {
    throw new Error('Missing GEOAPIFY_SERVER_API_KEY');
  }
  const params = new URLSearchParams({
    apiKey,
    mode: options.mode || 'drive',
    origins: formatPoints(origins),
    destinations: formatPoints(destinations),
    units: 'metric',
  });
  const url = `${MATRIX_URL}?${params.toString()}`;
  const resp = await axios.get(url, { timeout: 8000 });
  if (resp.data && resp.data.status && resp.data.status !== 'OK') {
    throw new Error(`Geoapify matrix error: ${resp.data.status}`);
  }
  return resp.data; // contains distances, durations etc.
}

/** Retrieve full route geometry for ordered stops */
async function getRouteGeometry(stops, options = {}) {
  // stops: array of {lat, lng}
  const apiKey = env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_SERVER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEOAPIFY_SERVER_API_KEY');
  }
  if (!Array.isArray(stops) || stops.length < 2) {
    throw new Error('At least two stops required for routing');
  }
  const params = new URLSearchParams({
    apiKey,
    mode: options.mode || 'drive',
    "waypoints": formatPoints(stops),
    "units": 'metric',
  });
  const url = `${ROUTE_URL}?${params.toString()}`;
  const resp = await axios.get(url, { timeout: 10000 });
  if (!resp.data || resp.data.status !== 'OK') {
    throw new Error(`Geoapify routing error: ${resp.data?.status || 'unknown'}`);
  }
  // The response includes a "features" array with a LineString geometry.
  const geometry = resp.data.features?.[0]?.geometry?.coordinates || [];
  // Convert [lng, lat] to [lat, lng] for Leaflet
  const latLng = geometry.map(coord => [coord[1], coord[0]]);
  return { geometry: latLng, raw: resp.data };
}

module.exports = {
  getDistanceMatrix,
  getRouteGeometry,
  TILE_URL,
  AUTOCOMPLETE_URL,
  GEOCODE_URL,
};
