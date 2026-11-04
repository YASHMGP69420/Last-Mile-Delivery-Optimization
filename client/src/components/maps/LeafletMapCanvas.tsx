import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Eye, EyeOff, Activity, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { RouteStop, RouteMetrics, OptimizationResult } from '../../types/route';
import { Vehicle } from '../../types';
import { Button } from '../../components/common/Button';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix missing default icon issue in Leaflet for Vite
// Resolve marker images via imports (Vite will handle bundling)
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LeafletMapCanvasProps {
  stops: RouteStop[];
  baselineStops?: RouteStop[];
  baselineMetrics?: RouteMetrics;
  optimizedMetrics?: RouteMetrics;
  showNaiveRoute: boolean;
  onToggleNaiveRoute: () => void;
  showTrafficLayer: boolean;
  onToggleTrafficLayer: () => void;
  hoveredStopId: string | null;
  onHoverStop: (id: string | null) => void;
  focusedStopId: string | null;
  onSelectStop: (id: string | null) => void;
  optimizationResult?: OptimizationResult | null;
  assignedVehicle?: Vehicle | null;
}

// Helper to build Google Maps direction URL from a list of stops
function buildGoogleMapsUrl(stops: RouteStop[]): string {
  if (!stops.length) return '';
  const waypoints = stops
    .map((s) => {
      const coords = Array.isArray(s.coordinates) && s.coordinates.length === 2 ? s.coordinates : [];
      // Assume [lat, lng] (most VRP back‑ends) but also support [lng, lat]
      let lat: number, lng: number;
      if (coords[0] > 90 && coords[1] < 90) {
        // first is lng
        lng = coords[0];
        lat = coords[1];
      } else {
        lat = coords[0];
        lng = coords[1];
      }
      return `${lat},${lng}`;
    })
    .join('|');
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${encodeURIComponent(
    waypoints,
  )}`;
}

// Simple component to expose a button that fits into the existing toolbar layout
const MapToolbar: React.FC<{
  showNaiveRoute: boolean;
  onToggleNaiveRoute: () => void;
  showTrafficLayer: boolean;
  onToggleTrafficLayer: () => void;
  openInGoogle: () => void;
}> = ({ showNaiveRoute, onToggleNaiveRoute, showTrafficLayer, onToggleTrafficLayer, openInGoogle }) => (
  <div className="flex items-center gap-2">
    {/* Traffic toggle */}
    <button
      onClick={onToggleTrafficLayer}
      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border ${
        showTrafficLayer
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
          : 'bg-surface-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
      }`}
      title="Toggle Traffic Congestion Heatmap"
    >
      <Activity className="w-3.5 h-3.5 text-amber-500" />
      <span>Traffic</span>
    </button>
    {/* Baseline toggle */}
    <button
      onClick={onToggleNaiveRoute}
      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border ${
        showNaiveRoute
          ? 'bg-slate-200/80 border-slate-300 text-slate-800'
          : 'bg-surface-lowest border-outline-variant text-on-surface-variant hover:text-on-surface'
      }`}
      title="Toggle Baseline Naive Polyline"
    >
      {showNaiveRoute ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      <span>Baseline</span>
    </button>
    {/* Open in Google Maps */}
    <button
      onClick={openInGoogle}
      className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border bg-primary-600 text-white"
      title="Open route in Google Maps (new tab)"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>Open in Google Maps</span>
    </button>
  </div>
);

// Custom hook to reset view (zoom & center) – can be triggered from the parent if needed.
function ResetViewButton() {
  const map = useMap();
  const reset = () => {
    map.setView([20.2961, 85.8645], 13);
  };
  return (
    <button
      onClick={reset}
      className="p-1 border-l border-outline-variant hover:bg-surface-low text-on-surface-variant"
      title="Reset View"
    >
      <Maximize2 className="w-3.5 h-3.5" />
    </button>
  );
}

export const LeafletMapCanvas: React.FC<LeafletMapCanvasProps> = ({
  stops,
  baselineStops = [],
  baselineMetrics,
  optimizedMetrics,
  showNaiveRoute,
  onToggleNaiveRoute,
  showTrafficLayer,
  onToggleTrafficLayer,
  hoveredStopId,
  onHoverStop,
  focusedStopId,
  onSelectStop,
  optimizationResult,
  assignedVehicle,
}) => {

  // Use a fallback demo stop when no data is available
  const routeStopsRaw = showNaiveRoute ? baselineStops : stops;
  const routeStops = routeStopsRaw && routeStopsRaw.length > 0 ? routeStopsRaw : [{
    id: 'fallback-depot',
    locationName: 'Depot (demo)',
    coordinates: [20.2961, 85.8645],
  } as any];

  // Convert stops to LatLng arrays for Polyline
  const polylinePositions = useMemo(() => {
    const positions = routeStops
      .map((s) => {
        const coords = Array.isArray(s.coordinates) && s.coordinates.length === 2 ? s.coordinates : null;
        if (!coords) return null;
        // Accept both [lat, lng] and [lng, lat]
        let lat = coords[0];
        let lng = coords[1];
        if (coords[0] > 90 && coords[1] < 90) {
          // swap if first looks like longitude
          lng = coords[0];
          lat = coords[1];
        }
        return [lat, lng] as [number, number];
      })
      .filter(Boolean) as [number, number][];
    // Ensure we return to depot (hard‑coded hub coordinates) for a closed loop
    const depot = [20.2961, 85.8645] as [number, number];
    if (positions.length) {
      return [depot, ...positions, depot];
    }
    return [];
  }, [routeStops]);

  // Build Google Maps URL for the current displayed route
  const openInGoogle = () => {
    const url = buildGoogleMapsUrl(routeStops);
    if (!url) {
      // fallback to toast via a custom event – parent already shows toast, so just return
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="relative w-full rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden flex flex-col select-none">
      {/* Toolbar – same layout as SVG canvas header */}
      <div className="px-4 py-3 bg-surface-low border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l9 21H3L12 2z"/></svg>
          </div>
          <div>
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Bhubaneswar Leaflet Map
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono">
              Rasulgarh Depot (20.2961°N, 85.8645°E) – OpenStreetMap tiles
            </span>
          </div>
        </div>
        <MapToolbar
          showNaiveRoute={showNaiveRoute}
          onToggleNaiveRoute={onToggleNaiveRoute}
          showTrafficLayer={showTrafficLayer}
          onToggleTrafficLayer={onToggleTrafficLayer}
          openInGoogle={openInGoogle}
        />
      </div>

      {/* Leaflet Map */}
      <MapContainer
        center={[20.2961, 85.8645]}
        zoom={13}
        style={{ height: '520px', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Route polyline */}
        {polylinePositions.length > 0 && (
          <Polyline positions={polylinePositions} color={showNaiveRoute ? '#F59E0B' : '#10B981'} weight={4} />
        )}
        {/* Markers for each stop */}
        {routeStops.map((stop) => {
          const coords = Array.isArray(stop.coordinates) && stop.coordinates.length === 2 ? stop.coordinates : null;
          if (!coords) return null;
          let lat = coords[0];
          let lng = coords[1];
          if (coords[0] > 90 && coords[1] < 90) {
            lng = coords[0];
            lat = coords[1];
          }
          const isHovered = hoveredStopId && (stop.deliveryId || stop.orderReference || String(stop.sequenceOrder)) === hoveredStopId;
          const isFocused = focusedStopId && (stop.deliveryId || stop.orderReference || String(stop.sequenceOrder)) === focusedStopId;
          // Using default Leaflet icon; custom color handling can be added later if needed.
          const icon = undefined;
          return (
            <Marker
              key={stop.id || stop.deliveryId || stop.sequenceOrder}
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                mouseover: () => onHoverStop(stop.id?.toString() || stop.deliveryId?.toString() || String(stop.sequenceOrder)),
                mouseout: () => onHoverStop(null),
                click: () => onSelectStop(stop.id?.toString() || stop.deliveryId?.toString() || String(stop.sequenceOrder)),
              }}
            >
              <Tooltip direction="top" offset={[0, -20]}> {stop.locationName || `Stop ${stop.sequenceOrder}`} </Tooltip>
            </Marker>
          );
        })}
        {/* Reset view button */}
        <ResetViewButton />
      </MapContainer>
    </div>
  );
};
