import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  Sliders,
  Save,
  RotateCw,
  Check,
  Scale,
  Compass,
  Clock,
  Fuel,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const OptimizationSettingsPage: React.FC = () => {
  const [opt, setOpt] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getOptimizationSettings();
      setOpt(res.data.optimizationSettings || {});
    } catch (err) {
      console.error('Failed to load optimization settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProfileSelect = (profile: string) => {
    if (profile === 'Distance Optimized') {
      setOpt({ ...opt, defaultProfile: profile, distanceWeight: 0.60, timeWeight: 0.20, fuelCostWeight: 0.20 });
    } else if (profile === 'Time Optimized') {
      setOpt({ ...opt, defaultProfile: profile, distanceWeight: 0.20, timeWeight: 0.60, fuelCostWeight: 0.20 });
    } else if (profile === 'Fuel Optimized') {
      setOpt({ ...opt, defaultProfile: profile, distanceWeight: 0.25, timeWeight: 0.25, fuelCostWeight: 0.50 });
    } else {
      setOpt({ ...opt, defaultProfile: 'Balanced', distanceWeight: 0.35, timeWeight: 0.30, fuelCostWeight: 0.20 });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = window.prompt('Provide administrative reason for updating optimization weights:', 'Quarterly algorithm tuning for delivery density');
    if (!reason) return;

    setIsSaving(true);
    setSaveNotice(null);
    try {
      await AdminApi.updateOptimizationSettings({ ...opt, reason });
      setSaveNotice('Route optimization parameters updated and logged in audit log.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update optimization settings');
    } finally {
      setIsSaving(false);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-500" />
            Route Optimization Engine Configuration
          </h1>
          <p className="text-xs text-on-surface-variant">
            Multi-objective algorithm weighting, delivery service durations, and fleet optimization profiles.
          </p>
        </div>

        <Button variant="primary" onClick={handleSave} isLoading={isSaving} className="bg-amber-600 hover:bg-amber-500">
          <Save className="w-4 h-4 mr-1.5" />
          Save Algorithm Defaults
        </Button>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Preset Profiles */}
      <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <Scale className="w-4 h-4 text-secondary" />
          Select Optimization Preset Profile
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Distance Optimized', 'Time Optimized', 'Fuel Optimized', 'Balanced'].map((p) => {
            const isSelected = opt?.defaultProfile === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleProfileSelect(p)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 text-on-surface'
                    : 'border-outline-variant bg-surface hover:bg-surface-lowest text-on-surface-variant'
                }`}
              >
                <div className="text-xs font-bold text-on-surface">{p}</div>
                <div className="text-[10px] text-on-surface-variant mt-1">
                  {p === 'Distance Optimized'
                    ? 'Minimizes total mileage'
                    : p === 'Time Optimized'
                    ? 'Prioritizes rapid dropoffs'
                    : p === 'Fuel Optimized'
                    ? 'Limits carbon and fuel expense'
                    : 'Balanced multi-criteria'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form: Granular Algorithm Weights */}
      <form onSubmit={handleSave} className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-on-surface border-b border-outline-variant pb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-secondary" />
          Objective Weights (Sum Normalized to 1.0)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-on-surface block mb-1">Distance Weight ({opt?.distanceWeight})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opt?.distanceWeight || 0.35}
              onChange={(e) => setOpt({ ...opt, distanceWeight: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Travel Time Weight ({opt?.timeWeight})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opt?.timeWeight || 0.30}
              onChange={(e) => setOpt({ ...opt, timeWeight: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Fuel / Energy Cost Weight ({opt?.fuelCostWeight})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opt?.fuelCostWeight || 0.20}
              onChange={(e) => setOpt({ ...opt, fuelCostWeight: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Delivery Priority Weight ({opt?.deliveryPriorityWeight})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opt?.deliveryPriorityWeight || 0.15}
              onChange={(e) => setOpt({ ...opt, deliveryPriorityWeight: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Workload Balancing Weight ({opt?.workloadBalancingWeight})</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opt?.workloadBalancingWeight || 0.10}
              onChange={(e) => setOpt({ ...opt, workloadBalancingWeight: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Max Route Duration (Minutes)</label>
            <input
              type="number"
              min="60"
              max="720"
              value={opt?.maxRouteDurationMinutes || 480}
              onChange={(e) => setOpt({ ...opt, maxRouteDurationMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Default Stop Service Duration (Minutes)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={opt?.defaultServiceDurationMinutes || 10}
              onChange={(e) => setOpt({ ...opt, defaultServiceDurationMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="returnToDepot"
              checked={Boolean(opt?.defaultReturnToDepot)}
              onChange={(e) => setOpt({ ...opt, defaultReturnToDepot: e.target.checked })}
              className="rounded border-outline-variant text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="returnToDepot" className="font-semibold text-on-surface cursor-pointer">
              Enforce Closed-Loop Return to Depot
            </label>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-on-surface-variant font-mono">
          Last modified by: <strong>{opt?.lastModifiedBy || 'System Admin'}</strong> on{' '}
          {opt?.lastModifiedAt ? new Date(opt.lastModifiedAt).toLocaleDateString() : 'Initial deployment'}
        </div>
      </form>
    </div>
  );
};
