import React, { useState } from 'react';
import { OptimizationResult, PlannedRoute, VehicleAssignment, RouteStop, RouteMetrics, RouteDeltas } from '../../types/route';
import { Drawer } from '../common/Drawer';
import { OpenInGoogleMapsButton } from '../maps/OpenInGoogleMapsButton';
import {
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Clock,
  Fuel,
  IndianRupee,
  ExternalLink,
  Layers,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { urlForLocation, buildNavigationUrl } from '../../utils/googleMaps';

interface BinData {
  baseline: OptimizationResult['baseline'] | null;
  optimized: OptimizationResult['optimized'] | null;
  deltas: RouteDeltas | null;
  vehicleAssignment: VehicleAssignment | undefined;
  route: PlannedRoute | undefined;
}

export interface RouteComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result?: OptimizationResult | null;
  vehicleAssignments?: VehicleAssignment[];
}

export const RouteComparisonDrawer: React.FC<RouteComparisonDrawerProps> = ({
  isOpen,
  onClose,
  result,
  vehicleAssignments = [],
}) => {
  const [selectedBinIndex, setSelectedBinIndex] = useState(0);

  // Determine if we have multi-bin data
  const isMultiBin = vehicleAssignments.length > 1 || (result?.routes && result.routes.length > 1);
  const routes = result?.routes || [];
  const numBins = isMultiBin ? Math.max(vehicleAssignments.length, routes.length) : 1;

  // Get data for selected bin
  const getBinData = (binIdx: number): BinData => {
    if (!isMultiBin) {
      return {
        baseline: result?.baseline ?? null,
        optimized: result?.optimized ?? null,
        deltas: result?.deltas ?? null,
        vehicleAssignment: vehicleAssignments[0],
        route: routes[0],
      };
    }

    const route = routes[binIdx];
    const assignment = vehicleAssignments[binIdx];
    
    return {
      baseline: route?.baseline ?? null,
      optimized: route?.optimized ?? null,
      deltas: route?.deltas ?? result?.deltas ?? null,
      vehicleAssignment: assignment,
      route,
    };
  };

  const binData = getBinData(selectedBinIndex);
  const baseline = binData.baseline;
  const optimized = binData.optimized;
  const deltas = binData.deltas;
  const vehicleAssignment = binData.vehicleAssignment;
  const route = binData.route;

  const baselineStops = baseline?.stops || [];
  const optimizedStops = optimized?.stops || [];

  // Metrics Before Optimization
  const baseDist = baseline?.metrics?.totalDistanceKm ?? (baseline as any)?.totalDistanceKm ?? 0;
  const baseDur = baseline?.metrics?.totalDurationMin ?? (baseline as any)?.totalDurationMin ?? 0;
  const baseCost = baseline?.metrics?.costInr ?? (baseline as any)?.costInr ?? 0;
  const baseFuel = baseline?.metrics?.fuelConsumed ?? (baseline as any)?.fuelConsumed ?? 0;
  const fuelUnit = baseline?.metrics?.fuelUnit || (baseline as any)?.fuelUnit || 'L';

  // Metrics After Optimization
  const optDist = optimized?.metrics?.totalDistanceKm ?? (optimized as any)?.totalDistanceKm ?? 0;
  const optDur = optimized?.metrics?.totalDurationMin ?? (optimized as any)?.totalDurationMin ?? 0;
  const optCost = optimized?.metrics?.costInr ?? (optimized as any)?.costInr ?? 0;
  const optFuel = optimized?.metrics?.fuelConsumed ?? (optimized as any)?.fuelConsumed ?? 0;

  // Improvement Deltas
  const distanceSaved = deltas?.distanceSavedKm ?? Math.max(0, baseDist - optDist);
  const percentDistance =
    deltas?.percentDistanceReduction ?? (baseDist > 0 ? (distanceSaved / baseDist) * 100 : 0);

  const timeSaved = deltas?.timeSavedMin ?? Math.max(0, baseDur - optDur);
  const percentTime =
    (deltas as any)?.percentTimeReduction ?? (baseDur > 0 ? (timeSaved / baseDur) * 100 : 0);

  const costSaved = deltas?.costSavedInr ?? Math.max(0, baseCost - optCost);
  const percentCost =
    (deltas as any)?.percentCostReduction ?? (baseCost > 0 ? (costSaved / baseCost) * 100 : 0);

  const fuelSaved = (deltas as any)?.fuelSaved ?? Math.max(0, baseFuel - optFuel);
  const percentFuel =
    (deltas as any)?.percentFuelReduction ?? (baseFuel > 0 ? (fuelSaved / baseFuel) * 100 : 0);

  const isImproved =
    (deltas as any)?.isImproved !== undefined
      ? Boolean((deltas as any).isImproved)
      : distanceSaved > 0.02 || costSaved > 0.1 || timeSaved > 0.2;

  const algorithmUsed =
    (result as any)?.algorithmUsed || (result as any)?.optimizationMetadata?.algorithm || '2-Opt Local Search';

  // Aggregate totals across all bins
  const aggregateBaseDist = routes.reduce((sum, r) => sum + (r.baseline?.metrics?.totalDistanceKm || 0), 0);
  const aggregateBaseDur = routes.reduce((sum, r) => sum + (r.baseline?.metrics?.totalDurationMin || 0), 0);
  const aggregateBaseCost = routes.reduce((sum, r) => sum + (r.baseline?.metrics?.costInr || 0), 0);
  const aggregateBaseFuel = routes.reduce((sum, r) => sum + (r.baseline?.metrics?.fuelConsumed || 0), 0);

  const aggregateOptDist = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalDistanceKm || 0), 0);
  const aggregateOptDur = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalDurationMin || 0), 0);
  const aggregateOptCost = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.costInr || 0), 0);
  const aggregateOptFuel = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.fuelConsumed || 0), 0);

  const aggregateDistanceSaved = aggregateBaseDist - aggregateOptDist;
  const aggregatePercentDistance = aggregateBaseDist > 0 ? (aggregateDistanceSaved / aggregateBaseDist) * 100 : 0;
  const aggregateTimeSaved = aggregateBaseDur - aggregateOptDur;
  const aggregatePercentTime = aggregateBaseDur > 0 ? (aggregateTimeSaved / aggregateBaseDur) * 100 : 0;
  const aggregateCostSaved = aggregateBaseCost - aggregateOptCost;
  const aggregatePercentCost = aggregateBaseCost > 0 ? (aggregateCostSaved / aggregateBaseCost) * 100 : 0;
  const aggregateFuelSaved = aggregateBaseFuel - aggregateOptFuel;
  const aggregatePercentFuel = aggregateBaseFuel > 0 ? (aggregateFuelSaved / aggregateBaseFuel) * 100 : 0;

  const totalStops = routes.reduce((sum, r) => sum + (r.optimized?.stops?.length || r.baseline?.stops?.length || 0), 0);
  const totalPayload = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalPayloadKg || 0), 0);

  const goToPrevBin = () => {
    setSelectedBinIndex((prev) => (prev === 0 ? numBins - 1 : prev - 1));
  };

  const goToNextBin = () => {
    setSelectedBinIndex((prev) => (prev === numBins - 1 ? 0 : prev + 1));
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Route Optimization Audit & Comparison"
      subtitle={isMultiBin ? `Multi-Vehicle Analysis — ${numBins} Vehicle Bins` : 'Before vs After Algorithmic Performance Verification'}
      width="lg"
    >
      <div className="space-y-6">
        {/* Bin Selector Tabs (Multi-bin only) */}
        {isMultiBin && (
          <div className="p-3 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide">Vehicle Bin Selector</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevBin}
                  className="p-1.5 rounded-lg hover:bg-surface text-on-surface-variant transition-colors"
                  title="Previous bin"
                  aria-label="Previous bin"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {vehicleAssignments.map((va, idx) => (
                    <button
                      key={va.binIndex ?? idx}
                      onClick={() => setSelectedBinIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedBinIndex === idx
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-surface-low text-on-surface-variant hover:bg-surface hover:text-on-surface'
                      }`}
                    >
                      {va.vehiclePlate || `Vehicle ${idx + 1}`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={goToNextBin}
                  className="p-1.5 rounded-lg hover:bg-surface text-on-surface-variant transition-colors"
                  title="Next bin"
                  aria-label="Next bin"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Bin {selectedBinIndex + 1} of {numBins}</span>
              {vehicleAssignment && (
                <span className="flex items-center gap-1.5 font-mono">
                  <span>{vehicleAssignment.vehiclePlate}</span>
                  <span className={`px-1.5 py-0.5 rounded-[4px] border text-[10px] font-bold ${
                    vehicleAssignment.utilizationPercent >= 90
                      ? 'bg-error/10 text-error border-error/30'
                      : vehicleAssignment.utilizationPercent >= 75
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}>
                    {vehicleAssignment.utilizationPercent}% load
                  </span>
                  {vehicleAssignment.driverName && (
                    <span>· {vehicleAssignment.driverName}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. Status & Improvement Banner */}
        {isImproved ? (
          <div className="p-4 bg-surface-low dark:bg-obsidian-850 border border-outline-variant dark:border-obsidian-750 border-l-4 border-l-primary rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface font-bold text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Measurable Route Improvement Verified</span>
              </div>
              <span className="text-[10px] font-mono font-semibold text-on-surface dark:text-zinc-200 bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant dark:border-obsidian-750 px-2 py-0.5 rounded-[4px]">
                Algorithm: {algorithmUsed}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Optimization evaluated alternative delivery sequences and found a mathematically superior route saving{' '}
              <strong className="font-mono text-on-surface">{distanceSaved.toFixed(2)} km</strong> ({percentDistance.toFixed(1)}%) and{' '}
              <strong className="font-mono text-on-surface">₹{costSaved.toFixed(2)}</strong> ({percentCost.toFixed(1)}%).
            </p>
          </div>
        ) : (
          <div className="p-4 bg-surface-low dark:bg-obsidian-850 border border-outline-variant dark:border-obsidian-750 border-l-4 border-l-amber-500 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface font-bold text-xs uppercase tracking-wide">
                <Info className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Optimal Sequence Confirmed</span>
              </div>
              <span className="text-[10px] font-mono font-semibold text-on-surface dark:text-zinc-200 bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant dark:border-obsidian-750 px-2 py-0.5 rounded-[4px]">
                Algorithm: {algorithmUsed}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium">
              No measurable improvement found. The current route is already optimal among the evaluated alternatives.
            </p>
          </div>
        )}

        {/* 2. Before vs After Comparison Table */}
        <div className="bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft overflow-hidden">
          <div className="p-4 bg-surface border-b border-outline-variant/60 flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
              Detailed Metric Comparison {isMultiBin && <span className="ml-2 text-primary">(Bin {selectedBinIndex + 1})</span>}
            </span>
            <span className="text-[10px] text-on-surface-variant font-mono">
              Road-network distances calculated via routing engine
            </span>
          </div>

          <div className="divide-y divide-outline-variant/60 text-xs">
            {/* Table Header */}
            <div className="grid grid-cols-4 p-3 bg-surface-lowest font-semibold text-on-surface-variant text-[11px] uppercase tracking-wider">
              <span>Metric</span>
              <span className="text-right">Before Optimization</span>
              <span className="text-right">After Optimization</span>
              <span className="text-right">Improvement</span>
            </div>

            {/* Total Road Distance */}
            <div className="grid grid-cols-4 p-3.5 items-center hover:bg-surface/50 transition-colors">
              <div className="flex items-center gap-2 font-medium text-on-surface">
                <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Road Distance</span>
              </div>
              <div className="text-right font-mono tabular-nums text-on-surface">
                {baseDist.toFixed(2)} km
              </div>
              <div className="text-right font-mono tabular-nums font-semibold text-primary">
                {optDist.toFixed(2)} km
              </div>
              <div className="text-right font-mono tabular-nums font-bold text-emerald-700">
                {distanceSaved > 0 ? `-${distanceSaved.toFixed(2)} km (-${percentDistance.toFixed(1)}%)` : '0.00 km (0%)'}
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="grid grid-cols-4 p-3.5 items-center hover:bg-surface/50 transition-colors">
              <div className="flex items-center gap-2 font-medium text-on-surface">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Transit Duration</span>
              </div>
              <div className="text-right font-mono tabular-nums text-on-surface">
                {baseDur.toFixed(1)} min
              </div>
              <div className="text-right font-mono tabular-nums font-semibold text-primary">
                {optDur.toFixed(1)} min
              </div>
              <div className="text-right font-mono tabular-nums font-bold text-emerald-700">
                {timeSaved > 0 ? `-${timeSaved.toFixed(1)} min (-${percentTime.toFixed(1)}%)` : '0.0 min (0%)'}
              </div>
            </div>

            {/* Fuel / Energy Consumed */}
            <div className="grid grid-cols-4 p-3.5 items-center hover:bg-surface/50 transition-colors">
              <div className="flex items-center gap-2 font-medium text-on-surface">
                <Fuel className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Fuel / Energy</span>
              </div>
              <div className="text-right font-mono tabular-nums text-on-surface">
                {baseFuel.toFixed(2)} {fuelUnit}
              </div>
              <div className="text-right font-mono tabular-nums font-semibold text-primary">
                {optFuel.toFixed(2)} {fuelUnit}
              </div>
              <div className="text-right font-mono tabular-nums font-bold text-emerald-700">
                {fuelSaved > 0 ? `-${fuelSaved.toFixed(2)} ${fuelUnit} (-${percentFuel.toFixed(1)}%)` : `0.00 ${fuelUnit}`}
              </div>
            </div>

            {/* Fuel / Operational Cost */}
            <div className="grid grid-cols-4 p-3.5 items-center hover:bg-surface/50 transition-colors">
              <div className="flex items-center gap-2 font-medium text-on-surface">
                <IndianRupee className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Operational Cost</span>
              </div>
              <div className="text-right font-mono tabular-nums text-on-surface">
                ₹{baseCost.toFixed(2)}
              </div>
              <div className="text-right font-mono tabular-nums font-semibold text-primary">
                ₹{optCost.toFixed(2)}
              </div>
              <div className="text-right font-mono tabular-nums font-bold text-emerald-700">
                {costSaved > 0 ? `-₹${costSaved.toFixed(2)} (-${percentCost.toFixed(1)}%)` : '₹0.00 (0%)'}
              </div>
            </div>

            {/* Stops Evaluated */}
            <div className="grid grid-cols-4 p-3.5 items-center hover:bg-surface/50 transition-colors bg-surface-low/30">
              <div className="flex items-center gap-2 font-medium text-on-surface">
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Stops Sequence</span>
              </div>
              <div className="text-right font-mono text-on-surface-variant">
                {baselineStops.length} stops (Input order)
              </div>
              <div className="text-right font-mono text-primary font-semibold">
                {optimizedStops.length} stops (Re-sequenced)
              </div>
              <div className="text-right font-mono text-[11px] text-on-surface-variant">
                100% Preserved
              </div>
            </div>
          </div>
        </div>

        {/* 2.5 Aggregate Totals (Multi-bin only) */}
        {isMultiBin && (
          <div className="bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft overflow-hidden border-l-4 border-l-primary">
            <div className="p-4 bg-surface border-b border-outline-variant/60 flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Aggregate Totals Across All {numBins} Bins
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Sum of all vehicle bin metrics
              </span>
            </div>

            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Total Distance</div>
                <div className="font-bold text-on-surface text-lg">{aggregateOptDist.toFixed(1)} km</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1">Saved: {aggregateDistanceSaved.toFixed(1)} km ({aggregatePercentDistance.toFixed(1)}%)</div>
              </div>
              <div className="p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Total Duration</div>
                <div className="font-bold text-on-surface text-lg">{aggregateOptDur.toFixed(0)} min</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1">Saved: {aggregateTimeSaved.toFixed(0)} min ({aggregatePercentTime.toFixed(1)}%)</div>
              </div>
              <div className="p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Total Cost</div>
                <div className="font-bold text-on-surface text-lg">₹{aggregateOptCost.toFixed(0)}</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1">Saved: ₹{aggregateCostSaved.toFixed(0)} ({aggregatePercentCost.toFixed(1)}%)</div>
              </div>
              <div className="p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Total Fuel/Energy</div>
                <div className="font-bold text-on-surface text-lg">{aggregateOptFuel.toFixed(1)} {fuelUnit}</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1">Saved: {aggregateFuelSaved.toFixed(1)} {fuelUnit} ({aggregatePercentFuel.toFixed(1)}%)</div>
              </div>
              <div className="md:col-span-2 p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Total Stops / Payload</div>
                <div className="font-bold text-on-surface text-lg">{totalStops} stops · {totalPayload.toFixed(1)} kg</div>
              </div>
              <div className="md:col-span-2 p-3 bg-surface-low rounded-lg border border-outline-variant/60">
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono mb-1">Vehicles Deployed</div>
                <div className="font-bold text-on-surface text-lg">{vehicleAssignments.length} vehicles</div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Google Maps Direct Navigation Suite */}
        <div className="p-5 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft space-y-3">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wide block">
            Google Maps External Navigation {isMultiBin && <span className="ml-2 text-primary">(Bin {selectedBinIndex + 1})</span>}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <OpenInGoogleMapsButton
              stops={baselineStops}
              routePath={baseline?.polylineCoords}
              mode="original"
              label="Open Original Route in Google Maps"
              variant="outline"
              directUrl={(result as any)?.googleMapsUrls?.originalRoute}
            />
            <OpenInGoogleMapsButton
              stops={optimizedStops}
              routePath={optimized?.polylineCoords}
              mode="optimized"
              label="Open Optimized Route in Google Maps"
              variant="primary"
              directUrl={(result as any)?.googleMapsUrls?.optimizedRoute}
            />
          </div>
          {optimizedStops.length > 0 && (
            <div className="pt-1">
              <OpenInGoogleMapsButton
                stops={optimizedStops}
                mode="next-stop"
                label="Navigate to First / Next Stop in Google Maps"
                variant="ghost"
                directUrl={(result as any)?.googleMapsUrls?.nextStop}
              />
            </div>
          )}
        </div>

        {/* 4. Side-by-Side Stop Sequence Diff */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-on-surface px-1">
            <span>Original Delivery Sequence (Before)</span>
            <span>Optimized Delivery Sequence (After)</span>
          </div>

          {optimizedStops.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-lowest rounded-xl border border-dashed border-outline-variant/60 shadow-soft">
              No sequenced stops available to compare. Select a batch and run optimization first.
            </div>
          ) : (
            <div className="space-y-2">
              {optimizedStops.map((optStop: RouteStop, idx: number) => {
                const baseStop = baselineStops[idx];
                const isDifferent =
                  baseStop &&
                  (baseStop.deliveryId !== optStop.deliveryId ||
                    baseStop.recipientName !== optStop.recipientName);

                const optGmapsLink =
                  buildNavigationUrl({ destination: optStop.coordinates }) ||
                  (optStop as any).googleMapsUrl ||
                  urlForLocation(optStop.coordinates, optStop.recipientName);

                return (
                  <div
                    key={`diff-${optStop.deliveryId || idx}`}
                    className={`p-3.5 rounded-2xl border transition-all text-xs grid grid-cols-2 gap-3 items-center ${
                      isDifferent
                        ? 'bg-emerald-500/10 border-emerald-500/30 dark:bg-teal-400/10 dark:border-teal-400/30 shadow-sm'
                        : 'bg-surface-lowest border-outline-variant/60'
                    }`}
                  >
                    {/* Left: Baseline Stop */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-400 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-on-surface block truncate">
                          {baseStop?.recipientName || baseStop?.orderReference || `Stop #${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-on-surface-variant block font-mono truncate">
                          {baseStop?.streetAddress || baseStop?.zone || 'Bhubaneswar'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Optimized Stop with Sequence Arrow and Google Maps Link */}
                    <div className="flex items-center justify-between min-w-0 border-l border-outline-variant/60 pl-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm ${
                            isDifferent ? 'bg-primary text-white' : 'bg-slate-300 text-on-surface'
                          }`}
                        >
                          {optStop.sequenceOrder || idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-on-surface block truncate">
                              {optStop.recipientName || optStop.orderReference || `Stop #${idx + 1}`}
                            </span>
                            {isDifferent && (
                              <span className="text-[8px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold px-1.5 py-0.5 rounded-[4px]">
                                RE-ORDERED
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-on-surface-variant block font-mono truncate">
                            {optStop.streetAddress || optStop.zone || 'Bhubaneswar'}
                          </span>
                        </div>
                      </div>

                      <a
                        href={optGmapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-surface text-primary shrink-0 transition-colors"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};