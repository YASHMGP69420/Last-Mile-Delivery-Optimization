import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
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
import { Modal } from '../../components/common/Modal';

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
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Organization & Multi-Depot Infrastructure"
        subtitle="Operating territories, corporate entities, and central depot staging hubs"
        actions={
          <Button variant="primary" size="sm" onClick={() => setIsAddDepotOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Register Depot
          </Button>
        }
      />

      {saveNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Organization Business Details Form */}
      <form onSubmit={handleSaveOrg} className="p-6 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Legal Entity & Corporate Parameters
          </h2>
          <Button type="submit" size="sm" variant="primary" isLoading={isSaving}>
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
            <MapPin className="w-4 h-4 text-primary" />
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
              className={`p-5 rounded-[20px] bg-surface-lowest border transition-all ${
                d.active ? 'border-outline-variant/60 shadow-soft' : 'border-red-500/30 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-on-surface">{d.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-outline-variant/60 text-on-surface-variant">
                      {d.depotId}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    {d.address}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleDepot(d)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                    d.active
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {d.active ? 'Active' : 'Offline'}
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-outline-variant/60 grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                <div>
                  <span className="block text-[10px] text-on-surface-variant">Geo Coordinates</span>
                  <span className="font-mono text-on-surface font-medium">
                    {d.location?.lat?.toFixed(4)}, {d.location?.lng?.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-on-surface-variant">Service Territory</span>
                  <span className="text-on-surface font-medium truncate block">{d.serviceRegion}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Depot */}
      <Modal
        isOpen={isAddDepotOpen}
        onClose={() => setIsAddDepotOpen(false)}
        title="Register Operational Logistics Hub"
        maxWidth="md"
      >
        <form onSubmit={handleAddDepot} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-on-surface block mb-1">Depot Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Khandagiri South Cross-Dock"
              value={newDepot.name}
              onChange={(e) => setNewDepot({ ...newDepot, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono focus:border-primary focus:ring-1 focus:ring-primary"
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
                className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-outline-variant/60">
            <Button type="button" variant="outline" onClick={() => setIsAddDepotOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Register Depot
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
