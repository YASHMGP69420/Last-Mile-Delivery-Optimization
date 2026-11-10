import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Route, LogOut, WifiOff, X, AlertTriangle, CheckCircle2, Info, Bell, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { ThemeToggle } from '../common/ThemeToggle';

export const DriverHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    connectionStatus,
    lastNotification,
    clearNotification,
    notifications,
    unreadCount,
    markNotificationRead,
  } = useDriverSocketContext();
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  return (
    <header className="glass-surface border-b border-outline-variant/70 shrink-0 select-none z-20 relative">
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

        {/* Center: Honest Socket Connection Indicator */}
        <div className="flex items-center" aria-live="polite">
          {connectionStatus === 'connected' ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>Connected</span>
            </div>
          ) : connectionStatus === 'reconnecting' ? (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-medium" role="status">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              <span>Reconnecting...</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-medium" role="status">
              <WifiOff className="w-3 h-3 text-red-500" aria-hidden="true" />
              <span>Offline</span>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsInboxOpen((prev) => !prev)}
            aria-label="Open dispatch notifications inbox"
            aria-expanded={isInboxOpen}
            className="spring-press relative p-1.5 rounded-lg text-on-surface-muted hover:text-primary hover:bg-surface-low transition-colors"
            title="Dispatch Messages"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <Link
            to="/driver/profile"
            aria-label="Open driver profile"
            className="text-xs font-semibold text-on-surface hover:text-primary px-2 py-1 rounded-lg bg-surface-low border border-outline-variant max-w-[84px] truncate transition-colors"
          >
            {user?.name || 'Driver'}
          </Link>

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

      {/* Persisted Dispatch Notification Inbox Dropdown */}
      {isInboxOpen && (
        <div className="glass-floating absolute right-3 top-14 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl p-3 z-50 space-y-2 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-mono">
              Dispatch Inbox ({unreadCount} unread)
            </span>
            <button
              type="button"
              onClick={() => setIsInboxOpen(false)}
              aria-label="Close notifications inbox"
              className="p-1 rounded-md hover:bg-surface-low text-on-surface-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4 text-center">No dispatch notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                    n.read
                      ? 'bg-surface-low/60 border-outline-variant/40 opacity-75'
                      : 'bg-primary/5 border-primary/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[11px] text-on-surface">{n.title}</span>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                        title="Acknowledge & mark read"
                      >
                        <Check className="w-3 h-3" /> Read
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant break-words">{n.message}</p>
                  <span className="text-[9px] font-mono text-on-surface-muted block">
                    {new Date(n.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            onClick={() => {
              if (lastNotification.id && !lastNotification.id.startsWith('disp-') && !lastNotification.id.startsWith('reord-')) {
                markNotificationRead(lastNotification.id);
              } else {
                clearNotification();
              }
            }}
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
