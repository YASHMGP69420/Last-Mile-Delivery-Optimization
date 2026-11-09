import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Route,
  Activity,
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
  const inTransit = metrics.activeDeliveries ?? 0;
  const completed = metrics.completedDeliveries ?? 0;
  const exceptions = metrics.failedDeliveries ?? 0;
  const batched = Math.max(0, total - unassigned - inTransit - completed - exceptions);

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
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      barColor: 'bg-emerald-600',
      icon: Layers,
      desc: 'Ensemble staging',
    },
    {
      label: 'In Transit',
      count: inTransit,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      barColor: 'bg-blue-500',
      icon: Truck,
      desc: 'Active road delivery',
    },
    {
      label: 'Delivered',
      count: completed,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
      desc: 'Completed stop',
    },
    {
      label: 'Exceptions',
      count: exceptions,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      barColor: 'bg-rose-500',
      icon: AlertTriangle,
      desc: 'Re-attempt / Issue',
    },
  ];

  // Calculate real lifecycle progress ratios from actual data
  const totalCount = total > 0 ? total : 1;
  const unassignedPct = Math.round((unassigned / totalCount) * 100);
  const inTransitPct = Math.round((inTransit / totalCount) * 100);
  const completedPct = Math.round((completed / totalCount) * 100);
  const exceptionsPct = Math.round((exceptions / totalCount) * 100);
  const batchedPct = Math.max(0, 100 - unassignedPct - inTransitPct - completedPct - exceptionsPct);

  return (
    <div className="panel-card rounded-xl p-5 flex flex-col justify-between space-y-5 border border-outline-variant/60 dark:border-obsidian-750 transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface dark:text-white tracking-tight">Consignment Lifecycle</h2>
          <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5">
            Operational pipeline and stage breakdown across active dispatches
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/optimizer')}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs flex items-center space-x-1.5 transition-colors"
        >
          <Route className="w-3.5 h-3.5" />
          <span>Optimize Pending</span>
        </button>
      </div>

      {/* 5-Stage Horizontal Progression Funnel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          return (
            <div
              key={idx}
              className="bg-surface-low dark:bg-obsidian-950/70 border border-outline-variant/40 dark:border-obsidian-750 rounded-lg p-3 flex flex-col justify-between space-y-2 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-on-surface-variant dark:text-slate-400 tracking-wider">
                  {st.label}
                </span>
                <span className={`p-1 rounded border ${st.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
              </div>

              <div>
                <span className="text-2xl font-bold text-on-surface dark:text-white tracking-tight tabular-nums font-mono">
                  {st.count}
                </span>
                <p className="text-[11px] text-on-surface-variant dark:text-slate-400 font-normal mt-0.5">
                  {st.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real Pipeline Distribution Progress Bar */}
      <div className="pt-3 border-t border-outline-variant/40 dark:border-obsidian-750 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-on-surface dark:text-slate-300 font-medium">
            <Activity className="w-4 h-4 text-primary dark:text-emerald-400" />
            <span>Consignment Distribution</span>
          </div>
          <div className="font-mono text-on-surface-variant dark:text-slate-400 text-[11px]">
            <span className="text-on-surface dark:text-white font-semibold">{total}</span> total consignments
          </div>
        </div>

        {/* Real Segmented Progress Bar */}
        <div className="w-full h-2 rounded bg-surface-low dark:bg-obsidian-950 overflow-hidden flex border border-outline-variant/40 dark:border-obsidian-750">
          {total > 0 ? (
            <>
              {completedPct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${completedPct}%` }} title={`Completed: ${completedPct}%`} />}
              {inTransitPct > 0 && <div className="bg-blue-500 h-full" style={{ width: `${inTransitPct}%` }} title={`In Transit: ${inTransitPct}%`} />}
              {batchedPct > 0 && <div className="bg-emerald-600 h-full" style={{ width: `${batchedPct}%` }} title={`Batched: ${batchedPct}%`} />}
              {unassignedPct > 0 && <div className="bg-amber-500 h-full" style={{ width: `${unassignedPct}%` }} title={`Unassigned: ${unassignedPct}%`} />}
              {exceptionsPct > 0 && <div className="bg-rose-500 h-full" style={{ width: `${exceptionsPct}%` }} title={`Exceptions: ${exceptionsPct}%`} />}
            </>
          ) : (
            <div className="bg-slate-700/40 h-full w-full" />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-on-surface-variant dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-on-surface dark:text-slate-300">Delivered ({completed})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-on-surface dark:text-slate-300">In Transit ({inTransit})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-on-surface dark:text-slate-300">Unassigned ({unassigned})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
