import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import {
  Wrench,
  CheckCircle2,
  RotateCw,
  ShieldAlert,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverVehicleCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultNotice, setResultNotice] = useState<any>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [items, setItems] = useState<Record<string, { status: string; isCritical: boolean }>>({
    brakes: { status: 'PASS', isCritical: true },
    tyres: { status: 'PASS', isCritical: true },
    lights: { status: 'PASS', isCritical: true },
    indicators: { status: 'PASS', isCritical: false },
    mirrors: { status: 'PASS', isCritical: false },
    horn: { status: 'PASS', isCritical: false },
    bodyCondition: { status: 'PASS', isCritical: false },
    documents: { status: 'PASS', isCritical: true },
  });

  const checkTitles: Record<string, string> = {
    brakes: 'Service & Emergency Brakes (Critical)',
    tyres: 'Tyre Pressure & Tread Condition (Critical)',
    lights: 'Headlights & Brake Lights (Critical)',
    indicators: 'Turn Signals & Hazard Flashers',
    mirrors: 'Side Rearview Mirrors Adjustment',
    horn: 'Warning Horn Functionality',
    bodyCondition: 'Cargo Doors & Latching Body Condition',
    documents: 'Commercial RC, Insurance & Pollution (Critical)',
  };

  const isElectric = String(vehicle?.fuelType || '').toUpperCase() === 'ELECTRIC';
  const tankCap = isElectric
    ? 100
    : vehicle?.tankCapacityLitres && vehicle.tankCapacityLitres > 0
      ? vehicle.tankCapacityLitres
      : String(vehicle?.type || '').toUpperCase() === 'TRUCK'
        ? 500
        : 200;
  const lastRecordedOdo: number | null = vehicle?.lastOdometerKm ?? null;
  const lastRecordedFuel: number | null = isElectric
    ? vehicle?.batteryLevelPercent ?? null
    : vehicle?.lastFuelLitres ?? null;

  const fetchStatus = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await DriverHudApi.getDashboard();
      setVehicle(res.data.vehicle || null);
    } catch (err) {
      console.error('Failed to load vehicle inspection:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleItemChange = (key: string, status: string) => {
    setItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], status },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setResultNotice(null);

    const parsedOdo = odometer.trim() === '' ? null : Number(odometer);
    const parsedFuel = fuelLevel.trim() === '' ? null : Number(fuelLevel);

    if (
      parsedOdo === null ||
      Number.isNaN(parsedOdo) ||
      !Number.isFinite(parsedOdo) ||
      parsedOdo < 0
    ) {
      setFormError('Enter a valid non-negative odometer reading in km.');
      return;
    }

    if (lastRecordedOdo !== null && parsedOdo < lastRecordedOdo) {
      setFormError(
        `Odometer reading (${parsedOdo} km) cannot be less than vehicle's last recorded reading (${lastRecordedOdo} km).`
      );
      return;
    }

    if (
      parsedFuel === null ||
      Number.isNaN(parsedFuel) ||
      !Number.isFinite(parsedFuel) ||
      parsedFuel < 0 ||
      parsedFuel > tankCap
    ) {
      setFormError(
        isElectric
          ? 'Enter remaining battery charge between 0% and 100%.'
          : `Enter remaining fuel level between 0 and ${tankCap} L.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await DriverHudApi.submitVehicleCheck({
        vehicleId: vehicle?.id,
        odometerReadingKm: Number(odometer),
        fuelOrBatteryLevelPercent: Number(fuelLevel),
        items,
        overallNotes: notes.trim(),
      });
      setResultNotice(res);
      setOdometer('');
      setFuelLevel('');
      await fetchStatus(true);
    } catch (err: any) {
      const msg =
        err.friendlyMessage || err.response?.data?.error?.message || 'Failed to submit inspection';
      setFormError(msg);
      setToastMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8 bg-surface">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 space-y-4 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/driver')}
          aria-label="Back to Cockpit"
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-primary" /> Cockpit
        </button>
        <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
          {vehicle?.registrationNumber || 'No Vehicle Assigned'}
        </span>
      </div>

      {!vehicle && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No vehicle is currently assigned to your driver profile. Ask Fleet Operations to assign a vehicle before submitting an inspection.
          </span>
        </div>
      )}

      <div>
        <h1 className="text-lg font-black text-on-surface flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-500" />
          Pre-Trip Vehicle Safety Inspection
        </h1>
        <p className="text-[11px] text-on-surface-variant">
          Daily roadworthiness checklist required before operating route dispatches.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {resultNotice && (
        <div
          className={`p-4 rounded-2xl border ${
            resultNotice.data?.checklist?.hasCriticalFailure
              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
          } space-y-1`}
        >
          <div className="flex items-center gap-2 font-bold text-xs">
            {resultNotice.data?.checklist?.hasCriticalFailure ? (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{resultNotice.message}</span>
          </div>
          <p className="text-[11px] text-on-surface">
            Status: {resultNotice.data?.checklist?.status} | Vehicle State: {resultNotice.data?.vehicleStatus}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Readings */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-3">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Odometer & Energy Readings</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="check-odometer-km" className="font-semibold text-on-surface block mb-1">
                Odometer (km)
              </label>
              <input
                id="check-odometer-km"
                type="number"
                step="0.1"
                min={0}
                required
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder={
                  lastRecordedOdo !== null
                    ? `Last recorded: ${lastRecordedOdo} km`
                    : 'e.g. 12450.5'
                }
                className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              {lastRecordedOdo !== null && (
                <p className="text-[11px] text-on-surface-variant mt-1">
                  Last recorded: {lastRecordedOdo} km
                </p>
              )}
            </div>
            <div>
              <label htmlFor="check-fuel-level" className="font-semibold text-on-surface block mb-1">
                {isElectric ? 'Remaining Battery Charge (%)' : 'Fuel Remaining (Litres)'}
              </label>
              <input
                id="check-fuel-level"
                type="number"
                step={isElectric ? '1' : '0.1'}
                min={0}
                max={tankCap}
                required
                value={fuelLevel}
                onChange={(e) => setFuelLevel(e.target.value)}
                placeholder={
                  lastRecordedFuel !== null
                    ? isElectric
                      ? `Last recorded: ${lastRecordedFuel}%`
                      : `Last recorded: ${lastRecordedFuel} L`
                    : isElectric
                      ? 'e.g. 85'
                      : 'e.g. 24.5'
                }
                className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              {lastRecordedFuel !== null && (
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {isElectric
                    ? `Last recorded: ${lastRecordedFuel}%`
                    : `Last recorded: ${lastRecordedFuel} L`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Safety Items List */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-3">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Safety Component Inspection</h2>

          <div className="divide-y divide-outline-variant/60">
            {Object.keys(items).map((key) => {
              const item = items[key];
              const title = checkTitles[key] || key;

              return (
                <div key={key} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-on-surface block">{title}</span>
                    {item.isCritical && (
                      <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full font-mono font-bold">MANDATORY SAFETY</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" role="radiogroup" aria-label={`${title} check verdict`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={item.status === 'PASS'}
                      onClick={() => handleItemChange(key, 'PASS')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all active:scale-95 ${
                        item.status === 'PASS'
                          ? 'bg-primary text-white shadow-emerald'
                          : 'bg-surface border border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      PASS
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={item.status === 'NEEDS_ATTENTION'}
                      onClick={() => handleItemChange(key, 'NEEDS_ATTENTION')}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all active:scale-95 ${
                        item.status === 'NEEDS_ATTENTION'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-surface border border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      ATTENTION
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overall Notes */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-2 text-xs">
          <label htmlFor="inspection-notes" className="font-semibold text-on-surface block">Inspection Observations / Notes</label>
          <textarea
            id="inspection-notes"
            rows={2}
            placeholder="e.g. Tyres inflated to 36 PSI, windshield washed, slight scratch on passenger mirror."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={!vehicle}
          className="w-full h-12 font-bold text-sm shadow-emerald rounded-2xl"
        >
          <Save className="w-4 h-4 mr-1.5" />
          Submit Pre-Trip Safety Sign-off
        </Button>
      </form>
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
