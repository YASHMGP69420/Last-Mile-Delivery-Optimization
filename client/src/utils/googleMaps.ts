// Utility to build Google Maps URLs for external navigation
// Supports opening a location, directions between two points, and an optimized multi‑stop route.
// Reference: https://developers.google.com/maps/documentation/urls/get-started

export type LatLng = [number, number]; // [lat, lng]

/** Encode a LatLng array into the "lat,lng" string used by the URL */
function encodeLatLng([lat, lng]: LatLng): string {
  return `${lat},${lng}`;
}

/** Build URL to open a single location */
export function urlForLocation(coord: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeLatLng(coord)}`;
}

/** Build URL for directions between origin and destination (driving mode) */
export function urlForDirections(origin: LatLng, destination: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: encodeLatLng(origin),
    destination: encodeLatLng(destination),
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Build URL for an optimized multi‑stop route.
 *  The first stop is used as origin, the last as destination, intermediate stops become waypoints.
 *  Google Maps limits the number of waypoints to 23 (including origin & destination). This function truncates excess.
 */
export function urlForMultiStopRoute(stops: LatLng[]): string {
  if (stops.length === 0) return '';
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1);
  const params: Record<string, string> = {
    api: '1',
    origin: encodeLatLng(origin),
    destination: encodeLatLng(destination),
    travelmode: 'driving',
  };
  if (waypoints.length > 0) {
    // Google allows up to 23 waypoints (including origin/destination). Truncate if needed.
    const limited = waypoints.slice(0, 21); // 21 + origin + destination = 23
    params.waypoints = limited.map(encodeLatLng).join('|');
  }
  const query = new URLSearchParams(params).toString();
  return `https://www.google.com/maps/dir/?${query}`;
}
