import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
import {
  Wrench,
  Truck,
  Users,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Fuel,
  Battery,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const FleetControlPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'DRIVERS'>('VEHICLES');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getFleetControl();
      setVehicles(res.data.vehicles || []);
      setDrivers(res.data.drivers || []);
      setCounts(res.data.counts || {});
    } catch (err) {
      console.error('Failed to load fleet control:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVehicleOverride = async (vehicle: any, action: string) => {
    const reason = window.prompt(
      `Mandatory administrative reason for setting vehicle ${vehicle.vehicleId || vehicle.registrationNumber} to ${action}:`,
      'Mechanical inspection directive'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required for operational overrides.');
      return;
    }

    try {
      await AdminApi.overrideFleetResource({
        resourceType: 'VEHICLE',
        resourceId: vehicle._id || vehicle.id,
        action,
        reason,
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to override vehicle status');
    }
  };

  const handleDriverOverride = async (driver: any, action: string) => {
    const reason = window.prompt(
      `Mandatory administrative reason for driver ${driver.licenseNumber} status override:`,
      'Medical leave / safety compliance review'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required for operational overrides.');
      return;
    }

    try {
      await AdminApi.overrideFleetResource({
        resourceType: 'DRIVER',
        resourceId: driver._id || driver.id,
        action,
        reason,
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to override driver status');
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
    <div className="space-y-4">
      <AdminHeader
        title="Fleet Control & Resource Overrides"
        subtitle="Fleet safety controls, vehicle maintenance assignments, and driver availability"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {/* Fleet Summary Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <span className="text-xs text-on-surface-variant font-medium">Total Vehicles</span>
          <div className="text-2xl font-black text-on-surface">{counts.totalVehicles ?? 0}</div>
          <span className="text-[10px] text-emerald-500 font-semibold">{counts.availableVehicles ?? 0} Available for dispatch</span>
        </div>

        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <span className="text-xs text-on-surface-variant font-medium">Under Maintenance</span>
          <div className="text-2xl font-black text-amber-500">{counts.maintenanceVehicles ?? 0}</div>
          <span className="text-[10px] text-on-surface-variant">Suspended from assignments</span>
        </div>

        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <span className="text-xs text-on-surface-variant font-medium">Rostered Drivers</span>
          <div className="text-2xl font-black text-on-surface">{drivers.length}</div>
          <span className="text-[10px] text-emerald-500 font-semibold">{counts.activeDrivers ?? 0} Available / On Duty</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant">
        <button
          onClick={() => setActiveTab('VEHICLES')}
          className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'VEHICLES'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Truck className="w-4 h-4" />
          Vehicle Fleet ({vehicles.length})
        </button>
        <button
          onClick={() => setActiveTab('DRIVERS')}
          className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'DRIVERS'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          Driver Personnel ({drivers.length})
        </button>
      </div>

      {/* Vehicle Tab Content */}
      {activeTab === 'VEHICLES' && (
        <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Vehicle ID</th>
                  <th className="py-3 px-4">Model & Type</th>
                  <th className="py-3 px-4">Propulsion</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Emergency Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {vehicles.map((v) => {
                  const status = v.availability || v.status;
                  const isMaintenance = status === 'MAINTENANCE';
                  const isAvailable = status === 'AVAILABLE';

                  return (
                    <tr key={v._id || v.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-on-surface">
                        {v.vehicleId || v.registrationNumber}
                      </td>
                      <td className="py-3 px-4 text-on-surface">
                        <div>{v.makeModel}</div>
                        <div className="text-[10px] text-on-surface-variant">{v.type}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1 font-mono text-on-surface-variant">
                          {v.fuelType === 'Electric' ? (
                            <Battery className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Fuel className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {v.fuelType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-on-surface">{v.capacityKg} kg</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            status === 'AVAILABLE'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : status === 'MAINTENANCE'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {!isMaintenance ? (
                          <button
                            onClick={() => handleVehicleOverride(v, 'SUSPEND_MAINTENANCE')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30"
                          >
                            Suspend to Maintenance
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVehicleOverride(v, 'MARK_AVAILABLE')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                          >
                            Clear & Restore Available
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Driver Tab Content */}
      {activeTab === 'DRIVERS' && (
        <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Driver Name</th>
                  <th className="py-3 px-4">Commercial License</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Assigned Vehicle</th>
                  <th className="py-3 px-4 text-right">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {drivers.map((d) => {
                  const isOffDuty = d.availability === 'OFF_DUTY';

                  return (
                    <tr key={d._id || d.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-on-surface">
                        {d.userId?.name || 'Driver'}
                      </td>
                      <td className="py-3 px-4 font-mono text-on-surface-variant">{d.licenseNumber}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{d.phone}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                            d.availability === 'AVAILABLE' || d.availability === 'ON_DUTY'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-slate-500/10 text-slate-400'
                          }`}
                        >
                          {d.availability}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-on-surface">
                        {d.assignedVehicleId?.vehicleId || d.assignedVehicleId?.registrationNumber || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {!isOffDuty ? (
                          <button
                            onClick={() => handleDriverOverride(d, 'FORCE_OFF_DUTY')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30"
                          >
                            Force Off-Duty
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDriverOverride(d, 'MARK_AVAILABLE')}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                          >
                            Mark Available
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
