import React, { useState, useMemo } from 'react';
import { RouteStop, RouteMetrics, OptimizationResult } from '../../types/route';
import { Vehicle } from '../../types';
import {
  Layers,
  Eye,
  EyeOff,
  Navigation,
  Compass,
  Zap,
  MapPin,
  Clock,
  Package,
  Activity,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const DEFAULT_BBSR_BOUNDS: GeoBounds = {
  minLat: 20.24,
  maxLat: 20.38,
  minLng: 85.77,
  maxLng: 85.89,
};

const RASULGARH_DEPOT = {
  lat: 20.2961,
  lng: 85.8645,
  name: 'Rasulgarh Central Hub',
  code: 'HUB-BBSR-01',
};

// Coordinate projection helper (handles both [lng, lat] and [lat, lng])
export const projectGeoToSvg = (
  latOrLng1: number,
  latOrLng2: number,
  bounds: GeoBounds = DEFAULT_BBSR_BOUNDS,
  width = 900,
  height = 620,
  padding = 45
): { x: number; y: number } => {
  let lat = latOrLng1;
  let lng = latOrLng2;

  // If first argument is longitude (~85.x) and second is latitude (~20.x)
  if (latOrLng1 > 60 && latOrLng2 < 30) {
    lng = latOrLng1;
    lat = latOrLng2;
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const normX = Math.min(Math.max((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng), 0), 1);
  const normY = Math.min(Math.max((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat), 0), 1);

  return {
    x: padding + normX * innerWidth,
    y: padding + normY * innerHeight,
  };
};

export interface GISMapCanvasProps {
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

export const GISMapCanvas: React.FC<GISMapCanvasProps> = ({
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
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Depot projected point
  const depotPt = useMemo(
    () => projectGeoToSvg(RASULGARH_DEPOT.lat, RASULGARH_DEPOT.lng),
    []
  );

  // Projected stops points
  const projectedStops = useMemo(() => {
    return stops.map((stop) => {
      const coords = Array.isArray(stop.coordinates) && stop.coordinates.length === 2 ? stop.coordinates : [85.8245, 20.2961];
      const pt = projectGeoToSvg(coords[0], coords[1]);
      return {
        ...stop,
        svgX: pt.x,
        svgY: pt.y,
      };
    });
  }, [stops]);

  // Projected baseline stops points
  const projectedBaselineStops = useMemo(() => {
    return baselineStops.map((stop) => {
      const coords = Array.isArray(stop.coordinates) && stop.coordinates.length === 2 ? stop.coordinates : [85.8245, 20.2961];
      const pt = projectGeoToSvg(coords[0], coords[1]);
      return {
        ...stop,
        svgX: pt.x,
        svgY: pt.y,
      };
    });
  }, [baselineStops]);

  // SVG Polyline Path for Baseline Route (Depot -> Baseline Stops -> Depot)
  const baselinePathD = useMemo(() => {
    if (projectedBaselineStops.length === 0) return '';
    let d = `M ${depotPt.x} ${depotPt.y}`;
    projectedBaselineStops.forEach((st) => {
      d += ` L ${st.svgX} ${st.svgY}`;
    });
    d += ` L ${depotPt.x} ${depotPt.y}`;
    return d;
  }, [projectedBaselineStops, depotPt]);

  // SVG Polyline Path for Optimized 2-Opt Route (Depot -> Optimized Stops -> Depot)
  const optimizedPathD = useMemo(() => {
    if (projectedStops.length === 0) return '';
    let d = `M ${depotPt.x} ${depotPt.y}`;
    projectedStops.forEach((st) => {
      d += ` L ${st.svgX} ${st.svgY}`;
    });
    d += ` L ${depotPt.x} ${depotPt.y}`;
    return d;
  }, [projectedStops, depotPt]);

  // Active highlighted stop
  const activeStop = useMemo(() => {
    const targetId = hoveredStopId || focusedStopId;
    if (!targetId) return null;
    return projectedStops.find(
      (s) => (s.deliveryId || s.orderReference || String(s.sequenceOrder)) === targetId
    );
  }, [hoveredStopId, focusedStopId, projectedStops]);

  // Bhubaneswar Landmark reference points
  const landmarks = [
    { name: 'Patia / KIIT', lat: 20.355, lng: 85.818, code: 'ZONE-A' },
    { name: 'Jaydev Vihar', lat: 20.301, lng: 85.823, code: 'ZONE-B' },
    { name: 'Saheed Nagar', lat: 20.288, lng: 85.845, code: 'ZONE-C' },
    { name: 'Chandrasekharpur', lat: 20.325, lng: 85.816, code: 'ZONE-D' },
    { name: 'Khandagiri', lat: 20.258, lng: 85.785, code: 'ZONE-E' },
  ].map((lm) => ({ ...lm, ...projectGeoToSvg(lm.lat, lm.lng) }));

  // Jaydev Vihar Congestion Hotspot
  const jaydevViharHotspot = projectGeoToSvg(20.301, 85.823);
  const rasulgarhSquareHotspot = projectGeoToSvg(20.292, 85.861);

  return (
    <div className="relative w-full rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden flex flex-col select-none">
      {/* 1. Header Toolbar */}
      <div className="px-4 py-3 bg-surface-low border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Bhubaneswar Vector GIS Canvas
            </span>
            <span className="text-[11px] text-on-surface-variant font-mono">
              Rasulgarh Depot Anchor (20.2961°N, 85.8645°E) • Pure Client Vector Projection
            </span>
          </div>
        </div>

        {/* Layer Controls & Zoom Buttons */}
        <div className="flex items-center gap-2">
          {/* Traffic Toggle */}
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
            <span>Traffic Overlay</span>
          </button>

          {/* Baseline Route Toggle */}
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
            <span>Baseline Path</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-surface-lowest border border-outline-variant rounded-md overflow-hidden">
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 2.0))}
              className="p-1 hover:bg-surface-low text-on-surface-variant"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-semibold px-1 text-on-surface">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.7))}
              className="p-1 hover:bg-surface-low text-on-surface-variant"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-1 border-l border-outline-variant hover:bg-surface-low text-on-surface-variant"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive SVG Vector Canvas */}
      <div className="relative w-full h-[520px] bg-slate-950 overflow-hidden cursor-crosshair">
        <svg
          viewBox="0 0 900 620"
          className="w-full h-full object-cover transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            {/* Glow Filter for 2-Opt Optimized Route */}
            <filter id="optGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Gradient for 2-Opt Optimized Path */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0051D5" />
              <stop offset="60%" stopColor="#316BF3" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            {/* Depot Pulse Radial Gradient */}
            <radialGradient id="depotPulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0051D5" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0051D5" stopOpacity="0" />
            </radialGradient>

            {/* Jaydev Vihar Congestion Radial Gradient */}
            <radialGradient id="trafficHotspot" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid Lines (Vector GIS Coordinates) */}
          <g stroke="#1E293B" strokeWidth="0.8" strokeDasharray="3,6">
            {[100, 200, 300, 400, 500, 600, 700, 800].map((x) => (
              <line key={`grid-x-${x}`} x1={x} y1="0" x2={x} y2="620" />
            ))}
            {[80, 160, 240, 320, 400, 480, 560].map((y) => (
              <line key={`grid-y-${y}`} x1="0" y1={y} x2="900" y2={y} />
            ))}
          </g>

          {/* Bhubaneswar Major Arterial Road Network Vector Traces */}
          <g stroke="#334155" strokeWidth="2.5" fill="none" opacity="0.6">
            {/* NH-16 Main Highway Corridor (Khandagiri -> Jaydev Vihar -> Rasulgarh) */}
            <path d="M 120 480 Q 320 330, 450 280 T 730 290 T 860 160" />
            {/* Nandankanan Road (Jaydev Vihar -> Chandrasekharpur -> Patia / KIIT) */}
            <path d="M 450 280 Q 420 180, 430 80" />
            {/* Janpath (Vani Vihar -> Saheed Nagar -> Station) */}
            <path d="M 600 280 Q 580 340, 540 440" />
            {/* Cuttack-Puri Bypass Road */}
            <path d="M 730 290 Q 750 420, 710 560" />
          </g>

          {/* Road Corridor Labels */}
          <text x="320" y="325" fill="#64748B" fontSize="9" fontFamily="monospace" transform="rotate(-15 320 325)">
            NH-16 EXPRESSWAY
          </text>
          <text x="440" y="160" fill="#64748B" fontSize="9" fontFamily="monospace" transform="rotate(-80 440 160)">
            NANDANKANAN ROAD
          </text>
          <text x="590" y="380" fill="#64748B" fontSize="9" fontFamily="monospace" transform="rotate(75 590 380)">
            JANPATH CORRIDOR
          </text>

          {/* Traffic Congestion Heatmap Overlays */}
          {showTrafficLayer && (
            <g className="animate-pulse">
              {/* Jaydev Vihar Choke Point */}
              <circle
                cx={jaydevViharHotspot.x}
                cy={jaydevViharHotspot.y}
                r="65"
                fill="url(#trafficHotspot)"
              />
              <circle
                cx={jaydevViharHotspot.x}
                cy={jaydevViharHotspot.y}
                r="8"
                fill="#EF4444"
                opacity="0.8"
              />
              <text
                x={jaydevViharHotspot.x + 12}
                y={jaydevViharHotspot.y - 10}
                fill="#F87171"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                ⚠ Jaydev Vihar (Congestion 2.2x)
              </text>

              {/* Rasulgarh Square Congestion */}
              <circle
                cx={rasulgarhSquareHotspot.x}
                cy={rasulgarhSquareHotspot.y}
                r="45"
                fill="url(#trafficHotspot)"
              />
            </g>
          )}

          {/* Landmark Region Labels */}
          {landmarks.map((lm) => (
            <g key={lm.name} opacity="0.75">
              <circle cx={lm.x} cy={lm.y} r="3" fill="#64748B" />
              <text
                x={lm.x + 6}
                y={lm.y + 4}
                fill="#94A3B8"
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="500"
              >
                {lm.name}
              </text>
            </g>
          ))}

          {/* 3. Baseline Naive Route Polyline (Dashed Amber/Slate) */}
          {showNaiveRoute && baselinePathD && (
            <path
              d={baselinePathD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="6,6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.75"
            />
          )}

          {/* 4. Optimized 2-Opt Route Polyline (Glowing Electric Blue / Emerald) */}
          {optimizedPathD && (
            <path
              d={optimizedPathD}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#optGlow)"
            />
          )}

          {/* 5. Rasulgarh Central Depot Hub Marker */}
          <g transform={`translate(${depotPt.x}, ${depotPt.y})`} className="cursor-pointer">
            {/* Outer animated halo */}
            <circle r="18" fill="url(#depotPulse)" className="animate-ping" opacity="0.6" />
            <circle r="14" fill="#0051D5" stroke="#FFFFFF" strokeWidth="2.5" />
            <rect x="-4.5" y="-4.5" width="9" height="9" fill="#FFFFFF" rx="1.5" />
            {/* Badge label */}
            <g transform="translate(18, -12)">
              <rect x="0" y="0" width="130" height="24" rx="4" fill="#0F172A" stroke="#0051D5" strokeWidth="1.5" />
              <text x="8" y="16" fill="#60A5FA" fontSize="10" fontWeight="bold" fontFamily="monospace">
                HUB: Rasulgarh
              </text>
            </g>
          </g>

          {/* 6. Numbered Delivery Stop Markers */}
          {projectedStops.map((stop, index) => {
            const isHovered =
              hoveredStopId === (stop.deliveryId || stop.orderReference || String(stop.sequenceOrder));
            const isFocused =
              focusedStopId === (stop.deliveryId || stop.orderReference || String(stop.sequenceOrder));

            // Color coding based on delivery priority
            let pinColor = '#0051D5'; // Standard
            if (stop.priority === 'Urgent') pinColor = '#EF4444';
            else if (stop.priority === 'Cold Chain') pinColor = '#06B6D4';

            return (
              <g
                key={`stop-${stop.deliveryId || index}`}
                transform={`translate(${stop.svgX}, ${stop.svgY})`}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={() => onHoverStop(stop.deliveryId || stop.orderReference || String(stop.sequenceOrder))}
                onMouseLeave={() => onHoverStop(null)}
                onClick={() => onSelectStop(stop.deliveryId || stop.orderReference || String(stop.sequenceOrder))}
              >
                {/* Glow ring if hovered or focused */}
                {(isHovered || isFocused) && (
                  <circle r="18" fill={pinColor} opacity="0.3" className="animate-pulse" />
                )}

                {/* Pin shadow */}
                <circle cy="3" r="11" fill="#000000" opacity="0.4" />

                {/* Stop marker circle */}
                <circle
                  r={isHovered || isFocused ? '13' : '10'}
                  fill={pinColor}
                  stroke="#FFFFFF"
                  strokeWidth={isHovered || isFocused ? '2.5' : '1.8'}
                />

                {/* Stop Sequence Number */}
                <text
                  y="3.5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize={isHovered || isFocused ? '10' : '9'}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {stop.sequenceOrder || index + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 7. Floating Vehicle Telemetry HUD Overlay */}
        <div className="absolute top-4 left-4 p-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 text-white shadow-xl max-w-xs space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-slate-100">
                {assignedVehicle?.vehicleId || 'OD-02-AK-1001'}
              </span>
            </div>
            <span className="text-[10px] bg-secondary/30 text-blue-300 font-mono px-2 py-0.5 rounded border border-secondary/40">
              {assignedVehicle?.type || 'Van'} • {assignedVehicle?.fuelType || 'Electric'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-mono">Battery / Energy</span>
              <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {assignedVehicle?.batterySoC ?? 92}% SoC
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase font-mono">Capacity Limit</span>
              <span className="font-mono font-semibold text-slate-200">
                {assignedVehicle?.capacityKg || 1000} kg
              </span>
            </div>
          </div>

          {/* Telemetry Stats */}
          {optimizationResult && (
            <div className="pt-1.5 border-t border-slate-800 text-[10px] font-mono text-slate-300 flex items-center justify-between">
              <span>2-Opt Converged:</span>
              <span className="text-emerald-400 font-bold">{optimizationResult.iterationsCount} iter ({optimizationResult.executionTimeMs}ms)</span>
            </div>
          )}
        </div>

        {/* 8. Active Hovered/Focused Stop Popover Tooltip */}
        {activeStop && (
          <div
            className="absolute p-3 bg-surface-lowest text-on-surface rounded-lg border border-outline-variant shadow-2xl z-20 pointer-events-none transition-all w-64"
            style={{
              left: Math.min(Math.max(activeStop.svgX - 120, 20), 620),
              top: Math.max(activeStop.svgY - 145, 20),
            }}
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant">
              <span className="text-xs font-bold font-mono text-secondary">
                Stop #{activeStop.sequenceOrder}
              </span>
              <span
                className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                  activeStop.priority === 'Urgent'
                    ? 'bg-red-100 text-red-800'
                    : activeStop.priority === 'Cold Chain'
                    ? 'bg-cyan-100 text-cyan-800'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {activeStop.priority || 'Standard'}
              </span>
            </div>

            <div className="mt-2 space-y-1 text-xs">
              <div className="font-semibold text-on-surface truncate">
                {activeStop.recipientName || 'Consignee Recipient'}
              </div>
              <div className="text-[11px] text-on-surface-variant flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 text-secondary shrink-0" />
                <span className="truncate">{activeStop.streetAddress || activeStop.zone || 'Bhubaneswar'}</span>
              </div>
              {activeStop.timeWindow && (
                <div className="text-[11px] text-on-surface-variant flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>{activeStop.timeWindow.start} - {activeStop.timeWindow.end}</span>
                </div>
              )}
              <div className="text-[11px] text-on-surface-variant flex items-center gap-1 font-mono">
                <Package className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{activeStop.weightKg} kg payload</span>
              </div>
            </div>
          </div>
        )}

        {/* Map Legend (Bottom Right) */}
        <div className="absolute bottom-3 right-3 p-2.5 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 text-white shadow-lg space-y-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 border border-white" />
            <span className="text-slate-300">Rasulgarh Depot Hub</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-gradient-to-r from-blue-500 to-emerald-400 rounded" />
            <span className="text-slate-300">Optimized 2-Opt Route</span>
          </div>
          {showNaiveRoute && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-400" />
              <span className="text-slate-300">Baseline Naive Sequence</span>
            </div>
          )}
          {showTrafficLayer && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-300">Congestion Hotspot</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
