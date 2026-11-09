import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { DriverHudApi } from '../api/client';

export type SocketConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface DriverNotification {
  id: string;
  type: 'ROUTE_DISPATCHED' | 'ROUTE_REORDERED' | 'ROUTE_CANCELLED' | 'STOP_CANCELLED' | 'PRIORITY_ESCALATED' | 'MESSAGE' | 'INFO';
  title: string;
  message: string;
  timestamp: Date;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

interface DriverSocketContextType {
  socket: Socket | null;
  connectionStatus: SocketConnectionStatus;
  lastNotification: DriverNotification | null;
  clearNotification: () => void;
  refreshKey: number;
  triggerRefresh: () => void;
  activeRouteId: string | null;
  driverId: string | null;
}

const DriverSocketContext = createContext<DriverSocketContextType | undefined>(undefined);

/**
 * Synthesizes a clean dual-tone mobile dispatch chime using Web Audio API
 */
function playAudioChime(type: 'dispatch' | 'alert' | 'update' = 'dispatch') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'alert') {
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.setValueAtTime(660, now + 0.15);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now);
    } else {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.0, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.1);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (err) {
    // Audio context may be restricted by user agent autoplay policy
  }
}

export const DriverSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('disconnected');
  const [lastNotification, setLastNotification] = useState<DriverNotification | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  const clearNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Fetch driver profile and initial active route to know rooms to join
  useEffect(() => {
    let isMounted = true;
    const fetchIdentity = async () => {
      try {
        const res = await DriverHudApi.getDashboard();
        if (isMounted && res.data) {
          if (res.data.driver?.id) setDriverId(res.data.driver.id);
          if (res.data.activeRoute?.id) setActiveRouteId(res.data.activeRoute.id);
        }
      } catch (err) {
        // Fallback for simulation
      }
    };
    fetchIdentity();
    return () => {
      isMounted = false;
    };
  }, [user, refreshKey]);

  // Join driver and route rooms as soon as IDs become available
  useEffect(() => {
    if (socketRef.current?.connected && driverId) {
      socketRef.current.emit('driver:join', { driverId });
    }
  }, [driverId]);

  useEffect(() => {
    if (socketRef.current?.connected && activeRouteId) {
      socketRef.current.emit('route:join', { routeId: activeRouteId });
    }
  }, [activeRouteId]);

  // Connect and manage persistent socket lifecycle
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      withCredentials: true,
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
      if (activeRouteId) {
        socket.emit('route:join', { routeId: activeRouteId });
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[DriverSocket] Handshake / connection error:', err.message);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      if (driverId) socket.emit('driver:join', { driverId });
      if (activeRouteId) socket.emit('route:join', { routeId: activeRouteId });
      triggerRefresh();
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    // 1. New Route Dispatched Event
    const handleRouteDispatched = (payload: any) => {
      playAudioChime('dispatch');
      if (payload?.routeId) setActiveRouteId(payload.routeId);
      const notif: DriverNotification = {
        id: `disp-${Date.now()}`,
        type: 'ROUTE_DISPATCHED',
        title: 'New Route Dispatched',
        message: payload?.routeCode
          ? `Route #${payload.routeCode} with ${payload?.stopsCount || ''} stops assigned to your vehicle.`
          : 'A new delivery route has been assigned to your vehicle.',
        timestamp: new Date(),
        severity: 'INFO',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 2. Route Re-ordered / Stop Sequence Updated Event
    const handleRouteReordered = (payload: any) => {
      playAudioChime('update');
      const notif: DriverNotification = {
        id: `reord-${Date.now()}`,
        type: 'ROUTE_REORDERED',
        title: 'Stop Sequence Updated',
        message: 'Dispatch updated stop sequence for traffic optimization.',
        timestamp: new Date(),
        severity: 'INFO',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 3. Route Cancelled Event
    const handleRouteCancelled = (payload: any) => {
      playAudioChime('alert');
      setActiveRouteId(null);
      const notif: DriverNotification = {
        id: `rcanc-${Date.now()}`,
        type: 'ROUTE_CANCELLED',
        title: 'Route Cancelled by Dispatch',
        message: payload?.reason || 'Current route was cancelled and resources returned to pool.',
        timestamp: new Date(),
        severity: 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 4. Stop Cancelled Event
    const handleStopCancelled = (payload: any) => {
      playAudioChime('alert');
      const notif: DriverNotification = {
        id: `canc-${Date.now()}`,
        type: 'STOP_CANCELLED',
        title: 'Delivery Stop Cancelled',
        message: `Consignment #${payload?.orderReference || ''} was removed from your route.`,
        timestamp: new Date(),
        severity: 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 5. Priority Escalation Event
    const handlePriorityEscalated = (payload: any) => {
      playAudioChime('alert');
      const notif: DriverNotification = {
        id: `prio-${Date.now()}`,
        type: 'PRIORITY_ESCALATED',
        title: 'Priority Escalation',
        message: `Order #${payload?.orderReference || 'Package'} has been escalated to ${payload?.newPriority || 'Urgent'}.`,
        timestamp: new Date(),
        severity: 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 6. Direct Dispatcher Message / Instruction Event
    const handleDispatchMessage = (payload: any) => {
      playAudioChime('alert');
      const notif: DriverNotification = {
        id: `msg-${Date.now()}`,
        type: 'MESSAGE',
        title: payload?.title || 'Dispatch Instruction',
        message: payload?.message || 'Notice received from Central Dispatch.',
        timestamp: new Date(),
        severity: payload?.severity || 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    // 7. General Delivery Status Change Event
    const handleDeliveryUpdated = () => {
      triggerRefresh();
    };

    socket.on('route:dispatched', handleRouteDispatched);
    socket.on('route:reordered', handleRouteReordered);
    socket.on('route:updated', handleRouteReordered);
    socket.on('route:cancelled', handleRouteCancelled);
    socket.on('stop:cancelled', handleStopCancelled);
    socket.on('stop:priority_escalated', handlePriorityEscalated);
    socket.on('dispatch:message', handleDispatchMessage);
    socket.on('telemetry:alert', handleDispatchMessage);
    socket.on('delivery:updated', handleDeliveryUpdated);
    socket.on('route:progress', handleDeliveryUpdated);

    return () => {
      socket.off('route:dispatched', handleRouteDispatched);
      socket.off('route:reordered', handleRouteReordered);
      socket.off('route:updated', handleRouteReordered);
      socket.off('route:cancelled', handleRouteCancelled);
      socket.off('stop:cancelled', handleStopCancelled);
      socket.off('stop:priority_escalated', handlePriorityEscalated);
      socket.off('dispatch:message', handleDispatchMessage);
      socket.off('telemetry:alert', handleDispatchMessage);
      socket.off('delivery:updated', handleDeliveryUpdated);
      socket.off('route:progress', handleDeliveryUpdated);
      socket.disconnect();
    };
  }, [user, driverId, activeRouteId, triggerRefresh]);

  return (
    <DriverSocketContext.Provider
      value={{
        socket: socketRef.current,
        connectionStatus,
        lastNotification,
        clearNotification,
        refreshKey,
        triggerRefresh,
        activeRouteId,
        driverId,
      }}
    >
      {children}
    </DriverSocketContext.Provider>
  );
};

export const useDriverSocketContext = () => {
  const context = useContext(DriverSocketContext);
  if (!context) {
    throw new Error('useDriverSocketContext must be used within a DriverSocketProvider');
  }
  return context;
};
