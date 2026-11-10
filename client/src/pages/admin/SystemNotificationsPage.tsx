import React, { useState, useEffect } from 'react';
import { mountRealtimeSocket } from '../../utils/socketClient';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
import {
  AlertTriangle,
  Info,
  ShieldAlert,
  RotateCw,
  Send,
  X,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Toast } from '../../components/common/Toast';

export const SystemNotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'incidents'>('alerts');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [incidentFilter, setIncidentFilter] = useState('OPEN');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    message: '',
    severity: 'WARNING',
    targetRole: 'ALL',
    category: 'GENERAL',
  });

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const notifParams: Record<string, any> = {};
      if (severityFilter) notifParams.severity = severityFilter;
      const incParams: Record<string, any> = {};
      if (incidentFilter) incParams.status = incidentFilter;

      const [notifRes, incRes] = await Promise.all([
        AdminApi.getNotifications(notifParams),
        AdminApi.getIncidents(incParams),
      ]);
      setNotifications(notifRes.data?.notifications || []);
      setIncidents(incRes.data?.incidents || []);
    } catch (err) {
      console.error('Failed to load operational alerts/incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [severityFilter, incidentFilter]);

  // Real-time Socket.IO subscription for new driver incidents & safety alerts
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    return mountRealtimeSocket(token, (socket) => {
      const onAlert = () => {
        fetchAll();
      };
      socket.on('telemetry:alert', onAlert);
      return () => {
        socket.off('telemetry:alert', onAlert);
      };
    });
  }, [severityFilter, incidentFilter]);

  const handleMarkRead = async (id: string) => {
    try {
      await AdminApi.markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => (n._id || n.id) !== id));
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
      setToastMsg('Operational broadcast transmitted cleanly');
      fetchAll();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to dispatch alert');
    }
  };

  const handleResolveIncident = async (status: 'UNDER_INVESTIGATION' | 'RESOLVED' | 'DISMISSED') => {
    if (!resolvingIncident) return;
    try {
      const id = resolvingIncident._id || resolvingIncident.id;
      await AdminApi.resolveIncident(id, { status, resolutionNotes });
      setResolvingIncident(null);
      setResolutionNotes('');
      setToastMsg(`Incident updated to ${status}`);
      fetchAll();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to update incident');
    }
  };

  const openIncidentsCount = incidents.filter((i) => i.status === 'OPEN').length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Operational Alerts & Driver Incidents"
        subtitle="Real-time broadcasts, pre-trip safety flags, and driver incident resolution"
        actions={
          <Button variant="primary" onClick={() => setIsBroadcastOpen(true)}>
            <Send className="w-4 h-4 mr-1.5" />
            Broadcast Alert
          </Button>
        }
      />

      {/* Tabs: System Alerts vs Driver Incidents */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 p-1 rounded-xl bg-surface-lowest border border-outline-variant/60">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`spring-press px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'alerts'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            System Alerts ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`spring-press px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'incidents'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>Driver Incidents</span>
            {openIncidentsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {openIncidentsCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'alerts' ? (
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
          ) : (
            <select
              value={incidentFilter}
              onChange={(e) => setIncidentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
          )}

          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RotateCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <RotateCw className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : activeTab === 'alerts' ? (
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface-lowest border border-outline-variant text-center text-xs text-on-surface-variant">
              No active system notifications or alerts found.
            </div>
          ) : (
            notifications.map((n) => {
              const isCritical = n.severity === 'CRITICAL';
              const isWarning = n.severity === 'WARNING';

              return (
                <div
                  key={n._id || n.id}
                  className={`p-5 rounded-xl bg-surface-lowest shadow-soft border transition-all flex items-start justify-between gap-4 ${
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-on-surface">{n.title}</h3>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
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
                    className="spring-press text-xs text-on-surface-variant hover:text-on-surface border border-outline-variant rounded px-2.5 py-1 bg-surface shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.length === 0 ? (
            <div className="p-8 rounded-xl bg-surface-lowest border border-outline-variant text-center text-xs text-on-surface-variant">
              No driver incidents matching this filter.
            </div>
          ) : (
            incidents.map((inc) => {
              const driverName = inc.driverId?.userId?.name || inc.driverId?.licenseNumber || 'Driver';
              const isResolved = inc.status === 'RESOLVED' || inc.status === 'DISMISSED';

              return (
                <div
                  key={inc._id || inc.id}
                  className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-on-surface">{driverName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-low border border-outline-variant font-semibold">
                        {inc.category}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
                            ? 'bg-red-500/15 text-red-600'
                            : 'bg-amber-500/15 text-amber-700'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isResolved
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-blue-500/15 text-blue-700'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{inc.description}</p>
                    {inc.resolutionNotes && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Resolution Note: {inc.resolutionNotes}
                      </p>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {inc.routeId?.routeCode ? `Route ${inc.routeId.routeCode} • ` : ''}
                      {new Date(inc.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  {!isResolved && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setResolvingIncident(inc);
                        setResolutionNotes(inc.resolutionNotes || '');
                      }}
                      leftIcon={<ClipboardCheck className="w-3.5 h-3.5" />}
                    >
                      Review / Resolve
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: Resolve / Update Driver Incident */}
      {resolvingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-floating w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Update Driver Incident
              </h2>
              <button
                onClick={() => setResolvingIncident(null)}
                className="p-1 rounded-lg hover:bg-surface text-on-surface-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">{resolvingIncident.description}</p>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Enter action taken or instructions sent back to driver..."
              className="w-full p-3 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none focus:border-primary"
            />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => handleResolveIncident('UNDER_INVESTIGATION')}>
                Mark Investigating
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleResolveIncident('DISMISSED')}>
                Dismiss
              </Button>
              <Button size="sm" variant="primary" onClick={() => handleResolveIncident('RESOLVED')}>
                Resolve & Notify Driver
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Broadcast Alert */}
      {isBroadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-floating w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                Broadcast System Operational Alert
              </h2>
              <button
                onClick={() => setIsBroadcastOpen(false)}
                className="p-1 rounded-lg hover:bg-surface text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
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

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
