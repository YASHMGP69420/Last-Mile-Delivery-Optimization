import React, { useEffect, useState } from 'react';
import { Gauge, Fuel, BatteryCharging, AlertTriangle, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface ShiftTelemetryModalProps {
  isOpen: boolean;
  mode: 'START' | 'END';
  vehicle?: {
    vehicleId?: string;
    makeModel?: string;
    fuelType?: string;
  } | null;
  startOdometerKm?: number | null;
  startFuelOrCharge?: number | null;
  requiresHandoverNotes?: boolean;
  promptHint?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    odometerKm?: number;
    remainingFuelOrCharge?: number;
    handoverNotes?: string;
    requireTelemetry: boolean;
  }) => void | Promise<void>;
}

export const ShiftTelemetryModal: React.FC<ShiftTelemetryModalProps> = ({
  isOpen,
  mode,
  vehicle,
  startOdometerKm = null,
  startFuelOrCharge = null,
  requiresHandoverNotes = false,
  promptHint = null,
  isSubmitting = false,
  onClose,
  onSubmit,
}) => {
  const hasVehicle = Boolean(vehicle && (vehicle.vehicleId || vehicle.fuelType));
  const isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';
  const unitLabel = isElectric ? '%' : 'L';

  const [odometerInput, setOdometerInput] = useState('');
  const [fuelInput, setFuelInput] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setOdometerInput('');
    setFuelInput('');
    setHandoverNotes('');
    setError(null);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const parsedOdo = odometerInput.trim() === '' ? null : Number(odometerInput);
  const parsedFuel = fuelInput.trim() === '' ? null : Number(fuelInput);

  const previewDrivenKm =
    mode === 'END' &&
    startOdometerKm !== null &&
    parsedOdo !== null &&
    Number.isFinite(parsedOdo) &&
    parsedOdo >= startOdometerKm
      ? Number((parsedOdo - startOdometerKm).toFixed(1))
      : null;

  const previewUsedFuel =
    mode === 'END' &&
    startFuelOrCharge !== null &&
    parsedFuel !== null &&
    Number.isFinite(parsedFuel)
      ? Number(Math.max(0, startFuelOrCharge - parsedFuel).toFixed(2))
      : null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasVehicle) {
      if (parsedOdo === null || Number.isNaN(parsedOdo) || parsedOdo < 0) {
        setError('Enter a valid non-negative odometer reading in km.');
        return;
      }
      if (
        mode === 'END' &&
        startOdometerKm !== null &&
        parsedOdo < startOdometerKm
      ) {
        setError(`Closing odometer cannot be less than starting reading (${startOdometerKm} km).`);
        return;
      }
      if (
        parsedFuel === null ||
        Number.isNaN(parsedFuel) ||
        parsedFuel < 0 ||
        (isElectric && parsedFuel > 100)
      ) {
        setError(
          isElectric
            ? 'Enter remaining battery charge between 0% and 100%.'
            : 'Enter remaining fuel level in Litres (0 or greater).'
        );
        return;
      }
    }

    if (mode === 'END' && requiresHandoverNotes && handoverNotes.trim().length < 5) {
      setError('Pending stops remain on this route. Enter at least 5 characters of handover notes.');
      return;
    }

    await onSubmit({
      odometerKm: parsedOdo !== null && Number.isFinite(parsedOdo) ? parsedOdo : undefined,
      remainingFuelOrCharge:
        parsedFuel !== null && Number.isFinite(parsedFuel) ? parsedFuel : undefined,
      handoverNotes: mode === 'END' ? handoverNotes.trim() : undefined,
      requireTelemetry: hasVehicle,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-telemetry-title"
    >
      <div className="w-full max-w-md bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-outline-variant/40 dark:border-obsidian-750">
          <div>
            <h3 id="shift-telemetry-title" className="text-sm font-bold text-on-surface dark:text-white">
              {mode === 'START'
                ? 'Start Shift — Odometer & Fuel/Charge Log'
                : 'End Shift — Closing Odometer & Fuel/Charge'}
            </h3>
            <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">
              {vehicle?.vehicleId
                ? `${vehicle.vehicleId} • ${vehicle.makeModel || ''} (${vehicle.fuelType || 'Vehicle'})`
                : 'Log vehicle telemetry to track usage and route savings.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-low dark:hover:bg-obsidian-800"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {promptHint && (
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/25 text-xs text-primary dark:text-emerald-300 font-medium">
            {promptHint}
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'END' && (startOdometerKm !== null || startFuelOrCharge !== null) && (
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 text-xs">
            <div>
              <span className="text-[10px] uppercase text-on-surface-variant block">Start Odometer</span>
              <span className="font-mono font-bold text-on-surface dark:text-white">
                {startOdometerKm !== null ? `${startOdometerKm} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-on-surface-variant block">
                Start {isElectric ? 'Charge' : 'Fuel'}
              </span>
              <span className="font-mono font-bold text-on-surface dark:text-white">
                {startFuelOrCharge !== null ? `${startFuelOrCharge} ${unitLabel}` : '—'}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          {hasVehicle ? (
            <>
              <Input
                id="shift-odometer-km"
                label={mode === 'START' ? 'Current Odometer Reading (km)' : 'Closing Odometer Reading (km)'}
                type="number"
                step="0.1"
                min="0"
                required
                value={odometerInput}
                onChange={(e) => setOdometerInput(e.target.value)}
                placeholder={startOdometerKm !== null ? String(startOdometerKm + 25) : 'e.g. 12450.5'}
                leftIcon={<Gauge className="w-4 h-4" />}
              />

              <Input
                id="shift-fuel-charge"
                label={
                  isElectric
                    ? mode === 'START'
                      ? 'Remaining Battery Charge (%)'
                      : 'Closing Battery Charge (%)'
                    : mode === 'START'
                      ? 'Fuel Remaining (Litres)'
                      : 'Closing Fuel Remaining (Litres)'
                }
                type="number"
                step={isElectric ? '1' : '0.1'}
                min="0"
                max={isElectric ? '100' : undefined}
                required
                value={fuelInput}
                onChange={(e) => setFuelInput(e.target.value)}
                placeholder={isElectric ? 'e.g. 85' : 'e.g. 24.5'}
                leftIcon={
                  isElectric ? <BatteryCharging className="w-4 h-4" /> : <Fuel className="w-4 h-4" />
                }
              />
            </>
          ) : (
            <p className="text-xs text-on-surface-variant">
              No vehicle is currently bound to your profile. You may proceed to{' '}
              {mode === 'START' ? 'start' : 'end'} your shift directly.
            </p>
          )}

          {mode === 'END' && (previewDrivenKm !== null || previewUsedFuel !== null) && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs flex items-center justify-between font-mono text-emerald-700 dark:text-emerald-300">
              <span>Distance: {previewDrivenKm ?? 0} km</span>
              <span>
                Used: {previewUsedFuel ?? 0} {unitLabel}
              </span>
            </div>
          )}

          {mode === 'END' && requiresHandoverNotes && (
            <div className="space-y-1">
              <label
                htmlFor="handover-notes-input"
                className="block text-xs font-semibold text-amber-600 dark:text-amber-400"
              >
                Handover Notes Required (Incomplete Stops Remain)
              </label>
              <textarea
                id="handover-notes-input"
                rows={3}
                required
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="e.g. Staged remaining packages at Rasulgarh Hub Bay 2."
                className="w-full p-3 rounded-xl bg-surface-low dark:bg-obsidian-950 border border-outline-variant/60 dark:border-obsidian-700 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={mode === 'START' ? 'primary' : 'danger'}
              isLoading={isSubmitting}
            >
              {mode === 'START' ? 'Save & Clock In' : 'Save Usage & Clock Out'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
