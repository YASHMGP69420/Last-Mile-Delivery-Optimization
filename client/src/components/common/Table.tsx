import React from 'react';

/**
 * Reusable table component supporting both key-based and function-based accessors.
 */
interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
}

interface TableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  getRowId?: (row: T) => string;
}

function getCellValue<T extends Record<string, any>>(row: T, accessor: keyof T | ((row: T) => React.ReactNode)): React.ReactNode {
  if (typeof accessor === 'function') {
    return accessor(row);
  }
  const val = row[accessor];
  return val !== null && val !== undefined ? String(val) : '';
}

export const Table = <T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No data available',
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  getRowId,
}: TableProps<T>) => {
  if (data.length === 0) {
    return (
      <div className="text-center text-xs text-on-surface-variant py-12 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft">
        {emptyMessage}
      </div>
    );
  }

  const actionsColIdx = columns.findIndex((col) => col.header === 'Actions');

  const getId = (row: T): string => {
    if (getRowId) return getRowId(row);
    return row.id || row._id || '';
  };

  const allRowIds = data.map(getId).filter(Boolean);
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedIds.includes(id));
  const someSelected = allRowIds.some((id) => selectedIds.includes(id)) && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectAll) return;
    if (allSelected) {
      onSelectAll([]);
    } else {
      onSelectAll(allRowIds);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/60 shadow-soft bg-surface-lowest">
      <table className="min-w-full text-xs border-collapse">
        <thead className="bg-surface-low border-b border-outline-variant/60">
          <tr>
            {selectable && (
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                  className="rounded border-outline-variant bg-surface-lowest accent-emerald-500 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                />
              </th>
            )}
            {columns.map((col, i) => {
              const isActions = i === actionsColIdx;
              return (
                <th
                  key={i}
                  className={`px-4 py-3 text-left font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] ${
                    isActions
                      ? 'sticky right-0 bg-surface-low shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.1)] z-10'
                      : ''
                  }`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/60">
          {data.map((row, idx) => {
            const rowId = getId(row);
            const isSelected = Boolean(rowId && selectedIds.includes(rowId));
            return (
              <tr
                key={rowId || idx}
                className={`hover:bg-surface-low/60 transition-colors ${
                  isSelected ? 'bg-emerald-500/10' : ''
                }`}
              >
                {selectable && (
                  <td
                    className="py-3 px-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect && onToggleSelect(rowId)}
                      aria-label={`Select row ${rowId}`}
                      className="rounded border-outline-variant bg-surface-lowest accent-emerald-500 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    />
                  </td>
                )}
                {columns.map((col, colIdx) => {
                  const isActions = colIdx === actionsColIdx;
                  return (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 text-on-surface whitespace-nowrap font-medium ${
                        isActions
                          ? 'sticky right-0 bg-surface-lowest group-hover:bg-surface-low shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.1)] z-10'
                          : ''
                      }`}
                    >
                      {getCellValue(row, col.accessor)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
