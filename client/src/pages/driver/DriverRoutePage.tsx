import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import { InteractiveMap } from '../../components/maps/InteractiveMap';
import { useStaggerEntrance } from '../../components/common/MotionPrimitives';
import { PODModal, PODData } from '../../components/driver/PODModal';
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
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl } from '../../utils/googleMaps';

export const DriverRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey, triggerRefresh } = useDriverSocketContext();
  const [route, setRoute] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [activeStop, setActiveStop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStopsDrawerOpen, setIsStopsDrawerOpen] = useState(false);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  useStaggerEntrance(hudRef, '.gsap-route-hud', [isLoading, Boolean(route)]);

  const fetchRoute = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getActiveRoute();
      const r = res.data.route;
      setRoute(r || null);
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
  };

  useEffect(() => {
    fetchRoute();
  }, [refreshKey]);

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
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-surface">
        <Package className="w-10 h-10 text-on-surface-variant mx-auto opacity-40" />
        <h2 className="text-sm font-bold text-on-surface">No Active Route Dispatched</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
          Contact your fleet dispatcher to assign a delivery batch to your vehicle.
        </p>
        <Button size="sm" variant="outline" onClick={fetchRoute}>
          <RotateCw className="w-3.5 h-3.5 mr-1" /> Check for New Route
        </Button>
      </div>
    );
  }

  const completedCount = stops.filter((s) => s.status === 'COMPLETED').length;
  const totalStops = stops.length;

  const handlePodComplete = async (podData: PODData) => {
    if (!activeStop) return;
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
      setToastMsg(err.response?.data?.error?.message || 'Failed to complete stop');
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
      {/* Top Floating Route Info Bar */}
      <div className="gsap-route-hud glass-floating absolute top-3 inset-x-3 z-30 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between pointer-events-auto">
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-mono block">
            {route.routeCode}
          </span>
          <span className="text-xs font-bold text-on-surface">
            Stop {activeStop?.sequence || 1} of {totalStops}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] text-emerald-700 font-bold block">{completedCount}/{totalStops} Done</span>
            <span className="text-[10px] font-mono text-on-surface-variant">{route.metrics?.totalDistanceKm || 0} km</span>
          </div>
          <button
            onClick={() => setIsStopsDrawerOpen(!isStopsDrawerOpen)}
            aria-label="Toggle Stops Manifest"
            aria-expanded={isStopsDrawerOpen}
            aria-controls="stops-manifest-drawer"
            className="spring-press p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface active:scale-95 transition-all"
            title="Toggle Stops Manifest"
          >
            {isStopsDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
        <div className="gsap-route-hud glass-floating absolute bottom-3 inset-x-3 z-30 p-3.5 sm:p-4 rounded-2xl space-y-3 pointer-events-auto">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                  {activeStop.sequence}
                </span>
                <h3 className="text-xs font-bold text-on-surface truncate">
                  {activeStop.customer?.name || activeStop.recipientName || `Stop #${activeStop.sequence}`}
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded-md font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                  {activeStop.priority || 'Standard'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1 truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{formatAddress(activeStop.address) || 'Bhubaneswar'}</span>
              </p>
            </div>

            {activeStop.customer?.phone && (
              <a
                href={`tel:${activeStop.customer.phone}`}
                aria-label={`Call customer ${activeStop.customer.name || ''}`}
                className="spring-press w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-xs"
                title="Call Customer"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <a
              href={getGoogleMapsUrl(activeStop)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open navigation in Google Maps for stop ${activeStop.sequence}`}
              className="spring-press flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-semibold hover:bg-surface-low active:scale-98 transition-all shadow-xs select-none"
            >
              <ExternalLink className="w-4 h-4 text-primary shrink-0" />
              <span>Google Maps</span>
            </a>

            {activeStop.status === 'ARRIVED' ? (
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
          className="glass-floating absolute inset-x-0 bottom-0 top-16 z-40 p-4 pb-20 overflow-y-auto space-y-2 border-t pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Sequenced Stops ({totalStops})
            </h3>
            <button
              onClick={() => setIsStopsDrawerOpen(false)}
              aria-label="Close stops manifest drawer"
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
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
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : isFailed
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-outline-variant/60 bg-surface hover:bg-surface-lowest'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {s.sequence}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-on-surface truncate">{s.customer?.name}</div>
                      <div className="text-[10px] text-on-surface-variant truncate">{formatAddress(s.address) || 'Bhubaneswar'}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-md font-mono uppercase shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : isFailed
                        ? 'bg-red-50 text-red-800 border border-red-200'
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
      />

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
