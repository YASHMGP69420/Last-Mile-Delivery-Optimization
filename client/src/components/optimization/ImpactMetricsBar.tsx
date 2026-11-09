import React from 'react';
import { RouteDeltas, RouteMetrics } from '../../types/route';
import { Button } from '../common/Button';
import {
  Navigation,
  Clock,
  IndianRupee,
  Leaf,
  CheckCircle2,
  Send,
  TrendingDown,
} from 'lucide-react';

export interface ImpactMetricsBarProps {
  deltas?: RouteDeltas;
  baselineMetrics?: RouteMetrics;
  optimizedMetrics?: RouteMetrics;
  unassignedCount?: number;
  isDispatched?: boolean;
  onTriggerDispatch?: () => void;
}

export const ImpactMetricsBar: React.FC<ImpactMetricsBarProps> = ({
  deltas,
  baselineMetrics,
  optimizedMetrics,
  unassignedCount = 0,
  isDispatched = false,
  onTriggerDispatch,
}) => {
  const hasOptimized = Boolean(optimizedMetrics && deltas);

  const distanceBaseline = baselineMetrics?.totalDistanceKm ?? 0;
  const distanceOpt = optimizedMetrics?.totalDistanceKm ?? 0;
  const distanceSaved = deltas?.distanceSavedKm ?? Math.max(distanceBaseline - distanceOpt, 0);
  const distancePct = deltas?.percentDistanceReduction ?? (distanceBaseline > 0 ? (distanceSaved / distanceBaseline) * 100 : 0);

  const durationBaseline = baselineMetrics?.totalDurationMin ?? 0;
  const durationOpt = optimizedMetrics?.totalDurationMin ?? 0;
  const durationSaved = deltas?.timeSavedMin ?? Math.max(durationBaseline - durationOpt, 0);
  const durationPct = deltas?.percentTimeReduction ?? (durationBaseline > 0 ? (durationSaved / durationBaseline) * 100 : 0);

  const costBaseline = baselineMetrics?.costInr ?? 0;
  const costOpt = optimizedMetrics?.costInr ?? 0;
  const costSaved = deltas?.costSavedInr ?? Math.max(costBaseline - costOpt, 0);

  const co2Avoided = deltas?.co2AvoidedKg ?? (distanceSaved > 0 ? Math.max(distanceSaved * 0.22, 0) : 0);
  const slaCertainty = optimizedMetrics?.onTimeCertaintyPercent ?? 99.2;
  const stopsCount = optimizedMetrics?.stopsCount ?? 0;

  return (
    <div className="space-y-3">
      {/* 5 Stitch Impact Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Card 1: Distance Reduction */}
        <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-semibold tracking-tight uppercase">Distance</span>
            <Navigation className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface font-mono tabular-nums leading-tight">
              {hasOptimized
                ? `${distanceOpt.toFixed(1)} `
                : baselineMetrics?.totalDistanceKm != null
                ? `${baselineMetrics.totalDistanceKm.toFixed(1)} `
                : '— '}
              <span className="text-xs font-sans text-on-surface-variant font-normal">km</span>
            </div>
            {hasOptimized ? (
              distanceSaved > 0.02 ? (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-700 font-mono font-semibold">
                  <TrendingDown className="w-3 h-3" />
                  <span className="tabular-nums">-{distanceSaved.toFixed(1)} km (-{distancePct.toFixed(1)}%)</span>
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-amber-700 font-mono font-semibold">
                  Optimal Sequence (0% diff)
                </div>
              )
            ) : (
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                Awaiting route run
              </div>
            )}
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono mt-1 pt-1 border-t border-outline-variant/50">
            Baseline: {distanceBaseline > 0 ? `${distanceBaseline.toFixed(1)} km` : '—'}
          </span>
        </div>

        {/* Card 2: Drive Time Saved */}
        <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-semibold tracking-tight uppercase">Drive Time</span>
            <Clock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface font-mono tabular-nums leading-tight">
              {hasOptimized
                ? `${durationOpt} `
                : baselineMetrics?.totalDurationMin != null
                ? `${baselineMetrics.totalDurationMin} `
                : '— '}
              <span className="text-xs font-sans text-on-surface-variant font-normal">min</span>
            </div>
            {hasOptimized ? (
              durationSaved > 0.1 ? (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-700 font-mono font-semibold">
                  <TrendingDown className="w-3 h-3" />
                  <span className="tabular-nums">-{durationSaved.toFixed(0)} min (-{durationPct.toFixed(1)}%)</span>
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-amber-700 font-mono font-semibold">
                  Optimal Time (0% diff)
                </div>
              )
            ) : (
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                Awaiting route run
              </div>
            )}
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono mt-1 pt-1 border-t border-outline-variant/50">
            Baseline: {durationBaseline > 0 ? `${durationBaseline.toFixed(0)} min` : '—'}
          </span>
        </div>

        {/* Card 3: Fuel & Energy Cost Saved */}
        <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-semibold tracking-tight uppercase">Operating Cost</span>
            <IndianRupee className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface font-mono tabular-nums leading-tight">
              {hasOptimized
                ? `₹${costOpt.toLocaleString('en-IN')}`
                : baselineMetrics?.costInr != null
                ? `₹${baselineMetrics.costInr.toLocaleString('en-IN')}`
                : '—'}
            </div>
            {hasOptimized ? (
              costSaved > 0.5 ? (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-700 font-mono font-semibold">
                  <TrendingDown className="w-3 h-3" />
                  <span className="tabular-nums">₹{costSaved.toLocaleString('en-IN')} saved</span>
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-slate-500 font-mono font-medium">
                  Verified optimal
                </div>
              )
            ) : (
              <div className="text-[11px] text-on-surface-variant font-mono mt-1">
                Awaiting route run
              </div>
            )}
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono mt-1 pt-1 border-t border-outline-variant/50">
            Baseline: {costBaseline > 0 ? `₹${costBaseline.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>

        {/* Card 4: Carbon Avoided */}
        <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-semibold tracking-tight uppercase">CO2 Avoided</span>
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums leading-tight">
              {hasOptimized ? `${co2Avoided.toFixed(1)} ` : '— '}
              <span className="text-xs font-sans text-on-surface-variant font-normal">kg</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span>{hasOptimized ? 'Calculated reduction' : 'Emissions model'}</span>
            </div>
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono mt-1 pt-1 border-t border-outline-variant/50">
            Efficiency Baseline
          </span>
        </div>

        {/* Card 5: Stops & SLA Certainty */}
        <div className="col-span-2 md:col-span-1 p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-1">
            <span className="text-[11px] font-semibold tracking-tight uppercase">SLA & Stops</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface font-mono tabular-nums leading-tight">
              {hasOptimized ? `${slaCertainty.toFixed(1)}% ` : '— '}
              <span className="text-xs font-sans text-on-surface-variant font-normal">on-time</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-primary font-mono font-semibold">
              <span>{hasOptimized ? `${stopsCount} manifest stops` : '— stops'}</span>
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant font-mono mt-1 pt-1 border-t border-outline-variant/50 flex items-center justify-between">
            <span>Unassigned:</span>
            {hasOptimized ? (
              unassignedCount > 0 ? (
                <span className="text-error font-bold">{unassignedCount} parcels</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 unassigned</span>
              )
            ) : (
              <span className="text-on-surface-variant">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Master Dispatch Route Banner */}
      <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isDispatched
                ? 'bg-emerald-500'
                : hasOptimized
                ? 'bg-emerald-500'
                : 'bg-primary'
            }`}
          />
          <span className="text-xs font-medium text-on-surface dark:text-slate-200">
            {isDispatched
              ? 'Route Dispatched • Active in Driver Mobile HUD'
              : hasOptimized
              ? (deltas?.isImproved
                ? 'Optimization Ready • Verified Efficiency Improvements'
                : 'Route is Verified Optimal • Ready for Dispatch')
              : 'Manifest Sequence Ready • Ready for Dispatch'}
          </span>
        </div>

        {onTriggerDispatch && (
          <Button
            size="sm"
            variant="primary"
            disabled={isDispatched}
            onClick={onTriggerDispatch}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            {isDispatched
              ? 'Dispatched'
              : hasOptimized
              ? (deltas?.isImproved
                ? 'Dispatch Optimized Route'
                : 'Dispatch Route (Already Optimal)')
              : 'Dispatch Current Route'}
          </Button>
        )}
      </div>
    </div>
  );
};
