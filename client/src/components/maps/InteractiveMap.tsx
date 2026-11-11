import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RouteStop } from '../../types/route';
import { urlForLocation, buildNavigationUrl } from '../../utils/googleMaps';
import { useTheme } from '../../context/ThemeContext';
import { ExternalLink, MapPin, Navigation, Clock, Package, CheckCircle2, AlertCircle, Phone } from 'lucide-react';

// Fix Leaflet default icon URLs for Vite/ESM imports
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
  /** Optional polyline coordinates for the baseline route (shown dashed for comparison) */
  baselineRoutePath?: [number, number][]; // [lng, lat]
  /** Center map on first stop or a default location */
  defaultCenter?: [number, number]; // [lat, lng]
  /** Active selected stop ID for highlighting */
  selectedStopId?: string;
  /** On click callback for a stop marker */
  onSelectStop?: (stop: RouteStop) => void;
}

// Cancel in-flight zoom/pan animations on unmount so Leaflet's delayed _onZoomTransitionEnd
// never accesses _mapPane._leaflet_pos after React tears down the container
const MapLifecycleGuard: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    return () => {
      try {
        (map as any)._animatingZoom = false;
        map.stop();
      } catch {
        // Ignore teardown errors
      }
    };
  }, [map]);
  return null;
};

// Helper component to fit map bounds after markers or route paths are added
const FitBounds = ({
  stops,
  routePath,
  baselineRoutePath,
}: {
  stops: RouteStop[];
  routePath?: [number, number][];
  baselineRoutePath?: [number, number][];
}) => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer?.();
    if (!container || !container.isConnected || !(map as any)._mapPane) {
      return;
    }

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
    if (baselineRoutePath) {
      baselineRoutePath.forEach(([lng, lat]) => {
        if (!isNaN(lat) && !isNaN(lng)) {
          latLngs.push([lat, lng]);
        }
      });
    }
    if (latLngs.length > 0) {
      try {
        const bounds = L.latLngBounds(latLngs as any);
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: false });
      } catch {
        // Ignore transient bounds fit errors if map is unmounting
      }
    }

    return () => {
      try {
        (map as any)._animatingZoom = false;
        map.stop();
      } catch {
        // Ignore
      }
    };
  }, [stops, routePath, baselineRoutePath, map]);
  return null;
};

/** Create custom SVG marker pin with sequence badge, priority ring, and status color */
function createStopIcon(stop: RouteStop, index: number, isSelected: boolean) {
  const isDepot = Boolean(stop.isDepot || stop.orderReference === 'DEPOT' || stop.deliveryId === 'DEPOT');

  if (isDepot) {
    return L.divIcon({
      className: 'custom-depot-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
      html: `
        <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:38px; height:38px; background:#d97706; border-radius:10px; transform:rotate(45deg); box-shadow:0 4px 10px rgba(217,119,6,0.4); border:2.5px solid #ffffff;"></div>
          <div style="position:relative; z-index:2; color:#ffffff; font-weight:800; font-size:10px; font-family:sans-serif; text-transform:uppercase; letter-spacing:0.5px;">HUB</div>
        </div>
      `,
    });
  }

  const sequenceNum = stop.sequenceOrder || stop.sequence || index + 1;
  const priority = String(stop.priority || '').toLowerCase();
  const status = String(stop.status || 'PENDING').toUpperCase();

  // Color mapping
  let markerBg = '#10b981'; // Emerald
  let borderColor = '#ffffff';

  if (status === 'COMPLETED') {
    markerBg = '#059669';
  } else if (status === 'OUT_FOR_DELIVERY' || status === 'ARRIVED') {
    markerBg = '#047857';
  } else if (status === 'FAILED') {
    markerBg = '#ef4444';
  }

  // Priority indicator accents
  let priorityRing = '';
  if (priority.includes('cold') || priority.includes('chain')) {
    priorityRing = 'border: 2px solid #06b6d4;';
  } else if (priority.includes('urgent')) {
    priorityRing = 'border: 2px solid #f97316;';
  }

  const scale = isSelected ? 'transform: scale(1.15); z-index: 1000;' : '';

  return L.divIcon({
    className: 'custom-stop-marker',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative; width:34px; height:44px; ${scale} transition:transform 0.15s ease;">
        <svg viewBox="0 0 34 44" width="34" height="44" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="${isSelected ? '#312e81' : markerBg}" stroke="${borderColor}" stroke-width="2"/>
        </svg>
        <div style="position:absolute; top:4px; left:4px; width:26px; height:26px; background:${markerBg}; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:600; font-size:11px; font-family:monospace; ${priorityRing}">
          ${sequenceNum}
        </div>
      </div>
    `,
  });
}

export const InteractiveMap: React.FC<Props> = ({
  stops,
  routePath,
  baselineRoutePath,
  defaultCenter,
  selectedStopId,
  onSelectStop,
}) => {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const center = defaultCenter ?? [20.2961, 85.8245]; // Bhubaneswar Hub fallback
  const tileApiKey = import.meta.env.VITE_GEOAPIFY_TILE_API_KEY ?? '';

  // In dark mode: use Geoapify's tactical dark-matter-dark-grey style when key is present,
  // otherwise fallback to OpenStreetMap with CSS dark mode filter (never use unauthenticated Carto CDN)
  const tileUrl = isDark
    ? tileApiKey
      ? `https://maps.geoapify.com/v1/tile/dark-matter-dark-grey/{z}/{x}/{y}.png?apiKey=${tileApiKey}`
      : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
    : tileApiKey
    ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${tileApiKey}`
    : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;

  const attribution = tileApiKey
    ? '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> © <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

  const useOsmDarkFilter = isDark && !tileApiKey;

  return (
    <div
      role="region"
      aria-label="Interactive Delivery Route Map"
      className={`h-full w-full relative isolate z-0 rounded-inherit overflow-hidden [&_.leaflet-control-zoom]:hidden sm:[&_.leaflet-control-zoom]:block [&_.leaflet-bottom]:bottom-24 sm:[&_.leaflet-bottom]:bottom-0 dark:[&_.leaflet-bar_a]:bg-obsidian-900 dark:[&_.leaflet-bar_a]:text-slate-200 dark:[&_.leaflet-bar_a]:border-obsidian-750 dark:[&_.leaflet-control-attribution]:bg-obsidian-950/90 dark:[&_.leaflet-control-attribution]:text-slate-400 ${
        useOsmDarkFilter ? '[&_.leaflet-tile]:brightness-[0.6] [&_.leaflet-tile]:invert [&_.leaflet-tile]:contrast-[2.5] [&_.leaflet-tile]:hue-rotate-[200deg] [&_.leaflet-tile]:saturate-[0.3]' : ''
      }`}
    >
      <MapContainer
        center={center as any}
        zoom={13}
        scrollWheelZoom
        zoomAnimation={false}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <MapLifecycleGuard />
        <TileLayer
          key={isDark ? 'dark-tiles' : 'light-tiles'}
          url={tileUrl}
          attribution={attribution}
          subdomains={tileApiKey ? [] : ['a', 'b', 'c']}
        />

        {/* Baseline Route Polyline (Dashed Amber/Slate for Before-Optimization comparison) */}
        {baselineRoutePath && baselineRoutePath.length > 0 && (
          <Polyline
            positions={baselineRoutePath
              .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
              .map(([lng, lat]) => [lat, lng] as [number, number])}
            color={isDark ? '#F59E0B' : '#94a3b8'}
            dashArray="6, 8"
            weight={3}
            opacity={isDark ? 0.9 : 0.8}
          />
        )}

        {/* Optimized Route Polyline (Solid Vibrant Emerald) */}
        {routePath && routePath.length > 0 ? (
          <Polyline
            positions={routePath
              .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
              .map(([lng, lat]) => [lat, lng] as [number, number])}
            color={isDark ? '#10B981' : '#0B6E4F'}
            weight={4}
            opacity={0.95}
          />
        ) : stops.length > 1 ? (
          <Polyline
            positions={stops
              .filter(
                (s) =>
                  Array.isArray(s.coordinates) &&
                  s.coordinates.length >= 2 &&
                  !isNaN(s.coordinates[0]) &&
                  !isNaN(s.coordinates[1])
              )
              .map((s) => [s.coordinates[1], s.coordinates[0]] as [number, number])}
            color={isDark ? '#10B981' : '#0B6E4F'}
            dashArray="5, 8"
            weight={3}
            opacity={0.85}
          />
        ) : null}

      {/* Markers for each stop */}
      {stops.map((stop, idx) => {
        if (!Array.isArray(stop.coordinates) || stop.coordinates.length < 2) return null;
        const [lng, lat] = stop.coordinates;
        if (isNaN(lat) || isNaN(lng)) return null;

        const isSelected = selectedStopId ? stop.deliveryId === selectedStopId : false;
        const stopNumber = stop.sequenceOrder || stop.sequence || idx + 1;
        const gmapsLink =
          buildNavigationUrl({ destination: [lat, lng] }) ||
          (stop as any).googleMapsUrl ||
          urlForLocation([lat, lng], stop.orderReference || stop.recipientName || `Stop #${stopNumber}`);

        return (
          <Marker
            key={stop.deliveryId || `stop-${idx}`}
            position={[lat, lng]}
            icon={createStopIcon(stop, idx, isSelected)}
            eventHandlers={{
              click: () => {
                if (onSelectStop) onSelectStop(stop);
              },
            }}
          >
            {/* Tooltip on Hover */}
            <Tooltip direction="top" offset={[0, -38]} opacity={0.96}>
              <div className="font-sans text-xs space-y-0.5 p-0.5">
                <div className="font-bold flex items-center justify-between gap-2">
                  <span className="text-primary font-mono">
                    {stop.isDepot ? 'Logistics Hub' : `Stop #${stopNumber}`}
                  </span>
                  {stop.priority && (
                    <span className="text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded-[4px] bg-surface-low text-on-surface border border-outline-variant border-l-[3px] border-l-amber-500">
                      {stop.priority}
                    </span>
                  )}
                </div>
                {stop.recipientName && <div className="text-on-surface font-medium">{stop.recipientName}</div>}
                {stop.streetAddress && (
                  <div className="text-on-surface-muted text-[11px] truncate max-w-[200px]">{stop.streetAddress}</div>
                )}
                <div className="text-[10px] text-primary font-semibold pt-0.5 flex items-center gap-1">
                  Click for Google Maps navigation →
                </div>
              </div>
            </Tooltip>

            {/* Rich Popup on Click / Tap */}
            <Popup minWidth={220}>
              <div className="font-sans text-xs space-y-2 p-1">
                <div className="flex items-center justify-between border-b pb-1.5 border-outline-variant">
                  <div className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{stop.isDepot ? 'Depot Hub' : `Stop #${stopNumber}`}</span>
                  </div>
                  {stop.orderReference && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-surface-low dark:bg-obsidian-850 text-on-surface font-semibold border border-outline-variant dark:border-obsidian-750 border-l-[3px] border-l-primary">
                      {stop.orderReference}
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-on-surface-variant">
                  {stop.recipientName && (
                    <div className="font-semibold text-on-surface">{stop.recipientName}</div>
                  )}
                  {stop.recipientPhone && (
                    <div className="text-[11px] text-on-surface-muted font-mono flex items-center gap-1">
                      <Phone className="w-3 h-3 text-on-surface-muted shrink-0" />
                      <span>{stop.recipientPhone}</span>
                    </div>
                  )}
                  {stop.streetAddress && (
                    <div className="text-[11px] text-on-surface-variant leading-tight flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-on-surface-muted shrink-0 mt-0.5" />
                      <span>{stop.streetAddress}{stop.zone ? `, ${stop.zone}` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1 pt-1 border-t border-outline-variant/60 text-[11px]">
                  {stop.weightKg != null && (
                    <div className="text-on-surface-variant">
                      Weight: <span className="font-semibold text-on-surface">{stop.weightKg} kg</span>
                    </div>
                  )}
                  {stop.eta && (
                    <div className="text-on-surface-variant">
                      ETA: <span className="font-semibold text-on-surface">{stop.eta}</span>
                    </div>
                  )}
                  {stop.priority && (
                    <div className="text-on-surface-variant col-span-2">
                      Priority: <span className="font-semibold text-on-surface">{stop.priority}</span>
                    </div>
                  )}
                </div>

                {/* Google Maps External Action Button */}
                <div className="pt-2 border-t border-outline-variant">
                  <a
                    href={gmapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open navigation in Google Maps for stop ${stopNumber}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-colors"
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <FitBounds stops={stops} routePath={routePath} baselineRoutePath={baselineRoutePath} />
    </MapContainer>
    </div>
  );
};

export default InteractiveMap;
