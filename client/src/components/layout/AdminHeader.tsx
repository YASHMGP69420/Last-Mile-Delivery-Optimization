import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Route,
  Search,
  Bell,
  Calendar,
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
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navTabs = [
    { label: 'Dashboard', path: '/admin/control-center' },
    { label: 'Routes', path: '/admin/optimizer' },
    { label: 'Deliveries', path: '/admin/deliveries' },
    { label: 'Batches', path: '/admin/batches' },
    { label: 'Fleet', path: '/admin/fleets' },
    { label: 'Analytics', path: '/admin/analytics' },
  ];

  // If the title is generic or Control Center, show the warm greeting
  const isGreetingView =
    title.toLowerCase().includes('control center') ||
    title.toLowerCase().includes('dashboard') ||
    title.toLowerCase().includes('overview');

  const displayName = user?.name
    ? user.name.split(' ')[0]
    : user?.role === 'FLEET_MANAGER'
    ? 'Fleet Manager'
    : 'Operations Lead';

  return (
    <div className="space-y-4 select-none mb-6">
      {/* 1. Top Enterprise Navigation Bar */}
      <header className="bg-surface-lowest dark:bg-obsidian-900 rounded-xl px-5 py-2.5 border border-outline-variant/60 dark:border-obsidian-750 flex items-center justify-between gap-4 transition-colors">
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
        <nav className="hidden md:flex items-center gap-1 bg-surface-low dark:bg-obsidian-950 p-1 rounded-lg border border-outline-variant/40 dark:border-obsidian-750">
          {navTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                clsx(
                  'px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white font-semibold'
                    : 'text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white hover:bg-surface-lowest/70 dark:hover:bg-obsidian-800'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Utility Cluster: Search, Notifications, Theme & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/admin/deliveries')}
            title="Search Deliveries & Manifest"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-low dark:bg-obsidian-950 hover:bg-surface-container dark:hover:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750 text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-white text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5 stroke-[2]" />
            <span className="text-[11px]">Search manifest...</span>
          </button>

          <button
            onClick={() => navigate('/admin/deliveries')}
            title="Search Deliveries & Manifest"
            className="sm:hidden w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-950 hover:bg-surface-container dark:hover:bg-obsidian-850 flex items-center justify-center text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white transition-colors"
          >
            <Search className="w-4 h-4 stroke-[2]" />
          </button>

          <button
            onClick={() => navigate('/admin/notifications')}
            title="System Alerts & Operational Notifications"
            className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-950 hover:bg-surface-container dark:hover:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-center text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white transition-colors relative"
          >
            <Bell className="w-4 h-4 stroke-[2]" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-8 h-8 rounded-lg bg-obsidian-800 border border-obsidian-700 text-emerald-300 flex items-center justify-center font-semibold text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SR'}
            </div>
          </div>
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

        {/* Right Action Tools: Date Badge & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dispatch Date Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-lowest dark:bg-obsidian-950 rounded-lg border border-outline-variant/60 dark:border-obsidian-750 text-xs font-mono text-on-surface dark:text-slate-300 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-on-surface-variant dark:text-slate-400" />
            <span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="text-outline-variant dark:text-obsidian-750">•</span>
            <span className="font-mono text-on-surface-variant dark:text-slate-400">{time || 'IST'}</span>
          </div>

          {/* Page specific action buttons slot */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
};
