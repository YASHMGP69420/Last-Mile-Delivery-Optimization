import React from 'react';
import { Route, LogOut, Wifi, WifiOff, Bell, X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { ThemeToggle } from '../common/ThemeToggle';

export const DriverHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { connectionStatus, lastNotification, clearNotification } = useDriverSocketContext();

  return (
    <header className="bg-surface-lowest border-b border-outline-variant shrink-0 select-none z-20">
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Route className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="font-semibold text-xs text-on-surface block leading-tight">SmartRoute</span>
            <span className="text-[10px] text-on-surface-muted block font-mono">
              Driver Cockpit
            </span>
          </div>
        </div>

        {/* Center: Connection Status Badge */}
        <div className="flex items-center" aria-live="polite">
          {connectionStatus === 'connected' ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>Live Sync</span>
            </div>
          ) : connectionStatus === 'reconnecting' ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-medium" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              <span>Reconnecting...</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-medium" role="status">
              <WifiOff className="w-3 h-3 text-red-500" aria-hidden="true" />
              <span>Offline Mode</span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface px-2 py-0.5 rounded-lg bg-surface-low border border-outline-variant max-w-[80px] truncate">
            {user?.name || 'Driver'}
          </span>

          <ThemeToggle />

          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out of driver account"
            className="p-1.5 text-on-surface-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-Time Dispatch Alert Banner */}
      {lastNotification && (
        <div
          className={`px-3 py-2 border-t flex items-start justify-between gap-2.5 transition-all animate-fadeIn ${
            lastNotification.severity === 'WARNING' || lastNotification.type === 'MESSAGE'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : lastNotification.type === 'ROUTE_DISPATCHED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {lastNotification.type === 'ROUTE_DISPATCHED' ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            ) : lastNotification.severity === 'WARNING' || lastNotification.type === 'MESSAGE' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs leading-snug min-w-0">
              <p className="font-bold text-[11px] uppercase tracking-wide">
                {lastNotification.title}
              </p>
              <p className="text-[11px] opacity-90 break-words">{lastNotification.message}</p>
            </div>
          </div>
          <button
            onClick={clearNotification}
            className="p-1 rounded-md hover:bg-black/10 text-on-surface-variant shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
