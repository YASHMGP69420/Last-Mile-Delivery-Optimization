import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  Sliders,
  ShieldCheck,
  Check,
  RotateCw,
  Save,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const PermissionMatrixPage: React.FC = () => {
  const [permissions, setPermissions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const modules = [
    { key: 'userManagement', label: 'User & Access Control' },
    { key: 'fleetManagement', label: 'Fleet & Vehicle Registry' },
    { key: 'driverManagement', label: 'Driver Profiles & Roster' },
    { key: 'routeOptimization', label: 'Route Optimization Engine' },
    { key: 'organizationSettings', label: 'Organization & Multi-Depot' },
    { key: 'auditLogs', label: 'System Audit Logs' },
    { key: 'systemConfig', label: 'System Configuration & Keys' },
  ];

  const actions = ['view', 'create', 'edit', 'delete', 'assign', 'override', 'export'];

  const fetchPermissions = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getPermissions();
      setPermissions(res.data.permissions || {});
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleToggle = (role: string, moduleKey: string, action: string) => {
    setPermissions((prev: any) => {
      const rolePerms = prev[role] || {};
      const modulePerms: string[] = rolePerms[moduleKey] || [];
      const hasAction = modulePerms.includes(action);

      const updated = hasAction
        ? modulePerms.filter((a) => a !== action)
        : [...modulePerms, action];

      return {
        ...prev,
        [role]: {
          ...rolePerms,
          [moduleKey]: updated,
        },
      };
    });
  };

  const handleSave = async () => {
    const reason = window.prompt('Provide administrative reason for modifying permissions policy:', 'Role privilege audit alignment');
    if (!reason) return;

    setIsSaving(true);
    setSaveNotice(null);
    try {
      await AdminApi.updatePermissions({ permissions, reason });
      setSaveNotice('Role permissions policy updated and logged in audit trail successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update permissions');
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
            Role & Permission Policy Matrix
          </h1>
          <p className="text-xs text-on-surface-variant">
            Granular privilege governance enforced independently at the Express backend middleware layer.
          </p>
        </div>

        <Button variant="primary" onClick={handleSave} isLoading={isSaving} className="bg-amber-600 hover:bg-amber-500">
          <Save className="w-4 h-4 mr-1.5" />
          Save Policy Changes
        </Button>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Role Tabs/Sections */}
      {['ADMIN', 'FLEET_MANAGER', 'DRIVER'].map((role) => (
        <div key={role} className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-surface border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                  role === 'ADMIN'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : role === 'FLEET_MANAGER'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {role}
              </span>
              <span className="text-xs font-semibold text-on-surface">Privilege Scope</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-mono">
              {role === 'ADMIN' ? 'Root System Level' : role === 'FLEET_MANAGER' ? 'Operational Dispatch' : 'Field Cockpit Only'}
            </span>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant text-[10px] uppercase font-bold text-on-surface-variant">
                  <th className="py-2 px-3">System Capability</th>
                  {actions.map((act) => (
                    <th key={act} className="py-2 px-2 text-center uppercase">
                      {act}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {modules.map((mod) => {
                  const rolePerms = permissions?.[role] || {};
                  const currentModuleActions: string[] = rolePerms[mod.key] || [];

                  return (
                    <tr key={mod.key} className="hover:bg-surface/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-on-surface">{mod.label}</td>
                      {actions.map((act) => {
                        const isGranted = currentModuleActions.includes(act);
                        return (
                          <td key={act} className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => handleToggle(role, mod.key, act)}
                              className="rounded border-outline-variant text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
