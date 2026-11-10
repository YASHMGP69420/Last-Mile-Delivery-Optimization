import React, { useState, useEffect, useRef } from 'react';
import { DriverHudApi } from '../../api/client';
import {
  Package,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCw,
  Search,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Toast } from '../../components/common/Toast';
import { PODModal, PODData } from '../../components/driver/PODModal';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl } from '../../utils/googleMaps';
import { useStaggerEntrance } from '../../components/common/MotionPrimitives';

export const DriverDeliveriesPage: React.FC = () => {
  const { refreshKey, triggerRefresh } = useDriverSocketContext();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [podDelivery, setPodDelivery] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useStaggerEntrance(listRef, '.gsap-manifest-card', [isLoading, activeTab]);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getDeliveries({ status: activeTab !== 'ALL' ? activeTab : undefined });
      setDeliveries(res.data.deliveries || []);
    } catch (err) {
      console.error('Failed to load driver deliveries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [activeTab, refreshKey]);

  const filteredDeliveries = deliveries.filter((d) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      d.orderReference?.toLowerCase().includes(term) ||
      d.customer?.name?.toLowerCase().includes(term) ||
      d.address?.street?.toLowerCase().includes(term)
    );
  });

  const getGoogleMapsUrl = (del: any) => {
    let lat: number | undefined;
    let lng: number | undefined;

    if (del?.location && typeof del.location.lat === 'number' && typeof del.location.lng === 'number') {
      lat = del.location.lat;
      lng = del.location.lng;
    } else if (del?.location?.coordinates && Array.isArray(del.location.coordinates)) {
      lng = del.location.coordinates[0];
      lat = del.location.coordinates[1];
    } else if (del?.coordinates && Array.isArray(del.coordinates)) {
      lng = del.coordinates[0];
      lat = del.coordinates[1];
    }

    if (lat !== undefined && lng !== undefined) {
      return buildNavigationUrl({ destination: [lat, lng] });
    }
    const query = `${del?.address?.street || ''}, ${del?.address?.zone || ''}, Bhubaneswar`;
    return buildNavigationUrl({ destination: query });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Consignment Manifest
          </h1>
          <p className="text-[11px] text-on-surface-variant font-mono">
            {filteredDeliveries.length} Packages Assigned
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDeliveries} aria-label="Refresh deliveries manifest" className="p-2 rounded-xl">
          <RotateCw className="w-4 h-4 text-on-surface-variant" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-3.5" aria-hidden="true" />
        <input
          id="manifest-search-input"
          aria-label="Search deliveries by order number, customer name, or address"
          type="text"
          placeholder="Search by order #, customer, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Filter Tabs as Capsule Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar" role="tablist" aria-label="Delivery status filters">
        {['ALL', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'FAILED'].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`spring-press min-h-[36px] px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-mono text-[11px] ${
              activeTab === tab
                ? 'bg-primary text-white font-semibold'
                : 'bg-surface-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/60 shadow-xs'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Delivery Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RotateCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-sm">
          No consignments in this category.
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {filteredDeliveries.map((d) => {
            const isCompleted = d.status === 'COMPLETED';
            const isFailed = d.status === 'FAILED';

            return (
              <div
                key={d._id || d.id}
                className="gsap-manifest-card card-hover-lift p-4 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-sm space-y-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-on-surface font-mono">{d.orderReference}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                          d.priority === 'Cold Chain'
                            ? 'border-l-sky-400 text-on-surface dark:text-sky-200'
                            : d.priority === 'Urgent'
                            ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
                            : 'border-l-zinc-400 dark:border-l-zinc-500 text-on-surface-variant dark:text-zinc-300'
                        }`}
                      >
                        {d.priority}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-on-surface mt-1">{d.customer?.name}</div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                      isCompleted
                        ? 'border-l-primary text-on-surface dark:text-zinc-100'
                        : isFailed
                        ? 'border-l-rose-500 text-on-surface dark:text-rose-200'
                        : 'border-l-blue-400 text-on-surface dark:text-zinc-100'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>

                <div className="text-[11px] text-on-surface-variant space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{formatAddress(d.address) || 'Bhubaneswar'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Window: {d.timeWindow?.start} - {d.timeWindow?.end}
                    </span>
                    <span>Weight: <strong>{d.weightKg} kg</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center gap-2 border-t border-outline-variant/60">
                  {d.customer?.phone && (
                    <a
                      href={`tel:${d.customer.phone}`}
                      aria-label={`Call customer ${d.customer?.name || ''}`}
                      className="spring-press min-w-[40px] min-h-[40px] rounded-xl bg-surface border border-outline-variant text-on-surface hover:text-primary active:scale-95 flex items-center justify-center transition-all shadow-xs"
                      title="Call Customer"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}

                  <a
                    href={getGoogleMapsUrl(d)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open navigation in Google Maps for order ${d.orderReference}`}
                    className="spring-press min-w-[40px] min-h-[40px] rounded-xl bg-surface border border-outline-variant text-on-surface hover:text-primary active:scale-95 flex items-center justify-center transition-all shadow-xs"
                    title="Open Navigation"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {!isCompleted && !isFailed ? (
                    <Button
                      size="sm"
                      variant="primary"
                      aria-label={`Complete stop for order ${d.orderReference}`}
                      onClick={() => setPodDelivery(d)}
                      className="flex-1 min-h-[40px] text-xs py-2 font-bold rounded-xl active:scale-98 shadow-xs"
                    >
                      Complete Stop (POD)
                    </Button>
                  ) : (
                    <span className="flex-1 text-center text-xs font-mono font-semibold text-on-surface-variant py-1 flex items-center justify-center gap-1">
                      {isCompleted ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald inline" />
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-red-500 inline" />
                          <span>Skipped/Failed</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PODModal
        isOpen={Boolean(podDelivery)}
        onClose={() => setPodDelivery(null)}
        onComplete={async (podData: PODData) => {
          if (!podDelivery) return;
          const deliveryId = podDelivery._id || podDelivery.id;
          setPodDelivery(null);
          try {
            await DriverHudApi.completeDelivery(deliveryId, {
              otp: podData.otp || undefined,
              signatureSvg: podData.signature || undefined,
              photoUrl: podData.photo || undefined,
              handoverNotes: podData.notes || 'Completed from Manifest list',
            });
            setToastMsg('Delivery completed with Proof of Delivery');
            fetchDeliveries();
            triggerRefresh();
          } catch (err: any) {
            setToastMsg(err.response?.data?.error?.message || 'Failed to complete stop');
          }
        }}
      />

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
