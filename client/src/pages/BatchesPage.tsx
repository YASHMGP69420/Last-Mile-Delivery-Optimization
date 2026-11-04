import React, { useState, useEffect } from 'react';
import { AdminHeader } from '../components/layout/AdminHeader';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { BatchesApi } from '../api/client';
import { DeliveryBatch } from '../types';
import {
  Layers,
  MapPin,
  Clock,
  Truck,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const res = await BatchesApi.list();
      setBatches(res.data.batches || []);
    } catch (e) {
      console.error('Failed to fetch batches:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Operational Dispatch Batches"
        subtitle="Rasulgarh Hub Multi-Stop Route Clusters & Dispatch Ensembles"
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchBatches}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-surface-lowest rounded-lg border border-outline-variant">
          <Loader2 className="w-6 h-6 text-secondary animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center bg-surface-lowest rounded-lg border border-outline-variant space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-on-surface">No Dispatch Batches Found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            Head over to the Deliveries Manifest, select consignments, and click "Compose Batch" to create your first dispatch run.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm hover:border-secondary transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">
                    {batch.code}
                  </span>
                  <StatusBadge status={batch.status} size="sm" />
                </div>

                <div>
                  <h3 className="font-semibold text-on-surface text-base">{batch.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{batch.date}</span>
                    <span>•</span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{batch.shift}</span>
                  </div>
                </div>

                {/* Central Depot */}
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60 flex items-center gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-secondary shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-on-surface block truncate">
                      {batch.depot?.name || 'Rasulgarh Logistics Hub'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      {batch.depot?.address || 'Plot 104/A, Rasulgarh Industrial Estate'}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-outline-variant/60">
                  <div className="p-2 rounded bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Stops</span>
                    <span className="font-mono font-bold text-sm text-on-surface">
                      {batch.metrics?.totalDeliveries || batch.deliveryIds?.length || 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Payload</span>
                    <span className="font-mono font-bold text-sm text-on-surface tabular-nums">
                      {batch.metrics?.totalWeightKg ? batch.metrics.totalWeightKg.toFixed(1) : '0.0'} kg
                    </span>
                  </div>
                  <div className="p-2 rounded bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Vehicles</span>
                    <span className="font-mono font-bold text-sm text-on-surface">
                      {batch.vehicleIds?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status indicator footer */}
              <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Depot Geo Anchored</span>
                </span>
                <span className="text-secondary font-semibold">Ready for Optimizer</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
