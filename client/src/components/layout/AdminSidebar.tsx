import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package,
  Layers,
  Truck,
  Users,
  Route,
  Navigation,
  BarChart3,
  LogOut,
  ShieldCheck,
  FileText,
  Bell,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const AdminSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [isExpanded, setIsExpanded] = useState(false);

  // Primary launcher & core views
  const primaryNav = [
    { label: 'Control Center', path: '/admin/control-center', icon: ShieldCheck },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Deliveries', path: '/admin/deliveries', icon: Package },
    { label: 'Dispatch Batches', path: '/admin/batches', icon: Layers },
  ];

  // Operations & telemetry views
  const operationsNav = [
    { label: 'Route Optimizer', path: '/admin/optimizer', icon: Route },
    { label: 'Live Telemetry', path: '/admin/tracking', icon: Navigation },
    { label: 'Fleet Vehicles', path: '/admin/fleets', icon: Truck },
    { label: 'Drivers Roster', path: '/admin/drivers', icon: Users },
  ];

  // Secondary & alert views
  const secondaryNav = [
    { label: 'Alerts & Incidents', path: '/admin/notifications', icon: Bell },
    ...(isAdmin
      ? [
          { label: 'User Management', path: '/admin/users', icon: UserCog },
          { label: 'Audit Trail', path: '/admin/audit-logs', icon: FileText },
        ]
      : []),
  ];

  const renderIconLink = (item: { label: string; path: string; icon: any }) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={item.label}
        aria-label={item.label}
        className={({ isActive }) =>
          clsx(
            'spring-press h-10 w-full shrink-0 rounded-xl flex items-center px-2.5 group relative transition-colors duration-150',
            isActive
              ? 'bg-primary text-white font-medium shadow-xs'
              : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-100 hover:bg-surface-container/70 dark:hover:bg-obsidian-800'
          )
        }
      >
        <span className="w-5 h-5 shrink-0 flex items-center justify-center">
          <Icon className="w-[18px] h-[18px] stroke-[1.9]" />
        </span>
        <span
          className={clsx(
            'whitespace-nowrap text-xs font-medium tracking-wide truncate transition-all duration-200 overflow-hidden',
            isExpanded
              ? 'opacity-100 max-w-[170px] ml-3'
              : 'opacity-0 max-w-0 ml-0 pointer-events-none'
          )}
        >
          {item.label}
        </span>
        {/* Floating tooltip only when sidebar is retracted */}
        {!isExpanded && (
          <span className="absolute left-14 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-100 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
            {item.label}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="relative w-[60px] h-full shrink-0 z-40">
      <aside
        data-testid="admin-sidebar"
        aria-label="Operations Navigation"
        aria-expanded={isExpanded}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onFocus={() => setIsExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsExpanded(false);
          }
        }}
        className={clsx(
          'glass-surface absolute top-0 left-0 h-full flex flex-col py-3 px-2.5 select-none rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden',
          'dark:bg-obsidian-900/95 dark:border-obsidian-750 bg-white/95 backdrop-blur-xl',
          isExpanded ? 'w-60 shadow-2xl z-50' : 'w-[60px] shadow-xs z-30'
        )}
      >
        {/* Scrollable Navigation Groups: Uniform 8px vertical rhythm */}
        <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-center">
          <div className="flex flex-col items-center gap-2 w-full">
            {primaryNav.map(renderIconLink)}
          </div>

          <div
            className={clsx(
              'h-px bg-outline-variant dark:bg-obsidian-750 shrink-0 my-2.5 transition-all duration-300',
              isExpanded ? 'w-full' : 'w-7'
            )}
          />

          <div className="flex flex-col items-center gap-2 w-full">
            {operationsNav.map(renderIconLink)}
          </div>
        </div>

        {/* Bottom Footer Utilities: Uniform 8px rhythm & symmetric divider clearance */}
        <div className="w-full shrink-0 pt-2.5 mt-2 border-t border-outline-variant dark:border-obsidian-750 flex flex-col items-center gap-2">
          {secondaryNav.map(renderIconLink)}

          {/* Sign Out Action */}
          <button
            onClick={logout}
            title="Sign Out"
            aria-label="Sign Out"
            className="spring-press h-10 w-full shrink-0 rounded-xl flex items-center px-2.5 text-on-surface-variant dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-rose-400 transition-colors group relative"
          >
            <span className="w-5 h-5 shrink-0 flex items-center justify-center">
              <LogOut className="w-[18px] h-[18px] stroke-[1.9]" />
            </span>
            <span
              className={clsx(
                'whitespace-nowrap text-xs font-medium tracking-wide truncate transition-all duration-200 overflow-hidden',
                isExpanded
                  ? 'opacity-100 max-w-[170px] ml-3'
                  : 'opacity-0 max-w-0 ml-0 pointer-events-none'
              )}
            >
              Sign Out
            </span>
            {!isExpanded && (
              <span className="absolute left-14 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-100 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
};
