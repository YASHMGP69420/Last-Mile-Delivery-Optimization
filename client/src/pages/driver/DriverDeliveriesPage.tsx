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

export const DriverDeliveriesPage: React.FC = () => {
  const navigate = useNavigate();
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
  }, [activeTab]);

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
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-on-surface flex items-center gap-2">
            <Package className="w-5 h-5 text-secondary" />
            Consignment Manifest
          </h1>
          <p className="text-[11px] text-on-surface-variant font-mono">
            {filteredDeliveries.length} Packages Assigned
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDeliveries} className="p-1.5">
          <RotateCw className="w-4 h-4 text-on-surface-variant" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search by order #, customer, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:outline-none"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-outline-variant overflow-x-auto text-xs font-semibold">
        {['ALL', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'FAILED'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 whitespace-nowrap transition-colors border-b-2 font-mono text-[11px] ${
              activeTab === tab
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Delivery Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RotateCw className="w-6 h-6 text-secondary animate-spin" />
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-lowest rounded-2xl border border-outline-variant">
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
                className="p-3.5 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-2.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-on-surface font-mono">{d.orderReference}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          d.priority === 'Cold Chain'
                            ? 'bg-blue-500/20 text-blue-400'
                            : d.priority === 'Urgent'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {d.priority}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-on-surface mt-1">{d.customer?.name}</div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : isFailed
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}
                  >
                    {d.status}
                  </span>
                </div>

                <div className="text-[11px] text-on-surface-variant space-y-1">
                  <div className="flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
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
                <div className="pt-1 flex items-center gap-2 border-t border-outline-variant">
                  <a
                    href={`tel:${d.customer?.phone}`}
                    className="p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface hover:text-emerald-500"
                    title="Call Customer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={getGoogleMapsUrl(d)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface hover:text-secondary"
                    title="Open Navigation"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/driver/deliveries/${d._id || d.id}`)}
                    className="flex-1 text-xs py-1"
                  >
                    {isCompleted ? 'View POD' : isFailed ? 'View Exception' : 'Complete Delivery'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
