import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { InteractiveMap } from '../../components/maps/InteractiveMap';
import {
  Navigation,
  MapPin,
  Phone,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  RotateCw,
  Clock,
  Package,
  Layers,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useDriverSocketContext } from '../../context/DriverSocketContext';

export const DriverRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey } = useDriverSocketContext();
  const [route, setRoute] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [activeStop, setActiveStop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStopsDrawerOpen, setIsStopsDrawerOpen] = useState(false);

  const fetchRoute = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getActiveRoute();
      const r = res.data.route;
      setRoute(r);
      if (r && r.stops) {
        setStops(r.stops);
        // Identify first incomplete stop
        const nextIncomplete = r.stops.find((s: any) => s.status !== 'COMPLETED' && s.status !== 'FAILED');
        setActiveStop(nextIncomplete || r.stops[0]);
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
      alert(err.response?.data?.error?.message || 'Failed to update arrival status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getGoogleMapsUrl = (stop: any) => {
    const coords = stop.location;
    if (coords && coords.lat && coords.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
    }
    const query = encodeURIComponent(`${stop.address?.street || ''}, ${stop.address?.zone || ''}, Bhubaneswar`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-8 text-center space-y-3">
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
  const progressPercent = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;

  // Format stops for InteractiveMap
  const mapStops = stops.map((s) => ({
    ...s,
    id: s.deliveryId || s._id,
    coordinates: s.location ? [s.location.lng, s.location.lat] : [85.8645, 20.2961],
  }));

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] relative -m-4 overflow-hidden">
      {/* Top Floating Route Info Bar */}
      <div className="absolute top-2 inset-x-2 z-20 p-2.5 rounded-2xl bg-surface-lowest/95 backdrop-blur-md border border-outline-variant/80 shadow-md flex items-center justify-between">
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
            className="p-1.5 rounded-xl bg-surface border border-outline-variant/60 text-on-surface active:scale-95 transition-all"
            title="Toggle Stops Manifest"
          >
            {isStopsDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 w-full h-full">
        <InteractiveMap
          stops={mapStops as any}
          routePath={route.polylineCoords}
          defaultCenter={[20.2961, 85.8645]}
        />
      </div>

      {/* Bottom Floating Active Stop Action Card */}
      {activeStop && (
        <div className="absolute bottom-3 inset-x-3 z-20 p-4 rounded-[24px] bg-surface-lowest/98 backdrop-blur-md border border-outline-variant/80 shadow-soft space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                  {activeStop.sequence}
                </span>
                <h3 className="text-xs font-bold text-on-surface truncate">{activeStop.customer?.name}</h3>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {activeStop.priority || 'Standard'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1 truncate flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                {activeStop.address?.street}, {activeStop.address?.zone}
              </p>
            </div>

            <a
              href={`tel:${activeStop.customer?.phone}`}
              className="p-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 shrink-0 transition-colors"
              title="Call Customer"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <a
              href={getGoogleMapsUrl(activeStop)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-outline-variant/60 bg-surface text-on-surface text-xs font-medium hover:bg-surface-lowest transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Google Maps</span>
            </a>

            {activeStop.status === 'ARRIVED' ? (
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdating}
                onClick={async () => {
                  setIsUpdating(true);
                  try {
                    await DriverHudApi.completeDelivery(activeStop.deliveryId || activeStop._id, {
                      handoverNotes: 'Completed via Route Map',
                    });
                    await fetchRoute();
                  } catch (err: any) {
                    alert(err.response?.data?.error?.message || 'Failed to complete stop');
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                className="py-2 font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1 stroke-[2.5]" />
                Complete Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdating}
                onClick={() => handleMarkArrived(activeStop.deliveryId || activeStop._id)}
                className="py-2 font-bold"
              >
                <MapPin className="w-4 h-4 mr-1" />
                Mark Arrived
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Stops Drawer */}
      {isStopsDrawerOpen && (
        <div className="absolute inset-x-0 bottom-0 top-14 z-30 bg-surface-lowest/98 backdrop-blur-md p-4 pb-20 overflow-y-auto space-y-2 border-t border-outline-variant/60 shadow-soft">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Sequenced Stops ({totalStops})
            </h3>
            <button
              onClick={() => setIsStopsDrawerOpen(false)}
              className="text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-1.5">
            {stops.map((s) => {
              const isCompleted = s.status === 'COMPLETED';
              const isFailed = s.status === 'FAILED';
              const isSelected = (activeStop?.deliveryId || activeStop?._id) === (s.deliveryId || s._id);

              return (
                <div
                  key={s.deliveryId || s._id || s.sequence}
                  onClick={() => {
                    setActiveStop(s);
                    setIsStopsDrawerOpen(false);
                  }}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-colors flex items-center justify-between ${
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
                      <div className="text-[10px] text-on-surface-variant truncate">{s.address?.street}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono uppercase shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : isFailed
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
