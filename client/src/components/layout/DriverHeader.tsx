import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Route, X, AlertTriangle, CheckCircle2, Info, Bell, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDriverSocketContext } from '../../context/DriverSocketContext';

export const DriverHeader: React.FC = () => {
  const { user } = useAuth();
  const {
    lastNotification,
    clearNotification,
    notifications,
    unreadCount,
    markNotificationRead,
  } = useDriverSocketContext();
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  return (
    <header className="glass-surface border-b border-outline-variant/70 shrink-0 select-none z-20 relative">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2">
        {/* Left: App Branding & Cockpit Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-xs">
            <Route className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs text-on-surface block leading-tight">SmartRoute</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-on-surface-variant block font-medium truncate">
                Driver Cockpit
              </span>
              {user?.isDemoData && (
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                  DEMO
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Inbox Bell & Profile Link */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dispatch Notifications Bell */}
          <button
            type="button"
            onClick={() => setIsInboxOpen((prev) => !prev)}
            aria-label="Open dispatch notifications inbox"
            aria-expanded={isInboxOpen}
            className="spring-press relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-on-surface-muted hover:text-primary hover:bg-surface-low transition-colors"
            title="Dispatch Messages"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Driver Profile Link (Theme toggle & Logout are in Profile) */}
          <Link
            to="/driver/profile"
            aria-label="Open driver profile"
            className="text-xs font-semibold text-on-surface hover:text-primary px-2.5 py-1.5 rounded-lg bg-surface-low border border-outline-variant max-w-[120px] sm:max-w-[160px] truncate transition-colors min-h-[36px] flex items-center"
            title="Driver Profile & Settings"
          >
            <span className="truncate">{user?.name || 'Driver'}</span>
          </Link>
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-surface-low text-on-surface-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-4 text-center">No dispatch notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 15).map((n) => (
                <div
                  key={n.id}
                  className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                    n.read
                      ? 'bg-surface-low/60 border-outline-variant/40 opacity-75'
                      : 'bg-primary/5 border-primary/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-on-surface">{n.title}</span>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0 min-h-[36px] px-2 py-1 rounded-md hover:bg-primary/10"
                        title="Acknowledge & mark read"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark read
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant break-words">{n.message}</p>
                  <span className="text-[10px] font-mono text-on-surface-muted block">
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
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : lastNotification.type === 'ROUTE_DISPATCHED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            {lastNotification.type === 'ROUTE_DISPATCHED' ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            ) : lastNotification.severity === 'WARNING' || lastNotification.type === 'MESSAGE' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs leading-snug min-w-0">
              <p className="font-bold text-xs uppercase tracking-wide">
                {lastNotification.title}
              </p>
              <p className="text-xs opacity-90 break-words">{lastNotification.message}</p>
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-on-surface-variant shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
