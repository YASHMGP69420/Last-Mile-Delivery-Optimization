import React, { useState } from 'react';
import { Route, Truck, BatteryCharging } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';

export const DriverHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(true);

  return (
    <header className="h-14 bg-primary text-white px-4 flex items-center justify-between shrink-0 shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-white">
          <Route className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div>
          <span className="font-bold text-xs text-white block leading-tight">SmartRoute</span>
          <span className="text-[10px] text-slate-400 block font-mono">
            {user?.name || 'Driver Mobile'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* On Duty Toggle */}
        <button
          onClick={() => setIsOnDuty(!isOnDuty)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            isOnDuty
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-slate-700 text-slate-300 border border-slate-600'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
          {isOnDuty ? 'On Duty' : 'Off Duty'}
        </button>

        {/* Vehicle Badge */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary-hover text-[11px] font-mono text-slate-300 border border-slate-700">
          <Truck className="w-3 h-3 text-secondary" />
          <span>Tata Ace EV</span>
        </div>

        {/* Battery */}
        <div className="flex items-center gap-0.5 text-emerald-400 text-[11px] font-mono">
          <BatteryCharging className="w-3.5 h-3.5" />
          <span>92%</span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle variant="icon-only" />
      </div>
    </header>
  );
};
