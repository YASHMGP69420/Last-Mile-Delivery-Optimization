import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { FleetApi, DeliveriesApi, TelemetryApi } from '../../api/client';
import { Vehicle, Driver, Delivery, VehicleStatus } from '../../types';
import InteractiveMap from '../../components/maps/InteractiveMap';
import { RoutesApi } from '../../api/routeApi';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Toast } from '../../components/common/Toast';
import { Socket } from 'socket.io-client';
import { mountRealtimeSocket } from '../../utils/socketClient';
import { useRealtimeCatchup } from '../../hooks/useRealtimeCatchup';
import {
  Navigation,
  BatteryCharging,
  Fuel,
  Radio,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Search,
  AlertTriangle,
  ShieldCheck,
  Check,
  Smartphone,
  Cpu,
  Wifi,
  WifiOff,
  MessageSquare,
  Send,
  Crosshair,
  Wrench,
} from 'lucide-react';
import { CameraFocusTarget } from '../../components/maps/CameraController';

interface TelemetryLiveState {
  coordinates: [number, number];
  accuracyMeters: number;
  speedKmh: number;
  headingDegrees: number;
  batteryPercent: number | null;
  timestamp: string;
  source: string;
  isStale: boolean;
  lastSeenMinutesAgo: number | null;
}

interface HardwareSensorState {
  connected: boolean;
  statusText: string;
  diagnostics: any | null;
}

// 30-minute auto-hide grace period for completed routes (D-01)
export const GRACE_PERIOD_MS = 30 * 60 * 1000;

export const TrackingPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [allRoutes, setAllRoutes] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryLiveState>>({});
  const [hardwareMap, setHardwareMap] = useState<Record<string, HardwareSensorState>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isAckLoading, setIsAckLoading] = useState<string | null>(null);
  const [isReoptimizing, setIsReoptimizing] = useState(false);

  // In-Place Maintenance Status & Notes Modal (D-04, D-05)
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState<string>('');
  const [maintenanceCustomNotes, setMaintenanceCustomNotes] = useState<string>('');
  const [isSubmittingMaintenance, setIsSubmittingMaintenance] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPingingDriver, setIsPingingDriver] = useState(false);

  // Derived selected vehicle - resilient against polling resets
  const selectedVehicle = React.useMemo(() => {
    if (!vehicles.length) return null;
    if (selectedVehicleId) {
      const match = vehicles.find((v: any) => (v.id || v._id) === selectedVehicleId);
      if (match) return match;
    }
    return vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Phase 22 Camera Navigation & Auto-Follow State
  const [cameraFocusTarget, setCameraFocusTarget] = useState<CameraFocusTarget | null>(null);
  const [autoFollowEnabled, setAutoFollowEnabled] = useState<boolean>(false);

  const handleLocateVehicle = (vehicle: Vehicle) => {
    const vId = (vehicle as any)._id || vehicle.id;
    setSelectedVehicleId(vId);
    const t = telemetryMap[vId] || telemetryMap[vehicle.id];
    if (!t || !Array.isArray(t.coordinates) || t.coordinates.length < 2) return;
    const [lng, lat] = t.coordinates;
    if (isNaN(lat) || isNaN(lng)) return;

    setCameraFocusTarget({
      coordinates: [lat, lng],
      zoom: 16,
      timestamp: Date.now(),
    });
  };

  // Driver Direct Messaging Modal
  const [messagingDriver, setMessagingDriver] = useState<Driver | null>(null);
  const [driverMsgText, setDriverMsgText] = useState('');
  const [driverMsgSeverity, setDriverMsgSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('INFO');
  const [isSendingDriverMsg, setIsSendingDriverMsg] = useState(false);
  const [msgNotice, setMsgNotice] = useState<string | null>(null);

  const handleSendDriverMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messagingDriver || !driverMsgText.trim()) return;

    setIsSendingDriverMsg(true);
    try {
      const targetId = (messagingDriver as any)._id || messagingDriver.id;
      await RoutesApi.sendMessage(
        targetId,
        driverMsgText.trim(),
        driverMsgSeverity,
        'Live Tracking Dispatch Instruction'
      );
      setMsgNotice(`Instruction transmitted to ${getDriverName(messagingDriver)}`);
      setMessagingDriver(null);
      setDriverMsgText('');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to transmit instruction');
    } finally {
      setIsSendingDriverMsg(false);
    }
  };

  const socketRef = useRef<Socket | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [vRes, dRes, delivRes, routeRes, liveRes, alertsRes] = await Promise.all([
        FleetApi.getVehicles(),
        FleetApi.getDrivers(),
        DeliveriesApi.list({ limit: 50 }),
        RoutesApi.list({ limit: 50 }).catch(() => ({ data: { routes: [] } })),
        TelemetryApi.getLive().catch(() => ({ data: { fleet: [] } })),
        TelemetryApi.getAlerts({ acknowledged: false }).catch(() => ({ data: { alerts: [] } })),
      ]);

      const vList = vRes.data?.vehicles || [];
      const dList = dRes.data?.drivers || [];
      const delivList = delivRes.data?.deliveries || [];
      const routeList = routeRes.data?.routes || [];
      const liveFleet = liveRes.data?.fleet || [];
      const activeAlerts = alertsRes.data?.alerts || [];

      setVehicles(vList);
      setDrivers(dList);
      setDeliveries(delivList);
      setAllRoutes(routeList);
      setActiveRoutes(
        routeList.filter((r: any) => {
          if (['DISPATCHED', 'IN_PROGRESS'].includes(r.status)) return true;
          if (r.status === 'COMPLETED') {
            const completionTime = new Date(r.completedAt || r.updatedAt).getTime();
            return Date.now() - completionTime < GRACE_PERIOD_MS;
          }
          return false;
        })
      );
      setAlerts((prev) => {
        const dbIds = new Set(activeAlerts.map((a: any) => a.id || a._id));
        const livePreserved = prev.filter(
          (a: any) => a._isLiveSocketAlert && !dbIds.has(a.id || a._id)
        );
        return [...livePreserved, ...activeAlerts];
      });

      // Build telemetry and hardware lookup maps
      const newTelemMap: Record<string, TelemetryLiveState> = {};
      const newHwMap: Record<string, HardwareSensorState> = {};

      liveFleet.forEach((item: any) => {
        const vId = item.vehicle?.id;
        if (vId) {
          if (item.telemetry) {
            newTelemMap[vId] = item.telemetry;
          }
          if (item.hardwareSensors) {
            newHwMap[vId] = item.hardwareSensors;
          }
        }
      });

      setTelemetryMap(newTelemMap);
      setHardwareMap(newHwMap);

      if (vList.length > 0) {
        setSelectedVehicleId((prevId) => {
          if (prevId && vList.some((v: any) => (v.id || v._id) === prevId)) {
            return prevId;
          }
          return vList[0] ? ((vList[0] as any)._id || vList[0].id) : null;
        });
      }
    } catch (e) {
      console.error('Failed to load tracking telemetry:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatic multi-device catchup on wake, tab switch, network reconnect or socket reconnection
  useRealtimeCatchup(fetchData);

  // Socket.IO Setup
  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 20000);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return () => clearInterval(interval);
    }

    const cleanupSocket = mountRealtimeSocket(
      token,
      (socket) => {
        socketRef.current = socket;

        socket.on('connect', () => {
          setIsSocketConnected(true);
        });

        socket.on('disconnect', () => {
          setIsSocketConnected(false);
        });

        // Real-time telemetry ping stream
        socket.on('telemetry:ping', (ping: any) => {
          if (ping && ping.vehicleId) {
            const vId = typeof ping.vehicleId === 'object' ? ping.vehicleId._id : ping.vehicleId;
            setTelemetryMap((prev) => ({
              ...prev,
              [vId]: {
                coordinates: ping.location?.coordinates || [85.8645, 20.2961],
                accuracyMeters: ping.accuracyMeters || 5,
                speedKmh: ping.speedKmh || 0,
                headingDegrees: ping.headingDegrees || 0,
                batteryPercent: ping.batteryPercent,
                timestamp: ping.timestamp,
                source: ping.source || 'MOBILE_APP_GPS',
                isStale: false,
                lastSeenMinutesAgo: 0,
              },
            }));

            if (ping.hardwareSensors) {
              setHardwareMap((prev) => ({
                ...prev,
                [vId]: {
                  connected: ping.hardwareSensors.connected === true,
                  statusText: ping.hardwareSensors.connected
                    ? 'OBD-II / CAN-Bus Active'
                    : 'Vehicle telemetry device not connected',
                  diagnostics: ping.hardwareSensors.connected ? ping.hardwareSensors : null,
                },
              }));
            }
          }
        });

        // Real-time alerts (guard against malformed events missing message/id)
        socket.on('telemetry:alert', (newAlert: any) => {
          if (!newAlert || !newAlert.message) return;
          const normalized = {
            ...newAlert,
            id: newAlert.id || newAlert._id || `alert-${Date.now()}`,
            alertType: newAlert.alertType || 'OPERATIONAL_ALERT',
            createdAt: newAlert.createdAt || new Date().toISOString(),
            _isLiveSocketAlert: true,
          };
          setAlerts((prev) => {
            const targetId = normalized.id;
            if (prev.some((a) => (a.id || a._id) === targetId)) return prev;
            return [normalized, ...prev];
          });
        });

        // Live driver stop progression & mid-shift re-optimization sync
        const handleLiveProgress = (payload?: any) => {
          if (payload?.routeCode && payload?.version && payload?.trafficScenario) {
            setMsgNotice(
              `Live update: ${payload.routeCode} re-optimized (${payload.trafficScenario}, v${payload.version}).`
            );
          }
          fetchData();
        };
        socket.on('delivery:updated', handleLiveProgress);
        socket.on('route:progress', handleLiveProgress);
        socket.on('route:dispatched', handleLiveProgress);
        socket.on('route:reordered', handleLiveProgress);
        socket.on('route:updated', handleLiveProgress);
        socket.on('route:cancelled', handleLiveProgress);
        socket.on('deliveries:reassigned', handleLiveProgress);
        socket.on('demo:deleted', handleLiveProgress);
        socket.on('demo:seeded', handleLiveProgress);

        // Real-time vehicle availability and maintenance updates (D-06)
        const handleVehicleUpdated = (payload?: any) => {
          if (payload?.vehicle) {
            const updatedV = payload.vehicle;
            const vId = updatedV._id || updatedV.id;
            setVehicles((prev) =>
              prev.map((v) =>
                ((v as any)._id === vId || v.id === vId)
                  ? { ...v, ...updatedV, id: vId }
                  : v
              )
            );
          }
        };
        socket.on('fleet:vehicle_updated', handleVehicleUpdated);

        return () => {
          socket.off('delivery:updated', handleLiveProgress);
          socket.off('route:progress', handleLiveProgress);
          socket.off('route:dispatched', handleLiveProgress);
          socket.off('route:reordered', handleLiveProgress);
          socket.off('route:updated', handleLiveProgress);
          socket.off('route:cancelled', handleLiveProgress);
          socket.off('deliveries:reassigned', handleLiveProgress);
          socket.off('demo:deleted', handleLiveProgress);
          socket.off('demo:seeded', handleLiveProgress);
          socket.off('fleet:vehicle_updated', handleVehicleUpdated);
          socketRef.current = null;
        };
      },
      { reconnectionAttempts: 10, reconnectionDelay: 2000 }
    );

    return () => {
      clearInterval(interval);
      cleanupSocket();
    };
  }, []);

  const handleAcknowledgeAlert = async (alertId: string) => {
    const target = alerts.find((a) => (a.id || a._id) === alertId);
    setIsAckLoading(alertId);
    try {
      await TelemetryApi.acknowledgeAlert(alertId);
      setAlerts((prev) => prev.filter((a) => (a.id || a._id) !== alertId));
    } catch (e: any) {
      if (target?._isLiveSocketAlert || e?.response?.status === 404) {
        setAlerts((prev) => prev.filter((a) => (a.id || a._id) !== alertId));
      } else {
        console.error('Failed to acknowledge alert:', e);
      }
    } finally {
      setIsAckLoading(null);
    }
  };

  const getDriverForVehicle = (v: Vehicle): Driver | null => {
    if (!v.assignedDriverId) return null;
    if (typeof v.assignedDriverId === 'object') return v.assignedDriverId as Driver;
    return drivers.find((d) => d.id === v.assignedDriverId) || null;
  };

  const getDriverName = (d: Driver | null): string => {
    if (!d) return 'Unassigned';
    if (typeof d.userId === 'object' && d.userId) return (d.userId as any).name || 'Assigned Driver';
    return d.licenseNumber || 'Assigned Driver';
  };

  const getRouteVehicleRefId = (r: any) =>
    typeof r.vehicleId === 'object' && r.vehicleId
      ? r.vehicleId._id || r.vehicleId.id
      : typeof r.vehicle === 'object' && r.vehicle
      ? r.vehicle._id || r.vehicle.id
      : r.vehicleId || r.vehicle;

  const getLatestRouteForVehicle = (vId: string) => {
    const matches = allRoutes.filter((r) => String(getRouteVehicleRefId(r)) === String(vId));
    if (matches.length === 0) return null;
    return [...matches].sort((a, b) => {
      const tA = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
      const tB = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
      return tB - tA;
    })[0];
  };

  const isVehicleArchived = (v: Vehicle) => {
    const vId = (v as any)._id || v.id;
    const latest = getLatestRouteForVehicle(vId);
    return Boolean(latest && latest.status === 'COMPLETED');
  };

  const isVehicleExpiredCompleted = (v: Vehicle) => {
    const vId = (v as any)._id || v.id;
    const latest = getLatestRouteForVehicle(vId);
    if (!latest || latest.status !== 'COMPLETED') return false;
    const elapsedMs = Date.now() - new Date(latest.completedAt || latest.updatedAt).getTime();
    return elapsedMs >= GRACE_PERIOD_MS;
  };

  const getGraceInfo = (route: any) => {
    if (!route || route.status !== 'COMPLETED') return null;
    const completionTime = new Date(route.completedAt || route.updatedAt).getTime();
    const elapsedMs = Date.now() - completionTime;
    if (elapsedMs < 0 || elapsedMs >= GRACE_PERIOD_MS) return null;
    const elapsedMin = Math.floor(elapsedMs / 60000);
    const remainingMin = Math.max(1, Math.ceil((GRACE_PERIOD_MS - elapsedMs) / 60000));
    return {
      elapsedMin,
      remainingMin,
      text: `Completed ${elapsedMin}m ago • Auto-hides in ${remainingMin}m`,
    };
  };

  const operationalVehicles = useMemo(
    () => vehicles.filter((v) => !isVehicleExpiredCompleted(v)),
    [vehicles, allRoutes]
  );

  const archivedVehicles = useMemo(
    () => vehicles.filter(isVehicleArchived),
    [vehicles, allRoutes]
  );

  const directoryTabs = [
    { id: 'ALL', label: `All (${operationalVehicles.length})` },
    {
      id: 'TRANSIT',
      label: `Transit (${operationalVehicles.filter((v) => v.availability === 'IN_TRANSIT').length})`,
    },
    {
      id: 'ASSIGNED',
      label: `Assigned (${operationalVehicles.filter((v) => v.availability === 'ASSIGNED').length})`,
    },
    {
      id: 'AVAILABLE',
      label: `Idle (${operationalVehicles.filter((v) => v.availability === 'AVAILABLE').length})`,
    },
    {
      id: 'STALE',
      label: `Stale (${
        operationalVehicles.filter((v) => {
          const t = telemetryMap[v.id] || telemetryMap[(v as any)._id];
          return !t || t.isStale;
        }).length
      })`,
    },
    {
      id: 'ARCHIVED',
      label: `Archived (${archivedVehicles.length})`,
    },
  ];

  const filteredVehicles = vehicles.filter((v) => {
    const vId = (v as any)._id || v.id;
    const telem = telemetryMap[vId] || telemetryMap[v.id];
    const isStale = telem?.isStale;
    const isArchived = isVehicleArchived(v);
    const isExpired = isVehicleExpiredCompleted(v);

    let matchesStatus = true;
    if (filterStatus === 'ARCHIVED') {
      matchesStatus = isArchived;
    } else {
      // For operational tabs (ALL, TRANSIT, ASSIGNED, AVAILABLE, STALE), exclude vehicles whose route completed beyond 30m grace
      if (isExpired) return false;

      if (filterStatus === 'ALL') {
        matchesStatus = true;
      } else if (filterStatus === 'TRANSIT') {
        matchesStatus = v.availability === 'IN_TRANSIT';
      } else if (filterStatus === 'ASSIGNED') {
        matchesStatus = v.availability === 'ASSIGNED';
      } else if (filterStatus === 'AVAILABLE') {
        matchesStatus = v.availability === 'AVAILABLE';
      } else if (filterStatus === 'STALE') {
        matchesStatus = isStale || !telem;
      }
    }

    const matchesSearch =
      !searchQuery ||
      v.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = async (vehicle: Vehicle, newStatus: string) => {
    const vId = (vehicle as any)._id || vehicle.id;
    if (newStatus === vehicle.availability) return;

    if (newStatus === 'MAINTENANCE') {
      if (vehicle.availability === 'IN_TRANSIT') {
        setMsgNotice('Cannot move vehicle to maintenance while route is in transit. Cancel route first.');
        return;
      }
      setMaintenanceVehicle(vehicle);
      setMaintenanceReason('');
      setMaintenanceCustomNotes('');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      if (newStatus === 'AVAILABLE') {
        await FleetApi.updateVehicle(vId, { availability: 'AVAILABLE', maintenanceNotes: null });
        setVehicles((prev) =>
          prev.map((v) =>
            ((v as any)._id === vId || v.id === vId)
              ? { ...v, availability: 'AVAILABLE' as VehicleStatus, maintenanceNotes: null }
              : v
          )
        );
        setMsgNotice(`${vehicle.vehicleId} returned to AVAILABLE status`);
      } else if (newStatus === 'RETIRED') {
        await FleetApi.updateVehicle(vId, { availability: 'RETIRED' });
        setVehicles((prev) =>
          prev.map((v) =>
            ((v as any)._id === vId || v.id === vId)
              ? { ...v, availability: 'RETIRED' as VehicleStatus }
              : v
          )
        );
        setMsgNotice(`${vehicle.vehicleId} moved to RETIRED status`);
      }
    } catch (err: any) {
      setMsgNotice(err.response?.data?.error?.message || err.message || 'Failed to update vehicle status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmMaintenance = async () => {
    if (!maintenanceVehicle) return;
    const vId = (maintenanceVehicle as any)._id || maintenanceVehicle.id;
    const combinedNotes = [maintenanceReason, maintenanceCustomNotes.trim()].filter(Boolean).join(' • ');

    setIsSubmittingMaintenance(true);
    try {
      await FleetApi.updateVehicle(vId, {
        availability: 'MAINTENANCE',
        maintenanceNotes: combinedNotes || 'General workshop service',
      });
      setVehicles((prev) =>
        prev.map((v) =>
          ((v as any)._id === vId || v.id === vId)
            ? {
                ...v,
                availability: 'MAINTENANCE' as VehicleStatus,
                maintenanceNotes: combinedNotes || 'General workshop service',
              }
            : v
        )
      );
      setMsgNotice(`${maintenanceVehicle.vehicleId} placed in MAINTENANCE`);
      setMaintenanceVehicle(null);
    } catch (err: any) {
      setMsgNotice(err.response?.data?.error?.message || err.message || 'Failed to set maintenance status');
    } finally {
      setIsSubmittingMaintenance(false);
    }
  };

  const handlePingDriver = () => {
    if (!selectedVehicle) return;
    const driver = getDriverForVehicle(selectedVehicle);
    const vId = (selectedVehicle as any)._id || selectedVehicle.id;
    const dId = driver ? ((driver as any)._id || driver.id) : undefined;

    if (!socketRef.current) {
      setMsgNotice('Socket disconnected. Cannot send ping.');
      return;
    }

    setIsPingingDriver(true);
    socketRef.current.emit(
      'telemetry:request_ping',
      { vehicleId: vId, driverId: dId },
      (res: any) => {
        setIsPingingDriver(false);
        if (res?.success) {
          setMsgNotice(`Sync ping transmitted to driver device (${selectedVehicle.vehicleId})`);
        } else {
          setMsgNotice(res?.message || 'Failed to transmit ping to driver');
        }
      }
    );
  };

  // Current selected vehicle telemetry & hardware
  const currentSelectedVehId = selectedVehicle
    ? (selectedVehicle as any)._id || selectedVehicle.id
    : selectedVehicleId;
  const currentTelem = currentSelectedVehId ? telemetryMap[currentSelectedVehId] : null;
  const currentHardware = currentSelectedVehId
    ? hardwareMap[currentSelectedVehId] || {
        connected: false,
        statusText: 'Vehicle telemetry device not connected',
        diagnostics: null,
      }
    : null;

  const activeRouteForVehicle = currentSelectedVehId
    ? activeRoutes.find((r) => String(getRouteVehicleRefId(r)) === String(currentSelectedVehId)) || null
    : null;

  const handleReoptimizeRoute = async () => {
    if (!activeRouteForVehicle) return;
    setIsReoptimizing(true);
    try {
      const routeId = activeRouteForVehicle._id || activeRouteForVehicle.id;

      // Resolve the driver's current live GPS position from in-memory telemetry
      // so the re-optimizer anchors from the vehicle's actual location, not the depot.
      const liveTelemetry = currentSelectedVehId ? telemetryMap[currentSelectedVehId] : null;
      const anchorCoordinates =
        liveTelemetry && !liveTelemetry.isStale && liveTelemetry.coordinates?.length === 2
          ? { lat: liveTelemetry.coordinates[1], lng: liveTelemetry.coordinates[0] }
          : undefined;

      const res = await RoutesApi.reoptimize(routeId, {
        trafficScenario: 'HEAVY_TRAFFIC',
        reason: 'Dispatcher triggered heavy-traffic reroute from Fleet Tracking',
        ...(anchorCoordinates ? { anchorCoordinates } : {}),
      });
      const pendingCount = res.data?.pendingStopsCount ?? 0;
      const version = res.data?.version ?? activeRouteForVehicle.version;
      const routeCode = activeRouteForVehicle.routeCode || 'Active Route';
      setMsgNotice(
        res.data?.reoptimized
          ? `${routeCode} re-optimized for Heavy Traffic (${pendingCount} pending stops, v${version}).`
          : `${routeCode} has no pending stops to re-optimize.`
      );
      await fetchData();
    } catch (err: any) {
      setMsgNotice(
        err.response?.data?.error?.message || err.message || 'Failed to re-optimize active route'
      );
    } finally {
      setIsReoptimizing(false);
    }
  };

  // Build map stops: include BOTH live vehicle GPS markers from telemetryMap AND active delivery pins
  // Phase 22: Discontinue sequenceOrder: idx + 1 on driver GPS markers (D-03) and pass telemetry fields
  const vehicleGpsStops = vehicles
    .map((v) => {
      const vId = (v as any)._id || v.id;
      const t = telemetryMap[vId] || telemetryMap[v.id];
      if (!t || !Array.isArray(t.coordinates) || t.coordinates.length < 2) return null;
      const drv = getDriverForVehicle(v);
      return {
        isDriverMarker: true,
        driverName: getDriverName(drv),
        vehicleId: v.vehicleId,
        headingDegrees: t.headingDegrees || 0,
        speedKmh: t.speedKmh || 0,
        isStale: t.isStale,
        deliveryId: `vehicle-${vId}`,
        orderReference: `${v.vehicleId} • LIVE GPS`,
        recipientName: `${v.makeModel || v.vehicleId} (${getDriverName(drv)})`,
        streetAddress: `${Math.round(t.speedKmh || 0)} km/h • ${t.isStale ? 'Stale ping' : 'Active GPS'}`,
        coordinates: t.coordinates as [number, number],
        priority: v.availability === 'IN_TRANSIT' ? 'Urgent' : 'Standard',
        status: v.availability === 'IN_TRANSIT' ? 'OUT_FOR_DELIVERY' : 'PENDING',
        weightKg: v.capacityKg || 0,
      };
    })
    .filter(Boolean) as any[];

  const deliveryMapStops = deliveries
    .filter((d) => d.location && d.location.coordinates)
    .slice(0, 25)
    .map((del, idx) => ({
      sequenceOrder: idx + 1,
      deliveryId: del.id || (del as any)._id,
      orderReference: del.orderReference,
      recipientName: del.customer?.name,
      recipientPhone: del.customer?.phone,
      streetAddress: del.address?.street,
      zone: del.address?.zone,
      coordinates: del.location.coordinates as [number, number],
      priority: del.priority,
      status: del.status,
      weightKg: del.weightKg || 1,
    }));

  // Route stops for selected vehicle if active route exists, sorted strictly by sequenceOrder ascending
  const activeRouteStops = (activeRouteForVehicle?.stops || [])
    .slice()
    .sort((a: any, b: any) => (a.sequenceOrder || a.sequence || 0) - (b.sequenceOrder || b.sequence || 0))
    .map((s: any, idx: number) => {
      const coords = Array.isArray(s.coordinates) && s.coordinates.length >= 2
        ? s.coordinates
        : s.location?.lng != null && s.location?.lat != null
        ? [s.location.lng, s.location.lat]
        : (s.location?.coordinates && Array.isArray(s.location.coordinates)
            ? s.location.coordinates
            : undefined);
      return {
        ...s,
        sequenceOrder: s.sequenceOrder || s.sequence || idx + 1,
        deliveryId: s.deliveryId || (s.isDepot ? 'DEPOT' : `route-stop-${idx}`),
        coordinates: coords as [number, number],
      };
    })
    .filter((s: any) => Array.isArray(s.coordinates) && s.coordinates.length >= 2);

  const isSelectedVehicleArchived = selectedVehicle ? isVehicleExpiredCompleted(selectedVehicle) : false;
  const isArchivedTabActive = filterStatus === 'ARCHIVED';

  // Real-Time Map Path Clearing (D-03): do NOT fall back to connecting random delivery pins when route finished or absent
  const routeStopsToRender =
    selectedVehicle && activeRouteForVehicle && !isSelectedVehicleArchived && !isArchivedTabActive && activeRouteStops.length > 0
      ? activeRouteStops
      : [];

  const mapStops = [...vehicleGpsStops, ...routeStopsToRender];

  // Dual-segment traversed vs remaining route paths (D-10, D-03)
  const { traversedPath, remainingPath } = useMemo(() => {
    if (!activeRouteForVehicle || !selectedVehicle || isSelectedVehicleArchived || isArchivedTabActive) {
      return { traversedPath: undefined, remainingPath: undefined };
    }

    const t = currentSelectedVehId ? telemetryMap[currentSelectedVehId] : null;
    const driverCoords: [number, number] | null =
      t && Array.isArray(t.coordinates) && t.coordinates.length >= 2 && !isNaN(t.coordinates[0]) && !isNaN(t.coordinates[1])
        ? [t.coordinates[0], t.coordinates[1]]
        : null;

    if (!driverCoords) {
      return { traversedPath: undefined, remainingPath: undefined };
    }

    // Resolve depot coordinates [lng, lat]
    let depotCoords: [number, number] | null = null;
    const d = activeRouteForVehicle.depot;
    if (d?.geo?.lng != null && d?.geo?.lat != null) {
      depotCoords = [d.geo.lng, d.geo.lat];
    } else if (Array.isArray(d?.location?.coordinates) && d.location.coordinates.length >= 2) {
      depotCoords = [d.location.coordinates[0], d.location.coordinates[1]];
    } else if (Array.isArray(d?.coordinates) && d.coordinates.length >= 2) {
      depotCoords = [d.coordinates[0], d.coordinates[1]];
    } else {
      const depotStop = (activeRouteForVehicle.stops || []).find(
        (s: any) => s.isDepot || s.orderReference === 'DEPOT' || s.deliveryId === 'DEPOT'
      );
      if (depotStop && Array.isArray(depotStop.coordinates) && depotStop.coordinates.length >= 2) {
        depotCoords = [depotStop.coordinates[0], depotStop.coordinates[1]];
      }
    }

    // Sort active delivery stops by sequence
    const deliveryStops = (activeRouteForVehicle.stops || [])
      .filter((s: any) => !s.isDepot && s.orderReference !== 'DEPOT' && s.deliveryId !== 'DEPOT')
      .slice()
      .sort(
        (a: any, b: any) =>
          (a.sequenceOrder || a.sequence || 0) - (b.sequenceOrder || b.sequence || 0)
      );

    const completedCoords = deliveryStops
      .filter(
        (s: any) =>
          String(s.status || '').toUpperCase() === 'COMPLETED' &&
          Array.isArray(s.coordinates) &&
          s.coordinates.length >= 2 &&
          !isNaN(s.coordinates[0]) &&
          !isNaN(s.coordinates[1])
      )
      .map((s: any) => [s.coordinates[0], s.coordinates[1]] as [number, number]);

    const pendingCoords = deliveryStops
      .filter((s: any) => {
        const st = String(s.status || 'PENDING').toUpperCase();
        return (
          st !== 'COMPLETED' &&
          st !== 'FAILED' &&
          st !== 'CANCELLED' &&
          Array.isArray(s.coordinates) &&
          s.coordinates.length >= 2 &&
          !isNaN(s.coordinates[0]) &&
          !isNaN(s.coordinates[1])
        );
      })
      .map((s: any) => [s.coordinates[0], s.coordinates[1]] as [number, number]);

    // 1. Traversed Path: Depot -> Completed Stops -> Live Driver Coordinates
    const traversedPoints: [number, number][] = [];
    if (depotCoords) {
      traversedPoints.push(depotCoords);
    }
    traversedPoints.push(...completedCoords);
    traversedPoints.push(driverCoords);
    const computedTraversed = traversedPoints.length >= 2 ? traversedPoints : undefined;

    // 2. Remaining Path: Live Driver Coordinates -> Pending Stops
    const remainingPoints: [number, number][] = [driverCoords, ...pendingCoords];
    const computedRemaining = pendingCoords.length > 0 && remainingPoints.length >= 2 ? remainingPoints : undefined;

    return {
      traversedPath: computedTraversed,
      remainingPath: computedRemaining,
    };
  }, [activeRouteForVehicle, selectedVehicle, currentSelectedVehId, telemetryMap, isSelectedVehicleArchived, isArchivedTabActive]);

  // Real-time follow coordinates [lat, lng] for active selected vehicle (D-06)
  const followCoordinates = (() => {
    if (!selectedVehicle) return null;
    const t = telemetryMap[selectedVehicle.id];
    if (!t || !Array.isArray(t.coordinates) || t.coordinates.length < 2) return null;
    const [lng, lat] = t.coordinates;
    if (isNaN(lat) || isNaN(lng)) return null;
    return [lat, lng] as [number, number];
  })();

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Fleet Tracking"
        subtitle="Rasulgarh Urban Logistics Hub • Real-time GPS & Route Progression"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-low border border-outline-variant text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSocketConnected ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="font-mono text-on-surface">
                {isSocketConnected ? 'GPS Stream: Active' : 'GPS Stream: Offline'}
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-1.5 rounded-lg border border-outline-variant hover:bg-surface-low transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Real-time Alerts Notification Banner */}
      {alerts.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Operational Telemetry Alerts ({alerts.length} Pending)</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.slice(0, 4).map((alert) => (
              <div
                key={alert.id || alert._id}
                className="flex items-center justify-between p-2 rounded-lg bg-surface-lowest border border-amber-500/20 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold font-mono ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {alert.alertType}
                    </span>
                    <span className="text-on-surface font-medium">{alert.message}</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant block">
                    {new Date(alert.createdAt || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.id || alert._id)}
                  disabled={isAckLoading === (alert.id || alert._id)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-surface-low border border-outline-variant hover:bg-surface-container transition-colors shrink-0 text-on-surface"
                >
                  {isAckLoading === (alert.id || alert._id) ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    'Acknowledge'
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Cockpit Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-[600px]">
        {/* Left Side: Fleet Vehicle Directory (4 cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-outline-variant/60 bg-surface-lowest overflow-hidden shadow-soft">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-outline-variant/40 space-y-3 bg-surface-low/50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plate, model, driver..."
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-outline-variant/60 text-xs bg-surface-low text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-0.5">
              {directoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-primary text-white font-semibold'
                      : 'bg-surface-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-outline-variant/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant p-1 space-y-1">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-xs text-on-surface-variant">
                No vehicles matching filter.
              </div>
            ) : (
              filteredVehicles.map((v) => {
                const driver = getDriverForVehicle(v);
                const vId = (v as any)._id || v.id;
                const isSelected = String(currentSelectedVehId) === String(vId);
                const telem = telemetryMap[vId] || telemetryMap[v.id];
                const isStale = telem?.isStale;
                const latestRoute = getLatestRouteForVehicle(vId);
                const graceInfo = getGraceInfo(latestRoute);
                const isExpired = isVehicleExpiredCompleted(v);

                return (
                  <div
                    key={vId}
                    onClick={() => setSelectedVehicleId(vId)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-secondary/10 border border-secondary shadow-sm'
                        : 'hover:bg-surface-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-on-surface">
                          {v.vehicleId}
                        </span>
                        {telem && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isStale ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            title={isStale ? 'Signal stale (>5m)' : 'Signal active'}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {telem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicleId(vId);
                              handleLocateVehicle(v);
                            }}
                            className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                            title={`Find & Center ${v.vehicleId} on Map`}
                            aria-label={`Locate ${v.vehicleId}`}
                          >
                            <Crosshair className="w-3.5 h-3.5 text-primary" />
                          </button>
                        )}
                        {graceInfo ? (
                          <span
                            data-testid="grace-badge"
                            className="px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-[3px] border-l-emerald-500"
                          >
                            COMPLETED (GRACE)
                          </span>
                        ) : filterStatus === 'ARCHIVED' || isExpired ? (
                          <span
                            data-testid="archived-badge"
                            className="px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider text-[10px] font-semibold border border-slate-500/30 bg-slate-500/10 text-slate-400 border-l-[3px] border-l-slate-400"
                          >
                            COMPLETED
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider text-[10px] font-semibold border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                              v.availability === 'IN_TRANSIT'
                                ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
                                : v.availability === 'ASSIGNED'
                                ? 'border-l-blue-400 text-on-surface dark:text-zinc-100'
                                : v.availability === 'AVAILABLE'
                                ? 'border-l-primary text-on-surface dark:text-zinc-100'
                                : 'border-l-zinc-400 dark:border-l-zinc-500 text-on-surface-variant dark:text-zinc-300'
                            }`}
                          >
                            {v.availability}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-xs text-on-surface-variant">
                      <span>{v.makeModel}</span>
                      <span className="font-medium text-on-surface">{getDriverName(driver)}</span>
                    </div>

                    {graceInfo && (
                      <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90 block font-mono mt-0.5">
                        {graceInfo.text}
                      </span>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant font-mono">
                      <span className="flex items-center gap-1">
                        {v.fuelType === 'Electric' ? (
                          <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Fuel className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {v.fuelType === 'Electric'
                          ? `${v.batterySoC ?? 85}% SoC`
                          : `${v.kmPerLitre ?? 14} km/L`}
                      </span>
                      <span>Cap: {v.capacityKg} kg</span>
                      {telem && (
                        <span className="ml-auto text-emerald-600 font-semibold">
                          {telem.speedKmh > 0 ? `${telem.speedKmh} km/h` : 'Halt'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Map Canvas & Telemetry HUD (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Map Display */}
          <div className="relative z-0 w-full h-[450px] rounded-xl border border-outline-variant/60 overflow-hidden bg-surface-lowest shadow-soft">
            <InteractiveMap
              stops={mapStops}
              disableStopsPolyline={true}
              traversedPath={traversedPath}
              remainingPath={remainingPath}
              cameraFocusTarget={cameraFocusTarget}
              autoFollowEnabled={autoFollowEnabled}
              followCoordinates={followCoordinates}
              onUserPan={() => setAutoFollowEnabled(false)}
              onToggleAutoFollow={() => setAutoFollowEnabled((prev) => !prev)}
              onLocateDriver={() => selectedVehicle && handleLocateVehicle(selectedVehicle)}
            />
          </div>

          {/* Telemetry Detail Bento */}
          {selectedVehicle ? (
            <div className="p-6 rounded-xl border border-outline-variant/60 bg-surface-lowest shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      {selectedVehicle.vehicleId} — {selectedVehicle.makeModel}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Assigned Driver: {getDriverName(getDriverForVehicle(selectedVehicle))}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* In-Place Vehicle Status Dropdown (D-04) */}
                  <div className="flex items-center gap-1.5 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant/80 dark:border-obsidian-750">
                    <span className="text-[11px] font-semibold text-on-surface-variant">Status:</span>
                    <select
                      aria-label="Vehicle Status"
                      value={selectedVehicle.availability}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleStatusChange(selectedVehicle, e.target.value)}
                      className="bg-transparent text-[11px] font-mono font-bold text-on-surface focus:outline-none cursor-pointer"
                    >
                      {selectedVehicle.availability === 'IN_TRANSIT' && (
                        <option value="IN_TRANSIT" className="bg-surface-lowest text-on-surface">IN_TRANSIT</option>
                      )}
                      {selectedVehicle.availability === 'ASSIGNED' && (
                        <option value="ASSIGNED" className="bg-surface-lowest text-on-surface">ASSIGNED</option>
                      )}
                      <option value="AVAILABLE" className="bg-surface-lowest text-on-surface">AVAILABLE</option>
                      <option
                        value="MAINTENANCE"
                        disabled={selectedVehicle.availability === 'IN_TRANSIT'}
                        className="bg-surface-lowest text-on-surface"
                      >
                        MAINTENANCE {selectedVehicle.availability === 'IN_TRANSIT' ? '(In Transit)' : ''}
                      </option>
                      <option value="RETIRED" className="bg-surface-lowest text-on-surface">RETIRED</option>
                    </select>
                  </div>

                  {/* Remote Ping Driver Button (D-11) */}
                  <button
                    type="button"
                    onClick={handlePingDriver}
                    disabled={isPingingDriver}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-low hover:bg-surface-container text-on-surface border border-outline-variant/80 dark:border-obsidian-750 text-xs font-semibold transition-colors disabled:opacity-50"
                    title="Send remote GPS location sync ping to assigned driver"
                  >
                    <Radio className={`w-3.5 h-3.5 ${isPingingDriver ? 'animate-pulse text-amber-500' : 'text-primary'}`} />
                    {isPingingDriver ? 'Pinging...' : 'Ping Driver'}
                  </button>

                  {activeRouteForVehicle && (
                    <button
                      onClick={handleReoptimizeRoute}
                      disabled={isReoptimizing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                      title={`Re-optimize ${activeRouteForVehicle.routeCode || 'active route'} for heavy traffic`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isReoptimizing ? 'animate-spin' : ''}`} />
                      {isReoptimizing ? 'Re-optimizing...' : 'Re-optimize (Heavy Traffic)'}
                    </button>
                  )}
                  {getDriverForVehicle(selectedVehicle) && (
                    <button
                      onClick={() => {
                        setMessagingDriver(getDriverForVehicle(selectedVehicle));
                        setDriverMsgText('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-low hover:bg-surface-container text-primary border border-outline-variant/80 dark:border-obsidian-750 text-xs font-semibold transition-colors"
                      title="Send instant message to driver"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message Driver
                    </button>
                  )}
                  {currentTelem ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-semibold border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                        currentTelem.isStale
                          ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
                          : 'border-l-primary text-on-surface dark:text-zinc-100'
                      }`}
                    >
                      <Radio
                        className={`w-3.5 h-3.5 ${
                          currentTelem.isStale ? 'text-amber-500' : 'text-primary'
                        }`}
                      />
                      {currentTelem.isStale
                        ? `Signal Stale (${currentTelem.lastSeenMinutesAgo}m ago)`
                        : 'Mobile GPS Stream: Active'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-semibold bg-surface-low dark:bg-obsidian-850 text-on-surface-variant dark:text-zinc-300 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-zinc-400">
                      <WifiOff className="w-3.5 h-3.5 text-on-surface-muted" />
                      GPS Offline (Awaiting Shift)
                    </span>
                  )}
                </div>
              </div>

              {/* Maintenance Notes Banner (D-05) */}
              {selectedVehicle.maintenanceNotes && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-semibold block">Active Maintenance Notes:</span>
                      <span className="text-[11px] block">{selectedVehicle.maintenanceNotes}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hardware Device vs Phone GPS Indicator Banner */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  currentHardware?.connected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-surface-low border-outline-variant/60 text-on-surface-variant'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 shrink-0" />
                  <div>
                    <span className="font-semibold block">
                      {currentHardware?.statusText || 'Vehicle telemetry device not connected'}
                    </span>
                    <span className="text-[11px] block opacity-80">
                      {currentHardware?.connected
                        ? 'CAN-Bus engine diagnostics and fuel sensors transmitting.'
                        : 'Vehicle telemetry device not connected. Displaying driver handheld mobile GPS data.'}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-lowest border border-outline-variant">
                  {currentHardware?.connected ? 'CAN-BUS: OK' : 'OBD-II: Unavailable'}
                </span>
              </div>

              {/* Real Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">
                    Speed / Movement
                  </span>
                  <span className="text-sm font-bold font-mono text-on-surface block mt-0.5">
                    {currentTelem ? `${currentTelem.speedKmh.toFixed(1)} km/h` : '0.0 km/h (Halt)'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">
                    GPS Accuracy / Heading
                  </span>
                  <span className="text-sm font-bold font-mono text-on-surface block mt-0.5">
                    {currentTelem
                      ? `±${currentTelem.accuracyMeters}m • ${currentTelem.headingDegrees}°`
                      : 'Fixed Depot Geo'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">
                    Handheld Device Battery
                  </span>
                  <span className="text-sm font-bold font-mono text-primary block mt-0.5">
                    {currentTelem?.batteryPercent !== null && currentTelem?.batteryPercent !== undefined
                      ? `${currentTelem.batteryPercent}% Battery`
                      : 'Unavailable'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">
                    Vehicle Propulsion
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-600 block mt-0.5">
                    {selectedVehicle.fuelType === 'Electric'
                      ? `${selectedVehicle.batterySoC ?? 85}% EV SoC`
                      : `${selectedVehicle.fuelType} (${selectedVehicle.kmPerLitre ?? 14} km/L)`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft text-xs text-on-surface-variant">
              Select a vehicle to inspect live telemetry and telemetry HUD.
            </div>
          )}
        </div>
      </div>

      {/* Direct Driver Message Modal */}
      <Modal
        isOpen={Boolean(messagingDriver)}
        onClose={() => setMessagingDriver(null)}
        title={`Direct Driver Instruction — ${messagingDriver ? getDriverName(messagingDriver) : ''}`}
        subtitle="Transmit real-time urgent operational instruction with audio chime to driver handheld"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMessagingDriver(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendDriverMessage}
              isLoading={isSendingDriverMsg}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Transmit Instruction
            </Button>
          </>
        }
      >
        <form onSubmit={handleSendDriverMessage} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Priority Severity
            </label>
            <select
              value={driverMsgSeverity}
              onChange={(e: any) => setDriverMsgSeverity(e.target.value)}
              className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface"
            >
              <option value="INFO">Informational (General update / Traffic advice)</option>
              <option value="WARNING">Important (Road closure / Detour instruction)</option>
              <option value="CRITICAL">Critical (Urgent stop safety alert)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Instruction Message
            </label>
            <textarea
              value={driverMsgText}
              onChange={(e) => setDriverMsgText(e.target.value)}
              rows={4}
              required
              placeholder="e.g. Heavy traffic near Rasulgarh square. Divert via Saheed Nagar flyover."
              className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest p-3 text-on-surface resize-none focus:outline-none focus:border-primary"
            />
          </div>
        </form>
      </Modal>

      {/* Vehicle Maintenance Reason Modal (D-05) */}
      <Modal
        isOpen={Boolean(maintenanceVehicle)}
        onClose={() => setMaintenanceVehicle(null)}
        title={`Place ${maintenanceVehicle?.vehicleId} into Maintenance`}
        subtitle="Select a preset service reason and add optional workshop diagnostic notes"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMaintenanceVehicle(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmMaintenance}
              isLoading={isSubmittingMaintenance}
              leftIcon={<Wrench className="w-3.5 h-3.5" />}
            >
              Confirm Maintenance
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-2">
              Preset Service Reason
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Scheduled 10,000 km service',
                'Tire puncture / repair',
                'Battery cell inspection',
                'Brake pad replacement',
                'Motor/engine diagnostic',
                'Other operational fault',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMaintenanceReason(preset)}
                  className={`p-2.5 rounded-lg border text-xs text-left transition-colors flex items-center justify-between ${
                    maintenanceReason === preset
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-outline-variant/60 bg-surface-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <span>{preset}</span>
                  {maintenanceReason === preset && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Workshop / Technician Notes (Optional)
            </label>
            <textarea
              value={maintenanceCustomNotes}
              onChange={(e) => setMaintenanceCustomNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Front-left tire pressure low. Workshop ticket #402 at Rasulgarh Depot."
              className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest p-3 text-on-surface resize-none focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {msgNotice && <Toast message={msgNotice} onClose={() => setMsgNotice(null)} />}
    </div>
  );
};

export default TrackingPage;
