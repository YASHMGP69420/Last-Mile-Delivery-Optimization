import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';

export interface MishapAlertPayload {
  routeId?: string;
  routeCode?: string;
  driverId?: string;
  rescuedCount?: number;
  reason?: string;
  timestamp?: string;
}

export interface MishapAlertBannerProps {
  alert: MishapAlertPayload;
  onDismiss: () => void;
}

export const MishapAlertBanner: React.FC<MishapAlertBannerProps> = ({ alert, onDismiss }) => {
  const navigate = useNavigate();

  const count = alert.rescuedCount ?? 1;
  const routeIdentifier = alert.routeCode || alert.routeId || 'Active Route';

  const handleNavigateToDeliveries = () => {
    navigate('/admin/deliveries?status=READY&priority=Urgent');
  };

  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-2xl border border-rose-300/80 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/50 backdrop-blur-md p-4 shadow-lg shadow-rose-950/5 transition-colors animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                In-Transit Mishap Alert
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-200/80 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                Cascade Triggered
              </span>
            </div>
            <p className="text-sm font-medium text-rose-950 dark:text-rose-100 mt-0.5">
              Route <span className="font-mono font-semibold">{routeIdentifier}</span> cancelled due to driver mishap / cascade recovery.
              {' '}
              <span className="font-semibold">{count} {count === 1 ? 'consignment' : 'consignments'}</span> returned to <span className="underline decoration-rose-400 underline-offset-2">READY pool with Urgent priority</span>.
            </p>
            {alert.reason && (
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-1 italic">
                Reason: {alert.reason}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleNavigateToDeliveries}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-sm transition-colors focus:ring-2 focus:ring-rose-500/20"
          >
            <span>View Dispatch Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss mishap alert"
            className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-200/50 dark:hover:bg-rose-900/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
