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
  LayoutGrid,
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
        className={({ isActive }) =>
          clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
            isActive
              ? 'bg-primary text-white shadow-emerald font-semibold scale-105'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-low'
          )
        }
      >
        <Icon className="w-4 h-4 stroke-[2]" />
        {/* Floating tooltip */}
        <span className="absolute left-14 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <aside className="w-16 shrink-0 flex flex-col items-center justify-between py-3 select-none z-30 bg-surface-lowest rounded-2xl border border-outline-variant/60 shadow-soft transition-colors">
      {/* Top Section: Main Navigation Items */}
      <div className="flex flex-col items-center space-y-2.5 w-full px-2">
        {/* Brand Grid Launcher */}
        <NavLink
          to="/admin/control-center"
          title="SmartRoute Operations Dashboard"
          className={({ isActive }) =>
            clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
              isActive
                ? 'bg-primary text-white shadow-emerald'
                : 'bg-primary/10 hover:bg-primary/20 text-primary'
            )
          }
        >
          <LayoutGrid className="w-4 h-4 stroke-[2.2]" />
        </NavLink>

        <div className="w-8 h-[1px] bg-outline-variant/60 my-0.5" />

        {/* Primary nav buttons */}
        <div className="flex flex-col items-center space-y-1.5">
          {primaryNav.map(renderIconLink)}
        </div>

        <div className="w-8 h-[1px] bg-outline-variant/60 my-0.5" />

        {/* Operations nav buttons */}
        <div className="flex flex-col items-center space-y-1.5">
          {operationsNav.map(renderIconLink)}
        </div>
      </div>

      {/* Bottom Section: Secondary Tools & Sign Out */}
      <div className="flex flex-col items-center space-y-1.5 w-full px-2 pt-2 border-t border-outline-variant/60">
        {secondaryNav.map(renderIconLink)}

        {/* Sign Out Action */}
        <button
          onClick={logout}
          title="Sign Out"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-red-500 hover:bg-red-50 transition-all duration-200 group relative"
        >
          <LogOut className="w-4 h-4 stroke-[2]" />
          <span className="absolute left-14 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
};
