import React from 'react';
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
  Sliders,
  DollarSign,
  FileText,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const AdminSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

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
    ...(isAdmin ? [{ label: 'Audit Trail', path: '/admin/audit-logs', icon: FileText }] : []),
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
            'spring-press w-10 h-10 shrink-0 rounded-xl flex items-center justify-center group relative mx-auto',
            isActive
              ? 'bg-primary text-white font-medium shadow-xs'
              : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-100 hover:bg-surface-container/70 dark:hover:bg-obsidian-800'
          )
        }
      >
        <Icon className="w-[18px] h-[18px] stroke-[1.9]" />
        {/* Floating tooltip */}
        <span className="absolute left-14 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-100 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <aside className="glass-surface w-[60px] h-full shrink-0 flex flex-col items-center py-3 px-2 select-none z-30 rounded-xl transition-colors">
      {/* Scrollable Navigation Groups: Uniform 8px vertical rhythm */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col items-center">
        <div className="flex flex-col items-center gap-2 w-full">
          {primaryNav.map(renderIconLink)}
        </div>

        <div className="w-7 h-px bg-outline-variant dark:bg-obsidian-750 shrink-0 my-2.5" />

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
          className="spring-press w-10 h-10 shrink-0 rounded-xl flex items-center justify-center mx-auto text-on-surface-variant dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-rose-400 transition-colors group relative"
        >
          <LogOut className="w-[18px] h-[18px] stroke-[1.9]" />
          <span className="absolute left-14 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-100 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
};
