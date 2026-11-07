import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useDriverSocketContext } from '../../context/DriverSocketContext';

export const DriverDeliveriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey } = useDriverSocketContext();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');

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
    const coords = del.location?.coordinates;
    if (coords && coords.length >= 2) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
    }
    const query = encodeURIComponent(`${del.address?.street || ''}, ${del.address?.zone || ''}, Bhubaneswar`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  };

  return (
    <div className="space-y-4 pb-24 select-none">
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
        <Button variant="ghost" size="sm" onClick={fetchDeliveries} className="p-2 rounded-xl">
          <RotateCw className="w-4 h-4 text-on-surface-variant" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-3.5" />
        <input
          type="text"
          placeholder="Search by order #, customer, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {/* Filter Tabs as Capsule Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
        {['ALL', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'FAILED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all font-mono text-[11px] active:scale-95 ${
              activeTab === tab
                ? 'bg-primary text-white shadow-emerald font-bold'
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
        <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-lowest rounded-[24px] border border-outline-variant/60 shadow-soft">
          No consignments in this category.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((d) => {
            const isCompleted = d.status === 'COMPLETED';
            const isFailed = d.status === 'FAILED';

            return (
              <div
                key={d._id || d.id}
                className="p-4 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-on-surface font-mono">{d.orderReference}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          d.priority === 'Cold Chain'
                            ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                            : d.priority === 'Urgent'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {d.priority}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-on-surface mt-1">{d.customer?.name}</div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono uppercase ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : isFailed
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>

                <div className="text-[11px] text-on-surface-variant space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{d.address?.street}, {d.address?.zone}</span>
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
                  <a
                    href={`tel:${d.customer?.phone}`}
                    className="p-2 rounded-xl bg-surface border border-outline-variant/60 text-on-surface hover:text-primary transition-colors"
                    title="Call Customer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={getGoogleMapsUrl(d)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-surface border border-outline-variant/60 text-on-surface hover:text-primary transition-colors"
                    title="Open Navigation"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {!isCompleted && !isFailed ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        try {
                          await DriverHudApi.completeDelivery(d._id || d.id, {
                            handoverNotes: 'Completed from Manifest list',
                          });
                          fetchDeliveries();
                        } catch (err: any) {
                          alert(err.response?.data?.error?.message || 'Failed to complete stop');
                        }
                      }}
                      className="flex-1 text-xs py-2 font-bold"
                    >
                      Complete Stop
                    </Button>
                  ) : (
                    <span className="flex-1 text-center text-xs font-mono font-semibold text-on-surface-variant py-1">
                      {isCompleted ? '✓ Completed' : '✕ Skipped/Failed'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
