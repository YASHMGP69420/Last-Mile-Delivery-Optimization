import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
import {
  Bell,
  AlertTriangle,
  Info,
  ShieldAlert,
  CheckCircle2,
  RotateCw,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const SystemNotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    message: '',
    severity: 'WARNING',
    targetRole: 'ALL',
    category: 'GENERAL',
  });

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (severityFilter) params.severity = severityFilter;
      const res = await AdminApi.getNotifications(params);
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [severityFilter]);

  const handleMarkRead = async (id: string) => {
    try {
      await AdminApi.markNotificationRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AdminApi.createNotification(broadcastData);
      setIsBroadcastOpen(false);
      setBroadcastData({
        title: '',
        message: '',
        severity: 'WARNING',
        targetRole: 'ALL',
        category: 'GENERAL',
      });
      fetchNotifications();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to dispatch alert');
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
        title="System Alerts & Broadcasts"
        subtitle="Broadcast fleet notifications, inspect mechanical flags, and review live exception logs"
        actions={
          <Button variant="primary" onClick={() => setIsBroadcastOpen(true)}>
            <Send className="w-4 h-4 mr-1.5" />
            Broadcast Alert
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:outline-none"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="WARNING">WARNING</option>
          <option value="INFO">INFO</option>
        </select>

        <Button variant="outline" size="sm" onClick={fetchNotifications}>
          <RotateCw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="p-8 rounded-xl bg-surface-lowest border border-outline-variant text-center text-xs text-on-surface-variant">
            No system notifications or alerts found.
          </div>
        ) : (
          notifications.map((n) => {
            const isCritical = n.severity === 'CRITICAL';
            const isWarning = n.severity === 'WARNING';

            return (
              <div
                key={n._id || n.id}
                className={`p-5 rounded-[24px] bg-surface-lowest shadow-soft border transition-all flex items-start justify-between gap-4 ${
                  isCritical
                    ? 'border-red-500/40 bg-red-500/5'
                    : isWarning
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-outline-variant'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCritical
                        ? 'bg-red-500/20 text-red-500'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-blue-500/20 text-blue-500'
                    }`}
                  >
                    {isCritical ? <ShieldAlert className="w-4 h-4" /> : isWarning ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-on-surface">{n.title}</h3>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          isCritical
                            ? 'bg-red-500 text-white'
                            : isWarning
                            ? 'bg-amber-500 text-slate-900'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {n.severity}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">[{n.targetRole}]</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{n.message}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-2 block">
                      {new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleMarkRead(n._id || n.id)}
                  className="text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded px-2 py-1 bg-surface shrink-0"
                >
                  Dismiss
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Broadcast Alert */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                Broadcast System Operational Alert
              </h2>
              <button onClick={() => setIsBroadcastOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Alert Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Severe Monsoon Alert: Patia-Jaydev Vihar Corridor"
                  value={broadcastData.title}
                  onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Detailed Operational Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide instructions for field drivers and hub dispatchers..."
                  value={broadcastData.message}
                  onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-on-surface block mb-1">Severity</label>
                  <select
                    value={broadcastData.severity}
                    onChange={(e) => setBroadcastData({ ...broadcastData, severity: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                  >
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-on-surface block mb-1">Target Audience</label>
                  <select
                    value={broadcastData.targetRole}
                    onChange={(e) => setBroadcastData({ ...broadcastData, targetRole: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface focus:outline-none"
                  >
                    <option value="ALL">Entire Organization</option>
                    <option value="DRIVER">Field Drivers Only</option>
                    <option value="FLEET_MANAGER">Dispatch Managers</option>
                    <option value="ADMIN">Super Admins</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsBroadcastOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-amber-600 hover:bg-amber-500">
                  Broadcast Alert
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
