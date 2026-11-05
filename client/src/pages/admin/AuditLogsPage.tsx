import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import {
  FileText,
  Search,
  Filter,
  RotateCw,
  Activity,
  Calendar,
  User,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { limit: 100 };
      if (roleFilter) params.actorRole = roleFilter;
      if (typeFilter) params.type = typeFilter;
      const res = await AdminApi.getAuditLogs(params);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [roleFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
            <FileText className="w-6 h-6 text-amber-500" />
            Append-Only System Audit Logs
          </h1>
          <p className="text-xs text-on-surface-variant">
            Immutable operational and administrative ledger documenting privileged interventions and system mutations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-surface-lowest border border-outline-variant text-on-surface focus:outline-none"
          >
            <option value="">All Actor Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="FLEET_MANAGER">FLEET_MANAGER</option>
            <option value="DRIVER">DRIVER</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Event Classification</th>
                <th className="py-3 px-4">Action Summary</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-2" />
                    Querying immutable audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id || log.id}
                    className="hover:bg-surface/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                      {new Date(log.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-on-surface">{log.actorId?.name || log.actorRole}</div>
                      <div className="text-[10px] font-mono text-on-surface-variant">{log.actorRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-outline-variant text-on-surface font-medium">
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-on-surface max-w-sm truncate">{log.action}</td>
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-[11px]">
                      {log.metadata?.entity || 'System'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-secondary hover:underline flex items-center gap-1 ml-auto text-[11px]">
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Audit Log Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Audit Event Inspector
              </h2>
              <button onClick={() => setSelectedLog(null)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Action</span>
                <span className="font-semibold text-on-surface">{selectedLog.action}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Actor</span>
                  <span className="text-on-surface font-mono">{selectedLog.actorId?.name || selectedLog.actorRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Timestamp</span>
                  <span className="text-on-surface font-mono">{new Date(selectedLog.at).toISOString()}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Raw Event Payload</span>
                <pre className="p-3 rounded-lg bg-surface border border-outline-variant text-[11px] font-mono text-on-surface overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
