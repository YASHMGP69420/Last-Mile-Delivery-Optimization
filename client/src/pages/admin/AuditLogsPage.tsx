import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
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
import { Modal } from '../../components/common/Modal';

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
    <div className="space-y-4">
      <AdminHeader
        title="System Audit Logs"
        subtitle="Immutable operational and administrative ledger documenting system mutations"
        actions={
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

            <Button variant="outline" size="sm" onClick={fetchLogs} isLoading={isLoading}>
              <RotateCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Audit Log Table */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-low text-on-surface-variant font-semibold border-b border-outline-variant/60 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Event Classification</th>
                <th className="py-3 px-4">Action Summary</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-on-surface-variant">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Querying immutable audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-on-surface-variant">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log._id || log.id}
                    className="hover:bg-surface-low/50 transition-colors cursor-pointer"
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
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-surface-low dark:bg-obsidian-850 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-primary text-on-surface font-medium">
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-on-surface max-w-sm truncate">{log.action}</td>
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-[11px]">
                      {log.metadata?.entity || 'System'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="text-primary hover:underline font-semibold flex items-center gap-1 ml-auto text-[11px] cursor-pointer"
                      >
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
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Inspector"
        subtitle="Immutable transaction proof and actor signature"
        maxWidth="lg"
        footer={
          <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-on-surface-variant block text-[10px] uppercase font-bold tracking-wider">Action</span>
              <span className="font-semibold text-on-surface text-sm">{selectedLog.action}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-surface-low border border-outline-variant/40">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold tracking-wider">Actor</span>
                <span className="text-on-surface font-mono font-semibold">{selectedLog.actorId?.name || selectedLog.actorRole}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-low border border-outline-variant/40">
                <span className="text-on-surface-variant block text-[10px] uppercase font-bold tracking-wider">Timestamp</span>
                <span className="text-on-surface font-mono text-[11px]">{new Date(selectedLog.at).toISOString()}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-on-surface-variant block text-[10px] uppercase font-bold tracking-wider mb-1">
                Raw Event Payload
              </span>
              <pre className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/60 text-[11px] font-mono text-on-surface overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
