import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  AlertTriangle,
  Route as RouteIcon,
  Package,
  Layers,
  RotateCw,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const OperationsControlPage: React.FC = () => {
  const [activeRoutes, setActiveRoutes] = useState<any[]>([]);
  const [failedDeliveries, setFailedDeliveries] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getOperationsOversight();
      setActiveRoutes(res.data.activeRoutes || []);
      setFailedDeliveries(res.data.failedDeliveries || []);
      setBatches(res.data.batches || []);
    } catch (err) {
      console.error('Failed to load operations oversight:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelRoute = async (route: any) => {
    const reason = window.prompt(
      `Mandatory administrative reason for cancelling route ${route.routeCode}:`,
      'Severe weather / flash flooding obstruction'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required for operational overrides.');
      return;
    }

    try {
      await AdminApi.overrideOperation({
        targetType: 'ROUTE',
        targetId: route._id || route.id,
        action: 'CANCEL_ROUTE',
        reason,
      });
      setActionNotice(`Route ${route.routeCode} cancelled. Vehicle, driver, and consignments returned to pool.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel route');
    }
  };

  const handleReopenDelivery = async (delivery: any) => {
    const reason = window.prompt(
      `Mandatory administrative reason for reopening consignment ${delivery.orderReference}:`,
      'Customer confirmed availability for re-attempt'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required.');
      return;
    }

    try {
      await AdminApi.overrideOperation({
        targetType: 'DELIVERY',
        targetId: delivery._id || delivery.id,
        action: 'REOPEN_FAILED',
        reason,
      });
      setActionNotice(`Consignment ${delivery.orderReference} reopened and returned to READY status.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to reopen delivery');
    }
  };

  const handleChangePriority = async (delivery: any) => {
    const newPriority = window.prompt(
      `Select new priority for ${delivery.orderReference} (Standard, Urgent, Cold Chain):`,
      'Urgent'
    );
    if (!newPriority) return;

    const reason = window.prompt(
      `Mandatory reason for changing priority to ${newPriority}:`,
      'VIP customer SLA escalation'
    );
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason is required.');
      return;
    }

    try {
      await AdminApi.overrideOperation({
        targetType: 'DELIVERY',
        targetId: delivery._id || delivery.id,
        action: 'CHANGE_PRIORITY',
        newPriority,
        reason,
      });
      setActionNotice(`Consignment ${delivery.orderReference} updated to ${newPriority}.`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update priority');
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
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Route and Operations Intervention Control
          </h1>
          <p className="text-xs text-on-surface-variant">
            Live operations oversight, route cancellations, priority elevations, and failed consignment reviews.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData}>
          <RotateCw className="w-3.5 h-3.5 mr-1" />
          Refresh Operations
        </Button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Active Dispatched Routes Oversight */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 bg-surface border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-secondary" />
            <h2 className="text-sm font-bold text-on-surface">Active In-Progress Routes ({activeRoutes.length})</h2>
          </div>
          <span className="text-[11px] text-on-surface-variant font-mono">Privileged Cancellation Guard</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Route Code</th>
                <th className="py-3 px-4">Assigned Vehicle</th>
                <th className="py-3 px-4">Total Stops</th>
                <th className="py-3 px-4">Distance & ETA</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {activeRoutes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-on-surface-variant">
                    No active routes in transit right now.
                  </td>
                </tr>
              ) : (
                activeRoutes.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-on-surface">{r.routeCode}</td>
                    <td className="py-3 px-4 text-on-surface-variant font-mono">
                      {r.vehicleId?.registrationNumber || r.vehicleId?.vehicleId || 'Assigned'}
                    </td>
                    <td className="py-3 px-4 text-on-surface">{r.stops?.length || 0} stops</td>
                    <td className="py-3 px-4 text-on-surface font-mono">
                      {r.metrics?.totalDistanceKm || 0} km | {r.metrics?.estimatedDurationMinutes || 0}m
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-blue-500/10 text-blue-500">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleCancelRoute(r)}
                        className="px-2 py-1 rounded text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30"
                      >
                        Emergency Cancel Route
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Deliveries Operational Review */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-4 bg-surface border-b border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-on-surface">Failed Consignments Operational Review ({failedDeliveries.length})</h2>
          </div>
          <span className="text-[11px] text-on-surface-variant font-mono">Admin Reopening Authority</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order Reference</th>
                <th className="py-3 px-4">Customer & Address</th>
                <th className="py-3 px-4">Failure Reason</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {failedDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-on-surface-variant">
                    No failed consignments requiring review.
                  </td>
                </tr>
              ) : (
                failedDeliveries.map((d) => (
                  <tr key={d._id || d.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-on-surface">{d.orderReference}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-on-surface">{d.customer?.name}</div>
                      <div className="text-[10px] text-on-surface-variant">{d.address?.street}, {d.address?.zone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-red-500/10 text-red-500 border border-red-500/20">
                        {d.failureReason || 'FAILED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant max-w-xs truncate">{d.failureNotes || 'None'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleChangePriority(d)}
                        className="text-[10px] font-mono font-bold text-amber-500 hover:underline cursor-pointer"
                        title="Click to elevate priority"
                      >
                        {d.priority} ✎
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleReopenDelivery(d)}
                        className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                      >
                        Reopen for Re-Dispatch
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
