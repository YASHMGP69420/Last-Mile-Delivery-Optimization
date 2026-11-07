import React from 'react';
import {
  Truck,
  BatteryCharging,
  Fuel,
  Clock,
  CheckCircle2,
  Package,
  Pause,
  Play,
  StopCircle,
} from 'lucide-react';

export interface DriverVehicleStatusProps {
  vehicle?: {
    registrationNumber?: string;
    model?: string;
    type?: string;
    fuelType?: 'ELECTRIC' | 'DIESEL' | 'PETROL' | string;
    capacityKg?: number;
    currentPayloadKg?: number;
    batteryLevelPercent?: number;
    fuelLevelPercent?: number;
  };
  shift?: {
    status?: 'SCHEDULED' | 'IN_PROGRESS' | 'ON_BREAK' | 'COMPLETED' | string;
    startTime?: string;
    elapsedMinutes?: number;
  };
  metrics?: {
    totalStops?: number;
    completedStops?: number;
    remainingStops?: number;
    distanceDrivenKm?: number;
  };
  onToggleBreak?: () => void;
  onEndShift?: () => void;
  isShiftActionLoading?: boolean;
}

export const DriverVehicleStatusCard: React.FC<DriverVehicleStatusProps> = ({
  vehicle,
  shift,
  metrics,
  onToggleBreak,
  onEndShift,
  isShiftActionLoading = false,
}) => {
  const isEV = vehicle?.fuelType === 'ELECTRIC';
  const energyLevel = isEV
    ? vehicle?.batteryLevelPercent ?? 82
    : vehicle?.fuelLevelPercent ?? 68;

  const totalStops = metrics?.totalStops ?? 0;
  const completedStops = metrics?.completedStops ?? 0;
  const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const isOnBreak = shift?.status === 'ON_BREAK';

  return (
    <div className="bg-surface-lowest rounded-3xl p-5 shadow-soft border border-outline-variant/60 space-y-4 transition-all">
      {/* 1. Header Row: Vehicle Registration & Shift Status */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-outline-variant/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">
                {vehicle?.registrationNumber || 'OD-02-AX-4821'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-low border border-outline-variant/60 text-on-surface-variant font-mono">
                {vehicle?.type || (isEV ? 'Electric Van' : 'Diesel Van')}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant">
              {vehicle?.model || 'SmartRoute Fleet Unit'}
            </span>
          </div>
        </div>

        {/* Shift Controls: Break & Handover */}
        <div className="flex items-center gap-1.5">
          {onToggleBreak && (
            <button
              onClick={onToggleBreak}
              disabled={isShiftActionLoading}
              title={isOnBreak ? 'Resume Shift' : 'Take a Break'}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-low hover:bg-surface-container border border-outline-variant/60 text-on-surface flex items-center gap-1 transition-colors"
            >
              {isOnBreak ? (
                <>
                  <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span>Break</span>
                </>
              )}
            </button>
          )}

          {onEndShift && (
            <button
              onClick={onEndShift}
              disabled={isShiftActionLoading}
              title="End Shift & Vehicle Handover"
              className="p-2 rounded-full text-xs font-semibold bg-surface-low hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Fleet Metrics: Energy Gauge & Payload Capacity */}
      <div className="grid grid-cols-2 gap-3">
        {/* Fuel / Battery Gauge */}
        <div className="p-3 rounded-2xl bg-surface-low border border-outline-variant/40 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface-variant flex items-center gap-1">
              {isEV ? (
                <BatteryCharging className="w-3.5 h-3.5 text-emerald" />
              ) : (
                <Fuel className="w-3.5 h-3.5 text-amber-500" />
              )}
              {isEV ? 'Battery State' : 'Fuel Level'}
            </span>
            <span className="font-mono font-bold text-on-surface">{energyLevel}%</span>
          </div>
          <div className="w-full bg-surface-lowest rounded-full h-2 overflow-hidden border border-outline-variant/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isEV ? 'bg-emerald' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, energyLevel))}%` }}
            />
          </div>
        </div>

        {/* Cargo Capacity Utilization */}
        <div className="p-3 rounded-2xl bg-surface-low border border-outline-variant/40 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface-variant flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-primary" />
              Payload
            </span>
            <span className="font-mono font-bold text-on-surface">
              {vehicle?.currentPayloadKg ?? 320} / {vehicle?.capacityKg ?? 750} kg
            </span>
          </div>
          <div className="w-full bg-surface-lowest rounded-full h-2 overflow-hidden border border-outline-variant/40">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((vehicle?.currentPayloadKg ?? 320) / (vehicle?.capacityKg ?? 750)) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Shift Progress Strip */}
      <div className="pt-1 flex items-center justify-between text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>Shift Progress:</span>
          <span className="font-mono font-bold text-on-surface">{progressPercent}%</span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-emerald font-semibold">{completedStops} done</span>
          <span>•</span>
          <span className="text-on-surface font-semibold">
            {metrics?.remainingStops ?? totalStops - completedStops} left
          </span>
        </div>
      </div>
    </div>
  );
};
