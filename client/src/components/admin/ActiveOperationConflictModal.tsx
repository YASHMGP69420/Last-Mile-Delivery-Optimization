import React from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, CheckCircle2, Truck, RefreshCw } from 'lucide-react';
import { Modal } from '../common/Modal';

export interface ActiveOperationConflictDetails {
  routeId?: string | null;
  routeCode?: string | null;
  activeDeliveryCount: number;
  driverName?: string | null;
}

export interface ActiveOperationConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ActiveOperationConflictDetails | null;
  onConfirmReassignAndDelete: () => Promise<void>;
  isSubmitting?: boolean;
}

export const ActiveOperationConflictModal: React.FC<ActiveOperationConflictModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onConfirmReassignAndDelete,
  isSubmitting = false,
}) => {
  if (!conflict) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Active Operation Conflict"
      subtitle="Driver has in-transit operational commitments"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmReassignAndDelete}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Rescuing Orders & Deleting...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Reassign Active Orders & Delete
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-rose-900 dark:text-rose-200">
              Cannot delete driver with active in-transit operations
            </h4>
            <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">
              This driver is currently assigned to an active route. Standard deletion is blocked to prevent orphaned or stranded consignments.
            </p>
          </div>
        </div>

        {/* Operational details card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Driver</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {conflict.driverName || 'Unknown Driver'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Active Route</span>
            <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
              {conflict.routeCode || conflict.routeId || 'N/A'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Active Deliveries</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              <span className="font-bold">{conflict.activeDeliveryCount}</span> active deliveries
            </span>
          </div>
        </div>

        {/* Cascade Mitigation Summary */}
        <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
          <h5 className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Automated Cascade Protections (D-01, D-02, D-03)
          </h5>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>{conflict.activeDeliveryCount}</strong> active consignments will be <strong>rescued to READY pool</strong> with <strong>Urgent priority</strong> for immediate re-dispatch.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Completed POD signatures and audit trails preserved</strong> intact for finished delivery stops.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Vehicle reservation released</strong> and driver shifts force-closed cleanly.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
