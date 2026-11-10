import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, Layers, Truck, TrendingUp, ArrowRight } from 'lucide-react';
import { useStaggerEntrance } from '../common/MotionPrimitives';

interface OperationsCommandStripProps {
  metrics: {
    totalDeliveries?: number;
    activeDeliveries?: number;
    completedDeliveries?: number;
    failedDeliveries?: number;
    onTimeDeliveryRate?: number;
    activeDriversCount?: number;
    totalVehicles?: number;
    availableVehicles?: number;
    totalFleetUtilization?: number;
  };
  operational: {
    activeRoutes?: number;
    activeBatches?: number;
    unassignedDeliveries?: number;
    totalDistanceSavedKm?: number;
    fuelSavedInr?: number;
  };
}

export const OperationsCommandStrip: React.FC<OperationsCommandStripProps> = ({
  metrics,
  operational,
}) => {
  const totalDeliveries = metrics.totalDeliveries ?? 0;
  const unassigned = operational.unassignedDeliveries ?? 0;
  const completed = metrics.completedDeliveries ?? 0;
  const activeRoutes = operational.activeRoutes ?? 0;
  const activeBatches = operational.activeBatches ?? 0;
  const availableVehicles = metrics.availableVehicles ?? 0;
  const totalVehicles = metrics.totalVehicles ?? 0;
  const activeDrivers = metrics.activeDriversCount ?? 0;
  const onTimeRate = metrics.onTimeDeliveryRate ?? 0;
  const distanceSaved = operational.totalDistanceSavedKm ?? 0;
  const fuelSaved = operational.fuelSavedInr ?? 0;

  const stripRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(stripRef, '.gsap-stagger', [totalDeliveries, activeRoutes, availableVehicles]);

  return (
    <div ref={stripRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Consignment Volume */}
      <Link
        to="/admin/deliveries"
        className="gsap-stagger card-hover-lift panel-card rounded-xl p-5 flex flex-col justify-between border border-outline-variant/60 dark:border-obsidian-750 group"
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant dark:text-slate-400">
            Consignments Today
          </span>
          <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/40 dark:border-obsidian-700 flex items-center justify-center text-on-surface-variant dark:text-slate-300 transition-colors">
            <Package className="w-4 h-4 stroke-[2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="text-3xl font-bold text-on-surface dark:text-white font-mono tracking-tight tabular-nums">
            {totalDeliveries}
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-on-surface-variant dark:text-slate-300 mt-1">
            <span className="text-amber-500 font-medium">{unassigned} Unassigned</span>
            <span className="text-outline-variant dark:text-obsidian-750">•</span>
            <span className="text-emerald-500 font-medium">{completed} Delivered</span>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between text-xs font-medium text-on-surface-variant dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
          <span>Deliveries Manifest</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 2. Dispatch Batches & Routes */}
      <Link
        to="/admin/batches"
        className="gsap-stagger card-hover-lift panel-card rounded-xl p-5 flex flex-col justify-between border border-outline-variant/60 dark:border-obsidian-750 group"
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant dark:text-slate-400">
            Active Dispatches
          </span>
          <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/40 dark:border-obsidian-700 flex items-center justify-center text-on-surface-variant dark:text-slate-300 transition-colors">
            <Layers className="w-4 h-4 stroke-[2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-on-surface dark:text-white font-mono tracking-tight tabular-nums">
              {activeRoutes}
            </span>
            <span className="text-sm font-medium text-on-surface-variant dark:text-slate-400">Routes Active</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-on-surface-variant dark:text-slate-300 mt-1">
            <span className="text-emerald-400 font-medium">{activeBatches} Batches Staged</span>
            <span className="text-outline-variant dark:text-obsidian-750">•</span>
            <span className="text-on-surface-variant dark:text-slate-400">Central Hub</span>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between text-xs font-medium text-on-surface-variant dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
          <span>Dispatch Batches</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 3. Fleet & Driver Readiness */}
      <Link
        to="/admin/fleets"
        className="gsap-stagger card-hover-lift panel-card rounded-xl p-5 flex flex-col justify-between border border-outline-variant/60 dark:border-obsidian-750 group"
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant dark:text-slate-400">
            Fleet Availability
          </span>
          <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/40 dark:border-obsidian-700 flex items-center justify-center text-on-surface-variant dark:text-slate-300 transition-colors">
            <Truck className="w-4 h-4 stroke-[2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-3xl font-bold text-on-surface dark:text-white font-mono tracking-tight tabular-nums">
              {availableVehicles}
            </span>
            <span className="text-xl font-medium text-on-surface-variant dark:text-slate-500">/ {totalVehicles}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-on-surface-variant dark:text-slate-300 mt-1">
            <span className="text-emerald-500 font-medium">{activeDrivers} Drivers Active</span>
            <span className="text-outline-variant dark:text-obsidian-750">•</span>
            <span className="text-on-surface-variant dark:text-slate-400">Ready for Dispatch</span>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between text-xs font-medium text-on-surface-variant dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
          <span>Fleet Assets</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 4. Optimization & SLA Fuel Savings */}
      <Link
        to="/admin/optimizer"
        className="gsap-stagger card-hover-lift panel-card rounded-xl p-5 flex flex-col justify-between border border-outline-variant/60 dark:border-obsidian-750 group"
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant dark:text-slate-400">
            On-Time Delivery Rate
          </span>
          <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/40 dark:border-obsidian-700 flex items-center justify-center text-on-surface-variant dark:text-slate-300 transition-colors">
            <TrendingUp className="w-4 h-4 stroke-[2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-emerald-500 dark:text-emerald-400 font-mono tracking-tight tabular-nums">
              {onTimeRate}%
            </span>
            <span className="text-xs font-medium text-on-surface-variant dark:text-slate-400 uppercase">SLA</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-medium text-on-surface-variant dark:text-slate-300 mt-1">
            <span>Saved <strong className="text-on-surface dark:text-white font-semibold">{distanceSaved} km</strong></span>
            <span className="text-outline-variant dark:text-obsidian-750">•</span>
            <span className="text-emerald-500 font-medium">₹{fuelSaved.toLocaleString('en-IN')} Est.</span>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between text-xs font-medium text-on-surface-variant dark:text-slate-400 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
          <span>Route Optimizer</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </div>
  );
};
