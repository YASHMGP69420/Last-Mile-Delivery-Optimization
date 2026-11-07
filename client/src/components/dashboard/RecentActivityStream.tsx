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

export const RecentActivityStream: React.FC<RecentActivityStreamProps> = ({ items }) => {
  const defaultItems: ConsignmentActivityItem[] = [
    {
      id: '1',
      orderReference: 'DEL-8941',
      recipientOrAction: 'Medical Supplies & Cold Chain',
      zone: 'Patia (Zone 1)',
      timestamp: '10:30 AM',
      status: 'In Transit',
      weightKg: 6.4,
    },
    {
      id: '2',
      orderReference: 'DEL-7290',
      recipientOrAction: 'Electronics Consignment',
      zone: 'Jaydev Vihar (Zone 2)',
      timestamp: '09:45 AM',
      status: 'Out for Delivery',
      weightKg: 4.2,
    },
    {
      id: '3',
      orderReference: 'DEL-6312',
      recipientOrAction: 'Express Retail Parcels',
      zone: 'Saheed Nagar (Zone 3)',
      timestamp: '08:15 AM',
      status: 'Completed',
      weightKg: 12.8,
    },
  ];

  const displayList = items && items.length > 0 ? items : defaultItems;

  return (
    <div className="bg-surface-lowest rounded-[28px] p-6 shadow-soft border border-outline-variant/60 space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Recent Consignment Dispatches</h3>
          <p className="text-[11px] text-on-surface-variant">Live manifest updates, deliveries, and audit events</p>
        </div>
        <Link
          to="/admin/audit-logs"
          className="text-xs text-emerald hover:underline font-semibold flex items-center gap-1"
        >
          <span>View Audit Trail</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[11px] font-medium text-on-surface-variant/70 border-b border-outline-variant/40">
              <th className="pb-3 font-medium">Consignment</th>
              <th className="pb-3 font-medium hidden sm:table-cell">Destination Zone</th>
              <th className="pb-3 font-medium hidden md:table-cell">Dispatch Time</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Cargo Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {displayList.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-surface-low/50 transition-colors">
                {/* Order Reference & Description */}
                <td className="py-3.5 pr-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald/10 flex items-center justify-center text-emerald shrink-0 border border-emerald/20">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-on-surface block font-mono text-xs">
                        {row.orderReference}
                      </span>
                      <span className="text-[11px] text-on-surface-variant block truncate max-w-[190px]">
                        {row.recipientOrAction}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Destination Zone */}
                <td className="py-3.5 text-on-surface font-medium text-xs hidden sm:table-cell">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald shrink-0" />
                    <span>{row.zone}</span>
                  </div>
                </td>

                {/* Dispatch Time */}
                <td className="py-3.5 text-on-surface-variant font-mono text-xs hidden md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-on-surface-variant/60 shrink-0" />
                    <span>{row.timestamp}</span>
                  </div>
                </td>

                {/* Status Dot Pill */}
                <td className="py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        row.status.toLowerCase().includes('complete') || row.status.toLowerCase().includes('success')
                          ? 'bg-emerald'
                          : row.status.toLowerCase().includes('transit')
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-amber-500'
                      }`}
                    />
                    {row.status}
                  </span>
                </td>

                {/* Cargo Weight */}
                <td className="py-3.5 text-right font-bold text-on-surface font-mono tabular-nums">
                  {row.weightKg ? `${row.weightKg.toFixed(1)} kg` : 'Standard'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
