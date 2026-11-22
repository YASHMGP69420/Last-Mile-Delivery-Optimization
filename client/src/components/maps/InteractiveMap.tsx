import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RouteStop } from '../../types/route';
import { Hub } from '../../types/hub';
import { urlForLocation, buildNavigationUrl } from '../../utils/googleMaps';
import { useTheme } from '../../context/ThemeContext';
import { ExternalLink, MapPin, Navigation, Clock, Package, CheckCircle2, AlertCircle, Phone, Crosshair, LocateFixed } from 'lucide-react';
import { createDriverIcon, createStatusStopIcon, createWarehouseHubIcon } from './markerIcons';
import { MapLegend, MarkerFilters } from './MapLegend';
import CameraController, { CameraFocusTarget } from './CameraController';

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
  /** Optional logistics hubs / warehouses to render as warehouse SVG markers */
  hubs?: Hub[];
  /** Optional polyline coordinates for the optimized route */
  routePath?: [number, number][]; // [lng, lat]
  /** Optional polyline coordinates for the baseline route (shown dashed for comparison) */
  baselineRoutePath?: [number, number][]; // [lng, lat]
  /** Optional dual-segment traversed route path (depot to driver) */
  traversedPath?: [number, number][]; // [lng, lat]
  /** Optional dual-segment remaining route path (driver to pending stops) */
  remainingPath?: [number, number][]; // [lng, lat]
  /** Center map on first stop or a default location */
  defaultCenter?: [number, number]; // [lat, lng]
  /** Active selected stop ID for highlighting */
  selectedStopId?: string;
  /** On click callback for a stop marker */
  onSelectStop?: (stop: RouteStop) => void;
  /** Disable automatic fallback polyline connecting stops */
  disableStopsPolyline?: boolean;

  // Phase 22 Live Driver Navigation & Camera Controls
  cameraFocusTarget?: CameraFocusTarget | null;
  autoFollowEnabled?: boolean;
  followCoordinates?: [number, number] | null;
  onUserPan?: () => void;
  onToggleAutoFollow?: () => void;
  onLocateDriver?: () => void;
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
  hubs,
  routePath,
  baselineRoutePath,
  traversedPath,
  remainingPath,
}: {
  stops: RouteStop[];
  hubs?: Hub[];
  routePath?: [number, number][];
  baselineRoutePath?: [number, number][];
  traversedPath?: [number, number][];
  remainingPath?: [number, number][];
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
    if (hubs) {
      hubs.forEach((h) => {
        if (h.location && typeof h.location.lat === 'number' && typeof h.location.lng === 'number') {
          if (!isNaN(h.location.lat) && !isNaN(h.location.lng)) {
            latLngs.push([h.location.lat, h.location.lng]);
          }
        }
      });
    }
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
    if (traversedPath) {
      traversedPath.forEach(([lng, lat]) => {
        if (!isNaN(lat) && !isNaN(lng)) {
          latLngs.push([lat, lng]);
        }
      });
    }
    if (remainingPath) {
      remainingPath.forEach(([lng, lat]) => {
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
  }, [stops, hubs, routePath, baselineRoutePath, traversedPath, remainingPath, map]);
  return null;
};

export const InteractiveMap: React.FC<Props> = ({
  stops,
  hubs,
  routePath,
  baselineRoutePath,
  traversedPath,
  remainingPath,
  defaultCenter,
  selectedStopId,
  onSelectStop,
  disableStopsPolyline = false,
  cameraFocusTarget,
  autoFollowEnabled,
  followCoordinates,
  onUserPan,
  onToggleAutoFollow,
  onLocateDriver,
}) => {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const center = defaultCenter ?? [20.2961, 85.8245]; // Bhubaneswar Hub fallback
  const tileApiKey = import.meta.env.VITE_GEOAPIFY_TILE_API_KEY ?? '';

  // Dynamic category marker filters (D-11, D-12)
  const [filters, setFilters] = useState<MarkerFilters>({
    drivers: true,
    nextStop: true,
    pending: true,
    completed: true,
    cancelled: true,
  });

  const handleToggleFilter = useCallback((key: keyof MarkerFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Compute next active delivery stop ID (D-09) - sort ascending by sequenceOrder
  const nextActiveStopId = useMemo(() => {
    const candidates = stops
      .filter(
        (s) =>
          !s.isDriverMarker &&
          !s.isDepot &&
          s.orderReference !== 'DEPOT' &&
          s.deliveryId !== 'DEPOT' &&
          (s.status === 'PENDING' || s.status === 'ARRIVED' || s.status === 'OUT_FOR_DELIVERY')
      )
      .slice()
      .sort((a, b) => (a.sequenceOrder || a.sequence || 0) - (b.sequenceOrder || b.sequence || 0));

    return candidates.length > 0 ? candidates[0].deliveryId : undefined;
  }, [stops]);

  // Filter stops against active legend filters (D-12, T-22-04)
  const visibleStops = useMemo(() => {
    return stops.filter((stop) => {
      // Depot logistics hub pins always remain visible
      if (stop.isDepot || stop.orderReference === 'DEPOT' || stop.deliveryId === 'DEPOT') {
        return true;
      }
      if (stop.isDriverMarker) {
        return filters.drivers;
      }
      if (stop.deliveryId && stop.deliveryId === nextActiveStopId) {
        return filters.nextStop;
      }
      const st = String(stop.status || 'PENDING').toUpperCase();
      if (st === 'COMPLETED') {
        return filters.completed;
      }
      if (st === 'FAILED' || st === 'CANCELLED') {
        return filters.cancelled;
      }
      return filters.pending;
    });
  }, [stops, filters, nextActiveStopId]);

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
      {/* Floating Tactical Camera Controls (Top-Right) */}
      {(onLocateDriver || onToggleAutoFollow) && (
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 pointer-events-auto">
          {onLocateDriver && (
            <button
              type="button"
              onClick={onLocateDriver}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-lowest/90 dark:bg-obsidian-900/90 backdrop-blur-md border border-outline-variant/80 dark:border-obsidian-750 shadow-soft text-xs font-semibold text-on-surface hover:bg-surface-low hover:text-primary transition-colors cursor-pointer"
              title="Find & Center Driver (Zoom 16)"
            >
              <Crosshair className="w-3.5 h-3.5 text-primary" />
              <span>Find Driver</span>
            </button>
          )}
          {onToggleAutoFollow && (
            <button
              type="button"
              onClick={onToggleAutoFollow}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md border shadow-soft text-xs font-semibold transition-colors cursor-pointer ${
                autoFollowEnabled
                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-surface-lowest/90 dark:bg-obsidian-900/90 text-on-surface-variant hover:text-on-surface hover:bg-surface-low border-outline-variant/80 dark:border-obsidian-750'
              }`}
              title={
                autoFollowEnabled
                  ? 'Auto-follow active: Click to disable'
                  : 'Click to enable real-time auto-follow'
              }
            >
              <LocateFixed
                className={`w-3.5 h-3.5 ${
                  autoFollowEnabled ? 'text-emerald-500 animate-pulse' : 'text-on-surface-muted'
                }`}
              />
              <span>{autoFollowEnabled ? 'Follow On' : 'Follow Off'}</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Collapsible Map Legend & Layer Filter (Bottom-Left per D-11) */}
      <MapLegend filters={filters} onToggleFilter={handleToggleFilter} />

      <MapContainer
        center={center as any}
        zoom={13}
        scrollWheelZoom
        zoomAnimation={false}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <MapLifecycleGuard />
        <CameraController
          focusTarget={cameraFocusTarget ?? null}
          autoFollow={Boolean(autoFollowEnabled)}
          followCoordinates={followCoordinates ?? null}
          onUserPan={onUserPan ?? (() => {})}
        />
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

        {/* Dual-Segment Route Polylines (D-10) */}
        {/* 1. Traversed Route Segment (Muted Dashed Grey) */}
        {traversedPath && traversedPath.length > 0 && (
          <Polyline
            positions={traversedPath
              .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
              .map(([lng, lat]) => [lat, lng] as [number, number])}
            color={isDark ? '#64748b' : '#94a3b8'}
            dashArray="6, 8"
            weight={3}
            opacity={0.8}
          />
        )}

        {/* 2. Remaining Route Segment (Solid Vibrant Emerald) */}
        {remainingPath && remainingPath.length > 0 && (
          <Polyline
            positions={remainingPath
              .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
              .map(([lng, lat]) => [lat, lng] as [number, number])}
            color={isDark ? '#10B981' : '#0B6E4F'}
            weight={4}
            opacity={0.95}
          />
        )}

        {/* Fallback to single Route Polyline when route segmentation is not provided */}
        {!(traversedPath && traversedPath.length > 0) && !(remainingPath && remainingPath.length > 0) && (
          routePath && routePath.length > 0 ? (
            <Polyline
              positions={routePath
                .filter((p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
                .map(([lng, lat]) => [lat, lng] as [number, number])}
              color={isDark ? '#10B981' : '#0B6E4F'}
              weight={4}
              opacity={0.95}
            />
          ) : !disableStopsPolyline && stops.filter((s) => !s.isDriverMarker).length > 1 ? (
            <Polyline
              positions={stops
                .filter(
                  (s) =>
                    !s.isDriverMarker &&
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
          ) : null
        )}

        {/* Markers for each visible stop */}
        {visibleStops.map((stop, idx) => {
          const coords = Array.isArray(stop.coordinates) && stop.coordinates.length >= 2
            ? stop.coordinates
            : (stop as any).location?.lng != null && (stop as any).location?.lat != null
            ? [(stop as any).location.lng, (stop as any).location.lat]
            : null;
          if (!coords) return null;
          const [lng, lat] = coords;
          if (isNaN(lat) || isNaN(lng)) return null;

          const isSelected = selectedStopId ? stop.deliveryId === selectedStopId : false;
          const isNextActive = stop.deliveryId ? stop.deliveryId === nextActiveStopId : false;
          const stopNumber = stop.sequenceOrder || stop.sequence || idx + 1;
          const gmapsLink =
            buildNavigationUrl({ destination: [lat, lng] }) ||
            (stop as any).googleMapsUrl ||
            urlForLocation([lat, lng], stop.orderReference || stop.recipientName || `Stop #${stopNumber}`);

          const markerIcon = stop.isDriverMarker
            ? createDriverIcon({
                name: stop.driverName || stop.recipientName || 'Driver',
                speedKmh: stop.speedKmh || 0,
                headingDegrees: stop.headingDegrees || 0,
                isStale: stop.isStale,
              })
            : createStatusStopIcon(stop, idx, isSelected, isNextActive);

        return (
          <Marker
            key={stop.deliveryId || `stop-${idx}`}
            position={[lat, lng]}
            icon={markerIcon}
            eventHandlers={{
              click: () => {
                if (onSelectStop) onSelectStop(stop);
              },
            }}
          >
            {/* Tooltip on Hover */}
            <Tooltip
              direction="top"
              offset={stop.isDriverMarker ? [0, -48] : [0, -38]}
              opacity={0.96}
            >
              <div className="font-sans text-xs space-y-0.5 p-0.5">
                <div className="font-bold flex items-center justify-between gap-2">
                  <span className="text-primary font-mono">
                    {stop.isDriverMarker
                      ? `${stop.driverName || 'Driver'} • Live GPS`
                      : stop.isDepot
                      ? 'Logistics Hub'
                      : `Stop #${stopNumber}`}
                  </span>
                  {stop.isDriverMarker ? (
                    <span
                      className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded-[4px] border ${
                        stop.isStale
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : (stop.speedKmh || 0) > 0
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          : 'bg-surface-low text-on-surface border-outline-variant'
                      }`}
                    >
                      {stop.isStale
                        ? 'Stale'
                        : (stop.speedKmh || 0) > 0
                        ? `${Math.round(stop.speedKmh || 0)} km/h`
                        : 'Halt'}
                    </span>
                  ) : (
                    stop.priority && (
                      <span className="text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded-[4px] bg-surface-low text-on-surface border border-outline-variant border-l-[3px] border-l-amber-500">
                        {stop.priority}
                      </span>
                    )
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
                    {stop.isDriverMarker ? (
                      <Navigation className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <span>
                      {stop.isDriverMarker
                        ? stop.driverName || 'Live Driver'
                        : stop.isDepot
                        ? 'Depot Hub'
                        : `Stop #${stopNumber}`}
                    </span>
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
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-colors no-underline !text-white"
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

        {/* Warehouse Hub Markers (D-04, T-28-11) */}
        {hubs && hubs.map((hub) => {
          if (!hub.location || typeof hub.location.lat !== 'number' || typeof hub.location.lng !== 'number') {
            return null;
          }
          const [lat, lng] = [hub.location.lat, hub.location.lng];
          if (isNaN(lat) || isNaN(lng)) return null;

          const isSelected = selectedStopId === hub.id;
          const hubIcon = createWarehouseHubIcon(hub, isSelected);
          const gmapsLink =
            buildNavigationUrl({ destination: [lat, lng] }) ||
            urlForLocation([lat, lng], hub.name);

          return (
            <Marker
              key={`hub-${hub.id}`}
              position={[lat, lng]}
              icon={hubIcon}
              eventHandlers={{
                click: () => {
                  if (onSelectStop) {
                    onSelectStop({
                      deliveryId: hub.id,
                      orderReference: hub.code,
                      recipientName: hub.name,
                      isDepot: true,
                      coordinates: [lng, lat],
                      streetAddress: hub.address,
                      status: 'READY' as any,
                    });
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -22]} opacity={0.96}>
                <div className="font-sans text-xs space-y-0.5 p-0.5">
                  <div className="font-bold flex items-center justify-between gap-2">
                    <span className="text-primary font-mono">{hub.name}</span>
                    {hub.isCanonical && (
                      <span className="text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        Primary Hub
                      </span>
                    )}
                  </div>
                  <div className="text-on-surface-muted text-[11px] truncate max-w-[200px]">{hub.address}</div>
                </div>
              </Tooltip>
              <Popup minWidth={220}>
                <div className="font-sans text-xs space-y-2 p-1">
                  <div className="flex items-center justify-between border-b pb-1.5 border-outline-variant">
                    <div className="font-bold text-on-surface text-sm flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{hub.name}</span>
                    </div>
                    {hub.isCanonical ? (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/30">
                        PRIMARY HUB
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-[4px] bg-surface-low text-on-surface font-semibold border border-outline-variant">
                        {hub.code}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-on-surface-variant text-[11px]">
                    <div><span className="font-medium text-on-surface">Code:</span> {hub.code}</div>
                    <div><span className="font-medium text-on-surface">Address:</span> {hub.address}</div>
                    {hub.contactPhone && (
                      <div><span className="font-medium text-on-surface">Phone:</span> {hub.contactPhone}</div>
                    )}
                    {hub.operatingHours && (
                      <div>
                        <span className="font-medium text-on-surface">Operating Hours:</span> {hub.operatingHours.open} - {hub.operatingHours.close}
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-outline-variant">
                    <a
                      href={gmapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open navigation in Google Maps for ${hub.name}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-colors no-underline !text-white"
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

        <FitBounds
          stops={stops}
          hubs={hubs}
          routePath={routePath}
          baselineRoutePath={baselineRoutePath}
          traversedPath={traversedPath}
          remainingPath={remainingPath}
        />
    </MapContainer>
    </div>
  );
};

export default InteractiveMap;
