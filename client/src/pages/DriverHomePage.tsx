import React, { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { DeliveriesApi } from '../api/client';
import { Delivery } from '../types';
import { ProofOfDeliveryModal } from '../components/deliveries/ProofOfDeliveryModal';
import { DeliveryExceptionModal } from '../components/deliveries/DeliveryExceptionModal';
import {
  MapPin,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Play,
  RotateCw,
} from 'lucide-react';

export const DriverHomePage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeStop, setActiveStop] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modals
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchStops = async () => {
    setIsLoading(true);
    try {
      const res = await DeliveriesApi.list({ limit: 20 });
      const list = res.data.deliveries || [];
      // Prioritize active in-transit / assigned deliveries
      const activeList = list.filter((d) => d.status !== 'COMPLETED');
      setDeliveries(activeList.length > 0 ? activeList : list);

      if (activeList.length > 0) {
        // Keep currently selected stop if it's still present, otherwise first
        setActiveStop((prev) => {
          if (prev) {
            const found = activeList.find((d) => d.id === prev.id);
            if (found) return found;
          }
          return activeList[0];
        });
      } else {
        setActiveStop(null);
      }
    } catch (e: any) {
      console.error('Failed to load driver manifest:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStops();
  }, []);

  const handleStartDelivery = async (deliveryId: string) => {
    setIsUpdatingStatus(true);
    setActionNotice(null);
    try {
      await DeliveriesApi.updateStatus(deliveryId, { status: 'OUT_FOR_DELIVERY' });
      setActionNotice('🚚 Consignment is now OUT FOR DELIVERY');
      fetchStops();
    } catch (err: any) {
      setActionNotice(`❌ ${err?.response?.data?.error?.message || err?.message || 'Failed to update status'}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getGoogleMapsUrl = (stop: Delivery) => {
    const coords = stop.location?.coordinates;
    if (coords && coords.length >= 2) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
    }
    const query = encodeURIComponent(`${stop.address?.street || ''}, ${stop.address?.zone || ''}, Bhubaneswar`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Shift Overview Header */}
      <div className="p-4 rounded-xl bg-primary text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Active Dispatched Shift
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStops}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh Stops"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded text-white font-bold">
              BBSR-EXP-01
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-base font-bold text-white">Rasulgarh → Patia Cluster</h2>
            <p className="text-xs text-slate-400 mt-0.5">Morning Shift • Handheld Route Execution</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {deliveries.filter((d) => d.status !== 'COMPLETED').length}
            </span>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Stops Left</span>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionNotice.startsWith('❌') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading && deliveries.length === 0 ? (
        <div className="p-12 text-center bg-surface-lowest rounded-xl border border-outline-variant">
          <Loader2 className="w-6 h-6 text-secondary animate-spin mx-auto mb-2" />
          <p className="text-xs text-on-surface-variant font-mono">Synchronizing manifest queue...</p>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="p-8 text-center bg-surface-lowest rounded-xl border border-outline-variant space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-on-surface">Queue Cleared</h3>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            No active dispatches in your queue. All assigned deliveries have been completed or are pending dispatch.
          </p>
        </div>
      ) : (
        <>
          {/* Active Target Consignment Card */}
          {activeStop && (
            <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Navigation className="w-4 h-4" /> Next Target Consignment
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={activeStop.status} size="sm" />
                  <StatusBadge status={activeStop.priority || 'Standard'} size="sm" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {activeStop.orderReference}
                  </span>
                  <span className="text-xs font-mono font-medium text-secondary flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {activeStop.timeWindow?.start || '09:00'} - {activeStop.timeWindow?.end || '17:00'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-on-surface mt-1">
                  {activeStop.customer?.name || 'Customer'}
                </h3>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span>
                    {activeStop.address?.street || 'Address unavailable'}
                    {activeStop.address?.zone ? `, ${activeStop.address.zone}` : ''}
                  </span>
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60 flex items-center justify-between text-xs font-mono">
                <span>Payload: {(activeStop.weightKg ?? 0).toFixed(1)} kg</span>
                <span>Dwell: {activeStop.serviceDurationMinutes || 10} mins</span>
              </div>

              {/* Navigation & Contact Shortcuts */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {activeStop.customer?.phone ? (
                  <a
                    href={`tel:${activeStop.customer.phone}`}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-secondary" />
                    Call Consignee
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface-low text-on-surface-variant opacity-60 text-xs font-semibold border border-outline-variant cursor-not-allowed">
                    <Phone className="w-3.5 h-3.5" />
                    No Phone
                  </span>
                )}

                <a
                  href={getGoogleMapsUrl(activeStop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-700" />
                  Google Maps
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>

              {/* Lifecycle Actions */}
              <div className="pt-2 border-t border-outline-variant space-y-2">
                {activeStop.status === 'ASSIGNED' && (
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full py-2.5"
                    isLoading={isUpdatingStatus}
                    onClick={() => handleStartDelivery(activeStop.id)}
                    leftIcon={<Play className="w-4 h-4 fill-white" />}
                  >
                    Start Delivery (En Route)
                  </Button>
                )}

                {(activeStop.status === 'OUT_FOR_DELIVERY' || activeStop.status === 'READY') && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExceptionModalOpen(true)}
                      leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                      className="text-red-700 hover:bg-red-50 border-red-200"
                    >
                      Exception
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsPodModalOpen(true)}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Verify POD
                    </Button>
                  </div>
                )}

                {activeStop.status === 'DRAFT' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleStartDelivery(activeStop.id)}
                  >
                    Begin Stop
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Manifest Queue Preview & Selection */}
          {deliveries.length > 1 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Upcoming Delivery Stops ({deliveries.length})
              </span>

              <div className="space-y-2">
                {deliveries.map((stop, i) => (
                  <div
                    key={stop.id}
                    onClick={() => setActiveStop(stop)}
                    className={`p-3 rounded-lg border flex items-center justify-between text-xs shadow-sm cursor-pointer transition-all ${
                      activeStop?.id === stop.id
                        ? 'bg-secondary/5 border-secondary ring-1 ring-secondary'
                        : 'bg-surface-lowest border-outline-variant hover:bg-surface-low'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                          activeStop?.id === stop.id
                            ? 'bg-secondary text-white'
                            : 'bg-surface-low text-on-surface-variant'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-on-surface block truncate">
                          {stop.customer?.name || stop.orderReference}
                        </span>
                        <span className="text-[11px] text-on-surface-variant truncate block">
                          {stop.address?.street || stop.address?.zone || 'Bhubaneswar'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2 flex items-center gap-1.5">
                      <StatusBadge status={stop.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Proof of Delivery Modal */}
      <ProofOfDeliveryModal
        delivery={activeStop}
        isOpen={isPodModalOpen}
        onClose={() => setIsPodModalOpen(false)}
        onConfirmSuccess={() => {
          setActionNotice('✅ Proof of Delivery submitted and verified successfully!');
          fetchStops();
        }}
      />

      {/* Delivery Exception Modal */}
      <DeliveryExceptionModal
        delivery={activeStop}
        isOpen={isExceptionModalOpen}
        onClose={() => setIsExceptionModalOpen(false)}
        onConfirmSuccess={() => {
          setActionNotice('⚠️ Delivery exception recorded.');
          fetchStops();
        }}
      />
    </div>
  );
};
