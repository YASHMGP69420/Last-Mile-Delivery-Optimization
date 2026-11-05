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
      if (Array.isArray(s.coordinates) && s.coordinates.length >= 2) {
        const [lng, lat] = s.coordinates;
        if (!isNaN(lat) && !isNaN(lng)) {
          latLngs.push([lat, lng]);
        }
      }
    });
    if (routePath) {
      routePath.forEach(([lng, lat]) => {
        if (!isNaN(lat) && !isNaN(lng)) {
          latLngs.push([lat, lng]);
        }
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
    : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;

  const attribution = tileApiKey
    ? '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> © <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

  return (
    <MapContainer center={center as any} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        subdomains={['a', 'b', 'c']}
      />
      {/* Markers for each stop */}
      {stops.map((stop, idx) => {
        if (!Array.isArray(stop.coordinates) || stop.coordinates.length < 2) return null;
        const [lng, lat] = stop.coordinates;
        if (isNaN(lat) || isNaN(lng)) return null;
        const position: L.LatLngExpression = [lat, lng];
        const label = stop.isDepot ? 'Depot' : `${stop.sequenceOrder || idx + 1}`;
        return (
          <Marker
            key={stop.deliveryId || idx}
            position={position}
            icon={L.divIcon({
              className: 'custom-numbered-icon',
              html: `<div style='background:#2563eb;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 5px rgba(0,0,0,0.3);border:2px solid #ffffff;'>${label}</div>`,
            })}
          >
            <Popup>
              <div className="font-sans text-xs">
                <div className="font-bold text-gray-900">Stop #{stop.sequenceOrder || idx + 1}</div>
                {stop.orderReference && <div className="text-gray-600 font-mono">{stop.orderReference}</div>}
                {stop.recipientName && <div>{stop.recipientName}</div>}
                {stop.streetAddress && <div className="text-gray-500">{stop.streetAddress}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
      {/* Route polyline (from routePath or sequenced stops) */}
      {routePath && routePath.length > 0 ? (
        <Polyline
          positions={routePath
            .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
            .map(([lng, lat]) => [lat, lng] as [number, number])}
          color="#2563eb"
          weight={4}
        />
      ) : stops.length > 1 ? (
        <Polyline
          positions={stops
            .filter((s) => Array.isArray(s.coordinates) && s.coordinates.length >= 2 && !isNaN(s.coordinates[0]) && !isNaN(s.coordinates[1]))
            .map((s) => [s.coordinates[1], s.coordinates[0]] as [number, number])}
          color="#2563eb"
          dashArray="5, 8"
          weight={3}
        />
      ) : null}
      <FitBounds stops={stops} routePath={routePath} />
    </MapContainer>
  );
};

export default InteractiveMap;
