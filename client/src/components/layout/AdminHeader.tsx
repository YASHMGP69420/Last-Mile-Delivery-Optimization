import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Route,
  Search,
  Bell,
  Calendar,
  ChevronDown,
  Sparkles,
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
    <div className="space-y-5 select-none mb-6">
      {/* 1. Top Floating Capsule Navigation Bar */}
      <header className="bg-surface-lowest rounded-3xl lg:rounded-full px-5 lg:px-7 py-3 shadow-soft border border-outline-variant/60 flex items-center justify-between gap-4 transition-colors">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white shadow-emerald">
            <Route className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-bold text-lg tracking-tight text-on-surface">
            Smart<span className="text-primary font-extrabold">Route</span>
          </span>
        </div>

        {/* Center Segmented Pill Menu */}
        <nav className="hidden md:flex items-center gap-1.5 bg-surface-low/80 p-1.5 rounded-full border border-outline-variant/50 backdrop-blur-sm">
          {navTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                clsx(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-primary text-white shadow-emerald font-bold scale-[1.02]'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-lowest/60'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Utility Cluster: Search, Notifications, Theme & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/admin/deliveries')}
            title="Search Deliveries & Manifest"
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-low hover:bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:text-on-surface text-xs transition-all shadow-inner"
          >
            <Search className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="text-[11px] font-medium">Search...</span>
          </button>

          <button
            onClick={() => navigate('/admin/deliveries')}
            title="Search Deliveries & Manifest"
            className="sm:hidden w-9 h-9 rounded-full bg-surface-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
          </button>

          <button
            onClick={() => navigate('/admin/notifications')}
            title="System Alerts & Operational Notifications"
            className="w-9 h-9 rounded-full bg-surface-low hover:bg-surface-container border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative"
          >
            <Bell className="w-4 h-4 stroke-[2.2]" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface-lowest animate-pulse" />
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* User Profile Avatar Pill */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs ring-2 ring-primary/40 shadow-emerald">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SR'}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Hero Greeting & Action Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-emerald shrink-0" />
          <div>
            {isGreetingView ? (
              <h1 className="text-2xl lg:text-3xl font-normal text-on-surface tracking-tight">
                Welcome Back, <span className="font-semibold text-on-surface">{displayName}</span>
              </h1>
            ) : (
              <h1 className="text-xl lg:text-2xl font-bold text-on-surface tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-on-surface-variant mt-0.5 font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Action Tools: Date Range Pill & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Dispatch Shift & Date Pill */}
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-lowest rounded-full shadow-soft border border-outline-variant/60 text-xs font-medium text-on-surface transition-colors">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>Today • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className="text-on-surface-variant/60">•</span>
            <span className="font-mono text-primary font-semibold">{time || 'Live IST'}</span>
          </div>

          {/* Page specific action buttons slot */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
};
