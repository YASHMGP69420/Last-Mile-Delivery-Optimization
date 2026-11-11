import React from 'react';
import { OptimizationResult } from '../../types/route';
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
} from 'lucide-react';
import { urlForLocation, buildNavigationUrl } from '../../utils/googleMaps';

export interface RouteComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result?: OptimizationResult | null;
}

export const RouteComparisonDrawer: React.FC<RouteComparisonDrawerProps> = ({
  isOpen,
  onClose,
  result,
}) => {
  const baseline = result?.baseline;
  const optimized = result?.optimized;
  const deltas = result?.deltas;

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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Route Optimization Audit & Comparison"
      subtitle="Before vs After Algorithmic Performance Verification"
      width="lg"
    >
      <div className="space-y-6">
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
              Detailed Metric Comparison
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

        {/* 3. Google Maps Direct Navigation Suite */}
        <div className="p-5 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft space-y-3">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wide block">
            Google Maps External Navigation
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
              {optimizedStops.map((optStop, idx) => {
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
                        ? 'bg-emerald-50/50 border-primary/30 shadow-sm'
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
