import React, { useState, useEffect, useRef } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { FleetApi, DeliveriesApi, TelemetryApi } from '../../api/client';
import { Vehicle, Driver, Delivery } from '../../types';
import InteractiveMap from '../../components/maps/InteractiveMap';
import { RoutesApi } from '../../api/routeApi';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Toast } from '../../components/common/Toast';
import { Socket } from 'socket.io-client';
import { mountRealtimeSocket } from '../../utils/socketClient';
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
} from 'lucide-react';

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

export const TrackingPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryLiveState>>({});
  const [hardwareMap, setHardwareMap] = useState<Record<string, HardwareSensorState>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isAckLoading, setIsAckLoading] = useState<string | null>(null);
  const [isReoptimizing, setIsReoptimizing] = useState(false);

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
      setActiveRoutes(
        routeList.filter((r: any) => ['DISPATCHED', 'IN_PROGRESS'].includes(r.status))
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

      if (vList.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vList[0]);
      }
    } catch (e) {
      console.error('Failed to load tracking telemetry:', e);
    } finally {
      setIsLoading(false);
    }
  };

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

        return () => {
          socket.off('delivery:updated', handleLiveProgress);
          socket.off('route:progress', handleLiveProgress);
          socket.off('route:dispatched', handleLiveProgress);
          socket.off('route:reordered', handleLiveProgress);
          socket.off('route:updated', handleLiveProgress);
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

  const filteredVehicles = vehicles.filter((v) => {
    const telem = telemetryMap[v.id];
    const isStale = telem?.isStale;

    const matchesStatus =
      filterStatus === 'ALL'
        ? true
        : filterStatus === 'TRANSIT'
        ? v.availability === 'IN_TRANSIT'
        : filterStatus === 'ASSIGNED'
        ? v.availability === 'ASSIGNED'
        : filterStatus === 'AVAILABLE'
        ? v.availability === 'AVAILABLE'
        : filterStatus === 'STALE'
        ? isStale || !telem
        : true;

    const matchesSearch =
      !searchQuery ||
      v.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Current selected vehicle telemetry & hardware
  const currentTelem = selectedVehicle ? telemetryMap[selectedVehicle.id] : null;
  const currentHardware = selectedVehicle
    ? hardwareMap[selectedVehicle.id] || {
        connected: false,
        statusText: 'Vehicle telemetry device not connected',
        diagnostics: null,
      }
    : null;

  const getRouteVehicleRefId = (r: any) =>
    typeof r.vehicleId === 'object' && r.vehicleId
      ? r.vehicleId._id || r.vehicleId.id
      : r.vehicleId;
  const selectedVehicleId = selectedVehicle
    ? (selectedVehicle as any)._id || selectedVehicle.id
    : null;
  const activeRouteForVehicle = selectedVehicleId
    ? activeRoutes.find((r) => getRouteVehicleRefId(r) === selectedVehicleId) || null
    : null;

  const handleReoptimizeRoute = async () => {
    if (!activeRouteForVehicle) return;
    setIsReoptimizing(true);
    try {
      const routeId = activeRouteForVehicle._id || activeRouteForVehicle.id;

      // Resolve the driver's current live GPS position from in-memory telemetry
      // so the re-optimizer anchors from the vehicle's actual location, not the depot.
      const liveTelemetry = selectedVehicleId ? telemetryMap[selectedVehicleId] : null;
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
  const vehicleGpsStops = vehicles
    .map((v, idx) => {
      const t = telemetryMap[v.id];
      if (!t || !Array.isArray(t.coordinates) || t.coordinates.length < 2) return null;
      const drv = getDriverForVehicle(v);
      return {
        sequenceOrder: idx + 1,
        deliveryId: `vehicle-${v.id}`,
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
      deliveryId: del.id,
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

  const mapStops = [...vehicleGpsStops, ...deliveryMapStops];

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
              {[
                { id: 'ALL', label: `All (${vehicles.length})` },
                { id: 'TRANSIT', label: `Transit (${vehicles.filter((v) => v.availability === 'IN_TRANSIT').length})` },
                { id: 'ASSIGNED', label: `Assigned (${vehicles.filter((v) => v.availability === 'ASSIGNED').length})` },
                { id: 'AVAILABLE', label: `Idle (${vehicles.filter((v) => v.availability === 'AVAILABLE').length})` },
                {
                  id: 'STALE',
                  label: `Stale (${
                    vehicles.filter((v) => {
                      const t = telemetryMap[v.id];
                      return !t || t.isStale;
                    }).length
                  })`,
                },
              ].map((tab) => (
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
                const isSelected = selectedVehicle?.id === v.id;
                const telem = telemetryMap[v.id];
                const isStale = telem?.isStale;

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
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
                    </div>

                    <div className="flex items-center justify-between mt-1 text-xs text-on-surface-variant">
                      <span>{v.makeModel}</span>
                      <span className="font-medium text-on-surface">{getDriverName(driver)}</span>
                    </div>

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
            <InteractiveMap stops={mapStops} />
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

      {msgNotice && <Toast message={msgNotice} onClose={() => setMsgNotice(null)} />}
    </div>
  );
};

export default TrackingPage;
