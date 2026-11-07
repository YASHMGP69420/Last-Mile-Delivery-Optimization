import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
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
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Role & Permission Matrix"
        subtitle="Granular privilege governance enforced at the Express backend middleware layer"
        actions={
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            <Save className="w-4 h-4 mr-1.5" />
            Save Policy Changes
          </Button>
        }
      />

      {saveNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Role Tabs/Sections */}
      {['ADMIN', 'FLEET_MANAGER', 'DRIVER'].map((role) => (
        <div key={role} className="rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft overflow-hidden">
          <div className="px-6 py-4 bg-surface border-b border-outline-variant/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                  role === 'ADMIN'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : role === 'FLEET_MANAGER'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
                <tr className="border-b border-outline-variant/60 text-[10px] uppercase font-bold text-on-surface-variant">
                  <th className="py-2.5 px-3">System Capability</th>
                  {actions.map((act) => (
                    <th key={act} className="py-2.5 px-2 text-center uppercase">
                      {act}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
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
                              className="rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
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
