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

export const DriverRoutePage: React.FC = () => {
  const navigate = useNavigate();
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
  }, []);

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
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
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
    <div className="flex flex-col h-[calc(100vh-8.5rem)] relative -m-4 overflow-hidden">
      {/* Top Floating Route Info Bar */}
      <div className="absolute top-2 inset-x-2 z-20 p-2.5 rounded-xl bg-surface-lowest/95 backdrop-blur-md border border-outline-variant shadow-lg flex items-center justify-between">
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
            <span className="text-[10px] text-emerald-500 font-bold block">{completedCount}/{totalStops} Done</span>
            <span className="text-[10px] font-mono text-on-surface-variant">{route.metrics?.totalDistanceKm || 0} km</span>
          </div>
          <button
            onClick={() => setIsStopsDrawerOpen(!isStopsDrawerOpen)}
            className="p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface"
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
        <div className="absolute bottom-2 inset-x-2 z-20 p-3.5 rounded-2xl bg-surface-lowest/95 backdrop-blur-md border border-outline-variant shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {activeStop.sequence}
                </span>
                <h3 className="text-xs font-bold text-on-surface truncate">{activeStop.customer?.name}</h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-400">
                  {activeStop.priority || 'Standard'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3 text-secondary shrink-0" />
                {activeStop.address?.street}, {activeStop.address?.zone}
              </p>
            </div>

            <a
              href={`tel:${activeStop.customer?.phone}`}
              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 shrink-0"
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
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface text-xs font-medium hover:bg-surface-lowest"
            >
              <ExternalLink className="w-3.5 h-3.5 text-secondary" />
              <span>Google Maps</span>
            </a>

            {activeStop.status === 'ARRIVED' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/driver/deliveries/${activeStop.deliveryId || activeStop._id}`)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Verify POD
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdating}
                onClick={() => handleMarkArrived(activeStop.deliveryId || activeStop._id)}
                className="bg-secondary hover:bg-secondary/90 text-white font-bold"
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
        <div className="absolute inset-x-0 bottom-0 top-14 z-30 bg-surface-lowest/98 backdrop-blur-md p-4 overflow-y-auto space-y-2 border-t border-outline-variant shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant">
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
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'border-secondary bg-secondary/10'
                      : isCompleted
                      ? 'border-emerald-500/20 bg-emerald-500/5 opacity-80'
                      : isFailed
                      ? 'border-red-500/20 bg-red-500/5 opacity-80'
                      : 'border-outline-variant bg-surface hover:bg-surface-lowest'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {s.sequence}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-on-surface truncate">{s.customer?.name}</div>
                      <div className="text-[10px] text-on-surface-variant truncate">{s.address?.street}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isFailed
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
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
