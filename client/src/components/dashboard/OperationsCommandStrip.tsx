import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Layers, Truck, TrendingUp, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

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
  const onTimeRate = metrics.onTimeDeliveryRate ?? 98.4;
  const distanceSaved = operational.totalDistanceSavedKm ?? 48.2;
  const fuelSaved = operational.fuelSavedInr ?? 3945;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Consignment Volume */}
      <Link
        to="/admin/deliveries"
        className="bg-surface-lowest rounded-[24px] p-5 shadow-soft border border-outline-variant/60 hover:shadow-soft-hover transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Consignments Today
          </span>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
            <Package className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="text-3xl font-extrabold text-on-surface font-mono tabular-nums">
            {totalDeliveries}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-amber-500 font-semibold">{unassigned} Unassigned</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="text-emerald font-semibold">{completed} Delivered</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-[11px] text-on-surface-variant group-hover:text-primary transition-colors font-medium">
          <span>Master Waybill Manifest</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 2. Dispatch Batches & Ensembles */}
      <Link
        to="/admin/batches"
        className="bg-surface-lowest rounded-[24px] p-5 shadow-soft border border-outline-variant/60 hover:shadow-soft-hover transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Active Dispatches
          </span>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="text-3xl font-extrabold text-on-surface font-mono tabular-nums">
            {activeRoutes} <span className="text-sm font-semibold text-on-surface-variant">Routes</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-primary font-semibold">{activeBatches} Batches Staged</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="text-on-surface-variant">Rasulgarh Hub</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-[11px] text-on-surface-variant group-hover:text-primary transition-colors font-medium">
          <span>Manage Dispatch Runs</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 3. Fleet & Driver Readiness */}
      <Link
        to="/admin/fleets"
        className="bg-surface-lowest rounded-[24px] p-5 shadow-soft border border-outline-variant/60 hover:shadow-soft-hover transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Fleet Readiness
          </span>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
            <Truck className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="text-3xl font-extrabold text-on-surface font-mono tabular-nums">
            {availableVehicles} <span className="text-base font-normal text-on-surface-variant">/ {totalVehicles}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-emerald font-semibold">{activeDrivers} Couriers On Duty</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="text-on-surface-variant font-mono">100% Verified</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-[11px] text-on-surface-variant group-hover:text-primary transition-colors font-medium">
          <span>Fleet Vehicles & Asset HUD</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 4. Optimization & SLA Fuel Savings */}
      <Link
        to="/admin/optimizer"
        className="bg-surface-lowest rounded-[24px] p-5 shadow-soft border border-outline-variant/60 hover:shadow-soft-hover transition-all duration-200 group flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            Route Savings & SLA
          </span>
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
            <TrendingUp className="w-4 h-4 stroke-[2.2]" />
          </div>
        </div>

        <div className="my-3">
          <div className="text-3xl font-extrabold text-emerald font-mono tabular-nums">
            {onTimeRate}% <span className="text-sm font-semibold text-on-surface-variant">SLA</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-on-surface font-semibold">Saved {distanceSaved} km</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="text-emerald font-semibold">₹{fuelSaved.toLocaleString('en-IN')} Fuel</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-[11px] text-on-surface-variant group-hover:text-primary transition-colors font-medium">
          <span>Launch Route Optimizer</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </div>
  );
};
