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
    // Convert to [lat, lng]
    const latLngStops: LatLng[] = (routePath && routePath.length > 0 ? routePath : stops.map(s => s.coordinates))
      .map(([lng, lat]) => [lat, lng] as LatLng);

    let url = '';
    if (latLngStops.length === 1) {
      url = urlForLocation(latLngStops[0]);
    } else if (latLngStops.length === 2) {
      url = urlForDirections(latLngStops[0], latLngStops[1]);
    } else {
      url = urlForMultiStopRoute(latLngStops);
    }
    if (url) window.open(url, '_blank');
  };

  return (
    <Button size="sm" variant="secondary" onClick={handleClick} leftIcon={null}>
      Open in Google Maps
    </Button>
  );
};
