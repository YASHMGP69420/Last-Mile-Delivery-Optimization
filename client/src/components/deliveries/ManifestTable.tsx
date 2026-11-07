import React, { useState } from 'react';
import { Delivery } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import {
  FileText,
  Clock,
  Layers,
  MapPin,
  ChevronDown,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ManifestTableProps {
  deliveries: Delivery[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onViewConsignment: (delivery: Delivery) => void;
  onOpenBatchComposer: () => void;
}

export const ManifestTable: React.FC<ManifestTableProps> = ({
  deliveries,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewConsignment,
  onOpenBatchComposer,
}) => {
  const [sortField, setSortField] = useState<keyof Delivery>('orderReference');
  const [sortAsc, setSortAsc] = useState(true);

  const allSelected = deliveries.length > 0 && deliveries.every((d) => selectedIds.includes(d.id));
  const someSelected = deliveries.some((d) => selectedIds.includes(d.id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectAll([]);
    } else {
      onSelectAll(deliveries.map((d) => d.id));
    }
  };

  const handleSort = (field: keyof Delivery) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedDeliveries = [...deliveries].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string') {
      return sortAsc
        ? (aVal as string).localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal as string);
    }
    if (typeof aVal === 'number') {
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    }
    return 0;
  });

  const selectedDeliveries = deliveries.filter((d) => selectedIds.includes(d.id));
  const totalSelectedWeight = selectedDeliveries.reduce((sum, d) => sum + (d.weightKg || 0), 0);

  return (
    <div className="flex flex-col h-full bg-surface-lowest rounded-[28px] border border-outline-variant/60 shadow-soft overflow-hidden">
      {/* Bulk Action Sticky Bar when items are selected */}
      {selectedIds.length > 0 && (
        <div className="bg-primary px-4 py-2.5 flex items-center justify-between text-white transition-all shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white font-mono text-[11px]">
              {selectedIds.length} Consignments Selected
            </span>
            <span className="text-emerald-100 font-mono tabular-nums">
              Total Weight: <strong>{totalSelectedWeight.toFixed(1)} kg</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-primary hover:bg-slate-50 font-bold border-none shadow-sm"
              leftIcon={<Layers className="w-3.5 h-3.5 text-primary" />}
              onClick={onOpenBatchComposer}
            >
              Compose Operational Batch ({selectedIds.length})
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => onSelectAll([])}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead className="bg-surface-low text-on-surface-variant font-semibold sticky top-0 border-b border-outline-variant/60 z-10 select-none">
            <tr>
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                  className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                />
              </th>
              <th
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-on-surface"
                onClick={() => handleSort('orderReference')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Order Ref</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold">Consignee & Phone</th>
              <th className="py-2.5 px-3 font-semibold">Destination Address & Zone</th>
              <th
                className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-on-surface"
                onClick={() => handleSort('weightKg')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Weight (kg)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-right">Vol (m³)</th>
              <th className="py-2.5 px-3 font-semibold">Time Window</th>
              <th className="py-2.5 px-3 font-semibold">Priority</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th className="py-2.5 px-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-outline-variant/60">
            {sortedDeliveries.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-on-surface-variant">
                  <div className="max-w-xs mx-auto space-y-2">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-on-surface">No Consignments Found</p>
                    <p className="text-xs text-on-surface-variant">
                      Try adjusting your filters or import deliveries using the CSV tool above.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedDeliveries.map((delivery) => {
                const isSelected = selectedIds.includes(delivery.id);
                return (
                  <tr
                    key={delivery.id}
                    className={clsx(
                      'hover:bg-surface-low transition-colors group cursor-pointer',
                      isSelected && 'bg-emerald/10'
                    )}
                    onClick={() => onToggleSelect(delivery.id)}
                  >
                    {/* Checkbox */}
                    <td
                      className="py-2.5 px-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(delivery.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleSelect(delivery.id)}
                        className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>

                    {/* Order Reference */}
                    <td className="py-2.5 px-3 font-mono font-semibold text-primary whitespace-nowrap">
                      {delivery.orderReference}
                    </td>

                    {/* Consignee */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-on-surface truncate max-w-[150px]">
                        {delivery.customer?.name || 'Unknown'}
                      </div>
                      <div className="text-[11px] text-on-surface-variant font-mono">
                        {delivery.customer?.phone || '-'}
                      </div>
                    </td>

                    {/* Address & Zone */}
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="truncate text-on-surface font-medium" title={delivery.address?.street}>
                        {delivery.address?.street || 'No address'}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{delivery.address?.zone || 'Unassigned Zone'}</span>
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums text-on-surface">
                      {(delivery.weightKg ?? 0).toFixed(1)}
                    </td>

                    {/* Volume */}
                    <td className="py-2.5 px-3 text-right font-mono text-on-surface-variant tabular-nums">
                      {delivery.volumeM3 ? delivery.volumeM3.toFixed(3) : '0.010'}
                    </td>

                    {/* Time Window */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {delivery.timeWindow?.start || '--:--'} - {delivery.timeWindow?.end || '--:--'}
                        </span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={delivery.priority} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={delivery.status} size="sm" />
                    </td>

                    {/* Action Button */}
                    <td
                      className="py-2.5 px-3 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="py-1 px-2 text-xs"
                        onClick={() => onViewConsignment(delivery)}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Counter */}
      <div className="py-2.5 px-4 bg-surface-low border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant">
        <span>
          Showing <strong>{sortedDeliveries.length}</strong> total consignments
        </span>
        <span className="font-mono">Rasulgarh Dispatch Matrix</span>
      </div>
    </div>
  );
};
