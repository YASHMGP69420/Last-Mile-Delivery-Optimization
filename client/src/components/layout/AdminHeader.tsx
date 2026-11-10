import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Route,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 select-none mb-6">
      {/* 1. Compact Top Workspace Bar (Navigation handled solely by AdminSidebar dock) */}
      <header className="glass-surface rounded-xl px-5 py-2.5 flex items-center justify-between gap-4 transition-colors sticky top-0 z-30">
        {/* Brand Logo & Role Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-obsidian-800 dark:border dark:border-obsidian-700 flex items-center justify-center text-primary dark:text-emerald-400">
            <Route className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base tracking-tight text-on-surface dark:text-white">
              Smart<span className="text-primary dark:text-emerald-400 font-bold">Route</span>
            </span>
            <span className="hidden sm:inline text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface-low dark:bg-obsidian-950 border border-outline-variant/50 dark:border-obsidian-750 text-on-surface-variant">
              {user?.role === 'ADMIN' ? 'Admin' : 'Fleet Operations'}
            </span>
          </div>
        </div>

        {/* Right Utility Cluster: Notifications & Incidents, Theme & Operator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/admin/notifications')}
            title="Alerts & Driver Incidents"
            aria-label="Open Alerts and Driver Incidents"
            className="spring-press flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-surface-low/80 dark:bg-obsidian-950/80 hover:bg-surface-container dark:hover:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750 text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white text-xs font-medium"
          >
            <Bell className="w-3.5 h-3.5 stroke-[2]" />
            <span className="hidden sm:inline">Alerts</span>
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
