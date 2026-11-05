import React from 'react';
import { Button } from '../common/Button';
import { urlForLocation, urlForDirections, urlForMultiStopRoute, LatLng } from '../../utils/googleMaps';

interface Props {
  stops: { coordinates: [number, number]; isDepot?: boolean }[]; // [lng, lat]
  // optional optimized polyline coordinates (same format as stops)
  routePath?: [number, number][];
}

export const OpenInGoogleMapsButton: React.FC<Props> = ({ stops, routePath }) => {
  const handleClick = () => {
    // Extract and normalize coordinates to [lat, lng]
    const rawCoords =
      routePath && routePath.length > 0
        ? routePath
        : stops
            .filter((s) => Array.isArray(s?.coordinates) && s.coordinates.length >= 2)
            .map((s) => s.coordinates);

    const latLngStops: LatLng[] = rawCoords
      .filter((coord) => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1]))
      .map(([coord1, coord2]) => {
        // If coord1 is latitude (~20 in BBSR) and coord2 is longitude (~85 in BBSR)
        if (coord1 < 40 && coord2 > 60) {
          return [coord1, coord2] as LatLng;
        }
        // Otherwise assume [lng, lat] and swap to [lat, lng]
        return [coord2, coord1] as LatLng;
      });

    if (latLngStops.length === 0) return;

    let url = '';
    if (latLngStops.length === 1) {
      url = urlForLocation(latLngStops[0]);
    } else if (latLngStops.length === 2) {
      url = urlForDirections(latLngStops[0], latLngStops[1]);
    } else {
      url = urlForMultiStopRoute(latLngStops);
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const hasStops = (stops && stops.length > 0) || (routePath && routePath.length > 0);

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleClick}
      disabled={!hasStops}
      leftIcon={null}
    >
      Open in Google Maps
    </Button>
  );
};
