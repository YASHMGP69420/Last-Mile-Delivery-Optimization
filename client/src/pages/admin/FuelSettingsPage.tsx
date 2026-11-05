import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  DollarSign,
  Fuel,
  Battery,
  Save,
  RotateCw,
  Check,
  Leaf,
  Calendar,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const FuelSettingsPage: React.FC = () => {
  const [fuel, setFuel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getFuelSettings();
      setFuel(res.data.fuelSettings || {});
    } catch (err) {
      console.error('Failed to load fuel settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = window.prompt('Provide administrative reason for updating fuel tariffs / emission factors:', 'State tariff revision');
    if (!reason) return;

    setIsSaving(true);
    setSaveNotice(null);
    try {
      await AdminApi.updateFuelSettings({ ...fuel, reason });
      setSaveNotice('Fuel tariffs and emission coefficients updated successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update fuel settings');
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
            <DollarSign className="w-6 h-6 text-amber-500" />
            Fuel & Operational Policy Tariffs
          </h1>
          <p className="text-xs text-on-surface-variant">
            Propulsion expense tariffs, EV commercial kWh rates, and GHG emission factors for carbon auditing.
          </p>
        </div>

        <Button variant="primary" onClick={handleSave} isLoading={isSaving} className="bg-amber-600 hover:bg-amber-500">
          <Save className="w-4 h-4 mr-1.5" />
          Update Energy Tariffs
        </Button>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commercial Fuel & Power Tariffs */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant pb-3">
            <Fuel className="w-4 h-4 text-amber-500" />
            Commercial Fuel & Grid Energy Prices ({fuel?.currencySymbol || '₹'})
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-on-surface block mb-1">Petrol Price (per Liter)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-on-surface-variant font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={fuel?.petrolPricePerLiter || 103.2}
                  onChange={(e) => setFuel({ ...fuel, petrolPricePerLiter: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-on-surface block mb-1">Diesel Price (per Liter)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-on-surface-variant font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={fuel?.dieselPricePerLiter || 94.8}
                  onChange={(e) => setFuel({ ...fuel, dieselPricePerLiter: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-on-surface block mb-1">CNG Price (per kg)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-on-surface-variant font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={fuel?.cngPricePerKg || 85.5}
                  onChange={(e) => setFuel({ ...fuel, cngPricePerKg: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-on-surface block mb-1">Commercial EV Charging Tariff (per kWh)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-emerald-500 font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={fuel?.electricityTariffPerKwh || 7.2}
                  onChange={(e) => setFuel({ ...fuel, electricityTariffPerKwh: Number(e.target.value) })}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono font-bold text-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Carbon Emission Factors */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant pb-3">
            <Leaf className="w-4 h-4 text-emerald-500" />
            Greenhouse Gas (GHG) Emission Factors (g CO2/km)
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-on-surface block mb-1">Diesel Van Fleet (g CO2/km)</label>
              <input
                type="number"
                value={fuel?.carbonEmissionFactors?.dieselGramsPerKm || 210}
                onChange={(e) =>
                  setFuel({
                    ...fuel,
                    carbonEmissionFactors: { ...fuel.carbonEmissionFactors, dieselGramsPerKm: Number(e.target.value) },
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-on-surface block mb-1">Petrol Bike Fleet (g CO2/km)</label>
              <input
                type="number"
                value={fuel?.carbonEmissionFactors?.petrolGramsPerKm || 230}
                onChange={(e) =>
                  setFuel({
                    ...fuel,
                    carbonEmissionFactors: { ...fuel.carbonEmissionFactors, petrolGramsPerKm: Number(e.target.value) },
                  })
                }
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-on-surface block mb-1">Electric Vehicle Tailpipe (g CO2/km)</label>
              <input
                type="number"
                disabled
                value={fuel?.carbonEmissionFactors?.electricGramsPerKm || 0}
                className="w-full px-3 py-1.5 rounded-lg bg-surface/50 border border-outline-variant text-emerald-500 font-mono font-bold cursor-not-allowed"
              />
              <span className="text-[10px] text-emerald-500 mt-1 block">Zero tailpipe emissions guaranteed</span>
            </div>

            <div className="pt-2 text-[11px] text-on-surface-variant font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-secondary" />
              Effective as of: {fuel?.effectiveDate ? new Date(fuel.effectiveDate).toLocaleDateString() : 'Current Date'}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
