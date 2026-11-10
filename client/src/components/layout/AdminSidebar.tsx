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

  // Secondary & configuration views
  const secondaryNav = [
    { label: 'Audit Trail', path: '/admin/audit-logs', icon: FileText },
    { label: 'System Alerts', path: '/admin/notifications', icon: Bell },
    ...(isAdmin ? [{ label: 'Policy & Permissions', path: '/admin/permissions', icon: Sliders }] : []),
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
            'spring-press w-9 h-9 rounded-lg flex items-center justify-center group relative',
            isActive
              ? 'bg-primary text-white font-medium shadow-xs'
              : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200 hover:bg-surface-low dark:hover:bg-obsidian-850'
          )
        }
      >
        <Icon className="w-4 h-4 stroke-[2]" />
        {/* Floating tooltip */}
        <span className="absolute left-12 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-200 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <aside className="glass-surface w-14 shrink-0 flex flex-col items-center justify-between py-3 select-none z-30 rounded-xl transition-colors">
      {/* Top Section: Main Navigation Items */}
      <div className="flex flex-col items-center space-y-2 w-full px-1.5">
        {/* Primary nav buttons */}
        <div className="flex flex-col items-center space-y-1.5">
          {primaryNav.map(renderIconLink)}
        </div>

        <div className="w-8 h-[1px] bg-outline-variant/60 dark:bg-obsidian-750 my-0.5" />

        {/* Operations nav buttons */}
        <div className="flex flex-col items-center space-y-1.5">
          {operationsNav.map(renderIconLink)}
        </div>
      </div>

      {/* Bottom Section: Secondary Tools & Sign Out */}
      <div className="flex flex-col items-center space-y-1.5 w-full px-2 pt-2 border-t border-outline-variant/60 dark:border-obsidian-750">
        {secondaryNav.map(renderIconLink)}

        {/* Sign Out Action */}
        <button
          onClick={logout}
          title="Sign Out"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-rose-400 transition-colors group relative"
        >
          <LogOut className="w-4 h-4 stroke-[2]" />
          <span className="absolute left-12 px-2.5 py-1 bg-slate-900 dark:bg-obsidian-850 text-white dark:text-slate-200 text-[11px] font-medium rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border border-slate-700 dark:border-obsidian-700">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
};
