import React, { useState } from 'react';
import { Button } from '../common/Button';
import {
  urlForLocation,
  urlForDirections,
  urlForMultiStopRoute,
  buildRouteSegments,
  injectDeviceLocationIntoUrl,
  buildNavigationUrl,
  toLatLng,
  LatLng,
} from '../../utils/googleMaps';
import { ExternalLink, Navigation, Compass, ChevronDown } from 'lucide-react';

interface Props {
  stops: { coordinates: [number, number]; isDepot?: boolean }[];
  routePath?: [number, number][];
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  mode?: 'original' | 'optimized' | 'next-stop' | 'auto';
  directUrl?: string;
}

export const OpenInGoogleMapsButton: React.FC<Props> = ({
  stops,
  routePath,
  label,
  variant = 'secondary',
  size = 'sm',
  mode = 'auto',
  directUrl,
}) => {
  const [showSegments, setShowSegments] = useState(false);

  // Extract valid [lat, lng] array
  const rawCoords =
    routePath && routePath.length > 0
      ? routePath
      : stops
          .filter((s) => Array.isArray(s?.coordinates) && s.coordinates.length >= 2)
          .map((s) => s.coordinates);

  const latLngStops: LatLng[] = rawCoords
    .map(toLatLng)
    .filter((c): c is LatLng => c !== null);

  const segments = buildRouteSegments(latLngStops);

  const handleClick = () => {
    if (directUrl) {
      window.open(injectDeviceLocationIntoUrl(directUrl), '_blank', 'noopener,noreferrer');
      return;
    }

    if (latLngStops.length === 0) return;

    if (mode === 'next-stop') {
      const nextDest = latLngStops.length >= 2 ? latLngStops[1] : latLngStops[0];
      const url = buildNavigationUrl({ destination: nextDest });
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (segments.length > 1) {
      setShowSegments((prev) => !prev);
      return;
    }

    const targetUrl = segments.length > 0 ? segments[0].url : urlForMultiStopRoute(latLngStops);
    if (targetUrl) {
      window.open(injectDeviceLocationIntoUrl(targetUrl), '_blank', 'noopener,noreferrer');
    }
  };

  const defaultLabel =
    mode === 'original'
      ? 'Open Original Route in Google Maps'
      : mode === 'optimized'
      ? 'Open Optimized Route in Google Maps'
      : mode === 'next-stop'
      ? 'Navigate to Next Stop'
      : 'Open in Google Maps';

  const buttonText = label || defaultLabel;
  const hasStops = (stops && stops.length > 0) || (routePath && routePath.length > 0) || Boolean(directUrl);

  const IconComponent = mode === 'next-stop' ? Navigation : ExternalLink;

  return (
    <div className="relative inline-block">
      <Button
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={!hasStops}
        aria-label={buttonText}
        aria-expanded={segments.length > 1 ? showSegments : undefined}
        leftIcon={<IconComponent className="w-3.5 h-3.5" />}
        rightIcon={segments.length > 1 ? <ChevronDown className="w-3.5 h-3.5 ml-1" /> : undefined}
      >
        {buttonText}
      </Button>

      {/* Multi-leg segment popup for long routes */}
      {showSegments && segments.length > 1 && (
        <div className="absolute left-0 mt-1.5 w-64 bg-surface-lowest rounded-2xl shadow-floating border border-outline-variant/60 z-50 p-2 space-y-1 text-xs" role="menu" aria-label="Route legs">
          <div className="font-semibold text-on-surface px-2 py-1 text-[11px] text-on-surface-variant border-b border-outline-variant/40">
            Select Route Leg ({latLngStops.length} Total Waypoints):
          </div>
          {segments.map((seg, idx) => (
            <a
              key={idx}
              href={injectDeviceLocationIntoUrl(seg.url)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              aria-label={`Open leg: ${seg.label}`}
              onClick={() => setShowSegments(false)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-low text-on-surface transition-colors"
            >
              <span className="font-semibold text-primary">{seg.label}</span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {seg.stopCount} stops →
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
