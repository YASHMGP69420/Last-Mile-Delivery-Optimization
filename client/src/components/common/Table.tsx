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
}

function getCellValue<T extends Record<string, any>>(row: T, accessor: keyof T | ((row: T) => React.ReactNode)): React.ReactNode {
  if (typeof accessor === 'function') {
    return accessor(row);
  }
  const val = row[accessor];
  return val !== null && val !== undefined ? String(val) : '';
}

export const Table = <T extends Record<string, any>>({ columns, data, emptyMessage = 'No data available' }: TableProps<T>) => {
  if (data.length === 0) {
    return (
      <div className="text-center text-xs text-on-surface-variant py-12 bg-surface-lowest rounded-[24px] border border-outline-variant/60 shadow-soft">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-outline-variant/60 shadow-soft bg-surface-lowest">
      <table className="min-w-full text-xs border-collapse">
        <thead className="bg-surface-low border-b border-outline-variant/60">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-semibold text-on-surface-variant uppercase tracking-wider text-[11px]"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/60">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-surface-low/60 transition-colors">
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-4 py-3 text-on-surface whitespace-nowrap font-medium">
                  {getCellValue(row, col.accessor)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
