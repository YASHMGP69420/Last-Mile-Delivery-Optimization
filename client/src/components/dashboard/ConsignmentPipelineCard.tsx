import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  MapPin,
} from 'lucide-react';

interface ConsignmentPipelineCardProps {
  metrics: {
    totalDeliveries?: number;
    activeDeliveries?: number;
    completedDeliveries?: number;
    failedDeliveries?: number;
  };
  operational: {
    unassignedDeliveries?: number;
    activeBatches?: number;
    activeRoutes?: number;
  };
}

export const ConsignmentPipelineCard: React.FC<ConsignmentPipelineCardProps> = ({
  metrics,
  operational,
}) => {
  const navigate = useNavigate();

  const total = metrics.totalDeliveries ?? 0;
  const unassigned = operational.unassignedDeliveries ?? 0;
  const batched = (operational.activeBatches ?? 0) * 8; // approx. staged in current batches
  const inTransit = metrics.activeDeliveries ?? 0;
  const completed = metrics.completedDeliveries ?? 0;
  const exceptions = metrics.failedDeliveries ?? 0;

  const stages = [
    {
      label: 'Unassigned',
      count: unassigned,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
      barColor: 'bg-amber-500',
      icon: Package,
      desc: 'Awaiting batching',
    },
    {
      label: 'Batched',
      count: batched,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
      barColor: 'bg-blue-500',
      icon: Layers,
      desc: 'Ensemble staging',
    },
    {
      label: 'In Transit',
      count: inTransit,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
      barColor: 'bg-purple-500',
      icon: Truck,
      desc: 'Active road delivery',
    },
    {
      label: 'Delivered',
      count: completed,
      color: 'text-emerald bg-emerald/10 border-emerald/30',
      barColor: 'bg-emerald',
      icon: CheckCircle2,
      desc: 'Completed stop',
    },
    {
      label: 'Exceptions',
      count: exceptions,
      color: 'text-red-500 bg-red-500/10 border-red-500/30',
      barColor: 'bg-red-500',
      icon: AlertTriangle,
      desc: 'RTO / re-attempt',
    },
  ];

  // Urban zones sample distribution
  const zones = [
    { name: 'Patia (Zone 1)', density: 'High Density', share: 36 },
    { name: 'Jaydev Vihar (Zone 2)', density: 'Commercial', share: 24 },
    { name: 'Saheed Nagar (Zone 3)', density: 'Central Hub', share: 20 },
    { name: 'Khandagiri (Zone 4)', density: 'Western Ring', share: 12 },
    { name: 'Chandrasekharpur', density: 'Express', share: 8 },
  ];

  return (
    <div className="bg-surface-lowest rounded-[28px] p-6 shadow-soft border border-outline-variant/60 flex flex-col justify-between space-y-6 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shadow-emerald animate-pulse" />
            <h3 className="text-sm font-bold text-on-surface">Consignment Dispatch Lifecycle</h3>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Real-time delivery progress & urban cluster distribution for Bhubaneswar
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/optimizer')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-emerald transition-all duration-200 shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Optimize Pending</span>
        </button>
      </div>

      {/* 5-Stage Horizontal Progression Funnel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/40 flex flex-col justify-between space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                  {st.label}
                </span>
                <span className={`p-1 rounded-lg border ${st.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>

              <div>
                <span className="text-2xl font-bold font-mono text-on-surface tabular-nums">
                  {st.count}
                </span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">
                  {st.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone Distribution Density Strip */}
      <div className="pt-2 border-t border-outline-variant/40 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            Urban Zone Allocation (Rasulgarh Cluster)
          </span>
          <span className="text-[11px] font-mono text-on-surface-variant">
            {total} Active Parcels
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="w-full bg-surface-low h-3 rounded-full overflow-hidden flex">
            {zones.map((z, i) => (
              <div
                key={i}
                style={{ width: `${z.share}%` }}
                className={`h-full transition-all duration-300 ${
                  i === 0
                    ? 'bg-emerald'
                    : i === 1
                    ? 'bg-emerald/75'
                    : i === 2
                    ? 'bg-emerald/55'
                    : i === 3
                    ? 'bg-emerald/35'
                    : 'bg-emerald/20'
                }`}
                title={`${z.name}: ${z.share}%`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant pt-1">
            {zones.map((z, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    i === 0
                      ? 'bg-emerald'
                      : i === 1
                      ? 'bg-emerald/75'
                      : i === 2
                      ? 'bg-emerald/55'
                      : i === 3
                      ? 'bg-emerald/35'
                      : 'bg-emerald/20'
                  }`}
                />
                <span className="text-on-surface font-medium">{z.name}</span>
                <span className="font-mono text-[10px]">({z.share}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
