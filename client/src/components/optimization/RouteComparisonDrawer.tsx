import React from 'react';
import { OptimizationResult } from '../../types/route';
import { Drawer } from '../common/Drawer';
import { AlertTriangle } from 'lucide-react';

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

  const distanceSaved = deltas?.distanceSavedKm != null ? deltas.distanceSavedKm.toFixed(1) : '0.0';
  const percentDistance = deltas?.percentDistanceReduction != null ? deltas.percentDistanceReduction.toFixed(1) : '0.0';
  const timeSaved = deltas?.timeSavedMin != null ? Math.round(deltas.timeSavedMin) : 0;
  const percentTime =
    baseline?.metrics?.totalDurationMin && baseline.metrics.totalDurationMin > 0 && deltas?.timeSavedMin != null
      ? ((deltas.timeSavedMin / baseline.metrics.totalDurationMin) * 100).toFixed(1)
      : deltas?.percentTimeReduction != null
      ? deltas.percentTimeReduction.toFixed(1)
      : '0.0';
  const costSaved = deltas?.costSavedInr != null ? Math.round(deltas.costSavedInr).toLocaleString('en-IN') : '0';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Route Sequence Comparison"
      subtitle="Baseline Nearest-Neighbor vs 2-Opt Algorithmic Diff"
      width="lg"
    >
      <div className="space-y-5">
        {/* 1. Algorithmic Impact Summary Banner */}
        <div className="p-4 bg-surface-low rounded-xl border border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
              Performance Improvements
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
              {result?.converged ? 'Local Search Converged' : 'Optimization Result'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Distance */}
            <div className="p-2.5 bg-surface-lowest rounded-lg border border-outline-variant">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Distance</span>
              <span className="text-sm font-bold text-emerald-600 font-mono tabular-nums block">
                -{distanceSaved} km
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                -{percentDistance}%
              </span>
            </div>

            {/* Duration */}
            <div className="p-2.5 bg-surface-lowest rounded-lg border border-outline-variant">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Drive Time</span>
              <span className="text-sm font-bold text-emerald-600 font-mono tabular-nums block">
                -{timeSaved} min
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                -{percentTime}%
              </span>
            </div>

            {/* Fuel / Cost */}
            <div className="p-2.5 bg-surface-lowest rounded-lg border border-outline-variant">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Cost Saved</span>
              <span className="text-sm font-bold text-emerald-600 font-mono tabular-nums block">
                -₹{costSaved}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Fuel/Energy
              </span>
            </div>
          </div>

          {/* Choke Point / Traffic Bypass Notification */}
          <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/30 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-semibold block">Traffic & Routing Efficiency:</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {deltas?.chokePointsBypassed && deltas.chokePointsBypassed.length > 0
                  ? `2-opt edge inversion eliminated transit bottleneck through ${deltas.chokePointsBypassed.join(', ')}.`
                  : Number(timeSaved) > 0
                  ? `2-opt edge inversion optimized waypoint sequencing, saving ${timeSaved} minutes compared to greedy routing.`
                  : `Route sequencing analyzed against local transit constraints.`}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Side-by-Side Stop Sequence Diff */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-on-surface px-1">
            <span>Baseline Sequence (Greedy NN)</span>
            <span>Optimized Sequence (2-Opt)</span>
          </div>

          {optimizedStops.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant bg-surface-low rounded-lg border border-dashed border-outline-variant">
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

              return (
                <div
                  key={`diff-${optStop.deliveryId || idx}`}
                  className={`p-3 rounded-lg border transition-all text-xs grid grid-cols-2 gap-3 items-center ${
                    isDifferent
                      ? 'bg-blue-50/50 border-secondary/30'
                      : 'bg-surface-low border-outline-variant'
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

                  {/* Right: Optimized Stop with Sequence Arrow */}
                  <div className="flex items-center gap-2 min-w-0 border-l border-outline-variant pl-3">
                    <span
                      className={`w-5 h-5 rounded-full font-mono font-bold text-[10px] flex items-center justify-center shrink-0 ${
                        isDifferent ? 'bg-secondary text-white' : 'bg-slate-300 text-slate-700'
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
                          <span className="text-[8px] bg-secondary/20 text-secondary font-bold px-1 rounded">
                            SWAPPED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-on-surface-variant block font-mono truncate">
                        {optStop.streetAddress || optStop.zone || 'Bhubaneswar'}
                      </span>
                    </div>
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
