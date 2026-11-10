import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Route,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { clsx } from 'clsx';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const navTabs = [
    { label: 'Dashboard', path: '/admin/control-center' },
    { label: 'Routes', path: '/admin/optimizer' },
    { label: 'Deliveries', path: '/admin/deliveries' },
    { label: 'Batches', path: '/admin/batches' },
    { label: 'Fleet', path: '/admin/fleets' },
    { label: 'Analytics', path: '/admin/analytics' },
  ];

  return (
    <div className="space-y-4 select-none mb-6">
      {/* 1. Top Enterprise Navigation Bar */}
      <header className="glass-surface rounded-xl px-5 py-2.5 flex items-center justify-between gap-4 transition-colors sticky top-0 z-30">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-obsidian-800 dark:border dark:border-obsidian-700 flex items-center justify-center text-primary dark:text-emerald-400">
            <Route className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="font-semibold text-base tracking-tight text-on-surface dark:text-white">
            Smart<span className="text-primary dark:text-emerald-400 font-bold">Route</span>
          </span>
        </div>

        {/* Center Segmented Navigation Menu */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-low/80 dark:bg-obsidian-950/70 p-1 rounded-lg border border-outline-variant/40 dark:border-obsidian-750">
          {navTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                clsx(
                  'spring-press px-3.5 py-1.5 rounded-md text-xs font-medium',
                  isActive
                    ? 'bg-primary text-white font-semibold shadow-xs'
                    : 'text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white hover:bg-surface-lowest/70 dark:hover:bg-obsidian-800'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Utility Cluster: Notifications, Theme & Operator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/admin/notifications')}
            title="System Alerts & Operational Notifications"
            aria-label="System Alerts & Operational Notifications"
            className="spring-press w-8 h-8 rounded-lg bg-surface-low/80 dark:bg-obsidian-950/80 hover:bg-surface-container dark:hover:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-center text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white"
          >
            <Bell className="w-4 h-4 stroke-[2]" />
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {user?.name && (
            <span className="text-xs font-medium text-on-surface-variant dark:text-slate-300 hidden sm:inline pl-1">
              {user.name}
            </span>
          )}
        </div>
      </header>

      {/* 2. Operations Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0.5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-on-surface dark:text-white tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5 font-normal">
              {subtitle}
            </p>
          )}
        </div>

        {/* Page specific action buttons slot */}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
