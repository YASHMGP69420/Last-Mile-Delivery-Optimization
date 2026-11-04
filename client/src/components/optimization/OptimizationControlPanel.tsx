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
  Sparkles,
  Truck,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Package,
  BatteryCharging,
  ArrowUpDown,
  Zap,
  Gauge,
  Layers,
  Fuel,
  TrendingDown,
} from 'lucide-react';

export interface OptimizationControlPanelProps {
  batch: DeliveryBatch | null;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  assignedDriver: Driver | null;
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
}

export const OptimizationControlPanel: React.FC<OptimizationControlPanelProps> = ({
  batch,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  assignedDriver,
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

  // Payload bar color transition: <80% blue, 80-100% amber, >100% red
  const payloadBarColor =
    totalWeightKg > capacityKg
      ? 'bg-error'
      : payloadPercent >= 80
      ? 'bg-amber-500'
      : 'bg-secondary';

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < stops.length) {
      onReorderStops(index, targetIndex);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Route Parameters Card */}
      <div className="p-4 bg-surface-lowest rounded-xl border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
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
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-low border border-outline-variant font-semibold text-secondary">
            {batch?.code || 'BATCH-BBSR-01'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-outline-variant font-mono">
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
      <div className="p-4 bg-surface-lowest rounded-xl border border-outline-variant shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
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

        {/* Strategy Presets */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-low rounded-lg border border-outline-variant text-xs">
          {(['BALANCED', 'FASTEST', 'ECONOMICAL'] as StrategyPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => onApplyPreset(preset)}
              className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                activePreset === preset
                  ? 'bg-secondary text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-lowest'
              }`}
            >
              {preset.charAt(0) + preset.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Weight Sliders */}
        <div className="space-y-3 pt-1">
          {/* Distance */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface font-medium">Minimize Road Distance</span>
              <span className="font-mono text-secondary font-bold tabular-nums">
                {config.weights.distanceWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.weights.distanceWeight}
              onChange={(e) => onUpdateWeight('distanceWeight', Number(e.target.value))}
              className="w-full accent-secondary h-1.5 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          {/* Time */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface font-medium">Minimize Delivery Duration</span>
              <span className="font-mono text-secondary font-bold tabular-nums">
                {config.weights.timeWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.weights.timeWeight}
              onChange={(e) => onUpdateWeight('timeWeight', Number(e.target.value))}
              className="w-full accent-secondary h-1.5 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          {/* Fuel / Energy Cost */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface font-medium">Fuel & Energy Cost Efficiency</span>
              <span className="font-mono text-secondary font-bold tabular-nums">
                {config.weights.fuelCostWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.weights.fuelCostWeight}
              onChange={(e) => onUpdateWeight('fuelCostWeight', Number(e.target.value))}
              className="w-full accent-secondary h-1.5 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          {/* VIP / Time Window */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface font-medium">Prioritize Urgent & Cold-Chain Windows</span>
              <span className="font-mono text-secondary font-bold tabular-nums">
                {config.weights.vipPriorityWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.weights.vipPriorityWeight}
              onChange={(e) => onUpdateWeight('vipPriorityWeight', Number(e.target.value))}
              className="w-full accent-secondary h-1.5 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Collapsible Advanced Parameters */}
        <div className="pt-2 border-t border-outline-variant">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-semibold text-on-surface-variant hover:text-on-surface py-1"
          >
            <span>Advanced Search Parameters</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pt-2">
              {/* Max 2-Opt Iterations */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface font-medium">Max 2-Opt Iterations</span>
                  <span className="font-mono text-secondary font-bold tabular-nums">
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
                  className="w-full accent-secondary h-1.5 bg-surface-container rounded-lg cursor-pointer"
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
                  className="w-full h-8 px-2.5 rounded-lg bg-surface-low border border-outline-variant font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
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
                    className={`py-1.5 px-2 rounded-md font-semibold text-center border transition-all ${
                      config.vehiclePreference === 'EV_PREFERRED'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-low'
                    }`}
                  >
                    ⚡ EV Preferred
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateVehiclePreference('COST_OPTIMAL')}
                    className={`py-1.5 px-2 rounded-md font-semibold text-center border transition-all ${
                      config.vehiclePreference === 'COST_OPTIMAL'
                        ? 'bg-secondary/10 border-secondary text-secondary'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-low'
                    }`}
                  >
                    💰 Cost Optimal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Run Optimization CTA */}
        <div className="pt-2">
          <Button
            variant="secondary"
            className="w-full py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-2"
            onClick={onRunOptimization}
            isLoading={isOptimizing}
            leftIcon={<Sparkles className="w-4 h-4 text-blue-200" />}
          >
            {isOptimizing ? `Optimizing Route (${optimizationProgress}%)` : 'Run 2-Opt Optimization'}
          </Button>

          {isOptimizing && (
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-secondary h-1.5 transition-all duration-200"
                style={{ width: `${optimizationProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Assigned Telemetry & Driver Card */}
      <div className="p-4 bg-surface-lowest rounded-xl border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
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
            className="w-full h-8 px-2.5 rounded-lg bg-surface-low border border-outline-variant font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
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
              <Gauge className="w-3.5 h-3.5 text-secondary" />
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

        {/* Driver Profile Info */}
        <div className="p-2.5 bg-surface-low rounded-lg border border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center uppercase">
              {assignedDriver?.licenseNumber?.slice(0, 2) || 'BD'}
            </div>
            <div>
              <span className="text-xs font-semibold text-on-surface block">
                {assignedDriver?.licenseNumber ? `Driver #${assignedDriver.licenseNumber}` : 'Bikram Das'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {assignedDriver?.phone || '+91 94370 12345'} • ★ {assignedDriver?.rating || 4.9}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
            {assignedDriver?.availability || 'ON_DUTY'}
          </span>
        </div>
      </div>

      {/* 4. Delivery Manifest Sequence Manager */}
      <div className="p-4 bg-surface-lowest rounded-xl border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
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
        </div>

        {/* Start Depot */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-secondary/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-secondary text-white font-mono font-bold text-[10px] flex items-center justify-center">
              D
            </span>
            <div>
              <span className="font-semibold text-on-surface block">Origin: Rasulgarh Depot</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Departure: 08:30 AM</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-secondary font-bold">DEPOT</span>
        </div>

        {/* Stops List with up/down controls */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {stops.map((stop, idx) => (
            <div
              key={stop.deliveryId || idx}
              className="p-2 rounded-lg bg-surface-low border border-outline-variant hover:border-secondary transition-colors flex items-center justify-between text-xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 shrink-0 rounded-full bg-primary text-white font-mono font-bold text-[10px] flex items-center justify-center">
                  {stop.sequenceOrder || idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-on-surface truncate block">
                      {stop.recipientName || stop.orderReference || `Stop #${idx + 1}`}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded shrink-0 ${
                        stop.priority === 'Urgent'
                          ? 'bg-red-100 text-red-800'
                          : stop.priority === 'Cold Chain'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {stop.priority || 'Standard'}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant truncate block font-mono">
                    {stop.streetAddress || stop.zone || 'Bhubaneswar'} • {stop.weightKg} kg
                  </span>
                </div>
              </div>

              {/* Resequence Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveStop(idx, 'up')}
                  className="p-1 rounded hover:bg-surface-lowest disabled:opacity-30 text-on-surface-variant"
                  title="Move Up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === stops.length - 1}
                  onClick={() => moveStop(idx, 'down')}
                  className="p-1 rounded hover:bg-surface-lowest disabled:opacity-30 text-on-surface-variant"
                  title="Move Down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Return Depot */}
        <div className="p-2.5 rounded-lg bg-surface-low border border-secondary/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-secondary text-white font-mono font-bold text-[10px] flex items-center justify-center">
              D
            </span>
            <div>
              <span className="font-semibold text-on-surface block">Return: Rasulgarh Depot</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Estimated: 03:15 PM</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-secondary font-bold">DEPOT</span>
        </div>
      </div>
    </div>
  );
};
