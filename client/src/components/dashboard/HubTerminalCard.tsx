import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Radio,
  Route,
  Layers,
  Navigation,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';

interface HubTerminalCardProps {
  systemHealth?: {
    backend?: { status: string };
    socketIo?: { status: string };
    geoapify?: { status: string };
  };
}

export const HubTerminalCard: React.FC<HubTerminalCardProps> = ({ systemHealth }) => {
  const navigate = useNavigate();

  return (
    <div className="panel-card rounded-xl p-5 flex flex-col justify-between space-y-5 border border-outline-variant/60 dark:border-obsidian-750 transition-colors">
      <div>
        {/* Terminal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2.5">
            <div className="p-2 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/40 dark:border-obsidian-700 text-on-surface-variant dark:text-slate-300 mt-0.5">
              <MapPin className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-on-surface dark:text-white tracking-tight">Rasulgarh Central Hub</h3>
              <p className="text-[11px] text-on-surface-variant dark:text-slate-400 font-mono">Bhubaneswar Urban Terminal</p>
            </div>
          </div>

          {/* Telemetry Online Status */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Online
          </span>
        </div>

        {/* Hub Parameter Specs */}
        <div className="mt-4 space-y-2.5 text-xs bg-surface-low dark:bg-obsidian-950/60 p-3.5 rounded-lg border border-outline-variant/40 dark:border-obsidian-750">
          <div className="flex items-center justify-between py-1 border-b border-outline-variant/30 dark:border-obsidian-800">
            <span className="text-on-surface-variant dark:text-slate-400">Depot Location:</span>
            <span className="font-medium text-on-surface dark:text-slate-200">Plot 104/A, Industrial Estate</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-outline-variant/30 dark:border-obsidian-800">
            <span className="text-on-surface-variant dark:text-slate-400">Active Shift:</span>
            <span className="font-medium text-on-surface dark:text-slate-200">Shift A (08:00 - 17:00 IST)</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-on-surface-variant dark:text-slate-400">Optimization Strategy:</span>
            <span className="font-mono text-on-surface dark:text-slate-200 bg-surface-lowest dark:bg-obsidian-800 px-2 py-0.5 rounded border border-outline-variant/60 dark:border-obsidian-750 text-[11px]">
              2-Opt Local Search
            </span>
          </div>
        </div>
      </div>

      {/* Dispatch Command Actions Button Grid */}
      <div className="space-y-2 pt-1">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant dark:text-slate-400 block mb-1">
          Quick Actions
        </span>

        {/* Full-width Primary Button */}
        <button
          onClick={() => navigate('/admin/optimizer')}
          className="w-full py-2 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-colors flex items-center justify-center space-x-2"
          type="button"
        >
          <Route className="w-4 h-4 stroke-[2]" />
          <span>Route Optimizer</span>
        </button>

        {/* Outlined Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/admin/batches')}
            className="py-2 px-3 rounded-lg bg-surface-lowest dark:bg-obsidian-900 hover:bg-surface-low dark:hover:bg-obsidian-850 border border-outline-variant/60 dark:border-obsidian-750 text-on-surface dark:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5"
            type="button"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Batches</span>
          </button>

          <button
            onClick={() => navigate('/admin/tracking')}
            className="py-2 px-3 rounded-lg bg-surface-lowest dark:bg-obsidian-900 hover:bg-surface-low dark:hover:bg-obsidian-850 border border-outline-variant/60 dark:border-obsidian-750 text-on-surface dark:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5"
            type="button"
          >
            <Navigation className="w-3.5 h-3.5 text-slate-400" />
            <span>Tracking</span>
          </button>
        </div>

        {/* Master Manifest */}
        <button
          onClick={() => navigate('/admin/deliveries')}
          className="w-full py-2 px-3 rounded-lg bg-surface-lowest dark:bg-obsidian-900 hover:bg-surface-low dark:hover:bg-obsidian-850 border border-outline-variant/60 dark:border-obsidian-750 text-on-surface dark:text-slate-200 text-xs font-medium transition-colors flex items-center justify-center space-x-1.5"
          type="button"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
          <span>Master Manifest</span>
        </button>
      </div>
    </div>
  );
};
