import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RouteStop } from '../../types/route';

// Default icon fix for Leaflet's missing default icon in webpack setups
// Fix Leaflet default icon URLs for Vite/Esm imports
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  /** List of stops including optional depot markers */
  stops: RouteStop[];
  /** Optional polyline coordinates for the optimized route */
  routePath?: [number, number][]; // [lng, lat]
  /** Center map on first stop or a default location */
  defaultCenter?: [number, number]; // [lat, lng]
}

// Helper component to fit map bounds after markers are added
const FitBounds = ({ stops, routePath }: { stops: RouteStop[]; routePath?: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    const latLngs: L.LatLngExpression[] = [];
    stops.forEach((s) => {
      const [lng, lat] = s.coordinates;
      latLngs.push([lat, lng]);
    });
    if (routePath) {
      routePath.forEach(([lng, lat]) => {
        latLngs.push([lat, lng]);
      });
    }
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs as any);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stops, routePath, map]);
  return null;
};

export const InteractiveMap: React.FC<Props> = ({ stops, routePath, defaultCenter }) => {
  const center = defaultCenter ?? [20.2961, 85.8245]; // Bhubaneswar fallback
  const tileApiKey = import.meta.env.VITE_GEOAPIFY_TILE_API_KEY ?? '';
  const tileUrl = tileApiKey
    ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${tileApiKey}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = tileApiKey
    ? '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> © <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  return (
    <MapContainer center={center as any} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      {tileUrl && (
        <TileLayer
          url={tileUrl}
          attribution={attribution}
          subdomains={['a','b','c']}
        />
      )}
      {/* Markers for each stop */}
      {stops.map((stop, idx) => {
        const [lng, lat] = stop.coordinates;
        const position: L.LatLngExpression = [lat, lng];
        const label = stop.isDepot ? 'Depot' : `${idx + 1}`;
        return (
          <Marker key={idx} position={position} icon={L.divIcon({ className: 'custom-numbered-icon', html: `<div style='background:#4f46e5;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px'>${label}</div>` })}>
            <Popup>{stop.streetAddress || label}</Popup>
          </Marker>
        );
      })}
      {/* Optional route polyline */}
      {routePath && routePath.length > 0 && (
        <Polyline positions={routePath.map(([lng, lat]) => [lat, lng] as [number, number])} color="#4f46e5" weight={4} />
      )}
      <FitBounds stops={stops} routePath={routePath} />
    </MapContainer>
  );
};

export default InteractiveMap;
