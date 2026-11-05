import React from 'react';
import { clsx } from 'clsx';
import { DeliveryStatus, DeliveryPriority, VehicleStatus } from '../../types';

interface StatusBadgeProps {
  status: DeliveryStatus | DeliveryPriority | VehicleStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const safeStatus = typeof status === 'string' ? status : String(status || '');

  const getBadgeStyle = (val: string) => {
    switch (val) {
      // Delivery Statuses
      case 'DRAFT':
        return 'bg-surface-container text-on-surface-variant border-outline-variant';
      case 'READY':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ASSIGNED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';

      // Priorities
      case 'Standard':
        return 'bg-surface-low text-on-surface-variant border-outline-variant';
      case 'Urgent':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
      case 'Cold Chain':
        return 'bg-cyan-50 text-cyan-800 border-cyan-300 font-semibold';

      // Fleet
      case 'AVAILABLE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN_TRANSIT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'MAINTENANCE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'RETIRED':
        return 'bg-gray-100 text-gray-500 border-gray-200';

      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant';
    }
  };

  const formattedStatus = safeStatus.replace(/_/g, ' ');

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        getBadgeStyle(safeStatus),
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          ['COMPLETED', 'AVAILABLE'].includes(safeStatus) && 'bg-emerald-500',
          ['OUT_FOR_DELIVERY', 'Urgent'].includes(safeStatus) && 'bg-amber-500',
          ['FAILED', 'RETIRED'].includes(safeStatus) && 'bg-red-500',
          ['READY', 'ASSIGNED', 'IN_TRANSIT'].includes(safeStatus) && 'bg-blue-500',
          ['DRAFT', 'Standard'].includes(safeStatus) && 'bg-gray-400',
          safeStatus === 'Cold Chain' && 'bg-cyan-500'
        )}
      />
      {formattedStatus}
    </span>
  );
};
