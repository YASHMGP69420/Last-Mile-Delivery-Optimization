import React from 'react';
import {
  Truck,
  BatteryCharging,
  Fuel,
  Clock,
  CheckCircle2,
  Package,
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
    status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | string;
    startTime?: string;
    elapsedMinutes?: number;
  };
  metrics?: {
    totalStops?: number;
    completedStops?: number;
    remainingStops?: number;
    distanceDrivenKm?: number;
  };
  onEndShift?: () => void;
  isShiftActionLoading?: boolean;
}

export const DriverVehicleStatusCard: React.FC<DriverVehicleStatusProps> = ({
  vehicle,
  shift,
  metrics,
  onEndShift,
  isShiftActionLoading = false,
}) => {
  const hasVehicle = Boolean(vehicle && (vehicle.registrationNumber || vehicle.model));
  const isEV = vehicle?.fuelType === 'ELECTRIC';
  const energyLevel = isEV ? vehicle?.batteryLevelPercent : vehicle?.fuelLevelPercent;
  const currentPayload = vehicle?.currentPayloadKg ?? 0;
  const maxCapacity = vehicle?.capacityKg ?? 0;

  const totalStops = metrics?.totalStops ?? 0;
  const completedStops = metrics?.completedStops ?? 0;
  const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="bg-surface-lowest rounded-xl p-5 shadow-sm border border-outline-variant/60 space-y-4 transition-all">
      {/* 1. Header Row: Vehicle Registration & Shift Status */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-outline-variant/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Truck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-on-surface">
                {vehicle?.registrationNumber || (hasVehicle ? 'Assigned Vehicle' : 'No Vehicle Assigned')}
              </span>
              {vehicle?.type && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-low border border-outline-variant/60 text-on-surface-variant font-mono">
                  {vehicle.type}
                </span>
              )}
            </div>
            <span className="text-xs text-on-surface-variant">
              {vehicle?.model || (hasVehicle ? 'Fleet Unit' : 'Contact dispatch for vehicle assignment')}
            </span>
          </div>
        </div>

        {/* Shift Controls: Handover / Clock Out */}
        <div className="flex items-center gap-1.5">
          {onEndShift && (
            <button
              onClick={onEndShift}
              disabled={isShiftActionLoading}
              title="End Shift & Vehicle Handover"
              aria-label="End Shift and Vehicle Handover"
              className="p-2 rounded-lg text-xs font-semibold bg-surface-low hover:bg-red-50 text-on-surface-variant hover:text-red-600 transition-colors"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Fleet Metrics: Energy Gauge & Payload Capacity (only when vehicle is assigned) */}
      {hasVehicle && (
        <div className="grid grid-cols-2 gap-3">
          {/* Fuel / Battery Gauge */}
          <div className="p-3 rounded-lg bg-surface-low border border-outline-variant/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface-variant flex items-center gap-1">
                {isEV ? (
                  <BatteryCharging className="w-3.5 h-3.5 text-emerald" />
                ) : (
                  <Fuel className="w-3.5 h-3.5 text-amber-500" />
                )}
                {isEV ? 'Battery' : 'Fuel'}
              </span>
              <span className="font-mono font-bold text-on-surface">
                {energyLevel != null ? `${energyLevel}%` : '—'}
              </span>
            </div>
            {energyLevel != null && (
              <div className="w-full bg-surface-lowest rounded-full h-2 overflow-hidden border border-outline-variant/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isEV ? 'bg-emerald' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, energyLevel))}%` }}
                />
              </div>
            )}
          </div>

          {/* Cargo Capacity Utilization */}
          <div className="p-3 rounded-lg bg-surface-low border border-outline-variant/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface-variant flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-primary" />
                Payload
              </span>
              <span className="font-mono font-bold text-on-surface">
                {maxCapacity > 0 ? `${currentPayload} / ${maxCapacity} kg` : '—'}
              </span>
            </div>
            {maxCapacity > 0 && (
              <div className="w-full bg-surface-lowest rounded-full h-2 overflow-hidden border border-outline-variant/40">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((currentPayload / maxCapacity) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
