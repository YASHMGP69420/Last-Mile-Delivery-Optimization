// Utility to build Google Maps URLs for external navigation
// Supports opening a location, directions between two points, an optimized multi‑stop route, and next stop navigation.
// Reference: https://developers.google.com/maps/documentation/urls/get-started

export type LatLng = [number, number]; // [lat, lng]

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

/** Build URL for directions between origin and destination (driving mode) */
export function urlForDirections(origin: any, destination: any): string {
  const o = toLatLng(origin);
  const d = toLatLng(destination);
  if (!o || !d) return '';
  const params = new URLSearchParams({
    api: '1',
    origin: encodeLatLng(o),
    destination: encodeLatLng(d),
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Build URL for direct navigation to the next pending stop */
export function urlForNextStop(currentLocationOrDepot: any, nextStop: any): string {
  return urlForDirections(currentLocationOrDepot, nextStop);
}

export interface RouteSegmentLink {
  label: string;
  url: string;
  stopCount: number;
}

/** Build URLs for multi-stop routes with intelligent segment partitioning */
export function buildRouteSegments(stops: any[]): RouteSegmentLink[] {
  const validStops = stops.map(toLatLng).filter((s): s is LatLng => s !== null);
  if (validStops.length < 2) return [];

  const MAX_WAYPOINTS = 20;

  if (validStops.length - 2 <= MAX_WAYPOINTS) {
    const origin = validStops[0];
    const destination = validStops[validStops.length - 1];
    const waypoints = validStops.slice(1, -1);

    const params: Record<string, string> = {
      api: '1',
      origin: encodeLatLng(origin),
      destination: encodeLatLng(destination),
      travelmode: 'driving',
    };
    if (waypoints.length > 0) {
      params.waypoints = waypoints.map(encodeLatLng).join('|');
    }
    const query = new URLSearchParams(params).toString();
    return [{ label: 'Complete Route', url: `https://www.google.com/maps/dir/?${query}`, stopCount: validStops.length }];
  }

  // Segmenting for large routes > 22 points
  const segments: RouteSegmentLink[] = [];
  let startIdx = 0;
  let legIndex = 1;

  while (startIdx < validStops.length - 1) {
    const endIdx = Math.min(startIdx + MAX_WAYPOINTS + 1, validStops.length - 1);
    const segOrigin = validStops[startIdx];
    const segDest = validStops[endIdx];
    const segWaypoints = validStops.slice(startIdx + 1, endIdx);

    const params: Record<string, string> = {
      api: '1',
      origin: encodeLatLng(segOrigin),
      destination: encodeLatLng(segDest),
      travelmode: 'driving',
    };
    if (segWaypoints.length > 0) {
      params.waypoints = segWaypoints.map(encodeLatLng).join('|');
    }
    const query = new URLSearchParams(params).toString();
    segments.push({
      label: `Route Leg ${legIndex} (Stops ${startIdx + 1}–${endIdx + 1})`,
      url: `https://www.google.com/maps/dir/?${query}`,
      stopCount: endIdx - startIdx + 1,
    });

    startIdx = endIdx;
    legIndex++;
  }

  return segments;
}

/** Build URL for an optimized multi‑stop route */
export function urlForMultiStopRoute(stops: any[]): string {
  const segments = buildRouteSegments(stops);
  return segments.length > 0 ? segments[0].url : '';
}
