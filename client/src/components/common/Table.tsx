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
      <div className="text-center text-sm text-gray-500 py-8">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant">
      <table className="min-w-full">
        <thead className="bg-surface-low">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-surface-low/50 transition-colors">
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-4 py-3 text-sm text-on-surface whitespace-nowrap">
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
