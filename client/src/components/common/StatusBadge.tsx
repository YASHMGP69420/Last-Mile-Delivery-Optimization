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
        return 'bg-surface-elevated text-on-surface-variant border-outline-variant';
      case 'READY':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-[#7D9CFF] dark:border-[#7D9CFF]/30';
      case 'ASSIGNED':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-400 dark:border-teal-500/30';
      case 'OUT_FOR_DELIVERY':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-[#E9B75C] dark:border-[#E9B75C]/30 font-medium';
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-[#45C58A] dark:border-[#45C58A]/30';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-[#F06B79] dark:border-[#F06B79]/30';

      // Priorities
      case 'Standard':
        return 'bg-surface-elevated text-on-surface-variant border-outline-variant';
      case 'Urgent':
        return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-[#E9B75C] dark:border-[#E9B75C]/30 font-semibold';
      case 'Cold Chain':
        return 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30 font-semibold';

      // Fleet
      case 'AVAILABLE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-[#45C58A] dark:border-[#45C58A]/30';
      case 'IN_TRANSIT':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-[#7D9CFF] dark:border-[#7D9CFF]/30';
      case 'MAINTENANCE':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-[#E9B75C] dark:border-[#E9B75C]/30';
      case 'RETIRED':
        return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700';

      default:
        return 'bg-surface-elevated text-on-surface-variant border-outline-variant';
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
          ['COMPLETED', 'AVAILABLE'].includes(safeStatus) && 'bg-[#45C58A]',
          ['OUT_FOR_DELIVERY', 'Urgent'].includes(safeStatus) && 'bg-[#E9B75C]',
          ['FAILED', 'RETIRED'].includes(safeStatus) && 'bg-[#F06B79]',
          ['READY', 'ASSIGNED', 'IN_TRANSIT'].includes(safeStatus) && 'bg-[#7D9CFF]',
          ['DRAFT', 'Standard'].includes(safeStatus) && 'bg-[#858397]',
          safeStatus === 'Cold Chain' && 'bg-cyan-400'
        )}
      />
      {formattedStatus}
    </span>
  );
};
