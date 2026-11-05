import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminApi } from '../../api/client';
import {
  ShieldCheck,
  Users,
  Truck,
  Package,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Server,
  Database,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Wrench,
  Radio,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const AdminControlCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const res = await AdminApi.getOverview();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const operational = data?.operational || {};
  const health = data?.systemHealth || {};
  const recentLogs = data?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary via-slate-900 to-primary text-white shadow-xl border border-primary-hover flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Super Admin Level
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-amber-400" />
            Executive Admin Control Center
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Organization-wide system oversight, privileged fleet overrides, security audits, and multi-depot management.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            isLoading={isRefreshing}
            className="border-slate-700 text-slate-200 hover:bg-white/10"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Diagnostics
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/admin/users')}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Manage Users
          </Button>
        </div>
      </div>

      {/* Organization KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span>Total System Users</span>
            <Users className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-2xl font-black text-on-surface">{metrics.totalUsers ?? 0}</div>
          <div className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
            <span className="text-emerald-500 font-bold">{metrics.activeDriversCount ?? 0} Active Drivers</span>
            <span>•</span>
            <span>{metrics.fleetManagersCount ?? 0} Dispatchers</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span>Fleet Availability</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-on-surface">
            {metrics.availableVehicles ?? 0} <span className="text-sm font-normal text-on-surface-variant">/ {metrics.totalVehicles ?? 0}</span>
          </div>
          <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
            <span>Utilization: <strong className="text-secondary">{metrics.totalFleetUtilization ?? 0}%</strong></span>
            <span className="text-amber-500">{metrics.maintenanceVehicles ?? 0} in Maintenance</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span>Deliveries Volume</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-on-surface">{metrics.totalDeliveries ?? 0}</div>
          <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
            <span className="text-blue-500 font-semibold">{metrics.activeDeliveries ?? 0} In Transit</span>
            <span className="text-emerald-500 font-semibold">{metrics.completedDeliveries ?? 0} Done</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
            <span>Service Success Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-500">{metrics.onTimeDeliveryRate ?? 100}%</div>
          <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
            <span>Failed Consignments:</span>
            <span className="text-red-500 font-bold">{metrics.failedDeliveries ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: System Diagnostics & Operational Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live System Health */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Server className="w-4 h-4 text-secondary" />
              Live System Health & Infrastructure Probes
            </h2>
            <span className="text-[10px] font-mono text-on-surface-variant">Live Probe</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-surface border border-outline-variant space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-secondary" /> Node.js Backend API
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                  {health.backend?.status || 'UP'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Uptime: {Math.floor((health.backend?.uptimeSeconds || 0) / 60)}m | RAM: {health.backend?.memoryUsageMb || 0} MB
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-outline-variant space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-500" /> MongoDB Cluster
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${health.mongodb?.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {health.mongodb?.status || 'CONNECTED'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono truncate">
                DB: {health.mongodb?.databaseName || 'smartroute'} (Port 27017)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-outline-variant space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> Geoapify / Tiles
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500">
                  {health.geoapify?.status || 'HEALTHY'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">
                {health.geoapify?.provider || 'Routing & Matrix Engine'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-outline-variant space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-purple-500" /> Realtime Dispatch
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-500">
                  {health.socketIo?.status || 'OPERATIONAL'}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Telemetry streaming socket active
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => navigate('/admin/integrations')}
              className="text-xs text-secondary hover:underline flex items-center gap-1 font-medium"
            >
              Configure Integrations <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Operational Overview & Quick Interventions */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Active Operations Oversight
            </h2>
            <button
              onClick={() => navigate('/admin/operations')}
              className="text-xs text-secondary hover:underline flex items-center gap-1 font-medium"
            >
              Control Operations <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-surface border border-outline-variant">
              <span className="text-[11px] text-on-surface-variant block font-medium">Active Dispatches</span>
              <span className="text-xl font-bold text-on-surface">{operational.activeRoutes ?? 0}</span>
              <span className="text-[10px] text-slate-400 block">Routes in transit</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-outline-variant">
              <span className="text-[11px] text-on-surface-variant block font-medium">Active Batches</span>
              <span className="text-xl font-bold text-on-surface">{operational.activeBatches ?? 0}</span>
              <span className="text-[10px] text-slate-400 block">Staging & In-Progress</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-outline-variant">
              <span className="text-[11px] text-on-surface-variant block font-medium">Unassigned Orders</span>
              <span className="text-xl font-bold text-amber-500">{operational.unassignedDeliveries ?? 0}</span>
              <span className="text-[10px] text-slate-400 block">Awaiting batch packaging</span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-outline-variant">
              <span className="text-[11px] text-on-surface-variant block font-medium">Resource Shortages</span>
              <span className="text-xl font-bold text-emerald-500">0</span>
              <span className="text-[10px] text-slate-400 block">Fleet capacity adequate</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="pt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/organization')}>
              Manage Depots
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/fleet-control')}>
              Fleet Suspensions
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/optimization-settings')}>
              Algorithm Weights
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/fuel-settings')}>
              Fuel Tariffs
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Audit Activity */}
      <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Activity className="w-4 h-4 text-secondary" />
            Recent Administrative Actions & Security Audit Trail
          </h2>
          <button
            onClick={() => navigate('/admin/audit-logs')}
            className="text-xs text-secondary hover:underline flex items-center gap-1 font-medium"
          >
            View Full Audit Trail <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-on-surface-variant py-4 text-center">No recent administrative events recorded yet.</p>
        ) : (
          <div className="divide-y divide-outline-variant">
            {recentLogs.map((log: any) => (
              <div key={log._id || log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-on-surface truncate">{log.action}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-slate-800 text-slate-300">
                      {log.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-2">
                    <span>By: <strong className="text-on-surface">{log.actorId?.name || log.actorRole || 'System'}</strong></span>
                    <span>•</span>
                    <span>Entity: {log.metadata?.entity || 'System'}</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-on-surface-variant shrink-0">
                  {new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
