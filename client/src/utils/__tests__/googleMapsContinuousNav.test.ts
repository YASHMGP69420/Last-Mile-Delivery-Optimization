import { describe, it, expect } from 'vitest';
import {
  buildContinuousNavigationUrl,
  RASULGARH_DEPOT_COORDS,
  encodeLatLng,
  toLatLng,
} from '../googleMaps';

describe('googleMaps - buildContinuousNavigationUrl', () => {
  it('returns Rasulgarh Depot return URL when stop list is empty or null', () => {
    const emptyUrl = buildContinuousNavigationUrl([]);
    const nullUrl = buildContinuousNavigationUrl(null);
    const undefinedUrl = buildContinuousNavigationUrl(undefined);

    const expectedDepotCoord = encodeLatLng(RASULGARH_DEPOT_COORDS);

    expect(new URL(emptyUrl).searchParams.get('destination')).toBe(expectedDepotCoord);
    expect(emptyUrl).not.toContain('waypoints');
    expect(new URL(nullUrl).searchParams.get('destination')).toBe(expectedDepotCoord);
    expect(new URL(undefinedUrl).searchParams.get('destination')).toBe(expectedDepotCoord);
  });

  it('generates direct navigation URL when only 1 stop is provided', () => {
    const singleStop = {
      location: { lat: 20.3015, lng: 85.8212 },
    };

    const url = buildContinuousNavigationUrl([singleStop]);
    expect(url).toContain('destination=20.301500%2C85.821200');
    expect(url).not.toContain('waypoints');
    expect(url).toContain('travelmode=driving');
  });

  it('generates multi-stop continuous navigation URL with waypoints and destination', () => {
    const stops = [
      { location: { lat: 20.2800, lng: 85.8100 } }, // Stop 1 (Waypoint 1)
      { location: { lat: 20.2850, lng: 85.8150 } }, // Stop 2 (Waypoint 2)
      { location: { lat: 20.2900, lng: 85.8200 } }, // Stop 3 (Waypoint 3)
      { location: { lat: 20.2950, lng: 85.8250 } }, // Stop 4 (Waypoint 4)
      { location: { lat: 20.3000, lng: 85.8300 } }, // Stop 5 (Final Destination)
    ];

    const url = buildContinuousNavigationUrl(stops);
    const parsed = new URL(url);

    expect(parsed.searchParams.get('api')).toBe('1');
    expect(parsed.searchParams.get('travelmode')).toBe('driving');
    expect(parsed.searchParams.get('destination')).toBe('20.300000,85.830000');

    const waypoints = parsed.searchParams.get('waypoints');
    expect(waypoints).toBeDefined();
    const waypointList = waypoints!.split('|');
    expect(waypointList).toHaveLength(4);
    expect(waypointList[0]).toBe('20.280000,85.810000');
    expect(waypointList[1]).toBe('20.285000,85.815000');
    expect(waypointList[2]).toBe('20.290000,85.820000');
    expect(waypointList[3]).toBe('20.295000,85.825000');
  });

  it('enforces truncation guard (maxWaypoints = 15) to prevent URL overflow', () => {
    // Generate 25 distinct stops
    const stops = Array.from({ length: 25 }, (_, i) => ({
      location: { lat: 20.25 + i * 0.005, lng: 85.80 + i * 0.005 },
    }));

    const url = buildContinuousNavigationUrl(stops, 15);
    const parsed = new URL(url);

    // Max 15 waypoints + 1 destination = 16 stops total
    const waypoints = parsed.searchParams.get('waypoints')!.split('|');
    expect(waypoints).toHaveLength(15);

    // Destination must be the 16th stop (index 15)
    const expectedDest = encodeLatLng(toLatLng(stops[15])!);
    expect(parsed.searchParams.get('destination')).toBe(expectedDest);
  });

  it('correctly handles GeoJSON [lng, lat] coordinate shape without lat/lng inversion', () => {
    // GeoJSON [longitude, latitude] for Bhubaneswar: [85.8245, 20.2961]
    const geoJsonStops = [
      { coordinates: [85.8245, 20.2961] },
      { coordinates: [85.8400, 20.3100] },
    ];

    const url = buildContinuousNavigationUrl(geoJsonStops);
    const parsed = new URL(url);

    // Destination should have lat=20.3100, lng=85.8400
    expect(parsed.searchParams.get('destination')).toBe('20.310000,85.840000');
    // Waypoint should have lat=20.2961, lng=85.8245
    expect(parsed.searchParams.get('waypoints')).toBe('20.296100,85.824500');
  });

  it('leaves origin unset so Google Maps prompts for real-time device GPS location', () => {
    const stops = [
      { location: { lat: 20.28, lng: 85.81 } },
      { location: { lat: 20.29, lng: 85.82 } },
    ];

    const url = buildContinuousNavigationUrl(stops);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('origin')).toBeNull();
  });
});
