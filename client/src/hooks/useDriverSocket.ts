import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type SocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface DriverSocketNotification {
  id: string;
  type: 'ROUTE_DISPATCHED' | 'ROUTE_REORDERED' | 'STOP_CANCELLED' | 'ALERT' | 'INFO';
  title: string;
  message: string;
  timestamp: Date;
}

interface UseDriverSocketProps {
  driverId?: string;
  routeId?: string;
  onRouteDispatched?: (payload: any) => void;
  onRouteUpdated?: (payload: any) => void;
  onStopCancelled?: (payload: any) => void;
}

/**
 * Synthesizes a clean dual-tone mobile dispatch chime using Web Audio API
 */
function playDispatchChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.0, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (err) {
    // Audio context may be restricted by browser gesture policies
  }
}

export function useDriverSocket({
  driverId,
  routeId,
  onRouteDispatched,
  onRouteUpdated,
  onStopCancelled,
}: UseDriverSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('disconnected');
  const [lastNotification, setLastNotification] = useState<DriverSocketNotification | null>(null);

  const clearNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    // Connect to Socket.IO gateway
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: {
        token,
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      if (driverId) {
        socket.emit('driver:join', { driverId });
      }
      if (routeId) {
        socket.emit('route:join', { routeId });
      }
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    // 1. New Route Dispatched Event
    const handleRouteDispatched = (payload: any) => {
      playDispatchChime();
      const notif: DriverSocketNotification = {
        id: `disp-${Date.now()}`,
        type: 'ROUTE_DISPATCHED',
        title: 'New Route Dispatched',
        message: payload?.routeCode
          ? `Route #${payload.routeCode} has been assigned to your vehicle.`
          : 'A new delivery route has been assigned to your vehicle.',
        timestamp: new Date(),
      };
      setLastNotification(notif);
      onRouteDispatched?.(payload);
    };

    // 2. Route Re-ordered / Re-optimized Event
    const handleRouteUpdated = (payload: any) => {
      playDispatchChime();
      const notif: DriverSocketNotification = {
        id: `reord-${Date.now()}`,
        type: 'ROUTE_REORDERED',
        title: 'Route Sequence Updated',
        message: 'Dispatch re-optimized your stop sequence for optimal traffic.',
        timestamp: new Date(),
      };
      setLastNotification(notif);
      onRouteUpdated?.(payload);
    };

    // 3. Stop Cancelled Event
    const handleStopCancelled = (payload: any) => {
      const notif: DriverSocketNotification = {
        id: `canc-${Date.now()}`,
        type: 'STOP_CANCELLED',
        title: 'Delivery Stop Cancelled',
        message: `Order #${payload?.orderReference || 'Consignment'} was cancelled by dispatch.`,
        timestamp: new Date(),
      };
      setLastNotification(notif);
      onStopCancelled?.(payload);
    };

    // 4. Emergency Telemetry Alert Event
    const handleAlert = (payload: any) => {
      playDispatchChime();
      const notif: DriverSocketNotification = {
        id: `alert-${Date.now()}`,
        type: 'ALERT',
        title: payload?.title || 'Dispatch Alert',
        message: payload?.message || 'Important operational notice from Rasulgarh Hub.',
        timestamp: new Date(),
      };
      setLastNotification(notif);
    };

    socket.on('route:dispatched', handleRouteDispatched);
    socket.on('route:reordered', handleRouteUpdated);
    socket.on('route:updated', handleRouteUpdated);
    socket.on('telemetry:route:update', handleRouteUpdated);
    socket.on('stop:cancelled', handleStopCancelled);
    socket.on('telemetry:alert', handleAlert);

    return () => {
      socket.off('route:dispatched', handleRouteDispatched);
      socket.off('route:reordered', handleRouteUpdated);
      socket.off('route:updated', handleRouteUpdated);
      socket.off('telemetry:route:update', handleRouteUpdated);
      socket.off('stop:cancelled', handleStopCancelled);
      socket.off('telemetry:alert', handleAlert);
      socket.disconnect();
    };
  }, [driverId, routeId, onRouteDispatched, onRouteUpdated, onStopCancelled]);

  return {
    socket: socketRef.current,
    connectionStatus,
    lastNotification,
    clearNotification,
  };
}
