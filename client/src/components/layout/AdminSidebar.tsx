import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Package,
  Layers,
  Truck,
  Route,
  Navigation,
  BarChart3,
  MapPin,
  LogOut,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const AdminSidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Deliveries Manifest', path: '/admin/deliveries', icon: Package, badge: 'M1' },
    { label: 'Operational Batches', path: '/admin/batches', icon: Layers, badge: 'M1' },
    { label: 'Fleet & Drivers', path: '/admin/fleet', icon: Truck },
    { label: 'Route Optimizer', path: '/admin/optimizer', icon: Route, badge: 'M2' },
    { label: 'Live Telemetry', path: '/admin/tracking', icon: Navigation },
    { label: 'Operations Analytics', path: '/admin/analytics', icon: BarChart3 },
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
            Last-Mile Logistics
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
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Operations
        </div>
        {navItems.map((item) => {
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
              <div className="flex items-center gap-3">
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
