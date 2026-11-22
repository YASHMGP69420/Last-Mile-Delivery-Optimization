import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import { InteractiveMap } from '../../components/maps/InteractiveMap';
import { useStaggerEntrance } from '../../components/common/MotionPrimitives';
import { PODModal, PODData } from '../../components/driver/PODModal';
import { useAuth } from '../../context/AuthContext';
import {
  MapPin,
  Phone,
  CheckCircle2,
  ExternalLink,
  RotateCw,
  Package,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl, buildContinuousNavigationUrl } from '../../utils/googleMaps';
import { useRealtimeCatchup } from '../../hooks/useRealtimeCatchup';

export const DriverRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.isDemoData || user?.email?.toLowerCase().endsWith('@smartroute.local'));
  const { joinRouteRoom, leaveRouteRoom, refreshKey, triggerRefresh } = useDriverSocketContext();
  const [route, setRoute] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [activeStop, setActiveStop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStopsDrawerOpen, setIsStopsDrawerOpen] = useState(false);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<any>(null);

  useStaggerEntrance(hudRef, '.gsap-route-hud', [isLoading, Boolean(route)]);

  const fetchRoute = useCallback(async (silent = false) => {
    if (!silent && routeRef.current === null) {
      setIsLoading(true);
    }
    try {
      const res = await DriverHudApi.getActiveRoute();
      const r = res.data.route;
      setRoute(r || null);
      routeRef.current = r || null;
      if (r && r.stops) {
        setStops(r.stops);
        // Identify first incomplete stop
        const nextIncomplete = r.stops.find((s: any) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
        setActiveStop(nextIncomplete || r.stops[0] || null);
      } else {
        setStops([]);
        setActiveStop(null);
      }
    } catch (err) {
      console.error('Failed to load active route:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoute(Boolean(routeRef.current));
  }, [refreshKey, fetchRoute]);

  // Centralized debounced (500ms) re-fetch on visibility regain, window focus, network recovery, or socket reconnect
  useRealtimeCatchup(() => fetchRoute(true), { debounceMs: 500 });

  const activeRouteId = route?._id || route?.id || null;

  useEffect(() => {
    if (activeRouteId) {
      joinRouteRoom(activeRouteId);
    }
    return () => {
      if (activeRouteId) {
        leaveRouteRoom(activeRouteId);
      }
    };
  }, [activeRouteId, joinRouteRoom, leaveRouteRoom]);

  const handleMarkArrived = async (deliveryId: string) => {
    setIsUpdating(true);
    try {
      await DriverHudApi.markDeliveryArrived(deliveryId);
      fetchRoute();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to update arrival status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getGoogleMapsUrl = (stop: any) => {
    let lat: number | undefined;
    let lng: number | undefined;

    if (stop?.location && typeof stop.location.lat === 'number' && typeof stop.location.lng === 'number') {
      lat = stop.location.lat;
      lng = stop.location.lng;
    } else if (stop?.location?.coordinates && Array.isArray(stop.location.coordinates)) {
      lng = stop.location.coordinates[0];
      lat = stop.location.coordinates[1];
    } else if (stop?.coordinates && Array.isArray(stop.coordinates)) {
      lng = stop.coordinates[0];
      lat = stop.coordinates[1];
    }

    if (lat !== undefined && lng !== undefined) {
      return buildNavigationUrl({ destination: [lat, lng] });
    }
    const query = `${stop?.address?.street || ''}, ${stop?.address?.zone || ''}, Bhubaneswar`;
    return buildNavigationUrl({ destination: query });
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center bg-surface">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-surface">
        {isDemoUser && (
          <div
            data-testid="demo-handheld-banner"
            role="status"
            className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-xs backdrop-blur-xs rounded-lg"
          >
            <AlertTriangle className="shrink-0 w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Demo Driver Session — Simulated Handheld</span>
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <Package className="w-10 h-10 text-on-surface-variant mx-auto opacity-40" />
          <h2 className="text-sm font-bold text-on-surface">No Active Route Dispatched</h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            Contact your fleet dispatcher to assign a delivery batch to your vehicle.
          </p>
          <Button size="sm" variant="outline" onClick={() => fetchRoute()}>
            <RotateCw className="w-3.5 h-3.5 mr-1" /> Check for New Route
          </Button>
        </div>
      </div>
    );
  }

  const completedCount = stops.filter((s) => s.status === 'COMPLETED').length;
  const totalStops = stops.length;
  const isActiveStopTerminal =
    activeStop?.status === 'COMPLETED' || activeStop?.status === 'FAILED';

  // Compute remaining uncompleted stops in sequential order for continuous navigation (D-07, D-08, D-09)
  const remainingStops = stops
    .filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED')
    .sort((a, b) => Number(a.sequenceOrder ?? a.sequence ?? 0) - Number(b.sequenceOrder ?? b.sequence ?? 0));

  const continuousNavUrl = buildContinuousNavigationUrl(remainingStops);

  const handlePodComplete = async (podData: PODData) => {
    if (!activeStop || isActiveStopTerminal) return;
    setIsPodOpen(false);
    setIsUpdating(true);
    try {
      await DriverHudApi.completeDelivery(activeStop.deliveryId || activeStop._id, {
        otp: podData.otp || undefined,
        signatureSvg: podData.signature || undefined,
        photoUrl: podData.photo || undefined,
        handoverNotes: podData.notes || 'Completed via Route Map',
      });
      setToastMsg('Stop completed with Proof of Delivery');
      await fetchRoute();
      triggerRefresh();
    } catch (err: any) {
      setToastMsg(err.friendlyMessage || err.response?.data?.error?.message || 'Failed to complete stop');
    } finally {
      setIsUpdating(false);
    }
  };

  // Format stops for InteractiveMap
  const mapStops = stops.map((s) => {
    let lat = 20.2961;
    let lng = 85.8645;
    if (s.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number') {
      lat = s.location.lat;
      lng = s.location.lng;
    } else if (s.location?.coordinates && Array.isArray(s.location.coordinates)) {
      lng = s.location.coordinates[0];
      lat = s.location.coordinates[1];
    } else if (s.coordinates && Array.isArray(s.coordinates)) {
      lng = s.coordinates[0];
      lat = s.coordinates[1];
    }
    return {
      ...s,
      id: s.deliveryId || s._id,
      coordinates: [lng, lat],
    };
  });

  return (
    <div ref={hudRef} className="flex-1 min-h-0 relative flex flex-col w-full h-full overflow-hidden select-none">
      {isDemoUser && (
        <div
          data-testid="demo-handheld-banner"
          role="status"
          className="sticky top-0 z-40 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-xs backdrop-blur-xs rounded-lg"
        >
          <AlertTriangle className="shrink-0 w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Demo Driver Session — Simulated Handheld</span>
        </div>
      )}
      {/* Top Floating Route Info Bar */}
      <div className={`gsap-route-hud glass-floating absolute ${isDemoUser ? 'top-10' : 'top-3'} inset-x-3 z-30 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between pointer-events-auto`}>
        <div>
          <span className="text-xs text-on-surface-variant uppercase font-mono block">
            {route.routeCode}
          </span>
          <span className="text-xs font-bold text-on-surface">
            Stop {activeStop?.sequence || 1} of {totalStops}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold block">{completedCount}/{totalStops} Done</span>
            <span className="text-xs font-mono text-on-surface-variant">{route.metrics?.totalDistanceKm || 0} km</span>
          </div>
          {remainingStops.length > 0 && (
            <a
              href={continuousNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open continuous turn-by-turn navigation in Google Maps across ${remainingStops.length} remaining stops`}
              className="spring-press flex items-center gap-1.5 h-11 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover active:scale-95 transition-colors shadow-xs select-none"
              title="Continuous Multi-Stop Navigation"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Continuous Nav</span>
              <span className="sm:hidden">Nav</span>
            </a>
          )}
          <button
            onClick={() => setIsStopsDrawerOpen(!isStopsDrawerOpen)}
            aria-label="Toggle Stops Manifest"
            aria-expanded={isStopsDrawerOpen}
            aria-controls="stops-manifest-drawer"
            className="spring-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface border border-outline-variant text-on-surface active:scale-95 transition-colors"
            title="Toggle Stops Manifest"
          >
            {isStopsDrawerOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 w-full h-full min-h-0 relative isolate z-0">
        <InteractiveMap
          stops={mapStops as any}
          routePath={route.polylineCoords}
          defaultCenter={[20.2961, 85.8645]}
        />
      </div>

      {/* Bottom Floating Active Stop Action Card */}
      {activeStop && (
        <div className="gsap-route-hud glass-floating absolute bottom-3 inset-x-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md md:max-w-lg z-30 p-3.5 sm:p-4 rounded-2xl space-y-3 pointer-events-auto">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                  {activeStop.sequence}
                </span>
                <h3 className="text-sm font-bold text-on-surface truncate">
                  {activeStop.customer?.name || activeStop.recipientName || `Stop #${activeStop.sequence}`}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 shrink-0">
                  {activeStop.priority || 'Standard'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5 truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{formatAddress(activeStop.address) || 'Bhubaneswar'}</span>
              </p>
            </div>

            {activeStop.customer?.phone && (
              <a
                href={`tel:${activeStop.customer.phone}`}
                aria-label={`Call customer ${activeStop.customer.name || ''}`}
                className="spring-press min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0 active:scale-95 transition-colors shadow-xs"
                title="Call Customer"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <a
              href={continuousNavUrl || getGoogleMapsUrl(activeStop)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                remainingStops.length > 1
                  ? `Open continuous navigation across ${remainingStops.length} remaining stops in Google Maps`
                  : `Open navigation in Google Maps for stop ${activeStop.sequence}`
              }
              className="spring-press flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-semibold hover:bg-surface-low active:scale-98 transition-colors shadow-xs select-none"
            >
              <ExternalLink className="w-4 h-4 text-primary shrink-0" />
              <span>
                {remainingStops.length > 1
                  ? `Google Maps (${remainingStops.length})`
                  : 'Google Maps'}
              </span>
            </a>

            {isActiveStopTerminal ? (
              <div
                role="status"
                aria-label={`Stop ${activeStop.sequence} is ${
                  activeStop.status === 'COMPLETED' ? 'Completed' : 'Skipped / Failed'
                }`}
                className={`h-11 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold select-none ${
                  activeStop.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                }`}
              >
                {activeStop.status === 'COMPLETED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Completed</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 shrink-0" />
                    <span>Skipped / Failed</span>
                  </>
                )}
              </div>
            ) : activeStop.status === 'ARRIVED' ? (
              <Button
                variant="primary"
                size="sm"
                aria-label={`Complete delivery for stop ${activeStop.sequence}`}
                isLoading={isUpdating}
                onClick={() => setIsPodOpen(true)}
                className="h-11 font-bold rounded-xl active:scale-98 shadow-xs text-xs"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5 stroke-[2.5]" />
                Complete Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                aria-label={`Mark arrived at stop ${activeStop.sequence}`}
                isLoading={isUpdating}
                onClick={() => handleMarkArrived(activeStop.deliveryId || activeStop._id)}
                className="h-11 font-bold rounded-xl active:scale-98 shadow-xs text-xs"
              >
                <MapPin className="w-4 h-4 mr-1.5" />
                Mark Arrived
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Stops Drawer */}
      {isStopsDrawerOpen && (
        <div
          id="stops-manifest-drawer"
          role="region"
          aria-label="Sequenced Stops Manifest"
          className="glass-floating absolute inset-x-0 bottom-0 top-16 sm:inset-x-auto sm:right-4 sm:top-16 sm:bottom-4 sm:w-96 sm:max-w-md sm:rounded-2xl sm:border sm:border-outline-variant/60 sm:shadow-2xl z-40 p-4 pb-20 sm:pb-6 overflow-y-auto smooth-scroll overscroll-y-contain space-y-2 border-t pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Sequenced Stops ({totalStops})
            </h3>
            <button
              onClick={() => setIsStopsDrawerOpen(false)}
              aria-label="Close stops manifest drawer"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs font-semibold text-on-surface-variant hover:text-on-surface gap-1"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="space-y-1.5" role="list">
            {stops.map((s) => {
              const isCompleted = s.status === 'COMPLETED';
              const isFailed = s.status === 'FAILED';
              const isSelected = (activeStop?.deliveryId || activeStop?._id) === (s.deliveryId || s._id);

              return (
                <button
                  type="button"
                  key={s.deliveryId || s._id || s.sequence}
                  role="listitem"
                  aria-label={`Select stop ${s.sequence}: ${s.customer?.name || 'Customer'}`}
                  onClick={() => {
                    setActiveStop(s);
                    setIsStopsDrawerOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : isCompleted
                      ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10'
                      : isFailed
                      ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/10'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-lowest'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-6 h-6 rounded-full bg-surface-low dark:bg-obsidian-800 text-on-surface border border-outline-variant/60 text-xs font-bold flex items-center justify-center shrink-0">
                      {s.sequence}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-on-surface truncate">{s.customer?.name}</div>
                      <div className="text-xs text-on-surface-variant truncate">{formatAddress(s.address) || 'Bhubaneswar'}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono uppercase shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                        : isFailed
                        ? 'bg-red-50 dark:bg-red-500/15 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {s.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PODModal
        isOpen={isPodOpen}
        onClose={() => setIsPodOpen(false)}
        onComplete={handlePodComplete}
        deliveryId={activeStop?.deliveryId || activeStop?._id}
        customerPhone={activeStop?.recipientPhone}
        orderReference={activeStop?.orderReference}
        recipientName={activeStop?.recipientName}
      />

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
