import React from 'react';
import { ArrowRight, Package, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface ConsignmentActivityItem {
  id: string;
  orderReference: string;
  recipientOrAction: string;
  zone: string;
  timestamp: string;
  status: string;
  weightKg?: number;
}

interface RecentActivityStreamProps {
  items?: ConsignmentActivityItem[];
}

export const RecentActivityStream: React.FC<RecentActivityStreamProps> = ({ items = [] }) => {
  const displayList = items;

  return (
    <div className="panel-card rounded-xl p-5 border border-outline-variant/60 dark:border-obsidian-750 space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface dark:text-white">Recent Manifest Activity</h3>
          <p className="text-[11px] text-on-surface-variant dark:text-slate-400">Live manifest updates and dispatch event logs</p>
        </div>
        <Link
          to="/admin/audit-logs"
          className="text-xs text-primary dark:text-emerald-400 hover:underline font-medium flex items-center gap-1"
        >
          <span>Audit Log</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table List or Clean Empty State */}
      {displayList.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-outline-variant/50 dark:border-obsidian-750 rounded-lg">
          <Package className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
          <p className="text-xs font-medium text-on-surface dark:text-slate-200">No consignment events recorded today</p>
          <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">
            Manifest dispatches, status transitions, and driver completions will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] font-medium text-on-surface-variant/70 border-b border-outline-variant/40 dark:border-obsidian-750">
                <th className="pb-2.5 font-medium">Consignment</th>
                <th className="pb-2.5 font-medium hidden sm:table-cell">Destination Zone</th>
                <th className="pb-2.5 font-medium hidden md:table-cell">Time</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium text-right">Cargo Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 dark:divide-obsidian-750">
              {displayList.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-surface-low/50 dark:hover:bg-obsidian-850/50 transition-colors">
                  {/* Order Reference & Description */}
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 flex items-center justify-center text-on-surface-variant dark:text-slate-300 shrink-0 border border-outline-variant/40 dark:border-obsidian-700">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-on-surface dark:text-white block font-mono text-xs">
                          {row.orderReference}
                        </span>
                        <span className="text-[11px] text-on-surface-variant dark:text-slate-400 block truncate max-w-[190px]">
                          {row.recipientOrAction}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Destination Zone */}
                  <td className="py-3 text-on-surface dark:text-slate-200 font-medium text-xs hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-on-surface-variant dark:text-slate-400 shrink-0" />
                      <span>{row.zone}</span>
                    </div>
                  </td>

                  {/* Dispatch Time */}
                  <td className="py-3 text-on-surface-variant dark:text-slate-400 font-mono text-xs hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-on-surface-variant/60 shrink-0" />
                      <span>{row.timestamp}</span>
                    </div>
                  </td>

                  {/* Status Indicator */}
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface dark:text-slate-200">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          row.status.toLowerCase().includes('complete') || row.status.toLowerCase().includes('success')
                            ? 'bg-emerald-500'
                            : row.status.toLowerCase().includes('transit')
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {row.status}
                    </span>
                  </td>

                  {/* Cargo Weight */}
                  <td className="py-3 text-right font-medium text-on-surface dark:text-slate-200 font-mono tabular-nums">
                    {row.weightKg ? `${row.weightKg.toFixed(1)} kg` : 'Standard'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
