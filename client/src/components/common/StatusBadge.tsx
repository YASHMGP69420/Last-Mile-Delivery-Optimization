import React from 'react';
import { clsx } from 'clsx';
import { DeliveryStatus, DeliveryPriority, VehicleStatus } from '../../types';

interface StatusBadgeProps {
  status: DeliveryStatus | DeliveryPriority | VehicleStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const safeStatus = typeof status === 'string' ? status : String(status || '');

  const getLeftStripeStyle = (val: string) => {
    switch (val) {
      case 'COMPLETED':
      case 'AVAILABLE':
        return 'border-l-primary text-on-surface dark:text-zinc-100';
      case 'OUT_FOR_DELIVERY':
      case 'Urgent':
      case 'MAINTENANCE':
        return 'border-l-amber-500 text-on-surface dark:text-amber-200 font-semibold';
      case 'Cold Chain':
        return 'border-l-sky-400 text-on-surface dark:text-sky-200 font-semibold';
      case 'READY':
      case 'ASSIGNED':
      case 'IN_TRANSIT':
      case 'ON_DUTY':
        return 'border-l-blue-400 text-on-surface dark:text-zinc-100';
      case 'FAILED':
      case 'RETIRED':
        return 'border-l-rose-500 text-on-surface dark:text-rose-200';
      case 'DRAFT':
      case 'Standard':
      default:
        return 'border-l-zinc-400 dark:border-l-zinc-500 text-on-surface-variant dark:text-zinc-300';
    }
  };

  const formattedStatus = safeStatus.replace(/_/g, ' ');

  return (
    <span
      className={clsx(
        'inline-flex items-center font-mono uppercase tracking-wider rounded-[4px] border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px]',
        getLeftStripeStyle(safeStatus),
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
      )}
    >
      {formattedStatus}
    </span>
  );
};
