import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Activity, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
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

  return (
    <header className="h-16 bg-surface-lowest border-b border-outline-variant px-6 flex items-center justify-between shrink-0">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-lg font-bold text-on-surface tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
      </div>

      {/* Center/Right Status & Actions */}
      <div className="flex items-center gap-4">
        {/* Actions slot */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {/* Live IST Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-surface-low rounded-md border border-outline-variant text-xs text-on-surface font-mono tabular-nums">
          <Clock className="w-3.5 h-3.5 text-secondary" />
          <span>{time || '--:--:--'}</span>
          <span className="text-[10px] text-on-surface-variant font-sans font-semibold">IST</span>
        </div>

        {/* System Health Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Cluster Online</span>
        </div>

        {/* Role Tag */}
        <div className="flex items-center gap-2 pl-2 border-l border-outline-variant">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-secondary/10 text-secondary border border-secondary/20">
            {user?.role || 'DISPATCHER'}
          </span>
        </div>
      </div>
    </header>
  );
};
