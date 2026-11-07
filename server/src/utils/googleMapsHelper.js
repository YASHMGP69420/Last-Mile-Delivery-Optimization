/**
 * Server-side Google Maps URL generator for external navigation.
 * Generates official Google Maps search and directions URLs without requiring an API key.
 * Reference: https://developers.google.com/maps/documentation/urls/get-started
 */

/**
 * Format coordinates as "lat,lng" string.
 * @param {number|Object|Array} coord
 * @returns {string}
 */
function formatLatLng(coord) {
  if (!coord) return '';
  if (Array.isArray(coord) && coord.length >= 2) {
    // Check if [lng, lat] (GeoJSON) or [lat, lng]
    const p1 = Number(coord[0]);
    const p2 = Number(coord[1]);
    if (p1 < 40 && p2 > 60) {
      // In India/Odisha: lat is ~20, lng is ~85
      return `${p1.toFixed(6)},${p2.toFixed(6)}`;
    }
    // GeoJSON [lng, lat] -> return lat,lng
    return `${p2.toFixed(6)},${p1.toFixed(6)}`;
  }
  const lat = coord.lat !== undefined ? Number(coord.lat) : Number(coord.latitude);
  const lng = coord.lng !== undefined ? Number(coord.lng) : Number(coord.longitude);
  if (isNaN(lat) || isNaN(lng)) return '';
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Build URL to open a single location pin in Google Maps.
 */
function buildLocationUrl(coord, queryLabel = '') {
  const latLngStr = formatLatLng(coord);
  if (!latLngStr) return '';
  const query = queryLabel ? `${encodeURIComponent(queryLabel)}+${latLngStr}` : latLngStr;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Build URL for direct directions between origin and destination.
 */
function buildDirectionsUrl(origin, destination) {
  const originStr = formatLatLng(origin);
  const destStr = formatLatLng(destination);
  if (!originStr || !destStr) return '';

  const params = new URLSearchParams({
    api: '1',
    origin: originStr,
    destination: destStr,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Build URL for a multi-stop route with origin, destination, and intermediate waypoints.
 * Google Maps supports up to 23 waypoints (origin + destination + 21 waypoints) in the URL.
 * When waypoints exceed 21, provides a primary segment URL and structured route segments.
 * 
 * @param {Array<Object|Array>} points - Array of coordinates [depot, stop1, stop2, ..., returnDepot]
 * @returns {{ primaryUrl: string, segments: Array<{ label: string, url: string, stopCount: number }> }}
 */
function buildMultiStopRouteUrl(points = []) {
  if (!points || points.length === 0) {
    return { primaryUrl: '', segments: [] };
  }

  const validPoints = points.map(formatLatLng).filter(Boolean);
  if (validPoints.length === 0) {
    return { primaryUrl: '', segments: [] };
  }

  if (validPoints.length === 1) {
    const url = `https://www.google.com/maps/search/?api=1&query=${validPoints[0]}`;
    return { primaryUrl: url, segments: [{ label: 'Single Stop', url, stopCount: 1 }] };
  }

  if (validPoints.length === 2) {
    const url = buildDirectionsUrl(validPoints[0], validPoints[1]);
    return { primaryUrl: url, segments: [{ label: 'Direct Route', url, stopCount: 2 }] };
  }

  // Maximum waypoints per Google Maps URL (excluding origin & destination)
  const MAX_WAYPOINTS = 20;

  // Single URL if fits within limits
  if (validPoints.length - 2 <= MAX_WAYPOINTS) {
    const origin = validPoints[0];
    const destination = validPoints[validPoints.length - 1];
    const waypoints = validPoints.slice(1, -1);

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving',
    });
    if (waypoints.length > 0) {
      params.set('waypoints', waypoints.join('|'));
    }
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    return {
      primaryUrl: url,
      segments: [{ label: 'Complete Route', url, stopCount: validPoints.length }],
    };
  }

  // Multi-segment partition for large routes
  const segments = [];
  let segIndex = 0;
  let startIdx = 0;

  while (startIdx < validPoints.length - 1) {
    const endIdx = Math.min(startIdx + MAX_WAYPOINTS + 1, validPoints.length - 1);
    const segOrigin = validPoints[startIdx];
    const segDest = validPoints[endIdx];
    const segWaypoints = validPoints.slice(startIdx + 1, endIdx);

    const params = new URLSearchParams({
      api: '1',
      origin: segOrigin,
      destination: segDest,
      travelmode: 'driving',
    });
    if (segWaypoints.length > 0) {
      params.set('waypoints', segWaypoints.join('|'));
    }
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    segIndex++;
    segments.push({
      label: `Route Leg ${segIndex} (Stops ${startIdx + 1} to ${endIdx + 1})`,
      url,
      stopCount: endIdx - startIdx + 1,
    });

    startIdx = endIdx;
  }

  return {
    primaryUrl: segments[0]?.url || '',
    segments,
  };
}

module.exports = {
  formatLatLng,
  buildLocationUrl,
  buildDirectionsUrl,
  buildMultiStopRouteUrl,
};
