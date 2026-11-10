import React, { useState } from 'react';
import {
  OptimizationConfig,
  StrategyPreset,
  TrafficScenario,
  VehiclePreference,
  RouteStop,
} from '../../types/route';
import { DeliveryBatch, Vehicle, Driver } from '../../types';
import { Button } from '../common/Button';
import {
  Sliders,
  Route,
  Truck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Gauge,
  Layers,
  Radio,
} from 'lucide-react';

export interface OptimizationControlPanelProps {
  batch: DeliveryBatch | null;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  drivers?: Driver[];
  assignedDriver: Driver | null;
  onSelectDriver?: (driverId: string) => void;
  stops: RouteStop[];
  onReorderStops: (startIndex: number, endIndex: number) => void;
  config: OptimizationConfig;
  activePreset: StrategyPreset;
  onApplyPreset: (preset: StrategyPreset) => void;
  onUpdateWeight: (key: keyof OptimizationConfig['weights'], value: number) => void;
  onUpdateScenario: (scenario: TrafficScenario) => void;
  onUpdateMaxIterations: (iterations: number) => void;
  onUpdateVehiclePreference: (pref: VehiclePreference) => void;
  isOptimizing: boolean;
  optimizationProgress: number;
  onRunOptimization: () => void;
  onPushReorderedSequence?: () => void;
  isPushingReorder?: boolean;
  isDispatched?: boolean;
}

export const OptimizationControlPanel: React.FC<OptimizationControlPanelProps> = ({
  batch,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  drivers = [],
  assignedDriver,
  onSelectDriver,
  stops,
  onReorderStops,
  config,
  activePreset,
  onApplyPreset,
  onUpdateWeight,
  onUpdateScenario,
  onUpdateMaxIterations,
  onUpdateVehiclePreference,
  isOptimizing,
  optimizationProgress,
  onRunOptimization,
  onPushReorderedSequence,
  isPushingReorder = false,
  isDispatched = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Selected vehicle details
  const activeVehicle = vehicles.find(
    (v) => v.id === selectedVehicleId || v.vehicleId === selectedVehicleId
  );

  // Total stop payload calculation
  const totalWeightKg = stops.reduce((acc, s) => acc + (s.weightKg || 0), 0);
  const capacityKg = activeVehicle?.capacityKg || 1000;
  const payloadPercent = Math.min(Math.round((totalWeightKg / capacityKg) * 100), 100);

  // Payload bar color transition: <80% primary, 80-100% amber, >100% red
  const payloadBarColor =
    totalWeightKg > capacityKg
      ? 'bg-error'
      : payloadPercent >= 80
      ? 'bg-amber-500'
      : 'bg-primary';

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < stops.length) {
      onReorderStops(index, targetIndex);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Route Parameters Card */}
      <div className="p-4 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block leading-tight">
                Rasulgarh Logistics Hub
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Closed-Loop TSP • Origin & Return
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-surface-low dark:bg-obsidian-850 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-primary font-semibold text-on-surface dark:text-zinc-200">
            {batch?.code || 'BATCH-BBSR-01'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-outline-variant/60 font-mono">
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-sans">
              Schedule / Shift
            </span>
            <span className="font-semibold text-on-surface">
              {batch?.date || 'Today'} • {batch?.shift || 'Shift A (08:30 AM)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-sans">
              Active Manifest
            </span>
            <span className="font-semibold text-on-surface">
              {stops.length} Deliveries Ready
            </span>
          </div>
        </div>
      </div>

      {/* 2. Optimization Strategy & Sliders Card */}
      <div className="p-4 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">
                Algorithm Strategy & Objective Weights
              </span>
              <span className="text-[10px] text-on-surface-variant">
                Bounded 2-Opt Local Search Tuning
              </span>
            </div>
          </div>
        </div>

        {/* Traffic & Vehicle Allocation Controls */}
        <div className="pt-1 border-t border-outline-variant/60">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-semibold text-on-surface-variant hover:text-on-surface py-1"
          >
            <span>Routing Parameters</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pt-2">
              {/* Max 2-Opt Iterations */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface font-medium">Max 2-Opt Iterations</span>
                  <span className="font-mono text-primary font-bold tabular-nums">
                    {config.maxIterations}
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={config.maxIterations}
                  onChange={(e) => onUpdateMaxIterations(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-surface-container rounded-lg cursor-pointer"
                />
              </div>

              {/* Traffic Multiplier Scenario */}
              <div className="space-y-1">
                <label className="text-xs text-on-surface font-medium block">
                  Deterministic Traffic Scenario
                </label>
                <select
                  value={config.trafficScenario}
                  onChange={(e) => onUpdateScenario(e.target.value as TrafficScenario)}
                  className="w-full h-9 px-3 rounded-xl bg-surface-low border border-outline-variant font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="FREE_FLOW">FREE_FLOW (1.0x baseline speed)</option>
                  <option value="MORNING_RUSH">MORNING_RUSH (1.8x peak commute)</option>
                  <option value="EVENING_PEAK">EVENING_PEAK (2.2x corridor rush)</option>
                  <option value="MONSOON_RAIN">MONSOON_RAIN (1.5x rain slowdown)</option>
                  <option value="WEEKEND">WEEKEND (1.1x moderate pace)</option>
                </select>
              </div>

              {/* Vehicle Propulsion Preference */}
              <div className="space-y-1">
                <label className="text-xs text-on-surface font-medium block">
                  Propulsion Allocation Priority
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onUpdateVehiclePreference('EV_PREFERRED')}
                    className={`py-1.5 px-2 rounded-lg font-medium text-center border transition-colors ${
                      config.vehiclePreference === 'EV_PREFERRED'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'border-outline-variant/60 dark:border-obsidian-750 text-on-surface-variant dark:text-slate-400 hover:bg-surface-low dark:hover:bg-obsidian-850'
                    }`}
                  >
                    EV Preferred
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateVehiclePreference('COST_OPTIMAL')}
                    className={`py-1.5 px-2 rounded-lg font-medium text-center border transition-colors ${
                      config.vehiclePreference === 'COST_OPTIMAL'
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'border-outline-variant/60 dark:border-obsidian-750 text-on-surface-variant dark:text-slate-400 hover:bg-surface-low dark:hover:bg-obsidian-850'
                    }`}
                  >
                    Cost Optimal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Run Optimization CTA */}
        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
            onClick={onRunOptimization}
            isLoading={isOptimizing}
            leftIcon={<Route className="w-4 h-4" />}
          >
            {isOptimizing ? `Optimizing Route (${optimizationProgress}%)` : 'Optimize Route'}
          </Button>

          {isOptimizing && (
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-primary h-1.5 transition-all duration-200"
                style={{ width: `${optimizationProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Assigned Telemetry & Driver Card */}
      <div className="p-4 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">
                Assigned Fleet Telemetry
              </span>
              <span className="text-[10px] text-on-surface-variant">
                1:1 Vehicle & Driver Allocation
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle Selector */}
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase font-mono block mb-1">
            Dispatch Vehicle
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => onSelectVehicle(e.target.value)}
            className="w-full h-9 px-3 rounded-xl bg-surface-low border border-outline-variant font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleId} • {v.makeModel} ({v.fuelType}, {v.capacityKg}kg)
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Payload Gauge Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-on-surface-variant flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              <span>Payload Utilization</span>
            </span>
            <span className="font-mono font-bold text-on-surface tabular-nums">
              {totalWeightKg.toFixed(1)} / {capacityKg} kg ({payloadPercent}%)
            </span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 transition-all duration-300 ${payloadBarColor}`}
              style={{ width: `${payloadPercent}%` }}
            />
          </div>
        </div>

        {/* Driver Selector for Work Distribution */}
        <div>
          <label className="text-[10px] text-on-surface-variant uppercase font-mono block mb-1">
            Assign Driver (Work Distribution)
          </label>
          <select
            value={assignedDriver?.id || ''}
            onChange={(e) => onSelectDriver?.(e.target.value)}
            className="w-full h-9 px-3 rounded-xl bg-surface-low border border-outline-variant font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {drivers && drivers.length > 0 ? (
              drivers.map((d) => {
                const driverId = d.id || (d as any)._id;
                const driverName =
                  typeof d.userId === 'object' && (d.userId as any)?.name
                    ? (d.userId as any).name
                    : (d as any).name || `Driver (${d.licenseNumber})`;
                const vehicleTag = (d.assignedVehicleId as any)?.vehicleId
                  ? `[${(d.assignedVehicleId as any).vehicleId}]`
                  : '[Pool]';
                return (
                  <option key={driverId} value={driverId}>
                    {driverName} • {d.licenseNumber} {vehicleTag} ({d.availability || 'AVAILABLE'})
                  </option>
                );
              })
            ) : (
              <option value="">No drivers available</option>
            )}
          </select>
        </div>

        {/* Driver Profile Info */}
        <div className="p-3 bg-surface-low rounded-xl border border-outline-variant/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm">
              {assignedDriver?.licenseNumber?.slice(0, 2) || 'DR'}
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface block">
                {typeof assignedDriver?.userId === 'object' && (assignedDriver.userId as any)?.name
                  ? (assignedDriver.userId as any).name
                  : assignedDriver?.licenseNumber
                  ? `Driver #${assignedDriver.licenseNumber}`
                  : 'Assigned Driver'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {assignedDriver?.phone ? assignedDriver.phone : 'Contact registered'} • Rating {assignedDriver?.rating ? `${assignedDriver.rating.toFixed(1)}/5` : '4.9/5'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-lowest dark:bg-obsidian-800 text-on-surface dark:text-slate-300 font-medium border border-outline-variant/60 dark:border-obsidian-750">
            {assignedDriver?.availability || 'AVAILABLE'}
          </span>
        </div>
      </div>

      {/* 4. Delivery Manifest Sequence Manager */}
      <div className="p-4 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">
                Delivery Manifest Sequence
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                Ordered Waypoints ({stops.length} Stops)
              </span>
            </div>
          </div>
          {onPushReorderedSequence && (
            <Button
              size="sm"
              variant="primary"
              className="py-1 px-2.5 text-xs font-semibold shadow-sm"
              onClick={onPushReorderedSequence}
              isLoading={isPushingReorder}
              leftIcon={<Radio className="w-3.5 h-3.5" />}
            >
              {isDispatched ? 'Sync Sequence to Driver' : 'Push to Driver Handheld'}
            </Button>
          )}
        </div>

        {/* Start Depot */}
        <div className="p-3 rounded-xl bg-surface-low border border-primary/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-sm">
              D
            </span>
            <div>
              <span className="font-semibold text-on-surface block">Origin: Rasulgarh Depot</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Departure: 08:30 AM</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-primary font-bold">DEPOT</span>
        </div>

        {/* Stops List with up/down controls */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {stops.map((stop, idx) => (
            <div
              key={stop.deliveryId || idx}
              className="p-2.5 rounded-xl bg-surface-low border border-outline-variant/60 hover:border-primary transition-colors flex items-center justify-between text-xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 shrink-0 rounded-full bg-primary text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-sm">
                  {stop.sequenceOrder || idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-on-surface truncate block">
                      {stop.recipientName || stop.orderReference || `Stop #${idx + 1}`}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] shrink-0 border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                        stop.priority === 'Urgent'
                          ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
                          : stop.priority === 'Cold Chain'
                          ? 'border-l-sky-400 text-on-surface dark:text-sky-200'
                          : 'border-l-zinc-400 dark:border-l-zinc-500 text-on-surface-variant dark:text-zinc-300'
                      }`}
                    >
                      {stop.priority || 'Standard'}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant truncate block font-mono">
                    {stop.streetAddress || stop.zone || 'Bhubaneswar'} • {stop.weightKg ?? 0} kg
                  </span>
                </div>
              </div>

              {/* Resequence Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveStop(idx, 'up')}
                  className="p-1 rounded-lg hover:bg-surface-lowest disabled:opacity-30 text-on-surface-variant"
                  title="Move Up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === stops.length - 1}
                  onClick={() => moveStop(idx, 'down')}
                  className="p-1 rounded-lg hover:bg-surface-lowest disabled:opacity-30 text-on-surface-variant"
                  title="Move Down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Return Depot */}
        <div className="p-3 rounded-xl bg-surface-low border border-primary/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-sm">
              D
            </span>
            <div>
              <span className="font-semibold text-on-surface block">Return: Rasulgarh Depot</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Estimated: 03:15 PM</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-primary font-bold">DEPOT</span>
        </div>
      </div>
    </div>
  );
};
