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
  read?: boolean;
}

interface DriverSocketContextType {
  socket: Socket | null;
  connectionStatus: SocketConnectionStatus;
  lastNotification: DriverNotification | null;
  notifications: DriverNotification[];
  unreadCount: number;
  clearNotification: () => void;
  markNotificationRead: (id: string) => Promise<void>;
  refreshKey: number;
  triggerRefresh: () => void;
  activeRouteId: string | null;
  driverId: string | null;
  shiftStatus: string | null;
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
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.15);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.0, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);
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
  } catch {
    // Audio context may be restricted before user gesture
  }
}

export const DriverSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const driverIdRef = useRef<string | null>(null);
  const activeRouteIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const lastSpeedRef = useRef<number>(0);

  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('disconnected');
  const [lastNotification, setLastNotification] = useState<DriverNotification | null>(null);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [shiftStatus, setShiftStatus] = useState<string | null>(null);

  useEffect(() => {
    driverIdRef.current = driverId;
  }, [driverId]);

  useEffect(() => {
    activeRouteIdRef.current = activeRouteId;
  }, [activeRouteId]);

  useEffect(() => {
    userIdRef.current = user?.id || (user as any)?._id || null;
  }, [user]);

  const clearNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await DriverHudApi.getNotifications();
      const raw = res.data?.notifications || [];
      const currentUserId = user.id || (user as any)?._id;
      const mapped: DriverNotification[] = raw.map((n: any) => ({
        id: String(n._id || n.id),
        type: 'MESSAGE',
        title: n.title || 'Dispatch Notice',
        message: n.message || '',
        timestamp: new Date(n.createdAt || Date.now()),
        severity: n.severity || 'INFO',
        read: Array.isArray(n.readBy) && currentUserId ? n.readBy.some((id: any) => String(id) === String(currentUserId)) : false,
      }));
      setNotifications(mapped);
    } catch {
      // Non-fatal if endpoint unavailable briefly
    }
  }, [user]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (!id) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (lastNotification?.id === id) {
      setLastNotification(null);
    }
    try {
      await DriverHudApi.markNotificationRead(id);
    } catch {
      // Best-effort server persistence
    }
  }, [lastNotification]);

  // Fetch driver identity, active route, shift status & persisted notifications
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchIdentity = async () => {
      try {
        const res = await DriverHudApi.getDashboard();
        if (isMounted && res.data) {
          if (res.data.driver?.id) setDriverId(res.data.driver.id);
          setActiveRouteId(res.data.activeRoute?.id || null);
          setShiftStatus(res.data.shift?.status || null);
        }
      } catch {
        // Ignore transient failure
      }
    };
    fetchIdentity();
    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [user?.id, refreshKey, loadNotifications]);

  // Dynamically join driver and route rooms when IDs resolve or change without tearing down Socket.IO
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

  // Connect and maintain a persistent Socket.IO connection tied to session lifecycle only
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || !user) {
      setConnectionStatus('disconnected');
      return;
    }

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      withCredentials: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      if (driverIdRef.current) socket.emit('driver:join', { driverId: driverIdRef.current });
      if (activeRouteIdRef.current) socket.emit('route:join', { routeId: activeRouteIdRef.current });
    });

    socket.on('connect_error', (err) => {
      console.warn('[DriverSocket] Connection error:', err.message);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      if (driverIdRef.current) socket.emit('driver:join', { driverId: driverIdRef.current });
      if (activeRouteIdRef.current) socket.emit('route:join', { routeId: activeRouteIdRef.current });
      triggerRefresh();
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    const belongsToThisDriver = (payload: any) => {
      if (payload?.driverId && driverIdRef.current && String(payload.driverId) !== String(driverIdRef.current)) {
        return false;
      }
      return true;
    };

    const handleRouteDispatched = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
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

    const handleRouteReordered = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
      playAudioChime('update');
      const notif: DriverNotification = {
        id: `reord-${Date.now()}`,
        type: 'ROUTE_REORDERED',
        title: 'Stop Sequence Updated',
        message: 'Dispatch updated stop sequence for your route.',
        timestamp: new Date(),
        severity: 'INFO',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    const handleRouteCancelled = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
      playAudioChime('alert');
      setActiveRouteId(null);
      const notif: DriverNotification = {
        id: `rcanc-${Date.now()}`,
        type: 'ROUTE_CANCELLED',
        title: 'Route Cancelled by Dispatch',
        message: payload?.reason || 'Current route was cancelled and returned to dispatch pool.',
        timestamp: new Date(),
        severity: 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    const handleStopCancelled = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
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

    const handlePriorityEscalated = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
      playAudioChime('alert');
      const notif: DriverNotification = {
        id: `prio-${Date.now()}`,
        type: 'PRIORITY_ESCALATED',
        title: 'Priority Escalation',
        message: `Order #${payload?.orderReference || 'Package'} escalated to ${payload?.newPriority || 'Urgent'}.`,
        timestamp: new Date(),
        severity: 'WARNING',
      };
      setLastNotification(notif);
      triggerRefresh();
    };

    const handleDispatchMessage = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
      playAudioChime('alert');
      const notif: DriverNotification = {
        id: String(payload?.id || `msg-${Date.now()}`),
        type: 'MESSAGE',
        title: payload?.title || 'Dispatch Instruction',
        message: payload?.message || 'Notice received from Central Dispatch.',
        timestamp: new Date(payload?.timestamp || Date.now()),
        severity: payload?.severity || 'WARNING',
        read: false,
      };
      setLastNotification(notif);
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      triggerRefresh();
    };

    const handleDeliveryUpdated = (payload: any) => {
      if (!belongsToThisDriver(payload)) return;
      triggerRefresh();
    };

    socket.on('route:dispatched', handleRouteDispatched);
    socket.on('route:reordered', handleRouteReordered);
    socket.on('route:updated', handleRouteReordered);
    socket.on('route:cancelled', handleRouteCancelled);
    socket.on('stop:cancelled', handleStopCancelled);
    socket.on('stop:priority_escalated', handlePriorityEscalated);
    socket.on('dispatch:message', handleDispatchMessage);
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
      socket.off('delivery:updated', handleDeliveryUpdated);
      socket.off('route:progress', handleDeliveryUpdated);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, triggerRefresh]);

  // Continuous background GPS telemetry ping across all Driver screens while shift is IN_PROGRESS
  useEffect(() => {
    if (user?.role !== 'DRIVER' || shiftStatus !== 'IN_PROGRESS') return;

    let timeoutId: any = null;
    let isCancelled = false;

    const transmitLocation = () => {
      if (!navigator.geolocation || isCancelled) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (isCancelled) return;
          try {
            let batteryPercent: number | undefined;
            if ('getBattery' in navigator) {
              const battery: any = await (navigator as any).getBattery();
              batteryPercent = Math.round(battery.level * 100);
            }
            const speedKmh =
              pos.coords.speed !== null && pos.coords.speed >= 0
                ? Math.round(pos.coords.speed * 3.6 * 10) / 10
                : 0;
            lastSpeedRef.current = speedKmh;

            await DriverHudApi.updateLocation({
              coordinates: [pos.coords.longitude, pos.coords.latitude],
              accuracyMeters: Math.round(pos.coords.accuracy),
              speedKmh,
              headingDegrees: pos.coords.heading || 0,
              altitudeMeters: pos.coords.altitude || undefined,
              batteryPercent,
            });
          } catch {
            // Silently ignore transient network blips
          } finally {
            if (!isCancelled) {
              const intervalMs = lastSpeedRef.current > 3 ? 8000 : 30000;
              timeoutId = setTimeout(transmitLocation, intervalMs);
            }
          }
        },
        () => {
          if (!isCancelled) {
            timeoutId = setTimeout(transmitLocation, 30000);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 4000 }
      );
    };

    transmitLocation();
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.role, shiftStatus]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DriverSocketContext.Provider
      value={{
        socket: socketRef.current,
        connectionStatus,
        lastNotification,
        notifications,
        unreadCount,
        clearNotification,
        markNotificationRead,
        refreshKey,
        triggerRefresh,
        activeRouteId,
        driverId,
        shiftStatus,
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
