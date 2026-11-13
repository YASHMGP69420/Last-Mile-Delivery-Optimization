import React from 'react';
import { BaselineEvaluationResult, OptimizationResult, VehicleAssignment } from '../../types/route';
import { Button } from '../common/Button';
import { injectDeviceLocationIntoUrl } from '../../utils/googleMaps';
import {
  Navigation,
  Clock,
  Fuel,
  Zap,
  IndianRupee,
  MapPin,
  Route,
  ExternalLink,
  Send,
  ArrowRight,
  TrendingDown,
  CheckCircle2,
  Package,
  Layers,
  RotateCcw,
  Truck,
  User,
  RefreshCw,
} from 'lucide-react';

export interface CurrentRouteCardProps {
  baseline: BaselineEvaluationResult | null;
  isLoading?: boolean;
  optResult?: OptimizationResult | null;
  onDispatchCurrent?: () => void;
  onRunOptimization?: () => void;
  isOptimizing?: boolean;
  isDispatched?: boolean;
  vehicleAssignments?: VehicleAssignment[];
  onChangeVehicle?: (binIndex: number) => void;
  onChangeDriver?: (binIndex: number) => void;
}

export const CurrentRouteCard: React.FC<CurrentRouteCardProps> = ({
  baseline,
  isLoading = false,
  optResult = null,
  onDispatchCurrent,
  onRunOptimization,
  isOptimizing = false,
  isDispatched = false,
  vehicleAssignments = [],
  onChangeVehicle,
  onChangeDriver,
}) => {
  if (!baseline && !isLoading) {
    return null;
  }

  const metrics = baseline?.metrics;
  const isElectric = Boolean(metrics?.isElectric || metrics?.fuelUnit === 'kWh');
  const hasOptimized = Boolean(optResult && optResult.optimized);

  // Optimized comparison metrics
  const optMetrics = optResult?.optimized?.metrics;
  const optDist = optMetrics?.totalDistanceKm ?? 0;
  const optDur = optMetrics?.totalDurationMin ?? 0;
  const optCost = optMetrics?.costInr ?? 0;
  const optFuel = optMetrics?.fuelConsumed ?? 0;

  const baseDist = metrics?.totalDistanceKm ?? 0;
  const baseDur = metrics?.totalDurationMin ?? 0;
  const baseDrivingTime = metrics?.drivingTimeMin ?? 0;
  const baseServiceTime = metrics?.serviceDurationMin ?? 0;
  const baseCost = metrics?.costInr ?? 0;
  const baseFuel = metrics?.fuelConsumed ?? 0;
  const fuelUnit = metrics?.fuelUnit || (isElectric ? 'kWh' : 'L');

  const distSaved = Math.max(0, baseDist - optDist);
  const timeSaved = Math.max(0, baseDur - optDur);
  const costSaved = Math.max(0, baseCost - optCost);
  const fuelSaved = Math.max(0, baseFuel - optFuel);

  const isImproved = Boolean(optResult?.deltas?.isImproved);

  const formatHoursMins = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0 min';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  return (
    <div className="bg-surface-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      {/* 1. Header Bar */}
      <div className="p-3.5 bg-surface-low border-b border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25 flex items-center justify-center font-bold">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                Current Route — Before Optimization
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-[4px] font-bold border ${
                  hasOptimized
                    ? 'bg-surface-container text-on-surface-variant border-outline-variant/80'
                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                }`}
              >
                {isLoading
                  ? 'EVALUATING...'
                  : hasOptimized
                  ? 'BASELINE AUDIT'
                  : 'LIVE BASELINE'}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Live evaluation using road-network matrix, actual fleet vehicle efficiency, and current delivery sequence.
            </p>
          </div>
        </div>

        {/* Google Maps Shortcut for Current Route */}
        {baseline?.googleMapsUrls?.currentRoute && (
          <a
            href={injectDeviceLocationIntoUrl(baseline.googleMapsUrls.currentRoute)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-semibold text-secondary hover:bg-surface-high transition-colors text-decoration-none shadow-xs"
            title="Open Current Unoptimized Route in Google Maps"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span>Open Current Route in Google Maps</span>
          </a>
        )}
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-lowest">
        {/* Total Road Distance */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Distance</span>
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-base font-bold font-mono text-on-surface mt-1">
            {isLoading ? '...' : `${baseDist.toFixed(1)} km`}
          </div>
          <span className="text-[10px] text-on-surface-variant block mt-0.5">
            Actual road network
          </span>
        </div>

        {/* Driving & Total Time */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Driving Time</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base font-bold font-mono text-on-surface mt-1">
            {isLoading ? '...' : `${Math.round(baseDrivingTime)} min`}
          </div>
          <span className="text-[10px] text-on-surface-variant block mt-0.5">
            Total Est: {isLoading ? '...' : formatHoursMins(baseDur)}
          </span>
        </div>

        {/* Estimated Arrival */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Estimated Arrival</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {isLoading ? '...' : metrics?.estimatedArrival || '—'}
          </div>
          <span className="text-[10px] text-on-surface-variant block mt-0.5">
            Departing {metrics?.departureTime || '09:00 AM'}
          </span>
        </div>

        {/* Fuel / Energy Consumption & Cost */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
          <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              {isElectric ? 'Energy Consumption' : 'Fuel Consumption'}
            </span>
            {isElectric ? (
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Fuel className="w-3.5 h-3.5 text-red-600" />
            )}
          </div>
          <div className="text-base font-bold font-mono text-on-surface mt-1">
            {isLoading ? '...' : `${baseFuel.toFixed(2)} ${fuelUnit}`}
          </div>
          <span className="text-[10px] text-on-surface-variant block mt-0.5 font-mono">
            Est. Cost: ₹{baseCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 3. Starting & Ending Location Strip */}
      {metrics && (
        <div className="px-4 py-2.5 bg-surface-low/50 border-t border-b border-outline-variant/50 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span>
              <strong>Starting:</strong> {metrics.startingLocation.name} ({metrics.startingLocation.address})
            </span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface border border-outline-variant font-semibold">
              {metrics.stopsCount} deliveries ({metrics.totalPayloadKg} kg)
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>
              <strong>Ending:</strong> {metrics.endingLocation.name} (Return Depot)
            </span>
          </div>
        </div>
      )}

      {/* 4. Before vs After Optimization Comparison Table (Appears after optimization) */}
      {hasOptimized && (
        <div className="p-4 bg-surface-low/30 border-t border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                Performance Comparison: Current Route vs Optimized Route
              </h4>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-[4px] border font-bold ${
                isImproved
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
              }`}
            >
              {isImproved ? 'SAVINGS VERIFIED' : 'CURRENT ROUTE ALREADY OPTIMAL'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-outline-variant rounded-lg overflow-hidden bg-surface-lowest">
              <thead className="bg-surface-low border-b border-outline-variant text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                <tr>
                  <th className="py-2 px-3">Metric</th>
                  <th className="py-2 px-3">Current Route (Baseline)</th>
                  <th className="py-2 px-3">Optimized Route</th>
                  <th className="py-2 px-3">Difference / Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-mono text-xs">
                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-on-surface">Total Distance</td>
                  <td className="py-2 px-3 text-on-surface">{baseDist.toFixed(2)} km</td>
                  <td className="py-2 px-3 text-on-surface font-bold">{optDist.toFixed(2)} km</td>
                  <td className="py-2 px-3">
                    {distSaved > 0.01 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> -{distSaved.toFixed(2)} km ({((distSaved / baseDist) * 100).toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">0.00 km (Optimal)</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-on-surface">Driving Time</td>
                  <td className="py-2 px-3 text-on-surface">{Math.round(baseDrivingTime)} min</td>
                  <td className="py-2 px-3 text-on-surface font-bold">
                    {Math.round(optMetrics?.drivingTimeMin || optDur)} min
                  </td>
                  <td className="py-2 px-3">
                    {timeSaved > 0.1 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> -{timeSaved.toFixed(0)} min
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">0 min (Optimal)</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-on-surface">Total Estimated Time</td>
                  <td className="py-2 px-3 text-on-surface">{formatHoursMins(baseDur)}</td>
                  <td className="py-2 px-3 text-on-surface font-bold">{formatHoursMins(optDur)}</td>
                  <td className="py-2 px-3">
                    {timeSaved > 0.1 ? (
                      <span className="text-emerald-600 font-bold">-{formatHoursMins(timeSaved)}</span>
                    ) : (
                      <span className="text-on-surface-variant">Identical duration</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-on-surface">
                    {isElectric ? 'Energy Consumption' : 'Fuel Consumption'}
                  </td>
                  <td className="py-2 px-3 text-on-surface">
                    {baseFuel.toFixed(2)} {fuelUnit}
                  </td>
                  <td className="py-2 px-3 text-on-surface font-bold">
                    {optFuel.toFixed(2)} {fuelUnit}
                  </td>
                  <td className="py-2 px-3">
                    {fuelSaved > 0.01 ? (
                      <span className="text-emerald-600 font-bold">
                        -{fuelSaved.toFixed(2)} {fuelUnit}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">0.00 {fuelUnit}</span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-3 font-sans font-medium text-on-surface">Operating Cost</td>
                  <td className="py-2 px-3 text-on-surface">₹{baseCost.toFixed(2)}</td>
                  <td className="py-2 px-3 text-on-surface font-bold">₹{optCost.toFixed(2)}</td>
                  <td className="py-2 px-3">
                    {costSaved > 0.05 ? (
                      <span className="text-emerald-600 font-bold">
                        -₹{costSaved.toFixed(2)} ({((costSaved / baseCost) * 100).toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">₹0.00 (Optimal)</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4.5 Vehicle Assignment Display (shown after optimization) */}
      {vehicleAssignments && vehicleAssignments.length > 0 && (
        <div className="p-4 bg-surface-low/30 border-t border-outline-variant space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">
              Auto-Assigned Fleet
            </h4>
            {vehicleAssignments.length > 1 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] border bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold">
                SPLIT ACROSS {vehicleAssignments.length} VEHICLES
              </span>
            )}
          </div>
          {vehicleAssignments.length > 1 && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
              Batch split across {vehicleAssignments.length} vehicles for capacity — review each route below before dispatch.
            </div>
          )}
          <div className="space-y-2">
            {vehicleAssignments.map((va, idx) => (
              <div
                key={va.binIndex ?? idx}
                className="p-3 rounded-xl bg-surface-lowest border border-outline-variant/60 flex items-center justify-between flex-wrap gap-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-on-surface">{va.vehiclePlate}</span>
                      <span className="text-[10px] text-on-surface-variant">{va.makeModel}</span>
                      {va.utilizationPercent != null && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] border ${
                          va.utilizationPercent >= 90
                            ? 'bg-error/10 text-error border-error/30'
                            : va.utilizationPercent >= 75
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}>
                          {va.utilizationPercent}% load
                        </span>
                      )}
                    </div>
                    {va.driverName && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3 text-on-surface-variant" />
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          {va.driverName}
                          {va.driverLicenseNumber && ` · ${va.driverLicenseNumber}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onChangeVehicle && (
                    <button
                      type="button"
                      onClick={() => onChangeVehicle(va.binIndex ?? idx)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                      title="Override vehicle selection"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Change Vehicle
                    </button>
                  )}
                  {onChangeDriver && va.driverId && (
                    <button
                      type="button"
                      onClick={() => onChangeDriver(va.binIndex ?? idx)}
                      className="text-[11px] font-semibold text-secondary hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/10 transition-colors"
                      title="Override driver assignment"
                    >
                      <User className="w-3 h-3" />
                      Change Driver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Bottom Action Bar */}
      <div className="p-3 bg-surface-low/80 border-t border-outline-variant flex items-center justify-between flex-wrap gap-2">
        <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          <span>
            {hasOptimized
              ? (isImproved
                ? 'Optimization complete. Ready to dispatch from header or impact bar below.'
                : 'Current route is verified optimal. Ready to dispatch.')
              : 'Ready to evaluate, optimize, or dispatch from the controls above.'}
          </span>
        </div>
      </div>
    </div>
  );
};
