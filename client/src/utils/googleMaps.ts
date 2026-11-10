// Utility to build Google Maps URLs for external navigation.
// Leaves `origin` unset unless explicitly provided so Google Maps prompts for and uses the user's live current location.
// Reference: https://developers.google.com/maps/documentation/urls/get-started

export type LatLng = [number, number]; // [lat, lng]

let cachedDeviceLocation: LatLng | null = null;
let lastLocationTimestamp = 0;

/** Set or update the cached device location (optional helper if a caller tracks GPS explicitly) */
export function setCachedDeviceLocation(coords: LatLng | [number, number]) {
  if (!coords || isNaN(Number(coords[0])) || isNaN(Number(coords[1]))) return;
  cachedDeviceLocation = [Number(coords[0]), Number(coords[1])];
  lastLocationTimestamp = Date.now();
}

/** Retrieve explicitly cached device coordinates if set in memory */
export function getDeviceLocationSync(): LatLng | null {
  return cachedDeviceLocation;
}

/** No-op: leave live location permission & origin resolution directly to Google Maps */
export function initDeviceLocationTracking() {
  // Intentionally left to Google Maps by omitting `origin` in direction URLs.
}

/** Normalize diverse coordinate shapes to [lat, lng] */
export function toLatLng(coord: any): LatLng | null {
  if (!coord) return null;
  if (Array.isArray(coord) && coord.length >= 2) {
    const [c1, c2] = coord.map(Number);
    if (isNaN(c1) || isNaN(c2)) return null;
    // Heuristic: in India (Bhubaneswar ~20N, ~85E):
    if (c1 < 40 && c2 > 60) return [c1, c2]; // already [lat, lng]
    if (c1 > 60 && c2 < 40) return [c2, c1]; // [lng, lat] -> convert to [lat, lng]
    return [c2, c1]; // standard GeoJSON [lng, lat]
  }
  if (coord.coordinates && Array.isArray(coord.coordinates)) {
    return toLatLng(coord.coordinates);
  }
  const lat = coord.lat !== undefined ? Number(coord.lat) : Number(coord.latitude);
  const lng = coord.lng !== undefined ? Number(coord.lng) : Number(coord.longitude);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

/** Encode a LatLng array into the "lat,lng" string used by the URL */
export function encodeLatLng([lat, lng]: LatLng): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Build URL to open a single location pin */
export function urlForLocation(coord: any, label?: string): string {
  const norm = toLatLng(coord);
  if (!norm) return '';
  const latLngStr = encodeLatLng(norm);
  const query = label ? `${encodeURIComponent(label)}+${latLngStr}` : latLngStr;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export interface NavigationOptions {
  destination: any;
  waypoints?: any[];
  origin?: any;
  travelmode?: string;
}

/** Build URL for driving navigation; leaves `origin` unset unless explicitly passed so Google Maps uses the user's live location */
export function buildNavigationUrl(opts: NavigationOptions): string {
  const { destination, waypoints = [], travelmode = 'driving' } = opts;

  // 1. Resolve Origin only if explicitly supplied; omitting `origin` lets Google Maps prompt/use live device GPS
  let originStr = '';
  if (opts.origin) {
    const normOrigin = toLatLng(opts.origin);
    originStr = normOrigin ? encodeLatLng(normOrigin) : String(opts.origin);
  }

  // 2. Resolve Destination
  let destStr = '';
  const normDest = toLatLng(destination);
  if (normDest) {
    destStr = encodeLatLng(normDest);
  } else if (typeof destination === 'string') {
    destStr = encodeURIComponent(destination);
  } else if (destination?.address) {
    const street = destination.address.street || '';
    const zone = destination.address.zone || '';
    destStr = encodeURIComponent(`${street}${zone ? `, ${zone}` : ''}, Bhubaneswar`);
  }

  if (!destStr) return '';

  const paramsObj: Record<string, string> = {
    api: '1',
    destination: destStr,
    travelmode,
  };
  if (originStr) {
    paramsObj.origin = originStr;
  }

  const params = new URLSearchParams(paramsObj);

  // 3. Resolve Waypoints
  if (waypoints.length > 0) {
    const validWaypoints = waypoints
      .map(toLatLng)
      .filter((w): w is LatLng => w !== null)
      .map(encodeLatLng);
    if (validWaypoints.length > 0) {
      params.set('waypoints', validWaypoints.join('|'));
    }
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Build URL for directions between origin and destination (driving mode) */
export function urlForDirections(origin: any, destination: any): string {
  return buildNavigationUrl({ origin, destination });
}

/** Build URL for direct navigation to the next pending stop using Google Maps live location */
export function urlForNextStop(_currentLocationOrDepot: any, nextStop: any): string {
  return buildNavigationUrl({ destination: nextStop });
}

export interface RouteSegmentLink {
  label: string;
  url: string;
  stopCount: number;
}

/** Strips hardcoded/static `origin` from any Google Maps directions URL so Google Maps asks for/uses live current location */
export function injectDeviceLocationIntoUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (url.pathname.includes('/maps/dir')) {
      url.searchParams.delete('origin');
      return url.toString();
    }
  } catch (e) {
    // Fallback if URL parsing fails
    return rawUrl.replace(/([?&])origin=[^&]*&?/, (_m, sep) => sep).replace(/[?&]$/, '');
  }
  return rawUrl;
}

/** Build URLs for multi-stop routes with intelligent segment partitioning leaving starting origin to Google Maps */
export function buildRouteSegments(stops: any[], customOrigin?: any): RouteSegmentLink[] {
  const validStops = stops.map(toLatLng).filter((s): s is LatLng => s !== null);
  if (validStops.length === 0) return [];

  // Determine explicit starting origin only when caller explicitly supplies one
  let originStr = '';
  if (customOrigin) {
    const norm = toLatLng(customOrigin);
    if (norm) originStr = encodeLatLng(norm);
  }

  const MAX_WAYPOINTS = 20;

  // Single URL if fits within limits
  if (validStops.length <= MAX_WAYPOINTS + 1) {
    const destination = validStops[validStops.length - 1];
    const waypoints = validStops.slice(0, -1);

    const params: Record<string, string> = {
      api: '1',
      destination: encodeLatLng(destination),
      travelmode: 'driving',
    };
    if (originStr) {
      params.origin = originStr;
    }
    if (waypoints.length > 0) {
      params.waypoints = waypoints.map(encodeLatLng).join('|');
    }
    const query = new URLSearchParams(params).toString();
    return [{ label: 'Complete Route', url: `https://www.google.com/maps/dir/?${query}`, stopCount: validStops.length }];
  }

  // Segmenting for large routes > 21 points
  const segments: RouteSegmentLink[] = [];
  let startIdx = 0;
  let legIndex = 1;

  while (startIdx < validStops.length) {
    const endIdx = Math.min(startIdx + MAX_WAYPOINTS, validStops.length - 1);
    const segOrigin = legIndex === 1 ? originStr : encodeLatLng(validStops[startIdx]);
    const segDest = encodeLatLng(validStops[endIdx]);
    const segWaypoints = legIndex === 1
      ? validStops.slice(0, endIdx).map(encodeLatLng)
      : validStops.slice(startIdx + 1, endIdx).map(encodeLatLng);

    const params: Record<string, string> = {
      api: '1',
      destination: segDest,
      travelmode: 'driving',
    };
    if (segOrigin) {
      params.origin = segOrigin;
    }
    if (segWaypoints.length > 0) {
      params.waypoints = segWaypoints.join('|');
    }
    const query = new URLSearchParams(params).toString();
    segments.push({
      label: `Route Leg ${legIndex} (Stops ${startIdx + 1}–${endIdx + 1})`,
      url: `https://www.google.com/maps/dir/?${query}`,
      stopCount: endIdx - startIdx + 1,
    });

    if (endIdx >= validStops.length - 1) break;
    startIdx = endIdx;
    legIndex++;
  }

  return segments;
}

/** Build URL for an optimized multi‑stop route */
export function urlForMultiStopRoute(stops: any[], customOrigin?: any): string {
  const segments = buildRouteSegments(stops, customOrigin);
  return segments.length > 0 ? segments[0].url : '';
}

/** Safely open navigation in a new tab starting from the device's current location */
export function openGoogleMapsNavigation(opts: { destination?: any; waypoints?: any[]; directUrl?: string }) {
  if (typeof window === 'undefined') return;
  let targetUrl = '';
  if (opts.directUrl) {
    targetUrl = injectDeviceLocationIntoUrl(opts.directUrl);
  } else if (opts.destination) {
    targetUrl = buildNavigationUrl({ destination: opts.destination, waypoints: opts.waypoints });
  }
  if (targetUrl) {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
  return targetUrl;
}
