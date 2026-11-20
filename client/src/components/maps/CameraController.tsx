import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

export interface CameraFocusTarget {
  coordinates: [number, number]; // [lat, lng]
  timestamp: number;
  zoom?: number;
}

export interface CameraControllerProps {
  focusTarget: CameraFocusTarget | null;
  autoFollow: boolean;
  followCoordinates: [number, number] | null; // [lat, lng]
  onUserPan: () => void;
}

/**
 * Programmatic Leaflet Camera Controller using react-leaflet useMap() hook (D-04, D-05, D-06):
 * - Smooth flyTo centering on focusTarget coordinates (default zoom 16)
 * - Real-time auto-follow smooth panTo incoming driver telemetry coordinates
 * - Listens for dragstart and zoomstart to disengage auto-follow on manual user interaction
 * - Validates finite coordinates to prevent Leaflet runtime crashes (T-22-02)
 */
export const CameraController: React.FC<CameraControllerProps> = ({
  focusTarget,
  autoFollow,
  followCoordinates,
  onUserPan,
}) => {
  const map = useMap();
  const lastFollowCoordsRef = useRef<string | null>(null);

  // User manual pan/drag or zoom listener: disengage auto-follow mode (D-06)
  useEffect(() => {
    if (!map) return;

    const handleUserInteraction = () => {
      onUserPan();
    };

    map.on('dragstart', handleUserInteraction);
    map.on('zoomstart', handleUserInteraction);

    return () => {
      try {
        map.off('dragstart', handleUserInteraction);
        map.off('zoomstart', handleUserInteraction);
      } catch {
        // Safe teardown
      }
    };
  }, [map, onUserPan]);

  // Explicit 'Find Driver' / 'Locate' action (smooth flyTo level 16)
  useEffect(() => {
    if (!map || !focusTarget || !focusTarget.coordinates) return;
    const [lat, lng] = focusTarget.coordinates;
    // T-22-02 DoS check: validate finite numeric coordinates
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      !isFinite(lat) ||
      !isFinite(lng)
    ) {
      return;
    }

    const zoom = focusTarget.zoom ?? 16;
    try {
      map.flyTo([lat, lng], zoom, {
        animate: true,
        duration: 1.2,
      });
    } catch {
      try {
        map.setView([lat, lng], zoom);
      } catch {
        // Fallback or unmount
      }
    }
  }, [focusTarget, map]);

  // Real-time telemetry auto-follow smooth pan (D-06)
  useEffect(() => {
    if (!map || !autoFollow || !followCoordinates) return;
    const [lat, lng] = followCoordinates;
    // T-22-02 DoS check
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      !isFinite(lat) ||
      !isFinite(lng)
    ) {
      return;
    }

    const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastFollowCoordsRef.current === coordKey) return;
    lastFollowCoordsRef.current = coordKey;

    try {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    } catch {
      // Map may be unmounting
    }
  }, [autoFollow, followCoordinates, map]);

  // Ensure map animation is stopped cleanly on unmount
  useEffect(() => {
    return () => {
      try {
        map?.stop?.();
      } catch {
        // Safe teardown
      }
    };
  }, [map]);

  return null;
};

export default CameraController;
