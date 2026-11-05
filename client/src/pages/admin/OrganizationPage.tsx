import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  Building,
  MapPin,
  Clock,
  Globe,
  Plus,
  Save,
  Check,
  RotateCw,
  Phone,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const OrganizationPage: React.FC = () => {
  const [org, setOrg] = useState<any>(null);
  const [depots, setDepots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // New Depot Modal
  const [isAddDepotOpen, setIsAddDepotOpen] = useState(false);
  const [newDepot, setNewDepot] = useState({
    name: '',
    address: '',
    lat: '20.2961',
    lng: '85.8645',
    serviceRegion: 'Bhubaneswar Central',
    startTime: '06:00',
    endTime: '22:00',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getOrganization();
      const orgData = res.data.organization || {};
      setOrg(orgData);
      setDepots(orgData.depots || []);
    } catch (err) {
      console.error('Failed to load organization settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveNotice(null);
    try {
      await AdminApi.updateOrganization({
        organizationName: org.organizationName,
        businessAddress: org.businessAddress,
        contactDetails: org.contactDetails,
        operatingRegions: org.operatingRegions,
        timezone: org.timezone,
        currency: org.currency,
        businessHours: org.businessHours,
      });
      setSaveNotice('Organization settings saved successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDepot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await AdminApi.addDepot({
        name: newDepot.name,
        address: newDepot.address,
        location: { lat: Number(newDepot.lat), lng: Number(newDepot.lng) },
        serviceRegion: newDepot.serviceRegion,
        operatingHours: { start: newDepot.startTime, end: newDepot.endTime },
      });
      setDepots(res.data.depots || []);
      setIsAddDepotOpen(false);
      setNewDepot({
        name: '',
        address: '',
        lat: '20.2961',
        lng: '85.8645',
        serviceRegion: 'Bhubaneswar Central',
        startTime: '06:00',
        endTime: '22:00',
      });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add depot');
    }
  };

  const handleToggleDepot = async (depot: any) => {
    try {
      const res = await AdminApi.updateDepot(depot.depotId, { active: !depot.active });
      setDepots(res.data.depots || []);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle depot status');
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
            <Building className="w-6 h-6 text-amber-500" />
            Organization & Multi-Depot Infrastructure
          </h1>
          <p className="text-xs text-on-surface-variant">
            Company credentials, operating territories, and multi-depot staging nodes for route optimization.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsAddDepotOpen(true)} className="bg-amber-600 hover:bg-amber-500">
          <Plus className="w-4 h-4 mr-1.5" />
          Register Operational Depot
        </Button>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Organization Business Details Form */}
      <form onSubmit={handleSaveOrg} className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            Legal Entity & Corporate Parameters
          </h2>
          <Button type="submit" size="sm" variant="primary" isLoading={isSaving} className="bg-amber-600 hover:bg-amber-500">
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Corporate Settings
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold text-on-surface block mb-1">Organization Legal Name</label>
            <input
              type="text"
              value={org?.organizationName || ''}
              onChange={(e) => setOrg({ ...org, organizationName: e.target.value })}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">HQ Street Address</label>
            <input
              type="text"
              value={org?.businessAddress?.street || ''}
              onChange={(e) =>
                setOrg({ ...org, businessAddress: { ...org.businessAddress, street: e.target.value } })
              }
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Operations Contact Email</label>
            <input
              type="email"
              value={org?.contactDetails?.email || ''}
              onChange={(e) =>
                setOrg({ ...org, contactDetails: { ...org.contactDetails, email: e.target.value } })
              }
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Emergency Dispatch Hotline</label>
            <input
              type="text"
              value={org?.contactDetails?.supportEmergencyPhone || ''}
              onChange={(e) =>
                setOrg({
                  ...org,
                  contactDetails: { ...org.contactDetails, supportEmergencyPhone: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Timezone & Operating Currency</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={org?.timezone || 'Asia/Kolkata'}
                onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
              />
              <input
                type="text"
                value={org?.currency || 'INR (₹)'}
                onChange={(e) => setOrg({ ...org, currency: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-on-surface block mb-1">Daily Dispatch Hours (Start - End)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={org?.businessHours?.start || '07:00'}
                onChange={(e) =>
                  setOrg({ ...org, businessHours: { ...org.businessHours, start: e.target.value } })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
              />
              <input
                type="time"
                value={org?.businessHours?.end || '21:00'}
                onChange={(e) =>
                  setOrg({ ...org, businessHours: { ...org.businessHours, end: e.target.value } })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Multi-Depot Staging Hubs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <MapPin className="w-4 h-4 text-secondary" />
            Operational Logistics Depots ({depots.length})
          </h2>
          <span className="text-xs text-on-surface-variant font-mono">
            Optimizers dynamically route to active depots
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {depots.map((d) => (
            <div
              key={d.depotId || d._id}
              className={`p-4 rounded-xl bg-surface-lowest border transition-all ${
                d.active ? 'border-outline-variant shadow-sm' : 'border-red-500/30 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-on-surface">{d.name}</h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-outline-variant text-on-surface-variant">
                      {d.depotId}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                    {d.address}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleDepot(d)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    d.active
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}
                >
                  {d.active ? 'Active' : 'Offline'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-outline-variant grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                <div>
                  <span className="block text-[10px] text-slate-400">Geo Coordinates</span>
                  <span className="font-mono text-on-surface font-medium">
                    {d.location?.lat?.toFixed(4)}, {d.location?.lng?.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">Service Territory</span>
                  <span className="text-on-surface font-medium truncate block">{d.serviceRegion}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Depot */}
      {isAddDepotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                Register Operational Logistics Hub
              </h2>
              <button onClick={() => setIsAddDepotOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDepot} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Depot Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Khandagiri South Cross-Dock"
                  value={newDepot.name}
                  onChange={(e) => setNewDepot({ ...newDepot, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Physical Street Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Plot 88, NH-16, Khandagiri"
                  value={newDepot.address}
                  onChange={(e) => setNewDepot({ ...newDepot, address: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepot.lat}
                    onChange={(e) => setNewDepot({ ...newDepot, lat: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepot.lng}
                    onChange={(e) => setNewDepot({ ...newDepot, lng: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Service Region / Territory</label>
                <input
                  type="text"
                  placeholder="e.g. Khandagiri, Jaydev Vihar & West BBSR"
                  value={newDepot.serviceRegion}
                  onChange={(e) => setNewDepot({ ...newDepot, serviceRegion: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDepotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-amber-600 hover:bg-amber-500">
                  Register Depot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
