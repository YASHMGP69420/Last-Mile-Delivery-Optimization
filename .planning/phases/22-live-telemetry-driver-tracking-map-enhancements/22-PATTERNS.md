# Phase 22: Live Telemetry Driver Tracking & Map Visual Enhancements - Pattern Map

**Mapped:** 2026-11-20  
**Phase Directory:** `.planning/phases/22-live-telemetry-driver-tracking-map-enhancements/`  
**Files Analyzed:** 10 (4 modified, 6 new)  
**Analogs Found:** 10 / 10 (100% matched)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `client/src/types/route.ts` | model / types | transform | `client/src/types/route.ts` | exact (in-place extension) |
| `client/src/components/maps/markerIcons.ts` | utility / svg-generator | transform | `client/src/components/maps/InteractiveMap.tsx` (`createStopIcon`, lines 113-174) | exact |
| `client/src/components/maps/CameraController.tsx` | component / hook-controller | event-driven | `client/src/components/maps/InteractiveMap.tsx` (`MapLifecycleGuard`, lines 37-50; `FitBounds`, lines 53-111) | exact |
| `client/src/components/maps/MapLegend.tsx` | component / overlay | request-response | `client/src/components/common/StatusBadge.tsx` & `client/src/components/common/Button.tsx` | role-match |
| `client/src/components/maps/InteractiveMap.tsx` | component / map canvas | event-driven & streaming | `client/src/components/maps/InteractiveMap.tsx` | exact (in-place enhancement) |
| `client/src/pages/admin/TrackingPage.tsx` | page / cockpit container | streaming & request-response | `client/src/pages/admin/TrackingPage.tsx` | exact (in-place enhancement) |
| `client/src/test/setup.ts` | config / test setup | batch | `client/src/test/setup.ts` (lines 41-95) | exact (in-place update) |
| `client/src/components/maps/__tests__/driverMarker.test.tsx` | test | batch | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | role-match |
| `client/src/components/maps/__tests__/statusPinIcons.test.tsx` | test | batch | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | role-match |
| `client/src/components/maps/__tests__/cameraController.test.tsx` | test | batch | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | role-match |
| `client/src/components/maps/__tests__/mapLegendFilters.test.tsx` | test | batch | `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` | role-match |

---

## Pattern Assignments

### 1. `client/src/types/route.ts` (model / types, transform)

**Analog:** `client/src/types/route.ts` (lines 48-76)  
**Tracked Source:** `client/src/types/route.ts`

**Imports Pattern:**
```typescript
import { DeliveryPriority } from './index';
```

**Core Extension Pattern:**
Extend `RouteStop` with optional live driver telemetry fields without breaking standard delivery stops:
```typescript
export interface RouteStop {
  sequenceOrder: number;              // 1-indexed (0 is Start Depot, N+1 is Return Depot)
  sequence?: number;
  isDepot?: boolean;
  deliveryId?: string;
  orderReference?: string;
  recipientName?: string;
  recipientPhone?: string;
  streetAddress?: string;
  zone?: string;
  coordinates: [number, number];      // [longitude, latitude] matching GeoJSON
  location?: { lat: number; lng: number };
  customer?: { name?: string; phone?: string };
  address?: { street?: string; zone?: string; city?: string; postalCode?: string };
  status?: string;
  priority?: DeliveryPriority;
  timeWindow?: {
    start: string;
    end: string;
  };
  weightKg: number;
  volumeM3?: number;
  eta?: string;
  estimatedArrival?: string;
  estimatedDeparture?: string;
  distanceFromPreviousKm: number;
  durationFromPreviousMin: number;
  googleMapsUrl?: string;

  // Phase 22 Live Telemetry Extensions
  isDriverMarker?: boolean;
  driverName?: string;
  headingDegrees?: number;
  speedKmh?: number;
  isStale?: boolean;
  vehicleId?: string;
}
```

---

### 2. `client/src/components/maps/markerIcons.ts` (utility / svg-generator, transform)

**Analog:** `client/src/components/maps/InteractiveMap.tsx` (lines 113-174)  
**Tracked Source:** `client/src/components/maps/InteractiveMap.tsx`

**Imports Pattern:**
```typescript
import L from 'leaflet';
import { RouteStop } from '../../types/route';
```

**Core Pattern (Driver Telemetry Marker & Status Pins):**
```typescript
/**
 * Generates pulsing navigation arrowhead oriented along headingDegrees
 * with anchored driver name and real-time speed pill.
 */
export function createDriverIcon(driver: {
  name: string;
  speedKmh: number;
  headingDegrees: number;
  isStale?: boolean;
}) {
  const heading = driver.headingDegrees || 0;
  const isMoving = (driver.speedKmh || 0) > 0;
  const isStale = Boolean(driver.isStale);

  const statusColor = isStale ? '#f59e0b' : isMoving ? '#10b981' : '#64748b';
  const pulseHtml = isMoving && !isStale
    ? `<span style="position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(16,185,129,0.25); animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite; z-index:1;"></span>`
    : '';

  return L.divIcon({
    className: 'custom-driver-telemetry-marker',
    iconSize: [140, 70],
    iconAnchor: [70, 48],
    popupAnchor: [0, -48],
    html: `
      <div style="position:relative; width:140px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:auto;">
        <!-- Live Driver & Speed Pill Badge -->
        <div style="z-index:10; margin-bottom:4px; display:flex; align-items:center; gap:5px; padding:3px 9px; border-radius:9999px; background:rgba(15,23,42,0.92); border:1px solid rgba(255,255,255,0.18); box-shadow:0 4px 12px rgba(0,0,0,0.35); font-family:sans-serif; white-space:nowrap;">
          <span style="width:7px; height:7px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
          <span style="color:#ffffff; font-size:11px; font-weight:700;">${driver.name}</span>
          <span style="color:#94a3b8; font-size:10px; font-weight:500;">•</span>
          <span style="color:${statusColor}; font-size:10px; font-weight:700; font-family:monospace;">
            ${isStale ? 'Stale' : isMoving ? `${Math.round(driver.speedKmh)} km/h` : 'Halt'}
          </span>
        </div>

        <!-- Navigation Arrowhead Container -->
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
          ${pulseHtml}
          <div style="position:relative; z-index:2; transform:rotate(${heading}deg); transform-origin:center center; transition:transform 0.3s ease;">
            <svg viewBox="0 0 32 32" width="32" height="32" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));">
              <polygon points="16,2 28,26 16,20 4,26" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    `,
  });
}

/**
 * Generates status-differentiated delivery pin icons:
 * - Completed: Flat, dimmed grey dot
 * - Cancelled / Failed: Red pin with diagonal slash-through banner
 * - Next Active: Pulsing bright indigo pin
 * - Pending: Vibrant emerald numbered pin
 */
export function createStatusStopIcon(
  stop: RouteStop,
  index: number,
  isSelected: boolean,
  isNextActive: boolean = false
) {
  const isDepot = Boolean(stop.isDepot || stop.orderReference === 'DEPOT' || stop.deliveryId === 'DEPOT');
  if (isDepot) {
    return createDepotIcon();
  }

  const status = String(stop.status || 'PENDING').toUpperCase();

  // 1. Completed Stop: Flat dimmed grey dot
  if (status === 'COMPLETED') {
    return L.divIcon({
      className: 'custom-stop-completed',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
      html: `
        <div style="width:18px; height:18px; border-radius:50%; background:#64748b; border:2px solid #ffffff; opacity:0.7; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
          <svg viewBox="0 0 24 24" width="10" height="10" stroke="#ffffff" stroke-width="3" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
      `,
    });
  }

  // 2. Cancelled or Failed Stop: Bold red pin with slash banner
  if (status === 'FAILED' || status === 'CANCELLED') {
    return L.divIcon({
      className: 'custom-stop-cancelled',
      iconSize: [34, 44],
      iconAnchor: [17, 42],
      popupAnchor: [0, -42],
      html: `
        <div style="position:relative; width:34px; height:44px;">
          <svg viewBox="0 0 34 44" width="34" height="44" style="filter:drop-shadow(0 2px 6px rgba(239,68,68,0.4));">
            <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
          </svg>
          <div style="position:absolute; top:4px; left:4px; width:26px; height:26px; background:#dc2626; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        </div>
      `,
    });
  }

  const sequenceNum = stop.sequenceOrder || stop.sequence || index + 1;

  // 3. Next Active Stop: Pulsing Bright Indigo
  if (isNextActive) {
    return L.divIcon({
      className: 'custom-stop-next-active',
      iconSize: [38, 48],
      iconAnchor: [19, 46],
      popupAnchor: [0, -46],
      html: `
        <div style="position:relative; width:38px; height:48px;">
          <div style="position:absolute; top:-4px; left:-4px; width:46px; height:46px; border-radius:50%; background:rgba(99,102,241,0.3); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <svg viewBox="0 0 34 44" width="38" height="48" style="filter:drop-shadow(0 4px 10px rgba(99,102,241,0.5));">
            <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="#6366f1" stroke="#ffffff" stroke-width="2.5"/>
          </svg>
          <div style="position:absolute; top:5px; left:6px; width:26px; height:26px; background:#4f46e5; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:800; font-size:12px; font-family:monospace;">
            ${sequenceNum}
          </div>
        </div>
      `,
    });
  }

  // 4. Standard Upcoming Pending Stop: Vibrant Emerald Pin
  const scale = isSelected ? 'transform: scale(1.15); z-index: 1000;' : '';
  return L.divIcon({
    className: 'custom-stop-pending',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative; width:34px; height:44px; ${scale} transition:transform 0.15s ease;">
        <svg viewBox="0 0 34 44" width="34" height="44" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="${isSelected ? '#312e81' : '#10b981'}" stroke="#ffffff" stroke-width="2"/>
        </svg>
        <div style="position:absolute; top:4px; left:4px; width:26px; height:26px; background:#059669; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:700; font-size:11px; font-family:monospace;">
          ${sequenceNum}
        </div>
      </div>
    `,
  });
}
```

---

### 3. `client/src/components/maps/CameraController.tsx` (component / hook-controller, event-driven)

**Analog:** `client/src/components/maps/InteractiveMap.tsx` (`MapLifecycleGuard`, lines 37-50; `FitBounds`, lines 53-111)  
**Tracked Source:** `client/src/components/maps/InteractiveMap.tsx`

**Imports Pattern:**
```typescript
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
```

**Core Controller Pattern (Programmatic FlyTo, Auto-Follow, and Drag Cancellation):**
```typescript
export interface CameraFocusTarget {
  coordinates: [number, number]; // [lat, lng]
  timestamp: number;
  zoom?: number;
}

interface CameraControllerProps {
  focusTarget: CameraFocusTarget | null;
  autoFollow: boolean;
  followCoordinates: [number, number] | null; // [lat, lng]
  onUserPan: () => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  focusTarget,
  autoFollow,
  followCoordinates,
  onUserPan,
}) => {
  const map = useMap();
  const lastFollowCoordsRef = useRef<string | null>(null);

  // Auto-follow cancellation listener: user drag or manual zoom disengages auto-follow
  useEffect(() => {
    const handleUserDrag = () => {
      onUserPan();
    };

    map.on('dragstart', handleUserDrag);
    return () => {
      map.off('dragstart', handleUserDrag);
    };
  }, [map, onUserPan]);

  // Explicit 'Find Driver' or 'Locate' action (smooth flyTo level 16)
  useEffect(() => {
    if (!focusTarget || !focusTarget.coordinates) return;
    const [lat, lng] = focusTarget.coordinates;
    if (isNaN(lat) || isNaN(lng)) return;

    try {
      map.flyTo([lat, lng], focusTarget.zoom ?? 16, {
        animate: true,
        duration: 1.2,
      });
    } catch {
      map.setView([lat, lng], focusTarget.zoom ?? 16);
    }
  }, [focusTarget, map]);

  // Real-time telemetry auto-follow smooth pan
  useEffect(() => {
    if (!autoFollow || !followCoordinates) return;
    const [lat, lng] = followCoordinates;
    if (isNaN(lat) || isNaN(lng)) return;

    const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastFollowCoordsRef.current === coordKey) return;
    lastFollowCoordsRef.current = coordKey;

    try {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    } catch {
      // Map may be unmounting
    }
  }, [autoFollow, followCoordinates, map]);

  return null;
};
```

---

### 4. `client/src/components/maps/MapLegend.tsx` (component / overlay, request-response)

**Analog:** `client/src/components/common/StatusBadge.tsx` (lines 41-51) & `client/src/components/common/Button.tsx`  
**Tracked Source:** `client/src/components/common/StatusBadge.tsx`

**Imports Pattern:**
```typescript
import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Navigation, CheckCircle2, Slash, Clock } from 'lucide-react';
import { clsx } from 'clsx';
```

**Core Legend & Filter Checklist Pattern:**
```typescript
export interface MarkerFilters {
  drivers: boolean;
  nextStop: boolean;
  pending: boolean;
  completed: boolean;
  cancelled: boolean;
}

interface MapLegendProps {
  filters: MarkerFilters;
  onToggleFilter: (key: keyof MarkerFilters) => void;
  className?: string;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  filters,
  onToggleFilter,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={clsx(
        'absolute bottom-6 left-6 z-[1000] pointer-events-auto rounded-xl border border-white/20 dark:border-obsidian-750 bg-white/80 dark:bg-obsidian-950/85 backdrop-blur-md shadow-xl transition-all duration-200 text-xs text-on-surface',
        className
      )}
    >
      {/* Header with Collapse / Expand Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 font-bold border-b border-outline-variant/30 hover:bg-surface-low/50 transition-colors rounded-t-xl"
        aria-label="Toggle Map Legend"
      >
        <span className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span>Map Legend & Layers</span>
        </span>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-on-surface-variant" /> : <ChevronUp className="w-4 h-4 text-on-surface-variant" />}
      </button>

      {/* Filter Checklist */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 select-none">
            <input
              type="checkbox"
              checked={filters.drivers}
              onChange={() => onToggleFilter('drivers')}
              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="w-3.5 h-3.5 flex items-center justify-center text-blue-500">
              <Navigation className="w-3 h-3 fill-current rotate-45" />
            </span>
            <span>Live Drivers</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 select-none">
            <input
              type="checkbox"
              checked={filters.nextStop}
              onChange={() => onToggleFilter('nextStop')}
              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 border border-white inline-block shadow-sm"></span>
            <span>Next Active Stop</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 select-none">
            <input
              type="checkbox"
              checked={filters.pending}
              onChange={() => onToggleFilter('pending')}
              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white inline-block shadow-sm"></span>
            <span>Pending Deliveries</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 select-none">
            <input
              type="checkbox"
              checked={filters.completed}
              onChange={() => onToggleFilter('completed')}
              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="w-3.5 h-3.5 rounded-full bg-slate-400 border border-white inline-block opacity-75"></span>
            <span>Completed (Delivered)</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 select-none">
            <input
              type="checkbox"
              checked={filters.cancelled}
              onChange={() => onToggleFilter('cancelled')}
              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white inline-block shadow-sm"></span>
            <span>Cancelled / Failed</span>
          </label>

          {/* Polyline Indicators */}
          <div className="pt-2 border-t border-outline-variant/30 space-y-1.5 text-[11px] text-on-surface-variant font-mono">
            <div className="flex items-center gap-2">
              <span className="w-6 border-b-2 border-dashed border-slate-400"></span>
              <span>Traversed Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 border-b-2 border-solid border-emerald-500"></span>
              <span>Remaining Route</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### 5. `client/src/components/maps/InteractiveMap.tsx` (component / map canvas, event-driven & streaming)

**Analog:** `client/src/components/maps/InteractiveMap.tsx` (lines 1-393)  
**Tracked Source:** `client/src/components/maps/InteractiveMap.tsx`

**Imports Pattern:**
```typescript
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { RouteStop } from '../../types/route';
import { useTheme } from '../../context/ThemeContext';
import { CameraController, CameraFocusTarget } from './CameraController';
import { MapLegend, MarkerFilters } from './MapLegend';
import { createDriverIcon, createStatusStopIcon } from './markerIcons';
import { Crosshair, Navigation, LocateFixed } from 'lucide-react';
```

**Props Pattern & Core Composition:**
```typescript
interface Props {
  stops: RouteStop[];
  routePath?: [number, number][]; // [lng, lat]
  traversedPath?: [number, number][]; // [lng, lat]
  remainingPath?: [number, number][]; // [lng, lat]
  baselineRoutePath?: [number, number][]; // [lng, lat]
  defaultCenter?: [number, number]; // [lat, lng]
  selectedStopId?: string;
  onSelectStop?: (stop: RouteStop) => void;

  // Phase 22 Camera & Tracking Enhancements
  cameraFocusTarget?: CameraFocusTarget | null;
  autoFollowEnabled?: boolean;
  followCoordinates?: [number, number] | null; // [lat, lng]
  onUserPan?: () => void;
  onToggleAutoFollow?: () => void;
  onLocateDriver?: () => void;
}
```

**Dual Polyline & Floating Controls Integration:**
```typescript
{/* Traversed Route Segment (Muted Dashed) */}
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

{/* Remaining Route Segment (Solid Vibrant Emerald) */}
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

{/* Floating Tactical 'Find Driver' & 'Auto-Follow' Canvas Controls */}
<div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-auto">
  {onLocateDriver && (
    <button
      onClick={onLocateDriver}
      className="p-2.5 rounded-xl bg-white/90 dark:bg-obsidian-950/90 backdrop-blur border border-white/20 dark:border-obsidian-750 shadow-lg text-primary hover:bg-surface-low transition-colors"
      title="Find Driver (Center & Zoom 16)"
    >
      <Crosshair className="w-5 h-5" />
    </button>
  )}
  {onToggleAutoFollow && (
    <button
      onClick={onToggleAutoFollow}
      className={clsx(
        'px-2.5 py-1.5 rounded-xl backdrop-blur border text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors',
        autoFollowEnabled
          ? 'bg-primary text-white border-primary shadow-emerald'
          : 'bg-white/90 dark:bg-obsidian-950/90 border-white/20 dark:border-obsidian-750 text-on-surface'
      )}
      title="Toggle Auto-Follow Driver"
    >
      <LocateFixed className="w-3.5 h-3.5" />
      <span>{autoFollowEnabled ? 'Follow On' : 'Follow Off'}</span>
    </button>
  )}
</div>

{/* Floating Map Legend with Filter Checklist */}
<MapLegend filters={filters} onToggleFilter={handleToggleFilter} />
```

---

### 6. `client/src/pages/admin/TrackingPage.tsx` (page / cockpit container, streaming & request-response)

**Analog:** `client/src/pages/admin/TrackingPage.tsx` (lines 381-399, lines 551-630)  
**Tracked Source:** `client/src/pages/admin/TrackingPage.tsx`

**Driver Marker & Route Slicing Pattern (Replacing Numeric '1' Pin):**
```typescript
// Replace sequenceOrder: idx + 1 with isDriverMarker: true
const vehicleGpsStops = vehicles
  .map((v) => {
    const t = telemetryMap[v.id];
    if (!t || !Array.isArray(t.coordinates) || t.coordinates.length < 2) return null;
    const drv = getDriverForVehicle(v);
    return {
      isDriverMarker: true,
      driverName: getDriverName(drv),
      headingDegrees: t.headingDegrees || 0,
      speedKmh: t.speedKmh || 0,
      isStale: t.isStale,
      vehicleId: v.vehicleId,
      deliveryId: `driver-${v.id}`,
      orderReference: `${v.vehicleId} • DRIVER`,
      coordinates: t.coordinates as [number, number], // [lng, lat]
    };
  })
  .filter(Boolean) as any[];

// Split active route polyline into traversed vs remaining
const { traversedPath, remainingPath } = useMemo(() => {
  if (!activeRouteForVehicle) return { traversedPath: undefined, remainingPath: undefined };
  
  const allStops = activeRouteForVehicle.stops || [];
  const selectedTelem = selectedVehicle ? telemetryMap[selectedVehicle.id] : null;
  const currentCoords = selectedTelem?.coordinates;

  // Separate completed stops vs pending stops
  const completedCoords = allStops
    .filter((s: any) => s.status === 'COMPLETED' && Array.isArray(s.coordinates))
    .map((s: any) => s.coordinates as [number, number]);

  const pendingCoords = allStops
    .filter((s: any) => s.status !== 'COMPLETED' && Array.isArray(s.coordinates))
    .map((s: any) => s.coordinates as [number, number]);

  const traversed = currentCoords && completedCoords.length > 0
    ? [...completedCoords, currentCoords]
    : undefined;

  const remaining = currentCoords && pendingCoords.length > 0
    ? [currentCoords, ...pendingCoords]
    : undefined;

  return { traversedPath: traversed, remainingPath: remaining };
}, [activeRouteForVehicle, selectedVehicle, telemetryMap]);
```

**Sidebar Locate Shortcut Pattern:**
```typescript
{/* Locate Button on Vehicle Card */}
<button
  onClick={(e) => {
    e.stopPropagation();
    setSelectedVehicle(v);
    handleLocateVehicle(v);
  }}
  className="p-1.5 rounded-lg border border-outline-variant hover:bg-surface-low text-primary transition-colors"
  title="Locate Driver on Map"
>
  <Crosshair className="w-3.5 h-3.5" />
</button>
```

---

### 7. `client/src/test/setup.ts` (config / test setup, batch)

**Analog:** `client/src/test/setup.ts` (lines 41-95)  
**Tracked Source:** `client/src/test/setup.ts`

**Core Pattern (Leaflet DivIcon Mock):**
```typescript
const mockL = {
  // Existing methods ...
  icon: vi.fn(() => ({
    options: {},
  })),
  // Add divIcon to resolve TypeError: L.divIcon is not a function
  divIcon: vi.fn((opts) => ({
    options: opts,
    ...opts,
  })),
  // Existing methods ...
};
```

---

### 8. `client/src/components/maps/__tests__/*.test.tsx` (test, batch)

**Analog:** `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx` (lines 1-35)  
**Tracked Source:** `client/src/components/admin/__tests__/ActiveOperationConflictModal.test.tsx`

**Imports Pattern:**
```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
```

**Unit Test Structure for Marker Icons:**
```typescript
describe('createDriverIcon', () => {
  it('generates divIcon with rotated arrowhead matching heading and live speed pill', () => {
    const icon = createDriverIcon({
      name: 'Rajesh',
      speedKmh: 34,
      headingDegrees: 90,
      isStale: false,
    });

    expect(icon.options.className).toBe('custom-driver-telemetry-marker');
    expect(icon.options.html).toContain('Rajesh');
    expect(icon.options.html).toContain('34 km/h');
    expect(icon.options.html).toContain('rotate(90deg)');
    expect(icon.options.html).toContain('animation:ping');
  });

  it('renders stationary halt badge when speed is 0', () => {
    const icon = createDriverIcon({
      name: 'Priya',
      speedKmh: 0,
      headingDegrees: 0,
      isStale: false,
    });

    expect(icon.options.html).toContain('Priya');
    expect(icon.options.html).toContain('Halt');
  });
});
```

---

## Shared Patterns

### 1. Leaflet React Lifecycle Guard & Programmatic Control
**Source:** `client/src/components/maps/InteractiveMap.tsx` (`MapLifecycleGuard`, lines 37-50)  
**Apply to:** `InteractiveMap.tsx`, `CameraController.tsx`  
Child components inside `<MapContainer>` must use the `useMap()` hook. Always clear active zoom/pan animations on unmount:
```typescript
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
```

### 2. GeoJSON vs Leaflet Coordinate Mapping
**Source:** `client/src/components/maps/InteractiveMap.tsx` (lines 72-76, 245-247)  
**Apply to:** `InteractiveMap.tsx`, `TrackingPage.tsx`, `CameraController.tsx`  
- GeoJSON / Database storage: `[longitude, latitude]`
- Leaflet `Marker`, `Polyline`, `flyTo`, and `panTo`: `[latitude, longitude]`
- Conversion idiom:
```typescript
const [lng, lat] = coordinates;
const leafletPosition: [number, number] = [lat, lng];
```

### 3. Glassmorphic HUD Tactical Overlay Styling
**Source:** `client/src/components/maps/InteractiveMap.tsx`, `client/src/pages/admin/TrackingPage.tsx`  
**Apply to:** `MapLegend.tsx`, Floating crosshair and auto-follow button controls  
Use semi-transparent blurred backgrounds that float over the Leaflet canvas (`z-[1000] pointer-events-auto`):
```css
bg-white/85 dark:bg-obsidian-950/85 backdrop-blur-md border border-white/20 dark:border-obsidian-750 shadow-xl
```

### 4. Dynamic SVG/HTML Generation in L.divIcon
**Source:** `client/src/components/maps/InteractiveMap.tsx` (`createStopIcon`, lines 113-174)  
**Apply to:** `markerIcons.ts`  
Generate pure inline SVG templates with explicit pixel dimensions, anchor offsets, and CSS transforms without adding third-party canvas rotation plugins.

---

## No Analog Found

*None.* Every component, utility, type extension, and test has a direct in-repo analog.

---

## Metadata

**Analog Search Scope:**
- `client/src/components/maps/`
- `client/src/pages/admin/`
- `client/src/components/common/`
- `client/src/types/`
- `client/src/test/`

**Files Scanned:** 18 files across client codebase  
**Pattern Extraction Date:** 2026-11-20
