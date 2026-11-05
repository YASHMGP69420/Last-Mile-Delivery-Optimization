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
  MapPin,
  LogOut,
  ShieldCheck,
  Building,
  Sliders,
  DollarSign,
  Activity,
  FileText,
  Bell,
  Database,
  KeyRound,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const AdminSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const operationsNavItems = [
    { label: 'Deliveries Manifest', path: '/admin/deliveries', icon: Package, badge: 'M1' },
    { label: 'Operational Batches', path: '/admin/batches', icon: Layers, badge: 'M1' },
    { label: 'Fleets', path: '/admin/fleets', icon: Truck },
    { label: 'Drivers', path: '/admin/drivers', icon: Users },
    { label: 'Route Optimizer', path: '/admin/optimizer', icon: Route, badge: 'M2' },
    { label: 'Live Telemetry', path: '/admin/tracking', icon: Navigation },
    { label: 'Operations Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  const adminControlNavItems = [
    { label: 'Admin Overview', path: '/admin/control-center', icon: ShieldCheck, badge: 'ROOT' },
    { label: 'Users & Access', path: '/admin/users', icon: KeyRound },
    { label: 'Roles & Permissions', path: '/admin/permissions', icon: Sliders },
    { label: 'Organization & Depots', path: '/admin/organization', icon: Building },
    { label: 'Fleet Control', path: '/admin/fleet-control', icon: Wrench },
    { label: 'Operations Oversight', path: '/admin/operations', icon: AlertTriangle },
    { label: 'Optimization Engine', path: '/admin/optimization-settings', icon: Sliders },
    { label: 'Fuel & Tariffs', path: '/admin/fuel-settings', icon: DollarSign },
    { label: 'Integrations & APIs', path: '/admin/integrations', icon: Activity },
    { label: 'System Audit Logs', path: '/admin/audit-logs', icon: FileText },
    { label: 'System Alerts', path: '/admin/notifications', icon: Bell },
    { label: 'Data Management', path: '/admin/data-management', icon: Database },
  ];

  return (
    <aside className="w-64 bg-primary text-white flex flex-col shrink-0 h-screen border-r border-primary-hover select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-primary-hover/50">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-white shadow-md">
          <Route className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight text-white block leading-tight">
            SmartRoute
          </span>
          <span className="text-[11px] font-medium text-slate-400 block tracking-wider uppercase">
            {isAdmin ? 'Admin Control Center' : 'Last-Mile Logistics'}
          </span>
        </div>
      </div>

      {/* Operational Hub Indicator */}
      <div className="px-4 py-3 mx-3 my-3 bg-primary-hover/60 rounded-lg border border-primary-hover flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="truncate">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Active Hub
            </span>
            <span className="text-xs font-medium text-slate-200 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-secondary" /> Rasulgarh, BBSR
            </span>
          </div>
        </div>
        <span className="text-[10px] bg-secondary/20 text-blue-300 px-1.5 py-0.5 rounded font-mono font-medium">
          20.29°N
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Operations Section */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Operations
          </div>
          <div className="space-y-0.5">
            {operationsNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group',
                      isActive
                        ? 'bg-secondary text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:bg-primary-hover hover:text-white'
                    )
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Exclusive Super Admin Section */}
        {isAdmin && (
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>Admin Control Center</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono">SUPER</span>
            </div>
            <div className="space-y-0.5">
              {adminControlNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all group',
                        isActive
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-300 hover:bg-primary-hover hover:text-white'
                      )
                    }
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-105" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] bg-white/10 px-1 py-0.5 rounded font-mono text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-primary-hover/50 bg-primary/80">
        <div className="flex items-center justify-between p-2 rounded-lg bg-primary-hover/40 border border-primary-hover">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
              {user?.name?.slice(0, 2) || 'OP'}
            </div>
            <div className="truncate">
              <span className="text-xs font-semibold text-white block truncate">
                {user?.name || 'Dispatcher'}
              </span>
              <span className="text-[10px] text-slate-400 block uppercase font-mono">
                {user?.role || 'FLEET_MANAGER'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
