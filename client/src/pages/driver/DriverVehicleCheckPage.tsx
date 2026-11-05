import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Truck,
  ShieldAlert,
  Save,
  Fuel,
  Battery,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverVehicleCheckPage: React.FC = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<any>(null);
  const [odometer, setOdometer] = useState('14250');
  const [fuelLevel, setFuelLevel] = useState(90);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultNotice, setResultNotice] = useState<any>(null);

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

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getDashboard();
      setVehicle(res.data.vehicle);
    } catch (err) {
      console.error('Failed to load vehicle inspection:', err);
    } finally {
      setIsLoading(false);
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
    setIsSubmitting(true);
    setResultNotice(null);
    try {
      const res = await DriverHudApi.submitVehicleCheck({
        vehicleId: vehicle?.id,
        odometerReadingKm: Number(odometer),
        fuelOrBatteryLevelPercent: Number(fuelLevel),
        items,
        overallNotes: notes,
      });
      setResultNotice(res);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to submit inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/driver')}
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Cockpit
        </button>
        <span className="font-mono text-xs font-bold text-secondary">
          {vehicle?.registrationNumber || 'Assigned Van'}
        </span>
      </div>

      <div>
        <h1 className="text-lg font-black text-on-surface flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-500" />
          Pre-Trip Vehicle Safety Inspection
        </h1>
        <p className="text-[11px] text-on-surface-variant">
          Daily roadworthiness checklist required before operating route dispatches.
        </p>
      </div>

      {resultNotice && (
        <div
          className={`p-4 rounded-2xl border ${
            resultNotice.data?.checklist?.hasCriticalFailure
              ? 'bg-red-500/10 border-red-500/40 text-red-500'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
          } space-y-1`}
        >
          <div className="flex items-center gap-2 font-bold text-xs">
            {resultNotice.data?.checklist?.hasCriticalFailure ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
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
        <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Odometer & Energy Readings</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold text-on-surface block mb-1">Odometer (km)</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-on-surface block mb-1">Battery / Fuel Level (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={fuelLevel}
                onChange={(e) => setFuelLevel(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono"
              />
            </div>
          </div>
        </div>

        {/* Safety Items List */}
        <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Safety Component Inspection</h2>

          <div className="divide-y divide-outline-variant">
            {Object.keys(items).map((key) => {
              const item = items[key];
              const title = checkTitles[key] || key;

              return (
                <div key={key} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-on-surface block">{title}</span>
                    {item.isCritical && (
                      <span className="text-[9px] text-amber-500 font-mono font-bold">MANDATORY SAFETY</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleItemChange(key, 'PASS')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                        item.status === 'PASS'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-surface border border-outline-variant text-on-surface-variant'
                      }`}
                    >
                      PASS
                    </button>
                    <button
                      type="button"
                      onClick={() => handleItemChange(key, 'NEEDS_ATTENTION')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                        item.status === 'NEEDS_ATTENTION'
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-surface border border-outline-variant text-on-surface-variant'
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
        <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-2 text-xs">
          <label className="font-semibold text-on-surface block">Inspection Observations / Notes</label>
          <textarea
            rows={2}
            placeholder="e.g. Tyres inflated to 36 PSI, windshield washed, slight scratch on passenger mirror."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold py-2.5"
        >
          <Save className="w-4 h-4 mr-1.5" />
          Submit Pre-Trip Safety Sign-off
        </Button>
      </form>
    </div>
  );
};
